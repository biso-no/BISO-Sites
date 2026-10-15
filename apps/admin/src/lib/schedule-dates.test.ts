import { beforeAll, describe, expect, test } from "bun:test";
import { localDateKey, slotKey, slotStart } from "./schedule-dates";

// The bug only shows in a zone ahead of UTC, so the test pins one and
// checks the pin took: on a UTC runner the old code passed by accident.
beforeAll(() => {
  process.env.TZ = "Europe/Oslo";
  expect(new Date(2026, 9, 20).getTimezoneOffset()).toBe(-120);
});

describe("schedule dates", () => {
  test("keys a day by its local calendar date, not the UTC date", () => {
    // Local midnight in Oslo is 22:00 or 23:00 UTC the day before, so
    // `toISOString().slice(0, 10)` named every day one day too early and
    // interviews were saved a day before the one clicked.
    const localMidnight = new Date(2026, 9, 20, 0, 0, 0, 0);
    expect(localMidnight.toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(localDateKey(localMidnight)).toBe("2026-10-20");
  });

  test("builds the slot on the clicked day at the clicked local hour", () => {
    const start = slotStart("2026-10-20", 9);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(20);
    expect(start.getHours()).toBe(9);
  });

  test("the key of a slot's start matches the grid cell it was built from", () => {
    expect(slotKey(slotStart("2026-10-20", 14))).toBe("2026-10-20-14");
  });
});
