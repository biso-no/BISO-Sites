import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Main's `/campus` guards, carried onto the merged routes.
 *
 * On main, `/campus` was one tabbed page that fetched the campus's events
 * itself. The merge keeps the redesign's routing — `/campus` is an index of
 * the five campuses and fetches no events at all, and each campus's events
 * live on `/campus/<slug>` — so the two behaviours main pinned here are
 * asserted against the landing, which is where the clock is now read.
 */
const listEvents = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(async () => undefined));
const getPublicBenefits = vi.hoisted(() => vi.fn());
const cachedCampusLogos = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({
  listJobs: vi.fn(async () => ({ rows: [] })),
}));
vi.mock("@/app/actions/news", () => ({
  listNews: vi.fn(async () => []),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/app/actions/campus", () => ({
  getCampusData: vi.fn(async () => []),
  getCampusMetadata: vi.fn(async () => ({})),
}));
vi.mock("@/lib/data/public-content", () => ({
  cachedHomeCounts: vi.fn(async () => ({
    departmentCount: 0,
    eventCount: 0,
    jobCount: 0,
  })),
  cachedShellCampuses: vi.fn(async () => [
    { $id: "1", email: null, name: "Oslo" },
  ]),
}));
vi.mock("@/lib/data/units", () => ({
  cachedPublicUnits: vi.fn(async () => []),
}));
vi.mock("@/lib/data/campus-leadership", () => ({
  campusLeadership: vi.fn(async () => []),
}));
vi.mock("@/lib/data/benefits", () => ({
  cachedCampusLogos,
  getPublicBenefits,
}));
vi.mock("@/components/campus/v2/campus-landing", () => ({
  CampusLanding: () => null,
}));

import CampusLandingPage, { instant } from "./[slug]/page";

const render = (slug = "oslo") =>
  CampusLandingPage({ params: Promise.resolve({ slug }) });

describe("CampusLandingPage", () => {
  beforeEach(() => {
    listEvents.mockReset();
    listEvents.mockResolvedValue({ rows: [] });
    connection.mockClear();
    getPublicBenefits.mockReset();
    getPublicBenefits.mockResolvedValue([]);
    cachedCampusLogos.mockReset();
    cachedCampusLogos.mockResolvedValue([]);
  });

  it("opts into request-time rendering before the date filter reads the clock", async () => {
    // The upcoming-events filter is built from `new Date()`. Cache Components
    // rejects that during prerender (`blocking-prerender-current-time`) and
    // fails the build unless `connection()` has been awaited first.
    await render();

    expect(instant).toBe(false);
    expect(connection).toHaveBeenCalled();
    expect(connection.mock.invocationCallOrder[0]).toBeLessThan(
      listEvents.mock.invocationCallOrder[0] as number
    );
  });

  it("asks only for events that have not finished", async () => {
    // The block is titled "Events" and the stat row counts upcoming events, so
    // an unfiltered fetch showed expired events to every visitor.
    await render();

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ campus: "1", upcomingOnly: true })
    );
  });

  it("answers an unknown campus with a 404 before fetching anything", async () => {
    await expect(render("osloo")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(listEvents).not.toHaveBeenCalled();
  });

  it("hands the landing this campus's benefits and logos, not another's", async () => {
    const benefit = (id: string, campusId: string) => ({
      campusId,
      createdAt: "2026-01-01T00:00:00.000Z",
      id,
      section: "member",
      sortOrder: 0,
    });
    getPublicBenefits.mockResolvedValue([
      benefit("oslo", "1"),
      benefit("bergen", "2"),
      benefit("national", "5"),
    ]);
    cachedCampusLogos.mockResolvedValue([
      { campusId: "1", id: "l1" },
      { campusId: "2", id: "l2" },
    ]);

    const element = await render();

    expect(element.props.benefits.map((b: { id: string }) => b.id)).toEqual([
      "oslo",
      "national",
    ]);
    expect(element.props.campusLogos).toEqual([{ campusId: "1", id: "l1" }]);
  });

  it("still renders when the benefit or logo reads fail", async () => {
    getPublicBenefits.mockRejectedValue(new Error("down"));
    cachedCampusLogos.mockRejectedValue(new Error("down"));

    const element = await render();

    expect(element.props.benefits).toEqual([]);
    expect(element.props.campusLogos).toEqual([]);
  });
});
