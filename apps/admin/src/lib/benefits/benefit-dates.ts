import {
  isoToOsloWallClock,
  osloWallClockToIso,
} from "@repo/shared/utils/oslo-time";

const DATE_LENGTH = 10;

/** `YYYY-MM-DD` → UTC ISO for Oslo 00:00:00 that day. */
export function benefitStartIso(
  date: string | null | undefined
): string | null {
  return date ? osloWallClockToIso(`${date}T00:00:00`) : null;
}

/** `YYYY-MM-DD` → UTC ISO for Oslo 23:59:59 that day. */
export function benefitEndIso(date: string | null | undefined): string | null {
  return date ? osloWallClockToIso(`${date}T23:59:59`) : null;
}

/** UTC ISO → the Oslo calendar date `YYYY-MM-DD`. */
export function benefitDateFromIso(
  iso: string | null | undefined
): string | null {
  const wallClock = isoToOsloWallClock(iso);
  return wallClock ? wallClock.slice(0, DATE_LENGTH) : null;
}
