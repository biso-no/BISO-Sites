import { ID, Permission, Query, Role } from "@repo/api";
import { type Orders, OrdersStatus } from "@repo/api/types/appwrite";
import type { CheckoutSessionParams } from "../types/vipps";
import { type ParsedOrderItem, parseOrderItems } from "./order-parsing";

export interface DbClient {
  createRow: (
    dbId: string,
    collId: string,
    docId: string,
    data: Record<string, unknown>,
    permissions?: string[]
  ) => Promise<unknown>;
  decrementRowColumn?: <T = unknown>(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    column: string;
    value: number;
    min?: number;
  }) => Promise<T>;
  deleteRow: (dbId: string, collId: string, docId: string) => Promise<unknown>;
  getRow: (dbId: string, collId: string, docId: string) => Promise<unknown>;
  incrementRowColumn?: <T = unknown>(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    column: string;
    value: number;
    max?: number;
  }) => Promise<T>;
  listRows: (
    dbId: string,
    collId: string,
    queries?: string[]
  ) => Promise<{ rows: Array<{ $id: string }> }>;
  updateRow: (
    dbId: string,
    collId: string,
    docId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
}

function buildStoredOrderItems(items: CheckoutSessionParams["items"]) {
  return items.map(({ productId, ...item }) => ({
    ...item,
    product_id: productId,
  }));
}

/**
 * Per-row read grant so the buyer can fetch their own order. The orders table
 * has row-level security on, and its collection permissions only expose rows to
 * the Operations Unit team — without a document-level grant the buyer's session
 * client gets a 404 on its own confirmation page. Status writes still go through
 * the admin client, so the buyer only needs read. Anonymous/legacy "guest"
 * orders fall back to public read since there is no account to scope to.
 */
function buildOrderPermissions(userId: string): string[] {
  if (userId && userId !== "guest") {
    return [Permission.read(Role.user(userId))];
  }
  return [Permission.read(Role.any())];
}

/**
 * Creates an order in the database with PENDING status
 */
export async function createOrder(
  params: CheckoutSessionParams,
  databases: DbClient
): Promise<{ orderId: string; order: Orders }> {
  const orderId = ID.unique();

  try {
    const order = (await databases.createRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId,
      {
        status: OrdersStatus.PENDING,
        userId: params.userId,
        buyer_name:
          params.customerInfo?.firstName && params.customerInfo?.lastName
            ? `${params.customerInfo.firstName} ${params.customerInfo.lastName}`
            : null,
        buyer_email: params.customerInfo?.email || null,
        buyer_phone: params.customerInfo?.phone || null,
        subtotal: params.subtotal,
        discount_total: params.discountTotal || null,
        total: params.total,
        currency: params.currency,
        items_json: JSON.stringify(buildStoredOrderItems(params.items)),
        membership_applied: params.membershipApplied || null,
        member_discount_percent: params.memberDiscountPercent || null,
        campus_id: params.campusId || null,
      },
      buildOrderPermissions(params.userId)
    )) as Orders;

    return { orderId, order };
  } catch (error) {
    console.error("Error creating order:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : `Failed to create order in database: ${String(error)}`
    );
  }
}

export interface OrderSessionUpdate {
  checkoutUrl: string;
  provider: string;
  sessionId: string;
}

/**
 * Persists the provider checkout session on an order using the canonical
 * payment columns the return/verify path reads (`payment_provider`,
 * `payment_session_id`, `payment_link`). Provider-agnostic — used by both the
 * Vipps and Stripe checkout routes.
 */
export async function updateOrderWithSession(
  orderId: string,
  update: OrderSessionUpdate,
  databases: DbClient
): Promise<void> {
  try {
    await databases.updateRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId,
      {
        payment_provider: update.provider,
        payment_session_id: update.sessionId,
        payment_link: update.checkoutUrl,
      }
    );
  } catch (error) {
    console.error("Error updating order with session:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : `Failed to update order with payment session: ${String(error)}`
    );
  }
}

/**
 * Applies a resolved order status transition: reads the current order, adjusts
 * stock + reservations for the old→new transition, then persists the new status
 * plus any extra column updates. Provider-agnostic — the Vipps reconcile path
 * and the Stripe callback path share this so stock handling lives in exactly
 * one place.
 */
