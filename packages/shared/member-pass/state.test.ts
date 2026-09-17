import type { MembershipStatus } from "@repo/shared/utils/membership-status";
import { describe, expect, it } from "vitest";
import { buildHolder, memberPassStateFor } from "./state";

function status(overrides: Partial<MembershipStatus>): MembershipStatus {
  return {
    checkedAt: 0,
    expiredMemberships: [],
    finagoCategoryIds: [],
    isMember: false,
    memberships: [],
    ...overrides,
  };
}

const semester = {
  category: "113176",
  expiryDate: "2026-12-31",
  id: "54",
  name: "Semester",
  startDate: "2026-07-01",
};

describe("memberPassStateFor", () => {
  it.each([
    [{ isMember: true, memberships: [semester] }, "active"],
    [{ reason: "no_student_id" }, "no_bi_identity"],
    [{ reason: "invalid_student_id" }, "no_bi_identity"],
    [{ reason: "finago_error" }, "unavailable"],
    [{ reason: "unexpected_error" }, "unavailable"],
    [{ reason: "expired" }, "expired"],
    [{ reason: "no_categories" }, "not_member"],
    [{}, "not_member"],
  ])("maps %o to %s", (overrides, expected) => {
    expect(memberPassStateFor(status(overrides))).toBe(expected);
  });
});

describe("buildHolder", () => {
  it("describes the longest-running membership", () => {
    const year = {
      ...semester,
      expiryDate: "2027-07-01",
      id: "71",
      name: "1 Year",
    };
    expect(
      buildHolder(
        "Markus Heien",
        status({ isMember: true, memberships: [semester, year] })
      )
    ).toEqual({
      expiryDate: "2027-07-01",
      membershipName: "1 Year",
      name: "Markus Heien",
      startDate: "2026-07-01",
      term: { duration: "year", fromYear: 2026, season: null, toYear: 2027 },
    });
  });

  it("returns null without a membership", () => {
    expect(buildHolder("X", status({}))).toBeNull();
  });
});
