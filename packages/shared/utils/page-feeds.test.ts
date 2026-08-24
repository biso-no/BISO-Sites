import { describe, expect, it, vi } from "vitest";
import { readPageDepartmentsFeed } from "./page-feeds";

function departmentRow(id: number) {
  return {
    $id: `d-${id}`,
    Id: `${id}`,
    Name: `Department ${id}`,
    campus_id: "1",
    logo: null,
    type: "unit",
  };
}

function fakeDb(result: { rows: unknown[]; total: number }) {
  return {
    listRows: vi.fn().mockResolvedValue(result),
  } as unknown as Parameters<typeof readPageDepartmentsFeed>[0];
}

describe("readPageDepartmentsFeed", () => {
  it("reports Appwrite's total, not the size of the returned page", async () => {
    // Appwrite's `total` counts every row matching the query and ignores
    // limit/offset — verified against 1.9.6, where the same filters report the
    // full count whether the limit is 2 or 500. `DEPARTMENT_LIMIT` now exceeds
    // the real row count, so the two agree in practice; this asserts the
    // reader still keeps them apart, which is what would make a future
    // overflow visible rather than silent.
    const rows = Array.from({ length: 100 }, (_, i) => departmentRow(i));
    const db = fakeDb({ rows, total: 134 });

    const feed = await readPageDepartmentsFeed(db);

    expect(feed.departments).toHaveLength(100);
    expect(feed.total).toBe(134);
  });

  it("asks for more departments than the table can hold", async () => {
    // The block renders every card it is given and has no pagination, so the
    // query limit is the only thing standing between the page and a silently
    // truncated department list. At 100 it dropped 34 of 134 active rows —
    // alphabetically, so an entire campus prefix vanished.
    const db = fakeDb({ rows: [], total: 0 });
    await readPageDepartmentsFeed(db);
    const [, , queries] = (db.listRows as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0];

    const limit = (queries as string[])
      .map((q) => JSON.parse(q) as { method: string; values?: number[] })
      .find((q) => q.method === "limit");

    expect(limit?.values?.[0]).toBeGreaterThanOrEqual(300);
  });

  it("maps a department row onto the block's shape", async () => {
    const db = fakeDb({ rows: [departmentRow(7)], total: 1 });

    const feed = await readPageDepartmentsFeed(db);

    expect(feed.departments[0]).toEqual({
      campusId: "1",
      id: "d-7",
      internalId: "7",
      logo: null,
      name: "Department 7",
      type: "unit",
    });
  });

  it("filters by campus and type only when asked", async () => {
    // Asserted on the `equal` filters, not on a substring of the whole query
    // list: `campus_id` also appears in the `select` projection either way.
    const equalFilters = async (campusId?: string, type?: string) => {
      const db = fakeDb({ rows: [], total: 0 });
      await readPageDepartmentsFeed(db, campusId ?? null, type ?? null);
      const [, , queries] = (db.listRows as unknown as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      return (queries as string[])
        .map((q) => JSON.parse(q) as { attribute?: string; method: string })
        .filter((q) => q.method === "equal")
        .map((q) => q.attribute);
    };

    expect(await equalFilters()).toEqual(["active"]);
    expect(await equalFilters("2", "unit")).toEqual([
      "active",
      "campus_id",
      "type",
    ]);
  });
});
