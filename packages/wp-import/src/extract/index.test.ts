import { describe, expect, test } from "bun:test";
import { parseSince } from "./index";

describe("parseSince", () => {
  const now = new Date("2026-08-18T00:00:00.000Z");

  test("parses a month window", () => {
    expect(parseSince("3m", now)).toBe("2026-05-18T00:00:00.000Z");
  });

  test("parses a day window", () => {
    expect(parseSince("30d", now)).toBe("2026-07-19T00:00:00.000Z");
  });

  test("parses a year window", () => {
    expect(parseSince("1y", now)).toBe("2025-08-18T00:00:00.000Z");
  });

  test("passes an explicit ISO date through", () => {
    expect(parseSince("2026-01-01", now)).toBe("2026-01-01T00:00:00.000Z");
  });

  test("returns the epoch for 'all'", () => {
    expect(parseSince("all", now)).toBe("1970-01-01T00:00:00.000Z");
  });

  test("throws on an unparseable window", () => {
    expect(() => parseSince("banana", now)).toThrow("Unrecognised --since");
  });
});
