/**
 * Scoping and write authorization.
 *
 * A faithful port of `apps/admin/src/lib/utils/authorization.ts`
 * (`applyScopeQueries`, `assertWriteAccess`, `hasRowAccess`,
 * `assertPublishAccess`) onto {@link Principal}. Ported rather than imported
 * because the original lives in an app; `identity/scope.test.ts` re-states the
 * admin module's own cases so a divergence fails a test rather than silently
 * widening what this server can read.
 *
 * The two properties that matter most, both inherited deliberately:
 *
 * - **Fail closed.** A principal whose scope cannot be resolved gets a filter
 *   that matches no rows, never an empty filter list. An empty list would be
 *   spread into the query and return every row in every campus.
 * - **Campus team membership alone grants nothing.** Read access needs a
 *   managed campus (campus admin) or a resolved department (department member).
 */

import { Query } from "@repo/api";
import { DomainError, forbidden } from "../runtime/errors";
import type { AppliedScope } from "../runtime/result";
import { campusLabel } from "./campus";
import { isAnonymous, isGlobalAdmin, type Principal } from "./principal";

/**
 * Matches no rows. Returned instead of `[]` whenever scope is unresolved.
 */
const NO_MATCH_FILTER = Query.equal("$id", "__no_scope_resolved__");

/**
 * Which scope columns a table actually has.
 *
 * `undefined` means "use the default column name"; `null` means "this table has
 * no such dimension — do not filter on it". The distinction matters: a
 * department member on a table with no department column must be hidden, not
 * shown the whole campus.
 */
export interface ScopeFields {
  campusField?: string | null;
  departmentField?: string | null;
}

const DEFAULT_CAMPUS_FIELD = "campus_id";
const DEFAULT_DEPARTMENT_FIELD = "department_id";

/** Relationship-path variant, matching `applyContentRelationshipScopeQueries`. */
export const RELATIONSHIP_SCOPE_FIELDS: ScopeFields = {
  campusField: "campus.$id",
  departmentField: "department.$id",
};

function resolveField(
  value: string | null | undefined,
  fallback: string
): string | null {
  return value === undefined ? fallback : value;
}

/**
 * Appwrite filters restricting a list to what this principal may see.
 *
 * Global admins are unrestricted. Note that, unlike the admin app, there is no
 * active-campus narrowing here — see the `activeCampusId` note on `Principal`.
 */
export function scopeQueries(
  principal: Principal,
  fields: ScopeFields = {}
): string[] {
  const campusField = resolveField(fields.campusField, DEFAULT_CAMPUS_FIELD);
  const departmentField = resolveField(
    fields.departmentField,
    DEFAULT_DEPARTMENT_FIELD
  );

  if (isGlobalAdmin(principal)) {
    return [];
  }

  if (principal.managedCampusIds.length > 0) {
    if (campusField) {
      return [Query.equal(campusField, principal.managedCampusIds)];
    }
    // No campus dimension on this table; a campus admin is not narrowed
    // further. Rare — most campus-admin surfaces are campus-scoped.
    return [];
  }

  if (principal.resolvedDepartmentIds.length > 0) {
    if (!departmentField) {
      return [NO_MATCH_FILTER];
    }
    const filters: string[] = [];
    if (campusField && principal.resolvedCampusIds.length > 0) {
      filters.push(Query.equal(campusField, principal.resolvedCampusIds));
    }
    filters.push(Query.equal(departmentField, principal.resolvedDepartmentIds));
    return filters;
  }

  // Team-level department membership that resolved to no Appwrite rows, or no
  // team-derived scope at all. Both fail closed.
  return [NO_MATCH_FILTER];
}

/** Describe the scope a query ran under, for the result envelope. */
export function describeScope(
  principal: Principal,
  fields: ScopeFields = {}
): AppliedScope {
  if (isAnonymous(principal)) {
    return {
      level: "public",
      campusIds: [],
      departmentIds: [],
      summary: "Published, publicly visible content only",
    };
  }
  if (isGlobalAdmin(principal)) {
    return {
      level: "global",
      campusIds: [],
      departmentIds: [],
      summary: "All campuses (global admin)",
    };
  }
  if (principal.managedCampusIds.length > 0) {
    return {
      level: "campus",
      campusIds: [...principal.managedCampusIds],
      departmentIds: [],
      summary: `Managed campuses: ${principal.managedCampuses.join(", ")}`,
    };
  }
  if (principal.resolvedDepartmentIds.length > 0) {
    const hasDepartmentColumn =
      resolveField(fields.departmentField, DEFAULT_DEPARTMENT_FIELD) !== null;
    if (!hasDepartmentColumn) {
      return {
        level: "department",
        campusIds: [],
        departmentIds: [],
        summary:
          "No rows: this collection has no department dimension and you have department-level access only",
      };
    }
    return {
      level: "department",
      campusIds: [...principal.resolvedCampusIds],
      departmentIds: [...principal.resolvedDepartmentIds],
      summary: `Departments: ${principal.departmentNames.join(", ")} in ${principal.campusNames.join(", ")}`,
    };
  }
  return {
    level: "self",
    campusIds: [],
    departmentIds: [],
    summary: "No campus or department scope resolved — no rows are visible",
  };
}

