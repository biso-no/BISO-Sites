import { describe, expect, it, mock, spyOn } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PageDoc } from "@repo/editor/types";
import {
  type WinterGamesLocale,
  winterGamesDoc,
} from "../../apps/web/src/app/(public)/design-system/winter-games/doc";
import type { SeedDeps } from "./seed-draft";

// `server-only` (the sanitizer imports it) throws outside a react-server
// build, which a test is not. The admin client hands out whichever fake db
// the running test set, so the REAL page builder (which imports `./server`)
// writes into it. Both are registered before anything loads them.
mock.module("server-only", () => ({}));
let currentDb: FakeDb["db"] | null = null;
mock.module("@repo/api/server", () => ({
  createAdminClient: () =>
    currentDb
      ? Promise.resolve({ db: currentDb })
      : Promise.reject(new Error("no fake db set")),
  createSessionClient: () => Promise.reject(new Error("no session client")),
}));
const { loadDeps, NATIONAL_CAMPUS_ID, parseArgs, runSeed, SEED_SLUG } =
  await import("./seed-draft");
const pageBuilder = await import("@repo/api/page-builder");

const UNIT = {
  $id: "1007",
  Name: "Wintergames",
  active: true as boolean | null,
  campus_id: "5",
  slug: "wintergames" as string | null,
};

const CREATED_PAGE_ID = "page-wg";
const LIVE_PAGE_ID = "6adcd79b001c93ad6a13";
const PUBLIC_READ = ['read("any")'];
/** The live rows' title and description; the seed's own differ from both. */
const LIVE_TITLE = "Winter Games (live)";
const LIVE_DESCRIPTION = "";
const MISSING = /not found/i;
const INACTIVE = /inactive/i;
const AMBIGUOUS = /2 active/i;
const TAKEN = /another department|no department/i;
const ADOPT_HINT = /--adopt 6adcd79b001c93ad6a13/;
const ADOPT_MISMATCH = /--adopt other-page does not match/;
const ADOPT_NO_PAGE = /--adopt .* no page/;
const LOCALES: WinterGamesLocale[] = ["no", "en"];
/** A publish call, a site revalidation, an admin import, a publish flag. */
const FORBIDDEN_SOURCE = [
  /\bpublishPage\w*\s*\(/,
  /\bunpublishPage\b/,
  /\bnotifyWebsite\b/,
  /from "[^"]*apps\/admin/,
  /is_published\s*:/,
];
/** Columns a draft save may never write. */
const PUBLISH_STATE = ["is_published", "published_at", "published_doc"];
const OWNERSHIP = [
  "campus",
  "campus_id",
  "department",
  "department_id",
  "slug",
];
const DRAFT_COLUMNS = [
  "description",
  "draft_doc",
  "locale",
  "page_id",
  "title",
];

interface FakePage {
  $id: string;
  $permissions: string[];
  campus_id: string | null;
  department_id: string | null;
  slug: string;
  status: "draft" | "published";
  visibility: "public";
}

interface FakeTranslation {
  $id: string;
  $permissions: string[];
  description: string | null;
  is_published: boolean;
  locale: WinterGamesLocale;
  page_id: string;
  published_doc: string | null;
  title: string;
}

/** A `page_drafts` row, keyed by its translation row's id. */
interface FakeDraft {
  $id: string;
  $permissions: string[];
  description: string | null;
  draft_doc: string | null;
  locale: WinterGamesLocale;
  page_id: string;
  title: string | null;
}

interface Seed {
  departments?: (typeof UNIT)[];
  drafts?: FakeDraft[];
  pages?: FakePage[];
  translations?: FakeTranslation[];
}

interface QueryJson {
  attribute?: string;
  method: string;
  values: unknown[];
}

interface DbWrite {
  data: Record<string, unknown>;
  method: string;
  /** Whether a permissions argument was passed at all. */
  permissionsPassed: boolean;
  rowId: string;
  tableId: string;
}

type Row = Record<string, unknown> & { $id: string };

/**
 * An in-memory `app` database with the positional TablesDB methods the seed
 * and the page builder call. Every write is recorded; it is applied only when
 * `allowWrites` is set (the real page builder's tests), and otherwise refused,
 * because the seed itself must write only through the page builder.
 */
