import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  upsertRow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
  createSessionClient: vi.fn(async () => ({ db })),
}));

import {
  archivePage,
  clearPageTheme,
  getPage,
  getPageById,
  getPageEditorById,
  PAGE_DRAFTS_TABLE_ID,
  type PageDoc,
  publishPage,
  savePageDraft,
  savePageTranslationDraft,
  syncSharedDraftMeta,
  unpublishPage,
} from "./page-builder";

const ctx = {
  roles: ["globaladmin"],
  activeCampusId: "os",
  managedCampusIds: [],
  resolvedCampusIds: [],
  userId: "user-1",
};

const doc: PageDoc = {
  meta: {
    title: "Hei",
    slug: "shared-slug",
    department: "dept-1",
    description: "Beskrivelse",
    status: "draft",
  },
  sections: [
    {
      id: "s-1",
      layout: {},
      columns: [
        {
          id: "c-1",
          blocks: [
            { id: "b-1", type: "text", body: [{ type: "p", text: "Hei" }] },
          ],
        },
      ],
    },
  ],
  version: 2,
};

type Row = Record<string, unknown>;

/** A selected column that could carry a draft: a wildcard or a draft column. */
const DRAFT_OR_WILDCARD_COLUMN = /\*|draft_doc|puck_document|draft_document/;

/** Appwrite's answer for a row that does not exist. */
function rowNotFound(): Error {
  return Object.assign(new Error("Row with the requested ID was not found."), {
    code: 404,
    type: "row_not_found",
  });
}

/** The `equal` filters of a request, as `[attribute, values]`. */
function equalFilters(queries: string[]): [string, unknown[]][] {
  return queries.flatMap((query) => {
    const parsed = JSON.parse(query) as {
      attribute?: string;
      method: string;
      values?: unknown[];
    };
    return parsed.method === "equal" && parsed.attribute
      ? [[parsed.attribute, parsed.values ?? []] as [string, unknown[]]]
      : [];
  });
}

/**
 * Answer `listRows` and `getRow` from these rows, by table. A list honours
 * its `equal` filters; a missing row is Appwrite's 404.
 */
function seedTables(tables: Partial<Record<string, Row[]>>) {
  db.listRows.mockImplementation(
    async (_db: string, table: string, queries: string[] = []) => ({
      rows: (tables[table] ?? []).filter((row) =>
        equalFilters(queries).every(([attribute, values]) =>
          values.includes(row[attribute])
        )
      ),
    })
  );
  db.getRow.mockImplementation((_db: string, table: string, id: string) => {
    const row = (tables[table] ?? []).find((candidate) => candidate.$id === id);
    return row ? Promise.resolve(row) : Promise.reject(rowNotFound());
  });
}

/** Every write to one table, in call order per write method. */
function writesTo(table: string) {
  return [
    ...db.updateRow.mock.calls,
    ...db.upsertRow.mock.calls,
    ...db.createRow.mock.calls,
  ]
    .filter((call) => call[1] === table)
    .map(([, , rowId, data, permissions]) => ({ data, permissions, rowId }));
}

/** A write echoes the row id, stamped with the table it went to. */
function echoWrites() {
  const echo = async (_db: string, table: string, id: string) => ({
    $id: id,
    $updatedAt: `${table}@v2`,
  });
  db.upsertRow.mockImplementation(echo);
  db.updateRow.mockImplementation(echo);
}

