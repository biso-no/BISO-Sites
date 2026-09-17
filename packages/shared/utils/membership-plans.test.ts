import { describe, expect, it } from "vitest";
import {
  deriveAccrualMonths,
  describeMembershipTerm,
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  toMembershipPlan,
} from "./membership-plans";

function row(overrides: Record<string, unknown> = {}) {
  return {
    $id: "54",
    name: "BISO Membership fall 2026",
    price: 350,
    membership_id: "54",
    category: "113176",
    startDate: "2026-08-01",
    expiryDate: "2026-12-31",
    status: true,
    canPurchase: true,
    ...overrides,
  };
}

describe("deriveAccrualMonths", () => {
  it("maps a autumn semester span to 6", () => {
    expect(deriveAccrualMonths("2026-08-01", "2026-12-31")).toBe(6);
  });

  it("maps a spring semester span to 6", () => {
    expect(deriveAccrualMonths("2027-01-01", "2027-06-30")).toBe(6);
  });

  it("maps a full year span to 12", () => {
    expect(deriveAccrualMonths("2026-08-01", "2027-06-30")).toBe(12);
  });

  it("reads DD.MM.YYYY dates", () => {
    expect(deriveAccrualMonths("01.07.2026", "31.12.2026")).toBe(6);
    expect(deriveAccrualMonths("01.07.2026", "01.07.2027")).toBe(12);
    expect(deriveAccrualMonths("01.07.2026", "01.07.2029")).toBe(36);
  });

  it("maps a three year span to 36", () => {
    expect(deriveAccrualMonths("2026-08-01", "2029-06-30")).toBe(36);
  });

  it("rejects an unparseable start date", () => {
    expect(deriveAccrualMonths("not-a-date", "2026-12-31")).toBeNull();
  });

  it("rejects an unparseable expiry date", () => {
    expect(deriveAccrualMonths("2026-08-01", "")).toBeNull();
  });

  it("snaps a ~22-month span to 12 (accepted by design)", () => {
    // 2026-08-01 to 2028-06-30 is 22 months, equidistant from 12 and 36
    // but the snapping loop's < operator resolves ties to the lower option.
    // Out-of-catalogue spans snapping is intentional behaviour.
    expect(deriveAccrualMonths("2026-08-01", "2028-06-30")).toBe(12);
  });

  it("tie-break: 24-month span resolves to 12, not 36", () => {
    // 2026-01-01 to 2028-01-01 is exactly 24 months (equidistant from 12 and 36)
    // The nearest-match loop uses strict <, so ties resolve to the lower option.
    expect(deriveAccrualMonths("2026-01-01", "2028-01-01")).toBe(12);
  });
});

describe("toMembershipPlan", () => {
  it("hands DD.MM.YYYY row dates on as YYYY-MM-DD", () => {
    expect(
      toMembershipPlan(
        row({ startDate: "01.07.2026", expiryDate: "31.12.2026" })
      )
    ).toMatchObject({
      accrualMonths: 6,
      expiryDate: "2026-12-31",
      startDate: "2026-07-01",
    });
  });

  it("maps a semester row", () => {
    expect(toMembershipPlan(row())).toEqual({
      id: "54",
      name: "BISO Membership fall 2026",
      price: 350,
      productId: 54,
      categoryId: 113_176,
      duration: "semester",
      accrualMonths: 6,
      startDate: "2026-08-01",
      expiryDate: "2026-12-31",
    });
  });

  it("maps a three year row", () => {
    const plan = toMembershipPlan(
      row({
        $id: "82",
        membership_id: "82",
        category: "113177",
        name: "BISO Membership fall 2026 - spring 2029",
        price: 1350,
        expiryDate: "2029-06-30",
      })
    );
    expect(plan?.duration).toBe("three_years");
    expect(plan?.accrualMonths).toBe(36);
    expect(plan?.productId).toBe(82);
    expect(plan?.categoryId).toBe(113_177);
  });

  it("rejects a row with no category", () => {
    expect(toMembershipPlan(row({ category: null }))).toBeNull();
  });

  it("rejects a row with a non-numeric membership id", () => {
    expect(toMembershipPlan(row({ membership_id: "abc" }))).toBeNull();
  });

  it("rejects a row with a zero or missing price", () => {
    expect(toMembershipPlan(row({ price: 0 }))).toBeNull();
    expect(toMembershipPlan(row({ price: null }))).toBeNull();
  });

  it("rejects a row with an unparseable start date", () => {
    expect(toMembershipPlan(row({ startDate: "not-a-date" }))).toBeNull();
  });

  it("rejects a row with an unparseable expiry date", () => {
    expect(toMembershipPlan(row({ expiryDate: "" }))).toBeNull();
  });

  it("exposes the Finago dimension id and label per duration", () => {
    expect(MEMBERSHIP_DIMENSION_IDS.semester).toBe("100");
    expect(MEMBERSHIP_DIMENSION_IDS.year).toBe("200");
    expect(MEMBERSHIP_DIMENSION_IDS.three_years).toBe("300");
    expect(MEMBERSHIP_DIMENSION_LABELS.semester).toBe("Semester");
    expect(MEMBERSHIP_DIMENSION_LABELS.year).toBe("Year");
    expect(MEMBERSHIP_DIMENSION_LABELS.three_years).toBe("3 Years");
  });
});

describe("describeMembershipTerm", () => {
  it("describes a fall semester", () => {
    expect(describeMembershipTerm("01.07.2026", "31.12.2026")).toEqual({
      duration: "semester",
      fromYear: 2026,
      season: "fall",
      toYear: 2026,
    });
  });

  it("describes a spring semester", () => {
    expect(describeMembershipTerm("2027-01-01", "2027-06-30")).toEqual({
      duration: "semester",
      fromYear: 2027,
      season: "spring",
      toYear: 2027,
    });
  });

  it("describes multi-semester terms by year span without a season", () => {
    expect(describeMembershipTerm("01.07.2026", "01.07.2027")).toEqual({
      duration: "year",
      fromYear: 2026,
      season: null,
      toYear: 2027,
    });
    expect(describeMembershipTerm("01.07.2026", "01.07.2029")).toMatchObject({
      duration: "three_years",
      toYear: 2029,
    });
  });

  it("returns null for unreadable dates", () => {
    expect(describeMembershipTerm("soon", "2026-12-31")).toBeNull();
  });
});
