import { describe, expect, it } from "vitest";
import {
  toCurrentMembershipView,
  upgradePlans,
} from "./member-portal-membership";

const base = {
  checkedAt: 0,
  expiredMemberships: [],
  finagoCategoryIds: [113_176],
  isMember: true,
};

const semester = {
  category: "113176",
  expiryDate: "2026-12-31",
  id: "54",
  name: "Semester",
  startDate: "2026-07-01",
};

const plan = (
  id: string,
  duration: "semester" | "year" | "three_years",
  expiryDate: string
) => ({
  accrualMonths: 6 as const,
  categoryId: 1,
  duration,
  expiryDate,
  id,
  name: id,
  price: 100,
  productId: 1,
  startDate: "2026-07-01",
});

describe("toCurrentMembershipView", () => {
  it("reports a fall semester as a semester, not a year", () => {
    const view = toCurrentMembershipView(
      { ...base, memberships: [semester] },
      new Date("2026-09-17T10:00:00Z")
    );
    expect(view).toEqual({
      daysRemaining: 105,
      duration: "semester",
      expiryDate: "2026-12-31",
      name: "Semester",
      startDate: "2026-07-01",
      termDays: 183,
    });
  });

  it("is null for non-members", () => {
    expect(
      toCurrentMembershipView({ ...base, isMember: false, memberships: [] })
    ).toBeNull();
  });
});

describe("upgradePlans", () => {
  const plans = [
    plan("54", "semester", "2026-12-31"),
    plan("71", "year", "2027-07-01"),
    plan("82", "three_years", "2029-07-01"),
  ];

  it("offers only plans that run past the current membership", () => {
    const current = toCurrentMembershipView(
      { ...base, memberships: [semester] },
      new Date("2026-09-17T10:00:00Z")
    );
    expect(upgradePlans(plans, current).map((p) => p.id)).toEqual(["71", "82"]);
  });

  it("offers every plan to non-members", () => {
    expect(upgradePlans(plans, null)).toHaveLength(3);
  });
});
