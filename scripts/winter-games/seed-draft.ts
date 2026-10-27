/**
 * Seed the Winter Games project page (spec D12) as ONE unpublished draft at
 * `projects/winter-games`, bound to the national Wintergames unit (campus
 * "5", slug "wintergames"). The `no` and `en` drafts come from
 * `winterGamesDoc`, with `meta.department` set to the unit, which also binds
 * the events block (`source: "auto"`).
 *
 * Idempotent: a page already at the address and bound to the unit gets its
 * two drafts rewritten and nothing else; a page there that belongs to any
 * other department, or to none, stops the run. A missing or inactive unit
 * stops it too. Every check runs before the first write, so a stopped run has
 * written nothing.
 *
 * Writes go through the page builder only: `savePageDraft`'s create path,
 * exactly as `createUnitPage` calls it, for a new page (with the `no` draft),
 * and `savePageTranslationDraft` for every other draft. Neither writes the
 * page's status or a translation's publish flag on an existing row, and both
 * start a new row unpublished. The script never publishes and never
 * revalidates the site: the page stays a draft until someone publishes it in
 * the editor.
 *
 * Dry run by default (reads only); `--write` performs the writes and then
 * reads the page back.
 *
 * Usage (repo root):
 *   bun --conditions=react-server --env-file=apps/admin/.env.local \
 *     scripts/winter-games/seed-draft.ts [--write]
 */
import { isDeepStrictEqual } from "node:util";
import { type Models, Query } from "@repo/api";
import type {
  PageAuthCtx,
  PageEditorLoadResult,
  PageEditorLocale,
  PageDoc as StoredPageDoc,
} from "@repo/api/page-builder";
import type { Departments, Pages } from "@repo/api/types/appwrite";
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
const PAGE_COLUMNS = ["$id", "slug", "department_id", "campus_id", "status"];

/**
 * The author `savePageDraft` is handed. It reads the author only to derive a
 * campus when none is passed, and the seed passes the unit's campus.
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

/**
 * The page-builder helpers the seed may use. `savePageDraft` is typed to its
 * create path only: an existing page is never re-saved, so its row (status,
 * permissions, ownership) is never written.
 */
