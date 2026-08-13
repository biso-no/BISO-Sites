import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasUnsafeFindings,
  type RepairDb,
  repairContentRelationships,
} from "./content-relationship-repair";

const db = {
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  upsertRow: vi.fn(),
} satisfies Record<keyof RepairDb, ReturnType<typeof vi.fn>>;

type RowsByTable = Record<string, Record<string, unknown>[]>;

function mockTables(rowsByTable: RowsByTable): void {
  db.listRows.mockImplementation(
    (_databaseId: string, tableId: string, queries: string[] = []) => {
      // The engine paginates with cursorAfter; a single page per table is
      // enough for tests — return nothing once a cursor is present.
      const hasCursor = queries.some((query) => query.includes("cursorAfter"));
      const rows = hasCursor ? [] : (rowsByTable[tableId] ?? []);
      return { rows, total: rows.length };
    }
  );
  db.getRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) => {
      const row = (rowsByTable[tableId] ?? []).find(
        (candidate) => candidate.$id === rowId
      );
      if (!row) {
        return Promise.reject(
          new Error("Row with the requested ID could not be found")
        );
      }
      return row;
    }
  );
}

beforeEach(() => {
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();
  db.updateRow.mockResolvedValue({});
  db.upsertRow.mockResolvedValue({});
  mockTables({});
});

