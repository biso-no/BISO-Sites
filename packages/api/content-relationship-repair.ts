import { Query } from "./index";

/**
 * Idempotent repair for content ownership and translation relationships.
 *
 * Historical writes created `content_translations` rows with `content_type` +
 * `content_id` metadata but without the actual Appwrite relationship, and set
 * scalar campus/department IDs without the ownership relations. This engine
 * inventories both, links what is unambiguous, and reports everything else —
 * duplicates, orphans, and wrong parents are never modified or deleted.
 */

const DATABASE_ID = "app";
const PAGE_SIZE = 100;

export interface RepairDb {
  getRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    queries?: string[]
  ): Promise<T>;
  listRows<T>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: T[]; total: number }>;
  updateRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ): Promise<T>;
  upsertRow<T>(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Record<string, unknown>
  ): Promise<T>;
}

const TRANSLATION_RULES = {
  department: { backReference: "department_ref", parentTable: "departments" },
  event: { backReference: "event_ref", parentTable: "events" },
  memberBenefit: {
    backReference: "memberBenefit",
    parentTable: "campus_benefits",
  },
  news: { backReference: "news_ref", parentTable: "news" },
  product: { backReference: "product_ref", parentTable: "webshop_products" },
} as const;

type SupportedContentType = keyof typeof TRANSLATION_RULES;

interface OwnershipTableRule {
  departmentField: string | null;
  tableId: string;
}

const OWNERSHIP_TABLES: OwnershipTableRule[] = [
  { departmentField: "department_id", tableId: "news" },
  { departmentField: "department_id", tableId: "events" },
  { departmentField: "departmentId", tableId: "webshop_products" },
  { departmentField: "department_id", tableId: "pages" },
  // Recruitment keeps its own scope model, but the vacancy lists already filter
  // on `campus.$id` / `department.$id`, so legacy jobs need the relations too.
  { departmentField: "department_id", tableId: "jobs" },
  // The last three have no historical department scalar: rows stay
  // campus-wide until an editor assigns a department.
  { departmentField: null, tableId: "campus_benefits" },
  { departmentField: null, tableId: "announcements" },
  { departmentField: null, tableId: "documents" },
];

interface TranslationRow {
  $id: string;
  content_id: string | null;
  content_type: string | null;
  locale: string | null;
  [key: string]: unknown;
}

interface PageTranslationRow {
  $id: string;
  locale: string | null;
  page: unknown;
  page_id: string | null;
}

export interface RepairReport {
  alreadyLinked: number;
  duplicates: Array<{
    contentId: string;
    contentType: string;
    locale: string;
    translationIds: string[];
  }>;
  errors: Array<{ id: string; message: string }>;
  jobRelinked: Array<{ jobId: string; translationIds: string[] }>;
  linked: Array<{ parentId: string; translationId: string }>;
  orphans: Array<{
    contentId: string | null;
    contentType: string;
    translationId: string;
  }>;
  ownershipBackfills: Array<{
    field: "campus" | "department";
    rowId: string;
    tableId: string;
    value: string;
  }>;
  pageLinked: Array<{ pageId: string; translationId: string }>;
  unsupportedTypes: Record<string, number>;
  wrongParents: Array<{
    actualParentId: string;
    contentType: string;
    expectedParentId: string;
    translationId: string;
  }>;
}

export interface RepairOptions {
  apply: boolean;
}

export function hasUnsafeFindings(report: RepairReport): boolean {
  return (
    report.duplicates.length > 0 ||
    report.errors.length > 0 ||
    report.orphans.length > 0 ||
    report.wrongParents.length > 0
  );
}

const relationId = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object" && "$id" in value) {
    return (value as { $id: string }).$id;
  }
  return null;
};

async function listAllRows<T extends { $id: string }>(
  db: RepairDb,
  tableId: string,
  baseQueries: string[] = []
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (;;) {
    const cursorQueries: string[] = cursor ? [Query.cursorAfter(cursor)] : [];
    const queries: string[] = [
      ...baseQueries,
      Query.limit(PAGE_SIZE),
      ...cursorQueries,
    ];
    const page: { rows: T[] } = await db.listRows<T>(
      DATABASE_ID,
      tableId,
      queries
    );
    rows.push(...page.rows);
    const last: T | undefined = page.rows.at(-1);
    if (page.rows.length < PAGE_SIZE || !last) {
      return rows;
    }
    cursor = last.$id;
  }
}