describe("page builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default for any un-queued listRows call (e.g. the campus/department
    // lookups used to derive row permissions). `mockResolvedValueOnce` queued
    // in individual tests still takes precedence over this default.
    db.listRows.mockResolvedValue({ rows: [] });
    // Default for an un-queued upsert, e.g. the draft row written after the
    // page and translation rows a test queues.
    db.upsertRow.mockImplementation(
      async (_db: string, _table: string, id: string) => ({ $id: id })
    );
  });

  it("loads editor pages with translation relationship rows selected", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "page-1",
          slug: "shared-slug",
          status: "draft",
          visibility: "public",
          department_id: "dept-1",
          campus_id: "os",
          translation_refs: [
            {
              $id: "tr-no",
              $updatedAt: "2026-05-19T00:00:00.000Z",
              locale: "no",
              title: "Hei",
              description: "Beskrivelse",
              draft_doc: JSON.stringify(doc),
              published_doc: null,
              is_published: false,
              published_at: null,
            },
          ],
        },
      ],
    });

    const result = await getPageEditorById("page-1", db);

    expect(db.listRows).toHaveBeenCalledWith(
      "app",
      "pages",
      expect.arrayContaining([expect.stringContaining("select")])
    );
    expect(result?.translations.no?.title).toBe("Hei");
    expect(result?.translations.no?.draftDocument?.meta.slug).toBe(
      "shared-slug"
    );
  });

  it("the public read serves the published document, never the draft", async () => {
    // Legacy translations are is_published with no published_doc. Once
    // opened in the editor they gain a draft_doc, which must stay private.
    const translation = {
      $id: "tr-no",
      locale: "no",
      title: "Hei",
      description: null,
      draft_doc: JSON.stringify(doc),
      published_doc: null,
      is_published: true,
    };
    const row = {
      $id: "page-1",
      slug: "shared-slug",
      status: "published",
      department_id: "dept-1",
      translation_refs: [translation],
    };
    db.listRows.mockResolvedValueOnce({ rows: [row] });

    const draftOnly = await getPage("shared-slug", "no");

    expect(draftOnly?.translation?.$id).toBe("tr-no");
    expect(draftOnly?.doc).toBeNull();

    const published = {
      ...doc,
      meta: { ...doc.meta, title: "Publisert" },
    };
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          ...row,
          translation_refs: [
            { ...translation, published_doc: JSON.stringify(published) },
          ],
        },
      ],
    });

    const result = await getPage("shared-slug", "no");

    expect(result?.doc?.sections).toEqual(published.sections);
  });

  it("creates a page and active locale translation without invalid attributes", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await savePageDraft({ id: null, doc, locale: "no", ctx });

    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.not.objectContaining({ title: expect.anything() }),
      expect.any(Array)
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.not.objectContaining({ slug: expect.anything() }),
      expect.any(Array)
    );
  });

  it("persists canonical ownership relations with their scalar compatibility twins", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await savePageDraft({ id: null, doc, locale: "no", ctx });

    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({
        campus: "os",
        campus_id: "os",
        department: "dept-1",
        department_id: "dept-1",
      }),
      expect.any(Array)
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.objectContaining({ page: "page-1", page_id: "page-1" }),
      expect.any(Array)
    );
  });

  it("uses an explicit campusId override instead of the author-derived campus", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    // ctx.activeCampusId is "os", but the caller (e.g. createUnitPage) knows
    // the correct owning campus and passes it explicitly.
    await savePageDraft({
      id: null,
      doc,
      locale: "no",
      ctx,
      campusId: "bg",
    });

    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({ campus: "bg", campus_id: "bg" }),
      expect.any(Array)
    );
  });

  it("treats an explicit null campusId override as deliberate, not as 'no override'", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    // ctx.activeCampusId is "os" and would normally be used, but a present
    // `campusId: null` (e.g. an existing page's persisted-but-unset campus)
    // must win over that fallback rather than being treated as "absent".
    await savePageDraft({
      id: null,
      doc,
      locale: "no",
      ctx,
      campusId: null,
    });

    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({ campus: null, campus_id: null }),
      expect.any(Array)
    );
  });

  it("increments the slug when a new autosaved page uses an existing slug", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-2" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [{ $id: "page-1", slug: "shared-slug" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await savePageDraft({ id: null, doc, locale: "no", ctx });

    expect(result.slug).toBe("shared-slug-2");
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({ slug: "shared-slug-2" }),
      expect.any(Array)
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      3,
      "app",
      PAGE_DRAFTS_TABLE_ID,
      "tr-no",
      expect.objectContaining({
        draft_doc: expect.stringContaining('"slug":"shared-slug-2"'),
      }),
      []
    );
  });

  it("skips the suffixing resolver on create when slugConflict is 'fail'", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-2" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    // Only the page_translations lookup should run — no slug-uniqueness
    // probe (resolveUniquePageSlug) when slugConflict is "fail".
    db.listRows.mockResolvedValueOnce({ rows: [] });

    const result = await savePageDraft({
      id: null,
      doc,
      locale: "no",
      ctx,
      slugConflict: "fail",
    });

    expect(result.slug).toBe("shared-slug");
    expect(db.listRows).toHaveBeenCalledTimes(1);
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({ slug: "shared-slug" }),
      expect.any(Array)
    );
  });

  it("still suffixes on create when slugConflict is left at its 'suffix' default", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-2" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [{ $id: "page-1", slug: "shared-slug" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await savePageDraft({ id: null, doc, locale: "no", ctx });

    expect(result.slug).toBe("shared-slug-2");
  });

  it("propagates a slug-conflict write error unmodified when slugConflict is 'fail', letting the caller decide what it means", async () => {
    const conflict = Object.assign(new Error("Row already exists"), {
      code: 409,
    });
    db.upsertRow.mockRejectedValueOnce(conflict);

    await expect(
      savePageDraft({ id: null, doc, locale: "no", ctx, slugConflict: "fail" })
    ).rejects.toBe(conflict);

    // No suffix-probe listRows call happened before the failing write —
    // proves the "fail" path truly skipped resolveUniquePageSlug rather than
    // swallowing the conflict some other way.
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("publishing copies the draft document into published_doc", async () => {
    const draftJson = JSON.stringify(doc);
    db.listRows
      .mockResolvedValueOnce({
        rows: [{ $id: "tr-no", draft_doc: draftJson, locale: "no" }],
      })
      .mockResolvedValueOnce({
        rows: [{ $id: "page-1", visibility: "public" }],
      });

    await publishPage({ id: "page-1", updateParentStatus: false });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      expect.objectContaining({ published_doc: draftJson }),
      expect.any(Array)
    );
  });

  it("keeps the published document when the draft row has no document", async () => {
    db.listRows
      .mockResolvedValueOnce({
        rows: [
          {
            $id: "tr-no",
            locale: "no",
            published_doc: '{"live":true}',
            draft_doc: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ $id: "page-1", visibility: "public" }],
      });
    db.getRow.mockResolvedValueOnce({
      $id: "tr-no",
      draft_doc: null,
      title: "T",
      description: null,
    });

    await publishPage({ id: "page-1", updateParentStatus: false });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      expect.objectContaining({ published_doc: '{"live":true}' }),
      expect.any(Array)
    );
  });

  it("refuses to publish when there is neither a draft nor a published document", async () => {
    db.listRows
      .mockResolvedValueOnce({
        rows: [{ $id: "tr-no", locale: "no", draft_doc: null }],
      })
      .mockResolvedValueOnce({
        rows: [{ $id: "page-1", visibility: "public" }],
      });

    await expect(
      publishPage({ id: "page-1", updateParentStatus: false })
    ).rejects.toThrow("Nothing to publish for no");
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("restores the read on other published locales when the page goes live again", async () => {
    db.listRows.mockImplementation((_db: string, table: string) => {
      if (table === "pages") {
        return Promise.resolve({
          rows: [{ $id: "page-1", visibility: "public" }],
        });
      }
      return Promise.resolve({
        rows: [
          { $id: "tr-en", draft_doc: "{}", locale: "en", is_published: false },
          { $id: "tr-nb", locale: "nb", is_published: true },
          { $id: "tr-draft", locale: "xx", is_published: false },
        ],
      });
    });

    await publishPage({ id: "page-1", locale: "en" });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-nb",
      {},
      ['read("any")']
    );
    expect(db.updateRow.mock.calls.some((c) => c[2] === "tr-draft")).toBe(
      false
    );
  });

  it("updates the existing locale's draft instead of creating a duplicate translation", async () => {
    // existing translation lookup (no team lookups remain)
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "tr-no", is_published: false }],
    });

    const result = await savePageDraft({
      id: "page-1",
      doc,
      locale: "no",
      ctx,
    });

    expect(db.upsertRow).toHaveBeenCalledTimes(1);
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      PAGE_DRAFTS_TABLE_ID,
      "tr-no",
      expect.objectContaining({ title: "Hei" }),
      []
    );
    expect(result.translationId).toBe("tr-no");
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("a create starts the page and its translation as unpublished drafts", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await savePageDraft({
      id: null,
      doc: { ...doc, meta: { ...doc.meta, status: "published" } },
      locale: "no",
      ctx,
    });

    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "pages",
      expect.any(String),
      expect.objectContaining({ status: "draft" }),
      []
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.objectContaining({ is_published: false }),
      []
    );
  });

  it("saves a generated locale without mutating the parent page", async () => {
    db.listRows
      .mockResolvedValueOnce({
        rows: [
          {
            $id: "page-1",
            campus_id: "os",
            department_id: "dept-1",
            status: "published",
            visibility: "public",
          },
        ],
      })
      // existing translation lookup
      .mockResolvedValueOnce({ rows: [] });
    db.upsertRow
      .mockResolvedValueOnce({ $id: "tr-en", $updatedAt: "v-1" })
      .mockResolvedValueOnce({ $id: "tr-en", $updatedAt: "v-2" });

    const result = await savePageTranslationDraft({
      doc: {
        ...doc,
        meta: { ...doc.meta, title: "Hello", status: "published" },
      },
      id: "page-1",
      locale: "en",
    });

    // The draft row's version this write produced: auto-translation checks
    // nobody wrote the locale's draft after it before publishing.
    expect(result).toEqual({ translationId: "tr-en", updatedAt: "v-2" });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).toHaveBeenCalledTimes(2);
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      1,
      "app",
      "page_translations",
      expect.any(String),
      expect.objectContaining({
        is_published: false,
        locale: "en",
        page_id: "page-1",
        title: "Hello",
      }),
      expect.any(Array)
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      PAGE_DRAFTS_TABLE_ID,
      "tr-en",
      expect.objectContaining({ locale: "en", title: "Hello" }),
      []
    );
  });
});

