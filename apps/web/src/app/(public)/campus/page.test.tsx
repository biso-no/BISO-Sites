import { beforeEach, describe, expect, it, vi } from "vitest";

const listEvents = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(async () => undefined));
const getPublicBenefits = vi.hoisted(() => vi.fn());
const cachedCampusLogos = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection }));
vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({
  listJobs: vi.fn(async () => ({ rows: [] })),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/app/actions/campus", () => ({
  getCampusData: vi.fn(async () => []),
  getCampusMetadata: vi.fn(async () => ({})),
}));
vi.mock("@/lib/auth-utils", () => ({
  getUserPreferences: vi.fn(async () => null),
}));
vi.mock("@/lib/data/units", () => ({
  cachedPublicUnits: vi.fn(async () => []),
}));
vi.mock("@/lib/data/benefits", () => ({
  cachedCampusLogos,
  getPublicBenefits,
}));
vi.mock("./components/campus-page-client", () => ({
  CampusPageClient: () => null,
}));

import CampusPage from "./page";

describe("CampusPage", () => {
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
    await CampusPage({ searchParams: Promise.resolve({}) });

    expect(connection).toHaveBeenCalled();
    expect(connection.mock.invocationCallOrder[0]).toBeLessThan(
      listEvents.mock.invocationCallOrder[0] as number
    );
  });

  it("asks only for events that have not finished", async () => {
    // The section is titled "Upcoming Events" and the hero counts the same
    // list, so an unfiltered fetch showed expired events to every visitor.
    await CampusPage({ searchParams: Promise.resolve({}) });

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ upcomingOnly: true })
    );
  });

  it("hands the benefit table and campus logos to the client", async () => {
    getPublicBenefits.mockResolvedValue([{ id: "b1" }]);
    cachedCampusLogos.mockResolvedValue([{ id: "l1" }]);

    const element = await CampusPage({ searchParams: Promise.resolve({}) });

    expect(element.props.benefits).toEqual([{ id: "b1" }]);
    expect(element.props.campusLogos).toEqual([{ id: "l1" }]);
  });

  it("still renders when the benefit or logo reads fail", async () => {
    getPublicBenefits.mockRejectedValue(new Error("down"));
    cachedCampusLogos.mockRejectedValue(new Error("down"));

    const element = await CampusPage({ searchParams: Promise.resolve({}) });

    expect(element.props.benefits).toEqual([]);
    expect(element.props.campusLogos).toEqual([]);
  });
});
