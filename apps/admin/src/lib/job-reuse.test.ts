import { describe, expect, it } from "bun:test";
import { JobsStatus } from "@repo/api/types/appwrite";
import { buildDuplicateSlugCandidates, describeJobReuse } from "./job-reuse";

const NOW = new Date("2026-09-28T12:00:00Z");
const PAST = "2025-09-01T21:59:00.000Z";
const FUTURE = "2026-10-15T21:59:00.000Z";

describe("describeJobReuse", () => {
  it("does not nag on a live vacancy still taking applications", () => {
    const signals = describeJobReuse({
      applicationCount: 12,
      applicationDeadline: FUTURE,
      now: NOW,
      status: JobsStatus.PUBLISHED,
    });
    expect(signals.suggestDuplicate).toBe(false);
    expect(signals.reasons).toEqual(["has_applications"]);
  });

  it("does not nag on a fresh draft", () => {
    const signals = describeJobReuse({
      applicationCount: 0,
      applicationDeadline: null,
      now: NOW,
      status: JobsStatus.DRAFT,
    });
    expect(signals.suggestDuplicate).toBe(false);
    expect(signals.reasons).toEqual([]);
  });

  it("suggests duplicating a closed vacancy", () => {
    const signals = describeJobReuse({
      applicationCount: 0,
      applicationDeadline: null,
      now: NOW,
      status: JobsStatus.CLOSED,
    });
    expect(signals.suggestDuplicate).toBe(true);
    expect(signals.reasons).toEqual(["closed"]);
  });

  it("suggests duplicating once the deadline has passed", () => {
    const signals = describeJobReuse({
      applicationCount: 8,
      applicationDeadline: PAST,
      now: NOW,
      status: JobsStatus.PUBLISHED,
    });
    expect(signals.suggestDuplicate).toBe(true);
    expect(signals.reasons).toEqual(["deadline_passed", "has_applications"]);
  });

  it("suggests duplicating an unpublished vacancy that has applicants", () => {
    const signals = describeJobReuse({
      applicationCount: 3,
      applicationDeadline: FUTURE,
      now: NOW,
      status: JobsStatus.DRAFT,
    });
    expect(signals.suggestDuplicate).toBe(true);
  });

  it("ignores an unparseable deadline", () => {
    const signals = describeJobReuse({
      applicationCount: 0,
      applicationDeadline: "not-a-date",
      now: NOW,
      status: JobsStatus.PUBLISHED,
    });
    expect(signals.suggestDuplicate).toBe(false);
  });
});

describe("buildDuplicateSlugCandidates", () => {
  it("swaps a trailing year for the new one", () => {
    expect(buildDuplicateSlugCandidates("styremedlem-2025", 2026, 3)).toEqual([
      "styremedlem-2026",
      "styremedlem-2026-2",
      "styremedlem-2026-3",
    ]);
  });

  it("appends the year when the slug has none", () => {
    expect(buildDuplicateSlugCandidates("event-manager", 2026, 1)).toEqual([
      "event-manager-2026",
    ]);
  });

  it("strips earlier copy suffixes", () => {
    expect(buildDuplicateSlugCandidates("board-2025-copy-2", 2026, 1)).toEqual([
      "board-2026",
    ]);
    expect(buildDuplicateSlugCandidates("board-2026-3", 2026, 1)).toEqual([
      "board-2026",
    ]);
  });

  it("falls back when the slug is only a year", () => {
    expect(buildDuplicateSlugCandidates("2025", 2026, 1)).toEqual([
      "2025-2026",
    ]);
  });
});
