import { Query } from "@repo/api";
import type { UserAuthContext } from "./authorization";
import {
  type DepartmentScopeReader,
  relationId,
} from "./content-authorization";

interface DepartmentCampusRow {
  campus?: string | { $id: string } | null;
  campus_id?: string | null;
  Name?: string | null;
}

/** The admin TablesDB, or a test double: the department reads only. */
export interface PageAccessReader extends DepartmentScopeReader {
  listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: T[] }>;
}

/**
 * Whether `departmentId` is the only department called `name`. Membership is
 * a team name matched to `departments.Name` (`resolveDepartmentIds`): exactly,
 * or by name key when only one department has that key. Name is not unique: a
 * member of a team whose name two departments share resolves to both, so
 * neither one's campus can be said to be theirs. Fails closed.
 */
async function isOnlyDepartmentNamed(
  db: PageAccessReader,
  name: string,
  departmentId: string
): Promise<boolean> {
  try {
    const { rows } = await db.listRows<{ $id: string }>("app", "departments", [
      Query.equal("Name", name),
      Query.select(["$id"]),
      Query.limit(2),
    ]);
    return rows.length === 1 && rows[0]?.$id === departmentId;
  } catch {
    return false;
  }
}

/**
 * The context for one access check on a page: opening it in the editor,
 * saving, publishing, unpublishing or archiving it, at `campusId` and bound to
 * `departmentId`.
 *
 * M365 syncs a member's department team and campus team independently, and
 * `hasRowAccess`/`assertWriteAccess` want both: the page's campus among the
 * member's campus teams, and its department among their departments. A
 * national unit's board fails the first. The Winter Games board is in
 * SG-App-Dept-Wintergames, but each member's campus team is their city, so
 * `projects/winter-games` (campus "5") could be created from the unit card and
 * then not opened, saved or published by the board it was made for.
 *
 * So, for a plain department member of `departmentId` (not a global admin,
 * and not a campus admin, whose managed campuses stay their whole reach, as in
 * `hasRowAccess`), `campusId` joins `resolvedCampusIds` when it is that
 * department's own campus. The campus is checked against the department row,
 * never taken on the page's or the request's word, and only a department
 * whose Name no other department shares qualifies (see
 * `isOnlyDepartmentNamed`). In every other case `ctx` comes back unchanged,
 * and nothing is read when `campusId` is already the member's or the
 * department is not theirs.
 *
 * Page actions only. List scoping, other content types and campus selection
 * keep the caller's own context.
 */
export async function pageAccessContext(
  db: PageAccessReader,
  ctx: UserAuthContext,
  campusId: string | null | undefined,
  departmentId: string | null | undefined
): Promise<UserAuthContext> {
  const departmentMember =
    !ctx.roles.includes("globaladmin") &&
    ctx.managedCampusIds.length === 0 &&
    Boolean(departmentId && ctx.resolvedDepartmentIds.includes(departmentId));
  if (
    !(departmentMember && departmentId && campusId) ||
    ctx.resolvedCampusIds.includes(campusId)
  ) {
    return ctx;
  }
  let department: DepartmentCampusRow;
  try {
    department = await db.getRow<DepartmentCampusRow>(
      "app",
      "departments",
      departmentId,
      [Query.select(["$id", "Name", "campus.$id", "campus_id"])]
    );
  } catch {
    return ctx;
  }
  const departmentCampusId =
    relationId(department.campus) ?? department.campus_id;
  if (
    departmentCampusId !== campusId ||
    !department.Name ||
    !(await isOnlyDepartmentNamed(db, department.Name, departmentId))
  ) {
    return ctx;
  }
  return { ...ctx, resolvedCampusIds: [...ctx.resolvedCampusIds, campusId] };
}
