import { Permission, Query, Role } from "node-appwrite";

/**
 * Stamp row permissions on governing documents written before rows carried
 * any: published documents (and their version history) get public read,
 * drafts get none. Required before the content-permission cutover removes
 * the table-level grant, or every older published document disappears from
 * the public site.
 */

const DATABASE_ID = "app";
const PAGE = 100;
const PUBLIC_READ = Permission.read(Role.any());

export interface BackfillDb {
  listRows(params: {
    databaseId: string;
    queries: string[];
    tableId: string;
  }): Promise<{ rows: Record<string, unknown>[]; total: number }>;
  updateRow(params: {
    data: Record<string, unknown>;
    databaseId: string;
    permissions: string[];
    rowId: string;
    tableId: string;
  }): Promise<unknown>;
}

export interface BackfillReport {
  changed: { permissions: string[]; rowId: string; tableId: string }[];
  errors: { message: string; rowId: string; tableId: string }[];
  unchanged: string[];
}

export function documentPermissions(status: unknown): string[] {
  return status === "published" ? [PUBLIC_READ] : [];
}

function samePermissions(current: unknown, wanted: string[]): boolean {
  const have = Array.isArray(current)
    ? current.filter((p) => String(p).startsWith("read("))
    : [];
  return have.length === wanted.length && wanted.every((p) => have.includes(p));
}

async function allRows(
  db: BackfillDb,
  tableId: string
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (;;) {
    const queries = [Query.limit(PAGE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await db.listRows({
      databaseId: DATABASE_ID,
      queries,
      tableId,
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE) {
      return rows;
    }
    cursor = String(page.rows.at(-1)?.$id);
  }
}

export async function backfillDocumentPermissions(
  db: BackfillDb,
  options: { apply: boolean }
): Promise<BackfillReport> {
  const report: BackfillReport = { changed: [], errors: [], unchanged: [] };
  const documents = await allRows(db, "documents");
  const wantedByDocument = new Map(
    documents.map((row) => [String(row.$id), documentPermissions(row.status)])
  );
  const versions = await allRows(db, "document_versions");

  const plan: {
    permissions: string[];
    row: Record<string, unknown>;
    tableId: string;
  }[] = [
    ...documents.map((row) => ({
      permissions: wantedByDocument.get(String(row.$id)) ?? [],
      row,
      tableId: "documents",
    })),
    ...versions.map((row) => ({
      // A version row follows its document; an orphan stays private.
      permissions: wantedByDocument.get(String(row.document_id)) ?? [],
      row,
      tableId: "document_versions",
    })),
  ];

  for (const { permissions, row, tableId } of plan) {
    const rowId = String(row.$id);
    if (samePermissions(row.$permissions, permissions)) {
      report.unchanged.push(rowId);
      continue;
    }
    try {
      if (options.apply) {
        await db.updateRow({
          data: {},
          databaseId: DATABASE_ID,
          permissions,
          rowId,
          tableId,
        });
      }
      report.changed.push({ permissions, rowId, tableId });
    } catch (error) {
      report.errors.push({
        message: error instanceof Error ? error.message : String(error),
        rowId,
        tableId,
      });
    }
  }
  return report;
}
