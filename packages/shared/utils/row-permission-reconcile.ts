import { Query } from "@repo/api";
import { buildPageRowPermissions, pageAudience } from "@repo/api/page-builder";
import type { PagesVisibility } from "@repo/api/types/appwrite";
import {
  benefitReadPermissions,
  eventReadPermissions,
} from "./content-read-permissions";

/**
 * Brings the read permissions on existing content rows in line with what the
 * current code writes. Rows written by older code can carry the wrong reads;
 * once table-level read access is removed, each row's own permissions decide
 * who can see it. Only `read(...)` entries are replaced; other permissions on
 * a row are kept.
 */

export type ReconcileTableId =
  | "campus_benefits"
  | "pages"
  | "page_translations"
  | "events";

export interface PageParent {
  status: string;
  visibility: string;
}

export interface ReconcileChange {
  after: string[];
  before: string[];
  rowId: string;
  tableId: ReconcileTableId;
}

export interface ReconcileReport {
  changes: ReconcileChange[];
  errors: { message: string; rowId?: string; tableId: ReconcileTableId }[];
  scanned: Record<ReconcileTableId, number>;
}

interface ReconcileRow {
  $id: string;
  $permissions: string[];
  [key: string]: unknown;
}

/** Minimal slice of `TablesDB`, structurally satisfied by the real client. */
export interface ReconcileDb {
  listRows(params: {
    databaseId: string;
    tableId: string;
    queries?: string[];
  }): Promise<{ rows: ReconcileRow[] }>;
  updateRow(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data?: Record<string, unknown>;
    permissions?: string[];
  }): Promise<unknown>;
}

const DATABASE_ID = "app";
const PAGE_SIZE = 100;
const READ_PREFIX = "read(";

const TABLE_ORDER: ReconcileTableId[] = [
  "pages",
  "campus_benefits",
  "page_translations",
  "events",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function desiredReadPermissions(
  tableId: ReconcileTableId,
  row: Record<string, unknown>,
  pages: ReadonlyMap<string, PageParent>
): string[] {
  switch (tableId) {
    case "events":
      return eventReadPermissions(asString(row.status));
    case "campus_benefits":
      return benefitReadPermissions(asString(row.status));
    case "pages":
      return buildPageRowPermissions({
        isPublished: row.status === "published",
        audience: pageAudience(asString(row.visibility) as PagesVisibility),
      });
    case "page_translations": {
      const parent = pages.get(asString(row.page_id));
      if (!parent) {
        return [];
      }
      return buildPageRowPermissions({
        isPublished: row.is_published === true && parent.status === "published",
        audience: pageAudience(parent.visibility as PagesVisibility),
      });
    }
    default:
      return [];
  }
}

export function mergeReadPermissions(
  existing: readonly string[],
  reads: readonly string[]
): string[] {
  const others = existing.filter((p) => !p.startsWith(READ_PREFIX));
  return [...new Set([...reads, ...others])];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

async function* scanTable(
  db: ReconcileDb,
  tableId: ReconcileTableId
): AsyncGenerator<ReconcileRow> {
  let cursor: string | undefined;
  while (true) {
    const queries = [Query.limit(PAGE_SIZE)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });
    for (const row of rows) {
      yield row;
    }
    if (rows.length < PAGE_SIZE) {
      return;
    }
    cursor = rows.at(-1)?.$id;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function reconcileRow(
  db: ReconcileDb,
  tableId: ReconcileTableId,
  row: ReconcileRow,
  pages: ReadonlyMap<string, PageParent>,
  report: ReconcileReport,
  apply: boolean
): Promise<void> {
  const before = row.$permissions ?? [];
  const after = mergeReadPermissions(
    before,
    desiredReadPermissions(tableId, row, pages)
  );
  if (sameSet(before, after)) {
    return;
  }
  report.changes.push({ tableId, rowId: row.$id, before, after });
  if (!apply) {
    return;
  }
  try {
    await db.updateRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId: row.$id,
      data: {},
      permissions: after,
    });
  } catch (error) {
    report.errors.push({
      tableId,
      rowId: row.$id,
      message: errorMessage(error),
    });
  }
}

export async function reconcileRowPermissions(
  db: ReconcileDb,
  options: { apply: boolean }
): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    changes: [],
    errors: [],
    scanned: {
      campus_benefits: 0,
      events: 0,
      page_translations: 0,
      pages: 0,
    },
  };
  const pages = new Map<string, PageParent>();

  for (const tableId of TABLE_ORDER) {
    try {
      for await (const row of scanTable(db, tableId)) {
        report.scanned[tableId] += 1;
        if (tableId === "pages") {
          pages.set(row.$id, {
            status: asString(row.status),
            visibility: asString(row.visibility),
          });
        }
        await reconcileRow(db, tableId, row, pages, report, options.apply);
      }
    } catch (error) {
      report.errors.push({ tableId, message: errorMessage(error) });
    }
  }

  return report;
}
