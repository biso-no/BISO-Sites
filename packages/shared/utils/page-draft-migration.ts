import { Query } from "@repo/api";
import {
  jsonToPageDoc,
  PAGE_DRAFTS_TABLE_ID,
  pageDocToJson,
} from "@repo/api/page-builder";

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

export interface TitleAndDescription {
  description: string | null;
  title: string | null;
}

export interface RestoredTitle {
  after: TitleAndDescription;
  before: TitleAndDescription;
  locale: string;
  rowId: string;
}

export interface PageDraftMigrationReport {
  /**
   * Translation rows whose legacy draft columns are (or would be) cleared. In
   * apply mode, lists, `created`, `cleared` and `restoredTitles` hold only what
   * was actually written.
   */
  cleared: string[];
  /** Draft rows (by id) that are (or would be) created. */
  created: string[];
  /**
   * Published rows that are (or would be) planned for migration, whose
   * published document has no description but whose row has one. The row's
   * description stays as it is.
   */
  descriptionKept: { description: string; locale: string; rowId: string }[];
  errors: { message: string; rowId?: string; tableId: string }[];
  /** Published rows whose title/description are (or would be) restored. */
  restoredTitles: RestoredTitle[];
  /** A read failed, so apply wrote nothing. */
  scanFailed: boolean;
  scanned: number;
  /** Rows with something to migrate that cannot get a draft row. */
  skipped: { reason: string; rowId: string }[];
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
  clearsLegacy: boolean;
  createData: Record<string, unknown> | null;
  descriptionKept: string | null;
  locale: string;
  restoredTitle: RestoredTitle | null;
  restores: boolean;
  rowId: string;
  update: Record<string, unknown>;
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

/**
 * The document for a draft row created without one: the published document
 * with the row's current title/description, so the draft is never empty.
 */
function seededDraftDoc(row: MigrationRow): string | null {
  const published =
    typeof row.published_doc === "string" ? row.published_doc : null;
  const doc = jsonToPageDoc(published);
  if (!doc) {
    return published;
  }
  const meta = { ...doc.meta };
  if (typeof row.title === "string" && row.title) {
    meta.title = row.title;
  }
  if (typeof row.description === "string" && row.description) {
    meta.description = row.description;
  } else {
    meta.description = undefined;
  }
  return pageDocToJson({ ...doc, meta });
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function describeRestore(
  row: MigrationRow,
  restored: Record<string, string>
): RestoredTitle | null {
  if (Object.keys(restored).length === 0) {
    return null;
  }
  const before = {
    title: textOrNull(row.title),
    description: textOrNull(row.description),
  };
  return {
    rowId: row.$id,
    locale: textOrNull(row.locale) ?? "",
    before,
    after: {
      title: restored.title ?? before.title,
      description: restored.description ?? before.description,
    },
  };
}

/** The row's description when a published row has one the document lacks. */
function keptDescription(row: MigrationRow): string | null {
  if (row.is_published !== true) {
    return null;
  }
  const meta = jsonToPageDoc(
    typeof row.published_doc === "string" ? row.published_doc : null
  )?.meta;
  const description = textOrNull(row.description);
  return !nonEmpty(meta?.description, DESCRIPTION_MAX) && description?.trim()
    ? description
    : null;
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
    restoredTitle: describeRestore(row, restored),
    descriptionKept: keptDescription(row),
    locale: textOrNull(row.locale) ?? "",
    restores: isRestored,
    clearsLegacy: holdsDraft,
    createData: needsDraftRow
      ? {
          page_id: row.page_id,
          locale: row.locale,
          draft_doc: row.draft_doc ?? seededDraftDoc(row),
          title: row.title ?? null,
          description: row.description ?? null,
        }
      : null,
    update: {
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
      if (!(row.locale && row.page_id)) {
        report.skipped.push({
          rowId: row.$id,
          reason: "missing locale or page_id, so no draft row can be created",
        });
        continue;
      }
      plan.push(planned);
    }
  } catch (error) {
    report.errors.push({
      tableId: TRANSLATIONS_TABLE_ID,
      message: errorMessage(error),
    });
  }
  return plan;
}

function keptEntry(planned: PlannedRow) {
  return {
    rowId: planned.rowId,
    locale: planned.locale,
    description: planned.descriptionKept ?? "",
  };
}

/** Dry run: report what the plan would do. */
function reportPlan(plan: PlannedRow[], report: PageDraftMigrationReport) {
  for (const planned of plan) {
    const { rowId, createData, clearsLegacy, restoredTitle } = planned;
    if (planned.descriptionKept !== null) {
      report.descriptionKept.push(keptEntry(planned));
    }
    if (createData) {
      report.created.push(rowId);
    }
    if (clearsLegacy) {
      report.cleared.push(rowId);
    }
    if (restoredTitle) {
      report.restoredTitles.push(restoredTitle);
    }
  }
}

/** Phase 2: per row, create the draft first, then update the translation. */
async function applyPlan(
  db: PageDraftMigrationDb,
  plan: PlannedRow[],
  report: PageDraftMigrationReport
) {
  for (const row of plan) {
    let tableId = PAGE_DRAFTS_TABLE_ID;
    try {
      if (row.createData) {
        await db.createRow({
          databaseId: DATABASE_ID,
          tableId,
          rowId: row.rowId,
          data: row.createData,
          permissions: [],
        });
        report.created.push(row.rowId);
      }
      tableId = TRANSLATIONS_TABLE_ID;
      await db.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: row.rowId,
        data: row.update,
      });
      if (row.clearsLegacy) {
        report.cleared.push(row.rowId);
      }
      if (row.restoredTitle) {
        report.restoredTitles.push(row.restoredTitle);
      }
      if (row.descriptionKept !== null) {
        report.descriptionKept.push(keptEntry(row));
      }
    } catch (error) {
      report.errors.push({
        tableId,
        rowId: row.rowId,
        message: errorMessage(error),
      });
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
    descriptionKept: [],
    errors: [],
    restoredTitles: [],
    scanFailed: false,
    scanned: 0,
    skipped: [],
  };
  const plan = await scanAll(db, report);
  report.scanFailed = report.errors.length > 0;
  if (!options.apply) {
    reportPlan(plan, report);
  } else if (!report.scanFailed) {
    await applyPlan(db, plan, report);
  }
  return report;
}

const DESCRIPTION_PREVIEW_MAX = 120;

function preview(value: string | null): string {
  if (value === null) {
    return "(none)";
  }
  return value.length > DESCRIPTION_PREVIEW_MAX
    ? `${value.slice(0, DESCRIPTION_PREVIEW_MAX)}…`
    : value;
}

/** Report lines for one restore: row id, locale, and the before → after text. */
export function formatRestoredTitle(entry: RestoredTitle): string[] {
  return [
    `  restore ${entry.rowId} (${entry.locale})`,
    `    title: ${preview(entry.before.title)} → ${preview(entry.after.title)}`,
    `    description: ${preview(entry.before.description)} → ${preview(entry.after.description)}`,
  ];
}

/** Report line for a row whose description stays (no published description). */
export function formatDescriptionKept(
  entry: PageDraftMigrationReport["descriptionKept"][number]
): string {
  return `  ${entry.rowId} (${entry.locale}): description kept (no published description): ${preview(entry.description)}`;
}
