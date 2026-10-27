import { describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";
import type {
  PageEditorLoadResult,
  PageTranslationMap,
} from "@repo/api/page-builder";
import type { PageDoc } from "@repo/editor/types";
import {
  type WinterGamesLocale,
  winterGamesDoc,
} from "../../apps/web/src/app/(public)/design-system/winter-games/doc";
import type { SeedDeps } from "./seed-draft";

// `server-only` (the sanitizer imports it) throws outside a react-server
// build, which a test is not. Registered before the script is loaded.
mock.module("server-only", () => ({}));
const { loadDeps, NATIONAL_CAMPUS_ID, runSeed, SEED_SLUG } = await import(
  "./seed-draft"
);

const UNIT = {
  $id: "1007",
  Name: "Wintergames",
  active: true as boolean | null,
  campus_id: "5",
  slug: "wintergames" as string | null,
};

const CREATED_PAGE_ID = "page-wg";
const MISSING = /not found/i;
const INACTIVE = /inactive/i;
const AMBIGUOUS = /2 active/i;
const TAKEN = /another department|no department/i;
const LOCALES: WinterGamesLocale[] = ["no", "en"];
/** A publish call, a site revalidation, an admin import, a publish flag. */
const FORBIDDEN_SOURCE = [
  /\bpublishPage\w*\s*\(/,
  /\bunpublishPage\b/,
  /\bnotifyWebsite\b/,
  /from "[^"]*apps\/admin/,
  /is_published\s*:/,
];

interface FakePage {
  $id: string;
  campus_id: string | null;
  department_id: string | null;
  slug: string;
  status: "draft" | "published";
  visibility: "public";
}

interface FakeTranslation {
  $id: string;
  description: string | null;
  draft_doc: string | null;
  is_published: boolean;
  locale: WinterGamesLocale;
  page_id: string;
  published_doc: string | null;
  title: string;
}

interface Seed {
  departments?: (typeof UNIT)[];
  pages?: FakePage[];
  translations?: FakeTranslation[];
}

interface QueryJson {
  attribute?: string;
  method: string;
  values: unknown[];
}

/**
 * An in-memory stand-in for the `app` database and the page-builder helpers
 * the seed is allowed to use. The page-builder fakes mirror the real write
 * rules (a create starts unpublished, a translation write touches only the
 * draft, title and description). Every db write method is a recorder: the
 * seed must write only through the page builder.
 */
function makeBackend(seed: Seed = {}) {
  const departments = structuredClone(seed.departments ?? [UNIT]);
  const pages = structuredClone(seed.pages ?? []);
  const translations = structuredClone(seed.translations ?? []);
  const calls = {
    dbWrites: [] as string[],
    savePageDraft: [] as Parameters<SeedDeps["pages"]["savePageDraft"]>[0][],
    savePageTranslationDraft: [] as Parameters<
      SeedDeps["pages"]["savePageTranslationDraft"]
    >[0][],
  };
  const tables: Record<string, Record<string, unknown>[]> = {
    departments,
    page_translations: translations as unknown as Record<string, unknown>[],
    pages: pages as unknown as Record<string, unknown>[],
  };
  const recordWrite = (name: string) => () => {
    calls.dbWrites.push(name);
    return Promise.reject(new Error(`db.${name} must not be called`));
  };

  const db = {
    listRows: (_database: string, tableId: string, queries: string[] = []) => {
      const filters = queries
        .map((q) => JSON.parse(q) as QueryJson)
        .filter((q) => q.method === "equal");
      const rows = (tables[tableId] ?? []).filter((row) =>
        filters.every((f) => f.values.includes(row[f.attribute ?? ""]))
      );
      return Promise.resolve({
        rows: structuredClone(rows),
        total: rows.length,
      });
    },
    createRow: recordWrite("createRow"),
    deleteRow: recordWrite("deleteRow"),
    updateRow: recordWrite("updateRow"),
    upsertRow: recordWrite("upsertRow"),
  };

  const writeDraft = (pageId: string, doc: PageDoc, locale: string) => {
    const row = translations.find(
      (t) => t.page_id === pageId && t.locale === locale
    );
    const draft = {
      description: doc.meta.description ?? null,
      draft_doc: JSON.stringify(doc),
      title: doc.meta.title,
    };
    if (row) {
      Object.assign(row, draft);
      return row.$id;
    }
    const $id = `tr-${locale}`;
    translations.push({
      ...draft,
      $id,
      is_published: false,
      locale: locale as WinterGamesLocale,
      page_id: pageId,
      published_doc: null,
    });
    return $id;
  };

  const pagesApi: SeedDeps["pages"] = {
    getPageEditorById: (id) => {
      const page = pages.find((p) => p.$id === id);
      if (!page) {
        return Promise.resolve(null);
      }
      const map: PageTranslationMap = {};
      for (const t of translations.filter((row) => row.page_id === id)) {
        map[t.locale] = {
          description: t.description ?? undefined,
          draftDocument: t.draft_doc ? JSON.parse(t.draft_doc) : null,
          id: t.$id,
          isPublished: t.is_published,
          locale: t.locale,
          publishedAt: null,
          publishedDocument: t.published_doc
            ? JSON.parse(t.published_doc)
            : null,
          title: t.title,
        };
      }
      const result = {
        availableLocales: ["no", "en"],
        page: {
          campusId: page.campus_id,
          departmentId: page.department_id ?? "",
          id: page.$id,
          slug: page.slug,
          status: page.status,
          visibility: page.visibility,
        },
        translations: map,
      } as unknown as PageEditorLoadResult;
      return Promise.resolve(result);
    },
    // The seed's type allows only the create path (`id: null`).
    savePageDraft: (params) => {
      calls.savePageDraft.push(structuredClone(params));
      const doc = params.doc as PageDoc;
      const pageId = CREATED_PAGE_ID;
      pages.push({
        $id: pageId,
        campus_id: params.campusId,
        department_id: doc.meta.department || null,
        slug: doc.meta.slug,
        status: "draft",
        visibility: "public",
      });
      const translationId = writeDraft(pageId, doc, params.locale);
      return Promise.resolve({ pageId, slug: doc.meta.slug, translationId });
    },
    savePageTranslationDraft: (params) => {
      calls.savePageTranslationDraft.push(structuredClone(params));
      if (!pages.some((p) => p.$id === params.id)) {
        return Promise.reject(new Error("Page not found"));
      }
      const translationId = writeDraft(
        params.id,
        params.doc as PageDoc,
        params.locale
      );
      return Promise.resolve({ translationId, updatedAt: "now" });
    },
  };

  const lines: string[] = [];
  const deps: SeedDeps = {
    buildDoc: winterGamesDoc,
    db: db as unknown as SeedDeps["db"],
    log: (line) => lines.push(line),
    pages: pagesApi,
  };
  const writeCount = () =>
    calls.dbWrites.length +
    calls.savePageDraft.length +
    calls.savePageTranslationDraft.length;

  return { calls, db, deps, lines, pages, translations, writeCount };
}

function boundPage(overrides: Partial<FakePage> = {}): FakePage {
  return {
    $id: "page-existing",
    campus_id: "5",
    department_id: UNIT.$id,
    slug: SEED_SLUG,
    status: "draft",
    visibility: "public",
    ...overrides,
  };
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

  it("aborts with no writes when the page has no department", async () => {
    for (const department_id of [null, ""]) {
      const backend = makeBackend({ pages: [boundPage({ department_id })] });
      const outcome = await runSeed(backend.deps, { write: true });
      expect(outcome.status).toBe("aborted");
      expect(outcome.status === "aborted" && outcome.reason).toMatch(TAKEN);
      expect(backend.writeCount()).toBe(0);
    }
  });
});

