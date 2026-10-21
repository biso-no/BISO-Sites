import {
  isoToOsloWallClock,
  osloWallClockToIso,
} from "@repo/shared/utils/oslo-time";

/**
 * Oslo quiet hours: students are probably asleep from 22:00 until 08:00.
 * Client-safe on purpose; it only uses the shared Oslo time helpers.
 */
const QUIET_FROM_HOUR = 22;
const QUIET_UNTIL_HOUR = 8;
const MORNING_WALL_CLOCK = "08:00";

function osloHour(at: Date): number {
  return Number(isoToOsloWallClock(at.toISOString()).slice(11, 13));
}

export function isQuietHoursOslo(now: Date): boolean {
  const hour = osloHour(now);
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/**
 * The next 08:00 in Oslo: this morning when it is before 08:00, otherwise
 * tomorrow morning.
 */
export function nextMorningOslo(now: Date): Date {
  const wallClock = isoToOsloWallClock(now.toISOString());
  const [year, month, day] = wallClock.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const dayOffset = osloHour(now) < QUIET_UNTIL_HOUR ? 0 : 1;
  const date = new Date(Date.UTC(year, month - 1, day + dayOffset))
    .toISOString()
    .slice(0, 10);
  const iso = osloWallClockToIso(`${date}T${MORNING_WALL_CLOCK}`);
  if (!iso) {
    throw new Error("Could not work out the next morning in Oslo.");
  }
  return new Date(iso);
}
