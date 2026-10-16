/**
 * BISO events happen in Norway, so their times are always entered and shown
 * as Europe/Oslo wall-clock time, whatever timezone the browser or server
 * happens to run in (Appwrite Sites and CI run in UTC). Stored values are
 * UTC ISO instants.
 */
export const OSLO_TIME_ZONE = "Europe/Oslo";

const MS_PER_MINUTE = 60_000;
const WALL_CLOCK_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const wallClockPartsFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
});

function osloWallClockParts(at: Date) {
  const parts = wallClockPartsFormatter.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    month: get("month"),
    second: get("second"),
    year: get("year"),
  };
}

/** Minutes Oslo is ahead of UTC at the given instant (60 or 120). */
export function osloOffsetMinutes(at: Date): number {
  const p = osloWallClockParts(at);
  const wallClockAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  const atWholeSecond = Math.floor(at.getTime() / 1000) * 1000;
  return Math.round((wallClockAsUtc - atWholeSecond) / MS_PER_MINUTE);
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `2026-09-22T13:00` (a `<input type="datetime-local">` value, read as Oslo
 * time) → `2026-09-22T11:00:00.000Z`. Returns null for empty/invalid input.
 */
export function osloWallClockToIso(
  value: string | null | undefined
): string | null {
  const match = value ? WALL_CLOCK_REGEX.exec(value) : null;
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number | undefined,
  ];
  const wallClockAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    Number.isNaN(second) ? 0 : (second ?? 0)
  );
  // The offset at the guessed instant is right except within an hour of a DST
  // switch; re-checking at the corrected instant settles it.
  const firstGuess = osloOffsetMinutes(new Date(wallClockAsUtc));
  const offset = osloOffsetMinutes(
    new Date(wallClockAsUtc - firstGuess * MS_PER_MINUTE)
  );
  return new Date(wallClockAsUtc - offset * MS_PER_MINUTE).toISOString();
}

/**
 * A stored ISO instant → `2026-09-22T13:00`, the Oslo wall-clock value a
 * `<input type="datetime-local">` expects. Empty string for empty/invalid.
 */
export function isoToOsloWallClock(value: string | null | undefined): string {
  const date = toValidDate(value);
  if (!date) {
    return "";
  }
  const p = osloWallClockParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: OSLO_TIME_ZONE,
});

/** `HH:mm` in Oslo time, or null for empty/invalid input. */
export function formatOsloTime(
  value: string | Date | null | undefined
): string | null {
  const date = toValidDate(value);
  return date ? timeFormatter.format(date) : null;
}

/**
 * Formats a date in Oslo time with the given `Intl` options, so server and
 * browser renders agree. Null for empty/invalid input.
 */
export function formatOsloDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "en-US"
): string | null {
  const date = toValidDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: OSLO_TIME_ZONE,
      }).format(date)
    : null;
}
