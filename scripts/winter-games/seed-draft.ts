/**
 * Seed the Winter Games project page (spec D12) at `projects/winter-games`,
 * bound to the national Wintergames unit (campus "5", slug "wintergames"), as
 * drafts only. The `no` and `en` drafts come from `winterGamesDoc`, with
 * `meta.department` set to the unit, which also binds the events block
 * (`source: "auto"`).
 *
 * What it does with the address:
 *  - No page: create one, an unpublished draft, through `savePageDraft`'s
 *    create path exactly as `createUnitPage` calls it.
 *  - A page bound to the unit: rewrite its two drafts and nothing else. This
 *    is the idempotent re-run.
 *  - A page bound to no department: stop, unless `--adopt <pageId>` names
 *    exactly that page. Adopting binds the row to the unit and campus "5"
 *    through `savePageDraft`'s UPDATE path, which writes the ownership columns
 *    (slug, campus, department) and never the status, the permissions or a
 *    publish flag, and then rewrites both drafts. A published page stays
 *    published, its published documents stay live as they are, and someone
 *    publishes the new drafts from the editor once they have compared them.
 *  - A page bound to another department: stop.
 * A missing or inactive unit stops it too. Every check runs before the first
 * write, so a stopped run has written nothing.
 *
 * Writes go through the page builder only (`savePageDraft`,
 * `savePageTranslationDraft`). The script never publishes and never
 * revalidates the site. Before writing to an existing page it hashes each
 * locale's stored published document, and after writing it reads everything
 * back and compares it with that earlier state.
 *
 * Dry run by default (reads only); `--write` performs the writes.
 *
 * Usage (repo root):
 *   bun --conditions=react-server --env-file=apps/admin/.env.local \
 *     scripts/winter-games/seed-draft.ts [--write] [--adopt <pageId>]
 */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type Models, Query } from "@repo/api";
import type {
  PageAuthCtx,
  PageEditorLocale,
  PageDoc as StoredPageDoc,
} from "@repo/api/page-builder";
import type {
  Departments,
  Pages,
  PageTranslations,
} from "@repo/api/types/appwrite";
import { sanitizePageDocHtml } from "@repo/editor/sanitize";
import { normalizePageDoc } from "@repo/editor/serialize";
import type { PageDoc } from "@repo/editor/types";
import {
  isHubProject,
  PROJECT_UNIT_SLUGS,
  projectPageSlug,
  projectSlugForUnit,
} from "@repo/shared/utils/project-units";
import {
  type WinterGamesLocale,
  winterGamesDoc,
} from "../../apps/web/src/app/(public)/design-system/winter-games/doc";

export const NATIONAL_CAMPUS_ID = "5";
export const SEED_SLUG = "projects/winter-games";
const UNIT_SLUG = PROJECT_UNIT_SLUGS["winter-games"];
const LOCALES = ["no", "en"] as const satisfies readonly (WinterGamesLocale &
  PageEditorLocale)[];
type SeedLocale = (typeof LOCALES)[number];

/** Room to see a duplicate unit; the sync keeps slugs unique per campus. */
const UNIT_LOOKUP_LIMIT = 10;
/** Room to see a second page at the address (the slug index is unique). */
const PAGE_LOOKUP_LIMIT = 2;
/** A page has one translation row per locale; this leaves room to see more. */
const TRANSLATION_LOOKUP_LIMIT = 25;
const PAGE_COLUMNS = ["$id", "slug", "department_id", "campus_id", "status"];
const TRANSLATION_COLUMNS = [
  "$id",
  "locale",
  "is_published",
  "draft_doc",
  "published_doc",
  "title",
  "description",
];

/**
 * The author `savePageDraft` is handed. It reads the author only to derive a
 * campus when none is passed, and the seed always passes the unit's campus.
 */
const SEED_CTX: PageAuthCtx = {
  managedCampusIds: [],
  resolvedCampusIds: [],
  roles: [],
  userId: "seed-winter-games",
};

/** The reads the seed makes itself. It never writes through the db. */
export interface SeedDb {
  listRows<Row extends Models.Row>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: Row[] }>;
}

