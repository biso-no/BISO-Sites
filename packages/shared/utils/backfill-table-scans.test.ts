import { describe, expect, it } from "vitest";
import { migratePageDrafts } from "./page-draft-migration";
import { reconcileRowPermissions } from "./row-permission-reconcile";
import { backfillScorecardInterviews } from "./scorecard-interview-backfill";

// Pins how the one-off backfills page through a table and how they report a
// failure that is not an `Error`, shared by all three scripts.

interface Row {
  $id: string;
  $permissions: string[];
  [key: string]: unknown;
}

interface ListCall {
  queries: unknown[];
  tableId: string;
}

const LIMIT = { method: "limit", values: [100] };

function cursorAfter(id: string) {
  return { method: "cursorAfter", values: [id] };
}

function rowIds(prefix: string, count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    $id: `${prefix}${String(i).padStart(3, "0")}`,
    $permissions: [],
  }));
}

function makeDb(
  tables: Record<string, Row[]>,
  failure: { tableId?: string; value?: unknown } = {}
) {
  const calls: ListCall[] = [];
  const db = {
    createRow: () => Promise.resolve({}),
    getRow: () => Promise.reject(failure.value),
    listRows(params: {
      databaseId: string;
      tableId: string;
      queries?: string[];
    }) {
      const queries = (params.queries ?? []).map((q) => JSON.parse(q));
      calls.push({ queries, tableId: params.tableId });
      if (params.tableId === failure.tableId) {
        return Promise.reject(failure.value);
      }
      const all = tables[params.tableId] ?? [];
      const after = queries.find((q) => q.method === "cursorAfter")?.values[0];
      const start = after ? all.findIndex((r) => r.$id === after) + 1 : 0;
      const limit = queries.find((q) => q.method === "limit")?.values[0];
      return Promise.resolve({ rows: all.slice(start, start + limit) });
    },
    updateRow: () => Promise.reject(failure.value),
  };
  return { calls, db };
}

function callsFor(calls: ListCall[], tableId: string) {
  return calls.filter((call) => call.tableId === tableId).map((c) => c.queries);
}

describe("page draft migration scans", () => {
  it("asks 100 rows at a time and stops after a short page", async () => {
    const { calls, db } = makeDb({ page_drafts: rowIds("d", 100) });
    await migratePageDrafts(db, { apply: false });
    expect(calls.map((call) => call.tableId)).toEqual([
      "page_drafts",
      "page_drafts",
      "page_translations",
    ]);
    expect(callsFor(calls, "page_drafts")).toEqual([
      [LIMIT],
      [LIMIT, cursorAfter("d099")],
    ]);
    expect(callsFor(calls, "page_translations")).toEqual([[LIMIT]]);
  });

  it("reports a failure that is not an Error as text", async () => {
    const { db } = makeDb(
      {},
      { tableId: "page_drafts", value: "plain failure" }
    );
    const report = await migratePageDrafts(db, { apply: false });
    expect(report.errors).toEqual([
      { message: "plain failure", tableId: "page_drafts" },
    ]);
  });
});

describe("row permission reconcile scans", () => {
  it("asks 100 rows at a time and stops after a short page", async () => {
    const { calls, db } = makeDb({ departments: rowIds("x", 100) });
    await reconcileRowPermissions(db, { apply: false });
    expect(callsFor(calls, "departments")).toEqual([
      [LIMIT],
      [LIMIT, cursorAfter("x099")],
    ]);
    const others = calls.filter((call) => call.tableId !== "departments");
    expect(others.map((call) => call.tableId)).toEqual([
      "news",
      "webshop_products",
      "jobs",
      "pages",
      "page_translations",
      "campus_benefits",
      "events",
      "content_translations",
    ]);
    for (const call of others) {
      expect(call.queries).toEqual([LIMIT]);
    }
  });

  it("reports a failure that is not an Error as text", async () => {
    const { db } = makeDb({}, { tableId: "news", value: 503 });
    const report = await reconcileRowPermissions(db, { apply: false });
    expect(report.errors).toEqual([{ message: "503", tableId: "news" }]);
  });
});

describe("scorecard interview backfill scans", () => {
  it("selects each table's columns before the page size and cursor", async () => {
    const { calls, db } = makeDb({ job_interviews: rowIds("i", 100) });
    await backfillScorecardInterviews(db, { apply: false });
    const interviewSelect = { method: "select", values: ["$id"] };
    expect(callsFor(calls, "job_interviews")).toEqual([
      [interviewSelect, LIMIT],
      [interviewSelect, LIMIT, cursorAfter("i099")],
    ]);
    expect(callsFor(calls, "job_interview_scorecards")).toEqual([
      [
        {
          method: "select",
          values: ["$id", "interview_id", "interview.$id"],
        },
        LIMIT,
      ],
    ]);
  });

  it("reports failures that are not Errors as text", async () => {
    const scanFailure = makeDb(
      {},
      { tableId: "job_interviews", value: "plain failure" }
    );
    const scanReport = await backfillScorecardInterviews(scanFailure.db, {
      apply: false,
    });
    expect(scanReport.errors).toEqual([
      { message: "plain failure", tableId: "job_interviews" },
    ]);

    const writeFailure = makeDb(
      {
        job_interview_scorecards: [
          { $id: "s1", $permissions: [], interview_id: "i1" },
        ],
        job_interviews: [{ $id: "i1", $permissions: [] }],
      },
      { value: null }
    );
    const writeReport = await backfillScorecardInterviews(writeFailure.db, {
      apply: true,
    });
    expect(writeReport.errors).toEqual([{ message: "null", rowId: "s1" }]);
  });
});
