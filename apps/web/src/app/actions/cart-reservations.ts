"use server"

import { createSessionClient } from "@repo/api/server"
import { Query } from "@repo/api"

/**
 * Get available stock for a product, accounting for active reservations
 * Returns: available stock = product.stock - SUM(active_reservations.quantity)
 */
export async function getAvailableStock(productId: string): Promise<number> {
  try {
    const { db } = await createSessionClient()
    
    // Get product stock
    const product = await db.getRow('app', 'webshop_products', productId)
    
    // If stock is not tracked (null), return Infinity
    if (product.stock === null || product.stock === undefined) {
      return Infinity
    }
    
    const totalStock = product.stock as number
    
    // Get active reservations (not expired)
    const now = new Date().toISOString()
    const reservations = await db.listRows(
      'app',
      'cart_reservations',
      [
        Query.equal('product_id', productId),
        Query.greaterThan('expires_at', now),
      ]
    )
    
    // Sum reserved quantities
    const reservedQuantity = reservations.rows.reduce((sum, reservation) => {
      return sum + (reservation.quantity as number)
    }, 0)
    
    return Math.max(0, totalStock - reservedQuantity)
  } catch (error) {
    console.error('Error getting available stock:', error)
    // Return 0 on error to be safe
    return 0
  }
}

/**
 * Create or update a cart reservation for a product
 * Reserves stock for 10 minutes
 * Uses session client - user_id from session, RLS handles filtering
 */
export async function createOrUpdateReservation(
  productId: string,
  quantity: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const { db, account } = await createSessionClient()
    
    // Get session user ID (works for both authenticated and anonymous sessions)
    const session = await account.get()
    const userId = session.$id
    
    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    
    // Check if user already has a reservation for this product (RLS filters by user automatically)
    const existingReservations = await db.listRows(
      'app',
      'cart_reservations',
      [Query.equal('product_id', productId)]
    )
    
    if (existingReservations.rows.length > 0) {
      // Update existing reservation
      const reservation = existingReservations.rows[0]
      if (reservation) {
        await db.updateRow('app', 'cart_reservations', reservation.$id, {
          quantity,
          expires_at: expiresAt,
        })
      }
    } else {
      // Create new reservation (user_id from session)
      await db.createRow('app', 'cart_reservations', 'unique()', {
        product_id: productId,
        user_id: userId,
        quantity,
        expires_at: expiresAt,
      })
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error creating/updating reservation:', error)
    return { 
      success: false, 
      message: 'Failed to reserve stock' 
    }
  }
}

/**
 * Delete a reservation for a specific product
 * RLS ensures user can only delete their own reservations
 */
export async function deleteReservation(
  productId: string
): Promise<{ success: boolean }> {
  try {
    const { db } = await createSessionClient()
    
    // RLS automatically filters to current user's reservations
    const reservations = await db.listRows(
      'app',
      'cart_reservations',
      [Query.equal('product_id', productId)]
    )
    
    for (const reservation of reservations.rows) {
      await db.deleteRow('app', 'cart_reservations', reservation.$id)
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting reservation:', error)
    return { success: false }
  }
}

/**
 * Delete all reservations for current session user
 * RLS automatically filters to current user
 */
export async function deleteUserReservations(): Promise<void> {
  try {
    const { db } = await createSessionClient()
    
    // RLS ensures we only see/delete current user's reservations
    const reservations = await db.listRows(
      'app',
      'cart_reservations',
      []
    )
    
    for (const reservation of reservations.rows) {
      await db.deleteRow('app', 'cart_reservations', reservation.$id)
    }
  } catch (error) {
    console.error('Error deleting user reservations:', error)
  }
}

/**
 * Clean up expired reservations for current session user
 * RLS automatically filters to current user
 */
export async function cleanupExpiredReservations(): Promise<number> {
  try {
    const { db } = await createSessionClient()
    
    const now = new Date().toISOString()
    // RLS ensures we only see current user's expired reservations
    const expiredReservations = await db.listRows(
      'app',
      'cart_reservations',
      [Query.lessThan('expires_at', now)]
    )
    
    let deletedCount = 0
    for (const reservation of expiredReservations.rows) {
      await db.deleteRow('app', 'cart_reservations', reservation.$id)
      deletedCount++
    }
    
    return deletedCount
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error)
    return 0
  }
}

/**
 * Get current session user's reservation for a product
 * RLS automatically filters to current user
 */
export async function getUserReservation(
  productId: string
): Promise<{ quantity: number; expiresAt: string } | null> {
  try {
    const { db } = await createSessionClient()
    
    const now = new Date().toISOString()
    // RLS filters to current user automatically
    const reservations = await db.listRows(
      'app',
      'cart_reservations',
      [
        Query.equal('product_id', productId),
        Query.greaterThan('expires_at', now),
      ]
    )
    
    if (reservations.rows.length === 0) {
      return null
    }
    
    const reservation = reservations.rows[0]
    if (!reservation) {
      return null
    }
    
    return {
      quantity: reservation.quantity as number,
      expiresAt: reservation.expires_at as string,
    }
  } catch (error) {
    console.error('Error getting user reservation:', error)
    return null
  }
}

/**
 * Get all cart reservations for the current session user
 * Returns active (non-expired) reservations only
 * RLS automatically filters to current user
 */
export async function getUserCartReservations(): Promise<any[]> {
  try {
    const { db } = await createSessionClient()
    
    const now = new Date().toISOString()
    // RLS filters to current user's reservations automatically
    const reservations = await db.listRows(
      'app',
      'cart_reservations',
      [Query.greaterThan('expires_at', now)]
    )
    
    return reservations.rows
  } catch (error) {
    console.error('Error getting user cart reservations:', error)
    return []
  }
}

/**
 * Get cart items with full product details
 * Returns enriched cart data ready for display
 */
export async function getCartItemsWithDetails(): Promise<any[]> {
  try {
    const reservations = await getUserCartReservations()
    const { db } = await createSessionClient()
    
    const cartItems = []
    
    for (const reservation of reservations) {
      try {
        // Fetch product details
        const product = await db.getRow('app', 'webshop_products', reservation.product_id)
        
        // Get translation (assume first one for now, or fetch based on locale)
        const translations = await db.listRows(
          'app',
          'content_translations',
          [
            Query.equal('content_id', product.$id),
            Query.equal('locale', 'en'), // TODO: Use actual locale
          ]
        )
        
        const translation = translations.rows[0]
        
        cartItems.push({
          reservationId: reservation.$id,
          productId: product.$id,
          slug: product.slug,
          name: translation?.title || product.slug,
          image: product.image,
          category: product.category,
          regularPrice: product.regular_price,
          memberPrice: product.member_price,
          memberOnly: product.member_only,
          quantity: reservation.quantity,
          stock: product.stock,
          expiresAt: reservation.expires_at,
          metadata: product.metadata ? JSON.parse(product.metadata) : null,
        })
      } catch (error) {
        console.error(`Error fetching product ${reservation.product_id}:`, error)
        // Skip products that can't be loaded
      }
    }
    
    return cartItems
  } catch (error) {
    console.error('Error getting cart items with details:', error)
    return []
  }
}

