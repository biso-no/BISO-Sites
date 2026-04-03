"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { getUserAuthContext, isGlobalAdmin } from "@/lib/authorization";

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

  // Only global admins and campus admins can approve products
  const isAdmin = await isGlobalAdmin();
  const isCampusAdmin = ctx.managedCampuses.length > 0;

  if (!(isAdmin || isCampusAdmin)) {
    return [];
  }

  const queries: string[] = [
    Query.equal("status", STATUS_PENDING),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ];

  // Scope campus admins to their own campuses at query level
  if (!isAdmin && ctx.campusNames.length > 0) {
    queries.push(Query.equal("campus_id", ctx.campusNames));
  }

  const response = await db.listRows<WebshopProducts>({
    databaseId: "app",
    tableId: "webshop_products",
    queries,
  });

  const products = response.rows;

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
  const isCampusAdmin = ctx.managedCampuses.length > 0;

  if (!(isAdmin || isCampusAdmin)) {
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
  const isCampusAdmin = ctx.managedCampuses.length > 0;

  if (!(isAdmin || isCampusAdmin)) {
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
