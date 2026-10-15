import { describe, expect, it } from "vitest";
import { availableSlots } from "./booking-slots";

// 2026-10-19 is a Monday. Oslo is UTC+2 that week (CEST).
const WINDOW = {
  from: new Date("2026-10-19T00:00:00Z"),
  to: new Date("2026-10-21T00:00:00Z"),
};

const hours = (slots: Date[]) =>
  slots.map((slot) =>
    slot.toLocaleString("sv-SE", { timeZone: "Europe/Oslo" }).slice(0, 16)
  );

describe("availableSlots", () => {
  it("offers office hours in Oslo time, whatever the server's zone is", () => {
    const slots = availableSlots({ ...WINDOW, busy: [], durationMinutes: 60 });

    const monday = hours(slots).filter((s) => s.startsWith("2026-10-19"));
    expect(monday[0]).toBe("2026-10-19 09:00");
    expect(monday.at(-1)).toBe("2026-10-19 16:00");
  });

  it("steps every 30 minutes and fits the whole interview inside the day", () => {
    const slots = availableSlots({
      ...WINDOW,
      busy: [],
      durationMinutes: 45,
      stepMinutes: 30,
    });

    const monday = hours(slots).filter((s) => s.startsWith("2026-10-19"));
    expect(monday.slice(0, 3)).toEqual([
      "2026-10-19 09:00",
      "2026-10-19 09:30",
      "2026-10-19 10:00",
    ]);
    // 16:30 + 45 min would end after 17:00.
    expect(monday.at(-1)).toBe("2026-10-19 16:00");
  });

  it("skips weekends", () => {
    const slots = availableSlots({
      busy: [],
      durationMinutes: 30,
      from: new Date("2026-10-23T00:00:00Z"), // Friday
      to: new Date("2026-10-27T00:00:00Z"), // Tuesday
    });

    const days = new Set(hours(slots).map((s) => s.slice(0, 10)));
    expect([...days]).toEqual(["2026-10-23", "2026-10-26"]);
  });

  it("leaves out anything that overlaps a busy interval", () => {
    const slots = availableSlots({
      ...WINDOW,
      busy: [
        { end: "2026-10-19T09:00:00Z", start: "2026-10-19T08:30:00Z" }, // 10:30-11:00 Oslo
      ],
      durationMinutes: 60,
    });

    const monday = hours(slots).filter((s) => s.startsWith("2026-10-19"));
    expect(monday).not.toContain("2026-10-19 10:00");
    expect(monday).not.toContain("2026-10-19 10:30");
    expect(monday).toContain("2026-10-19 09:00");
    expect(monday).toContain("2026-10-19 11:00");
  });

  it("never offers a slot before the window starts", () => {
    const slots = availableSlots({
      busy: [],
      durationMinutes: 30,
      from: new Date("2026-10-19T12:10:00Z"), // 14:10 Oslo
      to: new Date("2026-10-20T00:00:00Z"),
    });

    expect(hours(slots)[0]).toBe("2026-10-19 14:30");
  });
});
