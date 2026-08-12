import { Query } from "@repo/api";
import type { UserAuthContext } from "./authorization";
import { applyScopeQueries, assertWriteAccess } from "./utils/authorization";

/**
 * Relationship-first content authorization.
 *
 * Appwrite relationship columns (`campus`, `department`) are the canonical
 * ownership source for general content. Legacy scalar columns (`campus_id`,
 * `department_id`, `departmentId`) remain only as migration-era compatibility
 * metadata and are never used for authorization decisions unless a caller
 * explicitly opts into the repair-window fallback.
 */

export interface ContentOwnership {
  campus: string | null;
  department: string | null;
}

export interface ContentOwnershipInput {
  /** Whether this feature type supports global/national rows (null campus). */
  allowGlobalCampus: boolean;
  campusId: string | null;
  departmentId: string | null;
}

type RelationValue = string | { $id: string } | null | undefined;

/**
 * Appwrite returns relationship columns as either the related row object or
 * its ID string depending on selection depth. Normalize both to the row ID.
 */
export const relationId = (value: RelationValue): string | null =>
  typeof value === "string" ? value : (value?.$id ?? null);

interface OwnershipRowLike {
  campus?: RelationValue;
  campus_id?: string | null;
  department?: RelationValue;
  department_id?: string | null;
  departmentId?: string | null;
}

/**
 * Extract the ownership tuple from a content row. Relationship values win;
 * `legacyFallback` exposes the scalar columns only for rows that predate the
 * relationship backfill (repair rollout window).
 */
export function getContentOwnership(
  row: OwnershipRowLike,
  options: { legacyFallback?: boolean } = {}
): ContentOwnership {
  const campus = relationId(row.campus);
  const department = relationId(row.department);

  if (!options.legacyFallback) {
    return { campus, department };
  }

  return {
    campus: campus ?? row.campus_id ?? null,
    department: department ?? row.department_id ?? row.departmentId ?? null,
  };
}

/**
 * Scope list queries by the canonical relationship paths instead of legacy
 * scalar columns. Same fail-closed semantics as {@link applyScopeQueries}.
 */
export function applyContentRelationshipScopeQueries(
  ctx: UserAuthContext
): string[] {
  return applyScopeQueries(ctx, {
    campusField: "campus.$id",
    departmentField: "department.$id",
  });
}

/**
 * Minimal reader so server actions can pass the admin TablesDB while tests
 * inject a mock. Only the department lookup is needed here.
 */
export interface DepartmentScopeReader {
  getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ): Promise<T>;
}

interface DepartmentScopeRow {
  $id: string;
  campus?: RelationValue;
}

/**
 * Authorize a requested ownership tuple before any content mutation.
 *
 * Server Actions are public endpoints, so the submitted campus/department IDs
 * are untrusted: the department is re-read through the (admin) reader and must
 * belong to the selected campus, a null campus is reserved for global admins
 * on feature types that support national scope, and the caller's own scope is
 * enforced last via {@link assertWriteAccess}. Every unresolved state throws.
 */
export async function assertContentOwnership(
  db: DepartmentScopeReader,
  ctx: UserAuthContext,
  input: ContentOwnershipInput
): Promise<void> {
  const { allowGlobalCampus, campusId, departmentId } = input;

  if (!campusId) {
    if (departmentId) {
      throw new Error("Unauthorized: department content requires a campus");
    }
    const isGlobal = ctx.roles.includes("globaladmin");
    if (!(isGlobal && allowGlobalCampus)) {
      throw new Error("Unauthorized: campus is required for this content");
    }
    return;
  }

  // Cheap caller-scope check first so out-of-scope requests never trigger a
  // database read. Global admins pass; campus admins need the campus managed;
  // department users need both campus and department membership.
  assertWriteAccess(ctx, campusId, departmentId);

  if (!departmentId) {
    return;
  }

  let department: DepartmentScopeRow | null;
  try {
    department = await db.getRow<DepartmentScopeRow>(
      "app",
      "departments",
      departmentId,
      [Query.select(["$id", "campus.$id"])]
    );
  } catch {
    department = null;
  }
  if (!department) {
    throw new Error("Unauthorized: department could not be verified");
  }
  if (relationId(department.campus) !== campusId) {
    throw new Error("Department does not belong to the selected campus");
  }
}