function makeDb(seed: Seed, { allowWrites }: { allowWrites: boolean }) {
  const tables: Record<string, Row[]> = {
    departments: structuredClone(seed.departments ?? [UNIT]),
    page_drafts: structuredClone(seed.drafts ?? []) as unknown as Row[],
    page_translations: structuredClone(
      seed.translations ?? []
    ) as unknown as Row[],
    pages: structuredClone(seed.pages ?? []) as unknown as Row[],
  };
  const writes: DbWrite[] = [];
  let clock = 0;
  const rowsOf = (tableId: string): Row[] => {
    const rows = tables[tableId];
    if (!rows) {
      throw new Error(`unexpected table ${tableId}`);
    }
    return rows;
  };
  const write =
    (method: string) =>
    (...args: unknown[]) => {
      const [, tableId, rowId, data, permissions] = args as [
        string,
        string,
        string,
        Record<string, unknown> | undefined,
        string[] | undefined,
      ];
      writes.push({
        data: structuredClone(data ?? {}),
        method,
        permissionsPassed: args.length > 4,
        rowId,
        tableId,
      });
      if (!allowWrites || method === "deleteRow") {
        return Promise.reject(new Error(`db.${method} must not be called`));
      }
      const rows = rowsOf(tableId);
      let row = rows.find((r) => r.$id === rowId);
      if (!row) {
        if (method === "updateRow") {
          return Promise.reject(new Error(`${tableId}/${rowId} not found`));
        }
        row = { $id: rowId, $permissions: [] };
        rows.push(row);
      }
      Object.assign(row, data);
      if (permissions !== undefined) {
        row.$permissions = permissions;
      }
      clock += 1;
      row.$updatedAt = `t${clock}`;
      return Promise.resolve(structuredClone(row));
    };
  const db = {
    createRow: write("createRow"),
    deleteRow: write("deleteRow"),
    getRow: (_database: string, tableId: string, rowId: string) => {
      const row = rowsOf(tableId).find((r) => r.$id === rowId);
      return row
        ? Promise.resolve(structuredClone(row))
        : Promise.reject(new Error(`${tableId}/${rowId} not found`));
    },
    listRows: (_database: string, tableId: string, queries: string[] = []) => {
      const filters = queries
        .map((q) => JSON.parse(q) as QueryJson)
        .filter((q) => q.method === "equal");
      const rows = rowsOf(tableId).filter((row) =>
        filters.every((f) => f.values.includes(row[f.attribute ?? ""]))
      );
      return Promise.resolve({
        rows: structuredClone(rows),
        total: rows.length,
      });
    },
    updateRow: write("updateRow"),
    upsertRow: write("upsertRow"),
  };
  return {
    db,
    drafts: tables.page_drafts as unknown as FakeDraft[],
    pages: tables.pages as unknown as FakePage[],
    translations: tables.page_translations as unknown as FakeTranslation[],
    writes,
  };
}

type FakeDb = ReturnType<typeof makeDb>;
type SaveDraftCall = Parameters<SeedDeps["pages"]["savePageDraft"]>[0] & {
  slugConflict?: string;
};
type TranslationDraftCall = Parameters<
  SeedDeps["pages"]["savePageTranslationDraft"]
>[0];

/**
 * The seed over fake page-builder helpers that mirror the real write rules:
 * a create starts an unpublished draft row with no permissions, an update
 * writes the ownership columns only, and a draft write touches only the
 * draft, title and description (a new translation row starts unpublished).
 */
