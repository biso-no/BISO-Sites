import { beforeEach, describe, expect, it, vi } from "vitest";

const listEvents = vi.hoisted(() => vi.fn());
const listJobs = vi.hoisted(() => vi.fn());
const getUserPreferences = vi.hoisted(() => vi.fn());
const getPublicBenefits = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/actions/events", () => ({ listEvents }));
vi.mock("@/app/actions/jobs", () => ({ listJobs }));
vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));
vi.mock("@/lib/data/benefits", () => ({ getPublicBenefits }));
vi.mock("@/lib/data/units", () => ({
  cachedPublicUnits: vi.fn(async () => []),
}));
// The merged page reads `?campus=` (URL > cookie > all) and names the campus,
// so it also asks for the visitor's preferences and the campus list.
vi.mock("@/lib/auth-utils", () => ({ getUserPreferences }));
vi.mock("@/lib/data/public-content", () => ({
  cachedShellCampuses: vi.fn(async () => [{ $id: "2", name: "Bergen" }]),
}));

import StudentsPage from "./page";

const render = (searchParams: Record<string, string> = {}) =>
  StudentsPage({ searchParams: Promise.resolve(searchParams) });

/** The page is a fragment of header and body; the body holds the sections. */
const bodyOf = (page: Awaited<ReturnType<typeof render>>) =>
  (page.props as { children: { props: Record<string, unknown> }[] })
    .children[1];

describe("StudentsPage", () => {
  beforeEach(() => {
    listEvents.mockReset();
    listEvents.mockResolvedValue({ rows: [] });
    listJobs.mockReset();
    listJobs.mockResolvedValue({ rows: [] });
    getUserPreferences.mockReset();
    getUserPreferences.mockResolvedValue(null);
    getPublicBenefits.mockReset();
    getPublicBenefits.mockResolvedValue([]);
  });

  it("asks only for events that have not finished", async () => {
    await render();

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ upcomingOnly: true })
    );
  });

  it("scopes its feeds to the campus in the URL, ahead of the cookie", async () => {
    // Main filtered a site-wide pool by the client-side campus context; the
    // merged page scopes the queries themselves, so a shared link shows the
    // campus it names whatever the reader's own cookie holds.
    getUserPreferences.mockResolvedValue({ campusId: "1" });
    await render({ campus: "bergen" });

    expect(listEvents).toHaveBeenCalledWith(
      expect.objectContaining({ campus: "2" })
    );
    expect(listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ campus: "2" })
    );
  });

  it("answers an unknown campus with a 404", async () => {
    await expect(render({ campus: "osloo" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("hands the benefit table and the campus to the benefits section", async () => {
    getPublicBenefits.mockResolvedValue([{ id: "b1" }]);

    const body = bodyOf(await render({ campus: "bergen" }));

    expect(body.props.benefits).toEqual([{ id: "b1" }]);
    expect(body.props.campusId).toBe("2");
  });

  it("still renders when the benefit read fails", async () => {
    getPublicBenefits.mockRejectedValue(new Error("down"));

    const body = bodyOf(await render());

    expect(body.props.benefits).toEqual([]);
  });
});
