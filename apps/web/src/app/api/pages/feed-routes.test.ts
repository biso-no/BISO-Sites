import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { beforeEach, describe, expect, test, vi } from "vitest";

const readers = {
  events: vi.fn(),
  jobs: vi.fn(),
  news: vi.fn(),
};
vi.mock("@/lib/data/public-content", () => ({
  cachedPageEventsFeed: (...args: unknown[]) => readers.events(...args),
  cachedPageJobsFeed: (...args: unknown[]) => readers.jobs(...args),
  cachedPageNewsFeed: (...args: unknown[]) => readers.news(...args),
}));

const routes = {
  events: (await import("./events/route")).GET,
  jobs: (await import("./jobs/route")).GET,
  news: (await import("./news/route")).GET,
};

const CACHEABLE = "public, s-maxage=60, stale-while-revalidate=300";

beforeEach(() => {
  vi.clearAllMocks();
  readers.events.mockResolvedValue([{ id: "event" }]);
  readers.jobs.mockResolvedValue([{ id: "job" }]);
  readers.news.mockResolvedValue([{ id: "news" }]);
});

for (const name of ["events", "jobs", "news"] as const) {
  const reader = readers[name];
  const call = (qs: string) =>
    routes[name](new Request(`http://web.test/api/pages/${name}${qs}`));

  describe(`/api/pages/${name}`, () => {
    test("answers the cached feed for the department, locale and clamped limit", async () => {
      const response = await call("?dept=25&locale=en&limit=999");
      expect(reader).toHaveBeenCalledWith(
        "25",
        "en",
        feedLimitFromParam("999")
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(CACHEABLE);
      expect(await response.json()).toEqual(
        await reader.mock.results[0]?.value
      );
    });

    test("defaults to Norwegian and the default limit", async () => {
      await call("?dept=25");
      expect(reader).toHaveBeenCalledWith("25", "no", feedLimitFromParam(null));
    });

    test("a missing or malformed department answers a cacheable [] without reading", async () => {
      for (const qs of ["", "?dept=a%20b"]) {
        const response = await call(qs);
        expect(await response.json()).toEqual([]);
        expect(response.headers.get("Cache-Control")).toBe(CACHEABLE);
      }
      expect(reader).not.toHaveBeenCalled();
    });

    test("a failed read answers an uncacheable empty array", async () => {
      reader.mockRejectedValue(new Error("boom"));
      const response = await call("?dept=25");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });
}