function makeBackend(seed: Seed = {}) {
  const store = makeDb(seed, { allowWrites: false });
  const { drafts, pages, translations } = store;
  const calls = {
    savePageDraft: [] as SaveDraftCall[],
    savePageTranslationDraft: [] as TranslationDraftCall[],
  };

  const writeDraft = (pageId: string, doc: PageDoc, locale: string) => {
    const draft = {
      description: doc.meta.description ?? null,
      draft_doc: JSON.stringify(doc),
      title: doc.meta.title,
    };
    let row = translations.find(
      (t) => t.page_id === pageId && t.locale === locale
    );
    if (!row) {
      row = {
        $id: `tr-${locale}`,
        $permissions: [],
        description: draft.description,
        is_published: false,
        locale: locale as WinterGamesLocale,
        page_id: pageId,
        published_doc: null,
        title: draft.title,
      };
      translations.push(row);
    }
    // The draft goes to its own row; the translation row is not written.
    const stored = drafts.find((d) => d.$id === row.$id);
    if (stored) {
      Object.assign(stored, draft);
      return;
    }
    drafts.push({
      ...draft,
      $id: row.$id,
      $permissions: [],
      locale: locale as WinterGamesLocale,
      page_id: pageId,
    });
  };

  const pagesApi: SeedDeps["pages"] = {
    savePageDraft: (params) => {
      calls.savePageDraft.push(structuredClone(params));
      const doc = params.doc as PageDoc;
      const ownership = {
        campus_id: params.campusId,
        department_id: doc.meta.department || null,
        slug: doc.meta.slug,
      };
      let pageId: string;
      if (params.id === null) {
        pageId = CREATED_PAGE_ID;
        pages.push({
          ...ownership,
          $id: pageId,
          $permissions: [],
          status: "draft",
          visibility: "public",
        });
      } else {
        pageId = params.id;
        const page = pages.find((p) => p.$id === pageId);
        if (!page) {
          return Promise.reject(new Error("Page not found"));
        }
        Object.assign(page, ownership);
      }
      writeDraft(pageId, doc, params.locale);
      return Promise.resolve({ pageId, slug: doc.meta.slug });
    },
    savePageTranslationDraft: (params) => {
      calls.savePageTranslationDraft.push(structuredClone(params));
      if (!pages.some((p) => p.$id === params.id)) {
        return Promise.reject(new Error("Page not found"));
      }
      writeDraft(params.id, params.doc as PageDoc, params.locale);
      return Promise.resolve({});
    },
  };

  const lines: string[] = [];
  const deps: SeedDeps = {
    buildDoc: winterGamesDoc,
    db: store.db as unknown as SeedDeps["db"],
    log: (line) => lines.push(line),
    pages: pagesApi,
  };
  const writeCount = () =>
    store.writes.length +
    calls.savePageDraft.length +
    calls.savePageTranslationDraft.length;

  return {
    calls,
    deps,
    drafts,
    lines,
    pages,
    translations,
    writeCount,
    writes: store.writes,
  };
}

function boundPage(overrides: Partial<FakePage> = {}): FakePage {
  return {
    $id: "page-existing",
    $permissions: [],
    campus_id: "5",
    department_id: UNIT.$id,
    slug: SEED_SLUG,
    status: "draft",
    visibility: "public",
    ...overrides,
  };
}

/** The live page as production has it: published, public, unbound. */
function livePage(overrides: Partial<FakePage> = {}): FakePage {
  return {
    $id: LIVE_PAGE_ID,
    $permissions: [...PUBLIC_READ],
    campus_id: null,
    department_id: null,
    slug: SEED_SLUG,
    status: "published",
    visibility: "public",
    ...overrides,
  };
}

function liveDoc(locale: WinterGamesLocale): string {
  return JSON.stringify({
    meta: {
      campus: "",
      department: "",
      description: "",
      slug: SEED_SLUG,
      status: "published",
      title: "Winter Games",
    },
    sections: [{ columns: [{ blocks: [] }], id: `s-live-${locale}` }],
    version: 2,
  });
}

function liveTranslations(): FakeTranslation[] {
  return LOCALES.map((locale) => ({
    $id: `tr-live-${locale}`,
    $permissions: [...PUBLIC_READ],
    description: LIVE_DESCRIPTION,
    is_published: true,
    locale,
    page_id: LIVE_PAGE_ID,
    published_doc: liveDoc(locale),
    title: LIVE_TITLE,
  }));
}

function liveDrafts(): FakeDraft[] {
  return LOCALES.map((locale) => ({
    $id: `tr-live-${locale}`,
    $permissions: [],
    description: LIVE_DESCRIPTION,
    draft_doc: liveDoc(locale),
    locale,
    page_id: LIVE_PAGE_ID,
    title: LIVE_TITLE,
  }));
}

/** The stored draft document of a translation row, from the draft table. */
function draftOf(drafts: FakeDraft[], translationId: string): unknown {
  return JSON.parse(
    drafts.find((d) => d.$id === translationId)?.draft_doc ?? "null"
  );
}

