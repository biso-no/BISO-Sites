import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import { Permission, Role } from "node-appwrite";

/**
 * The `orders` table's own $permissions grants (packages/api/appwrite.config.json)
 * expose every row only to this team, never to `any`.
 */
const ORDERS_STAFF_TEAM = "sg-app-dept-operationsunit";

/**
 * Visibility half of the row ACLs, mirroring buildJobRowPermissions() in
 * apps/admin/src/lib/recruitment.ts and buildContentTranslationPermissions()
 * in apps/admin/src/lib/utils.ts. The staff half is imported from
 * @repo/shared/recruitment rather than copied, so it cannot drift.
 *
 * Imported content is only visible on the public site when these strings are
 * right, so permissions.test.ts pins the behaviour.
 */
export function buildPublicContentPermissions(status: string): string[] {
  return status === "published" ? [Permission.read(Role.any())] : [];
}

export function buildJobPermissions(status: string): string[] {
  const visibility =
    status === "published" ? [Permission.read(Role.any())] : [];
  return [
    ...new Set([...visibility, ...buildRecruitmentStaffRowPermissions()]),
  ];
}

/**
 * Per-row grant for an imported order, mirroring buildOrderPermissions() in
 * packages/shared/utils/vipps-order-ops.ts: the `orders` table has
 * `rowSecurity: true` and its table-level grants only cover
 * `sg-app-dept-operationsunit`, so without a document-level read grant the
 * matched buyer's own session client gets a 404 on their own order.
 *
 * Unlike the live-checkout version, an unmatched buyer (no Appwrite account
 * found for the WooCommerce billing email) does NOT fall back to
 * `read("any")` — granting public read to a stranger's order (name, email,
 * phone, items) is not an acceptable default for a bulk import, so an
 * unmatched order stays staff-only.
 */
export function buildOrderPermissions(userId: string | null): string[] {
  const staffGrants = [
    Permission.read(Role.team(ORDERS_STAFF_TEAM)),
    Permission.update(Role.team(ORDERS_STAFF_TEAM)),
    Permission.delete(Role.team(ORDERS_STAFF_TEAM)),
  ];
  if (!userId) {
    return staffGrants;
  }
  return [Permission.read(Role.user(userId)), ...staffGrants];
}
