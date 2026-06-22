import { ID } from "@repo/api";
import { type Orders, OrdersStatus } from "@repo/api/types/appwrite";
import type { CheckoutSessionParams } from "../types/vipps";
import { type ParsedOrderItem, parseOrderItems } from "./order-parsing";

export interface DbClient {
  createRow: (
    dbId: string,
    collId: string,
    docId: string,
    data: Record<string, unknown>
  ) => Promise<unknown>;
  deleteRow: (dbId: string, collId: string, docId: string) => Promise<unknown>;
  getRow: (dbId: string, collId: string, docId: string) => Promise<unknown>;
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
      }
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
    await adjustStockForOrder({
      newStatus,
      oldStatus,
      orderItems,
      databases,
      orderId,
      userId: currentOrder.userId ?? undefined,
    });

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
      await deleteUserReservations({ databases, userId });
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
      const product = await databases.getRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id
      );

      const productRecord = product as Record<string, unknown>;
      const productStock =
        typeof productRecord.stock === "number" ? productRecord.stock : null;
      const itemQuantity =
        typeof item.quantity === "number" ? item.quantity : 0;

      if (productStock !== null) {
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
      }
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
      const product = await databases.getRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id
      );

      const productRecord = product as Record<string, unknown>;
      const productStock =
        typeof productRecord.stock === "number" ? productRecord.stock : null;
      const itemQuantity =
        typeof item.quantity === "number" ? item.quantity : 0;

      if (productStock !== null) {
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
      }
    } catch (error) {
      console.error(
        `Error restoring stock for product ${item.product_id}:`,
        error
      );
    }
  }
}

async function deleteUserReservations({
  databases,
  userId,
}: {
  databases: DbClient;
  userId: string;
}): Promise<void> {
  try {
    const reservations = await databases.listRows(
      process.env.APPWRITE_DATABASE_ID!,
      "cart_reservations",
      [`equal("user_id", "${userId}")`]
    );

    for (const reservation of reservations.rows) {
      await databases.deleteRow(
        process.env.APPWRITE_DATABASE_ID!,
        "cart_reservations",
        reservation.$id
      );
    }
    console.log(`[Stock] Deleted cart reservations for user ${userId}`);
  } catch (error) {
    console.error("Error deleting cart reservations:", error);
  }
}