function liveSeed(overrides: Partial<FakePage> = {}): Seed {
  return {
    drafts: liveDrafts(),
    pages: [livePage(overrides)],
    translations: liveTranslations(),
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function counts(locale: WinterGamesLocale): string {
  const { sections } = winterGamesDoc(locale);
  const blocks = sections
    .flatMap((s) => s.columns)
    .reduce((n, c) => n + c.blocks.length, 0);
  return `${sections.length} sections, ${blocks} blocks`;
}

function expectedDoc(locale: WinterGamesLocale): PageDoc {
  const doc = winterGamesDoc(locale);
  doc.meta.department = UNIT.$id;
  return doc;
}

/** Our draft as written into an existing row: that row's meta kept. */
function keptMetaDoc(
  locale: WinterGamesLocale,
  title: string,
  description: string | null
): PageDoc {
  const doc = expectedDoc(locale);
  const { description: _seeded, ...meta } = doc.meta;
  doc.meta =
    description === null ? { ...meta, title } : { ...meta, description, title };
  return doc;
}

function writtenKeys(write: DbWrite): string[] {
  return Object.keys(write.data).sort();
}

describe("the unit", () => {
  it("stops with no writes when the unit is missing", async () => {
    for (const write of [false, true]) {
      const backend = makeBackend({ departments: [] });
      const outcome = await runSeed(backend.deps, { write });
      expect(outcome.status).toBe("aborted");
      expect(outcome.status === "aborted" && outcome.reason).toMatch(MISSING);
      expect(backend.writeCount()).toBe(0);
    }
  });

  it("stops with no writes when the unit is inactive (false or null)", async () => {
    for (const active of [false, null]) {
      const backend = makeBackend({ departments: [{ ...UNIT, active }] });
      const outcome = await runSeed(backend.deps, { write: true });
      expect(outcome.status).toBe("aborted");
      expect(outcome.status === "aborted" && outcome.reason).toMatch(INACTIVE);
      expect(backend.writeCount()).toBe(0);
    }
  });

  it("aborts with no writes when two active units match", async () => {
    const backend = makeBackend({
      departments: [UNIT, { ...UNIT, $id: "1008" }],
    });
    const outcome = await runSeed(backend.deps, { write: true });
    expect(outcome.status).toBe("aborted");
    expect(outcome.status === "aborted" && outcome.reason).toMatch(AMBIGUOUS);
    expect(backend.writeCount()).toBe(0);
  });

  it("ignores a unit on another campus or with another slug", async () => {
    const backend = makeBackend({
      departments: [
        { ...UNIT, $id: "2001", campus_id: "1" },
        { ...UNIT, $id: "2002", slug: "wintergames-2" },
      ],
    });
    const outcome = await runSeed(backend.deps, { write: true });
    expect(outcome.status).toBe("aborted");
    expect(backend.writeCount()).toBe(0);
  });
});

describe("the page row", () => {
  it("aborts with no writes when the page is bound to another department", async () => {
    const backend = makeBackend({
      pages: [boundPage({ department_id: "999" })],
    });
    const outcome = await runSeed(backend.deps, { write: true });
    expect(outcome.status).toBe("aborted");
    expect(outcome.status === "aborted" && outcome.reason).toMatch(TAKEN);
    expect(backend.writeCount()).toBe(0);
  });

  it("aborts with no writes when the page has no department and no --adopt", async () => {
    for (const department_id of [null, ""]) {
      const backend = makeBackend(liveSeed({ department_id }));
      const outcome = await runSeed(backend.deps, { write: true });
      expect(outcome.status).toBe("aborted");
      const reason = outcome.status === "aborted" ? outcome.reason : "";
      expect(reason).toMatch(TAKEN);
      expect(reason).toMatch(ADOPT_HINT);
      expect(backend.writeCount()).toBe(0);
    }
  });

  it("aborts with no writes when --adopt names another page id", async () => {
    const backend = makeBackend(liveSeed());
    const outcome = await runSeed(backend.deps, {
      adopt: "other-page",
      write: true,
    });
    expect(outcome.status).toBe("aborted");
    expect(outcome.status === "aborted" && outcome.reason).toMatch(
      ADOPT_MISMATCH
    );
    expect(backend.writeCount()).toBe(0);
  });

  it("aborts with no writes when --adopt names a page of another department", async () => {
    const backend = makeBackend(liveSeed({ department_id: "999" }));
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });
    expect(outcome.status).toBe("aborted");
    expect(outcome.status === "aborted" && outcome.reason).toMatch(TAKEN);
    expect(backend.writeCount()).toBe(0);
  });

  it("aborts with no writes when --adopt is given and there is no page", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });
    expect(outcome.status).toBe("aborted");
    expect(outcome.status === "aborted" && outcome.reason).toMatch(
      ADOPT_NO_PAGE
    );
    expect(backend.writeCount()).toBe(0);
  });
});

