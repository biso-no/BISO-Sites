import { describe, expect, test } from "bun:test";
import { cellToString } from "./cells";

describe("cellToString", () => {
  test("keeps long digit runs", () => {
    expect(cellToString(91_234_567)).toBe("91234567");
    expect(cellToString(4_791_234_567)).toBe("4791234567");
    expect(cellToString(1.2e21)).not.toContain("e");
    expect(cellToString(1.234_56)).toBe("1.23456");
  });

  test("converts dates, blanks and padded strings", () => {
    expect(cellToString(new Date("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
    expect(cellToString(null)).toBe("");
    expect(cellToString(undefined)).toBe("");
    expect(cellToString("  a ")).toBe("a");
    expect(cellToString(true)).toBe("true");
  });
});