export async function applyOrderStatusTransition(
  orderId: string,
  newStatus: OrdersStatus,
  updateData: Partial<Orders>,
  databases: DbClient
): Promise<{ newStatus: OrdersStatus }> {
  const currentOrder = (await databases.getRow(
    process.env.APPWRITE_DATABASE_ID!,
    process.env.APPWRITE_ORDERS_COLLECTION_ID!,
    orderId
  )) as Orders;

  const oldStatus: OrdersStatus = currentOrder.status || OrdersStatus.PENDING;
  const orderItems = parseOrderItems(currentOrder.items_json);

  try {
    const shouldDecrement =
      (newStatus === OrdersStatus.AUTHORIZED ||
        newStatus === OrdersStatus.PAID) &&
      oldStatus !== OrdersStatus.AUTHORIZED &&
      oldStatus !== OrdersStatus.PAID;

    // The transition_lock claim serializes the one-time stock decrement across
    // the three concurrent entry points (webhook, return route, reconcile cron)
    // so it happens exactly once. It guards ONLY the stock decrement — the
    // status write below always runs. That way a caller that loses the claim,
    // or a retry after a crash that decremented stock but never persisted the
    // status, still marks the order paid instead of leaving it stuck pending
    // (and without decrementing stock a second time).
    let skipStockDecrement = false;

    if (shouldDecrement && databases.incrementRowColumn) {
      try {
        const claimed = await databases.incrementRowColumn<
          Record<string, unknown>
        >({
          databaseId: process.env.APPWRITE_DATABASE_ID!,
          tableId: process.env.APPWRITE_ORDERS_COLLECTION_ID!,
          rowId: orderId,
          column: "transition_lock",
          value: 1,
        });

        const lockValue =
          typeof claimed?.transition_lock === "number"
            ? claimed.transition_lock
            : 0;

        if (lockValue !== 1) {
          // Another caller already owns the stock decrement for this order.
          // Don't decrement again, but still persist the status below.
          console.log(
            `[Order] Stock decrement for ${orderId} already claimed (lock: ${lockValue}); persisting status without re-decrementing.`
          );
          skipStockDecrement = true;
        }
      } catch (error) {
        console.warn(
          `[Order] incrementRowColumn failed on ${orderId}, falling back to non-atomic transition:`,
          error
        );
      }
    }

    // adjustStockForOrder decides decrement vs. cancellation-restore vs. no-op
    // from old/new status; only skip it when we specifically lost the
    // decrement claim (another caller is handling that exact adjustment).
    if (!skipStockDecrement) {
      await adjustStockForOrder({
        newStatus,
        oldStatus,
        orderItems,
        databases,
        orderId,
        userId: currentOrder.userId ?? undefined,
      });
    }

    await databases.updateRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId,
      {
        status: newStatus,
        ...updateData,
      }
    );

    console.log(`[Order] Status updated: ${oldStatus} -> ${newStatus}`);
    return { newStatus };
  } catch (error) {
    console.error("Error updating order status:", error);
    throw new Error("Failed to update order status");
  }
}

interface StockAdjustmentParams {
  databases: DbClient;
  newStatus: OrdersStatus;
  oldStatus: OrdersStatus;
  orderId: string;
  orderItems: ParsedOrderItem[];
  userId?: string;
}

async function adjustStockForOrder({
  newStatus,
  oldStatus,
  orderItems,
  databases,
  orderId,
  userId,
}: StockAdjustmentParams): Promise<void> {
  const shouldDecrement =
    (newStatus === OrdersStatus.AUTHORIZED ||
      newStatus === OrdersStatus.PAID) &&
    oldStatus !== OrdersStatus.AUTHORIZED &&
    oldStatus !== OrdersStatus.PAID;

  if (shouldDecrement) {
    console.log(`[Stock] Decrementing stock for order ${orderId}`);
    await decrementStockForItems({ orderItems, databases });

    if (userId) {
      await deleteUserReservations({
        databases,
        userId,
        productIds: orderItems
          .map((item) => item.product_id)
          .filter((id): id is string => Boolean(id)),
      });
    }
  }

  const shouldRestore =
    newStatus === OrdersStatus.CANCELLED &&
    (oldStatus === OrdersStatus.AUTHORIZED || oldStatus === OrdersStatus.PAID);

  if (shouldRestore) {
    console.log(`[Stock] Restoring stock for cancelled order ${orderId}`);
    await restoreStockForItems({ orderItems, databases });
  }
}

async function readTrackedStock(
  databases: DbClient,
  productId: string
): Promise<number | null> {
  const product = (await databases.getRow(
    process.env.APPWRITE_DATABASE_ID!,
    process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
    productId
  )) as Record<string, unknown>;
  return typeof product.stock === "number" ? product.stock : null;
}

/**
 * Atomically decrement one product's stock. `min: 0` makes Appwrite reject a
 * decrement that would go negative — that rejection is an oversell (payment is
 * already authorized for more units than remain), so it is logged loudly and
 * the stock floored to 0 instead of failing the paid transition.
 */
