import { pageFeedKey } from "@repo/editor/page-feeds";
import type { PageDoc } from "@repo/editor/types";
import { beforeEach, describe, expect, test, vi } from "vitest";

const cachedPageDepartmentsFeed = vi.fn();
const cachedPageEventsFeed = vi.fn();
const cachedPageJobsFeed = vi.fn();
const cachedPageNewsFeed = vi.fn();
const cachedPagePartnersFeed = vi.fn();

vi.mock("./public-content", () => ({
  cachedPageDepartmentsFeed: (...args: unknown[]) =>
    cachedPageDepartmentsFeed(...args),
  cachedPageEventsFeed: (...args: unknown[]) => cachedPageEventsFeed(...args),
  cachedPageJobsFeed: (...args: unknown[]) => cachedPageJobsFeed(...args),
  cachedPageNewsFeed: (...args: unknown[]) => cachedPageNewsFeed(...args),
  cachedPagePartnersFeed: (...args: unknown[]) =>
    cachedPagePartnersFeed(...args),
}));

const { resolvePageFeeds } = await import("./page-feeds");

function doc(blocks: unknown[], department = "25"): PageDoc {
  return {
    blocks,
    meta: {
      accentColor: "#3DA9E0",
      department,
      slug: "a-page",
      status: "published",
      title: "A page",
    },
  } as PageDoc;
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
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
      ]),
      "no"
    );

    expect(feeds).toEqual({
      [pageFeedKey("events", "25", "no")]: [EVENT_ROW],
    });
    expect(cachedPageEventsFeed).toHaveBeenCalledWith("25", "no");
  });

  test("reads the cached readers directly, never the HTTP routes", async () => {
    // Fetching our own /api/pages/* route would add a round trip and a second
    // cache for no benefit. A stray fetch here would also break `next build`,
    // which has no server to call.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await resolvePageFeeds(
      doc([
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
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
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
        { id: "b", type: "events", heading: "", items: [], source: "auto" },
        { id: "c", type: "events", heading: "", items: [], source: "25" },
      ]),
      "no"
    );

    expect(cachedPageEventsFeed).toHaveBeenCalledTimes(1);
  });

  test("a block with no department resolves nothing", async () => {
    // Those blocks render the authored placeholder items instead, which is a
    // documented feature of the events inspector.
    const feeds = await resolvePageFeeds(
      doc(
        [
          {
            id: "a",
            type: "events",
            heading: "",
            items: [],
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
        { id: "a", type: "events", heading: "", items: [], source: "auto" },
        { id: "b", type: "news", heading: "", source: "auto" },
      ]),
      "no"
    );

    expect(feeds).not.toHaveProperty(pageFeedKey("events", "25", "no"));
    // The healthy feed on the same page still resolves.
    expect(feeds).toHaveProperty(pageFeedKey("news", "25", "no"), []);
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
        { id: "b", type: "departmentGrid", showFilters: false },
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
        { id: "a", type: "news", heading: "", source: "auto" },
        { id: "b", type: "jobs", heading: "", source: "auto" },
      ]),
      "en"
    );

    expect(cachedPageNewsFeed).toHaveBeenCalledWith("25", "en");
    expect(cachedPageJobsFeed).toHaveBeenCalledWith("25", "en");
  });
});