describe("a fresh run", () => {
  it("creates one page bound to the unit, plus the no and en drafts", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, { write: true });

    expect(outcome.status).toBe("written");
    expect(backend.writes).toEqual([]);
    expect(backend.calls.savePageDraft).toHaveLength(1);
    const [create] = backend.calls.savePageDraft;
    expect(create?.id).toBeNull();
    expect(create?.locale).toBe("no");
    expect(create?.campusId).toBe(NATIONAL_CAMPUS_ID);
    expect(create?.slugConflict).toBe("fail");
    expect(create?.doc.meta.department).toBe(UNIT.$id);
    expect(create?.doc.meta.slug).toBe(SEED_SLUG);
    expect(create?.doc.meta.status).toBe("draft");

    expect(backend.calls.savePageTranslationDraft).toHaveLength(1);
    const [en] = backend.calls.savePageTranslationDraft;
    expect(en?.id).toBe(CREATED_PAGE_ID);
    expect(en?.locale).toBe("en");
    expect(en?.doc.meta.department).toBe(UNIT.$id);

    expect(backend.pages).toEqual([
      {
        $id: CREATED_PAGE_ID,
        $permissions: [],
        campus_id: "5",
        department_id: UNIT.$id,
        slug: SEED_SLUG,
        status: "draft",
        visibility: "public",
      },
    ]);
    expect(backend.translations).toHaveLength(2);
    for (const locale of LOCALES) {
      const row = backend.translations.find((t) => t.locale === locale);
      expect(row?.is_published).toBe(false);
      expect(row?.published_doc).toBeNull();
      expect(draftOf(backend.drafts, row?.$id ?? "")).toEqual(
        expectedDoc(locale)
      );
      expect(row).not.toHaveProperty("draft_doc");
    }
  });

  it("reads the page back and reports it verified", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, { write: true });
    if (outcome.status !== "written") {
      throw new Error(`expected a write, got ${outcome.status}`);
    }
    expect(outcome.problems).toEqual([]);
    const { readBack } = outcome;
    expect(readBack.pageId).toBe(CREATED_PAGE_ID);
    expect(readBack.slug).toBe(SEED_SLUG);
    expect(readBack.departmentId).toBe(UNIT.$id);
    expect(readBack.campusId).toBe("5");
    expect(readBack.status).toBe("draft");
    for (const locale of LOCALES) {
      expect(readBack.translations[locale]?.isPublished).toBe(false);
      expect(readBack.translations[locale]?.publishedHash).toBeNull();
      expect(readBack.translations[locale]?.draft).not.toBeNull();
    }
    const printed = backend.lines.join("\n");
    expect(printed).toContain(CREATED_PAGE_ID);
    expect(printed).toContain("is_published=false");
    expect(printed).toContain("VERIFIED");
  });
});

describe("a re-run", () => {
  it("updates the two drafts only", async () => {
    const backend = makeBackend();
    await runSeed(backend.deps, { write: true });
    const pagesBefore = structuredClone(backend.pages);

    const outcome = await runSeed(backend.deps, { write: true });

    expect(outcome.status).toBe("written");
    expect(outcome.status === "written" && outcome.problems).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.calls.savePageDraft).toHaveLength(1);
    const reRun = backend.calls.savePageTranslationDraft.slice(1);
    expect(reRun.map((c) => [c.id, c.locale])).toEqual([
      [CREATED_PAGE_ID, "no"],
      [CREATED_PAGE_ID, "en"],
    ]);
    expect(backend.pages).toEqual(pagesBefore);
    expect(backend.translations).toHaveLength(2);
  });

  it("updates an existing page bound to the unit and creates a missing locale's draft", async () => {
    const backend = makeBackend({
      pages: [boundPage()],
      translations: [
        {
          $id: "tr-no-old",
          $permissions: [],
          description: null,
          is_published: false,
          locale: "no",
          page_id: "page-existing",
          published_doc: null,
          title: "Old",
        },
      ],
    });
    const outcome = await runSeed(backend.deps, { write: true });

    expect(outcome.status).toBe("written");
    expect(outcome.status === "written" && outcome.problems).toEqual([]);
    expect(backend.calls.savePageDraft).toHaveLength(0);
    expect(
      backend.calls.savePageTranslationDraft.map((c) => [c.id, c.locale])
    ).toEqual([
      ["page-existing", "no"],
      ["page-existing", "en"],
    ]);
    expect(backend.translations.map((t) => [t.$id, t.locale])).toEqual([
      ["tr-no-old", "no"],
      ["tr-en", "en"],
    ]);
    const [no, en] = backend.translations;
    expect(no?.title).toBe("Old");
    expect(no?.description).toBeNull();
    expect(draftOf(backend.drafts, no?.$id ?? "")).toEqual(
      keptMetaDoc("no", "Old", null)
    );
    expect(draftOf(backend.drafts, en?.$id ?? "")).toEqual(expectedDoc("en"));
    for (const t of backend.translations) {
      expect(t.is_published).toBe(false);
    }
  });
});

