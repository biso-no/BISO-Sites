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
  getPageEditorById,
  type PageDoc,
  savePageDraft,
  savePageTranslationDraft,
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
    accentColor: "#6b1e1e",
    description: "Beskrivelse",
    status: "draft",
  },
  blocks: [{ id: "b-1", type: "text", body: [{ type: "p", text: "Hei" }] }],
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
              draft_document: JSON.stringify(doc),
              puck_document: null,
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
        draft_document: expect.stringContaining('"slug":"shared-slug-2"'),
      }),
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
