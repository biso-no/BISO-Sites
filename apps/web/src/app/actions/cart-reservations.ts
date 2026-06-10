"use server";

import { type Models, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";

type CartReservationRow = Models.Row & {
  expires_at?: string;
  product_id: string;
  quantity: number;
};

/**
 * Get available stock for a product, accounting for active reservations
 * Returns: available stock = product.stock - SUM(active_reservations.quantity)
 */
export async function getAvailableStock(productId: string): Promise<number> {
  try {
    const { db } = await createSessionClient();

    // Get product stock
    const product = await db.getRow("app", "webshop_products", productId);

    // If stock is not tracked (null), return Infinity
    if (product.stock === null || product.stock === undefined) {
      return Number.POSITIVE_INFINITY;
    }

    const totalStock = product.stock as number;

    // Reservation rows are row-secured to their creator, so a session client
    // only sees the current user's rows. The availability sum must cover ALL
    // users' reservations, so this read-only aggregation uses the admin
    // client (no row data leaves the server — only the computed number).
    const now = new Date().toISOString();
    const { db: adminDb } = await createAdminClient();
    const reservations = await adminDb.listRows("app", "cart_reservations", [
      Query.equal("product_id", productId),
      Query.greaterThan("expires_at", now),
      Query.select(["quantity"]),
      Query.limit(1000),
    ]);

    // Sum reserved quantities
    const reservedQuantity = reservations.rows.reduce(
      (sum, reservation) => sum + (reservation.quantity as number),
      0
    );

    return Math.max(0, totalStock - reservedQuantity);
  } catch (error) {
    console.error("Error getting available stock:", error);
    // Return 0 on error to be safe
    return 0;
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
    const { db, account } = await createSessionClient();

    // Get session user ID (works for both authenticated and anonymous sessions)
    const session = await account.get();
    const userId = session.$id;

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Check if user already has a reservation for this product (RLS filters by user automatically)
    const existingReservations = await db.listRows("app", "cart_reservations", [
      Query.equal("product_id", productId),
      Query.limit(1),
    ]);

    if (existingReservations.rows.length > 0) {
      // Update existing reservation
      const reservation = existingReservations.rows[0];
      if (reservation) {
        await db.updateRow("app", "cart_reservations", reservation.$id, {
          quantity,
          expires_at: expiresAt,
        });
      }
    } else {
      // Create new reservation (user_id from session)
      await db.createRow("app", "cart_reservations", "unique()", {
        product_id: productId,
        user_id: userId,
        quantity,
        expires_at: expiresAt,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error creating/updating reservation:", error);
    return {
      success: false,
      message: "Failed to reserve stock",
    };
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
    const { db } = await createSessionClient();

    // RLS automatically filters to current user's reservations
    const reservations = await db.listRows("app", "cart_reservations", [
      Query.equal("product_id", productId),
      Query.limit(100),
    ]);

    for (const reservation of reservations.rows) {
      await db.deleteRow("app", "cart_reservations", reservation.$id);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting reservation:", error);
    return { success: false };
  }
}

/**
 * Delete all reservations for current session user
 * RLS automatically filters to current user
 */
export async function deleteAllReservations(): Promise<void> {
  try {
    const { db } = await createSessionClient();

    // RLS ensures we only see/delete current user's reservations
    const reservations = await db.listRows("app", "cart_reservations", [
      Query.limit(1000),
    ]);

    for (const reservation of reservations.rows) {
      await db.deleteRow("app", "cart_reservations", reservation.$id);
    }
  } catch (error) {
    console.error("Error deleting user reservations:", error);
  }
}

/**
 * Clean up expired reservations for current session user
 * RLS automatically filters to current user
 */
export async function cleanupExpiredReservations(): Promise<number> {
  try {
    const { db } = await createSessionClient();

    const now = new Date().toISOString();
    // RLS ensures we only see current user's expired reservations
    const expiredReservations = await db.listRows("app", "cart_reservations", [
      Query.lessThan("expires_at", now),
      Query.limit(1000),
    ]);

    let deletedCount = 0;
    for (const reservation of expiredReservations.rows) {
      await db.deleteRow("app", "cart_reservations", reservation.$id);
      deletedCount += 1;
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up expired reservations:", error);
    return 0;
  }
}

const CLEANUP_PAGE_SIZE = 500;
const CLEANUP_MAX_PAGES = 20;

/**
 * Clean up expired reservations across ALL users. Reservation rows are
 * row-secured to their creator, so the cron route (which has no user
 * session) must use the admin client — a session client there sees zero
 * rows and the cleanup silently does nothing.
 *
 * Only call this from trusted contexts (the CRON_SECRET-gated route).
 */
export async function cleanupAllExpiredReservations(): Promise<number> {
  try {
    const { db } = await createAdminClient();
    let deletedCount = 0;

    for (let page = 0; page < CLEANUP_MAX_PAGES; page++) {
      const now = new Date().toISOString();
      const expired = await db.listRows("app", "cart_reservations", [
        Query.lessThan("expires_at", now),
        Query.limit(CLEANUP_PAGE_SIZE),
      ]);

      for (const reservation of expired.rows) {
        await db.deleteRow("app", "cart_reservations", reservation.$id);
        deletedCount += 1;
      }

      if (expired.rows.length < CLEANUP_PAGE_SIZE) {
        break;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Error cleaning up all expired reservations:", error);
    return 0;
  }
}

/**
 * Get current session user's reservation for a product
 * RLS automatically filters to current user
 */
async function _getUserReservation(
  productId: string
): Promise<{ quantity: number; expiresAt: string } | null> {
  try {
    const { db } = await createSessionClient();

    const now = new Date().toISOString();
    // RLS filters to current user automatically
    const reservations = await db.listRows("app", "cart_reservations", [
      Query.equal("product_id", productId),
      Query.greaterThan("expires_at", now),
      Query.limit(1),
    ]);

    if (reservations.rows.length === 0) {
      return null;
    }

    const reservation = reservations.rows[0];
    if (!reservation) {
      return null;
    }

    return {
      quantity: reservation.quantity as number,
      expiresAt: reservation.expires_at as string,
    };
  } catch (error) {
    console.error("Error getting user reservation:", error);
    return null;
  }
}

/**
 * Get all cart reservations for the current session user
 * Returns active (non-expired) reservations only
 * RLS automatically filters to current user
 */
async function getUserCartReservations(): Promise<CartReservationRow[]> {
  try {
    const { db } = await createSessionClient();

    const now = new Date().toISOString();
    // RLS filters to current user's reservations automatically
    const reservations = await db.listRows<CartReservationRow>(
      "app",
      "cart_reservations",
      [Query.greaterThan("expires_at", now), Query.limit(1000)]
    );

    return reservations.rows;
  } catch (error) {
    console.error("Error getting user cart reservations:", error);
    return [];
  }
}

/**
 * Get cart items with full product details
 * Returns enriched cart data ready for display
 */
interface CartItem {
  category: string;
  expiresAt?: string;
  image: string | null;
  memberOnly: boolean;
  memberPrice: number | null;
  metadata?: {
    max_per_order?: number;
    max_per_user?: number;
    sku?: string;
  };
  name: string;
  productId: string;
  quantity: number;
  regularPrice: number;
  reservationId: string;
  slug: string;
  stock: number | null;
}

function parseProductMetadata(metadata: string | null) {
  if (!metadata) {
    return undefined;
  }
  return JSON.parse(metadata) as CartItem["metadata"];
}

function getProductTranslation(product: WebshopProducts, locale: "en" | "no") {
  return Array.isArray(product.translation_refs)
    ? product.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && item.locale === locale
      )
    : null;
}

function toCartItem({
  product,
  reservation,
  locale,
}: {
  product: WebshopProducts;
  reservation: CartReservationRow;
  locale: "en" | "no";
}): CartItem {
  const translation = getProductTranslation(product, locale);
  return {
    reservationId: reservation.$id,
    productId: product.$id,
    slug: product.slug,
    name: translation?.title || product.slug,
    image: product.image,
    category: product.category ?? "Merch",
    regularPrice: product.regular_price,
    memberPrice: product.member_price,
    memberOnly: product.member_only,
    quantity: reservation.quantity,
    stock: product.stock,
    expiresAt: reservation.expires_at,
    metadata: parseProductMetadata(product.metadata),
  };
}

async function getCartItemForReservation(
  reservation: CartReservationRow,
  locale: "en" | "no"
): Promise<CartItem | null> {
  try {
    const { db } = await createSessionClient();
    const product = await db.getRow<WebshopProducts>(
      "app",
      "webshop_products",
      reservation.product_id,
      [
        Query.select([
          "$id",
          "slug",
          "category",
          "image",
          "regular_price",
          "member_price",
          "member_only",
          "stock",
          "metadata",
          "translation_refs.locale",
          "translation_refs.title",
        ]),
      ]
    );

    return toCartItem({ product, reservation, locale });
  } catch (error) {
    console.error(`Error fetching product ${reservation.product_id}:`, error);
    return null;
  }
}

export async function getCartItemsWithDetails(
  locale: "en" | "no" = "en"
): Promise<CartItem[]> {
  try {
    const reservations = await getUserCartReservations();
    const cartItems: CartItem[] = [];

    for (const reservation of reservations) {
      const item = await getCartItemForReservation(reservation, locale);
      if (item) {
        cartItems.push(item);
      }
    }

    return cartItems;
  } catch (error) {
    console.error("Error getting cart items with details:", error);
    return [];
  }
}
