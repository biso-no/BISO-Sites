/**
 * Date rules for matching an expense's receipts to a department's events.
 * Pure: shared by the server action and the composer.
 */

/** An event counts when it starts within this many days of a receipt date. */
export const EVENT_MATCH_WINDOW_DAYS = 7;
export const MAX_EVENT_SUGGESTIONS = 3;
/** A server action takes any body; cap what one lookup reads. */
const MAX_DATES = 60;
const DAY_MS = 86_400_000;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
// en-CA formats a date as YYYY-MM-DD.
const osloDay = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

/** Days since the epoch for a YYYY-MM-DD date, or null when it isn't one. */
function dayNumber(value: string): number | null {
  const match = CALENDAR_DATE.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  // Rejects dates that roll over, such as 30 February.
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return time / DAY_MS;
}

function isoDay(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toISOString();
}

/** The receipt dates worth matching: valid calendar days, each once, sorted. */
export function receiptDateList(values: readonly unknown[]): string[] {
  const days = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const day = value.slice(0, 10);
    if (dayNumber(day) !== null) {
      days.add(day);
    }
  }
  return [...days].sort().slice(0, MAX_DATES);
}

/**
 * The start-date ranges to read, one per cluster of receipt dates. Each is a
 * day wider than the window on both sides, so an event late in the evening in
 * Oslo (the previous day in UTC) is read; `nearestEvents` applies the exact
 * window.
 */
export function eventSearchWindows(
  dates: string[]
): { from: string; to: string }[] {
  const reach = EVENT_MATCH_WINDOW_DAYS + 1;
  const days = dates
    .map(dayNumber)
    .filter((day): day is number => day !== null)
    .sort((a, b) => a - b);

  const windows: { from: number; to: number }[] = [];
  for (const day of days) {
    const last = windows.at(-1);
    if (last && day - reach <= last.to) {
      last.to = day + reach;
    } else {
      windows.push({ from: day - reach, to: day + reach });
    }
  }

  return windows.map(({ from, to }) => ({
    from: isoDay(from),
    to: isoDay(to),
  }));
}

/** Days between an event's start (its day in Oslo) and the closest receipt. */
function distanceInDays(startDate: string, receiptDays: number[]): number {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  const eventDay = dayNumber(osloDay.format(start));
  if (eventDay === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.min(...receiptDays.map((day) => Math.abs(day - eventDay)));
}

/**
 * Events starting within the window of any receipt date, nearest first (ties
 * go to the earlier start), at most `limit`.
 */
export function nearestEvents<T extends { startDate: string }>(
  events: T[],
  dates: string[],
  limit: number = MAX_EVENT_SUGGESTIONS
): T[] {
  const receiptDays = dates
    .map(dayNumber)
    .filter((day): day is number => day !== null);
  if (receiptDays.length === 0) {
    return [];
  }

  return events
    .map((event) => ({
      distance: distanceInDays(event.startDate, receiptDays),
      event,
    }))
    .filter(({ distance }) => distance <= EVENT_MATCH_WINDOW_DAYS)
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.event.startDate.localeCompare(b.event.startDate)
    )
    .slice(0, limit)
    .map(({ event }) => event);
}