interface DepartmentCampusLookup {
  campus: string | null;
  exists: boolean;
}

interface DepartmentCampusRow {
  $id: string;
  campus?: unknown;
  campus_id?: string | null;
}

/**
 * Memoized department → owning campus lookup. `departments.campus` may itself
 * still be un-backfilled, so the legacy scalar is an accepted fallback for the
 * comparison.
 */
function createDepartmentCampusProbe(db: RepairDb) {
  const cache = new Map<string, DepartmentCampusLookup>();
  return async (departmentId: string): Promise<DepartmentCampusLookup> => {
    const cached = cache.get(departmentId);
    if (cached) {
      return cached;
    }
    let lookup: DepartmentCampusLookup = { campus: null, exists: false };
    try {
      const row = await db.getRow<DepartmentCampusRow>(
        DATABASE_ID,
        "departments",
        departmentId,
        [Query.select(["$id", "campus.$id", "campus_id"])]
      );
      lookup = {
        campus: relationId(row.campus) ?? row.campus_id ?? null,
        exists: true,
      };
    } catch {
      lookup = { campus: null, exists: false };
    }
    cache.set(departmentId, lookup);
    return lookup;
  };
}

/** Memoized parent-existence probe so N translations cost one read each. */
function createParentProbe(db: RepairDb) {
  const cache = new Map<string, boolean>();
  return async (tableId: string, rowId: string): Promise<boolean> => {
    const key = `${tableId}/${rowId}`;
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    let exists = false;
    try {
      await db.getRow(DATABASE_ID, tableId, rowId, [Query.select(["$id"])]);
      exists = true;
    } catch {
      exists = false;
    }
    cache.set(key, exists);
    return exists;
  };
}