describe("adopting the unbound live page", () => {
  it("binds it once and replaces both drafts, leaving the published documents alone", async () => {
    const backend = makeBackend(liveSeed());
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });

    expect(outcome.status).toBe("written");
    expect(outcome.status === "written" && outcome.problems).toEqual([]);
    expect(backend.writes).toEqual([]);
    expect(backend.calls.savePageDraft).toHaveLength(1);
    const [bind] = backend.calls.savePageDraft;
    expect(bind?.id).toBe(LIVE_PAGE_ID);
    expect(bind?.campusId).toBe(NATIONAL_CAMPUS_ID);
    expect(bind?.locale).toBe("no");
    expect(bind?.doc.meta.department).toBe(UNIT.$id);
    expect(bind?.doc.meta.slug).toBe(SEED_SLUG);
    expect(
      backend.calls.savePageTranslationDraft.map((c) => [c.id, c.locale])
    ).toEqual([[LIVE_PAGE_ID, "en"]]);

    expect(backend.pages).toEqual([
      livePage({ campus_id: "5", department_id: UNIT.$id }),
    ]);
    expect(backend.translations).toHaveLength(2);
    for (const t of backend.translations) {
      expect(t.is_published).toBe(true);
      expect(t.published_doc).toBe(liveDoc(t.locale));
      expect(t.$permissions).toEqual(PUBLIC_READ);
      expect(t.title).toBe(LIVE_TITLE);
      expect(t.description).toBe(LIVE_DESCRIPTION);
      expect(draftOf(backend.drafts, t.$id)).toEqual(
        keptMetaDoc(t.locale, LIVE_TITLE, LIVE_DESCRIPTION)
      );
    }
    expect(bind?.doc.meta.title).toBe(LIVE_TITLE);
    expect(bind?.doc.meta.description).toBe(LIVE_DESCRIPTION);
  });

  it("expects the status and publish flags as they were, and reports them", async () => {
    const backend = makeBackend(liveSeed());
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });
    if (outcome.status !== "written") {
      throw new Error(`expected a write, got ${outcome.status}`);
    }
    expect(outcome.readBack.status).toBe("published");
    for (const locale of LOCALES) {
      expect(outcome.readBack.translations[locale]?.isPublished).toBe(true);
      expect(outcome.readBack.translations[locale]?.publishedHash).toBe(
        sha256(liveDoc(locale))
      );
    }
    const printed = backend.lines.join("\n");
    expect(printed).toContain("status         published");
    expect(printed).toContain("is_published=true");
    expect(printed).toContain("unchanged");
    expect(printed).toContain("VERIFIED");
  });

  it("is an ordinary drafts-only re-run once the page is bound", async () => {
    const backend = makeBackend(liveSeed());
    const options = { adopt: LIVE_PAGE_ID, write: true };
    await runSeed(backend.deps, options);
    const pagesBefore = structuredClone(backend.pages);

    const outcome = await runSeed(backend.deps, options);

    expect(outcome.status).toBe("written");
    expect(outcome.status === "written" && outcome.plan.action).toBe("update");
    expect(outcome.status === "written" && outcome.problems).toEqual([]);
    expect(backend.calls.savePageDraft).toHaveLength(1);
    expect(backend.calls.savePageTranslationDraft).toHaveLength(3);
    expect(backend.pages).toEqual(pagesBefore);
  });

  it("reports loudly when a published document changes during the run", async () => {
    const backend = makeBackend(liveSeed());
    const { savePageTranslationDraft } = backend.deps.pages;
    backend.deps.pages.savePageTranslationDraft = async (params) => {
      const result = await savePageTranslationDraft(params);
      const row = backend.translations.find((t) => t.locale === params.locale);
      if (row) {
        row.published_doc = "{}";
      }
      return result;
    };
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });
    if (outcome.status !== "written") {
      throw new Error(`expected a write, got ${outcome.status}`);
    }
    expect(outcome.problems).toContain(
      `PUBLISHED DOCUMENT CHANGED: en sha256 was ${sha256(liveDoc("en"))}, is now ${sha256("{}")}`
    );
    const printed = backend.lines.join("\n");
    expect(printed).toContain("!!! ERROR: WHAT THE LIVE PAGE SHOWS CHANGED");
    expect(printed).toContain("CHECK FAILED");
  });

  it("reports loudly when the live title or description changes during the run", async () => {
    const backend = makeBackend(liveSeed());
    const { savePageTranslationDraft } = backend.deps.pages;
    backend.deps.pages.savePageTranslationDraft = async (params) => {
      const result = await savePageTranslationDraft(params);
      const row = backend.translations.find((t) => t.locale === params.locale);
      if (row) {
        row.description = "changed";
      }
      return result;
    };
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: true,
    });
    if (outcome.status !== "written") {
      throw new Error(`expected a write, got ${outcome.status}`);
    }
    expect(outcome.problems).toEqual([
      'LIVE META CHANGED: en description was "", is now "changed"',
    ]);
    const printed = backend.lines.join("\n");
    expect(printed).toContain("!!! ERROR: WHAT THE LIVE PAGE SHOWS CHANGED");
    expect(printed).toContain("live meta CHANGED");
  });
});

