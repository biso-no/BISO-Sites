import { describe, expect, test } from "bun:test";
import { canShowTurnover } from "./turnover-gate";

describe("canShowTurnover", () => {
  test("needs both the permission and a role account", () => {
    expect(canShowTurnover(true, true)).toBe(true);
    expect(canShowTurnover(true, false)).toBe(false);
    expect(canShowTurnover(false, true)).toBe(false);
  });
});
