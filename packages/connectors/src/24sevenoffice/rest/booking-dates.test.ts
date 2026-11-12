import { describe, expect, test } from "bun:test";
import {
  closedPeriodDate,
  isClosedPeriodError,
  nextPeriodStart,
  periodContaining,
  resolveBookingDate,
} from "./booking-dates";

const locks = [
  { startingDate: "2024-01-01", isLocked: true },
  { startingDate: "2025-01-01", isLocked: true },
  { startingDate: "2026-01-01", isLocked: false },
];
const periods = [
  { startingDate: "2026-01-01", endingDate: "2026-01-31" },
  { startingDate: "2026-02-01", endingDate: "2026-02-28" },
  { startingDate: "2026-10-01", endingDate: "2026-10-31" },
  { startingDate: "2026-11-01", endingDate: "2026-11-30" },
];
const today = "2026-11-11";

describe("resolveBookingDate", () => {
  test("keeps a date in an open year", () => {
    expect(
      resolveBookingDate({ receiptDate: "2026-10-10", today, locks, periods })
    ).toEqual({ date: "2026-10-10", reason: null });
  });

  test("moves a date in a locked year to the first period of the next open year", () => {
    expect(
      resolveBookingDate({ receiptDate: "2025-12-18", today, locks, periods })
    ).toEqual({ date: "2026-01-01", reason: "locked_year" });
  });

  test("skips several locked years", () => {
    expect(
      resolveBookingDate({ receiptDate: "2024-06-01", today, locks, periods })
        .date
    ).toBe("2026-01-01");
  });

  test("falls back to the year start when no period matches", () => {
    expect(
      resolveBookingDate({
        receiptDate: "2025-12-18",
        today,
        locks,
        periods: [],
      })
    ).toEqual({ date: "2026-01-01", reason: "locked_year" });
  });

  test("uses today for a missing or future date", () => {
    expect(
      resolveBookingDate({ receiptDate: null, today, locks, periods })
    ).toEqual({ date: today, reason: "missing_date" });
    expect(
      resolveBookingDate({ receiptDate: "2027-03-01", today, locks, periods })
    ).toEqual({ date: today, reason: "future_date" });
  });

  test("skips the lock check with no locks", () => {
    expect(
      resolveBookingDate({
        receiptDate: "2020-01-01",
        today,
        locks: [],
        periods,
      })
    ).toEqual({ date: "2020-01-01", reason: null });
  });

  test("throws when no open year follows", () => {
    expect(() =>
      resolveBookingDate({
        receiptDate: "2025-05-01",
        today,
        periods,
        locks: [{ startingDate: "2025-01-01", isLocked: true }],
      })
    ).toThrow("No open fiscal year after 2025-05-01");
  });
});

describe("locked years before the first lock", () => {
  test("a date before the first lock is treated as locked", () => {
    expect(
      resolveBookingDate({ receiptDate: "2023-06-01", today, locks, periods })
    ).toEqual({ date: "2026-01-01", reason: "locked_year" });
  });
});

describe("period helpers", () => {
  test("nextPeriodStart uses the period list, then the next calendar month", () => {
    expect(nextPeriodStart("2026-10-10", periods)).toBe("2026-11-01");
    expect(nextPeriodStart("2026-11-20", periods)).toBe("2026-12-01");
    expect(nextPeriodStart("2026-12-20", periods)).toBe("2027-01-01");
  });

  test("periodContaining uses the list, then the calendar month", () => {
    expect(periodContaining("2026-10-10", periods)).toEqual(periods[2]);
    expect(periodContaining("2024-02-10", periods)).toEqual({
      startingDate: "2024-02-01",
      endingDate: "2024-02-29",
    });
  });
});

describe("two-month periods", () => {
  const twoMonth = [
    { startingDate: "2024-01-01", endingDate: "2024-02-29" },
    { startingDate: "2024-03-01", endingDate: "2024-04-30" },
  ];

  test("periodContaining returns the listed period", () => {
    expect(periodContaining("2024-02-10", twoMonth)).toEqual(twoMonth[0]);
  });

  test("nextPeriodStart returns the next listed start", () => {
    expect(nextPeriodStart("2024-01-15", twoMonth)).toBe("2024-03-01");
  });

  test("locked-year move lands on the first listed period start", () => {
    expect(
      resolveBookingDate({
        receiptDate: "2025-12-18",
        today,
        locks,
        periods: [
          { startingDate: "2026-02-01", endingDate: "2026-03-31" },
          { startingDate: "2026-04-01", endingDate: "2026-05-31" },
        ],
      })
    ).toEqual({ date: "2026-02-01", reason: "locked_year" });
  });
});

describe("isClosedPeriodError", () => {
  test("recognises closed-period errors conservatively", () => {
    expect(
      isClosedPeriodError(
        '{"message":"No open financial period for date 2025-10-10"}'
      )
    ).toBe(true);
    expect(isClosedPeriodError("Perioden er låst")).toBe(true);
    expect(isClosedPeriodError("Perioden er låst for dato 10.10.2025")).toBe(
      true
    );
    expect(
      isClosedPeriodError('{"message":"Account 9999 does not exist"}')
    ).toBe(false);
    expect(isClosedPeriodError("Request closed by peer")).toBe(false);
    expect(isClosedPeriodError("Period is locked")).toBe(true);
    expect(isClosedPeriodError("requests blocked for this period")).toBe(false);
    expect(isClosedPeriodError("information disclosed for the period")).toBe(
      false
    );
  });
});

describe("closedPeriodDate", () => {
  test("reads ISO and Norwegian dates from a closed-period message", () => {
    expect(
      closedPeriodDate(
        '{"message":"No open financial period for date 2025-10-10"}'
      )
    ).toBe("2025-10-10");
    expect(closedPeriodDate("Perioden er låst for dato 10.10.2025")).toBe(
      "2025-10-10"
    );
    expect(closedPeriodDate("Period is locked (2026-09-12)")).toBe(
      "2026-09-12"
    );
  });

  test("returns the first date named", () => {
    expect(
      closedPeriodDate("Period is locked: 2026-09-12 and 2026-10-01")
    ).toBe("2026-09-12");
  });

  test("returns null without a date, with an invalid date, or off topic", () => {
    expect(closedPeriodDate("Period is locked")).toBeNull();
    expect(closedPeriodDate("Period is locked (2026-02-30)")).toBeNull();
    expect(closedPeriodDate("Period is locked (31.04.2026)")).toBeNull();
    expect(closedPeriodDate("Account 9999 missing on 2026-09-12")).toBeNull();
  });
});
