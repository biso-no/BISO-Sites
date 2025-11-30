"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { ProductMetadata } from "@/lib/types/webshop";

type PurchaseLimitResult = {
  allowed: boolean;
  reason?: string;
  currentPurchases?: number;
  limit?: number;
};

type OrderRow = {
  items_json?: string;
};

const ORDER_STATUS_FILTER = Query.or([
  Query.equal("status", "authorized"),
  Query.equal("status", "paid"),
]);

function summarizePurchases(
  orders: OrderRow[],
  productId: string
): { totalPurchased: number; orderCount: number } {
  let totalPurchased = 0;
  let orderCount = 0;

  for (const order of orders) {
    if (!order.items_json) {
      continue;
    }
    try {
      const items = JSON.parse(order.items_json as string);
      for (const item of items) {
        if (item.product_id === productId) {
          totalPurchased += item.quantity || 0;
          orderCount += 1;
        }
      }
    } catch (error) {
      console.error("Error parsing order items:", error);
    }
  }

  return { totalPurchased, orderCount };
}

/**
 * Check if user has exceeded max_per_user limit for a product
 * Counts all orders with status 'authorized' or 'paid'
 */
async function checkMaxPerUser(
  productId: string,
  userId: string,
  requestedQty: number,
  maxPerUser?: number
): Promise<PurchaseLimitResult> {
  try {
    // If no limit is set, allow unlimited purchases
    if (!maxPerUser || maxPerUser <= 0) {
      return { allowed: true };
    }

    // Guest users (no userId) can't be tracked for per-user limits
    if (!userId || userId === "guest") {
      return { allowed: true };
    }

    const { db } = await createSessionClient();

    // Get all completed orders for this user with 'authorized' or 'paid' status
    const orders = await db.listRows("app", "orders", [
      Query.equal("userId", userId),
      ORDER_STATUS_FILTER,
    ]);

    const { totalPurchased } = summarizePurchases(orders.rows, productId);
    const remaining = (maxPerUser ?? 0) - totalPurchased;

    if (remaining < requestedQty) {
      return {
        allowed: false,
        reason:
          remaining > 0
            ? `Purchase limit: You can only buy ${remaining} more of this item (limit: ${maxPerUser} per customer)`
            : `Purchase limit: You have already purchased the maximum allowed (${maxPerUser} per customer)`,
        currentPurchases: totalPurchased,
        limit: maxPerUser,
      };
    }

    return {
      allowed: true,
      currentPurchases: totalPurchased,
      limit: maxPerUser,
    };
  } catch (error) {
    console.error("Error checking max per user:", error);
    // On error, allow the purchase to avoid blocking legitimate transactions
    return { allowed: true };
  }
}

/**
 * Check if requested quantity exceeds max_per_order limit
 */
function checkMaxPerOrder(
  requestedQty: number,
  maxPerOrder?: number
): PurchaseLimitResult {
  // If no limit is set, allow unlimited quantity
  if (!maxPerOrder || maxPerOrder <= 0) {
    return { allowed: true };
  }

  if (requestedQty > maxPerOrder) {
    return {
      allowed: false,
      reason: `This item is limited to ${maxPerOrder} per order`,
      limit: maxPerOrder,
    };
  }

  return {
    allowed: true,
    limit: maxPerOrder,
  };
}

/**
 * Validate all purchase limits for a product
 * Combines max_per_user and max_per_order checks
 */
export async function validatePurchaseLimits(
  productId: string,
  userId: string,
  quantity: number,
  metadata?: ProductMetadata | null
): Promise<PurchaseLimitResult> {
  // Extract and validate max values
  const maxPerOrder =
    typeof metadata?.max_per_order === "number"
      ? metadata.max_per_order
      : undefined;
  const maxPerUser =
    typeof metadata?.max_per_user === "number"
      ? metadata.max_per_user
      : undefined;

  // Check max_per_order first (simpler check)
  const perOrderResult = checkMaxPerOrder(quantity, maxPerOrder);

  if (!perOrderResult.allowed) {
    return perOrderResult;
  }

  // Check max_per_user
  const perUserResult = await checkMaxPerUser(
    productId,
    userId,
    quantity,
    maxPerUser
  );

  if (!perUserResult.allowed) {
    return perUserResult;
  }

  return { allowed: true };
}

/**
 * Get purchase history summary for a user and product
 */
async function _getPurchaseHistory(
  productId: string,
  userId: string
): Promise<{
  totalPurchased: number;
  orderCount: number;
}> {
  if (!userId || userId === "guest") {
    return { totalPurchased: 0, orderCount: 0 };
  }

  try {
    const { db } = await createSessionClient();

    const orders = await db.listRows("app", "orders", [
      Query.equal("userId", userId),
      ORDER_STATUS_FILTER,
    ]);

    return summarizePurchases(orders.rows, productId);
  } catch (error) {
    console.error("Error getting purchase history:", error);
    return { totalPurchased: 0, orderCount: 0 };
  }
}
