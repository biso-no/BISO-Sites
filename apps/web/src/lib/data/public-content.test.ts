import { beforeEach, describe, expect, it, vi } from "vitest";

const publicDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createPublicClient: vi.fn(async () => ({ db: publicDb })),
}));

vi.mock("next/cache", () => ({ cacheLife: vi.fn() }));

import { cachedPublishedEvents } from "./public-content";

const queriesOf = (call: number): string[] =>
  publicDb.listRows.mock.calls[call][2].map(String);

describe("cachedPublishedEvents", () => {
  beforeEach(() => {
    publicDb.listRows.mockReset();
    publicDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("hides finished events, like the feed session holders get", async () => {
    // The home page serves this reader to visitors without a session and
    // `listEvents({ upcomingOnly: true })` to everyone else. Without the same
    // predicate here, logged-out visitors alone were shown expired events.
    await cachedPublishedEvents("no", null, 12);

    const serialized = queriesOf(0).join("|");
    // `EVENT_SELECT` projects both date columns, so pin the filter shape
    // rather than the bare column names.
    expect(serialized).toContain(
      '"method":"greaterThanEqual","attribute":"end_date"'
    );
    expect(serialized).toContain('"method":"isNull","attribute":"end_date"');
  });

  it("lists the soonest events first", async () => {
    await cachedPublishedEvents("no", null, 12);

    expect(queriesOf(0).join("|")).toContain(
      '"method":"orderAsc","attribute":"start_date"'
    );
  });
});
