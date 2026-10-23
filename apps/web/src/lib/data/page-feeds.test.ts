import { departmentsFeedKey, pageFeedKey } from "@repo/editor/page-feeds";
import type { PageDoc } from "@repo/editor/types";
import { beforeEach, describe, expect, test, vi } from "vitest";

const cachedPageDepartmentsFeed = vi.fn();
const cachedPageEventsFeed = vi.fn();
const cachedPageJobsFeed = vi.fn();
const cachedPageNewsFeed = vi.fn();
const cachedPagePartnersFeed = vi.fn();
const cachedPageProductsFeed = vi.fn();

vi.mock("./public-content", () => ({
  cachedPageDepartmentsFeed: (...args: unknown[]) =>
    cachedPageDepartmentsFeed(...args),
  cachedPageEventsFeed: (...args: unknown[]) => cachedPageEventsFeed(...args),
  cachedPageJobsFeed: (...args: unknown[]) => cachedPageJobsFeed(...args),
  cachedPageNewsFeed: (...args: unknown[]) => cachedPageNewsFeed(...args),
  cachedPagePartnersFeed: (...args: unknown[]) =>
    cachedPagePartnersFeed(...args),
  cachedPageProductsFeed: (...args: unknown[]) =>
    cachedPageProductsFeed(...args),
}));

const { resolvePageFeeds } = await import("./page-feeds");

function doc(blocks: unknown[], department = "25"): PageDoc {
  return {
    meta: {
      accentColor: "#3DA9E0",
      department,
      slug: "a-page",
      status: "published",
      title: "A page",
    },
    sections: [
      {
        columns: [{ blocks, id: "c-1" }],
        id: "s-1",
        layout: {},
      },
    ],
    version: 2,
  } as unknown as PageDoc;
}

const EVENT_ROW = { date: "12 Sep", going: 0, title: "Kickoff", where: "Oslo" };

beforeEach(() => {
  vi.clearAllMocks();
  cachedPageEventsFeed.mockResolvedValue([EVENT_ROW]);
  cachedPageNewsFeed.mockResolvedValue([]);
  cachedPageJobsFeed.mockResolvedValue([]);
  cachedPagePartnersFeed.mockResolvedValue([]);
  cachedPageDepartmentsFeed.mockResolvedValue({ departments: [], total: 0 });
});

