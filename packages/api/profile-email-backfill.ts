import { Query } from "node-appwrite";

/**
 * Stamp the account's sign-in email on `user` profile rows that have none.
 * Rows created by the BI student sync, and every row the web's profile
 * action wrote, were saved without it, so the app's profile screen showed an
 * empty email. Profile writes now stamp it themselves; this fills in the rows
 * written before that. Rows that already have an email are never touched.
 */

const DATABASE_ID = "app";
const TABLE_ID = "user";
const PAGE = 100;
/**
 * Size of the `user.email` column. Mirrors `PROFILE_EMAIL_MAX_LENGTH` in
 * `@repo/shared/utils/profile-fields`, which this package cannot import.
 */
const EMAIL_MAX_LENGTH = 100;

export interface ProfileEmailBackfillDb {
  listRows(params: {
    databaseId: string;
    queries: string[];
    tableId: string;
  }): Promise<{ rows: Record<string, unknown>[]; total: number }>;
  updateRow(params: {
    data: Record<string, unknown>;
    databaseId: string;
    rowId: string;
    tableId: string;
  }): Promise<unknown>;
}

export interface ProfileEmailBackfillUsers {
  get(params: { userId: string }): Promise<{ email: string }>;
}

export type ProfileEmailSkipReason =
  | "no_account"
  | "no_account_email"
  | "too_long";

export interface ProfileEmailBackfillReport {
  alreadySet: number;
  checked: number;
  errors: { message: string; rowId: string }[];
  skipped: { reason: ProfileEmailSkipReason; rowId: string }[];
  /** Row ids stamped (or, in a dry run, that would be). */
  stamped: string[];
}

function hasEmail(row: Record<string, unknown>): boolean {
  return typeof row.email === "string" && row.email.trim().length > 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function allRows(
  db: ProfileEmailBackfillDb
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (;;) {
    const queries = [Query.select(["$id", "email"]), Query.limit(PAGE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await db.listRows({
      databaseId: DATABASE_ID,
      queries,
      tableId: TABLE_ID,
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE) {
      return rows;
    }
    cursor = String(page.rows.at(-1)?.$id);
  }
}

/**
 * The account's email for a profile row, or why there is none to write. A row
 * with no account is one an admin created from Microsoft 365 for someone who
 * has not signed in yet; it is keyed by their Graph id and already carries
 * their UPN, so it rarely reaches here.
 */
async function accountEmail(
  users: ProfileEmailBackfillUsers,
  rowId: string
): Promise<{ email: string } | { reason: ProfileEmailSkipReason }> {
  let email: string;
  try {
    ({ email } = await users.get({ userId: rowId }));
  } catch (error) {
    if ((error as { code?: unknown }).code === 404) {
      return { reason: "no_account" };
    }
    throw error;
  }
  const trimmed = email?.trim();
  if (!trimmed) {
    return { reason: "no_account_email" };
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return { reason: "too_long" };
  }
  return { email: trimmed };
}

export async function backfillProfileEmails(
  db: ProfileEmailBackfillDb,
  users: ProfileEmailBackfillUsers,
  options: { apply: boolean }
): Promise<ProfileEmailBackfillReport> {
  const report: ProfileEmailBackfillReport = {
    alreadySet: 0,
    checked: 0,
    errors: [],
    skipped: [],
    stamped: [],
  };

  for (const row of await allRows(db)) {
    report.checked++;
    if (hasEmail(row)) {
      report.alreadySet++;
      continue;
    }
    const rowId = String(row.$id);
    try {
      const found = await accountEmail(users, rowId);
      if ("reason" in found) {
        report.skipped.push({ reason: found.reason, rowId });
        continue;
      }
      if (options.apply) {
        await db.updateRow({
          data: { email: found.email },
          databaseId: DATABASE_ID,
          rowId,
          tableId: TABLE_ID,
        });
      }
      report.stamped.push(rowId);
    } catch (error) {
      report.errors.push({ message: errorMessage(error), rowId });
    }
  }

  return report;
}
