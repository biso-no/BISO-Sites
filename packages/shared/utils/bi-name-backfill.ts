import { Query } from "@repo/api";
import { normalizeBiDisplayName } from "./person-name";
import { PROFILE_NAME_MAX_LENGTH } from "./profile-fields";

/**
 * Rename everyone Appwrite named from BI's directory ("(Student) Heien,
 * Markus") to "Markus Heien": the account itself, its `user` profile row and
 * its `public_profiles` row. The BI userinfo endpoint now gives Appwrite the
 * normalized name, so this fixes the accounts created before that. Names not
 * in BI's format are never touched, so it is safe to re-run.
 */

const DATABASE_ID = "app";
const PAGE = 100;

export interface NameBackfillUsers {
  list(params: {
    queries: string[];
  }): Promise<{ total: number; users: { $id: string; name: string }[] }>;
  updateName(params: { name: string; userId: string }): Promise<unknown>;
}

export interface NameBackfillDb {
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

export interface NameChange {
  from: string;
  id: string;
  to: string;
}

export interface NameBackfillReport {
  accounts: { checked: number; renamed: NameChange[] };
  errors: {
    id: string;
    message: string;
    scope: "account" | "profile" | "public_profile";
  }[];
  profiles: {
    checked: number;
    renamed: NameChange[];
    skipped: { id: string; reason: "too_long" }[];
  };
  publicProfiles: { checked: number; renamed: NameChange[] };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function pageThrough<T extends { $id: string }>(
  fetchPage: (queries: string[]) => Promise<T[]>
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const queries = [Query.limit(PAGE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const batch = await fetchPage(queries);
    items.push(...batch);
    if (batch.length < PAGE) {
      return items;
    }
    cursor = String(batch.at(-1)?.$id);
  }
}

/** The new name, or null when this name is not in BI's format. */
function renamed(name: unknown): string | null {
  if (typeof name !== "string") {
    return null;
  }
  const normalized = normalizeBiDisplayName(name);
  return normalized === name ? null : normalized;
}

function rowsOf(db: NameBackfillDb, tableId: string) {
  return pageThrough(async (queries) => {
    const page = await db.listRows({
      databaseId: DATABASE_ID,
      queries: [Query.select(["$id", "name"]), ...queries],
      tableId,
    });
    return page.rows as { $id: string; name?: unknown }[];
  });
}

async function renameAccounts(
  users: NameBackfillUsers,
  report: NameBackfillReport,
  apply: boolean
): Promise<void> {
  const accounts = await pageThrough(
    async (queries) => (await users.list({ queries })).users
  );
  for (const account of accounts) {
    report.accounts.checked++;
    const to = renamed(account.name);
    if (!to) {
      continue;
    }
    try {
      if (apply) {
        await users.updateName({ name: to, userId: account.$id });
      }
      report.accounts.renamed.push({ from: account.name, id: account.$id, to });
    } catch (error) {
      report.errors.push({
        id: account.$id,
        message: errorMessage(error),
        scope: "account",
      });
    }
  }
}

async function renameRows(
  db: NameBackfillDb,
  report: NameBackfillReport,
  apply: boolean,
  scope: "profile" | "public_profile"
): Promise<void> {
  const tableId = scope === "profile" ? "user" : "public_profiles";
  const section = scope === "profile" ? report.profiles : report.publicProfiles;
  for (const row of await rowsOf(db, tableId)) {
    section.checked++;
    const to = renamed(row.name);
    if (!to) {
      continue;
    }
    // Only the profile row's column is this small; public_profiles.name holds
    // 255 characters.
    if (scope === "profile" && to.length > PROFILE_NAME_MAX_LENGTH) {
      report.profiles.skipped.push({ id: row.$id, reason: "too_long" });
      continue;
    }
    try {
      if (apply) {
        await db.updateRow({
          data: { name: to },
          databaseId: DATABASE_ID,
          rowId: row.$id,
          tableId,
        });
      }
      section.renamed.push({ from: String(row.name), id: row.$id, to });
    } catch (error) {
      report.errors.push({ id: row.$id, message: errorMessage(error), scope });
    }
  }
}

export async function backfillBiNames(
  db: NameBackfillDb,
  users: NameBackfillUsers,
  options: { apply: boolean }
): Promise<NameBackfillReport> {
  const report: NameBackfillReport = {
    accounts: { checked: 0, renamed: [] },
    errors: [],
    profiles: { checked: 0, renamed: [], skipped: [] },
    publicProfiles: { checked: 0, renamed: [] },
  };
  await renameAccounts(users, report, options.apply);
  await renameRows(db, report, options.apply, "profile");
  await renameRows(db, report, options.apply, "public_profile");
  return report;
}