/**
 * Only publishPage and unpublishPage change whether a page is live. A save
 * read the rows before a publish or unpublish landed, so anything it wrote
 * about the publish state would undo that publish or unpublish.
 */
describe("saving a draft never writes the publish state", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.listRows.mockResolvedValue({ rows: [] });
    db.upsertRow.mockImplementation(
      async (_db: string, _table: string, id: string) => ({ $id: id })
    );
    db.updateRow.mockImplementation(
      async (_db: string, _table: string, id: string) => ({ $id: id })
    );
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * The keys a write to `pages` or `page_translations` sets, and whether it
   * passed permissions. The draft table holds no publish state.
   */
  const writes = () =>
    [...db.updateRow.mock.calls, ...db.upsertRow.mock.calls]
      .filter(([, table]) => table !== PAGE_DRAFTS_TABLE_ID)
      .map(([, table, , data, permissions]) => ({
        keys: Object.keys(data as object),
        permissions,
        table,
      }));

  it("a save racing a publish leaves the page published", async () => {
    // Read before the publish landed: the translation was not live yet.
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "tr-no", is_published: false }],
    });

    await savePageDraft({
      id: "page-1",
      doc: { ...doc, meta: { ...doc.meta, status: "draft" } },
      locale: "no",
      ctx,
    });

    // The ownership update is the only write outside the draft table.
    expect(writes()).toEqual([
      {
        keys: expect.not.arrayContaining(["status"]),
        permissions: undefined,
        table: "pages",
      },
    ]);
  });

  it("a save racing an unpublish leaves the locale unpublished", async () => {
    // Read before the unpublish landed: the translation was still live.
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "tr-no", is_published: true }],
    });

    await savePageDraft({
      id: "page-1",
      doc: { ...doc, meta: { ...doc.meta, status: "published" } },
      locale: "no",
      ctx,
    });

    for (const write of writes()) {
      expect(write.keys).not.toContain("status");
      expect(write.keys).not.toContain("is_published");
      expect(write.permissions).toBeUndefined();
    }
  });

  it("a translated draft saved over a live locale leaves it live", async () => {
    db.listRows
      .mockResolvedValueOnce({
        rows: [{ $id: "page-1", status: "published", visibility: "public" }],
      })
      .mockResolvedValueOnce({
        rows: [{ $id: "tr-en", is_published: true, locale: "en" }],
      });

    db.upsertRow.mockResolvedValueOnce({ $id: "tr-en", $updatedAt: "v-2" });

    const result = await savePageTranslationDraft({
      doc: { ...doc, meta: { ...doc.meta, title: "Hello" } },
      id: "page-1",
      locale: "en",
    });

    expect(result).toEqual({ translationId: "tr-en", updatedAt: "v-2" });
    // The live row is not written at all: the draft went to its own table.
    expect(writes()).toEqual([]);
  });
});

