"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import {
  getUserAuthContext,
  isController,
  isGlobalAdmin,
} from "@/lib/authorization";

// Product status constants
const STATUS_PENDING = "pending_approval";
const STATUS_PUBLISHED = "published";
const STATUS_DRAFT = "draft";

export type PendingProduct = WebshopProducts & {
  translations: ContentTranslations[];
  departmentName?: string;
};

/**
 * List products pending approval for the current user's campuses.
 * - Global admins see all pending products
 * - Campus controllers see pending products from their campuses
 */
export async function listPendingProducts(): Promise<PendingProduct[]> {
  const { db } = await createSessionClient();
  const ctx = await getUserAuthContext();

  if (!ctx) {
    throw new Error("Unauthorized");
  }

  // Check if user has approval permissions
  const isAdmin = await isGlobalAdmin();
  const hasControllerRole = await isController();

  if (!(isAdmin || hasControllerRole)) {
    return []; // Only controllers and admins can see pending products
  }

  const queries = [
    Query.equal("status", STATUS_PENDING),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ];

  const response = await db.listRows<WebshopProducts>({
    databaseId: "app",
    tableId: "webshop_products",
    queries,
  });

  // If not global admin, filter by user's campus teams
  let products = response.rows;
  if (!isAdmin) {
    // Filter products by user's campus names
    // campusNames are derived from SG-App-Campus-* groups (e.g., ["Oslo", "Bergen"])
    products = products.filter((product) => {
      // If product has no campus_id, it's visible to all controllers
      if (!product.campus_id) {
        return true;
      }
      // Check if user belongs to the product's campus
      return ctx.campusNames.includes(product.campus_id);
    });
  }

  // Enrich with translations
  const enrichedProducts = await Promise.all(
    products.map(async (product) => {
      try {
        const translationsResponse = await db.listRows<ContentTranslations>({
          databaseId: "app",
          tableId: "content_translations",
          queries: [
            Query.equal("content_id", product.$id),
            Query.equal("content_type", "product"),
          ],
        });
        return {
          ...product,
          translations: translationsResponse.rows,
        };
      } catch {
        return {
          ...product,
          translations: [],
        };
      }
    })
  );

  return enrichedProducts;
}

/**
 * Approve a product - changes status from pending_approval to published.
 */
export async function approveProduct(productId: string): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const isAdmin = await isGlobalAdmin();
  const hasControllerRole = await isController();

  if (!(isAdmin || hasControllerRole)) {
    throw new Error("You do not have permission to approve products");
  }

  const { db } = await createSessionClient();

  // Update the product status
  await db.updateRow({
    databaseId: "app",
    tableId: "webshop_products",
    rowId: productId,
    data: {
      status: STATUS_PUBLISHED,
    },
  });

  // Log audit event
  try {
    await db.createRow("app", "audit_logs", "unique()", {
      actor_id: ctx.userId,
      action: "product_approved",
      resource_id: productId,
      resource_type: "webshop_products",
      payload: JSON.stringify({ status: STATUS_PUBLISHED }),
    });
  } catch (e) {
    console.error("Failed to create audit log:", e);
  }

  revalidatePath("/shop/approval-queue");
  revalidatePath("/shop/products");
}

/**
 * Reject a product - changes status back to draft with a rejection reason.
 */
export async function rejectProduct(
  productId: string,
  reason: string
): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const isAdmin = await isGlobalAdmin();
  const hasControllerRole = await isController();

  if (!(isAdmin || hasControllerRole)) {
    throw new Error("You do not have permission to reject products");
  }

  const { db } = await createSessionClient();

  // Get current product to update metadata
  const product = await db.getRow<WebshopProducts>({
    databaseId: "app",
    tableId: "webshop_products",
    rowId: productId,
  });

  // Parse existing metadata and add rejection reason
  let metadata: Record<string, unknown> = {};
  if (product.metadata) {
    try {
      metadata = JSON.parse(product.metadata);
    } catch {
      metadata = {};
    }
  }
  metadata.rejection_reason = reason;
  metadata.rejected_at = new Date().toISOString();
  metadata.rejected_by = ctx.userId;

  // Update the product status back to draft
  await db.updateRow({
    databaseId: "app",
    tableId: "webshop_products",
    rowId: productId,
    data: {
      status: STATUS_DRAFT,
      metadata: JSON.stringify(metadata),
    },
  });

  // Log audit event
  try {
    await db.createRow("app", "audit_logs", "unique()", {
      actor_id: ctx.userId,
      action: "product_rejected",
      resource_id: productId,
      resource_type: "webshop_products",
      payload: JSON.stringify({ reason, previousStatus: STATUS_PENDING }),
    });
  } catch (e) {
    console.error("Failed to create audit log:", e);
  }

  revalidatePath("/shop/approval-queue");
  revalidatePath("/shop/products");
}
