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
  getPageEditorById,
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

describe("page builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default for any un-queued listRows call (e.g. the campus/department
    // lookups used to derive row permissions). `mockResolvedValueOnce` queued
    // in individual tests still takes precedence over this default.
    db.listRows.mockResolvedValue({ rows: [] });
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

    const result = await getPageEditorById("page-1");

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
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.objectContaining({
        draft_doc: expect.stringContaining('"slug":"shared-slug-2"'),
      }),
      expect.any(Array)
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

  it("updates an existing locale translation instead of creating a duplicate", async () => {
    db.upsertRow.mockImplementation(
      async (_db: string, _table: string, id: string) => ({ $id: id })
    );
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

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      expect.objectContaining({ title: "Hei" })
    );
    expect(result.translationId).toBe("tr-no");
    expect(db.upsertRow).not.toHaveBeenCalled();
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
    db.upsertRow.mockResolvedValueOnce({ $id: "tr-en", $updatedAt: "v-1" });

    const result = await savePageTranslationDraft({
      doc: {
        ...doc,
        meta: { ...doc.meta, title: "Hello", status: "published" },
      },
      id: "page-1",
      locale: "en",
    });

    // The row version this write produced: auto-translation checks nobody
    // wrote the locale after it before publishing.
    expect(result).toEqual({ translationId: "tr-en", updatedAt: "v-1" });
    expect(db.upsertRow).toHaveBeenCalledTimes(1);
    expect(db.upsertRow).toHaveBeenCalledWith(
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

  /** The keys a write sets, and whether it passed permissions. */
  const writes = () =>
    [...db.updateRow.mock.calls, ...db.upsertRow.mock.calls].map(
      ([, table, , data, permissions]) => ({
        keys: Object.keys(data as object),
        permissions,
        table,
      })
    );

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

    const page = writes().find((w) => w.table === "pages");
    expect(page?.keys).not.toContain("status");
    expect(page?.permissions).toBeUndefined();
    const translation = writes().find((w) => w.table === "page_translations");
    expect(translation?.keys).not.toContain("is_published");
    expect(translation?.permissions).toBeUndefined();
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

    db.updateRow.mockResolvedValueOnce({ $id: "tr-en", $updatedAt: "v-2" });

    const result = await savePageTranslationDraft({
      doc: { ...doc, meta: { ...doc.meta, title: "Hello" } },
      id: "page-1",
      locale: "en",
    });

    expect(result).toEqual({ translationId: "tr-en", updatedAt: "v-2" });
    expect(writes()).toEqual([
      {
        keys: expect.not.arrayContaining(["is_published"]),
        permissions: undefined,
        table: "page_translations",
      },
    ]);
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

/**
 * The translation rows a page lists; a re-read of one by id returns it as
 * listed (nothing changed meanwhile) unless a test says otherwise.
 */
function listTranslations(rows: Record<string, unknown>[]) {
  db.listRows.mockResolvedValueOnce({ rows });
  db.getRow.mockImplementation(
    async (_db: string, _table: string, id: string) =>
      rows.find((row) => row.$id === id)
  );
}

describe("syncSharedDraftMeta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.getRow.mockReset();
  });

  it("writes the shared meta into every other locale's existing draft, and nothing else", async () => {
    const en = withMeta({ title: "Hello", theme: GREEN });
    listTranslations([
      { $id: "tr-no", draft_doc: JSON.stringify(doc), locale: "no" },
      { $id: "tr-en", draft_doc: JSON.stringify(en), locale: "en" },
    ]);

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: {
        campus: "os",
        department: "dept-1",
        slug: "shared-slug",
        status: "draft",
        theme: PURPLE,
      },
    });

    expect(db.updateRow).toHaveBeenCalledTimes(1);
    const [, table, rowId, data, permissions] = db.updateRow.mock.calls[0];
    expect(table).toBe("page_translations");
    expect(rowId).toBe("tr-en");
    // Permissions are left as they are.
    expect(permissions).toBeUndefined();
    expect(Object.keys(data)).toEqual(["draft_doc"]);
    const written = JSON.parse(data.draft_doc) as PageDoc;
    expect(written.meta.theme).toEqual(PURPLE);
    expect(written.meta.title).toBe("Hello");
    expect(written.meta.campus).toBe("os");
    expect(written.sections).toEqual(en.sections);
  });

  it("removes a shared field that is undefined, keeps null", async () => {
    listTranslations([
      {
        $id: "tr-en",
        draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
        locale: "en",
      },
    ]);
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: { ...doc.meta, theme: undefined },
    });
    const absent = JSON.parse(db.updateRow.mock.calls[0][3].draft_doc);
    expect("theme" in absent.meta).toBe(false);

    db.updateRow.mockClear();
    listTranslations([
      {
        $id: "tr-en",
        draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
        locale: "en",
      },
    ]);
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: { ...doc.meta, theme: null },
    });
    expect(JSON.parse(db.updateRow.mock.calls[0][3].draft_doc).meta.theme).toBe(
      null
    );
  });

  it("creates no translation row and rewrites no draft that already matches", async () => {
    listTranslations([
      { $id: "tr-no", draft_doc: JSON.stringify(doc), locale: "no" },
      // A translation with no draft of its own is left alone.
      { $id: "tr-en", draft_doc: null, locale: "en" },
    ]);
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });
    expect(db.updateRow).not.toHaveBeenCalled();

    listTranslations([
      { $id: "tr-en", draft_doc: JSON.stringify(withMeta({})), locale: "en" },
    ]);
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("re-reads the draft before writing, and merges into what another tab wrote meanwhile", async () => {
    const listed = {
      $id: "tr-en",
      $updatedAt: "2026-10-23T10:00:00.000Z",
      draft_doc: JSON.stringify(withMeta({ title: "Hello", theme: GREEN })),
      locale: "en",
    };
    const newer = {
      ...listed,
      $updatedAt: "2026-10-23T10:00:01.000Z",
      draft_doc: JSON.stringify(
        withMeta({ title: "Hello from the other tab", theme: GREEN })
      ),
    };
    listTranslations([listed]);
    db.getRow.mockResolvedValue(newer);

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(db.getRow).toHaveBeenCalledWith("app", "page_translations", "tr-en");
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    const written = JSON.parse(db.updateRow.mock.calls[0][3].draft_doc);
    // The newer content is kept, with the shared meta merged in.
    expect(written.meta.title).toBe("Hello from the other tab");
    expect(written.meta.theme).toEqual(PURPLE);
  });

  it("writes nothing, and warns, when the draft changes again before the retry", async () => {
    const listed = {
      $id: "tr-en",
      $updatedAt: "2026-10-23T10:00:00.000Z",
      draft_doc: JSON.stringify(withMeta({ title: "Hello", theme: GREEN })),
      locale: "en",
    };
    listTranslations([listed]);
    db.getRow
      .mockResolvedValueOnce({
        ...listed,
        $updatedAt: "2026-10-23T10:00:01.000Z",
      })
      .mockResolvedValueOnce({
        ...listed,
        $updatedAt: "2026-10-23T10:00:02.000Z",
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });

    expect(db.getRow).toHaveBeenCalledTimes(2);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("writes once when the draft is unchanged since it was listed", async () => {
    listTranslations([
      {
        $id: "tr-en",
        $updatedAt: "2026-10-23T10:00:00.000Z",
        draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
        locale: "en",
      },
    ]);
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: SHARED_PURPLE,
    });
    expect(db.getRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenCalledTimes(1);
  });
});