const PURPLE = { accent: "#c8a2f0", dark: "#3b1c6b" };
const GREEN = { accent: "#8fe3b5", dark: "#0b3d2e" };

const withMeta = (meta: Partial<PageDoc["meta"]>): PageDoc => ({
  ...doc,
  meta: { ...doc.meta, ...meta },
});

/** Exactly the shared meta fields, as the save action passes them. */
const SHARED_PURPLE: Partial<PageDoc["meta"]> = {
  campus: "os",
  department: "dept-1",
  slug: "shared-slug",
  status: "draft",
  theme: PURPLE,
};

/** A translation row with no draft of its own on it. */
function translationRow(locale: "no" | "en", fields: Row = {}): Row {
  return {
    $id: `tr-${locale}`,
    $updatedAt: `tr-${locale}@v1`,
    description: locale === "no" ? "Beskrivelse" : "Hello text",
    draft_doc: null,
    locale,
    page_id: "page-1",
    published_doc: null,
    title: locale === "no" ? "Hei" : "Hello",
    ...fields,
  };
}

/** A locale's row in the draft table, holding `document`. */
function draftRow(
  locale: "no" | "en",
  document: PageDoc,
  fields: Row = {}
): Row {
  return {
    $id: `tr-${locale}`,
    $updatedAt: `draft-${locale}@v1`,
    description: document.meta.description ?? null,
    draft_doc: JSON.stringify(document),
    locale,
    page_id: "page-1",
    title: document.meta.title,
    ...fields,
  };
}

/** The drafts written, with their documents parsed. */
function draftWrites() {
  return writesTo(PAGE_DRAFTS_TABLE_ID).map((write) => ({
    ...write,
    document: JSON.parse(
      (write.data as { draft_doc: string }).draft_doc
    ) as PageDoc,
  }));
}

