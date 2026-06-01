// ============================================================================
// Query Scoping Utilities
// ============================================================================

import { Query } from "@repo/api";
import type { UserAuthContext } from "../authorization";

/**
 * Sentinel filter used when a non-admin user's scope cannot be determined.
 * Matches no rows, so callers fail closed (empty list) instead of returning
 * everything when the scope lookup is partial.
 */
const NO_MATCH_FILTER = Query.equal("$id", "__no_scope_resolved__");

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
 * Fails closed: if a non-admin user has team-derived department membership
 * but no resolved Appwrite department IDs (lookup failure, renamed/missing
 * department, name mismatch), returns a sentinel filter that matches no rows
 * instead of an empty filter array. An empty array would be spread into the
 * query and produce an unscoped list of every row across every campus.
 *
 * Note: campus_id on content documents stores numeric IDs ("1"=Oslo, etc.),
 * not campus names. managedCampusIds and resolvedCampusIds are already resolved.
 */
export function applyScopeQueries(ctx: UserAuthContext): string[] {
  if (isGlobalAdminContext(ctx)) {
    if (ctx.activeCampusId) {
      return [Query.equal("campus_id", [ctx.activeCampusId])];
    }
    return [];
  }

  if (ctx.managedCampusIds.length > 0) {
    return [Query.equal("campus_id", ctx.managedCampusIds)];
  }

  // Regular department user: scope to their own department(s).
  // department_id on content rows stores the Appwrite Departments $id,
  // not the team-derived department name — use the resolved IDs.
  if (ctx.resolvedDepartmentIds.length > 0) {
    return [Query.equal("department_id", ctx.resolvedDepartmentIds)];
  }

  // Department membership exists at the team level but didn't resolve to
  // any Appwrite Departments rows. Fail closed: return no rows rather than
  // an unscoped list.
  if (ctx.departmentTeamIds.length > 0) {
    return [NO_MATCH_FILTER];
  }

  // No team-derived scope at all (e.g. a brand-new account with no group
  // assignments). Same fail-closed behavior.
  return [NO_MATCH_FILTER];
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
  if (departmentId && ctx.resolvedDepartmentIds.includes(departmentId)) {
    return;
  }
  throw new Error("Unauthorized: no write access to this department");
}

/**
 * Publishing is stricter than drafting/updating. Department members can manage
 * drafts in their scope, but live publication requires a campus admin for the
 * target campus or a global admin.
 */
export function assertPublishAccess(
  ctx: UserAuthContext,
  campusId?: string | null
): void {
  if (isGlobalAdminContext(ctx)) {
    return;
  }

  if (campusId && ctx.managedCampusIds.includes(campusId)) {
    return;
  }

  throw new Error("Forbidden: publish requires campus or global admin access");
}
