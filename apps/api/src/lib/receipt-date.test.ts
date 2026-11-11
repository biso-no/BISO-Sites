import { describe, expect, it } from "vitest";
import {
  osloDayBoundsUtc,
  receiptDateInOslo,
  todayInOslo,
} from "./receipt-date";

describe("receipt dates", () => {
  it("receiptDateInOslo reads the Oslo calendar day", () => {
    expect(receiptDateInOslo("2026-10-10T00:00:00.000+00:00")).toBe(
      "2026-10-10"
    );
    expect(receiptDateInOslo("2026-10-09T22:00:00.000Z")).toBe("2026-10-10");
    expect(receiptDateInOslo("")).toBeNull();
    expect(receiptDateInOslo(null)).toBeNull();
    expect(receiptDateInOslo("not a date")).toBeNull();
  });

  it("todayInOslo uses Oslo time near midnight", () => {
    expect(todayInOslo(new Date("2026-11-11T23:30:00.000Z"))).toBe(
      "2026-11-12"
    );
  });

  it("throws when the formatter returns an unexpected pattern", () => {
    const proto = Intl.DateTimeFormat.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "format");
    Object.defineProperty(proto, "format", {
      configurable: true,
      get: () => () => "11/11/2026",
    });
    try {
      expect(() => todayInOslo(new Date())).toThrow("Unexpected Oslo date");
      expect(() => receiptDateInOslo("2026-10-10T00:00:00Z")).toThrow(
        "Unexpected Oslo date"
      );
    } finally {
      if (original) {
        Object.defineProperty(proto, "format", original);
      }
    }
  });
});

describe("osloDayBoundsUtc", () => {
  it("uses UTC+1 in winter and UTC+2 in summer", () => {
    expect(osloDayBoundsUtc("2026-11-11")).toEqual({
      end: "2026-11-11T23:00:00.000Z",
      start: "2026-11-10T23:00:00.000Z",
    });
    expect(osloDayBoundsUtc("2026-07-01")).toEqual({
      end: "2026-07-01T22:00:00.000Z",
      start: "2026-06-30T22:00:00.000Z",
    });
  });

  it("spans 23 hours when summer time starts and 25 when it ends", () => {
    expect(osloDayBoundsUtc("2026-03-29")).toEqual({
      end: "2026-03-29T22:00:00.000Z",
      start: "2026-03-28T23:00:00.000Z",
    });
    expect(osloDayBoundsUtc("2026-10-25")).toEqual({
      end: "2026-10-25T23:00:00.000Z",
      start: "2026-10-24T22:00:00.000Z",
    });
  });

  it("returns null for anything but a calendar day", () => {
    expect(osloDayBoundsUtc("11/11/2026")).toBeNull();
    expect(osloDayBoundsUtc("2026-13-45")).toBeNull();
  });
});
