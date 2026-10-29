import { Query } from "@repo/api";
import { buildPageRowPermissions, pageAudience } from "@repo/api/page-builder";
import type { PagesVisibility } from "@repo/api/types/appwrite";
import {
  benefitReadPermissions,
  eventReadPermissions,
  type TranslationContentType,
  translationReadPermissions,
} from "./content-read-permissions";

/**
 * Brings the read permissions on existing content rows in line with what the
 * current code writes. Rows written by older code can carry the wrong reads;
 * once table-level read access is removed, each row's own permissions decide
 * who can see it. Covers pages, page translations, campus benefits, events and
 * content translations (events, member benefits, news, products, jobs and
 * departments). Only `read(...)` entries are replaced; other permissions on a
 * row are kept.
 *
 * Two phases: every table is scanned read-only first (news, products, jobs and
 * departments are read only for their ids and statuses); nothing is written if
 * any scan failed. Rows whose parent is not found, and translations of type
 * `page` or an unknown type, are reported as skipped and never changed.
 *
 * Automated writers keep running while this does, so the apply phase does not
 * trust the scan: right before each write it re-reads the row and its parent,
 * recomputes the desired permissions and writes only if they still differ.
 * A fresh result that differs from the planned one is written as the fresh
 * value and listed under `revised`; a row that is already correct, or that has
 * been deleted (or lost its parent) since the scan, is skipped and reported.
 * Run it while nobody is editing content, then dry-run again: it should
 * report 0 changes.
 */

export type ReconcileTableId =
  | "campus_benefits"
  | "pages"
  | "page_translations"
  | "events"
  | "content_translations"
  | "news"
  | "webshop_products"
  | "jobs"
  | "departments";

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
  /** Changes whose fresh desired value differed from the planned one. */
  revised: (ReconcileChange & { planned: string[] })[];
  /** True when a scan failed; nothing is written in that case. */
  scanFailed: boolean;
  scanned: Record<ReconcileTableId, number>;
  skipped: { reason: string; rowId: string; tableId: ReconcileTableId }[];
}

interface ReconcileRow {
  $id: string;
  $permissions: string[];
  [key: string]: unknown;
}

/** Minimal slice of `TablesDB`, structurally satisfied by the real client. */
export interface ReconcileDb {
  getRow(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
  }): Promise<ReconcileRow>;
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
  "page_translations",
  "campus_benefits",
  "events",
  "content_translations",
];

/** Parent tables whose statuses are loaded for translations but not reconciled. */
const STATUS_ONLY_TABLES: ReconcileTableId[] = [
  "news",
  "webshop_products",
  "jobs",
  "departments",
];

/** Parent table per translation `content_type`. */
const TRANSLATION_PARENT: Record<string, ReconcileTableId | undefined> = {
  event: "events",
  memberBenefit: "campus_benefits",
  news: "news",
  product: "webshop_products",
  job: "jobs",
  department: "departments",
};