interface SaveDraftBase {
  ctx: PageAuthCtx;
  doc: StoredPageDoc;
  locale: PageEditorLocale;
}

/** The page-builder helpers the seed may use, narrowed to how it uses them. */
export interface SeedPages {
  /**
   * The create path (`id: null`, as createUnitPage calls it), or the update
   * path when adopting a page. The update path writes the row's ownership
   * columns and the locale's draft. It never writes the status, the
   * permissions or a publish flag (page-builder.ts, "A save never writes the
   * publish state").
   */
  savePageDraft: (
    params: SaveDraftBase &
      (
        | { campusId: string | null; id: null; slugConflict: "fail" }
        | { campusId: string; id: string }
      )
  ) => Promise<{ pageId: string; slug: string }>;
  savePageTranslationDraft: (params: {
    doc: StoredPageDoc;
    id: string;
    locale: PageEditorLocale;
  }) => Promise<unknown>;
}

export interface SeedDeps {
  buildDoc: (locale: WinterGamesLocale) => PageDoc;
  db: SeedDb;
  log: (line: string) => void;
  pages: SeedPages;
}

export interface TranslationState {
  /** The row's description column (the live page's meta description). */
  description: string | null;
  /** The stored draft JSON; null when there is none. */
  draft: string | null;
  isPublished: boolean;
  /** SHA-256 of the stored published JSON string; null when there is none. */
  publishedHash: string | null;
  publishedLength: number;
  /** The row's title column (the live page's <title>). */
  title: string | null;
}

/** A page row and its translations, as stored. */
export interface PageState {
  campusId: string | null;
  departmentId: string | null;
  pageId: string;
  slug: string | null;
  status: string;
  translations: Partial<Record<SeedLocale, TranslationState>>;
}

interface LocalePlan {
  blocks: number;
  /** Whether normalizing and sanitizing changed the built document. */
  cleaned: boolean;
  locale: SeedLocale;
  sections: number;
}

export type SeedPlan = {
  docs: Record<SeedLocale, PageDoc>;
  locales: LocalePlan[];
  unit: { id: string; name: string };
} & (
  | { action: "create"; before: null; pageId: null }
  | {
      action: "adopt" | "update";
      /** The page before any write: what the read-back compares against. */
      before: PageState;
      pageId: string;
    }
);

export type SeedOutcome =
  | { reason: string; status: "aborted" }
  | { plan: SeedPlan; status: "planned" }
  | {
      plan: SeedPlan;
      /** Read-back checks that failed; empty when all is as expected. */
      problems: string[];
      readBack: PageState;
      status: "written";
    };

export interface SeedOptions {
  /** `--adopt <pageId>`: the unbound page this run may bind to the unit. */
  adopt?: string | null;
  write: boolean;
}

type Checked<T> = { error: string } | { value: T };

const NOTHING_WRITTEN = "Nothing was written.";
const PUBLISHED_CHANGED = "PUBLISHED DOCUMENT CHANGED";
const ALARM = "!".repeat(72);

function isSeedLocale(locale: string | null | undefined): locale is SeedLocale {
  return (LOCALES as readonly string[]).includes(locale ?? "");
}

