import { describe, expect, it } from "vitest";
import { normalizeMembershipDate } from "./membership-dates";

describe("normalizeMembershipDate", () => {
  it("keeps an ISO date and reads a date-time by its date part", () => {
    expect(normalizeMembershipDate("2026-12-31")).toBe("2026-12-31");
    expect(normalizeMembershipDate("2026-12-31T00:00:00.000+00:00")).toBe(
      "2026-12-31"
    );
  });

  it("reads the Norwegian DD.MM.YYYY form curated rows use", () => {
    expect(normalizeMembershipDate("31.12.2026")).toBe("2026-12-31");
    expect(normalizeMembershipDate(" 1.7.2026 ")).toBe("2026-07-01");
    expect(normalizeMembershipDate("01/07/2027")).toBe("2027-07-01");
  });

  it("rejects anything that is not a real calendar date", () => {
    expect(normalizeMembershipDate("31.02.2026")).toBeNull();
    expect(normalizeMembershipDate("2026-13-01")).toBeNull();
    expect(normalizeMembershipDate("fall 2026")).toBeNull();
    expect(normalizeMembershipDate("")).toBeNull();
    expect(normalizeMembershipDate(null)).toBeNull();
  });
});
