import { beforeEach, describe, expect, it, vi } from "vitest";

const listEvents = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({
  listJobs: vi.fn(async () => ({ rows: [] })),
}));
vi.mock("@/app/actions/news", () => ({ listNews: vi.fn(async () => []) }));
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
vi.mock("./components/campus-page-client", () => ({
  CampusPageClient: () => null,
}));

import CampusPage from "./page";

describe("CampusPage", () => {
  beforeEach(() => {
    listEvents.mockReset();
    listEvents.mockResolvedValue({ rows: [] });
  });

  it("asks only for events that have not finished", async () => {
    // The section is titled "Upcoming Events" and the hero counts the same
    // list, so an unfiltered fetch showed expired events to every visitor.
    await CampusPage({ searchParams: Promise.resolve({}) });

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ upcomingOnly: true })
    );
  });
});
