import { describe, expect, test } from "bun:test";
import {
  collectPageFeedRequests,
  feedLimitFromParam,
  pageFeedKey,
  resolveFeedDepartment,
} from "./page-feeds";
import { sectionOf } from "./sections";
import {
  block as fixtureBlock,
  doc as fixtureDoc,
  section,
} from "./test-fixtures";
import type { Block, PageDoc } from "./types";

function doc(blocks: Block[], department = "25"): PageDoc {
  return {
    meta: {
      accentColor: "#3DA9E0",
      department,
      slug: "a-page",
      status: "published",
      title: "A page",
    },
    sections: blocks.map((b) => sectionOf(b)),
    version: 2,
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
        {
          id: "a",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
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

  test("deduplicates by (kind, department, locale, limit)", () => {
    // Repeating a block must not multiply the page's backend round-trips.
    const requests = collectPageFeedRequests(
      doc([
        {
          id: "a",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
        {
          id: "b",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "25",
        },
        {
          id: "c",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "41",
        },
      ] as Block[]),
      "no"
    );

    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.department).sort()).toEqual(["25", "41"]);
  });

  test("a block with no department resolves to no request", () => {
    // Those blocks render nothing on the site, which is
    // a documented feature — there is nothing to fetch on their behalf.
    const requests = collectPageFeedRequests(
      doc(
        [
          {
            id: "a",
            type: "events",
            heading: "",
            limit: 3,
            seeAll: true,
            source: "auto",
          },
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

describe("collectPageFeedRequests in columns", () => {
  test("feeds are collected from blocks inside columns", () => {
    const events = fixtureBlock("b-9", "events");
    const d = fixtureDoc(
      section("s-1", "1", [["b-1"]]),
      section("s-2", "1-1", [["b-2"], []])
    );
    d.sections[1].columns[1].blocks.push(events);
    d.meta.department = "dept-1";
    expect(collectPageFeedRequests(d, "no").map((r) => r.key)).toContain(
      "events|dept-1|no|3"
    );
  });
});

describe("feed limit", () => {
  test("is part of the key and the request", () => {
    expect(pageFeedKey("events", "25", "no", 6)).toBe("events|25|no|6");
    expect(pageFeedKey("partners")).toBe("partners||");
    const [request] = collectPageFeedRequests(
      doc([
        {
          id: "a",
          type: "events",
          heading: "",
          limit: 6,
          seeAll: true,
          source: "auto",
        },
      ] as Block[]),
      "no"
    );
    expect(request?.limit).toBe(6);
    expect(request?.key).toBe("events|25|no|6");
  });

  test("different limits are different requests; a missing one means 3", () => {
    const requests = collectPageFeedRequests(
      doc([
        {
          id: "a",
          type: "news",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
        {
          id: "b",
          type: "news",
          heading: "",
          limit: 6,
          seeAll: true,
          source: "auto",
        },
        { id: "c", type: "news", heading: "", source: "auto" },
      ] as Block[]),
      "no"
    );
    expect(requests.map((r) => r.limit).sort()).toEqual([3, 6]);
  });
});

describe("feedLimitFromParam", () => {
  test("only the allowed row counts get through", () => {
    expect(feedLimitFromParam("6")).toBe(6);
    expect(feedLimitFromParam("3")).toBe(3);
    expect(feedLimitFromParam("999")).toBe(3);
    expect(feedLimitFromParam("abc")).toBe(3);
    expect(feedLimitFromParam("-5")).toBe(3);
    expect(feedLimitFromParam("")).toBe(3);
    expect(feedLimitFromParam(null)).toBe(3);
  });
});
