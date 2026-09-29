import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { expect, test } from "vitest";
import { cardPlan, groupOffersByDuration } from "./membership-offer-groups";

const p = (
  id: string,
  duration: MembershipPlan["duration"],
  offer: "current" | "next"
): MembershipPlan => ({
  accrualMonths: 6,
  categoryId: 1,
  duration,
  expiryDate: "2026-12-31",
  id,
  name: id,
  offer,
  price: 350,
  productId: 1,
  startDate: "2026-07-01",
});

test("pairs this season's and next season's plan per duration, in order", () => {
  expect(
    groupOffersByDuration([
      p("y2", "year", "next"),
      p("s1", "semester", "current"),
      p("s2", "semester", "next"),
    ])
  ).toEqual([
    {
      current: p("s1", "semester", "current"),
      duration: "semester",
      next: p("s2", "semester", "next"),
    },
    { current: undefined, duration: "year", next: p("y2", "year", "next") },
  ]);
});

test("the selected card shows next season's plan once the buyer picks it", () => {
  const group = {
    current: p("s1", "semester", "current"),
    duration: "semester" as const,
    next: p("s2", "semester", "next"),
  };
  expect(cardPlan(group, "semester", false)?.id).toBe("s1");
  expect(cardPlan(group, "semester", true)?.id).toBe("s2");
  // Another card is unaffected by the selected card's choice.
  expect(cardPlan(group, "year", true)?.id).toBe("s1");
  expect(
    cardPlan(
      { duration: "year", next: p("y2", "year", "next") },
      "semester",
      false
    )?.id
  ).toBe("y2");
});