export interface SeedPages {
  getPageEditorById: (id: string) => Promise<PageEditorLoadResult | null>;
  savePageDraft: (params: {
    campusId: string | null;
    ctx: PageAuthCtx;
    doc: StoredPageDoc;
    id: null;
    locale: PageEditorLocale;
    slugConflict: "fail";
  }) => Promise<{ pageId: string; slug: string }>;
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

interface LocalePlan {
  blocks: number;
  /** Whether normalizing and sanitizing changed the built document. */
  cleaned: boolean;
  /** The stored translation's publish flag; null when there is no row yet. */
  isPublished: boolean | null;
  locale: SeedLocale;
  sections: number;
  translation: "create" | "update";
}

export interface SeedPlan {
  action: "create" | "update";
  docs: Record<SeedLocale, PageDoc>;
  locales: LocalePlan[];
  /** The existing page; null when the run creates it. */
  pageId: string | null;
  unit: { id: string; name: string };
}

export interface ReadBack {
  campusId: string | null;
  departmentId: string | null;
  pageId: string;
  slug: string | null;
  status: string;
  translations: Partial<
    Record<SeedLocale, { draftPresent: boolean; isPublished: boolean }>
  >;
}

export type SeedOutcome =
  | { reason: string; status: "aborted" }
  | { plan: SeedPlan; status: "planned" }
  | {
      plan: SeedPlan;
      /** Read-back checks that failed; empty when the page is as seeded. */
      problems: string[];
      readBack: ReadBack;
      status: "written";
    };

type Checked<T> = { error: string } | { value: T };

const NOTHING_WRITTEN = "Nothing was written.";

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

async function findPage(
  db: SeedDb,
  unit: Departments
): Promise<Checked<Pages | null>> {
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
  const page = found.rows[0] ?? null;
  if (!page || page.department_id === unit.$id) {
    return { value: page };
  }
  // createUnitPage's ownership rule: a null department means "no
  // department", never "any department".
  const owner = page.department_id
    ? `belongs to another department (${page.department_id})`
    : "is bound to no department";
  return {
    error: `The page at ${SEED_SLUG} (${page.$id}, status ${page.status}) ${owner}, not unit ${unit.$id}. ${NOTHING_WRITTEN}`,
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

async function makePlan(deps: SeedDeps): Promise<Checked<SeedPlan>> {
  const unit = await findUnit(deps.db);
  if ("error" in unit) {
    return unit;
  }
  const page = await findPage(deps.db, unit.value);
  if ("error" in page) {
    return page;
  }
  const existing = page.value
    ? await deps.pages.getPageEditorById(page.value.$id)
    : null;

  const docs = {} as Record<SeedLocale, PageDoc>;
  const locales: LocalePlan[] = [];
  for (const locale of LOCALES) {
    const { cleaned, doc } = seedDoc(deps, locale, unit.value.$id);
    docs[locale] = doc;
    const stored = existing?.translations[locale];
    locales.push({
      blocks: countBlocks(doc),
      cleaned,
      isPublished: stored ? stored.isPublished : null,
      locale,
      sections: doc.sections.length,
      translation: stored ? "update" : "create",
    });
  }
  return {
    value: {
      action: page.value ? "update" : "create",
      docs,
      locales,
      pageId: page.value?.$id ?? null,
      unit: { id: unit.value.$id, name: unit.value.Name },
    },
  };
}

function printPlan(log: SeedDeps["log"], plan: SeedPlan): void {
  log(
    `unit   ${plan.unit.id} "${plan.unit.name}" (campus ${NATIONAL_CAMPUS_ID}, slug ${UNIT_SLUG}, active)`
  );
  if (plan.pageId) {
    log(
      `page   ${plan.pageId} at ${SEED_SLUG}, bound to ${plan.unit.id}: update the drafts only`
    );
  } else {
    log(
      `page   none at ${SEED_SLUG}: create it (savePageDraft create, campus ${NATIONAL_CAMPUS_ID}, department ${plan.unit.id}, status draft, unpublished)`
    );
  }
  log("drafts");
  for (const entry of plan.locales) {
    const row =
      entry.isPublished === null
        ? "new translation row (unpublished)"
        : `existing translation row (is_published=${entry.isPublished}, left as is)`;
    const cleaning = entry.cleaned
      ? "changed by normalize/sanitize"
      : "unchanged by normalize/sanitize";
    log(
      `  ${entry.locale}: ${entry.sections} sections, ${entry.blocks} blocks; ${row}; ${cleaning}`
    );
  }
}

async function writeDrafts(deps: SeedDeps, plan: SeedPlan): Promise<string> {
  if (plan.pageId === null) {
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

async function readBack(deps: SeedDeps, pageId: string): Promise<ReadBack> {
  const found = await deps.db.listRows<Pages>("app", "pages", [
    Query.equal("$id", pageId),
    Query.select(PAGE_COLUMNS),
    Query.limit(1),
  ]);
  const row = found.rows[0];
  if (!row) {
    throw new Error(`Read-back: page ${pageId} was not found`);
  }
  const loaded = await deps.pages.getPageEditorById(pageId);
  const translations: ReadBack["translations"] = {};
  for (const locale of LOCALES) {
    const entry = loaded?.translations[locale];
    if (entry) {
      translations[locale] = {
        draftPresent: entry.draftDocument !== null,
        isPublished: entry.isPublished,
      };
    }
  }
  return {
    campusId: row.campus_id,
    departmentId: row.department_id,
    pageId: row.$id,
    slug: row.slug,
    status: row.status,
    translations,
  };
}

function readBackProblems(back: ReadBack, unitId: string): string[] {
  const problems: string[] = [];
  if (back.slug !== SEED_SLUG) {
    problems.push(`slug is ${String(back.slug)}, expected ${SEED_SLUG}`);
  }
  if (back.departmentId !== unitId) {
    problems.push(
      `department_id is ${String(back.departmentId)}, expected ${unitId}`
    );
  }
  if (back.status !== "draft") {
    problems.push(`status is ${back.status}, expected draft`);
  }
  for (const locale of LOCALES) {
    const entry = back.translations[locale];
    if (!entry) {
      problems.push(`no ${locale} translation row`);
      continue;
    }
    if (entry.isPublished) {
      problems.push(`${locale} is published, expected unpublished`);
    }
    if (!entry.draftPresent) {
      problems.push(`${locale} has no draft`);
    }
  }
  return problems;
}

function printReadBack(
  log: SeedDeps["log"],
  back: ReadBack,
  problems: string[]
): void {
  log("read back");
  log(`  page id        ${back.pageId}`);
  log(`  slug           ${String(back.slug)}`);
  log(`  department_id  ${String(back.departmentId)}`);
  log(`  campus_id      ${String(back.campusId)}`);
  log(`  status         ${back.status}`);
  for (const locale of LOCALES) {
    const entry = back.translations[locale];
    log(
      entry
        ? `  ${locale}             is_published=${entry.isPublished}, draft ${entry.draftPresent ? "present" : "MISSING"}`
        : `  ${locale}             no translation row`
    );
  }
  log(
    problems.length === 0
      ? "VERIFIED: an unpublished draft bound to the unit, both drafts present"
      : `CHECK FAILED: ${problems.join("; ")}`
  );
}

export async function runSeed(
  deps: SeedDeps,
  { write }: { write: boolean }
): Promise<SeedOutcome> {
  const planned = await makePlan(deps);
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
  const back = await readBack(deps, pageId);
  const problems = readBackProblems(back, plan.unit.id);
  printReadBack(deps.log, back, problems);
  return { plan, problems, readBack: back, status: "written" };
}

/** The production wiring: the admin client and the real page builder. */
export async function loadDeps(log: SeedDeps["log"]): Promise<SeedDeps> {
  const { createAdminClient } = await import("@repo/api/server");
  const { getPageEditorById, savePageDraft, savePageTranslationDraft } =
    await import("@repo/api/page-builder");
  const { db } = await createAdminClient();
  return {
    buildDoc: winterGamesDoc,
    db,
    log,
    pages: {
      getPageEditorById: (id) => getPageEditorById(id, db),
      savePageDraft,
      savePageTranslationDraft,
    },
  };
}

async function main() {
  const write = process.argv.includes("--write");
  const { APPWRITE_PROJECT, NEXT_PUBLIC_APPWRITE_ENDPOINT } = await import(
    "@repo/api/server-env"
  );
  console.log(
    write ? "WRITE run" : "DRY run (pass --write to write the drafts)"
  );
  console.log(`target ${NEXT_PUBLIC_APPWRITE_ENDPOINT} (${APPWRITE_PROJECT})`);
  const deps = await loadDeps((line) => console.log(line));
  const outcome = await runSeed(deps, { write });
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