function sha256(json: string | null | undefined): string | null {
  if (json === null || json === undefined) {
    return null;
  }
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * The page address of a national unit, as `unitPageAddress` in the admin's
 * departments actions computes it: a national project's unit owns
 * `projects/<project>`. Null for anything else.
 */
function nationalUnitPageAddress(unit: Departments): string | null {
  const project =
    unit.campus_id === NATIONAL_CAMPUS_ID
      ? projectSlugForUnit(unit.slug)
      : null;
  return project && !isHubProject(project) ? projectPageSlug(project) : null;
}

async function findUnit(db: SeedDb): Promise<Checked<Departments>> {
  const where = `departments campus_id "${NATIONAL_CAMPUS_ID}", slug "${UNIT_SLUG}"`;
  const found = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", NATIONAL_CAMPUS_ID),
    Query.equal("slug", UNIT_SLUG),
    Query.limit(UNIT_LOOKUP_LIMIT),
  ]);
  // `active` is nullable, and null is not active: the public site's unit
  // lookups filter `active = true`, and createUnitPage refuses anything else.
  const active = found.rows.filter((row) => row.active === true);
  if (found.rows.length === 0) {
    return {
      error: `The national Wintergames unit was not found (${where}). ${NOTHING_WRITTEN}`,
    };
  }
  if (active.length === 0) {
    const rows = found.rows
      .map((row) => `${row.$id} active=${String(row.active)}`)
      .join(", ");
    return {
      error: `The national Wintergames unit is inactive (${rows}). ${NOTHING_WRITTEN}`,
    };
  }
  const [unit, ...others] = active;
  if (!unit || others.length > 0) {
    const ids = active.map((row) => row.$id).join(", ");
    return {
      error: `${active.length} active units match ${where} (${ids}); expected exactly one. ${NOTHING_WRITTEN}`,
    };
  }
  const address = nationalUnitPageAddress(unit);
  if (address !== SEED_SLUG) {
    return {
      error: `Unit ${unit.$id}'s page address is ${String(address)}, not ${SEED_SLUG}. ${NOTHING_WRITTEN}`,
    };
  }
  return { value: unit };
}

type PageChoice =
  | { action: "create"; row: null }
  | { action: "adopt" | "update"; row: Pages };

async function findPage(
  db: SeedDb,
  unit: Departments,
  adopt: string | null
): Promise<Checked<PageChoice>> {
  const found = await db.listRows<Pages>("app", "pages", [
    Query.equal("slug", SEED_SLUG),
    Query.select(PAGE_COLUMNS),
    Query.limit(PAGE_LOOKUP_LIMIT),
  ]);
  if (found.rows.length > 1) {
    const ids = found.rows.map((row) => row.$id).join(", ");
    return {
      error: `More than one page answers ${SEED_SLUG} (${ids}). ${NOTHING_WRITTEN}`,
    };
  }
  const page = found.rows[0];
  if (!page) {
    return adopt
      ? {
          error: `--adopt ${adopt} was given, but there is no page at ${SEED_SLUG}. ${NOTHING_WRITTEN}`,
        }
      : { value: { action: "create", row: null } };
  }
  const where = `The page at ${SEED_SLUG} (${page.$id}, status ${page.status})`;
  if (adopt && adopt !== page.$id) {
    return {
      error: `--adopt ${adopt} does not match the page at ${SEED_SLUG} (${page.$id}). ${NOTHING_WRITTEN}`,
    };
  }
  // A page already bound to the unit is the ordinary re-run, with or without
  // `--adopt` (an adopt command run a second time lands here).
  if (page.department_id === unit.$id) {
    return { value: { action: "update", row: page } };
  }
  // createUnitPage's ownership rule: a null department means "no
  // department", never "any department".
  if (page.department_id) {
    return {
      error: `${where} belongs to another department (${page.department_id}), not unit ${unit.$id}. ${NOTHING_WRITTEN}`,
    };
  }
  if (adopt) {
    return { value: { action: "adopt", row: page } };
  }
  return {
    error: `${where} is bound to no department, not unit ${unit.$id}. To bind it to the unit and replace its drafts, pass --adopt ${page.$id}. ${NOTHING_WRITTEN}`,
  };
}

async function readTranslations(
  db: SeedDb,
  pageId: string
): Promise<{
  duplicates: SeedLocale[];
  translations: PageState["translations"];
}> {
  const found = await db.listRows<PageTranslations>(
    "app",
    "page_translations",
    [
      Query.equal("page_id", pageId),
      Query.select(TRANSLATION_COLUMNS),
      Query.limit(TRANSLATION_LOOKUP_LIMIT),
    ]
  );
  const translations: PageState["translations"] = {};
  const duplicates: SeedLocale[] = [];
  for (const row of found.rows) {
    if (!isSeedLocale(row.locale)) {
      continue;
    }
    if (translations[row.locale]) {
      duplicates.push(row.locale);
    }
    translations[row.locale] = {
      description: row.description ?? null,
      draft: row.draft_doc ?? null,
      isPublished: row.is_published,
      publishedHash: sha256(row.published_doc),
      publishedLength: row.published_doc?.length ?? 0,
      title: row.title ?? null,
    };
  }
  return { duplicates, translations };
}

