import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  upsertRow: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./server", () => ({
  createSessionClient: vi.fn(async () => ({ db })),
}));

import { getPageEditorById, type PageDoc, savePageDraft } from "./page-builder";

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
      expect.not.objectContaining({ title: expect.anything() })
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.not.objectContaining({ slug: expect.anything() })
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
      expect.objectContaining({ slug: "shared-slug-2" })
    );
    expect(db.upsertRow).toHaveBeenNthCalledWith(
      2,
      "app",
      "page_translations",
      expect.any(String),
      expect.objectContaining({
        draft_document: expect.stringContaining('"slug":"shared-slug-2"'),
      })
    );
  });

  it("updates an existing locale translation instead of creating a duplicate", async () => {
    db.upsertRow
      .mockResolvedValueOnce({ $id: "page-1" })
      .mockResolvedValueOnce({ $id: "tr-no" });
    db.listRows.mockResolvedValueOnce({
      rows: [{ $id: "tr-no", is_published: false }],
    });

    await savePageDraft({ id: "page-1", doc, locale: "no", ctx });

    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "tr-no",
      expect.objectContaining({ title: "Hei" })
    );
    expect(db.createRow).not.toHaveBeenCalled();
  });
});
