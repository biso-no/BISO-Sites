/**
 * Pure rules for which date a reimbursement receipt is booked on in Finago.
 * All dates are `YYYY-MM-DD` strings, so plain string comparison orders them.
 */

import type { FiscalYearLock } from "../fiscal-years";
import type { FiscalPeriod } from "./fiscal-periods";

export type BookingDateReason =
  | "missing_date"
  | "future_date"
  | "locked_year"
  | "closed_period";

export interface ResolvedBookingDate {
  date: string;
  reason: BookingDateReason | null;
}

/**
 * One entry per move of a receipt line. A line moved more than once has one
 * entry per move, so the list doubles as history.
 */
export interface DateShift {
  finagoMessage?: string;
  from: string;
  reason: BookingDateReason;
  ref: string | null;
  to: string;
}

const MONTHS_PER_YEAR = 12;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const MONTH_END = 7;
const DATE_LENGTH = 10;

// Word-start boundaries keep "blocked", "disclosed" and "periodic" out.
const PERIOD_WORD = /\bperiod/i;
const CLOSED_WORD =
  /\b(lock|låst|closed|stengt|sperret|no open|not open|ikke åpen)/i;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function firstOfMonth(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

function parseYearMonth(date: string): { month: number; year: number } {
  return {
    year: Number(date.slice(0, YEAR_LENGTH)),
    month: Number(date.slice(MONTH_START, MONTH_END)),
  };
}

function nextCalendarMonthStart(date: string): string {
  const { year, month } = parseYearMonth(date);
  return month === MONTHS_PER_YEAR
    ? firstOfMonth(year + 1, 1)
    : firstOfMonth(year, month + 1);
}

function calendarMonthOf(date: string): FiscalPeriod {
  const { year, month } = parseYearMonth(date);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startingDate: firstOfMonth(year, month),
    endingDate: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

/** The calendar day after `date` (YYYY-MM-DD). */
export function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, DATE_LENGTH);
}

/**
 * First period start strictly after `date`; with none, the first day of the
 * calendar month after `date`.
 */
export function nextPeriodStart(date: string, periods: FiscalPeriod[]): string {
  const next = periods.find((period) => period.startingDate > date);
  return next ? next.startingDate : nextCalendarMonthStart(date);
}

/**
 * The period with `startingDate <= date <= endingDate`; with none, that
 * date's calendar month.
 */
export function periodContaining(
  date: string,
  periods: FiscalPeriod[]
): FiscalPeriod {
  const match = periods.find(
    (period) => period.startingDate <= date && date <= period.endingDate
  );
  return match ?? calendarMonthOf(date);
}

/**
 * Finago's real closed-period message has not been observed yet, so this
 * match is deliberately narrow: it needs both a period word and a
 * locked/closed word. The retry loop logs the raw message each time it fires
 * so the pattern can be tightened or widened once a real one is seen.
 */
export function isClosedPeriodError(message: string): boolean {
  return PERIOD_WORD.test(message) && CLOSED_WORD.test(message);
}

function currentLock(
  date: string,
  locks: FiscalYearLock[]
): FiscalYearLock | undefined {
  let found: FiscalYearLock | undefined;
  for (const lock of locks) {
    if (lock.startingDate <= date) {
      found = lock;
    }
  }
  return found;
}

export function resolveBookingDate(input: {
  receiptDate: string | null;
  today: string;
  locks: FiscalYearLock[];
  periods: FiscalPeriod[];
}): ResolvedBookingDate {
  const { receiptDate, today, locks, periods } = input;

  if (!receiptDate) {
    return { date: today, reason: "missing_date" };
  }

  let date = receiptDate;
  let reason: BookingDateReason | null = null;
  if (date > today) {
    date = today;
    reason = "future_date";
  }

  const lock = currentLock(date, locks);
  if (lock?.isLocked) {
    const open = locks.find(
      (candidate) =>
        candidate.startingDate > lock.startingDate && !candidate.isLocked
    );
    if (!open) {
      throw new Error(`No open fiscal year after ${date}`);
    }
    const period = periods.find(
      (candidate) => candidate.startingDate >= open.startingDate
    );
    return {
      date: period ? period.startingDate : open.startingDate,
      reason: "locked_year",
    };
  }

  return { date, reason };
}