function toState(
  row: Pages,
  translations: PageState["translations"]
): PageState {
  return {
    campusId: row.campus_id,
    departmentId: row.department_id,
    pageId: row.$id,
    slug: row.slug,
    status: row.status,
    translations,
  };
}

/**
 * One locale's draft: the built document bound to the unit, then the steps a
 * save from the editor takes. `normalizePageDoc` is the editor's load
 * boundary; savePageEditorDoc trims the slug and sanitizes text-block HTML
 * (`sanitizePageDocHtml`) before it calls the page builder.
 */
function seedDoc(
  deps: SeedDeps,
  locale: SeedLocale,
  unitId: string
): { cleaned: boolean; doc: PageDoc } {
  const built = deps.buildDoc(locale);
  const bound: PageDoc = {
    ...built,
    meta: {
      ...built.meta,
      department: unitId,
      slug: SEED_SLUG,
      status: "draft",
    },
  };
  const normalized = normalizePageDoc(bound);
  const doc = sanitizePageDocHtml({
    ...normalized,
    meta: { ...normalized.meta, slug: normalized.meta.slug.trim() },
  });
  return { cleaned: !isDeepStrictEqual(doc, bound), doc };
}

function countBlocks(doc: PageDoc): number {
  let blocks = 0;
  for (const section of doc.sections) {
    for (const column of section.columns) {
      blocks += column.blocks.length;
    }
  }
  return blocks;
}

async function makePlan(
  deps: SeedDeps,
  adopt: string | null
): Promise<Checked<SeedPlan>> {
  const unit = await findUnit(deps.db);
  if ("error" in unit) {
    return unit;
  }
  const page = await findPage(deps.db, unit.value, adopt);
  if ("error" in page) {
    return page;
  }

  const docs = {} as Record<SeedLocale, PageDoc>;
  const locales: LocalePlan[] = [];
  for (const locale of LOCALES) {
    const { cleaned, doc } = seedDoc(deps, locale, unit.value.$id);
    docs[locale] = doc;
    locales.push({
      blocks: countBlocks(doc),
      cleaned,
      locale,
      sections: doc.sections.length,
    });
  }
  const base = {
    docs,
    locales,
    unit: { id: unit.value.$id, name: unit.value.Name },
  };
  const choice = page.value;
  if (choice.action === "create") {
    return { value: { ...base, action: "create", before: null, pageId: null } };
  }
  const { duplicates, translations } = await readTranslations(
    deps.db,
    choice.row.$id
  );
  if (duplicates.length > 0) {
    return {
      error: `Page ${choice.row.$id} has more than one ${duplicates.join(", ")} translation row. ${NOTHING_WRITTEN}`,
    };
  }
  return {
    value: {
      ...base,
      action: choice.action,
      before: toState(choice.row, translations),
      pageId: choice.row.$id,
    },
  };
}

function describePublished(entry: TranslationState): string {
  return entry.publishedHash
    ? `sha256 ${entry.publishedHash} (${entry.publishedLength} chars)`
    : "none";
}

/**
 * A draft save writes the row's title and description along with the draft
 * (page-builder `writeTranslationDraft`, as every editor save does), and the
 * public page reads those two columns for its <title> and meta description,
 * published or not. Said out loud, since on a live page they change before
 * anyone publishes.
 */
function rowColumnsChange(stored: TranslationState, doc: PageDoc): string {
  const description = doc.meta.description ?? null;
  if (stored.title === doc.meta.title && stored.description === description) {
    return "row title and description unchanged";
  }
  return `row title "${String(stored.title)}" -> "${doc.meta.title}", description ${stored.description?.length ?? 0} -> ${description?.length ?? 0} chars (the public page's <title> and meta description read these columns)`;
}