describe("over the real page builder", () => {
  const publishPage = spyOn(pageBuilder, "publishPage");
  const unpublishPage = spyOn(pageBuilder, "unpublishPage");
  const clearPageTheme = spyOn(pageBuilder, "clearPageTheme");
  const syncSharedDraftMeta = spyOn(pageBuilder, "syncSharedDraftMeta");
  const publishHelpers = [
    publishPage,
    unpublishPage,
    clearPageTheme,
    syncSharedDraftMeta,
  ];

  it("adopting writes the ownership columns and the drafts, nothing of the publish state", async () => {
    const store = makeDb(liveSeed(), { allowWrites: true });
    currentDb = store.db;
    const deps = await loadDeps(() => undefined);
    const outcome = await runSeed(deps, { adopt: LIVE_PAGE_ID, write: true });

    expect(outcome.status).toBe("written");
    expect(outcome.status === "written" && outcome.problems).toEqual([]);

    const pageWrites = store.writes.filter((w) => w.tableId === "pages");
    expect(pageWrites).toHaveLength(1);
    const [bind] = pageWrites;
    expect(bind?.method).toBe("updateRow");
    expect(bind?.rowId).toBe(LIVE_PAGE_ID);
    expect(bind?.permissionsPassed).toBe(false);
    expect(bind && writtenKeys(bind)).toEqual(OWNERSHIP);
    expect(bind?.data.department_id).toBe(UNIT.$id);
    expect(bind?.data.campus_id).toBe("5");

    const draftWrites = store.writes.filter((w) => w.tableId === "page_drafts");
    // The drafts go to the draft table, keyed by the translation row's id;
    // the translation rows themselves are not written.
    expect(draftWrites.map((w) => [w.method, w.rowId])).toEqual([
      ["upsertRow", "tr-live-no"],
      ["upsertRow", "tr-live-en"],
    ]);
    for (const w of draftWrites) {
      expect(w.permissionsPassed).toBe(true);
      expect(writtenKeys(w)).toEqual(DRAFT_COLUMNS);
      // The page builder always writes these two; the seed hands it the
      // stored values, so the live <title> and meta description stay.
      expect(w.data.title).toBe(LIVE_TITLE);
      expect(w.data.description).toBe(LIVE_DESCRIPTION);
    }
    expect(store.writes.map((w) => w.tableId).sort()).toEqual([
      "page_drafts",
      "page_drafts",
      "pages",
    ]);

    const [page] = store.pages;
    expect(page?.status).toBe("published");
    expect(page?.$permissions).toEqual(PUBLIC_READ);
    for (const t of store.translations) {
      expect(t.is_published).toBe(true);
      expect(t.published_doc).toBe(liveDoc(t.locale));
      expect(t.$permissions).toEqual(PUBLIC_READ);
      expect(t.title).toBe(LIVE_TITLE);
      expect(t.description).toBe(LIVE_DESCRIPTION);
    }
    for (const helper of publishHelpers) {
      expect(helper).not.toHaveBeenCalled();
    }
  });

  it("a fresh run and a re-run never publish", async () => {
    const store = makeDb({}, { allowWrites: true });
    currentDb = store.db;
    const deps = await loadDeps(() => undefined);
    const first = await runSeed(deps, { write: true });
    const second = await runSeed(deps, { write: true });

    expect(first.status === "written" && first.problems).toEqual([]);
    expect(second.status === "written" && second.problems).toEqual([]);
    expect(store.pages).toHaveLength(1);
    expect(store.pages[0]?.status).toBe("draft");
    expect(store.translations).toHaveLength(2);
    for (const w of store.writes) {
      expect(w.data.status ?? "draft").toBe("draft");
      expect(w.data.is_published ?? false).toBe(false);
      expect(w.data.published_doc).toBeUndefined();
      expect(w.data.published_at).toBeUndefined();
    }
    // The re-run's writes are drafts only.
    const reRun = store.writes.slice(-2);
    for (const w of reRun) {
      expect(w.tableId).toBe("page_drafts");
      expect(w.method).toBe("upsertRow");
      expect(PUBLISH_STATE.some((key) => key in w.data)).toBe(false);
    }
    for (const helper of publishHelpers) {
      expect(helper).not.toHaveBeenCalled();
    }
  });
});

