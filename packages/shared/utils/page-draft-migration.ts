import { Query } from "@repo/api";
import { jsonToPageDoc, PAGE_DRAFTS_TABLE_ID } from "@repo/api/page-builder";

/**
 * Moves page drafts out of `page_translations` into the service-only
 * `page_drafts` table (row `$id` = the translation's `$id`).
 *
 * For each translation row that still holds a draft in `draft_doc`,
 * `puck_document` or `draft_document`: the draft row is created when missing
 * (an existing draft row is never overwritten) and the three columns are then
 * set to null. Older code also wrote the draft's title/description onto
 * published rows; for those, the current title/description become the draft's
 * values and the row's own are restored from `published_doc.meta`.
 *
 * Two phases: everything is scanned read-only first; nothing is written unless
 * `apply` is set and every read succeeded. A failure on one row is recorded and
 * leaves that row's columns untouched; the remaining rows continue.
 */

export interface PageDraftMigrationReport {
  /** Translation rows whose draft columns are (or would be) cleared. */
  cleared: string[];
  /** Draft rows (by id) that are (or would be) created. */
  created: string[];
  errors: { message: string; rowId?: string; tableId: string }[];
  /** Published rows whose title/description are (or would be) restored. */
  restoredTitles: string[];
  scanned: number;
}

interface MigrationRow {
  $id: string;
  [key: string]: unknown;
}

/** Minimal slice of `TablesDB`, structurally satisfied by the real client. */
export interface PageDraftMigrationDb {
  createRow(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data: Record<string, unknown>;
    permissions?: string[];
  }): Promise<unknown>;
  listRows(params: {
    databaseId: string;
    tableId: string;
    queries?: string[];
  }): Promise<{ rows: MigrationRow[] }>;
  updateRow(params: {
    databaseId: string;
    tableId: string;
    rowId: string;
    data?: Record<string, unknown>;
  }): Promise<unknown>;
}

interface PlannedRow {
  clear: Record<string, unknown> | null;
  createData: Record<string, unknown> | null;
  restores: boolean;
  rowId: string;
}

const DATABASE_ID = "app";
const TRANSLATIONS_TABLE_ID = "page_translations";
const PAGE_SIZE = 100;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4000;
const DRAFT_COLUMNS = ["draft_doc", "puck_document", "draft_document"] as const;

async function* scanTable(
  db: PageDraftMigrationDb,
  tableId: string
): AsyncGenerator<MigrationRow> {
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

function nonEmpty(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() !== "" && value.length <= max
    ? value
    : null;
}

/** Title/description from `published_doc.meta` that differ from the row's. */
function restoredText(row: MigrationRow): Record<string, string> {
  if (row.is_published !== true) {
    return {};
  }
  const meta = jsonToPageDoc(
    typeof row.published_doc === "string" ? row.published_doc : null
  )?.meta;
  const restored: Record<string, string> = {};
  const title = nonEmpty(meta?.title, TITLE_MAX);
  if (title && title !== row.title) {
    restored.title = title;
  }
  const description = nonEmpty(meta?.description, DESCRIPTION_MAX);
  if (description && description !== row.description) {
    restored.description = description;
  }
  return restored;
}

function planRow(
  row: MigrationRow,
  existingDrafts: ReadonlySet<string>
): PlannedRow | null {
  const holdsDraft = DRAFT_COLUMNS.some((column) => row[column] != null);
  const restored = restoredText(row);
  const isRestored = Object.keys(restored).length > 0;
  if (!(holdsDraft || isRestored)) {
    return null;
  }
  const needsDraftRow =
    !existingDrafts.has(row.$id) && (row.draft_doc != null || isRestored);
  return {
    rowId: row.$id,
    restores: isRestored,
    createData: needsDraftRow
      ? {
          page_id: row.page_id,
          locale: row.locale,
          draft_doc: row.draft_doc ?? null,
          title: row.title ?? null,
          description: row.description ?? null,
        }
      : null,
    clear: {
      ...(holdsDraft
        ? { draft_doc: null, puck_document: null, draft_document: null }
        : {}),
      ...restored,
    },
  };
}

/** Phase 1: read-only scan; returns the plan, or records the read error. */
async function scanAll(
  db: PageDraftMigrationDb,
  report: PageDraftMigrationReport
): Promise<PlannedRow[]> {
  const plan: PlannedRow[] = [];
  const existingDrafts = new Set<string>();
  try {
    for await (const draft of scanTable(db, PAGE_DRAFTS_TABLE_ID)) {
      existingDrafts.add(draft.$id);
    }
  } catch (error) {
    report.errors.push({
      tableId: PAGE_DRAFTS_TABLE_ID,
      message: errorMessage(error),
    });
    return plan;
  }
  try {
    for await (const row of scanTable(db, TRANSLATIONS_TABLE_ID)) {
      report.scanned += 1;
      const planned = planRow(row, existingDrafts);
      if (!planned) {
        continue;
      }
      plan.push(planned);
      if (planned.createData) {
        report.created.push(row.$id);
      }
      report.cleared.push(row.$id);
      if (planned.restores) {
        report.restoredTitles.push(row.$id);
      }
    }
  } catch (error) {
    report.errors.push({
      tableId: TRANSLATIONS_TABLE_ID,
      message: errorMessage(error),
    });
  }
  return plan;
}

/** Phase 2: per row, create the draft first, then clear the columns. */
async function applyPlan(
  db: PageDraftMigrationDb,
  plan: PlannedRow[],
  report: PageDraftMigrationReport
) {
  for (const { rowId, createData, clear } of plan) {
    const forget = (ids: string[]) => {
      const at = ids.indexOf(rowId);
      if (at !== -1) {
        ids.splice(at, 1);
      }
    };
    let tableId = PAGE_DRAFTS_TABLE_ID;
    try {
      if (createData) {
        await db.createRow({
          databaseId: DATABASE_ID,
          tableId,
          rowId,
          data: createData,
          permissions: [],
        });
      }
      tableId = TRANSLATIONS_TABLE_ID;
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId,
        data: clear ?? {},
      });
    } catch (error) {
      report.errors.push({ tableId, rowId, message: errorMessage(error) });
      forget(report.cleared);
      forget(report.restoredTitles);
      if (tableId === PAGE_DRAFTS_TABLE_ID) {
        forget(report.created);
      }
    }
  }
}

export async function migratePageDrafts(
  db: PageDraftMigrationDb,
  options: { apply: boolean }
): Promise<PageDraftMigrationReport> {
  const report: PageDraftMigrationReport = {
    cleared: [],
    created: [],
    errors: [],
    restoredTitles: [],
    scanned: 0,
  };
  const plan = await scanAll(db, report);
  if (options.apply && report.errors.length === 0) {
    await applyPlan(db, plan, report);
  }
  return report;
}
