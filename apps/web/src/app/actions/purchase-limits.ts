"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import {
  checkMaxPerOrder,
  evaluatePerUserLimit,
  type PurchaseLimitResult,
  summarizePurchases,
} from "@repo/shared/utils/purchase-limits";
import type { ProductMetadata } from "@/lib/types/webshop";

const ORDER_STATUS_FILTER = Query.or([
  Query.equal("status", "authorized"),
  Query.equal("status", "paid"),
]);

/**
 * Check if user has exceeded max_per_user limit for a product.
 * Counts all orders with status 'authorized' or 'paid'.
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
    const orders = await db.listRows<Orders>("app", "orders", [
      Query.equal("userId", userId),
      ORDER_STATUS_FILTER,
      // Without an explicit limit Appwrite returns max 25 rows, which would
      // under-count purchases and let users bypass per-customer limits.
      Query.limit(1000),
    ]);

    const { totalPurchased } = summarizePurchases(orders.rows, productId);
    return evaluatePerUserLimit(totalPurchased, requestedQty, maxPerUser);
  } catch (error) {
    console.error("Error checking max per user:", error);
    // On error, allow the purchase to avoid blocking legitimate transactions
    return { allowed: true };
  }
}

/**
 * Validate all purchase limits for a product.
 * Combines max_per_order and max_per_user checks.
 */
export async function validatePurchaseLimits(
  productId: string,
  userId: string,
  quantity: number,
  metadata?: ProductMetadata | null
): Promise<PurchaseLimitResult> {
  const maxPerOrder =
    typeof metadata?.max_per_order === "number"
      ? metadata.max_per_order
      : undefined;
  const maxPerUser =
    typeof metadata?.max_per_user === "number"
      ? metadata.max_per_user
      : undefined;

  // Check max_per_order first (simpler, no DB round-trip)
  const perOrderResult = checkMaxPerOrder(quantity, maxPerOrder);
  if (!perOrderResult.allowed) {
    return perOrderResult;
  }

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
 * Get purchase history summary for a user and product.
 */
async function _getPurchaseHistory(
  productId: string,
  userId: string
): Promise<{ totalPurchased: number; orderCount: number }> {
  if (!userId || userId === "guest") {
    return { totalPurchased: 0, orderCount: 0 };
  }

  try {
    const { db } = await createSessionClient();

    const orders = await db.listRows<Orders>("app", "orders", [
      Query.equal("userId", userId),
      ORDER_STATUS_FILTER,
      // Without an explicit limit Appwrite returns max 25 rows, which would
      // under-count purchases and let users bypass per-customer limits.
      Query.limit(1000),
    ]);

    return summarizePurchases(orders.rows, productId);
  } catch (error) {
    console.error("Error getting purchase history:", error);
    return { totalPurchased: 0, orderCount: 0 };
  }
}