describe("never publishes", () => {
  it("has no publish call, revalidation or admin action in its source", () => {
    const source = readFileSync(new URL("seed-draft.ts", import.meta.url), {
      encoding: "utf8",
    });
    for (const pattern of FORBIDDEN_SOURCE) {
      expect(source).not.toMatch(pattern);
    }
  });
});

describe("a dry run", () => {
  it("plans a create and writes nothing", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, { write: false });
    expect(outcome.status).toBe("planned");
    expect(outcome.status === "planned" && outcome.plan.action).toBe("create");
    expect(backend.writeCount()).toBe(0);
    const printed = backend.lines.join("\n");
    expect(printed).toContain(UNIT.$id);
    expect(printed).toContain(SEED_SLUG);
    for (const locale of LOCALES) {
      expect(printed).toContain(`${locale}: ${counts(locale)}`);
    }
  });

  it("plans an update of an existing bound page and writes nothing", async () => {
    const backend = makeBackend({ pages: [boundPage()] });
    const outcome = await runSeed(backend.deps, { write: false });
    expect(outcome.status).toBe("planned");
    expect(outcome.status === "planned" && outcome.plan.action).toBe("update");
    expect(outcome.status === "planned" && outcome.plan.pageId).toBe(
      "page-existing"
    );
    expect(backend.writeCount()).toBe(0);
  });

  it("plans an adoption with the published hashes and writes nothing", async () => {
    const backend = makeBackend(liveSeed());
    const outcome = await runSeed(backend.deps, {
      adopt: LIVE_PAGE_ID,
      write: false,
    });
    expect(outcome.status).toBe("planned");
    expect(outcome.status === "planned" && outcome.plan.action).toBe("adopt");
    expect(backend.writeCount()).toBe(0);
    const printed = backend.lines.join("\n");
    expect(printed).toContain("ADOPT");
    expect(printed).toContain("status published");
    expect(printed).toContain(
      `live meta unchanged: row title ${JSON.stringify(LIVE_TITLE)}`
    );
    for (const locale of LOCALES) {
      expect(printed).toContain(`sha256 ${sha256(liveDoc(locale))}`);
    }
  });
});

describe("arguments", () => {
  it("reads --write and --adopt <pageId>", () => {
    expect(parseArgs([])).toEqual({ adopt: null, write: false });
    expect(parseArgs(["--adopt", LIVE_PAGE_ID, "--write"])).toEqual({
      adopt: LIVE_PAGE_ID,
      write: true,
    });
  });

  it("refuses --adopt without an id, and unknown arguments", () => {
    expect(parseArgs(["--adopt"])).toHaveProperty("error");
    expect(parseArgs(["--adopt", "--write"])).toHaveProperty("error");
    expect(parseArgs(["--wirte"])).toHaveProperty("error");
  });
});
