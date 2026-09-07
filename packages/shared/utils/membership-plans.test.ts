import { describe, expect, it } from "vitest";
import {
  deriveAccrualMonths,
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  membershipAccrualStart,
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

describe("membership dates as 24SevenOffice actually stores them", () => {
  // Every fixture above is ISO, which is why this went unnoticed: the live
  // `memberships` rows are `DD.MM.YYYY` — "01.07.2026", "31.12.2026". `new
  // Date()` does not understand that format, so the Semester plan's expiry
  // parsed as Invalid Date and the plan was dropped from the catalogue
  // entirely. The 350 kr membership could not be bought.
  it("parses the DD.MM.YYYY the catalogue is synced with", () => {
    expect(deriveAccrualMonths("01.07.2026", "31.12.2026")).toBe(6);
    expect(deriveAccrualMonths("01.07.2026", "01.07.2027")).toBe(12);
    expect(deriveAccrualMonths("01.07.2026", "01.07.2029")).toBe(36);
  });

  it("keeps the Semester plan in the catalogue", () => {
    const plan = toMembershipPlan(
      row({
        name: "Semester",
        startDate: "01.07.2026",
        expiryDate: "31.12.2026",
      })
    );
    expect(plan).not.toBeNull();
    expect(plan?.accrualMonths).toBe(6);
    expect(plan?.duration).toBe("semester");
  });

  it("does not read a day over 12 as a month", () => {
    // The two surviving plans only worked by accident: "01.07.20XX" was being
    // misread as *January 7* on both sides, so the difference happened to be
    // right. A day past the 12th has no such luck.
    expect(deriveAccrualMonths("13.07.2026", "13.01.2027")).toBe(6);
    expect(deriveAccrualMonths("31.12.2026", "30.06.2027")).toBe(6);
  });

  it("still rejects what is genuinely not a date", () => {
    expect(deriveAccrualMonths("not-a-date", "31.12.2026")).toBeNull();
    expect(deriveAccrualMonths("01.07.2026", "")).toBeNull();
    expect(deriveAccrualMonths("31.02.2026", "31.12.2026")).toBeNull();
    expect(deriveAccrualMonths("01.13.2026", "31.12.2026")).toBeNull();
  });
});

describe("membershipAccrualStart", () => {
  // The accrual period a membership is booked into starts at the half-year
  // boundary containing the purchase: buy in the summer half and it accrues
  // from 1 July; buy in the spring half and it accrues from 1 January.
  it("books a purchase in the first half of the year from 1 January", () => {
    for (const on of ["2027-01-01", "2027-02-14", "2027-06-30"]) {
      expect(membershipAccrualStart(on), on).toBe("2027-01-01");
    }
  });

  it("books a purchase in the second half of the year from 1 July", () => {
    for (const on of ["2026-07-01", "2026-08-12", "2026-12-31"]) {
      expect(membershipAccrualStart(on), on).toBe("2026-07-01");
    }
  });

  it("reads the boundary in UTC, not the server's timezone", () => {
    // 30 June 23:00 UTC is 1 July in Oslo. The accounting period must not
    // depend on where the fulfilment host happens to run.
    expect(membershipAccrualStart(new Date("2026-06-30T23:00:00Z"))).toBe(
      "2026-01-01"
    );
    expect(membershipAccrualStart(new Date("2026-07-01T00:00:00Z"))).toBe(
      "2026-07-01"
    );
  });

  it("is idempotent — an accrual start maps to itself", () => {
    // Relied on by the invoice builder to tell a snapshot written by checkout
    // from a legacy catalogue date.
    expect(membershipAccrualStart("2026-07-01")).toBe("2026-07-01");
    expect(membershipAccrualStart("2027-01-01")).toBe("2027-01-01");
  });

  it("returns null for something it cannot read", () => {
    expect(membershipAccrualStart("01.07.2026")).toBe("2026-07-01");
    expect(membershipAccrualStart("not-a-date")).toBeNull();
    expect(membershipAccrualStart("")).toBeNull();
  });
});