describe("clearPageTheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips meta.theme from every locale's draft and published doc, leaving the rest", async () => {
    const themed = withMeta({ theme: PURPLE });
    const reset = withMeta({ theme: null });
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "tr-no",
          draft_doc: JSON.stringify(themed),
          locale: "no",
          published_doc: JSON.stringify(reset),
        },
        {
          $id: "tr-en",
          draft_doc: JSON.stringify(withMeta({ title: "Hello", theme: GREEN })),
          locale: "en",
          published_doc: null,
        },
      ],
    });

    await clearPageTheme("page-1");

    expect(db.listRows).toHaveBeenCalledWith(
      "app",
      "page_translations",
      expect.arrayContaining([expect.stringContaining("page_id")])
    );
    expect(db.updateRow).toHaveBeenCalledTimes(2);
    const byRow = Object.fromEntries(
      db.updateRow.mock.calls.map((call) => [call[2], call])
    );
    const no = byRow["tr-no"];
    expect(no[4]).toBeUndefined();
    expect(Object.keys(no[3]).sort()).toEqual(["draft_doc", "published_doc"]);
    const noDraft = JSON.parse(no[3].draft_doc);
    const noPublished = JSON.parse(no[3].published_doc);
    expect("theme" in noDraft.meta).toBe(false);
    expect("theme" in noPublished.meta).toBe(false);
    expect(noDraft).toEqual(doc);
    expect(noPublished).toEqual(doc);

    const en = byRow["tr-en"];
    expect(Object.keys(en[3])).toEqual(["draft_doc"]);
    const enDraft = JSON.parse(en[3].draft_doc);
    expect("theme" in enDraft.meta).toBe(false);
    expect(enDraft.meta.title).toBe("Hello");
  });

  it("rewrites nothing when no document holds a theme", async () => {
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "tr-no",
          draft_doc: JSON.stringify(doc),
          locale: "no",
          published_doc: JSON.stringify(doc),
        },
      ],
    });
    await clearPageTheme("page-1");
    expect(db.updateRow).not.toHaveBeenCalled();
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