async function decrementProductStockAtomically(
  databases: DbClient,
  productId: string,
  quantity: number
): Promise<void> {
  if (!databases.decrementRowColumn) {
    throw new Error("decrementRowColumn is not available on this client");
  }

  try {
    const updated = await databases.decrementRowColumn<Record<string, unknown>>(
      {
        databaseId: process.env.APPWRITE_DATABASE_ID!,
        tableId: process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        rowId: productId,
        column: "stock",
        value: quantity,
        min: 0,
      }
    );
    console.log(
      `[Stock] Product ${productId}: atomically decremented by ${quantity} (now ${String(updated.stock)})`
    );
  } catch (error) {
    const remaining = await readTrackedStock(databases, productId);
    if (remaining !== null && remaining < quantity) {
      console.error(
        `[Stock] OVERSELL product ${productId}: paid quantity ${quantity} exceeds remaining stock ${remaining}; flooring to 0. Manual follow-up required.`
      );
      await databases.updateRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        productId,
        { stock: 0 }
      );
      return;
    }
    throw error;
  }
}

async function decrementStockForItems({
  orderItems,
  databases,
}: {
  orderItems: ParsedOrderItem[];
  databases: DbClient;
}): Promise<void> {
  for (const item of orderItems) {
    if (!item.product_id) {
      continue;
    }

    try {
      const itemQuantity =
        typeof item.quantity === "number" ? item.quantity : 0;
      if (itemQuantity <= 0) {
        continue;
      }

      const productStock = await readTrackedStock(databases, item.product_id);
      if (productStock === null) {
        // Stock is not tracked for this product.
        continue;
      }

      if (databases.decrementRowColumn) {
        await decrementProductStockAtomically(
          databases,
          item.product_id,
          itemQuantity
        );
        continue;
      }

      // Legacy fallback for clients without atomic column ops. Read-modify-
      // write races under concurrency — kept only so old callers don't break.
      const newStock = Math.max(0, productStock - itemQuantity);
      await databases.updateRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id,
        { stock: newStock }
      );
      console.log(
        `[Stock] Product ${item.product_id}: ${productStock} -> ${newStock}`
      );
    } catch (error) {
      console.error(
        `Error decrementing stock for product ${item.product_id}:`,
        error
      );
    }
  }
}

async function restoreStockForItems({
  orderItems,
  databases,
}: {
  orderItems: ParsedOrderItem[];
  databases: DbClient;
}): Promise<void> {
  for (const item of orderItems) {
    if (!item.product_id) {
      continue;
    }

    try {
      const itemQuantity =
        typeof item.quantity === "number" ? item.quantity : 0;
      if (itemQuantity <= 0) {
        continue;
      }

      const productStock = await readTrackedStock(databases, item.product_id);
      if (productStock === null) {
        continue;
      }

      if (databases.incrementRowColumn) {
        const updated = await databases.incrementRowColumn<
          Record<string, unknown>
        >({
          databaseId: process.env.APPWRITE_DATABASE_ID!,
          tableId: process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
          rowId: item.product_id,
          column: "stock",
          value: itemQuantity,
        });
        console.log(
          `[Stock] Restored product ${item.product_id}: atomically incremented by ${itemQuantity} (now ${String(updated.stock)})`
        );
        continue;
      }

      // Legacy fallback for clients without atomic column ops.
      const newStock = productStock + itemQuantity;
      await databases.updateRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id,
        { stock: newStock }
      );
      console.log(
        `[Stock] Restored product ${item.product_id}: ${productStock} -> ${newStock}`
      );
    } catch (error) {
      console.error(
        `Error restoring stock for product ${item.product_id}:`,
        error
      );
    }
  }
}

const RESERVATION_CLEANUP_PAGE_SIZE = 100;
const RESERVATION_CLEANUP_MAX_PAGES = 20;

/**
 * Deletes the buyer's cart reservations for the products in the paid order —
 * scoped by product so unrelated holds (items still sitting in the cart but
 * not part of this order) survive, and paginated so more than 25 rows are
 * actually cleaned up.
 */
async function deleteUserReservations({
  databases,
  userId,
  productIds,
}: {
  databases: DbClient;
  userId: string;
  productIds: string[];
}): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  try {
    for (let page = 0; page < RESERVATION_CLEANUP_MAX_PAGES; page++) {
      const reservations = await databases.listRows(
        process.env.APPWRITE_DATABASE_ID!,
        "cart_reservations",
        [
          Query.equal("user_id", userId),
          Query.equal("product_id", productIds),
          Query.limit(RESERVATION_CLEANUP_PAGE_SIZE),
        ]
      );

      for (const reservation of reservations.rows) {
        await databases.deleteRow(
          process.env.APPWRITE_DATABASE_ID!,
          "cart_reservations",
          reservation.$id
        );
      }

      // Rows are deleted as we go, so re-querying the first page walks the
      // remainder; a short page means we're done.
      if (reservations.rows.length < RESERVATION_CLEANUP_PAGE_SIZE) {
        break;
      }
    }
    console.log(
      `[Stock] Deleted cart reservations for user ${userId} (products: ${productIds.join(", ")})`
    );
  } catch (error) {
    console.error("Error deleting cart reservations:", error);
  }
}
