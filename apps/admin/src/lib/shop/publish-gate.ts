import type { Models } from "@repo/api";
import type { createSessionClient } from "@repo/api/server";
import { assertProductBookable } from "./sales-type";

/**
 * `createAdminClient().db` and `createSessionClient().db` share the same
 * shape; see `sales-type.ts` for why the type is named off the session
 * client. Callers of this helper MUST pass the admin client: `webshop_products`
 * has `rowSecurity: false` and grants only `create` permissions (no
 * `update`), so a session-client write is refused for every caller
 * regardless of role, and `assertProductBookable` itself needs the admin
 * client to read `sales_types`.
 */
type ShopDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

type ProductRow = Models.Row & Record<string, unknown>;

function getStringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Publishes a webshop product, refusing when it lacks a department or an
 * active sales type — the same gate the product editor and the approval
 * flow enforce (`assertProductBookable`) — so the AI assistant can never
 * publish a product whose orders could never be posted to Finago.
 *
 * On refusal this throws before touching the row, so the product stays in
 * its current status. Callers (the assistant route's `createContent` and
 * `publishContent` tool executors) already run inside a try/catch that turns
 * a thrown error into a `{ success: false, error }` tool result, which is
 * how the assistant surfaces the refusal reason to the user.
 */
export async function publishBookableProduct(
  db: ShopDb,
  productId: string
): Promise<void> {
  const row = await db.getRow<ProductRow>("app", "webshop_products", productId);
  await assertProductBookable(db, "published", {
    departmentId: getStringValue(row.departmentId),
    salesTypeId: getStringValue(row.sales_type),
  });
  await db.updateRow("app", "webshop_products", productId, {
    status: "published",
  });
}