function printPlan(log: SeedDeps["log"], plan: SeedPlan): void {
  const unit = plan.unit.id;
  log(
    `unit   ${unit} "${plan.unit.name}" (campus ${NATIONAL_CAMPUS_ID}, slug ${UNIT_SLUG}, active)`
  );
  if (plan.action === "create") {
    log(
      `page   none at ${SEED_SLUG}: create it (savePageDraft create, campus ${NATIONAL_CAMPUS_ID}, department ${unit}, status draft, unpublished)`
    );
  } else {
    const { before } = plan;
    log(
      `page   ${plan.pageId} at ${SEED_SLUG}: status ${before.status}, campus_id ${String(before.campusId)}, department_id ${String(before.departmentId)}`
    );
    log(
      plan.action === "adopt"
        ? `       ADOPT: bind it to ${unit} and campus ${NATIONAL_CAMPUS_ID} (savePageDraft update path: ownership columns only; status, permissions and publish flags untouched), then replace both drafts`
        : `       bound to ${unit}: update the drafts only`
    );
  }
  log("drafts");
  for (const entry of plan.locales) {
    const stored = plan.before?.translations[entry.locale];
    const row = stored
      ? `existing translation row (is_published=${stored.isPublished}, left as is)`
      : "new translation row (unpublished)";
    const cleaning = entry.cleaned
      ? "changed by normalize/sanitize"
      : "unchanged by normalize/sanitize";
    log(
      `  ${entry.locale}: ${entry.sections} sections, ${entry.blocks} blocks; ${row}; ${cleaning}`
    );
    if (stored) {
      log(`      published ${describePublished(stored)}; must stay unchanged`);
      log(`      ${rowColumnsChange(stored, plan.docs[entry.locale])}`);
    }
  }
}

async function writeDrafts(deps: SeedDeps, plan: SeedPlan): Promise<string> {
  if (plan.action === "create") {
    // createUnitPage's call: the unit's campus passed explicitly, and "fail"
    // so a lost race hits the unique slug index instead of minting
    // `projects/winter-games-2`. The row starts as an unpublished draft with
    // no permissions; the `no` draft is written with it.
    const { pageId, slug } = await deps.pages.savePageDraft({
      campusId: NATIONAL_CAMPUS_ID,
      ctx: SEED_CTX,
      doc: plan.docs.no,
      id: null,
      locale: "no",
      slugConflict: "fail",
    });
    deps.log(`created page ${pageId} at ${slug} with the no draft`);
    await deps.pages.savePageTranslationDraft({
      doc: plan.docs.en,
      id: pageId,
      locale: "en",
    });
    deps.log("wrote the en draft");
    return pageId;
  }
  if (plan.action === "adopt") {
    // The update path: `updateRow(pages, id, {slug, campus, campus_id,
    // department, department_id})` with no permissions argument, so the
    // row's status and read permissions stay as publishing left them. The
    // `no` draft is written with it, through the same draft-only update.
    await deps.pages.savePageDraft({
      campusId: NATIONAL_CAMPUS_ID,
      ctx: SEED_CTX,
      doc: plan.docs.no,
      id: plan.pageId,
      locale: "no",
    });
    deps.log(
      `bound page ${plan.pageId} to ${plan.unit.id} (campus ${NATIONAL_CAMPUS_ID}) and wrote the no draft`
    );
    await deps.pages.savePageTranslationDraft({
      doc: plan.docs.en,
      id: plan.pageId,
      locale: "en",
    });
    deps.log("wrote the en draft");
    return plan.pageId;
  }
  for (const locale of LOCALES) {
    await deps.pages.savePageTranslationDraft({
      doc: plan.docs[locale],
      id: plan.pageId,
      locale,
    });
    deps.log(`wrote the ${locale} draft`);
  }
  return plan.pageId;
}

interface StoredShape {
  meta?: { department?: unknown; slug?: unknown } | null;
  sections?:
    | ({
        columns?: ({
          blocks?: ({ id?: unknown; type?: unknown } | null)[];
        } | null)[];
        id?: unknown;
      } | null)[]
    | null;
}

function parseStored(json: string | null): StoredShape | null {
  if (!json) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as StoredShape)
      : null;
  } catch {
    return null;
  }
}

