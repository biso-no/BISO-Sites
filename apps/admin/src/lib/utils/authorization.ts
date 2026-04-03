// ============================================================================
// Query Scoping Utilities
// ============================================================================

import { Query } from "@repo/api";
import { UserAuthContext } from "../authorization";

/**
 * Check if user is a global admin based on context (team membership only)
 */
function isGlobalAdminContext(ctx: UserAuthContext): boolean {
  return ctx.roles.includes("globaladmin");
}

/**
 * Returns Appwrite Query filters that restrict list results to what the user
 * is allowed to see in the admin UI.
 *
 * - Global admins: no filter (see everything)
 * - Campus admins: filter to their managed campuses by numeric campus_id
 * - Department users: filter to their department(s)
 *
 * Note: campus_id on content documents stores numeric IDs ("1"=Oslo, etc.),
 * not campus names. managedCampusIds and resolvedCampusIds are already resolved.
 */
export function applyScopeQueries(ctx: UserAuthContext): string[] {
  if (isGlobalAdminContext(ctx)) {
    return [];
  }

  if (ctx.managedCampusIds.length > 0) {
    return [Query.equal("campus_id", ctx.managedCampusIds)];
  }

  // Regular department user: scope to their own department(s)
  if (ctx.departmentNames.length > 0) {
    return [Query.equal("department_id", ctx.departmentNames)];
  }

  return [];
}

/**
 * Asserts that the current user has write access to a document identified by
 * its campusId and/or departmentId. Throws if access is denied.
 *
 * campusId here is the numeric campus document ID ("1", "2", etc.) as stored
 * on content rows, not the campus name.
 *
 * Used in create/update/delete server actions before calling Appwrite.
 * Appwrite RLS provides a second enforcement layer for updates/deletes.
 */
export function assertWriteAccess(
  ctx: UserAuthContext,
  campusId?: string | null,
  departmentId?: string | null
): void {
  if (isGlobalAdminContext(ctx)) {
    return;
  }

  if (ctx.managedCampusIds.length > 0) {
    if (campusId && ctx.managedCampusIds.includes(campusId)) {
      return;
    }
    throw new Error("Unauthorized: no write access to this campus");
  }

  // Department-level user: campus must match their resolved campus IDs
  if (campusId && !ctx.resolvedCampusIds.includes(campusId)) {
    throw new Error("Unauthorized: no access to this campus");
  }
  if (departmentId && ctx.departmentNames.includes(departmentId)) {
    return;
  }
  throw new Error("Unauthorized: no write access to this department");
}
