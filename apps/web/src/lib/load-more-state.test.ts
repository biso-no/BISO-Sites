import { describe, expect, it } from "vitest";
import {
  canLoadMore,
  initialLoadMoreState,
  loadMoreReducer,
} from "./load-more-state";

const item = (id: string) => ({ id });
const start = <T>(items: T[], total: number) =>
  initialLoadMoreState(items, total);

describe("loadMoreReducer", () => {
  it("starts idle on page 2 holding the server-rendered first page", () => {
    expect(start([item("a")], 3)).toEqual({
      items: [item("a")],
      nextPage: 2,
      status: "idle",
      total: 3,
    });
  });

  it("appends the next page rather than replacing the list", () => {
    const loading = loadMoreReducer(start([item("a")], 2), { type: "start" });
    const next = loadMoreReducer(loading, {
      type: "loaded",
      rows: [item("b")],
      total: 2,
    });

    expect(next.items).toEqual([item("a"), item("b")]);
    expect(next.nextPage).toBe(3);
    expect(next.status).toBe("idle");
  });

  it("adopts a total that shrank underneath us", () => {
    // A row was unpublished between page 1 and page 2.
    const loading = loadMoreReducer(start([item("a")], 9), { type: "start" });
    const next = loadMoreReducer(loading, {
      type: "loaded",
      rows: [],
      total: 1,
    });

    expect(next.total).toBe(1);
    expect(canLoadMore(next)).toBe(false);
  });

  it("keeps loaded items and does not advance the page on failure", () => {
    const loading = loadMoreReducer(start([item("a")], 5), { type: "start" });
    const failed = loadMoreReducer(loading, { type: "failed" });

    expect(failed.items).toEqual([item("a")]);
    // Retrying must re-request the SAME page, not the one after it.
    expect(failed.nextPage).toBe(2);
    expect(failed.status).toBe("error");
    expect(canLoadMore(failed)).toBe(true);
  });

  it("ignores a second start while a page is already loading", () => {
    const loading = loadMoreReducer(start([item("a")], 9), { type: "start" });
    expect(loadMoreReducer(loading, { type: "start" })).toBe(loading);
  });

  it("clears the error when a retry starts", () => {
    const failed = loadMoreReducer(
      loadMoreReducer(start([item("a")], 5), { type: "start" }),
      { type: "failed" }
    );
    expect(loadMoreReducer(failed, { type: "start" }).status).toBe("loading");
  });
});

describe("canLoadMore", () => {
  it("is true while rows remain", () => {
    expect(canLoadMore(start([item("a")], 3))).toBe(true);
  });

  it("is false once every row is loaded", () => {
    expect(canLoadMore(start([item("a")], 1))).toBe(false);
  });

  it("is false for an empty result", () => {
    expect(canLoadMore(start([], 0))).toBe(false);
  });

  it("is false while a page is in flight", () => {
    const loading = loadMoreReducer(start([item("a")], 9), { type: "start" });
    expect(canLoadMore(loading)).toBe(false);
  });

  it("stops at Appwrite's offset ceiling even when rows remain", () => {
    // MAX_OFFSET is 5000 and the page size is 12, so page 418 would offset
    // past what Appwrite will serve. Offering it would 400 the request.
    const deep = { ...start([item("a")], 100_000), nextPage: 418 };
    expect(canLoadMore(deep)).toBe(false);

    const reachable = { ...start([item("a")], 100_000), nextPage: 417 };
    expect(canLoadMore(reachable)).toBe(true);
  });
});
