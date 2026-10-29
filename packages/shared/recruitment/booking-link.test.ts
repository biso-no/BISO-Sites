import { describe, expect, it } from "vitest";
import { isBookingLinkUsable } from "./booking-link";

describe("isBookingLinkUsable", () => {
  it("accepts an interview-stage candidate whose vacancy exists", () => {
    expect(
      isBookingLinkUsable({ applicationStatus: "interview", hasJob: true })
    ).toBe(true);
  });

  it("refuses other stages and a missing vacancy", () => {
    for (const applicationStatus of [
      "submitted",
      "reviewed",
      "accepted",
      "rejected",
    ]) {
      expect(isBookingLinkUsable({ applicationStatus, hasJob: true })).toBe(
        false
      );
    }
    expect(
      isBookingLinkUsable({ applicationStatus: "interview", hasJob: false })
    ).toBe(false);
  });
});
