import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { expect, test } from "vitest";
import { groupOffersByDuration } from "./membership-offer-groups";

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
