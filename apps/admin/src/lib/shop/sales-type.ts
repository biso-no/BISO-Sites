import type { createSessionClient } from "@repo/api/server";
import type { SalesTypes } from "@repo/api/types/appwrite";

/**
 * `createAdminClient().db` and `createSessionClient().db` are both a plain
 * `TablesDB` proxy, so either client type fits. Derived from
 * `createSessionClient` (rather than importing `node-appwrite` directly,
 * which app code must not do) purely to name the type. Callers pass the
 * admin client: `sales_types` is readable only by the operations unit, so a
 * session read would be refused for campus admins.
 */
type ShopDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

export interface ProductBooking {
  departmentId: string | null;
  salesTypeId: string | null;
}

/**
 * Whether an Appwrite failure means "this row does not exist", as opposed to
 * a permission problem or the service being down — only the first may be
 * reported as a missing sales type.
 */
export function isRowNotFound(error: unknown): boolean {
  const code = (error as { code?: number } | null)?.code;
  const type = (error as { type?: string } | null)?.type;
  return (
    code === 404 || type === "row_not_found" || type === "document_not_found"
  );
}

async function readSalesType(
  db: ShopDb,
  salesTypeId: string
): Promise<SalesTypes | null> {
  try {
    return await db.getRow<SalesTypes>("app", "sales_types", salesTypeId);
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * The product schema already requires a sales type and a department before a
 * product can go live; this is the server-side gate neither the product
 * editor nor the approval-publish flow can bypass. Ledger posting books
 * revenue to the sales type's account on the product's department, so a live
 * product missing either would never be booked. It also refuses a sales type
 * that has since been deactivated or deleted.
 *
 * Lives outside the `"use server"` action modules (`shop.ts`, `approvals.ts`)
 * because those may only export async functions and this needs to be shared
 * between them.
 */
export async function assertProductBookable(
  db: ShopDb,
  status: string,
  { departmentId, salesTypeId }: ProductBooking
): Promise<void> {
  if (!(status === "published" || status === "pending_approval")) {
    return;
  }
  if (!departmentId) {
    throw new Error("Choose a department before publishing");
  }
  const salesType = salesTypeId ? await readSalesType(db, salesTypeId) : null;
  if (!salesType || salesType.active === false) {
    throw new Error("Choose an active sales type before publishing");
  }
}
