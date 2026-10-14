import type { WorkspaceCandidate } from "../view-model";

export type PipelineSortId =
  | "newest"
  | "oldest"
  | "name"
  | "match"
  | "interview";

/** Sort options in the order the toolbar lists them; the first is the default. */
export const PIPELINE_SORTS: { id: PipelineSortId; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name A–Z" },
  { id: "match", label: "AI match" },
  { id: "interview", label: "Interview score" },
];

const appliedAt = (candidate: WorkspaceCandidate) =>
  new Date(candidate.appliedAt).getTime();

/** Descending by a score; candidates without one go last. */
const byScoreDesc =
  (score: (candidate: WorkspaceCandidate) => number | null | undefined) =>
  (a: WorkspaceCandidate, b: WorkspaceCandidate) => {
    const left = score(a);
    const right = score(b);
    if (left == null && right == null) {
      return 0;
    }
    if (left == null) {
      return 1;
    }
    if (right == null) {
      return -1;
    }
    return right - left;
  };

const COMPARATORS: Record<
  PipelineSortId,
  (a: WorkspaceCandidate, b: WorkspaceCandidate) => number
> = {
  interview: byScoreDesc((c) => c.scorecard?.overall ?? null),
  match: byScoreDesc((c) => c.score),
  name: (a, b) => a.name.localeCompare(b.name, "nb"),
  newest: (a, b) => appliedAt(b) - appliedAt(a),
  oldest: (a, b) => appliedAt(a) - appliedAt(b),
};

/**
 * Order candidates the way HR asked for. Nothing reorders on its own: the
 * AI match score is one option among several, never the default.
 */
export function sortCandidates(
  rows: WorkspaceCandidate[],
  sort: PipelineSortId
): WorkspaceCandidate[] {
  return [...rows].sort(COMPARATORS[sort]);
}
