import type { Currency, Orders } from "@repo/api/types/appwrite";
import { OrderStatus } from "@repo/api/types/appwrite";
import { Client } from "@vippsmobilepay/sdk";
import { ID } from "node-appwrite";

const clientId = process.env.VIPPS_CLIENT_ID!;
const clientSecret = process.env.VIPPS_CLIENT_SECRET!;
const merchantSerialNumber = process.env.VIPPS_MERCHANT_SERIAL_NUMBER!;
const subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY!;
const testMode = process.env.VIPPS_TEST_MODE === "true";
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!;

export const client: ReturnType<typeof Client> = Client({
  merchantSerialNumber,
  subscriptionKey,
  useTestMode: testMode,
  retryRequests: false,
});

export async function getAccessToken(): Promise<string> {
  const token = await client.auth.getToken(clientId, clientSecret);
  if (token.ok) {
    return token.data.access_token;
  }
  throw new Error("Failed to get access token");
}

// ============= Types =============

export type CheckoutSessionParams = {
  userId: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  discountTotal?: number;
  shippingCost?: number;
  total: number;
  currency: Currency;
  membershipApplied?: boolean;
  memberDiscountPercent?: number;
  campusId?: string;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
};

export type VippsCheckoutResponse = {
  checkoutUrl: string;
  orderId: string;
  sessionId: string;
};

export type VippsPaymentState = {
  state: "CREATED" | "AUTHORIZED" | "ABORTED" | "EXPIRED" | "TERMINATED";
  amount?: {
    value: number;
    currency: string;
  };
};

function buildPrefillCustomer(
  info?: CheckoutSessionParams["customerInfo"]
): Record<string, string> | null {
  if (!info) {
    return null;
  }

  const prefill: Record<string, string> = {};

  if (info.firstName) {
    prefill.firstName = info.firstName;
  }
  if (info.lastName) {
    prefill.lastName = info.lastName;
  }
  if (info.email) {
    prefill.email = info.email;
  }
  if (info.phone) {
    prefill.phoneNumber = info.phone;
  }
  if (info.streetAddress) {
    prefill.streetAddress = info.streetAddress;
  }
  if (info.city) {
    prefill.city = info.city;
  }
  if (info.postalCode) {
    prefill.postalCode = info.postalCode;
  }
  if (info.country) {
    prefill.country = info.country;
  }

  return Object.keys(prefill).length > 0 ? prefill : null;
}

// ============= Order Management =============

/**
 * Creates an order in the database with PENDING status
 * This is called before creating the Vipps checkout session
 */
