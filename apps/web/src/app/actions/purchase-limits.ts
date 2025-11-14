"use server"

import { createAdminClient } from "@repo/api/server"
import { Query } from "@repo/api"
import type { ProductMetadata } from "@/lib/types/webshop"

interface PurchaseLimitResult {
  allowed: boolean
  reason?: string
  currentPurchases?: number
  limit?: number
}

/**
 * Check if user has exceeded max_per_user limit for a product
 * Counts all orders with status 'authorized' or 'paid'
 */
export async function checkMaxPerUser(
  productId: string,
  userId: string,
  requestedQty: number,
  maxPerUser?: number
): Promise<PurchaseLimitResult> {
  // If no limit is set, allow unlimited purchases
  if (!maxPerUser || maxPerUser <= 0) {
    return { allowed: true }
  }
  
  // Guest users (no userId) can't be tracked for per-user limits
  if (!userId || userId === 'guest') {
    // For guests, we'll allow the purchase but can't enforce the limit
    return { allowed: true }
  }
  
  try {
    const { db } = await createAdminClient()
    
    // Get all completed orders for this user with 'authorized' or 'paid' status
    const orders = await db.listRows(
      'app',
      'orders',
      [
        Query.equal('userId', userId),
        Query.or([
          Query.equal('status', 'authorized'),
          Query.equal('status', 'paid'),
        ]),
      ]
    )
    
    // Count quantities purchased for this specific product
    let totalPurchased = 0
    for (const order of orders.rows) {
      const itemsJson = order.items_json as string
      if (itemsJson) {
        try {
          const items = JSON.parse(itemsJson)
          for (const item of items) {
            if (item.product_id === productId) {
              totalPurchased += item.quantity || 0
            }
          }
        } catch (e) {
          console.error('Error parsing order items:', e)
        }
      }
    }
    
    const wouldExceedLimit = (totalPurchased + requestedQty) > maxPerUser
    
    if (wouldExceedLimit) {
      const remaining = Math.max(0, maxPerUser - totalPurchased)
      return {
        allowed: false,
        reason: remaining > 0 
          ? `Purchase limit: You can only buy ${remaining} more of this item (limit: ${maxPerUser} per customer)`
          : `Purchase limit: You have already purchased the maximum allowed (${maxPerUser} per customer)`,
        currentPurchases: totalPurchased,
        limit: maxPerUser,
      }
    }
    
    return { 
      allowed: true,
      currentPurchases: totalPurchased,
      limit: maxPerUser,
    }
  } catch (error) {
    console.error('Error checking max per user:', error)
    // On error, allow the purchase to avoid blocking legitimate transactions
    return { allowed: true }
  }
}

/**
 * Check if requested quantity exceeds max_per_order limit
 */
export async function checkMaxPerOrder(
  requestedQty: number,
  maxPerOrder?: number
): Promise<PurchaseLimitResult> {
  // If no limit is set, allow unlimited quantity
  if (!maxPerOrder || maxPerOrder <= 0) {
    return { allowed: true }
  }
  
  if (requestedQty > maxPerOrder) {
    return {
      allowed: false,
      reason: `This item is limited to ${maxPerOrder} per order`,
      limit: maxPerOrder,
    }
  }
  
  return { 
    allowed: true,
    limit: maxPerOrder,
  }
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
  const maxPerOrder = typeof metadata?.max_per_order === 'number' 
    ? metadata.max_per_order 
    : undefined
  const maxPerUser = typeof metadata?.max_per_user === 'number' 
    ? metadata.max_per_user 
    : undefined
  
  // Check max_per_order first (simpler check)
  const perOrderResult = await checkMaxPerOrder(
    quantity,
    maxPerOrder
  )
  
  if (!perOrderResult.allowed) {
    return perOrderResult
  }
  
  // Check max_per_user
  const perUserResult = await checkMaxPerUser(
    productId,
    userId,
    quantity,
    maxPerUser
  )
  
  if (!perUserResult.allowed) {
    return perUserResult
  }
  
  return { allowed: true }
}

/**
 * Get purchase history summary for a user and product
 */
export async function getPurchaseHistory(
  productId: string,
  userId: string
): Promise<{
  totalPurchased: number
  orderCount: number
}> {
  if (!userId || userId === 'guest') {
    return { totalPurchased: 0, orderCount: 0 }
  }
  
  try {
    const { db } = await createAdminClient()
    
    const orders = await db.listRows(
      'app',
      'orders',
      [
        Query.equal('userId', userId),
        Query.or([
          Query.equal('status', 'authorized'),
          Query.equal('status', 'paid'),
        ]),
      ]
    )
    
    let totalPurchased = 0
    let orderCount = 0
    
    for (const order of orders.rows) {
      const itemsJson = order.items_json as string
      if (itemsJson) {
        try {
          const items = JSON.parse(itemsJson)
          for (const item of items) {
            if (item.product_id === productId) {
              totalPurchased += item.quantity || 0
              orderCount++
            }
          }
        } catch (e) {
          console.error('Error parsing order items:', e)
        }
      }
    }
    
    return { totalPurchased, orderCount }
  } catch (error) {
    console.error('Error getting purchase history:', error)
    return { totalPurchased: 0, orderCount: 0 }
  }
}

