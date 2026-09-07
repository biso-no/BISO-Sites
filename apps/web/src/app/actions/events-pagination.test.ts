import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { listEvents } from "./events";

const queriesOf = (call: number): string[] =>
  sessionDb.listRows.mock.calls[call][2].map(String);

describe("listEvents pagination", () => {
  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("expresses 'not finished yet' as a query, keeping undated rows", async () => {
    await listEvents({ upcomingOnly: true });

    const serialized = queriesOf(0).join("|");
    // `EVENT_SELECT` also projects "end_date"/"start_date"/"isNull"-free
    // column names, so a bare substring check would pass even with the
    // upcoming-only predicate deleted — pin the actual filter shape instead.
    expect(serialized).toContain('"method":"and"');
    expect(serialized).toContain('"attribute":"end_date"');
    expect(serialized).toContain('"attribute":"start_date"');
    // Rows with neither date must survive, so the or() needs an isNull arm
    // scoped to end_date specifically (not the unrelated member_only isNull).
    expect(serialized).toContain('"method":"isNull","attribute":"end_date"');
  });

  it("lists member-only events for everyone, members or not", async () => {
    await listEvents({});

    // Member-only events are advertising for the membership: they are listed
    // to every visitor and labelled in the UI ("Members only" + the
    // participation notice) instead of being filtered out. The column stays in
    // the Query.select projection, so "member_only" alone would match either
    // way — pin the *filter* shape, which is what must not come back.
    const serialized = queriesOf(0).join("|");
    expect(serialized).not.toContain(
      '"method":"equal","attribute":"member_only"'
    );
    expect(serialized).not.toContain(
      '"method":"isNull","attribute":"member_only"'
    );
  });

  it("shows only collections and standalone events", async () => {
    await listEvents({});

    const serialized = queriesOf(0).join("|");
    // Both column names are also in the select projection — pin the filter
    // attribute key so this fails if the collection-scoping or() is deleted.
    expect(serialized).toContain('"attribute":"is_collection"');
    expect(serialized).toContain('"attribute":"collection_id"');
  });

  it("filters by the real category column", async () => {
    await listEvents({ category: "career" });

    expect(queriesOf(0).join("|")).toContain("career");
  });

  it("searches via content_translations, never through the relationship", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "e1" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    await listEvents({ search: "gala", locale: "en" });

    expect(sessionDb.listRows.mock.calls[0][1]).toBe("content_translations");
    // The live bug: Query.search on translation_refs.title is rejected by
    // Appwrite and the catch swallowed it, so search returned nothing. The
    // events select also projects the "translation_refs.title" column name,
    // so pin the method+attribute pair a real Query.search would serialize
    // as, not the bare column name.
    expect(queriesOf(1).join("|")).not.toContain(
      '"method":"search","attribute":"translation_refs.title"'
    );
    expect(queriesOf(1).join("|")).toContain("e1");
  });

  it("reports Appwrite's total, not the page length", async () => {
    sessionDb.listRows.mockResolvedValue({
      rows: [{ $id: "e1", translation_refs: [] }],
      total: 3,
    });

    const result = await listEvents({ page: 1 });

    expect(result.total).toBe(3);
    expect(result.size).toBe(12);
  });

  it("propagates capped from phase 1 search to the result", async () => {
    // Fill phase 1 past SEARCH_CANDIDATE_CAP (500) so findContentIdsBySearch
    // reports capped: true, then confirm queryEvents/listEvents don't
    // hardcode `capped: false` over it (Task 8 fix round 1, finding 2).
    sessionDb.listRows
      .mockResolvedValueOnce({
        rows: Array.from({ length: 500 }, (_, i) => ({ content_id: `e${i}` })),
        total: 900,
      })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    const result = await listEvents({ search: "gala" });

    expect(result.capped).toBe(true);
  });

  it("reports capped: false when phase 1 search stays under the cap", async () => {
    sessionDb.listRows
      .mockResolvedValueOnce({ rows: [{ content_id: "e1" }], total: 1 })
      .mockResolvedValueOnce({ rows: [], total: 0 });

    const result = await listEvents({ search: "gala" });

    expect(result.capped).toBe(false);
  });
});
