import { describe, expect, test } from "bun:test";
import { isoToOsloWallClock } from "@repo/shared/utils/oslo-time";
import { isQuietHoursOslo, nextMorningOslo } from "./quiet-hours";

/** A UTC instant from an Oslo wall-clock time, given the UTC offset in hours. */
const oslo = (wallClock: string, offsetHours: number): Date =>
  new Date(`${wallClock}:00+0${offsetHours}:00`);

describe("isQuietHoursOslo", () => {
  test.each([
    ["2026-01-15T21:59", 1, false],
    ["2026-01-15T22:00", 1, true],
    ["2026-01-16T07:59", 1, true],
    ["2026-01-16T08:00", 1, false],
    ["2026-07-15T21:59", 2, false],
    ["2026-07-15T22:00", 2, true],
    ["2026-07-16T07:59", 2, true],
    ["2026-07-16T08:00", 2, false],
  ] as const)("%s (UTC+%i) is %p", (wallClock, offset, expected) => {
    expect(isQuietHoursOslo(oslo(wallClock, offset))).toBe(expected);
  });
});

describe("nextMorningOslo", () => {
  test("from 23:30 it is 08:00 the next day", () => {
    const next = nextMorningOslo(oslo("2026-01-15T23:30", 1));
    expect(isoToOsloWallClock(next.toISOString())).toBe("2026-01-16T08:00");
  });

  test("from 03:00 it is 08:00 the same morning", () => {
    const next = nextMorningOslo(oslo("2026-01-16T03:00", 1));
    expect(isoToOsloWallClock(next.toISOString())).toBe("2026-01-16T08:00");
  });

  test("across the spring DST change it is still 08:00 Oslo", () => {
    // Clocks go forward on 2026-03-29; 08:00 CEST is 06:00 UTC.
    const next = nextMorningOslo(oslo("2026-03-28T23:30", 1));
    expect(isoToOsloWallClock(next.toISOString())).toBe("2026-03-29T08:00");
    expect(next.toISOString()).toBe("2026-03-29T06:00:00.000Z");
  });

  test("across the autumn DST change it is still 08:00 Oslo", () => {
    // Clocks go back on 2026-10-25; 08:00 CET is 07:00 UTC.
    const next = nextMorningOslo(oslo("2026-10-24T23:30", 2));
    expect(isoToOsloWallClock(next.toISOString())).toBe("2026-10-25T08:00");
    expect(next.toISOString()).toBe("2026-10-25T07:00:00.000Z");
  });

  test("at the end of a month it rolls into the next month", () => {
    const next = nextMorningOslo(oslo("2026-01-31T22:30", 1));
    expect(isoToOsloWallClock(next.toISOString())).toBe("2026-02-01T08:00");
  });
});