describe("a fresh run", () => {
  it("creates one page bound to the unit, plus the no and en drafts", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, { write: true });

    expect(outcome.status).toBe("written");
    expect(backend.calls.dbWrites).toEqual([]);
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
      expect(JSON.parse(row?.draft_doc ?? "null")).toEqual(expectedDoc(locale));
    }
  });

  it("reads the page back and reports it verified", async () => {
    const backend = makeBackend();
    const outcome = await runSeed(backend.deps, { write: true });
    if (outcome.status !== "written") {
      throw new Error(`expected a write, got ${outcome.status}`);
    }
    expect(outcome.problems).toEqual([]);
    expect(outcome.readBack).toEqual({
      campusId: "5",
      departmentId: UNIT.$id,
      pageId: CREATED_PAGE_ID,
      slug: SEED_SLUG,
      status: "draft",
      translations: {
        en: { draftPresent: true, isPublished: false },
        no: { draftPresent: true, isPublished: false },
      },
    });
    const printed = backend.lines.join("\n");
    expect(printed).toContain(CREATED_PAGE_ID);
    expect(printed).toContain("is_published=false");
  });
});

describe("a re-run", () => {
  it("updates the two drafts only", async () => {
    const backend = makeBackend();
    await runSeed(backend.deps, { write: true });
    const pagesBefore = structuredClone(backend.pages);

    const outcome = await runSeed(backend.deps, { write: true });

    expect(outcome.status).toBe("written");
    expect(backend.calls.dbWrites).toEqual([]);
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
          description: null,
          draft_doc: null,
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
    for (const t of backend.translations) {
      expect(t.is_published).toBe(false);
      expect(JSON.parse(t.draft_doc ?? "null")).toEqual(expectedDoc(t.locale));
    }
  });
});

describe("never publishes", () => {
  // The real wiring (`loadDeps`), with the page builder and admin client
  // replaced: every export the script could reach for a publish is a spy.
  let current = makeBackend();
  const publishPage = mock(() => Promise.reject(new Error("published")));
  const unpublishPage = mock(() => Promise.reject(new Error("unpublished")));
  mock.module("@repo/api/page-builder", () => ({
    clearPageTheme: mock(() => Promise.reject(new Error("theme"))),
    getPageEditorById: (id: string) => current.deps.pages.getPageEditorById(id),
    publishPage,
    savePageDraft: (
      params: Parameters<SeedDeps["pages"]["savePageDraft"]>[0]
    ) => current.deps.pages.savePageDraft(params),
    savePageTranslationDraft: (
      params: Parameters<SeedDeps["pages"]["savePageTranslationDraft"]>[0]
    ) => current.deps.pages.savePageTranslationDraft(params),
    syncSharedDraftMeta: mock(() => Promise.reject(new Error("sync"))),
    unpublishPage,
  }));
  mock.module("@repo/api/server", () => ({
    createAdminClient: () => Promise.resolve({ db: current.db }),
    createSessionClient: () => Promise.reject(new Error("no session")),
  }));

  it("calls no publish helper on a fresh run and a re-run", async () => {
    current = makeBackend();
    const deps = await loadDeps(() => undefined);
    expect((await runSeed(deps, { write: true })).status).toBe("written");
    expect((await runSeed(deps, { write: true })).status).toBe("written");

    expect(publishPage).not.toHaveBeenCalled();
    expect(unpublishPage).not.toHaveBeenCalled();
    expect(current.calls.savePageDraft).toHaveLength(1);
    expect(current.calls.savePageTranslationDraft).toHaveLength(3);
    const sent = JSON.stringify([
      current.calls.savePageDraft,
      current.calls.savePageTranslationDraft,
    ]);
    expect(sent).not.toContain("is_published");
    expect(sent).not.toContain('"status":"published"');
  });

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
});
