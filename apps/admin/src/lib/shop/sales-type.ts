import type { createSessionClient } from "@repo/api/server";
import type { SalesTypes } from "@repo/api/types/appwrite";

/**
 * `createAdminClient().db` and `createSessionClient().db` are both a plain
 * `TablesDB` proxy, so either client can call this. Derived from
 * `createSessionClient` (rather than importing `node-appwrite` directly,
 * which app code must not do) purely to name the type.
 */
type ShopDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

/**
 * The product schema already requires a sales type before a product can go
 * live; this is the server-side gate neither the product editor nor the
 * approval-publish flow can bypass. It also refuses a sales type that has
 * since been deactivated or deleted, so a live product always books to a
 * sales type finance still stands behind.
 *
 * Lives outside the `"use server"` action modules (`shop.ts`, `approvals.ts`)
 * because those may only export async functions and this needs to be shared
 * between them.
 */
export async function assertSalesTypeUsable(
  db: ShopDb,
  status: string,
  salesTypeId: string | null
): Promise<void> {
  if (!(status === "published" || status === "pending_approval")) {
    return;
  }
  const salesType = salesTypeId
    ? await db
        .getRow<SalesTypes>("app", "sales_types", salesTypeId)
        .catch(() => null)
    : null;
  if (!salesType || salesType.active === false) {
    throw new Error("Choose an active sales type before publishing");
  }
}