describe("repairContentRelationships", () => {
  it("links a valid unlinked translation to its parent", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "news-1",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
      ],
      news: [{ $id: "news-1" }],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "tr-1",
      { news_ref: "news-1" }
    );
    expect(report.linked).toContainEqual({
      parentId: "news-1",
      translationId: "tr-1",
    });
    expect(hasUnsafeFindings(report)).toBe(false);
  });

  it("dry run reports the same repair without writing", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "news-1",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
      ],
      news: [{ $id: "news-1" }],
    });

    const report = await repairContentRelationships(db, { apply: false });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(report.linked).toContainEqual({
      parentId: "news-1",
      translationId: "tr-1",
    });
  });

  it("counts already linked translations without touching them", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "event-1",
          content_type: "event",
          event_ref: { $id: "event-1" },
          locale: "en",
        },
      ],
      events: [{ $id: "event-1" }],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.alreadyLinked).toBe(1);
  });

  it("reports duplicate locale rows and leaves the whole group untouched", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "news-1",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
        {
          $id: "tr-2",
          content_id: "news-1",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
      ],
      news: [{ $id: "news-1" }],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.duplicates).toContainEqual({
      contentId: "news-1",
      contentType: "news",
      locale: "no",
      translationIds: ["tr-1", "tr-2"],
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("reports missing parents as orphans and leaves them untouched", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "news-gone",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.orphans).toContainEqual({
      contentId: "news-gone",
      contentType: "news",
      translationId: "tr-1",
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("reports a translation linked to the wrong parent without rewriting it", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "product-1",
          content_type: "product",
          locale: "no",
          product_ref: { $id: "product-2" },
        },
      ],
      webshop_products: [{ $id: "product-1" }, { $id: "product-2" }],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.wrongParents).toContainEqual({
      actualParentId: "product-2",
      contentType: "product",
      expectedParentId: "product-1",
      translationId: "tr-1",
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("backfills ownership relationships from legacy scalar columns", async () => {
    mockTables({
      campus: [{ $id: "campus-oslo" }],
      departments: [{ $id: "dept-1", campus: { $id: "campus-oslo" } }],
      news: [
        {
          $id: "news-1",
          campus: null,
          campus_id: "campus-oslo",
          department: null,
          department_id: "dept-1",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).toHaveBeenCalledWith("app", "news", "news-1", {
      campus: "campus-oslo",
    });
    expect(db.updateRow).toHaveBeenCalledWith("app", "news", "news-1", {
      department: "dept-1",
    });
    expect(report.ownershipBackfills).toContainEqual({
      field: "campus",
      rowId: "news-1",
      tableId: "news",
      value: "campus-oslo",
    });
  });

  it("backfills job ownership so the vacancy lists can scope by relation", async () => {
    mockTables({
      campus: [{ $id: "campus-oslo" }],
      departments: [{ $id: "dept-hr", campus_id: "campus-oslo" }],
      jobs: [
        {
          $id: "job-1",
          campus: null,
          campus_id: "campus-oslo",
          department: null,
          department_id: "dept-hr",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).toHaveBeenCalledWith("app", "jobs", "job-1", {
      campus: "campus-oslo",
    });
    expect(db.updateRow).toHaveBeenCalledWith("app", "jobs", "job-1", {
      department: "dept-hr",
    });
    expect(hasUnsafeFindings(report)).toBe(false);
  });

  it("uses the webshop departmentId legacy spelling", async () => {
    mockTables({
      departments: [{ $id: "dept-1", campus_id: "campus-oslo" }],
      webshop_products: [
        {
          $id: "product-1",
          campus: { $id: "campus-oslo" },
          department: null,
          departmentId: "dept-1",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      "product-1",
      { department: "dept-1" }
    );
    expect(report.ownershipBackfills).toContainEqual({
      field: "department",
      rowId: "product-1",
      tableId: "webshop_products",
      value: "dept-1",
    });
  });

  it("refuses to backfill a department from another campus", async () => {
    mockTables({
      campus: [{ $id: "campus-oslo" }],
      departments: [{ $id: "dept-bergen", campus: { $id: "campus-bergen" } }],
      news: [
        {
          $id: "news-1",
          campus: { $id: "campus-oslo" },
          campus_id: "campus-oslo",
          department: null,
          department_id: "dept-bergen",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.ownershipBackfills).toEqual([]);
    expect(report.errors).toContainEqual({
      id: "news/news-1",
      message:
        "department target dept-bergen belongs to campus campus-bergen, row campus is campus-oslo",
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("refuses to backfill a department when the row has no campus", async () => {
    mockTables({
      departments: [{ $id: "dept-1", campus: { $id: "campus-oslo" } }],
      news: [
        {
          $id: "news-1",
          campus: null,
          campus_id: null,
          department: null,
          department_id: "dept-1",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.errors).toContainEqual({
      id: "news/news-1",
      message: "department target dept-1 cannot be verified: row has no campus",
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("reports a missing department target instead of backfilling it", async () => {
    mockTables({
      campus: [{ $id: "campus-oslo" }],
      news: [
        {
          $id: "news-1",
          campus: { $id: "campus-oslo" },
          campus_id: "campus-oslo",
          department: null,
          department_id: "dept-gone",
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).not.toHaveBeenCalled();
    expect(report.errors).toContainEqual({
      id: "news/news-1",
      message: "department target dept-gone does not exist",
    });
  });

  it("rebuilds the one-way job parent relation with every translation id", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-no",
          content_id: "job-1",
          content_type: "job",
          locale: "no",
        },
        {
          $id: "tr-en",
          content_id: "job-1",
          content_type: "job",
          locale: "en",
        },
      ],
      jobs: [
        {
          $id: "job-1",
          translations: [{ $id: "tr-no" }],
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.upsertRow).toHaveBeenCalledWith("app", "jobs", "job-1", {
      translations: ["tr-no", "tr-en"],
    });
    expect(report.jobRelinked).toContainEqual({
      jobId: "job-1",
      translationIds: ["tr-no", "tr-en"],
    });
  });

  it("keeps job children the pass skipped when rebuilding the relation", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-en",
          content_id: "job-1",
          content_type: "job",
          locale: "en",
        },
        // Historical child: no content_id, so it is reported as an orphan and
        // never lands in the job's expected set.
        {
          $id: "tr-legacy",
          content_id: null,
          content_type: "job",
          locale: "no",
        },
      ],
      jobs: [
        {
          $id: "job-1",
          translations: [{ $id: "tr-legacy" }],
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.upsertRow).toHaveBeenCalledWith("app", "jobs", "job-1", {
      translations: ["tr-legacy", "tr-en"],
    });
    expect(report.jobRelinked).toContainEqual({
      jobId: "job-1",
      translationIds: ["tr-legacy", "tr-en"],
    });
    expect(report.orphans).toContainEqual({
      contentId: null,
      contentType: "job",
      translationId: "tr-legacy",
    });
  });

  it("keeps a duplicate-group child linked when rebuilding the relation", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-dup-a",
          content_id: "job-1",
          content_type: "job",
          locale: "no",
        },
        {
          $id: "tr-dup-b",
          content_id: "job-1",
          content_type: "job",
          locale: "no",
        },
        {
          $id: "tr-en",
          content_id: "job-1",
          content_type: "job",
          locale: "en",
        },
      ],
      jobs: [
        {
          $id: "job-1",
          translations: [{ $id: "tr-dup-a" }],
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.upsertRow).toHaveBeenCalledWith("app", "jobs", "job-1", {
      translations: ["tr-dup-a", "tr-en"],
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });

  it("leaves a complete job relation untouched", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-no",
          content_id: "job-1",
          content_type: "job",
          locale: "no",
        },
      ],
      jobs: [
        {
          $id: "job-1",
          translations: [{ $id: "tr-no" }],
        },
      ],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(report.jobRelinked).toEqual([]);
  });

  it("links page translations to their page through the canonical relation", async () => {
    mockTables({
      page_translations: [
        {
          $id: "ptr-1",
          locale: "no",
          page: null,
          page_id: "page-1",
        },
        {
          $id: "ptr-2",
          locale: "en",
          page: { $id: "page-1" },
          page_id: "page-1",
        },
      ],
      pages: [{ $id: "page-1" }],
    });

    const report = await repairContentRelationships(db, { apply: true });

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "page_translations",
      "ptr-1",
      { page: "page-1" }
    );
    expect(report.pageLinked).toContainEqual({
      pageId: "page-1",
      translationId: "ptr-1",
    });
  });

  it("records write failures as errors", async () => {
    mockTables({
      content_translations: [
        {
          $id: "tr-1",
          content_id: "news-1",
          content_type: "news",
          locale: "no",
          news_ref: null,
        },
      ],
      news: [{ $id: "news-1" }],
    });
    db.updateRow.mockRejectedValue(new Error("write denied"));

    const report = await repairContentRelationships(db, { apply: true });

    expect(report.errors).toContainEqual({
      id: "tr-1",
      message: "write denied",
    });
    expect(hasUnsafeFindings(report)).toBe(true);
  });
});