async function createOrder(
  params: CheckoutSessionParams,
  databases: any
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
async function updateOrderWithSession(
  orderId: string,
  sessionId: string,
  checkoutUrl: string,
  databases: any
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
async function updateOrderStatus(
  orderId: string,
  paymentState: VippsPaymentState,
  sessionData: any,
  databases: any
): Promise<void> {
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
  } catch (error) {
    console.error("Error updating order status:", error);
    throw new Error("Failed to update order status");
  }
}

function determineStatusFromPaymentState(
  paymentState: VippsPaymentState,
  sessionData: any
): { status: OrderStatus; updateData: Partial<Orders> } {
  const updateData: Partial<Orders> = {};
  let newStatus: OrderStatus;

  switch (paymentState.state) {
    case "CREATED":
      newStatus = OrderStatus.PENDING;
      break;
    case "AUTHORIZED":
      newStatus = OrderStatus.AUTHORIZED;
      updateData.vipps_order_id =
        sessionData.payment?.aggregate?.authorizedAmount?.value?.toString() ||
        null;
      break;
    case "ABORTED":
      newStatus = OrderStatus.CANCELLED;
      break;
    case "EXPIRED":
      newStatus = OrderStatus.CANCELLED;
      break;
    case "TERMINATED":
      newStatus = OrderStatus.CANCELLED;
      break;
    default:
      newStatus = OrderStatus.PENDING;
  }

  if (sessionData.payment?.aggregate?.capturedAmount?.value > 0) {
    newStatus = OrderStatus.PAID;
    updateData.vipps_receipt_url =
      sessionData.payment?.aggregate?.receipt?.url || null;
  }

  return { status: newStatus, updateData };
}

function parseOrderItems(itemsJson?: string | null): any[] {
  if (!itemsJson) {
    return [];
  }

  try {
    return JSON.parse(itemsJson);
  } catch (error) {
    console.error("Error parsing order items:", error);
    return [];
  }
}

type StockAdjustmentParams = {
  newStatus: OrderStatus;
  oldStatus: OrderStatus;
  orderItems: any[];
  databases: any;
  orderId: string;
  userId?: string;
};

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
  databases: any;
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
  databases: any;
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
  databases: any;
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

// ============= Main Functions =============

/**
 * Creates a Vipps checkout session and returns the checkout URL
 * This is called when the user clicks "Go to Checkout" in the cart
 *
 * Flow:
 * 1. Create order in database with PENDING status
 * 2. Create Vipps checkout session
 * 3. Update order with Vipps session details
 * 4. Return checkout URL for redirect
 *
 * @param params - Checkout session parameters
 * @param db - Database client (TablesDB instance from Appwrite)
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams,
  db: any
): Promise<VippsCheckoutResponse> {
  try {
    // Step 1: Create order in database first
    const { orderId, order } = await createOrder(params, db);

    // Step 2: Get access token
    const accessToken = await getAccessToken();

    // Step 3: Calculate amount in øre (smallest currency unit)
    const shippingCost = params.shippingCost || 300; // Default 300 NOK shipping
    const totalAmount = params.total + shippingCost;
    const amountInOre = totalAmount * 100;

    const prefillCustomer = buildPrefillCustomer(params.customerInfo);

    // Step 4: Prepare checkout session request
    const checkoutRequest = {
      type: "PAYMENT" as const,
      reference: orderId,
      transaction: {
        amount: {
          value: amountInOre,
          currency: params.currency,
        },
        reference: orderId,
        paymentDescription: `Order #${orderId}`,
      },
      logistics: {
        fixedOptions: [
          {
            brand: "POSTEN" as const,
            amount: {
              value: shippingCost * 100, // Convert to øre
              currency: params.currency,
            },
            id: "posten-home-delivery",
            priority: 1,
            isDefault: true,
            description: "Your package is delivered to your home.",
          },
          {
            brand: "POSTEN" as const,
            amount: {
              value: shippingCost * 100,
              currency: params.currency,
            },
            type: "PICKUP_POINT" as const,
            id: "posten-pickup-point",
            priority: 2,
            isDefault: false,
            description: "Pick up your package at the local store.",
          },
        ],
      },
      ...(prefillCustomer && { prefillCustomer }),
      merchantInfo: {
        callbackUrl: `${baseUrl}/api/payment/vipps/callback`,
        returnUrl: `${baseUrl}/checkout/return?orderId=${orderId}`,
        callbackAuthorizationToken:
          process.env.VIPPS_CALLBACK_TOKEN || ID.unique(),
        termsAndConditionsUrl: `${baseUrl}/terms`,
      },
      configuration: {
        customerInteraction: "CUSTOMER_NOT_PRESENT" as const,
        elements: "Full" as const,
        countries: {
          supported: ["NO", "SE", "DK"],
        },
      },
    };

    // Step 5: Create checkout session with Vipps
    const checkoutResponse = await client.checkout.create(
      merchantSerialNumber,
      accessToken,
      checkoutRequest
    );

    if (!checkoutResponse.ok) {
      // Update order to failed status
      await db.updateRow(
        process.env.APPWRITE_DATABASE_ID!,
        process.env.APPWRITE_ORDERS_COLLECTION_ID!,
        orderId,
        { status: OrderStatus.FAILED }
      );

      throw new Error(
        `Failed to create Vipps checkout session: ${JSON.stringify(checkoutResponse.error)}`
      );
    }

    // Step 6: Extract session details
    const sessionId = checkoutResponse.data.token || orderId;
    const checkoutUrl = checkoutResponse.data.checkoutFrontendUrl || "";

    if (!checkoutUrl) {
      throw new Error("No checkout URL returned from Vipps");
    }

    // Step 7: Update order with Vipps session information
    await updateOrderWithSession(orderId, sessionId, checkoutUrl, db);

    return {
      checkoutUrl,
      orderId,
      sessionId,
    };
  } catch (error) {
    console.error("Error creating checkout session:", error);
    throw error;
  }
}

/**
 * Handles the webhook callback from Vipps
 * This is called by Vipps when payment status changes
 *
 * States handled:
 * - CREATED: Payment initiated, no action yet
 * - AUTHORIZED: User accepted payment
 * - ABORTED: User cancelled payment
 * - EXPIRED: Payment timed out
 * - TERMINATED: Merchant cancelled payment
 *
 * @param authToken - Authorization token from webhook header
 * @param sessionId - Vipps session ID
 * @param db - Database client (TablesDB instance from Appwrite)
 */
export async function handleVippsCallback(
  authToken: string,
  sessionId: string,
  db: any
): Promise<{ success: boolean; message: string }> {
  try {
    // Verify callback token
    const expectedToken = process.env.VIPPS_CALLBACK_TOKEN;
    if (expectedToken && authToken !== expectedToken) {
      console.error("Invalid callback token");
      return { success: false, message: "Unauthorized" };
    }

    // Find order by session ID
    const orders = await db.listRows(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      [`equal("vipps_session_id", "${sessionId}")`]
    );

    if (orders.total === 0) {
      console.error(`Order not found for session ${sessionId}`);
      return { success: false, message: "Order not found" };
    }

    const order = orders.rows[0];

    if (!order) {
      console.error("Order not found in result set");
      return { success: false, message: "Order not found" };
    }

    // Get session info from Vipps
    const accessToken = await getAccessToken();
    const sessionInfo = await client.checkout.info(
      merchantSerialNumber,
      accessToken,
      sessionId
    );

    if (!sessionInfo.ok) {
      console.error(
        `Failed to get session info: ${JSON.stringify(sessionInfo.error)}`
      );
      return { success: false, message: "Failed to get session info" };
    }

    const sessionData = sessionInfo.data as any;
    const paymentState: VippsPaymentState = {
      state: sessionData.payment?.state || "CREATED",
      amount: sessionData.payment?.aggregate?.authorizedAmount,
    };

    // Update order status based on payment state
    await updateOrderStatus(order.$id, paymentState, sessionData, db);

    return { success: true, message: "Callback processed successfully" };
  } catch (error) {
    console.error("Error handling Vipps callback:", error);
    return { success: false, message: "Internal error" };
  }
}

/**
 * Retrieves order information by ID
 * Used on the return page to display order status
 *
 * @param orderId - Order ID to retrieve
 * @param db - Database client (TablesDB instance from Appwrite)
 */
export async function getOrderStatus(
  orderId: string,
  db: any
): Promise<Orders | null> {
  try {
    const order = (await db.getRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId
    )) as Orders;

    return order;
  } catch (error) {
    console.error("Error getting order status:", error);
    return null;
  }
}

