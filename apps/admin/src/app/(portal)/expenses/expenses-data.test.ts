import { describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { ExpenseViewer } from "@/lib/expense-access";

mock.module("server-only", () => ({}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: {} })),
}));

const { buildExpenseListQueries, resolveExpenseListFilters } = await import(
  "./expenses-data"
);

const viewer = (over: Partial<ExpenseViewer> = {}): ExpenseViewer => ({
  accountEmail: null,
  controllerCampusIds: [],
  emails: ["a@biso.no"],
  isCampusAdmin: false,
  isGlobalAdmin: true,
  managedCampusIds: [],
  name: null,
  userId: "u1",
  ...over,
});

const filters = (over = {}) => ({
  ...resolveExpenseListFilters({}),
  ...over,
});

const noIds = {
  approverExpenseIds: [],
  issueExpenseIds: [],
  mineExpenseIds: [],
};

describe("resolveExpenseListFilters", () => {
  test("defaults", () => {
    expect(resolveExpenseListFilters({})).toEqual({
      campusId: null,
      departmentId: null,
      page: 1,
      q: "",
      size: 25,
      status: null,
      view: "all",
    });
  });

  test("reads view and known filters", () => {
    const result = resolveExpenseListFilters({
      campus: "c1",
      department: "d1",
      q: " lunch ",
      status: "failed",
      view: "attention",
    });
    expect(result).toMatchObject({
      campusId: "c1",
      departmentId: "d1",
      q: "lunch",
      status: "failed",
      view: "attention",
    });
  });

  test("unknown status falls back to null", () => {
    expect(resolveExpenseListFilters({ status: "bogus" }).status).toBeNull();
  });

  test("draft is never a valid status", () => {
    expect(resolveExpenseListFilters({ status: "draft" }).status).toBeNull();
  });

  test("unknown view falls back to all", () => {
    expect(resolveExpenseListFilters({ view: "x" }).view).toBe("all");
  });

  test("a size outside PAGE_SIZES is clamped", () => {
    expect(resolveExpenseListFilters({ size: "7" }).size).toBe(25);
  });
});

describe("buildExpenseListQueries", () => {
  test("always excludes drafts", () => {
    const queries = buildExpenseListQueries(viewer(), filters(), noIds);
    expect(queries).toContain(Query.notEqual("status", "draft"));
  });

  test("mine without ids short-circuits", () => {
    expect(
      buildExpenseListQueries(viewer(), filters({ view: "mine" }), noIds)
    ).toBeNull();
  });

  test("mine restricts to the given ids", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ view: "mine" }),
      { ...noIds, mineExpenseIds: ["e1"] }
    );
    expect(queries).toContain(Query.equal("$id", ["e1"]));
    expect(queries).toContain(Query.equal("status", "pending"));
  });

  test("digits q matches the reimbursement sequence", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ q: "10042" }),
      noIds
    );
    expect(queries).toContain(Query.equal("$sequence", 42));
  });

  test("text q uses fulltext search", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ q: "pizza" }),
      noIds
    );
    expect(queries).toContain(Query.search("description", "pizza"));
  });

  test("applies the status filter", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ status: "failed" }),
      noIds
    );
    expect(queries).toContain(Query.equal("status", "failed"));
  });

  test("attention is failed or has an open issue", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ view: "attention" }),
      { ...noIds, issueExpenseIds: ["e9"] }
    );
    expect(queries).toContain(
      Query.or([Query.equal("status", "failed"), Query.equal("$id", ["e9"])])
    );
  });

  test("non-global viewers get visibility queries", () => {
    const queries = buildExpenseListQueries(
      viewer({
        isCampusAdmin: true,
        isGlobalAdmin: false,
        managedCampusIds: ["c1"],
      }),
      filters(),
      noIds
    );
    expect(queries).toContain(Query.equal("campus", ["c1"]));
  });
});
