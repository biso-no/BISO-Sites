import { describe, expect, it, vi } from "vitest";
import {
  backfillScorecardInterviews,
  type ScorecardBackfillDb,
} from "./scorecard-interview-backfill";

interface Row {
  $id: string;
  [key: string]: unknown;
}

function makeDb(
  tables: Record<string, Row[]>,
  options: { failTable?: string } = {}
) {
  const updateRow = vi.fn(async (_params: unknown) => ({}));
  const listRows = vi.fn((params: { tableId: string; queries?: string[] }) => {
    if (params.tableId === options.failTable) {
      return Promise.reject(new Error("scan failed"));
    }
    const all = tables[params.tableId] ?? [];
    const queries = (params.queries ?? []).map((q) => JSON.parse(q));
    const after = queries.find((q) => q.method === "cursorAfter")?.values?.[0];
    const start = after ? all.findIndex((r) => r.$id === after) + 1 : 0;
    const limit = queries.find((q) => q.method === "limit")?.values?.[0];
    return Promise.resolve({
      rows: all.slice(start, start + (limit ?? 25)),
    });
  });
  const db: ScorecardBackfillDb = { listRows, updateRow };
  return { db, listRows, updateRow };
}

const interviews = [{ $id: "i1" }, { $id: "i2" }];

describe("backfillScorecardInterviews", () => {
  it("plans links for scorecards without a relationship but never writes in a dry run", async () => {
    const { db, updateRow } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: [
        { $id: "s1", interview_id: "i1", interview: null },
        { $id: "s2", interview_id: "i2", interview: "i2" },
        { $id: "s3", interview_id: "i2", interview: { $id: "i2" } },
      ],
    });
    const report = await backfillScorecardInterviews(db, { apply: false });
    expect(report.scanned).toEqual({ interviews: 2, scorecards: 3 });
    expect(report.links).toEqual([{ interviewId: "i1", scorecardId: "s1" }]);
    expect(report.orphans).toEqual([]);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("sets the relationship when applying", async () => {
    const { db, updateRow } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: [
        { $id: "s1", interview_id: "i1" },
        { $id: "s2", interview_id: "i2", interview: "i2" },
      ],
    });
    const report = await backfillScorecardInterviews(db, { apply: true });
    expect(updateRow).toHaveBeenCalledTimes(1);
    expect(updateRow).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "job_interview_scorecards",
      rowId: "s1",
      data: { interview: "i1" },
    });
    expect(report.applied).toBe(1);
    expect(report.errors).toEqual([]);
  });

  it("selects the relationship explicitly so linked scorecards are recognised", async () => {
    const { db, listRows } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: [
        { $id: "s1", interview_id: "i1", interview: { $id: "i1" } },
      ],
    });
    const report = await backfillScorecardInterviews(db, { apply: false });
    expect(report.links).toEqual([]);
    const selects = listRows.mock.calls.map((call) => {
      const select = (call[0].queries ?? [])
        .map((q) => JSON.parse(q))
        .find((q) => q.method === "select");
      return [call[0].tableId, select?.values];
    });
    expect(selects).toEqual([
      ["job_interviews", ["$id"]],
      ["job_interview_scorecards", ["$id", "interview_id", "interview.$id"]],
    ]);
  });

  it("reports scorecards whose interview is gone as orphans and leaves them alone", async () => {
    const { db, updateRow } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: [
        { $id: "s1", interview_id: "gone" },
        { $id: "s2", interview_id: "" },
      ],
    });
    const report = await backfillScorecardInterviews(db, { apply: true });
    expect(report.orphans.map((o) => o.scorecardId)).toEqual(["s1", "s2"]);
    expect(report.links).toEqual([]);
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("pages through more than one page of rows", async () => {
    const scorecards = Array.from({ length: 230 }, (_, i) => ({
      $id: `s${i}`,
      interview_id: "i1",
    }));
    const { db } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: scorecards,
    });
    const report = await backfillScorecardInterviews(db, { apply: false });
    expect(report.scanned.scorecards).toBe(230);
    expect(report.links).toHaveLength(230);
  });

  it("writes nothing when a scan fails", async () => {
    for (const failTable of ["job_interviews", "job_interview_scorecards"]) {
      const { db, updateRow } = makeDb(
        {
          job_interviews: interviews,
          job_interview_scorecards: [{ $id: "s1", interview_id: "i1" }],
        },
        { failTable }
      );
      const report = await backfillScorecardInterviews(db, { apply: true });
      expect(report.scanFailed).toBe(true);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(updateRow).not.toHaveBeenCalled();
    }
  });

  it("records a failed update and keeps going", async () => {
    const { db, updateRow } = makeDb({
      job_interviews: interviews,
      job_interview_scorecards: [
        { $id: "s1", interview_id: "i1" },
        { $id: "s2", interview_id: "i2" },
      ],
    });
    updateRow.mockRejectedValueOnce(new Error("nope"));
    const report = await backfillScorecardInterviews(db, { apply: true });
    expect(updateRow).toHaveBeenCalledTimes(2);
    expect(report.applied).toBe(1);
    expect(report.errors).toEqual([{ message: "nope", rowId: "s1" }]);
  });
});
