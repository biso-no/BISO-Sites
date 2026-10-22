import { beforeEach, describe, expect, it, vi } from "vitest";

const listEvents = vi.hoisted(() => vi.fn());
const getPublicBenefits = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({
  listJobs: vi.fn(async () => ({ rows: [] })),
}));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/lib/data/benefits", () => ({ getPublicBenefits }));
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
    getPublicBenefits.mockReset();
    getPublicBenefits.mockResolvedValue([]);
  });

  it("asks only for events that have not finished", async () => {
    await StudentsPage();

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ upcomingOnly: true })
    );
  });

  it("hands the benefit table to the client", async () => {
    getPublicBenefits.mockResolvedValue([{ id: "b1" }]);

    const element = await StudentsPage();

    expect(element.props.benefits).toEqual([{ id: "b1" }]);
  });

  it("still renders when the benefit read fails", async () => {
    getPublicBenefits.mockRejectedValue(new Error("down"));

    const element = await StudentsPage();

    expect(element.props.benefits).toEqual([]);
  });
});
