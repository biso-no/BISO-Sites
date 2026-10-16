const OSLO_TIME_ZONE = "Europe/Oslo";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UTC_MIDNIGHT_REGEX =
  /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/;
const MS_PER_MINUTE = 60_000;

const osloFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
});

/** Minutes Oslo is ahead of UTC at the given instant (60 or 120). */
function osloOffsetMinutes(at: Date): number {
  const parts = osloFormatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  const atWholeSecond = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((wallClockAsUtc - atWholeSecond) / MS_PER_MINUTE);
}

/** `2026-09-14` → the last millisecond of 14 September in Oslo, as ISO UTC. */
export function osloEndOfDayIso(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const endOfDayAsUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const offset = osloOffsetMinutes(new Date(endOfDayAsUtc));
  return new Date(endOfDayAsUtc - offset * MS_PER_MINUTE).toISOString();
}

/**
 * Application deadlines are picked as a calendar date, and a vacancy should
 * stay open for the whole of that day in Norway. Date-only input, and legacy
 * values stored as midnight UTC (the old conversion), become end of day Oslo.
 * Any other timestamp is kept as-is.
 */
export function normalizeApplicationDeadline(
  value: string | null | undefined
): string | null {
  if (!value) {
    return null;
  }
  if (DATE_ONLY_REGEX.test(value)) {
    return osloEndOfDayIso(value);
  }
  const legacyMidnight = UTC_MIDNIGHT_REGEX.exec(value);
  if (legacyMidnight?.[1]) {
    return osloEndOfDayIso(legacyMidnight[1]);
  }
  return new Date(value).toISOString();
}
