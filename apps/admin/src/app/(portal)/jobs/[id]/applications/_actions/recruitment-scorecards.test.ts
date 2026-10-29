import { describe, expect, mock, test } from "bun:test";
import { loadScorecardsForInterviews } from "./recruitment-scorecards";

function makeDb(impl: (queries: string[]) => { rows: unknown[] }) {
  const listRows = mock(
    async (_db: string, _table: string, queries: string[]) => impl(queries)
  );
  return {
    db: { listRows } as unknown as Parameters<
      typeof loadScorecardsForInterviews
    >[0],
    listRows,
  };
}

describe("loadScorecardsForInterviews", () => {
  test("finds scorecards by interview_id and groups them by application", async () => {
    const { db, listRows } = makeDb(() => ({
      rows: [
        { $id: "s1", application_id: "a1", interview_id: "i1" },
        { $id: "s2", application_id: "a1", interview_id: "i2" },
        { $id: "s3", application_id: "a2", interview_id: "i3" },
      ],
    }));
    const map = await loadScorecardsForInterviews(db, ["i1", "i2", "i3"]);
    expect(map.get("a1")?.map((s) => s.$id)).toEqual(["s1", "s2"]);
    expect(map.get("a2")?.map((s) => s.$id)).toEqual(["s3"]);
    expect(listRows).toHaveBeenCalledTimes(1);
    expect(listRows.mock.calls[0]?.[1]).toBe("job_interview_scorecards");
    const queries = JSON.stringify(listRows.mock.calls[0]?.[2]);
    expect(queries).toContain("interview_id");
    expect(queries).not.toContain("interview.job_id");
  });

  test("queries at most 100 interview ids at a time", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `i${i}`);
    const { db, listRows } = makeDb(() => ({ rows: [] }));
    await loadScorecardsForInterviews(db, ids);
    expect(listRows).toHaveBeenCalledTimes(3);
  });

  test("pages through a chunk with more scorecards than one page", async () => {
    const full = Array.from({ length: 500 }, (_, i) => ({
      $id: `s${String(i).padStart(4, "0")}`,
      application_id: "a1",
    }));
    const tail = [{ $id: "s9999", application_id: "a2" }];
    let call = 0;
    const { db, listRows } = makeDb(() => {
      call += 1;
      return { rows: call === 1 ? full : tail };
    });
    const map = await loadScorecardsForInterviews(db, ["i1"]);
    expect(listRows).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(listRows.mock.calls[1]?.[2])).toContain("s0499");
    expect(map.get("a1")).toHaveLength(500);
    expect(map.get("a2")).toHaveLength(1);
  });

  test("makes no query without interviews", async () => {
    const { db, listRows } = makeDb(() => ({ rows: [] }));
    const map = await loadScorecardsForInterviews(db, []);
    expect(map.size).toBe(0);
    expect(listRows).not.toHaveBeenCalled();
  });

  test("logs a failed query and returns an empty map", async () => {
    const error = mock(() => undefined);
    const original = console.error;
    console.error = error;
    try {
      const { db } = makeDb(() => {
        throw new Error("boom");
      });
      const map = await loadScorecardsForInterviews(db, ["i1"]);
      expect(map.size).toBe(0);
      expect(error).toHaveBeenCalled();
    } finally {
      console.error = original;
    }
  });
});
