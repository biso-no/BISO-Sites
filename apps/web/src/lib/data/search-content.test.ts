import { beforeEach, describe, expect, it, vi } from "vitest";
import { findContentIdsBySearch } from "./search-content";

const db = { listRows: vi.fn() };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDb = () => db as any;

describe("findContentIdsBySearch", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  it("returns no ids and issues no query for a blank search", async () => {
    const result = await findContentIdsBySearch(asDb(), "job", "   ", "en");

    expect(result).toEqual({ ids: [], capped: false });
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("searches title and description on content_translations", async () => {
    db.listRows.mockResolvedValue({ rows: [{ content_id: "j1" }], total: 1 });

    await findContentIdsBySearch(asDb(), "job", "analyst", "en");

    const [database, table, queries] = db.listRows.mock.calls[0];
    expect(database).toBe("app");
    // NOT the parent table: fulltext cannot traverse a relationship.
    expect(table).toBe("content_translations");
    const serialized = queries.join("|");
    expect(serialized).toContain("analyst");
    expect(serialized).toContain("title");
    expect(serialized).toContain("description");
    expect(serialized).toContain("job");
    expect(serialized).toContain("en");
  });

  it("dedupes content ids across the two locales of one row", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ content_id: "j1" }, { content_id: "j1" }, { content_id: "j2" }],
      total: 3,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result.ids).toEqual(["j1", "j2"]);
    expect(result.capped).toBe(false);
  });

  it("drops rows with a missing content_id rather than emitting empty ids", async () => {
    db.listRows.mockResolvedValue({
      rows: [{ content_id: "j1" }, { content_id: null }, {}],
      total: 3,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result.ids).toEqual(["j1"]);
  });

  it("marks the result capped when phase 1 fills the cap", async () => {
    db.listRows.mockResolvedValue({
      rows: Array.from({ length: 500 }, (_, i) => ({ content_id: `j${i}` })),
      total: 900,
    });

    const result = await findContentIdsBySearch(asDb(), "job", "a");

    expect(result.ids).toHaveLength(500);
    expect(result.capped).toBe(true);
  });

  it("returns empty rather than throwing when Appwrite rejects the search", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    db.listRows.mockRejectedValue(new Error("fulltext index missing"));

    const result = await findContentIdsBySearch(asDb(), "job", "analyst");

    expect(result).toEqual({ ids: [], capped: false });
    // The events search bug was invisible for months because a catch
    // returned [] silently. Every caught error must be logged.
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
