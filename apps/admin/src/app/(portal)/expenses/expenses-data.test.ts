import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { ExpenseViewer } from "@/lib/expense-access";

mock.module("server-only", () => ({}));
const db = { getRow: mock(), listRows: mock() };
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

const {
  buildExpenseListQueries,
  getExpenseDetail,
  listExpenses,
  resolveExpenseListFilters,
} = await import("./expenses-data");

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

describe("search guards", () => {
  test("a 12-digit q uses description search", () => {
    const q = "123456789012";
    const queries = buildExpenseListQueries(viewer(), filters({ q }), noIds);
    expect(queries).toContain(Query.search("description", q));
  });

  test("q=5 uses description search", () => {
    const queries = buildExpenseListQueries(
      viewer(),
      filters({ q: "5" }),
      noIds
    );
    expect(queries).toContain(Query.search("description", "5"));
  });

  test("a campus filter is ANDed with the visibility queries", () => {
    const queries = buildExpenseListQueries(
      viewer({
        isCampusAdmin: true,
        isGlobalAdmin: false,
        managedCampusIds: ["1"],
      }),
      filters({ campusId: "2" }),
      noIds
    );
    expect(queries).toContain(Query.equal("campus", ["1"]));
    expect(queries).toContain(Query.equal("campus", "2"));
  });
});

const expenseRow = {
  $createdAt: "2026-01-01T00:00:00.000Z",
  $id: "e1",
  $sequence: "7",
  approver_hints: JSON.stringify([
    { code: "old_receipt" },
    { code: "amount_differs" },
  ]),
  campusRel: { name: "Oslo" },
  departmentRel: { Name: "IT" },
  status: "pending",
  total: 100,
  user: { name: "Ann" },
};

describe("listExpenses", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  test("enriches rows with step, issue flag and hint count", async () => {
    db.listRows.mockImplementation((_d: string, table: string) => {
      if (table === "expense") {
        return { rows: [expenseRow], total: 1 };
      }
      if (table === "expense_approvals") {
        return {
          rows: [
            {
              $id: "s2",
              approver_email: "b@biso.no",
              approver_role: "finance",
              expense_id: "e1",
              status: "pending",
              step: 2,
            },
            {
              $id: "s1",
              approver_email: "a@biso.no",
              approver_role: "manager",
              expense_id: "e1",
              status: "pending",
              step: 1,
            },
          ],
        };
      }
      return { rows: [{ expense_id: "e1" }] };
    });
    const result = await listExpenses(viewer(), filters());
    expect(result.rows[0]).toMatchObject({
      currentStep: { approverEmail: "a@biso.no", role: "manager" },
      flags: { approverIssue: true, failed: false, hints: 2 },
      reference: "10007",
    });
  });

  test("falls back to description search when the sequence query throws", async () => {
    const errorSpy = mock();
    const original = console.error;
    console.error = errorSpy;
    const seen: string[][] = [];
    db.listRows.mockImplementation(
      (_d: string, table: string, queries: string[]) => {
        if (table !== "expense") {
          return { rows: [] };
        }
        seen.push(queries);
        if (queries.includes(Query.equal("$sequence", 42))) {
          throw new Error("invalid query");
        }
        return { rows: [], total: 0 };
      }
    );
    try {
      await listExpenses(viewer(), filters({ q: "10042" }));
    } finally {
      console.error = original;
    }
    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain(Query.search("description", "10042"));
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("getExpenseDetail", () => {
  test("returns null for a draft", async () => {
    db.getRow.mockResolvedValue({
      $id: "ex1",
      status: "draft",
      userId: "u1",
    });
    expect(await getExpenseDetail(viewer(), "ex1")).toBeNull();
  });

  test("returns null when the expense is missing", async () => {
    db.getRow.mockRejectedValue(Object.assign(new Error("nf"), { code: 404 }));
    expect(await getExpenseDetail(viewer(), "ex1")).toBeNull();
  });
});
