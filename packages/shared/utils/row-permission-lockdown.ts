import { Query } from "@repo/api";
import { identityBacksStudentId, type LinkedIdentityLike } from "./bi-student";

/**
 * One-off maintenance for the lockdown of expense and profile rows.
 *
 * New rows are created read-only to their owner (`buildExpenseRowPermissions`,
 * `buildProfileRowPermissions`), but rows written earlier still carry per-user
 * write grants, and profile rows written earlier may carry `student_id` values
 * nothing verifies. The CLIs in `packages/shared/scripts` run these, dry-run by
 * default. They must only run after the apps/api and apps/web builds that
 * write these rows through the admin client are live.
 */

const DATABASE_ID = "app";
const PAGE_SIZE = 100;
const OWNER_WRITE_GRANT_RE = /^(update|delete|write)\("user:[^"]+"\)$/;

export interface LockdownRow {
  $id: string;
  $permissions: string[];
  [column: string]: unknown;
}

export interface LockdownDb {
  listRows(params: {
    databaseId: string;
    queries?: string[];
    tableId: string;
  }): Promise<{ rows: LockdownRow[]; total: number }>;
  updateRow(params: {
    data?: Record<string, unknown>;
    databaseId: string;
    permissions?: string[];
    rowId: string;
    tableId: string;
  }): Promise<unknown>;
}

export interface IdentityLister {
  listIdentities(params: {
    queries?: string[];
  }): Promise<{ identities: LinkedIdentityLike[] }>;
}

export interface OwnerWriteRevocationReport {
  changed: Array<{ removed: string[]; rowId: string }>;
  errors: Array<{ message: string; rowId: string }>;
  scanned: number;
}

export interface StudentLinkReport {
  cleared: string[];
  duplicates: Array<{ rowIds: string[]; studentId: string }>;
  errors: Array<{ message: string; rowId: string }>;
  unverified: Array<{ rowId: string; studentId: string }>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Every row of a table, read fully before anything is written. */
async function readAllRows(
  db: LockdownDb,
  tableId: string,
  filters: string[] = []
): Promise<LockdownRow[]> {
  const rows: LockdownRow[] = [];
  let cursor: string | null = null;
  for (;;) {
    const queries = [
      ...filters,
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const page = await db.listRows({
      databaseId: DATABASE_ID,
      queries,
      tableId,
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE_SIZE) {
      return rows;
    }
    cursor = page.rows.at(-1)?.$id ?? null;
  }
}

/** A row's permissions without any per-user write grant. */
export function withoutOwnerWriteGrants(
  permissions: readonly string[]
): string[] {
  return permissions.filter(
    (permission) => !OWNER_WRITE_GRANT_RE.test(permission)
  );
}

export async function revokeOwnerWriteGrants(
  db: LockdownDb,
  tableId: "expense" | "user",
  options: { apply: boolean }
): Promise<OwnerWriteRevocationReport> {
  const report: OwnerWriteRevocationReport = {
    changed: [],
    errors: [],
    scanned: 0,
  };

  for (const row of await readAllRows(db, tableId)) {
    report.scanned += 1;
    const kept = withoutOwnerWriteGrants(row.$permissions);
    if (kept.length === row.$permissions.length) {
      continue;
    }
    report.changed.push({
      removed: row.$permissions.filter(
        (permission) => !kept.includes(permission)
      ),
      rowId: row.$id,
    });
    if (!options.apply) {
      continue;
    }
    try {
      await db.updateRow({
        databaseId: DATABASE_ID,
        permissions: kept,
        rowId: row.$id,
        tableId,
      });
    } catch (error) {
      report.errors.push({ message: messageOf(error), rowId: row.$id });
    }
  }

  return report;
}

export async function auditStudentLinks(
  db: LockdownDb,
  users: IdentityLister,
  options: { clearUnverified: boolean }
): Promise<StudentLinkReport> {
  const report: StudentLinkReport = {
    cleared: [],
    duplicates: [],
    errors: [],
    unverified: [],
  };
  const verifiedHolders = new Map<string, string[]>();

  for (const row of await readAllRows(db, "user", [
    Query.isNotNull("student_id"),
  ])) {
    const studentId =
      typeof row.student_id === "string"
        ? row.student_id.trim().toLowerCase()
        : "";
    if (!studentId) {
      continue;
    }

    let verified: boolean;
    try {
      const { identities } = await users.listIdentities({
        queries: [Query.equal("userId", row.$id), Query.limit(25)],
      });
      verified = identityBacksStudentId(identities, studentId);
    } catch (error) {
      report.errors.push({ message: messageOf(error), rowId: row.$id });
      continue;
    }

    if (verified) {
      verifiedHolders.set(studentId, [
        ...(verifiedHolders.get(studentId) ?? []),
        row.$id,
      ]);
      continue;
    }

    report.unverified.push({ rowId: row.$id, studentId });
    if (!options.clearUnverified) {
      continue;
    }
    try {
      await db.updateRow({
        data: {
          bi_campus_id: null,
          bi_employee_id: null,
          bi_linked_at: null,
          student_id: null,
        },
        databaseId: DATABASE_ID,
        rowId: row.$id,
        tableId: "user",
      });
      report.cleared.push(row.$id);
    } catch (error) {
      report.errors.push({ message: messageOf(error), rowId: row.$id });
    }
  }

  for (const [studentId, rowIds] of verifiedHolders) {
    if (rowIds.length > 1) {
      report.duplicates.push({ rowIds, studentId });
    }
  }

  return report;
}
