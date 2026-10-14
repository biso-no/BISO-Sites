import { describe, expect, test } from "bun:test";
import type { WorkspaceCandidate } from "../view-model";
import { PIPELINE_SORTS, sortCandidates } from "./sort";

const candidate = (
  patch: Partial<WorkspaceCandidate> & { id: string }
): WorkspaceCandidate =>
  ({
    appliedAt: "2026-10-01T10:00:00.000Z",
    name: "Anna",
    score: null,
    scorecard: null,
    ...patch,
  }) as WorkspaceCandidate;

const ROWS = [
  candidate({
    appliedAt: "2026-10-01T10:00:00.000Z",
    id: "old",
    name: "Zed",
    score: 40,
  }),
  candidate({
    appliedAt: "2026-10-03T10:00:00.000Z",
    id: "new",
    name: "Anna",
    score: 90,
  }),
  candidate({
    appliedAt: "2026-10-02T10:00:00.000Z",
    id: "mid",
    name: "Kari",
    score: null,
    scorecard: { overall: 4.5 } as WorkspaceCandidate["scorecard"],
  }),
];

const ids = (rows: WorkspaceCandidate[]) => rows.map((row) => row.id);

describe("sortCandidates", () => {
  test("defaults to newest application first, not the AI score", () => {
    // HR asked for control: the board sorted by AI match on its own.
    expect(PIPELINE_SORTS[0].id).toBe("newest");
    expect(ids(sortCandidates(ROWS, "newest"))).toEqual(["new", "mid", "old"]);
  });

  test("sorts oldest first, by name, by match and by interview score on request", () => {
    expect(ids(sortCandidates(ROWS, "oldest"))).toEqual(["old", "mid", "new"]);
    expect(ids(sortCandidates(ROWS, "name"))).toEqual(["new", "mid", "old"]);
    // Unscored candidates sink to the bottom rather than sorting as zero.
    expect(ids(sortCandidates(ROWS, "match"))).toEqual(["new", "old", "mid"]);
    expect(ids(sortCandidates(ROWS, "interview"))).toEqual([
      "mid",
      "old",
      "new",
    ]);
  });

  test("does not mutate the input", () => {
    const copy = [...ROWS];
    sortCandidates(ROWS, "name");
    expect(ids(ROWS)).toEqual(ids(copy));
  });
});
