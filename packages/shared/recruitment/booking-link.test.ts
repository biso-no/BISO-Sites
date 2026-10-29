import { describe, expect, it } from "vitest";
import { isBookingLinkUsable } from "./booking-link";

describe("isBookingLinkUsable", () => {
  it("accepts an interview-stage candidate on an open vacancy", () => {
    expect(
      isBookingLinkUsable({
        applicationStatus: "interview",
        jobStatus: "published",
      })
    ).toBe(true);
  });

  it("refuses other stages and closed vacancies", () => {
    for (const applicationStatus of [
      "submitted",
      "reviewed",
      "accepted",
      "rejected",
    ]) {
      expect(
        isBookingLinkUsable({ applicationStatus, jobStatus: "published" })
      ).toBe(false);
    }
    expect(
      isBookingLinkUsable({
        applicationStatus: "interview",
        jobStatus: "closed",
      })
    ).toBe(false);
  });
});