describe("syncSharedDraftMeta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    echoWrites();
  });

  it("writes the shared meta into every other locale's draft row, and nothing else", async () => {
    const en = withMeta({
      title: "Hello",
      description: "Hello text",
      theme: GREEN,
    });
    seedTables({
      page_translations: [translationRow("no"), translationRow("en")],
      page_drafts: [draftRow("no", doc), draftRow("en", en)],
    });

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(writesTo("page_translations")).toEqual([]);
    const [write, ...others] = draftWrites();
    expect(others).toEqual([]);
    expect(write.rowId).toBe("tr-en");
    // The draft table is service-only.
    expect(write.permissions).toEqual([]);
    expect(write.data).toEqual({
      description: "Hello text",
      draft_doc: expect.any(String),
      locale: "en",
      page_id: "page-1",
      title: "Hello",
    });
    expect(write.document.meta.theme).toEqual(PURPLE);
    expect(write.document.meta.title).toBe("Hello");
    expect(write.document.meta.campus).toBe("os");
    expect(write.document.sections).toEqual(en.sections);
  });

  it("moves a legacy draft into the draft table, with the row's title and description, and leaves the row alone", async () => {
    seedTables({
      page_translations: [
        translationRow("no"),
        translationRow("en", {
          draft_doc: JSON.stringify(withMeta({ title: "Hello", theme: GREEN })),
        }),
      ],
    });

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(writesTo("page_translations")).toEqual([]);
    const [write, ...others] = draftWrites();
    expect(others).toEqual([]);
    expect(write).toMatchObject({
      data: {
        description: "Hello text",
        locale: "en",
        page_id: "page-1",
        title: "Hello",
      },
      permissions: [],
      rowId: "tr-en",
    });
    expect(write.document.meta.theme).toEqual(PURPLE);
    expect(write.document.meta.title).toBe("Hello");
  });

  it("removes a shared field that is undefined, keeps null", async () => {
    seedTables({
      page_translations: [translationRow("en")],
      page_drafts: [draftRow("en", withMeta({ theme: GREEN }))],
    });
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: { ...doc.meta, theme: undefined },
    });
    expect("theme" in draftWrites()[0].document.meta).toBe(false);

    db.upsertRow.mockClear();
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: { ...doc.meta, theme: null },
    });
    expect(draftWrites()[0].document.meta.theme).toBe(null);
  });

  it("creates no row and rewrites no draft that already matches", async () => {
    seedTables({
      page_translations: [translationRow("no"), translationRow("en")],
      // A translation with no draft of its own is left alone.
      page_drafts: [draftRow("no", doc)],
    });
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });

    seedTables({
      page_translations: [translationRow("en")],
      page_drafts: [draftRow("en", withMeta({}))],
    });
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("re-reads the draft row before writing, and merges into what another tab wrote meanwhile", async () => {
    const listed = draftRow("en", withMeta({ title: "Hello", theme: GREEN }));
    const newer = draftRow(
      "en",
      withMeta({ title: "Hello from the other tab", theme: GREEN }),
      { $updatedAt: "draft-en@v2" }
    );
    seedTables({
      page_translations: [translationRow("en")],
      page_drafts: [listed],
    });
    db.getRow.mockResolvedValue(newer);

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(db.getRow).toHaveBeenCalledWith(
      "app",
      PAGE_DRAFTS_TABLE_ID,
      "tr-en"
    );
    const [write, ...others] = draftWrites();
    expect(others).toEqual([]);
    // The newer content is kept, with the shared meta merged in.
    expect(write.document.meta.title).toBe("Hello from the other tab");
    expect(write.document.meta.theme).toEqual(PURPLE);
    expect(write.data).toMatchObject({ title: "Hello from the other tab" });
  });

  it("writes nothing, and warns, when the draft row changes again before the retry", async () => {
    const listed = draftRow("en", withMeta({ title: "Hello", theme: GREEN }));
    seedTables({
      page_translations: [translationRow("en")],
      page_drafts: [listed],
    });
    db.getRow
      .mockResolvedValueOnce({ ...listed, $updatedAt: "draft-en@v2" })
      .mockResolvedValueOnce({ ...listed, $updatedAt: "draft-en@v3" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(db.getRow).toHaveBeenCalledTimes(2);
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("writes once when the draft row is unchanged since it was listed", async () => {
    seedTables({
      page_translations: [translationRow("en")],
      page_drafts: [draftRow("en", withMeta({ theme: GREEN }))],
    });
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });
    expect(db.getRow).toHaveBeenCalledTimes(1);
    expect(draftWrites()).toHaveLength(1);
  });

  it("checks a legacy draft against its translation row's version", async () => {
    seedTables({
      page_translations: [
        translationRow("en", {
          draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
        }),
      ],
    });

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(db.getRow).toHaveBeenCalledWith(
      "app",
      PAGE_DRAFTS_TABLE_ID,
      "tr-en"
    );
    expect(db.getRow).toHaveBeenCalledWith("app", "page_translations", "tr-en");
    expect(draftWrites()).toHaveLength(1);
  });
});

