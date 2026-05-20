import { OrderStatus, type Orders } from "@repo/api/types/appwrite";
import { ID } from "node-appwrite";
import type { CheckoutSessionParams, VippsPaymentState } from "../types/vipps";
import { parseOrderItems } from "./order-parsing";
import { determineStatusFromPaymentState } from "./vipps-pure";

// Define generic DB client type
interface DbClient {
  createRow: (
    dbId: string,
    collId: string,
    docId: string,
    data: any
  ) => Promise<any>;
  deleteRow: (dbId: string, collId: string, docId: string) => Promise<any>;
  getRow: (dbId: string, collId: string, docId: string) => Promise<any>;
  listRows: (dbId: string, collId: string, queries?: string[]) => Promise<any>;
  updateRow: (
    dbId: string,
    collId: string,
    docId: string,
    data: any
  ) => Promise<any>;
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
        status: OrderStatus.PENDING,
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
        items_json: JSON.stringify(params.items),
        membership_applied: params.membershipApplied || null,
        member_discount_percent: params.memberDiscountPercent || null,
        campus_id: params.campusId || null,
        vipps_session_id: null,
        vipps_order_id: null,
        vipps_payment_link: null,
        vipps_receipt_url: null,
      }
    )) as Orders;

    return { orderId, order };
  } catch (error) {
    console.error("Error creating order:", error);
    throw new Error("Failed to create order in database");
  }
}

/**
 * Updates an order with Vipps session information
 */
export async function updateOrderWithSession(
  orderId: string,
  sessionId: string,
  checkoutUrl: string,
  databases: DbClient
): Promise<void> {
  try {
    await databases.updateRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId,
      {
        vipps_session_id: sessionId,
        vipps_payment_link: checkoutUrl,
      }
    );
  } catch (error) {
    console.error("Error updating order with session:", error);
    throw new Error("Failed to update order with Vipps session");
  }
}

/**
 * Updates order status based on Vipps payment state
 * Also handles stock decrements and restoration
 */
export async function updateOrderStatus(
  orderId: string,
  paymentState: VippsPaymentState,
  sessionData: any,
  databases: DbClient
): Promise<{ newStatus: OrderStatus }> {
  const currentOrder = (await databases.getRow(
    process.env.APPWRITE_DATABASE_ID!,
    process.env.APPWRITE_ORDERS_COLLECTION_ID!,
    orderId
  )) as Orders;

  const oldStatus: OrderStatus = currentOrder.status || OrderStatus.PENDING;
  const { status: newStatus, updateData } = determineStatusFromPaymentState(
    paymentState,
    sessionData
  );
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
  newStatus: OrderStatus;
  oldStatus: OrderStatus;
  orderId: string;
  orderItems: any[];
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
    (newStatus === OrderStatus.AUTHORIZED || newStatus === OrderStatus.PAID) &&
    oldStatus !== OrderStatus.AUTHORIZED &&
    oldStatus !== OrderStatus.PAID;

  if (shouldDecrement) {
    console.log(`[Stock] Decrementing stock for order ${orderId}`);
    await decrementStockForItems({ orderItems, databases });

    if (userId) {
      await deleteUserReservations({ databases, userId });
    }
  }

  const shouldRestore =
    newStatus === OrderStatus.CANCELLED &&
    (oldStatus === OrderStatus.AUTHORIZED || oldStatus === OrderStatus.PAID);

  if (shouldRestore) {
    console.log(`[Stock] Restoring stock for cancelled order ${orderId}`);
    await restoreStockForItems({ orderItems, databases });
  }
}

async function decrementStockForItems({
  orderItems,
  databases,
}: {
  orderItems: any[];
  databases: DbClient;
}): Promise<void> {
  for (const item of orderItems) {
    try {
      const product = await databases.getRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id
      );

      if (product.stock !== null && product.stock !== undefined) {
        const newStock = Math.max(0, product.stock - item.quantity);
        await databases.updateRow(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
          item.product_id,
          { stock: newStock }
        );
        console.log(
          `[Stock] Product ${item.product_id}: ${product.stock} -> ${newStock}`
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
  orderItems: any[];
  databases: DbClient;
}): Promise<void> {
  for (const item of orderItems) {
    try {
      const product = await databases.getRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
        item.product_id
      );

      if (product.stock !== null && product.stock !== undefined) {
        const newStock = product.stock + item.quantity;
        await databases.updateRow(
          process.env.APPWRITE_DATABASE_ID!,
          process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!,
          item.product_id,
          { stock: newStock }
        );
        console.log(
          `[Stock] Restored product ${item.product_id}: ${product.stock} -> ${newStock}`
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
