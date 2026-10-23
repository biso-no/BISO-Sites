import { describe, expect, it, vi } from "vitest";
import {
  readPageDepartmentsFeed,
  readPageEventsFeed,
  readPageJobsFeed,
  readPageNewsFeed,
  readPagePartnersFeed,
} from "./page-feeds";

function departmentRow(id: number) {
  return {
    $id: `d-${id}`,
    Id: `${id}`,
    Name: `Department ${id}`,
    campus_id: "1",
    logo: null,
    slug: `dept-${id}`,
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
      campusLabel: "Oslo",
      href: "/units/oslo/dept-7",
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

describe("readPagePartnersFeed", () => {
  it("selects sort_order and orders by it", async () => {
    const db = fakeDb({ rows: [], total: 0 });
    await readPagePartnersFeed(db as never);
    const queries = (
      (db as unknown as { listRows: ReturnType<typeof vi.fn> }).listRows.mock
        .calls[0][2] as string[]
    ).join("|");
    expect(queries).toContain("sort_order");
    expect(queries).toContain('"method":"orderAsc","attribute":"sort_order"');
  });
});

function limitOf(db: ReturnType<typeof fakeDb>): number | undefined {
  const [, , queries] = (db.listRows as unknown as ReturnType<typeof vi.fn>)
    .mock.calls[0];
  return (queries as string[])
    .map((q) => JSON.parse(q) as { method: string; values?: number[] })
    .find((q) => q.method === "limit")?.values?.[0];
}

describe("readPageEventsFeed", () => {
  const row = {
    $id: "e-1",
    category: "SOCIAL",
    image: "https://cdn.example/e.jpg",
    location: "Campus",
    member_only: true,
    slug: "spring party",
    start_date: "2027-02-11T09:00:00+01:00",
    ticket_url: "https://tickets.example/1",
    translation_refs: [{ locale: "no", title: "Vårfest" }],
  };

  it("maps slug, image and start_date onto href, image and startsAt", async () => {
    const [item] = await readPageEventsFeed(
      fakeDb({ rows: [row], total: 1 }),
      "d-1",
      "no"
    );
    expect(item).toMatchObject({
      category: "SOCIAL",
      href: "/events/spring%20party",
      id: "e-1",
      image: "https://cdn.example/e.jpg",
      memberOnly: true,
      startsAt: "2027-02-11T08:00:00.000Z",
      ticketUrl: "https://tickets.example/1",
      title: "Vårfest",
      where: "Campus",
    });
    expect(item?.date).not.toBe("");
  });

  it("leaves href off a row without a slug", async () => {
    const [item] = await readPageEventsFeed(
      fakeDb({ rows: [{ ...row, slug: null }], total: 1 }),
      "d-1",
      "no"
    );
    expect(item?.href).toBeUndefined();
  });

  it("honours limit, clamped to 1..12, default 6", async () => {
    const limits: (number | undefined)[] = [];
    for (const requested of [3, 50, 0, undefined]) {
      const db = fakeDb({ rows: [], total: 0 });
      await readPageEventsFeed(db, "d-1", "no", requested);
      limits.push(limitOf(db));
    }
    expect(limits).toEqual([3, 12, 1, 6]);
  });
});

describe("readPageNewsFeed", () => {
  it("adds id, href, publishedAtIso and image", async () => {
    const db = fakeDb({
      rows: [
        {
          $createdAt: "2027-01-05T10:00:00.000Z",
          $id: "n-1",
          image: null,
          slug: "hello",
          translation_refs: [{ locale: "no", title: "Hei" }],
        },
      ],
      total: 1,
    });
    const [item] = await readPageNewsFeed(db, "d-1", "no", 2);
    expect(item).toMatchObject({
      href: "/news/hello",
      id: "n-1",
      publishedAtIso: "2027-01-05T10:00:00.000Z",
      title: "Hei",
    });
    expect(item?.image).toBeUndefined();
    expect(limitOf(db)).toBe(2);
  });
});

describe("readPageJobsFeed", () => {
  it("adds id, href, deadlineIso, paid and employmentType", async () => {
    const db = fakeDb({
      rows: [
        {
          $id: "j-1",
          application_deadline: "2999-01-01T00:00:00.000Z",
          metadata: JSON.stringify({
            employment_type: "Part-time",
            paid: true,
          }),
          slug: "editor",
          status: "published",
          translations: [{ locale: "no", title: "Redaktør" }],
        },
      ],
      total: 1,
    });
    const [item] = await readPageJobsFeed(db, "d-1", "no");
    expect(item).toMatchObject({
      commitment: "Part-time",
      deadlineIso: "2999-01-01T00:00:00.000Z",
      employmentType: "Part-time",
      href: "/jobs/editor",
      id: "j-1",
      paid: true,
    });
  });
});
