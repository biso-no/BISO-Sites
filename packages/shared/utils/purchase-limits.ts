import { parseOrderItems } from "./order-parsing";

export interface PurchaseLimitResult {
  allowed: boolean;
  currentPurchases?: number;
  limit?: number;
  reason?: string;
}

interface OrderForLimits {
  items_json?: string | null;
}

/**
 * Total quantity of a product a user has already bought across the given
 * orders, plus how many of those orders included it.
 *
 * Uses {@link parseOrderItems} so legacy `productId`-keyed line items are
 * normalized and counted too — counting only `product_id` would let a user
 * with legacy orders slip past per-customer limits.
 */
export function summarizePurchases(
  orders: OrderForLimits[],
  productId: string
): { totalPurchased: number; orderCount: number } {
  let totalPurchased = 0;
  let orderCount = 0;

  for (const order of orders) {
    const items = parseOrderItems(order.items_json);
    for (const item of items) {
      if (item.product_id === productId) {
        totalPurchased += typeof item.quantity === "number" ? item.quantity : 0;
        orderCount += 1;
      }
    }
  }

  return { totalPurchased, orderCount };
}

/**
 * Per-order quantity cap. No cap when `maxPerOrder` is missing or `<= 0`.
 */
export function checkMaxPerOrder(
  requestedQty: number,
  maxPerOrder?: number
): PurchaseLimitResult {
  if (!maxPerOrder || maxPerOrder <= 0) {
    return { allowed: true };
  }

  if (requestedQty > maxPerOrder) {
    return {
      allowed: false,
      limit: maxPerOrder,
      reason: `This item is limited to ${maxPerOrder} per order`,
    };
  }

  return { allowed: true, limit: maxPerOrder };
}

/**
 * Per-customer cap, given how many of the product the user has already
 * purchased. No cap when `maxPerUser` is missing or `<= 0`. A request is
 * allowed when it fits within the remaining allowance (remaining ≥ requested).
 */
export function evaluatePerUserLimit(
  totalPurchased: number,
  requestedQty: number,
  maxPerUser?: number
): PurchaseLimitResult {
  if (!maxPerUser || maxPerUser <= 0) {
    return { allowed: true };
  }

  const remaining = maxPerUser - totalPurchased;

  if (remaining < requestedQty) {
    return {
      allowed: false,
      currentPurchases: totalPurchased,
      limit: maxPerUser,
      reason:
        remaining > 0
          ? `Purchase limit: You can only buy ${remaining} more of this item (limit: ${maxPerUser} per customer)`
          : `Purchase limit: You have already purchased the maximum allowed (${maxPerUser} per customer)`,
    };
  }

  return { allowed: true, currentPurchases: totalPurchased, limit: maxPerUser };
}
