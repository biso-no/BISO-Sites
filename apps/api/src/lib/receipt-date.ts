// Calendar-day helpers for reimbursement booking dates. Receipt dates are
// stored as Appwrite datetimes, but the booking date is a calendar day in the
// Europe/Oslo time zone.

import { formatOsloDay } from "@repo/shared/utils/oslo-time";

export { receiptDateInOslo, todayInOslo } from "@repo/shared/utils/oslo-time";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
// Oslo is UTC+1 (winter) or UTC+2 (summer), so local midnight is 22:00 or
// 23:00 UTC the evening before.
const OSLO_OFFSET_HOURS = [2, 1];

function osloDayStartMs(day: string): number | null {
  if (!ISO_DAY.test(day)) {
    return null;
  }
  const utcMidnight = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(utcMidnight)) {
    return null;
  }
  for (const hours of OSLO_OFFSET_HOURS) {
    const start = utcMidnight - hours * MS_PER_HOUR;
    if (
      formatOsloDay(new Date(start)) === day &&
      formatOsloDay(new Date(start - 1)) !== day
    ) {
      return start;
    }
  }
  return null;
}

/**
 * The UTC instants that bound an Oslo calendar day: `start` is the first
 * moment of the day, `end` the first moment of the next one (exclusive).
 * Handles the 23 and 25 hour days at the DST changes.
 */
export function osloDayBoundsUtc(
  day: string
): { end: string; start: string } | null {
  const start = osloDayStartMs(day);
  if (start === null) {
    return null;
  }
  const nextDay = formatOsloDay(new Date(start + MS_PER_DAY + 2 * MS_PER_HOUR));
  const end = osloDayStartMs(nextDay);
  if (end === null) {
    return null;
  }
  return {
    end: new Date(end).toISOString(),
    start: new Date(start).toISOString(),
  };
}