/**
 * Verifies and updates order status by checking with Vipps
 * Call this on the return page to ensure the order status is up-to-date
 * This handles race conditions where the webhook might not have been processed yet
 *
 * @param orderId - Order ID to verify
 * @param db - Database client (TablesDB instance from Appwrite)
 */
export async function verifyOrderStatus(
  orderId: string,
  db: any
): Promise<Orders | null> {
  try {
    const order = (await db.getRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId
    )) as Orders;

    if (!order.vipps_session_id) {
      // No Vipps session yet, return current order
      return order;
    }

    // Get latest session info from Vipps
    const accessToken = await getAccessToken();
    const sessionInfo = await client.checkout.info(
      merchantSerialNumber,
      accessToken,
      order.vipps_session_id
    );

    if (!sessionInfo.ok) {
      console.error("Failed to verify order with Vipps:", sessionInfo.error);
      return order;
    }

    const sessionData = sessionInfo.data as any;
    const paymentState: VippsPaymentState = {
      state: sessionData.payment?.state || "CREATED",
      amount: sessionData.payment?.aggregate?.authorizedAmount,
    };

    // Update order if status has changed
    await updateOrderStatus(order.$id, paymentState, sessionData, db);

    // Fetch and return updated order
    const updatedOrder = (await db.getRow(
      process.env.APPWRITE_DATABASE_ID!,
      process.env.APPWRITE_ORDERS_COLLECTION_ID!,
      orderId
    )) as Orders;

    return updatedOrder;
  } catch (error) {
    console.error("Error verifying order status:", error);
    return null;
  }
}