/** The ids and types of every section and block, in order. */
function structureOf(doc: StoredShape): string {
  return JSON.stringify(
    (doc.sections ?? []).map((section) => [
      section?.id,
      (section?.columns ?? []).map((column) =>
        (column?.blocks ?? []).map(
          (block) => `${String(block?.id)}:${String(block?.type)}`
        )
      ),
    ])
  );
}

function draftProblems(
  locale: SeedLocale,
  stored: string | null,
  plan: SeedPlan
): string[] {
  const draft = parseStored(stored);
  if (!draft) {
    return [`${locale} has no readable draft`];
  }
  const problems: string[] = [];
  if (draft.meta?.slug !== SEED_SLUG) {
    problems.push(`${locale} draft meta.slug is ${String(draft.meta?.slug)}`);
  }
  if (draft.meta?.department !== plan.unit.id) {
    problems.push(
      `${locale} draft meta.department is ${String(draft.meta?.department)}`
    );
  }
  if (structureOf(draft) !== structureOf(plan.docs[locale])) {
    problems.push(
      `${locale} draft sections/blocks differ from the seed document`
    );
  }
  return problems;
}

/**
 * Compare the page after the writes with the page before them (a new page:
 * with an unpublished draft). The binding is the seed's; the status, each
 * publish flag and each published document must be exactly as they were.
 */
function readBackProblems(after: PageState, plan: SeedPlan): string[] {
  const { before } = plan;
  const problems: string[] = [];
  const expectedCampus =
    plan.action === "update" ? plan.before.campusId : NATIONAL_CAMPUS_ID;
  const expectedStatus = before?.status ?? "draft";
  if (after.slug !== SEED_SLUG) {
    problems.push(`slug is ${String(after.slug)}, expected ${SEED_SLUG}`);
  }
  if (after.departmentId !== plan.unit.id) {
    problems.push(
      `department_id is ${String(after.departmentId)}, expected ${plan.unit.id}`
    );
  }
  if (after.campusId !== expectedCampus) {
    problems.push(
      `campus_id is ${String(after.campusId)}, expected ${String(expectedCampus)}`
    );
  }
  if (after.status !== expectedStatus) {
    problems.push(
      `status is ${after.status}, expected ${expectedStatus} (as before)`
    );
  }
  for (const locale of LOCALES) {
    const now = after.translations[locale];
    if (!now) {
      problems.push(`no ${locale} translation row`);
      continue;
    }
    const was = before?.translations[locale];
    const wasPublished = was?.isPublished ?? false;
    const wasHash = was?.publishedHash ?? null;
    if (now.isPublished !== wasPublished) {
      problems.push(
        `${locale} is_published is ${now.isPublished}, expected ${wasPublished} (as before)`
      );
    }
    if (now.publishedHash !== wasHash) {
      problems.push(
        `${PUBLISHED_CHANGED}: ${locale} sha256 was ${String(wasHash)}, is now ${String(now.publishedHash)}`
      );
    }
    problems.push(...draftProblems(locale, now.draft, plan));
  }
  return problems;
}

async function readBack(
  deps: SeedDeps,
  pageId: string
): Promise<{ duplicates: SeedLocale[]; state: PageState }> {
  const found = await deps.db.listRows<Pages>("app", "pages", [
    Query.equal("$id", pageId),
    Query.select(PAGE_COLUMNS),
    Query.limit(1),
  ]);
  const row = found.rows[0];
  if (!row) {
    throw new Error(`Read-back: page ${pageId} was not found`);
  }
  const { duplicates, translations } = await readTranslations(deps.db, pageId);
  return { duplicates, state: toState(row, translations) };
}

