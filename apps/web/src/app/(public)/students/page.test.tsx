import { beforeEach, describe, expect, it, vi } from "vitest";

const listEvents = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({
  listJobs: vi.fn(async () => ({ rows: [] })),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/app/actions/campus", () => ({
  getCampusData: vi.fn(async () => []),
}));
vi.mock("@/app/actions/membership", () => ({
  getGlobalMembershipBenefits: vi.fn(async () => []),
}));
vi.mock("@/lib/data/units", () => ({
  cachedPublicUnits: vi.fn(async () => []),
}));
vi.mock("./students-page-client", () => ({
  StudentsPageClient: () => null,
}));

import StudentsPage from "./page";

describe("StudentsPage", () => {
  beforeEach(() => {
    listEvents.mockReset();
    listEvents.mockResolvedValue({ rows: [] });
  });

  it("asks only for events that have not finished", async () => {
    await StudentsPage();

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ upcomingOnly: true })
    );
  });
});
