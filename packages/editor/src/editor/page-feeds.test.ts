import { describe, expect, test } from "bun:test";
import {
  collectPageFeedRequests,
  pageFeedKey,
  resolveFeedDepartment,
} from "./page-feeds";
import type { Block, PageDoc } from "./types";

function doc(blocks: Block[], department = "25"): PageDoc {
  return {
    blocks,
    meta: {
      accentColor: "#3DA9E0",
      department,
      slug: "a-page",
      status: "published",
      title: "A page",
    },
  };
}

describe("resolveFeedDepartment", () => {
  test("`auto` follows the page department", () => {
    expect(resolveFeedDepartment("auto", "25")).toBe("25");
  });

  test("a missing source is treated as `auto`", () => {
    // Older documents persist jobs/news blocks with no `source` at all.
    expect(resolveFeedDepartment(undefined, "25")).toBe("25");
    expect(resolveFeedDepartment("", "25")).toBe("25");
  });

  test("an explicit source pins the block to that department", () => {
    expect(resolveFeedDepartment("41", "25")).toBe("41");
  });
});

describe("collectPageFeedRequests", () => {
  test("collects one request per auto-source block", () => {
    const requests = collectPageFeedRequests(
      doc([
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
        { id: "b", type: "news", heading: "", source: "auto" },
        { id: "c", type: "jobs", heading: "", source: "auto" },
      ] as Block[]),
      "no"
    );

    expect(requests.map((r) => r.kind).sort()).toEqual([
      "events",
      "jobs",
      "news",
    ]);
    for (const request of requests) {
      expect(request.department).toBe("25");
      expect(request.locale).toBe("no");
    }
  });

  test("deduplicates by (kind, department, locale)", () => {
    // Repeating a block must not multiply the page's backend round-trips.
    const requests = collectPageFeedRequests(
      doc([
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
        { id: "b", type: "events", heading: "", items: [], source: "25" },
        { id: "c", type: "events", heading: "", items: [], source: "41" },
      ] as Block[]),
      "no"
    );

    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.department).sort()).toEqual(["25", "41"]);
  });

  test("a block with no department resolves to no request", () => {
    // Those blocks render the inspector's authored placeholder items, which is
    // a documented feature — there is nothing to fetch on their behalf.
    const requests = collectPageFeedRequests(
      doc(
        [
          { id: "a", type: "events", heading: "", items: [], source: "auto" },
        ] as Block[],
        ""
      ),
      "no"
    );

    expect(requests).toEqual([]);
  });

  test("only an auto partners block asks for the partners feed", () => {
    const auto = collectPageFeedRequests(
      doc([{ id: "a", type: "partners", source: "auto" }] as Block[]),
      "no"
    );
    const manual = collectPageFeedRequests(
      doc([{ id: "a", type: "partners", source: "manual" }] as Block[]),
      "no"
    );

    expect(auto.map((r) => r.kind)).toEqual(["partners"]);
    expect(manual).toEqual([]);
  });

  test("departmentGrid and partners keys ignore department and locale", () => {
    // Both feeds are global, so a page carrying them in two locales must not
    // fetch twice and must key identically on every page.
    const nb = collectPageFeedRequests(
      doc([{ id: "a", type: "departmentGrid", showFilters: false }] as Block[]),
      "no"
    );
    const en = collectPageFeedRequests(
      doc(
        [{ id: "a", type: "departmentGrid", showFilters: false }] as Block[],
        "41"
      ),
      "en"
    );

    expect(nb[0]?.key).toBe(en[0]?.key);
    expect(nb[0]?.key).toBe(pageFeedKey("departments"));
  });

  test("blocks with no feed produce nothing", () => {
    const requests = collectPageFeedRequests(
      doc([
        { id: "a", type: "text", body: [] },
        { id: "b", type: "quote", author: "", role: "", text: "" },
      ] as Block[]),
      "no"
    );

    expect(requests).toEqual([]);
  });
});

describe("pageFeedKey", () => {
  test("separates department and locale", () => {
    expect(pageFeedKey("events", "25", "no")).not.toBe(
      pageFeedKey("events", "25", "en")
    );
    expect(pageFeedKey("events", "25", "no")).not.toBe(
      pageFeedKey("events", "41", "no")
    );
    expect(pageFeedKey("events", "25", "no")).not.toBe(
      pageFeedKey("news", "25", "no")
    );
  });
});