/**
 * Non-throwing read check for a single row.
 *
 * Single-row getters use this so an out-of-scope row reports `not_found`
 * rather than leaking its existence through a different error.
 */
export function canReadRow(
  principal: Principal,
  campusId?: string | null,
  departmentId?: string | null
): boolean {
  if (isGlobalAdmin(principal)) {
    return true;
  }
  if (principal.managedCampusIds.length > 0) {
    return Boolean(campusId && principal.managedCampusIds.includes(campusId));
  }
  if (campusId && !principal.resolvedCampusIds.includes(campusId)) {
    return false;
  }
  return Boolean(
    departmentId && principal.resolvedDepartmentIds.includes(departmentId)
  );
}

/** Throwing write check. Mirrors `assertWriteAccess`. */
export function assertWriteAccess(
  principal: Principal,
  campusId?: string | null,
  departmentId?: string | null
): void {
  if (isAnonymous(principal)) {
    throw new DomainError(
      "unauthenticated",
      "No verified identity is configured, so no write can be attributed to a user.",
      {
        remedy:
          "Start the server with BISO_MCP_APPWRITE_JWT set to a credential for the acting user.",
      }
    );
  }
  if (isGlobalAdmin(principal)) {
    return;
  }
  if (principal.managedCampusIds.length > 0) {
    if (campusId && principal.managedCampusIds.includes(campusId)) {
      return;
    }
    throw forbidden(
      `You do not manage ${campusLabel(campusId)}.`,
      {
        requestedCampusId: campusId ?? null,
        managedCampusIds: principal.managedCampusIds,
      },
      "Ask a global admin, or a campus admin for that campus, to make this change."
    );
  }
  if (campusId && !principal.resolvedCampusIds.includes(campusId)) {
    throw forbidden(`You have no access to ${campusLabel(campusId)}.`, {
      requestedCampusId: campusId ?? null,
      yourCampusIds: principal.resolvedCampusIds,
    });
  }
  if (departmentId && principal.resolvedDepartmentIds.includes(departmentId)) {
    return;
  }
  throw forbidden(
    "You have no write access to this department.",
    {
      requestedDepartmentId: departmentId ?? null,
      yourDepartmentIds: principal.resolvedDepartmentIds,
    },
    "Content is writable by the department that owns it, that campus's management team, or a global admin."
  );
}

/**
 * Publishing follows the same scope as writing.
 *
 * Callers that omit `departmentId` keep the stricter campus/global-only
 * behaviour, because a department member can never publish campus-wide content.
 */
export function assertPublishAccess(
  principal: Principal,
  campusId?: string | null,
  departmentId?: string | null
): void {
  assertWriteAccess(principal, campusId, departmentId);
}

/** Whether this principal could publish for a campus, without throwing. */
export function canPublishForCampus(
  principal: Principal,
  campusId: string | null
): boolean {
  if (isGlobalAdmin(principal)) {
    return true;
  }
  return Boolean(campusId && principal.managedCampusIds.includes(campusId));
}

/**
 * Normalize an Appwrite relationship value to its row id.
 *
 * Relationship columns come back as the related row or as its id depending on
 * selection depth; authorization must not depend on which.
 */
export function relationId(
  value: string | { $id: string } | null | undefined
): string | null {
  return typeof value === "string" ? value : (value?.$id ?? null);
}

/**
 * Ownership for a content row.
 *
 * Relationship columns are canonical; the scalar `campus_id`/`department_id`
 * columns are migration-era compatibility metadata and are only consulted when
 * `legacyFallback` is set, matching `getContentOwnership` in the admin app.
 */
export function rowOwnership(
  row: {
    campus?: string | { $id: string } | null;
    campus_id?: string | null;
    department?: string | { $id: string } | null;
    department_id?: string | null;
    departmentId?: string | null;
  },
  options: { legacyFallback?: boolean } = {}
): { campusId: string | null; departmentId: string | null } {
  const campus = relationId(row.campus);
  const department = relationId(row.department);
  if (!options.legacyFallback) {
    return { campusId: campus, departmentId: department };
  }
  return {
    campusId: campus ?? row.campus_id ?? null,
    departmentId: department ?? row.department_id ?? row.departmentId ?? null,
  };
}