function groupTranslations(
  rows: TranslationRow[]
): Map<string, TranslationRow[]> {
  const groups = new Map<string, TranslationRow[]>();
  for (const row of rows) {
    const key = `${row.content_type}\u0000${row.content_id}\u0000${row.locale}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the repair inventory intentionally enumerates every distinct data state in one auditable pass.
async function repairTranslationLinks(
  db: RepairDb,
  report: RepairReport,
  probeParent: ReturnType<typeof createParentProbe>,
  apply: boolean
): Promise<void> {
  const rows = await listAllRows<TranslationRow>(db, "content_translations");
  const duplicateIds = new Set<string>();

  for (const [, group] of groupTranslations(rows)) {
    const [first] = group;
    if (group.length > 1 && first) {
      report.duplicates.push({
        contentId: first.content_id ?? "",
        contentType: first.content_type ?? "",
        locale: first.locale ?? "",
        translationIds: group.map((row) => row.$id).sort(),
      });
      for (const row of group) {
        duplicateIds.add(row.$id);
      }
    }
  }

  for (const row of rows) {
    const contentType = row.content_type ?? "";
    if (duplicateIds.has(row.$id) || contentType === "job") {
      continue;
    }
    const rule =
      contentType in TRANSLATION_RULES
        ? TRANSLATION_RULES[contentType as SupportedContentType]
        : null;
    if (!rule) {
      report.unsupportedTypes[contentType] =
        (report.unsupportedTypes[contentType] ?? 0) + 1;
      continue;
    }
    if (!row.content_id) {
      report.orphans.push({
        contentId: null,
        contentType,
        translationId: row.$id,
      });
      continue;
    }
    if (!(await probeParent(rule.parentTable, row.content_id))) {
      report.orphans.push({
        contentId: row.content_id,
        contentType,
        translationId: row.$id,
      });
      continue;
    }

    const currentRef = relationId(row[rule.backReference]);
    if (currentRef === row.content_id) {
      report.alreadyLinked += 1;
      continue;
    }
    if (currentRef) {
      report.wrongParents.push({
        actualParentId: currentRef,
        contentType,
        expectedParentId: row.content_id,
        translationId: row.$id,
      });
      continue;
    }

    try {
      if (apply) {
        await db.updateRow(DATABASE_ID, "content_translations", row.$id, {
          [rule.backReference]: row.content_id,
        });
      }
      report.linked.push({ parentId: row.content_id, translationId: row.$id });
    } catch (error) {
      report.errors.push({
        id: row.$id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await repairJobRelations(db, report, rows, duplicateIds, apply);
}

/**
 * `jobs.translations` is one-way (no child back-reference), so unlinked
 * children can only be reattached by replacing the parent's complete relation
 * with every translation ID for that job.
 */
async function repairJobRelations(
  db: RepairDb,
  report: RepairReport,
  translationRows: TranslationRow[],
  duplicateIds: Set<string>,
  apply: boolean
): Promise<void> {
  const byJob = new Map<string, TranslationRow[]>();
  for (const row of translationRows) {
    if (row.content_type !== "job" || duplicateIds.has(row.$id)) {
      continue;
    }
    if (!row.content_id) {
      report.orphans.push({
        contentId: null,
        contentType: "job",
        translationId: row.$id,
      });
      continue;
    }
    const group = byJob.get(row.content_id);
    if (group) {
      group.push(row);
    } else {
      byJob.set(row.content_id, [row]);
    }
  }

  for (const [jobId, group] of byJob) {
    await relinkJobTranslations(db, report, jobId, group, apply);
  }
}

async function relinkJobTranslations(
  db: RepairDb,
  report: RepairReport,
  jobId: string,
  group: TranslationRow[],
  apply: boolean
): Promise<void> {
  let job: { $id: string; translations?: unknown } | null = null;
  try {
    job = await db.getRow(DATABASE_ID, "jobs", jobId, [
      Query.select(["$id", "translations.$id"]),
    ]);
  } catch {
    job = null;
  }
  if (!job) {
    for (const row of group) {
      report.orphans.push({
        contentId: jobId,
        contentType: "job",
        translationId: row.$id,
      });
    }
    return;
  }

  const linkedIds = new Set(
    (Array.isArray(job.translations) ? job.translations : [])
      .map((value) => relationId(value))
      .filter((value): value is string => Boolean(value))
  );
  const expectedIds = group.map((row) => row.$id);
  const missing = expectedIds.filter((id) => !linkedIds.has(id));
  if (missing.length === 0) {
    report.alreadyLinked += expectedIds.length;
    return;
  }

  // Replacing the relation with `expectedIds` alone would silently unlink any
  // child the job already holds but that this pass skipped — a duplicate-group
  // row, or one whose `content_id` is missing or points elsewhere. Those states
  // are reported, never modified, so the write is the union of both sets.
  const mergedIds = [...new Set([...linkedIds, ...expectedIds])];

  try {
    if (apply) {
      await db.upsertRow(DATABASE_ID, "jobs", jobId, {
        translations: mergedIds,
      });
    }
    report.jobRelinked.push({ jobId, translationIds: mergedIds });
  } catch (error) {
    report.errors.push({
      id: jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function repairPageTranslationLinks(
  db: RepairDb,
  report: RepairReport,
  probeParent: ReturnType<typeof createParentProbe>,
  apply: boolean
): Promise<void> {
  const rows = await listAllRows<PageTranslationRow>(db, "page_translations");
  for (const row of rows) {
    const currentRef = relationId(row.page);
    if (!row.page_id) {
      if (!currentRef) {
        report.orphans.push({
          contentId: null,
          contentType: "page",
          translationId: row.$id,
        });
      }
      continue;
    }
    if (currentRef === row.page_id) {
      report.alreadyLinked += 1;
      continue;
    }
    if (currentRef) {
      report.wrongParents.push({
        actualParentId: currentRef,
        contentType: "page",
        expectedParentId: row.page_id,
        translationId: row.$id,
      });
      continue;
    }
    if (!(await probeParent("pages", row.page_id))) {
      report.orphans.push({
        contentId: row.page_id,
        contentType: "page",
        translationId: row.$id,
      });
      continue;
    }

    try {
      if (apply) {
        await db.updateRow(DATABASE_ID, "page_translations", row.$id, {
          page: row.page_id,
        });
      }
      report.pageLinked.push({ pageId: row.page_id, translationId: row.$id });
    } catch (error) {
      report.errors.push({
        id: row.$id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function backfillOwnershipRelation(
  db: RepairDb,
  report: RepairReport,
  probeParent: ReturnType<typeof createParentProbe>,
  apply: boolean,
  input: {
    field: "campus" | "department";
    parentTable: "campus" | "departments";
    rowId: string;
    tableId: string;
    value: string;
  }
): Promise<void> {
  if (!(await probeParent(input.parentTable, input.value))) {
    report.errors.push({
      id: `${input.tableId}/${input.rowId}`,
      message: `${input.field} target ${input.value} does not exist`,
    });
    return;
  }
  try {
    if (apply) {
      await db.updateRow(DATABASE_ID, input.tableId, input.rowId, {
        [input.field]: input.value,
      });
    }
    report.ownershipBackfills.push({
      field: input.field,
      rowId: input.rowId,
      tableId: input.tableId,
      value: input.value,
    });
  } catch (error) {
    report.errors.push({
      id: `${input.tableId}/${input.rowId}`,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

interface OwnershipContext {
  apply: boolean;
  db: RepairDb;
  probeDepartmentCampus: ReturnType<typeof createDepartmentCampusProbe>;
  probeParent: ReturnType<typeof createParentProbe>;
  report: RepairReport;
}

/**
 * A department may only own content inside its own campus — the authorization
 * path rejects that tuple on every new write. Promoting a cross-campus (or
 * unverifiable) scalar to the canonical relationship would mint rows that their
 * own authors can no longer edit, so those pairs are reported and left alone.
 */
async function backfillDepartmentOwnership(
  ctx: OwnershipContext,
  input: {
    departmentId: string;
    rowCampus: string | null;
    rowId: string;
    tableId: string;
  }
): Promise<void> {
  const id = `${input.tableId}/${input.rowId}`;
  const lookup = await ctx.probeDepartmentCampus(input.departmentId);
  if (!lookup.exists) {
    ctx.report.errors.push({
      id,
      message: `department target ${input.departmentId} does not exist`,
    });
    return;
  }
  if (!input.rowCampus) {
    ctx.report.errors.push({
      id,
      message: `department target ${input.departmentId} cannot be verified: row has no campus`,
    });
    return;
  }
  if (!lookup.campus) {
    ctx.report.errors.push({
      id,
      message: `department target ${input.departmentId} has no campus of its own`,
    });
    return;
  }
  if (lookup.campus !== input.rowCampus) {
    ctx.report.errors.push({
      id,
      message: `department target ${input.departmentId} belongs to campus ${lookup.campus}, row campus is ${input.rowCampus}`,
    });
    return;
  }

  await backfillOwnershipRelation(
    ctx.db,
    ctx.report,
    ctx.probeParent,
    ctx.apply,
    {
      field: "department",
      parentTable: "departments",
      rowId: input.rowId,
      tableId: input.tableId,
      value: input.departmentId,
    }
  );
}

async function backfillRowOwnership(
  ctx: OwnershipContext,
  table: OwnershipTableRule,
  row: Record<string, unknown> & { $id: string }
): Promise<void> {
  const campusScalar =
    typeof row.campus_id === "string" && row.campus_id ? row.campus_id : null;
  if (campusScalar && !relationId(row.campus)) {
    await backfillOwnershipRelation(
      ctx.db,
      ctx.report,
      ctx.probeParent,
      ctx.apply,
      {
        field: "campus",
        parentTable: "campus",
        rowId: row.$id,
        tableId: table.tableId,
        value: campusScalar,
      }
    );
  }

  if (!table.departmentField) {
    return;
  }
  const departmentValue = row[table.departmentField];
  const departmentScalar =
    typeof departmentValue === "string" && departmentValue
      ? departmentValue
      : null;
  if (departmentScalar && !relationId(row.department)) {
    await backfillDepartmentOwnership(ctx, {
      departmentId: departmentScalar,
      rowCampus: relationId(row.campus) ?? campusScalar,
      rowId: row.$id,
      tableId: table.tableId,
    });
  }
}

async function backfillOwnership(ctx: OwnershipContext): Promise<void> {
  for (const table of OWNERSHIP_TABLES) {
    const rows = await listAllRows<Record<string, unknown> & { $id: string }>(
      ctx.db,
      table.tableId
    );
    for (const row of rows) {
      await backfillRowOwnership(ctx, table, row);
    }
  }
}

export async function repairContentRelationships(
  db: RepairDb,
  options: RepairOptions
): Promise<RepairReport> {
  const report: RepairReport = {
    alreadyLinked: 0,
    duplicates: [],
    errors: [],
    jobRelinked: [],
    linked: [],
    orphans: [],
    ownershipBackfills: [],
    pageLinked: [],
    unsupportedTypes: {},
    wrongParents: [],
  };
  const probeParent = createParentProbe(db);
  const probeDepartmentCampus = createDepartmentCampusProbe(db);

  await repairTranslationLinks(db, report, probeParent, options.apply);
  await repairPageTranslationLinks(db, report, probeParent, options.apply);
  await backfillOwnership({
    apply: options.apply,
    db,
    probeDepartmentCampus,
    probeParent,
    report,
  });

  return report;
}
