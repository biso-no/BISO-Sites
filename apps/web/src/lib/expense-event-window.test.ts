import { describe, expect, it } from "vitest";
import {
  eventSearchWindows,
  nearestEvents,
  receiptDateList,
} from "./expense-event-window";

describe("receiptDateList", () => {
  it("keeps each valid calendar date once, sorted", () => {
    expect(
      receiptDateList([
        "2026-11-03",
        "2026-11-01",
        "2026-11-03",
        "",
        "nope",
        "2026-02-30",
        5,
        null,
        "2026-11-02T10:00:00.000Z",
      ])
    ).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });
});

describe("eventSearchWindows", () => {
  it("covers dates close together with one window", () => {
    expect(eventSearchWindows(["2026-11-01", "2026-11-05"])).toEqual([
      { from: "2026-10-24T00:00:00.000Z", to: "2026-11-13T00:00:00.000Z" },
    ]);
  });

  it("keeps far-apart dates in separate windows", () => {
    expect(eventSearchWindows(["2026-01-10", "2026-06-01"])).toEqual([
      { from: "2026-01-02T00:00:00.000Z", to: "2026-01-18T00:00:00.000Z" },
      { from: "2026-05-24T00:00:00.000Z", to: "2026-06-09T00:00:00.000Z" },
    ]);
  });

  it("returns no window without dates", () => {
    expect(eventSearchWindows([])).toEqual([]);
  });
});

describe("nearestEvents", () => {
  const event = (id: string, startDate: string) => ({ id, startDate });

  it("keeps events within seven days of any receipt date, nearest first", () => {
    const events = [
      event("seven-days", "2026-11-08T18:00:00.000Z"),
      event("eight-days", "2026-11-09T10:00:00.000Z"),
      event("one-day", "2026-11-19T17:00:00.000Z"),
      // 23:30 UTC on 31 Oct is 1 Nov in Oslo: the receipt's own day.
      event("same-day-in-oslo", "2026-10-31T23:30:00.000Z"),
      event("seven-after-second", "2026-11-27T12:00:00.000Z"),
      event("no-date", ""),
    ];

    expect(
      nearestEvents(events, ["2026-11-01", "2026-11-20"], 10).map((e) => e.id)
    ).toEqual([
      "same-day-in-oslo",
      "one-day",
      "seven-days",
      "seven-after-second",
    ]);
  });

  it("returns at most the limit", () => {
    const events = [
      event("a", "2026-11-01T12:00:00.000Z"),
      event("b", "2026-11-02T12:00:00.000Z"),
      event("c", "2026-11-03T12:00:00.000Z"),
      event("d", "2026-11-04T12:00:00.000Z"),
    ];

    expect(nearestEvents(events, ["2026-11-01"], 3).map((e) => e.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
