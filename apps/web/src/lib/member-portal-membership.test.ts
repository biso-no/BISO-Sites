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
  expiryDate: string,
  offer: "current" | "next" = "current"
) => ({
  accrualMonths: 6 as const,
  categoryId: 1,
  duration,
  expiryDate,
  id,
  name: id,
  offer,
  price: 100,
  productId: 1,
  startDate: offer === "current" ? "2026-07-01" : "2027-01-01",
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
    plan("55", "semester", "2027-06-30", "next"),
    plan("71", "year", "2027-06-30"),
    plan("82", "three_years", "2029-06-30"),
  ];
  const october = new Date("2026-10-15T12:00:00Z");

  it("offers a fall-semester member next semester and the longer plans", () => {
    expect(upgradePlans(plans, "2026-12-31", october).map((p) => p.id)).toEqual(
      ["55", "71", "82"]
    );
  });

  it("offers non-members this season's plans only, outside the last month", () => {
    expect(upgradePlans(plans, null, october).map((p) => p.id)).toEqual([
      "54",
      "71",
      "82",
    ]);
  });
});
