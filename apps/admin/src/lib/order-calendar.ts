/**
 * The one calendar the orders surfaces speak.
 *
 * The date filters bound on it, the rows render in it, and the CSV labels its
 * `order_date` with it. They previously disagreed — the filters moved to local
 * days while the export still sliced the UTC ISO string, so an order excluded
 * by `to=2026-01-31` for being a 1 February order in Oslo was nonetheless
 * labelled 31 January in the file. Keeping the rule in one module is what stops
 * that drifting apart again.
 *
 * Pure by construction, like `./list-params`: the export renderer is shared
 * with a client component, so this must never import `@repo/api` or anything
 * else reaching `node-appwrite`.
 */

/**
 * Fixed rather than read from the viewer's admin timezone preference: `?from=`
 * and `?to=` travel in a shareable URL, and a range whose meaning shifted with
 * whoever opened the link would be worse than one that is merely not the
 * reader's own clock. Every BISO campus is in this zone.
 */
export const ORDER_CALENDAR_TIMEZONE = "Europe/Oslo";

/** The calendar parts of `instant` as read in `ORDER_CALENDAR_TIMEZONE`. */
function calendarParts(instant: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: ORDER_CALENDAR_TIMEZONE,
    year: "numeric",
  }).formatToParts(instant);

  const read: Record<string, number> = {};
  for (const entry of parts) {
    if (entry.type !== "literal") {
      read[entry.type] = Number(entry.value);
    }
  }
  // Some engines render midnight as hour 24 under `hour12: false`.
  read.hour = (read.hour ?? 0) % 24;
  return read;
}

/** How far the calendar runs ahead of UTC at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date): number {
  const part = calendarParts(instant);
  const asUtc = Date.UTC(
    part.year,
    part.month - 1,
    part.day,
    part.hour,
    part.minute,
    part.second
  );
  // `formatToParts` has no milliseconds, so `asUtc` lands on a whole second.
  // Comparing it against the raw instant would fold that fraction into the
  // offset and push an end-of-day bound a second past midnight.
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/**
 * The instant at which a local wall-clock time on `day` occurs, as an ISO
 * timestamp.
 *
 * The offset is resolved twice: the first pass uses the offset at the UTC
 * reading of that wall time, the second re-reads it at the instant that
 * produced, which is what makes the bound correct across a daylight saving
 * transition rather than an hour out for half the year.
 */
export function zonedDayBound(day: string, endOfDay: boolean): string {
  const wall = Date.parse(
    `${day}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
  );
  const firstPass = wall - zoneOffsetMs(new Date(wall));
  const settled = wall - zoneOffsetMs(new Date(firstPass));
  return new Date(settled).toISOString();
}

/** An instant as its `yyyy-mm-dd` day in the organisation's calendar. */
export function formatCalendarDay(iso: string): string {
  const part = calendarParts(new Date(iso));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${part.year}-${pad(part.month)}-${pad(part.day)}`;
}