function printReadBack(
  log: SeedDeps["log"],
  after: PageState,
  plan: SeedPlan,
  problems: string[]
): void {
  log("read back");
  log(`  page id        ${after.pageId}`);
  log(`  slug           ${String(after.slug)}`);
  log(`  department_id  ${String(after.departmentId)}`);
  log(`  campus_id      ${String(after.campusId)}`);
  log(`  status         ${after.status}`);
  for (const locale of LOCALES) {
    const entry = after.translations[locale];
    if (!entry) {
      log(`  ${locale}             no translation row`);
      continue;
    }
    const wasHash = plan.before?.translations[locale]?.publishedHash ?? null;
    const published =
      entry.publishedHash === wasHash
        ? `published ${describePublished(entry)}, unchanged`
        : `published ${describePublished(entry)}, CHANGED`;
    log(
      `  ${locale}             is_published=${entry.isPublished}, draft ${entry.draft ? "present" : "MISSING"}, ${published}`
    );
  }
  // Detection, not rollback: the published documents were never copied
  // aside, and Appwrite has no transaction across these writes, so a change
  // found here cannot be undone by this script. It is reported, loudly, and
  // the run exits non-zero.
  const alarms = problems.filter((p) => p.startsWith(PUBLISHED_CHANGED));
  if (alarms.length > 0) {
    log(ALARM);
    log("!!! ERROR: A PUBLISHED DOCUMENT CHANGED DURING THIS RUN.");
    for (const alarm of alarms) {
      log(`!!! ${alarm}`);
    }
    log("!!! This script cannot undo it. Check the live page now.");
    log(ALARM);
  }
  log(
    problems.length === 0
      ? `VERIFIED: bound to ${plan.unit.id}, status ${after.status} as before, publish flags and published documents unchanged, both drafts are the seed's`
      : `CHECK FAILED: ${problems.join("; ")}`
  );
}

export async function runSeed(
  deps: SeedDeps,
  { adopt = null, write }: SeedOptions
): Promise<SeedOutcome> {
  const planned = await makePlan(deps, adopt);
  if ("error" in planned) {
    deps.log(`ABORT: ${planned.error}`);
    return { reason: planned.error, status: "aborted" };
  }
  const plan = planned.value;
  printPlan(deps.log, plan);
  if (!write) {
    deps.log("DRY run: nothing written. Pass --write to write these drafts.");
    return { plan, status: "planned" };
  }
  const pageId = await writeDrafts(deps, plan);
  const { duplicates, state } = await readBack(deps, pageId);
  const problems = [
    ...duplicates.map((locale) => `more than one ${locale} translation row`),
    ...readBackProblems(state, plan),
  ];
  printReadBack(deps.log, state, plan, problems);
  return { plan, problems, readBack: state, status: "written" };
}

/** `--write` and `--adopt <pageId>`; anything else is refused. */
export function parseArgs(
  argv: readonly string[]
): { error: string } | { adopt: string | null; write: boolean } {
  const rest = [...argv];
  let adopt: string | null = null;
  let write = false;
  while (rest.length > 0) {
    const arg = rest.shift();
    if (arg === "--write") {
      write = true;
    } else if (arg === "--adopt") {
      const value = rest.shift();
      if (!value || value.startsWith("-")) {
        return { error: "--adopt needs a page id: --adopt <pageId>" };
      }
      adopt = value;
    } else {
      return { error: `Unknown argument: ${String(arg)}` };
    }
  }
  return { adopt, write };
}

/** The production wiring: the admin client and the real page builder. */
export async function loadDeps(log: SeedDeps["log"]): Promise<SeedDeps> {
  const { createAdminClient } = await import("@repo/api/server");
  const { savePageDraft, savePageTranslationDraft } = await import(
    "@repo/api/page-builder"
  );
  const { db } = await createAdminClient();
  return {
    buildDoc: winterGamesDoc,
    db,
    log,
    pages: { savePageDraft, savePageTranslationDraft },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }
  const { APPWRITE_PROJECT, NEXT_PUBLIC_APPWRITE_ENDPOINT } = await import(
    "@repo/api/server-env"
  );
  console.log(
    args.write ? "WRITE run" : "DRY run (pass --write to write the drafts)"
  );
  console.log(`target ${NEXT_PUBLIC_APPWRITE_ENDPOINT} (${APPWRITE_PROJECT})`);
  if (args.adopt) {
    console.log(`adopt  ${args.adopt}`);
  }
  const deps = await loadDeps((line) => console.log(line));
  const outcome = await runSeed(deps, args);
  const failed =
    outcome.status === "aborted" ||
    (outcome.status === "written" && outcome.problems.length > 0);
  if (failed) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