type ParentStatuses = Map<ReconcileTableId, Map<string, string>>;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function desiredReadPermissions(
  tableId: ReconcileTableId,
  row: Record<string, unknown>,
  pages: ReadonlyMap<string, PageParent>,
  statuses: ReadonlyMap<
    ReconcileTableId,
    ReadonlyMap<string, string>
  > = new Map()
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
    case "content_translations": {
      const contentType = asString(row.content_type);
      const table = TRANSLATION_PARENT[contentType];
      if (table === undefined) {
        return [];
      }
      const status = statuses.get(table)?.get(asString(row.content_id)) ?? null;
      return translationReadPermissions(
        contentType as TranslationContentType,
        status
      );
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

function translationSkipReason(
  row: ReconcileRow,
  statuses: ParentStatuses
): string | null {
  const contentType = asString(row.content_type);
  const table = TRANSLATION_PARENT[contentType];
  if (table === undefined) {
    return `content type not reconciled: ${contentType || "(none)"}`;
  }
  if (!statuses.get(table)?.has(asString(row.content_id))) {
    return `parent ${contentType} not found`;
  }
  return null;
}

function planRow(
  tableId: ReconcileTableId,
  row: ReconcileRow,
  pages: ReadonlyMap<string, PageParent>,
  statuses: ParentStatuses,
  report: ReconcileReport
): void {
  if (tableId === "page_translations" && !pages.has(asString(row.page_id))) {
    report.skipped.push({
      tableId,
      rowId: row.$id,
      reason: "parent page not found",
    });
    return;
  }
  if (tableId === "content_translations") {
    const reason = translationSkipReason(row, statuses);
    if (reason) {
      report.skipped.push({ tableId, rowId: row.$id, reason });
      return;
    }
  }
  const before = row.$permissions ?? [];
  const after = mergeReadPermissions(
    before,
    desiredReadPermissions(tableId, row, pages, statuses)
  );
  if (!sameSet(before, after)) {
    report.changes.push({ tableId, rowId: row.$id, before, after });
  }
}

/** Phase 1: read-only scan of every table; computes all changes. */
async function scanAll(db: ReconcileDb, report: ReconcileReport) {
  const pages = new Map<string, PageParent>();
  const statuses: ParentStatuses = new Map();
  for (const tableId of STATUS_ONLY_TABLES) {
    const ids = new Map<string, string>();
    statuses.set(tableId, ids);
    try {
      for await (const row of scanTable(db, tableId)) {
        report.scanned[tableId] += 1;
        ids.set(row.$id, asString(row.status));
      }
    } catch (error) {
      report.errors.push({ tableId, message: errorMessage(error) });
    }
  }
  for (const tableId of TABLE_ORDER) {
    const ids = new Map<string, string>();
    statuses.set(tableId, ids);
    try {
      for await (const row of scanTable(db, tableId)) {
        report.scanned[tableId] += 1;
        if (tableId === "pages") {
          pages.set(row.$id, {
            status: asString(row.status),
            visibility: asString(row.visibility),
          });
        }
        ids.set(row.$id, asString(row.status));
        planRow(tableId, row, pages, statuses, report);
      }
    } catch (error) {
      report.errors.push({ tableId, message: errorMessage(error) });
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 404;
}

async function getRowOrNull(
  db: ReconcileDb,
  tableId: ReconcileTableId,
  rowId: string
): Promise<ReconcileRow | null> {
  try {
    return await db.getRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Re-reads the parent of a page or content translation and returns the single
 * -entry lookups `desiredReadPermissions` needs, or the reason to skip.
 */
async function loadFreshParent(
  db: ReconcileDb,
  tableId: ReconcileTableId,
  row: ReconcileRow
): Promise<
  | {
      pages: Map<string, PageParent>;
      skip?: undefined;
      statuses: ParentStatuses;
    }
  | { skip: string }
> {
  const pages = new Map<string, PageParent>();
  const statuses: ParentStatuses = new Map();
  if (tableId === "page_translations") {
    const pageId = asString(row.page_id);
    const page = await getRowOrNull(db, "pages", pageId);
    if (!page) {
      return { skip: "parent page not found when applying" };
    }
    pages.set(pageId, {
      status: asString(page.status),
      visibility: asString(page.visibility),
    });
  }
  if (tableId === "content_translations") {
    const contentType = asString(row.content_type);
    const parentTable = TRANSLATION_PARENT[contentType];
    if (!parentTable) {
      return {
        skip: `content type not reconciled: ${contentType || "(none)"}`,
      };
    }
    const contentId = asString(row.content_id);
    const parent = contentId
      ? await getRowOrNull(db, parentTable, contentId)
      : null;
    if (!parent) {
      return { skip: `parent ${contentType} not found when applying` };
    }
    statuses.set(parentTable, new Map([[contentId, asString(parent.status)]]));
  }
  return { pages, statuses };
}

/** Phase 2: write the planned changes; a failed update does not stop the rest. */
async function applyChanges(db: ReconcileDb, report: ReconcileReport) {
  for (const change of report.changes) {
    const { tableId, rowId } = change;
    try {
      const fresh = await getRowOrNull(db, tableId, rowId);
      if (!fresh) {
        report.skipped.push({
          tableId,
          rowId,
          reason: "row deleted since the scan",
        });
        continue;
      }
      const parent = await loadFreshParent(db, tableId, fresh);
      if (parent.skip !== undefined) {
        report.skipped.push({ tableId, rowId, reason: parent.skip });
        continue;
      }
      const current = fresh.$permissions ?? [];
      const after = mergeReadPermissions(
        current,
        desiredReadPermissions(tableId, fresh, parent.pages, parent.statuses)
      );
      if (sameSet(current, after)) {
        report.skipped.push({
          tableId,
          rowId,
          reason: "already correct when applying",
        });
        continue;
      }
      if (!sameSet(after, change.after)) {
        report.revised.push({
          tableId,
          rowId,
          before: current,
          after,
          planned: change.after,
        });
      }
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data: {},
        permissions: after,
      });
    } catch (error) {
      report.errors.push({ tableId, rowId, message: errorMessage(error) });
    }
  }
}

export async function reconcileRowPermissions(
  db: ReconcileDb,
  options: { apply: boolean }
): Promise<ReconcileReport> {
  const report: ReconcileReport = {
    changes: [],
    errors: [],
    revised: [],
    scanFailed: false,
    skipped: [],
    scanned: {
      campus_benefits: 0,
      content_translations: 0,
      departments: 0,
      events: 0,
      jobs: 0,
      news: 0,
      page_translations: 0,
      pages: 0,
      webshop_products: 0,
    },
  };

  await scanAll(db, report);
  report.scanFailed = report.errors.length > 0;
  // Nothing is written unless every scan succeeded: a partial page list would
  // make translations look orphaned.
  if (options.apply && !report.scanFailed) {
    await applyChanges(db, report);
  }
  return report;
}
