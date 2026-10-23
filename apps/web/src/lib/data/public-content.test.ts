import { beforeEach, describe, expect, it, vi } from "vitest";

const publicDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createPublicClient: vi.fn(async () => ({ db: publicDb })),
}));

const cache = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock("next/cache", () => cache);

import {
  cachedDepartmentById,
  cachedDepartmentBySlugAndCampus,
  cachedDepartmentsBySlug,
  cachedDepartmentTheme,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedPage,
} from "./public-content";

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

describe("cachedPartners", () => {
  it("orders by sort_order and tags partners", async () => {
    publicDb.listRows.mockReset();
    publicDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    await cachedPartners();
    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain(
      '"method":"orderAsc","attribute":"sort_order"'
    );
    expect(cache.cacheTag).toHaveBeenCalledWith("partners");
  });
});

describe("publish-refresh cache tags (C5)", () => {
  beforeEach(() => {
    publicDb.listRows.mockReset();
    publicDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    cache.cacheTag.mockClear();
  });

  it("tags the published page reader with pages", async () => {
    await cachedPublishedPage("about", "no").catch(() => null);
    expect(cache.cacheTag).toHaveBeenCalledWith("pages");
  });

  it("tags every department reader that carries theme columns", async () => {
    const readers = [
      () => cachedDepartmentTheme("d1"),
      () => cachedDepartmentsBySlug("s"),
      () => cachedDepartmentBySlugAndCampus("s", "c"),
      () => cachedDepartmentById("d1"),
    ];
    for (const read of readers) {
      cache.cacheTag.mockClear();
      await read();
      expect(cache.cacheTag).toHaveBeenCalledWith("departments");
    }
  });
});
