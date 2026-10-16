import { describe, expect, it } from "vitest";
import type { MembershipPlan } from "./membership-plans";
import {
  currentSeasonStart,
  isLastMonthOfSeason,
  nextSeasonStart,
  offerFor,
  onePerDuration,
  selectOffers,
} from "./membership-seasons";

// Oslo is UTC+2 in summer, UTC+1 in winter.
const at = (iso: string) => new Date(iso);

describe("seasons", () => {
  it("uses the Oslo date at the 30 June / 1 July boundary", () => {
    const lateJune = at("2026-06-30T21:30:00Z"); // 23:30 Oslo, 30 June
    expect(currentSeasonStart(lateJune)).toBe("2026-01-01");
    expect(nextSeasonStart(lateJune)).toBe("2026-07-01");
    expect(isLastMonthOfSeason(lateJune)).toBe(true);
    const earlyJuly = at("2026-06-30T22:30:00Z"); // 00:30 Oslo, 1 July
    expect(currentSeasonStart(earlyJuly)).toBe("2026-07-01");
    expect(nextSeasonStart(earlyJuly)).toBe("2027-01-01");
    expect(isLastMonthOfSeason(earlyJuly)).toBe(false);
  });

  it("December is the last month of fall; November is not", () => {
    expect(isLastMonthOfSeason(at("2026-11-30T12:00:00Z"))).toBe(false);
    expect(isLastMonthOfSeason(at("2026-12-01T12:00:00Z"))).toBe(true);
    expect(nextSeasonStart(at("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });

  it("tags a plan by its start date", () => {
    const now = at("2026-09-29T12:00:00Z");
    expect(offerFor("2026-07-01", now)).toBe("current");
    expect(offerFor("2027-01-01", now)).toBe("next");
    expect(offerFor("2026-01-01", now)).toBeNull();
    expect(offerFor("2030-07-01", now)).toBeNull();
  });
});

const ACCRUAL = { semester: 6, three_years: 36, year: 12 } as const;

function plan(
  duration: MembershipPlan["duration"],
  offer: "current" | "next",
  expiryDate: string
): MembershipPlan {
  return {
    accrualMonths: ACCRUAL[duration],
    categoryId: 1,
    duration,
    expiryDate,
    id: `${duration}-${offer}`,
    name: `${duration} ${offer}`,
    offer,
    price: 350,
    productId: 1,
    startDate: offer === "current" ? "2026-07-01" : "2027-01-01",
  };
}

const candidates = [
  plan("semester", "current", "2026-12-31"),
  plan("semester", "next", "2027-06-30"),
  plan("year", "current", "2027-06-30"),
  plan("year", "next", "2027-12-31"),
  plan("three_years", "current", "2029-06-30"),
  plan("three_years", "next", "2029-12-31"),
];
const ids = (plans: MembershipPlan[]) => plans.map((p) => p.id);

describe("selectOffers", () => {
  it("offers only this season's plans outside the last month", () => {
    const offers = selectOffers(candidates, {
      heldThrough: null,
      now: at("2026-10-15T12:00:00Z"),
    });
    expect(ids(offers)).toEqual([
      "semester-current",
      "year-current",
      "three_years-current",
    ]);
  });

  it("offers this season and next season in December", () => {
    const offers = selectOffers(candidates, {
      heldThrough: null,
      now: at("2026-12-10T12:00:00Z"),
    });
    expect(ids(offers)).toEqual([
      "semester-current",
      "semester-next",
      "year-current",
      "year-next",
      "three_years-current",
      "three_years-next",
    ]);
  });

  it("renews with next season when this season's plan would not extend what they hold", () => {
    const offers = selectOffers(candidates, {
      heldThrough: "2026-12-31",
      now: at("2026-10-15T12:00:00Z"),
    });
    expect(ids(offers)).toEqual([
      "semester-next",
      "year-current",
      "three_years-current",
    ]);
  });

  it("offers nothing that ends on or before what they already hold", () => {
    const offers = selectOffers(candidates, {
      heldThrough: "2027-06-30",
      now: at("2026-12-10T12:00:00Z"),
    });
    expect(ids(offers)).toEqual([
      "year-next",
      "three_years-current",
      "three_years-next",
    ]);
  });
});

describe("onePerDuration", () => {
  it("keeps one card per duration, preferring this season's plan", () => {
    const offers = selectOffers(candidates, {
      heldThrough: null,
      now: at("2026-12-10T12:00:00Z"),
    });
    expect(ids(onePerDuration(offers))).toEqual([
      "semester-current",
      "year-current",
      "three_years-current",
    ]);
  });

  it("keeps next season's plan when it is the only one for its duration", () => {
    const offers = selectOffers(candidates, {
      heldThrough: "2026-12-31",
      now: at("2026-10-15T12:00:00Z"),
    });
    expect(ids(onePerDuration(offers))).toEqual([
      "semester-next",
      "year-current",
      "three_years-current",
    ]);
  });
});
