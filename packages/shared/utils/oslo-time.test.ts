import { describe, expect, it } from "vitest";
import {
  formatOsloDate,
  formatOsloTime,
  isoToOsloWallClock,
  osloWallClockToIso,
} from "./oslo-time";

describe("osloWallClockToIso", () => {
  it("reads datetime-local input as Oslo summer time (UTC+2)", () => {
    expect(osloWallClockToIso("2026-09-22T13:00")).toBe(
      "2026-09-22T11:00:00.000Z"
    );
  });

  it("reads datetime-local input as Oslo winter time (UTC+1)", () => {
    expect(osloWallClockToIso("2026-12-01T18:30")).toBe(
      "2026-12-01T17:30:00.000Z"
    );
  });

  it("handles times just after the spring-forward switch", () => {
    // 29 March 2026: 02:00 → 03:00 local.
    expect(osloWallClockToIso("2026-03-29T03:30")).toBe(
      "2026-03-29T01:30:00.000Z"
    );
    expect(osloWallClockToIso("2026-03-29T01:30")).toBe(
      "2026-03-29T00:30:00.000Z"
    );
  });

  it("returns null for empty or malformed input", () => {
    expect(osloWallClockToIso("")).toBeNull();
    expect(osloWallClockToIso(null)).toBeNull();
    expect(osloWallClockToIso("2026-09-22T11:00:00.000Z")).toBeNull();
  });
});

describe("isoToOsloWallClock", () => {
  it("round-trips with osloWallClockToIso", () => {
    expect(isoToOsloWallClock("2026-09-22T11:00:00.000+00:00")).toBe(
      "2026-09-22T13:00"
    );
    expect(isoToOsloWallClock(osloWallClockToIso("2026-12-01T18:30"))).toBe(
      "2026-12-01T18:30"
    );
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(isoToOsloWallClock(null)).toBe("");
    expect(isoToOsloWallClock("nope")).toBe("");
  });
});

describe("formatters", () => {
  it("formats times in Oslo regardless of the runtime timezone", () => {
    expect(formatOsloTime("2026-09-22T11:00:00.000Z")).toBe("13:00");
    expect(formatOsloTime("2026-09-22T22:30:00.000Z")).toBe("00:30");
    expect(formatOsloTime(undefined)).toBeNull();
  });

  it("formats dates on the Oslo calendar day", () => {
    expect(
      formatOsloDate("2026-09-22T22:30:00.000Z", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    ).toBe("September 23, 2026");
  });
});
