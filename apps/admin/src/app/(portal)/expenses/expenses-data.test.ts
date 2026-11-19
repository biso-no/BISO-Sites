import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import { chainFailedIssueReason } from "@repo/shared/utils/expense-approvers";
import type { ExpenseViewer } from "@/lib/expense-access";

mock.module("server-only", () => ({}));
const db = { getRow: mock(), listRows: mock() };
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
const isFeatureEnabled = mock(async (_key: string) => true);
mock.module("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled,
}));

const {
  buildExpenseListQueries,
  getExpenseDetail,
  listExpenses,
  loadRebuildEvidence,
  resolveExpenseListFilters,
  withHintTypeLabels,
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

  test("mine adds its ids to the approver side of the visibility query", () => {
    const queries = buildExpenseListQueries(
      viewer({ isGlobalAdmin: false }),
      filters({ view: "mine" }),
      { ...noIds, approverExpenseIds: ["old"], mineExpenseIds: ["new"] }
    );
    expect(queries).toContain(Query.equal("$id", ["old", "new"]));
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

  test("an approver with over 100 approval rows still sees a new pending expense in mine", async () => {
    const old = Array.from({ length: 100 }, (_, i) => ({
      expense_id: `o${i}`,
    }));
    const calls: { table: string; queries: string[] }[] = [];
    db.listRows.mockImplementation(
      (_d: string, table: string, queries: string[]) => {
        calls.push({ table, queries });
        if (table === "expense") {
          return { rows: [], total: 0 };
        }
        if (table !== "expense_approvals") {
          return { rows: [] };
        }
        if (queries.includes(Query.equal("status", "pending"))) {
          return { rows: [{ expense_id: "new1" }] };
        }
        if (
          queries.some((q) => q.includes("expense_id") && q.includes("new1"))
        ) {
          return {
            rows: [
              {
                approver_email: "A@biso.no ",
                approver_role: "manager",
                expense_id: "new1",
                status: "pending",
                step: 1,
              },
            ],
          };
        }
        // The capped lookup: newest-first would include new1, the cap hides it.
        return { rows: old };
      }
    );
    await listExpenses(
      viewer({ isGlobalAdmin: false }),
      filters({ view: "mine" })
    );
    const expenseQueries = calls.find((c) => c.table === "expense")?.queries;
    expect(expenseQueries).toContain(
      Query.equal("$id", [...old.map((o) => o.expense_id), "new1"])
    );
    const viewerStepCalls = calls.filter(
      (c) =>
        c.table === "expense_approvals" &&
        c.queries.includes(Query.equal("approver_email", ["a@biso.no"]))
    );
    for (const call of viewerStepCalls) {
      expect(call.queries).toContain(Query.orderDesc("$createdAt"));
    }
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

describe("loadRebuildEvidence", () => {
  const issues = (reasons: string[]) =>
    db.listRows.mockResolvedValue({
      rows: reasons.map((reason) => ({ reason })),
    });

  test("finds the issue of a submission that found no approver", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    issues([
      "Approver is the submitter",
      "No approver could be resolved. The reimbursement is pending with no approval step.",
    ]);
    expect(await loadRebuildEvidence(db as never, "ex1")).toEqual({
      hasRebuildIssue: true,
      ledgerPosting: true,
    });
    expect(db.listRows.mock.calls.at(-1)?.[2]).toContainEqual(
      Query.equal("expense_id", "ex1")
    );
  });

  test("finds the issue of a chain that failed after the background check", async () => {
    isFeatureEnabled.mockResolvedValue(true);
    issues([chainFailedIssueReason("mail down")]);
    expect(await loadRebuildEvidence(db as never, "ex1")).toEqual({
      hasRebuildIssue: true,
      ledgerPosting: true,
    });
  });

  test("an emailed expense has no such issue; the flag is read", async () => {
    isFeatureEnabled.mockResolvedValue(false);
    issues([]);
    expect(await loadRebuildEvidence(db as never, "ex1")).toEqual({
      hasRebuildIssue: false,
      ledgerPosting: false,
    });
    expect(isFeatureEnabled).toHaveBeenCalledWith("expenses_ledger_posting");
  });
});

describe("withHintTypeLabels", () => {
  test("shows the type's label for the slug in ai_check_disagrees, in the viewer's language", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ label: "Food", label_no: "Mat", slug: "food" }],
    });
    const hints = [
      { code: "ai_check_disagrees" as const, data: { aiType: "food" } },
      { code: "ai_check_disagrees" as const, data: { aiType: "retired" } },
      { code: "occasion_missing" as const },
    ];
    expect(await withHintTypeLabels(db as never, hints, "no")).toEqual([
      { code: "ai_check_disagrees", data: { aiType: "Mat" } },
      { code: "ai_check_disagrees", data: { aiType: "retired" } },
      { code: "occasion_missing" },
    ]);
  });

  test("reads nothing when no hint names a type", async () => {
    db.listRows.mockReset();
    const hints = [{ code: "occasion_missing" as const }];
    expect(await withHintTypeLabels(db as never, hints, "en")).toBe(hints);
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
