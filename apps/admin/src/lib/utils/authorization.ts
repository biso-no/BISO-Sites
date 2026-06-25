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
 * Describes which scope columns a given collection actually has, so the same
 * helper can be reused across tables with different shapes:
 *
 * - `campusField`: the campus column name (default `"campus_id"`). Pass a
 *   relationship path like `"campus.$id"` for relationship-filtered tables, or
 *   `null` for a collection that has no campus dimension.
 * - `departmentField`: the department column name (default `"department_id"`).
 *   Pass `"departmentId"` (webshop_products) or `null` for collections that
 *   have no department dimension (events, documents, announcements, benefits,
 *   submissions).
 *
 * `undefined` means "use the default"; `null` means "this column does not
 * exist on the collection — do not filter on it."
 */
export interface ScopeFieldConfig {
  campusField?: string | null;
  departmentField?: string | null;
}

const DEFAULT_CAMPUS_FIELD = "campus_id";
const DEFAULT_DEPARTMENT_FIELD = "department_id";

function resolveField(value: string | null | undefined, fallback: string) {
  return value === undefined ? fallback : value;
}

/**
 * Returns Appwrite Query filters that restrict list results to what the user
 * is allowed to see in the admin UI.
 *
 * - Global admins: no filter (or the active campus filter from the switcher)
 * - Campus admins: filter to their managed campuses
 * - Department users: filter to BOTH their campus AND their department(s)
 *
 * Field-aware: collections differ in which scope columns they have, so callers
 * pass a {@link ScopeFieldConfig}. A department user on a collection with no
 * department column (`departmentField: null`) is hidden (fails closed) rather
 * than shown the whole campus — those sections are nav-gated away from pure
 * department users.
 *
 * Fails closed: if a non-admin user has team-derived department membership but
 * no resolved Appwrite department IDs (lookup failure, renamed/missing
 * department, name mismatch), returns a sentinel filter that matches no rows
 * instead of an empty filter array. An empty array would be spread into the
 * query and produce an unscoped list of every row across every campus.
 *
 * Note: campus_id on content documents stores numeric IDs ("1"=Oslo, etc.),
 * not campus names. managedCampusIds and resolvedCampusIds are already resolved.
 */
export function applyScopeQueries(
  ctx: UserAuthContext,
  config: ScopeFieldConfig = {}
): string[] {
  const campusField = resolveField(config.campusField, DEFAULT_CAMPUS_FIELD);
  const departmentField = resolveField(
    config.departmentField,
    DEFAULT_DEPARTMENT_FIELD
  );

  if (isGlobalAdminContext(ctx)) {
    if (ctx.activeCampusId && campusField) {
      return [Query.equal(campusField, [ctx.activeCampusId])];
    }
    return [];
  }

  if (ctx.managedCampusIds.length > 0) {
    if (campusField) {
      return [Query.equal(campusField, ctx.managedCampusIds)];
    }
    // Collection has no campus dimension; a campus admin's reach is not
    // narrowed further. (Rare — most campus-admin surfaces are campus-scoped.)
    return [];
  }

  // Regular department user: scope to BOTH their campus and their department.
  // department_id on content rows stores the Appwrite Departments $id, not the
  // team-derived department name — use the resolved IDs.
  if (ctx.resolvedDepartmentIds.length > 0) {
    // Collections without a department column (events, documents, etc.) are
    // nav-gated away from pure department users. Fail closed if one is reached.
    if (!departmentField) {
      return [NO_MATCH_FILTER];
    }
    const filters: string[] = [];
    if (campusField && ctx.resolvedCampusIds.length > 0) {
      filters.push(Query.equal(campusField, ctx.resolvedCampusIds));
    }
    filters.push(Query.equal(departmentField, ctx.resolvedDepartmentIds));
    return filters;
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
 * Non-throwing counterpart of assertWriteAccess for read paths.
 *
 * Returns true when the current user may access a row identified by its
 * campusId/departmentId. Single-row getters use this to return null (→ the
 * edit page 404s) instead of leaking a row from another campus/department.
 *
 * Mirrors assertWriteAccess: global admins see everything; campus admins are
 * gated by managed campus; department users by campus + resolved department.
 * Campus team membership alone grants nothing.
 */
export function hasRowAccess(
  ctx: UserAuthContext,
  campusId?: string | null,
  departmentId?: string | null
): boolean {
  if (isGlobalAdminContext(ctx)) {
    return true;
  }

  if (ctx.managedCampusIds.length > 0) {
    return Boolean(campusId && ctx.managedCampusIds.includes(campusId));
  }

  if (campusId && !ctx.resolvedCampusIds.includes(campusId)) {
    return false;
  }
  return Boolean(
    departmentId && ctx.resolvedDepartmentIds.includes(departmentId)
  );
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