describe("clearPageTheme", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    echoWrites();
  });

  it("strips meta.theme from every locale's draft and published doc, leaving the rest", async () => {
    seedTables({
      page_translations: [
        translationRow("no", {
          // A legacy copy the draft row supersedes.
          draft_doc: JSON.stringify(withMeta({ title: "Stale", theme: GREEN })),
          published_doc: JSON.stringify(withMeta({ theme: null })),
        }),
        translationRow("en", {
          description: null,
          draft_doc: JSON.stringify(withMeta({ title: "Hello", theme: GREEN })),
        }),
      ],
      page_drafts: [draftRow("no", withMeta({ theme: PURPLE }))],
    });

    await clearPageTheme("page-1");

    expect(db.listRows).toHaveBeenCalledWith(
      "app",
      "page_translations",
      expect.arrayContaining([expect.stringContaining("page_id")])
    );
    // Published documents stay on the translation row, without permissions.
    const translationWrites = writesTo("page_translations");
    expect(translationWrites).toHaveLength(1);
    const [published] = translationWrites;
    expect(published.rowId).toBe("tr-no");
    expect(published.permissions).toBeUndefined();
    expect(Object.keys(published.data as object)).toEqual(["published_doc"]);
    const noPublished = JSON.parse(
      (published.data as { published_doc: string }).published_doc
    );
    expect("theme" in noPublished.meta).toBe(false);
    expect(noPublished).toEqual(doc);

    // Drafts go to the draft table: the draft row's, and the legacy one.
    const byRow = Object.fromEntries(
      draftWrites().map((write) => [write.rowId, write])
    );
    expect(Object.keys(byRow).sort()).toEqual(["tr-en", "tr-no"]);
    expect("theme" in byRow["tr-no"].document.meta).toBe(false);
    expect(byRow["tr-no"].document).toEqual(doc);
    expect(byRow["tr-no"].permissions).toEqual([]);
    expect("theme" in byRow["tr-en"].document.meta).toBe(false);
    expect(byRow["tr-en"].document.meta.title).toBe("Hello");
    expect(byRow["tr-en"].data).toMatchObject({
      description: null,
      locale: "en",
      page_id: "page-1",
      title: "Hello",
    });
  });

  it("rewrites nothing when no document holds a theme", async () => {
    seedTables({
      page_translations: [
        translationRow("no", { published_doc: JSON.stringify(doc) }),
        translationRow("en", { draft_doc: JSON.stringify(doc) }),
      ],
      page_drafts: [draftRow("no", doc)],
    });
    await clearPageTheme("page-1");
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });
});

describe("unpublishPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function seed(
    translations: { $id: string; locale: string; is_published: boolean }[]
  ) {
    db.listRows.mockImplementation(
      (_db: string, table: string, queries: string[]) => {
        if (table === "pages") {
          return Promise.resolve({
            rows: [{ $id: "page-1", visibility: "public" }],
          });
        }
        const wantsLocale = queries.some((q) => q.includes('"locale"'));
        const rows = wantsLocale
          ? translations.filter((t) =>
              queries.some((q) => q.includes(`"${t.locale}"`))
            )
          : translations;
        return Promise.resolve({ rows });
      }
    );
  }

  it("keeps the page published while another locale is still live", async () => {
    seed([
      { $id: "tr-no", locale: "no", is_published: true },
      { $id: "tr-en", locale: "en", is_published: true },
    ]);

    await unpublishPage({ id: "page-1", locale: "en" });

    expect(db.updateRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow.mock.calls[0][1]).toBe("page_translations");
    expect(db.updateRow.mock.calls[0][2]).toBe("tr-en");
    expect(db.updateRow.mock.calls[0][3]).toEqual({ is_published: false });
  });

  it("makes the page a draft once the last published locale is unpublished", async () => {
    seed([
      { $id: "tr-no", locale: "no", is_published: false },
      { $id: "tr-en", locale: "en", is_published: true },
    ]);

    await unpublishPage({ id: "page-1", locale: "en" });

    const pageWrite = db.updateRow.mock.calls.find((c) => c[1] === "pages");
    expect(pageWrite?.[3]).toEqual({ status: "draft" });
    expect(pageWrite?.[4]).toBeDefined();
  });

  it("does not count the locale being unpublished as still live", async () => {
    seed([{ $id: "tr-no", locale: "no", is_published: true }]);

    await unpublishPage({ id: "page-1", locale: "no" });

    expect(db.updateRow.mock.calls.find((c) => c[1] === "pages")?.[3]).toEqual({
      status: "draft",
    });
  });
});

describe("archivePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("archives the page and removes the read permission from it and every translation", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ $id: "tr-no" }, { $id: "tr-en" }],
    });

    await archivePage(db as never, "page-1");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "pages",
      "page-1",
      { status: "archived" },
      []
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      {},
      []
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-en",
      {},
      []
    );
    expect(db.updateRow).toHaveBeenCalledTimes(3);
  });

  it("reaches translations beyond the first page of results", async () => {
    const first = Array.from({ length: 25 }, (_, i) => ({ $id: `tr-${i}` }));
    db.listRows
      .mockResolvedValueOnce({ rows: first })
      .mockResolvedValueOnce({ rows: [{ $id: "tr-last" }] });

    await archivePage(db as never, "page-1");

    expect(db.updateRow).toHaveBeenCalledTimes(27);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-last",
      {},
      []
    );
  });
});

