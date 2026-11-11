import { describe, expect, it } from "vitest";
import { receiptDateInOslo, todayInOslo } from "./receipt-date";

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
