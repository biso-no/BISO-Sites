import { describe, expect, it } from "vitest";
import { upcomingMembershipStart } from "./membership-order-start";

const decem = new Date("2026-12-10T12:00:00Z");

describe("upcomingMembershipStart", () => {
  it("returns the start of a membership bought for next season", () => {
    expect(
      upcomingMembershipStart(
        [{ product_type: "membership", start_date: "2027-01-01" }],
        decem
      )
    ).toBe("2027-01-01");
  });

  it("is null for a membership that has already started", () => {
    expect(
      upcomingMembershipStart(
        [{ product_type: "membership", start_date: "2026-07-01" }],
        decem
      )
    ).toBeNull();
  });

  it("is null for an order without a membership start date", () => {
    expect(
      upcomingMembershipStart([{ product_type: "product" }], decem)
    ).toBeNull();
    expect(upcomingMembershipStart([], decem)).toBeNull();
  });
});