/**
 * A published translation row is world-readable, so unpublished work lives
 * in the service-only draft table, keyed by the translation row's id, and
 * reaches the translation row only when the locale is published. Drafts saved
 * before the table existed still sit in the row's `draft_doc` until they are
 * migrated, so reads fall back to it.
 */
describe("page drafts live in their own table", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    echoWrites();
  });

  /** A draft that differs from what the row holds: no sections. */
  const edited = { ...withMeta({ title: "Utkast" }), sections: [] };

  it("a draft save on a published locale goes to the draft table and never touches the row", async () => {
    seedTables({
      page_translations: [
        translationRow("no", {
          description: "Live text",
          is_published: true,
          published_doc: JSON.stringify(withMeta({ title: "Live" })),
          title: "Live",
        }),
      ],
    });

    const result = await savePageDraft({
      id: "page-1",
      doc,
      locale: "no",
      ctx,
    });

    expect(writesTo(PAGE_DRAFTS_TABLE_ID)).toEqual([
      {
        data: {
          description: "Beskrivelse",
          draft_doc: JSON.stringify(doc),
          locale: "no",
          page_id: "page-1",
          title: "Hei",
        },
        permissions: [],
        rowId: "tr-no",
      },
    ]);
    expect(writesTo("page_translations")).toEqual([]);
    expect(result).toEqual({
      pageId: "page-1",
      slug: "shared-slug",
      translationId: "tr-no",
    });
  });

  it("a draft save drops a legacy draft_doc from the row, and only once the draft row holds the draft", async () => {
    seedTables({
      pages: [{ $id: "page-1" }],
      page_translations: [
        translationRow("en", {
          draft_doc: JSON.stringify(withMeta({ title: "Old" })),
          is_published: true,
        }),
      ],
    });

    const result = await savePageTranslationDraft({
      doc: withMeta({ title: "Hello" }),
      id: "page-1",
      locale: "en",
    });

    expect(writesTo("page_translations")).toEqual([
      { data: { draft_doc: null }, permissions: undefined, rowId: "tr-en" },
    ]);
    expect(writesTo(PAGE_DRAFTS_TABLE_ID)).toHaveLength(1);
    expect(db.upsertRow.mock.invocationCallOrder[0]).toBeLessThan(
      db.updateRow.mock.invocationCallOrder[0]
    );
    // The version a caller compares against is the draft row's.
    expect(result).toEqual({
      translationId: "tr-en",
      updatedAt: `${PAGE_DRAFTS_TABLE_ID}@v2`,
    });
  });

  it("a draft save for a locale with no row creates it unpublished without the draft, and the draft row under its id", async () => {
    seedTables({ pages: [{ $id: "page-1" }] });
    const hello = withMeta({ title: "Hello" });

    const result = await savePageTranslationDraft({
      doc: hello,
      id: "page-1",
      locale: "en",
    });

    const [created, ...others] = writesTo("page_translations");
    expect(others).toEqual([]);
    expect(created.data).toEqual(
      expect.objectContaining({
        description: "Beskrivelse",
        is_published: false,
        locale: "en",
        page_id: "page-1",
        title: "Hello",
      })
    );
    expect(created.data).not.toHaveProperty("draft_doc");
    expect(created.permissions).toEqual([]);
    expect(writesTo(PAGE_DRAFTS_TABLE_ID)).toEqual([
      {
        data: {
          description: "Beskrivelse",
          draft_doc: JSON.stringify(hello),
          locale: "en",
          page_id: "page-1",
          title: "Hello",
        },
        permissions: [],
        rowId: created.rowId,
      },
    ]);
    expect(result).toEqual({
      translationId: created.rowId,
      updatedAt: `${PAGE_DRAFTS_TABLE_ID}@v2`,
    });
  });

  it("publishing copies the draft row's document, title and description to the translation row", async () => {
    const draftJson = JSON.stringify(edited);
    seedTables({
      pages: [{ $id: "page-1", visibility: "public" }],
      page_translations: [
        translationRow("no", { description: "Old text", title: "Old" }),
      ],
      page_drafts: [
        draftRow("no", edited, { description: "Utkasttekst", title: "Utkast" }),
      ],
    });

    await publishPage({
      id: "page-1",
      locale: "no",
      updateParentStatus: false,
    });

    expect(writesTo("page_translations")).toEqual([
      {
        data: {
          description: "Utkasttekst",
          is_published: true,
          published_at: expect.any(String),
          published_doc: draftJson,
          title: "Utkast",
        },
        permissions: ['read("any")'],
        rowId: "tr-no",
      },
    ]);
  });

  it("publishing a locale with no draft row falls back to the legacy draft_doc and the row's own title", async () => {
    const legacyJson = JSON.stringify(withMeta({ title: "Legacy" }));
    seedTables({
      pages: [{ $id: "page-1", visibility: "public" }],
      page_translations: [
        translationRow("no", {
          description: "Legacy text",
          draft_doc: legacyJson,
          title: "Legacy",
        }),
      ],
    });

    await publishPage({
      id: "page-1",
      locale: "no",
      updateParentStatus: false,
    });

    expect(writesTo("page_translations")).toEqual([
      {
        data: expect.objectContaining({
          description: "Legacy text",
          is_published: true,
          published_doc: legacyJson,
          title: "Legacy",
        }),
        permissions: ['read("any")'],
        rowId: "tr-no",
      },
    ]);
  });

  it("the editor loads a locale's draft row, and falls back to the legacy columns without one", async () => {
    seedTables({
      pages: [
        {
          $id: "page-1",
          slug: "shared-slug",
          status: "published",
          visibility: "public",
          department_id: "dept-1",
          campus_id: "os",
          translation_refs: [
            translationRow("no", {
              description: "Live text",
              draft_doc: JSON.stringify(withMeta({ title: "Stale" })),
              is_published: true,
              published_at: "2026-10-01T00:00:00.000Z",
              published_doc: JSON.stringify(withMeta({ title: "Live" })),
              title: "Live",
            }),
            translationRow("en", {
              description: null,
              draft_doc: JSON.stringify(withMeta({ title: "Hello" })),
              is_published: false,
              published_at: null,
            }),
          ],
        },
      ],
      page_drafts: [
        draftRow("no", edited, {
          $updatedAt: "draft-no@v3",
          description: "Utkasttekst",
        }),
      ],
    });

    const result = await getPageEditorById("page-1", db);

    const draftLists = db.listRows.mock.calls.filter(
      (call) => call[1] === PAGE_DRAFTS_TABLE_ID
    );
    expect(draftLists).toHaveLength(1);
    expect(draftLists[0][2]).toEqual(
      expect.arrayContaining([expect.stringContaining('"page_id"')])
    );

    const no = result?.translations.no;
    expect(no).toMatchObject({
      description: "Utkasttekst",
      id: "tr-no",
      isPublished: true,
      title: "Utkast",
      updatedAt: "draft-no@v3",
    });
    expect(no?.draftDocument?.sections).toEqual([]);
    expect(no?.draftDocument?.meta.title).toBe("Utkast");
    expect(no?.draftDocument?.meta.description).toBe("Utkasttekst");
    // The published document keeps the title it was published with.
    expect(no?.publishedDocument?.meta.title).toBe("Live");
    expect(no?.publishedDocument?.meta.description).toBe("Live text");

    const en = result?.translations.en;
    expect(en).toMatchObject({
      id: "tr-en",
      title: "Hello",
      updatedAt: "tr-en@v1",
    });
    expect(en?.description).toBeUndefined();
    expect(en?.draftDocument?.meta.title).toBe("Hello");
    expect(en?.draftDocument?.sections).toEqual(doc.sections);
  });

  it("getPageById serves the draft row's document when nothing is published", async () => {
    seedTables({
      pages: [
        {
          $id: "page-1",
          slug: "shared-slug",
          status: "draft",
          visibility: "public",
          department_id: "dept-1",
          translation_refs: [
            translationRow("no", {
              draft_doc: JSON.stringify(withMeta({ title: "Stale" })),
            }),
          ],
        },
      ],
      page_drafts: [draftRow("no", edited)],
    });

    const result = await getPageById("page-1", "no", db);

    expect(result?.doc?.sections).toEqual([]);
    expect(result?.doc?.meta.title).toBe("Utkast");
    expect(result?.translation?.title).toBe("Utkast");
  });

  it("the public read never fetches a draft", async () => {
    seedTables({});

    await getPage("shared-slug", "no");

    expect(
      db.listRows.mock.calls.some((call) => call[1] === PAGE_DRAFTS_TABLE_ID)
    ).toBe(false);
    const [, table, queries] = db.listRows.mock.calls[0] as [
      string,
      string,
      string[],
    ];
    expect(table).toBe("pages");
    const select = queries
      .map((query) => JSON.parse(query) as { method: string; values: string[] })
      .find((query) => query.method === "select");
    expect(select?.values).toEqual(
      expect.arrayContaining([
        "translation_refs.$id",
        "translation_refs.locale",
        "translation_refs.is_published",
        "translation_refs.published_doc",
        "translation_refs.title",
        "translation_refs.description",
      ])
    );
    for (const column of select?.values ?? []) {
      expect(column).not.toMatch(DRAFT_OR_WILDCARD_COLUMN);
    }
  });
});
