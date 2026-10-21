import { describe, expect, it, vi } from "vitest";
import { backfillLocks } from "./content-notification-backfill";
import { channelFor, lockRowIdFor } from "./content-notifications";

const PAGE = 2;

interface Row {
  $id: string;
  campus_id?: string | null;
}

function fakeListPublished(tables: Record<string, Row[]>) {
  return vi.fn((table: string, cursor: string | null) => {
    const rows = tables[table] ?? [];
    const start = cursor ? rows.findIndex((r) => r.$id === cursor) + 1 : 0;
    const slice = rows.slice(start, start + PAGE);
    const last = slice.at(-1);
    return Promise.resolve({
      rows: slice,
      nextCursor: slice.length === PAGE && last ? last.$id : null,
    });
  });
}

describe("backfillLocks", () => {
  it("creates one skipped lock per published row across tables with paging", async () => {
    const listPublished = fakeListPublished({
      events: [{ $id: "e1", campus_id: "oslo" }, { $id: "e2" }, { $id: "e3" }],
      news: [{ $id: "n1", campus_id: "bergen" }],
      jobs: [{ $id: "j1" }, { $id: "j2" }],
    });
    const createLock = vi.fn(() => Promise.resolve("created" as const));

    const result = await backfillLocks(
      { listPublished, createLock },
      { dryRun: false }
    );

    expect(result).toEqual({ created: 6, existing: 0 });
    expect(createLock).toHaveBeenCalledTimes(6);
    expect(createLock).toHaveBeenCalledWith(lockRowIdFor("event", "e1"), {
      content_type: "event",
      content_id: "e1",
      campus_id: "oslo",
      channel: channelFor("event", "oslo"),
      status: "skipped",
      reason: "existed before launch",
    });
    expect(createLock).toHaveBeenCalledWith(
      lockRowIdFor("job", "j2"),
      expect.objectContaining({ content_type: "job", campus_id: null })
    );
  });

  it("counts existing locks without touching them", async () => {
    const listPublished = fakeListPublished({
      events: [{ $id: "e1" }, { $id: "e2" }],
      news: [],
      jobs: [],
    });
    const createLock = vi.fn((id: string) =>
      Promise.resolve(id === lockRowIdFor("event", "e1") ? "exists" : "created")
    );

    const result = await backfillLocks(
      { listPublished, createLock: createLock as never },
      { dryRun: false }
    );

    expect(result).toEqual({ created: 1, existing: 1 });
  });

  it("dry run creates nothing but reports counts", async () => {
    const listPublished = fakeListPublished({
      events: [{ $id: "e1" }],
      news: [{ $id: "n1" }],
      jobs: [],
    });
    const createLock = vi.fn(() => Promise.resolve("created" as const));

    const result = await backfillLocks(
      { listPublished, createLock },
      { dryRun: true }
    );

    expect(createLock).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 2, existing: 0 });
  });
});