describe("resolvePageFeeds", () => {
  test("resolves an auto-source block under the key its block reads", async () => {
    // The key is the entire contract between this resolver and the block. If
    // it drifts, the block ignores the server's work and renders "Loading…"
    // with no error anywhere.
    const feeds = await resolvePageFeeds(
      doc([
        {
          id: "a",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
      ]),
      "no"
    );

    expect(feeds).toEqual({
      [pageFeedKey("events", "25", "no", 3)]: [EVENT_ROW],
    });
    expect(cachedPageEventsFeed).toHaveBeenCalledWith("25", "no", 3);
  });

  test("reads the cached readers directly, never the HTTP routes", async () => {
    // Fetching our own /api/pages/* route would add a round trip and a second
    // cache for no benefit. A stray fetch here would also break `next build`,
    // which has no server to call.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await resolvePageFeeds(
      doc([
        {
          id: "a",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
      ]),
      "no"
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test("a page with no auto-source blocks touches no reader", async () => {
    const feeds = await resolvePageFeeds(
      doc([{ id: "a", type: "text", body: [] }]),
      "no"
    );

    expect(feeds).toEqual({});
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
    expect(cachedPagePartnersFeed).not.toHaveBeenCalled();
  });

  test("repeated blocks cost one read", async () => {
    // The caching doctrine is one Appwrite round-trip per revalidation window.
    // A page is authored content, so nothing stops an editor from dropping the
    // same feed block in three times.
    await resolvePageFeeds(
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
          source: "auto",
        },
        {
          id: "c",
          type: "events",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "25",
        },
      ]),
      "no"
    );

    expect(cachedPageEventsFeed).toHaveBeenCalledTimes(1);
  });

  test("a block with no department resolves nothing", async () => {
    // Those blocks render nothing on the site, which is a
    // documented behaviour.
    const feeds = await resolvePageFeeds(
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
        ],
        ""
      ),
      "no"
    );

    expect(feeds).toEqual({});
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
  });

  test("a failing feed is omitted, and does not take the page down", async () => {
    // The block then fetches it after hydration — the pre-existing behaviour.
    // Recording it as `[]` instead would render "No upcoming events." over a
    // department that has some.
    cachedPageEventsFeed.mockRejectedValue(new Error("appwrite is down"));

    const feeds = await resolvePageFeeds(
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
      ]),
      "no"
    );

    expect(feeds).not.toHaveProperty(pageFeedKey("events", "25", "no", 3));
    // The healthy feed on the same page still resolves.
    expect(feeds).toHaveProperty(pageFeedKey("news", "25", "no", 3), []);
  });

  test("global feeds resolve without a department", async () => {
    cachedPagePartnersFeed.mockResolvedValue([{ name: "Partner" }]);
    // The departments reader answers `{ departments, total }` — `total` is
    // Appwrite's full match count, which the block never reads.
    cachedPageDepartmentsFeed.mockResolvedValue({
      departments: [{ id: "1", name: "Dept" }],
      total: 134,
    });

    const feeds = await resolvePageFeeds(
      doc([
        { id: "a", type: "partners", source: "auto" },
        { id: "b", type: "departmentGrid", limit: 6, scope: "all" },
      ]),
      "no"
    );

    expect(feeds[pageFeedKey("partners")]).toEqual([{ name: "Partner" }]);
    // Unwrapped to the rows: the snapshot is `Record<string, unknown[]>` and
    // the block renders an array, so a `{ departments, total }` object here
    // would make every card render as undefined.
    expect(feeds[pageFeedKey("departments")]).toEqual([
      { id: "1", name: "Dept" },
    ]);
  });

  test("a shop block resolves its clamped products feed", async () => {
    cachedPageProductsFeed.mockResolvedValue([{ id: "p" }]);
    const feeds = await resolvePageFeeds(
      doc([
        { id: "a", type: "productGrid", heading: "", limit: 8, source: "auto" },
      ]),
      "no"
    );
    expect(feeds[pageFeedKey("products", "25", "no", 8)]).toEqual([
      { id: "p" },
    ]);
    expect(cachedPageProductsFeed).toHaveBeenCalledWith("25", "no", 8);
  });

  test("a campus-scoped units block passes the page campus and category", async () => {
    const withCampus = doc([
      {
        id: "a",
        type: "departmentGrid",
        category: "society",
        limit: 6,
        scope: "campus",
      },
    ]);
    withCampus.meta.campus = "2";
    const feeds = await resolvePageFeeds(withCampus, "no");
    expect(cachedPageDepartmentsFeed).toHaveBeenCalledWith("2", "society");
    expect(Object.keys(feeds)).toEqual([departmentsFeedKey("2", "society")]);
  });

  test("a manual partners block resolves nothing", async () => {
    const feeds = await resolvePageFeeds(
      doc([{ id: "a", type: "partners", source: "manual" }]),
      "no"
    );

    expect(feeds).toEqual({});
    expect(cachedPagePartnersFeed).not.toHaveBeenCalled();
  });

  test("locale reaches the department-scoped readers", async () => {
    await resolvePageFeeds(
      doc([
        {
          id: "a",
          type: "news",
          heading: "",
          limit: 6,
          seeAll: true,
          source: "auto",
        },
        {
          id: "b",
          type: "jobs",
          heading: "",
          limit: 3,
          seeAll: true,
          source: "auto",
        },
      ]),
      "en"
    );

    // The block's limit rides along so the reader fetches enough rows.
    expect(cachedPageNewsFeed).toHaveBeenCalledWith("25", "en", 6);
    expect(cachedPageJobsFeed).toHaveBeenCalledWith("25", "en", 3);
  });
});
