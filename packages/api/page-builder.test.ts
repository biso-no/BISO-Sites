import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
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
  clearPageTheme,
  getPage,
  getPageEditorById,
  type PageDoc,
  publishPage,
  savePageDraft,
  savePageTranslationDraft,
  syncSharedDraftMeta,
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

  it("updates an existing locale translation instead of creating a duplicate", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    // existing translation lookup (no team lookups remain)
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "tr-no", is_published: false }],
    });

    await savePageDraft({ id: "page-1", doc, locale: "no", ctx });

    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      expect.objectContaining({ title: "Hei" }),
      expect.any(Array)
    );
    expect(db.createRow).not.toHaveBeenCalled();
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
    db.upsertRow.mockResolvedValueOnce({ $id: "tr-en" });

    const result = await savePageTranslationDraft({
      doc: {
        ...doc,
        meta: { ...doc.meta, title: "Hello", status: "published" },
      },
      id: "page-1",
      locale: "en",
    });

    expect(result).toEqual({ translationId: "tr-en" });
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

const PURPLE = { accent: "#c8a2f0", dark: "#3b1c6b" };
const GREEN = { accent: "#8fe3b5", dark: "#0b3d2e" };

const withMeta = (meta: Partial<PageDoc["meta"]>): PageDoc => ({
  ...doc,
  meta: { ...doc.meta, ...meta },
});

describe("syncSharedDraftMeta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the shared meta into every other locale's existing draft, and nothing else", async () => {
    const en = withMeta({ title: "Hello", theme: GREEN });
    db.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "tr-no", draft_doc: JSON.stringify(doc), locale: "no" },
        { $id: "tr-en", draft_doc: JSON.stringify(en), locale: "en" },
      ],
    });

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
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "tr-en",
          draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
          locale: "en",
        },
      ],
    });
    await syncSharedDraftMeta({
      id: "page-1",
      locale: "no",
      meta: { ...doc.meta, theme: undefined },
    });
    const absent = JSON.parse(db.updateRow.mock.calls[0][3].draft_doc);
    expect("theme" in absent.meta).toBe(false);

    db.updateRow.mockClear();
    db.listRows.mockResolvedValueOnce({
      rows: [
        {
          $id: "tr-en",
          draft_doc: JSON.stringify(withMeta({ theme: GREEN })),
          locale: "en",
        },
      ],
    });
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
    db.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "tr-no", draft_doc: JSON.stringify(doc), locale: "no" },
        // A translation with no draft of its own is left alone.
        { $id: "tr-en", draft_doc: null, locale: "en" },
      ],
    });
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });
    expect(db.updateRow).not.toHaveBeenCalled();

    db.listRows.mockResolvedValueOnce({
      rows: [
        { $id: "tr-en", draft_doc: JSON.stringify(withMeta({})), locale: "en" },
      ],
    });
    await syncSharedDraftMeta({ id: "page-1", locale: "no", meta: doc.meta });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
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
