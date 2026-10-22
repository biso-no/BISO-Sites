import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getFeaturedBenefits: vi.fn(),
  getMemberPortalBenefits: vi.fn(),
  getPublicProfile: vi.fn(),
  getUserProfile: vi.fn(),
}));
const campus = vi.hoisted(() => ({ getActiveCampus: vi.fn() }));
const cookieJar = vi.hoisted(() => ({
  value: undefined as string | undefined,
}));

vi.mock("@/app/actions/member-portal", () => actions);
vi.mock("@/app/actions/campus", () => campus);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "campusId" && cookieJar.value !== undefined
        ? { value: cookieJar.value }
        : undefined,
  }),
}));
vi.mock("next-intl/server", () => ({
  getFormatter: async () => ({ dateTime: () => "" }),
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@repo/shared/utils/membership-catalog", () => ({
  getMembershipOfferCandidates: async () => [],
}));
vi.mock("@/components/member-portal/member-portal-tabs", () => ({
  MemberPortalTabs: () => null,
}));
vi.mock("@/components/member-portal/shared/member-portal-header", () => ({
  MemberPortalHeader: () => null,
}));

import { MemberPortalContent } from "./member-portal-content";

const user = {
  profile: { campus_id: "3" },
  user: { $id: "u1", email: "a@bi.no", name: "A" },
} as never;

const render = () =>
  MemberPortalContent({ hasBIIdentity: true, membership: null, user });

describe("member portal campus resolution", () => {
  beforeEach(() => {
    cookieJar.value = undefined;
    for (const fn of Object.values(actions)) {
      fn.mockReset();
    }
    actions.getMemberPortalBenefits.mockResolvedValue([]);
    actions.getFeaturedBenefits.mockResolvedValue([]);
    actions.getUserProfile.mockResolvedValue({ campus_id: "3" });
    actions.getPublicProfile.mockResolvedValue(null);
    campus.getActiveCampus.mockReset();
  });

  it("prefers the switcher's campus over the profile campus", async () => {
    cookieJar.value = "2";
    campus.getActiveCampus.mockResolvedValue("2");

    await render();

    expect(actions.getMemberPortalBenefits).toHaveBeenCalledWith("2");
    expect(actions.getFeaturedBenefits).toHaveBeenCalledWith("2");
  });

  it("falls back to the profile campus when nothing is selected", async () => {
    campus.getActiveCampus.mockResolvedValue(null);

    await render();

    expect(actions.getMemberPortalBenefits).toHaveBeenCalledWith("3");
  });

  it("falls back to national when there is no selection and no profile campus", async () => {
    campus.getActiveCampus.mockResolvedValue(null);
    actions.getUserProfile.mockResolvedValue({ campus_id: null });

    await MemberPortalContent({
      hasBIIdentity: false,
      membership: null,
      user: null,
    });

    expect(actions.getMemberPortalBenefits).toHaveBeenCalledWith("5");
  });

  it("gives national only for an explicit all-campuses selection, ignoring the profile", async () => {
    cookieJar.value = "all";
    campus.getActiveCampus.mockResolvedValue(null);

    await render();

    expect(actions.getMemberPortalBenefits).toHaveBeenCalledWith("5");
    expect(actions.getFeaturedBenefits).toHaveBeenCalledWith("5");
  });
});
