import { describe, expect, test } from "bun:test";
import { shouldAnimateReveal } from "./reveal";

describe("Reveal motion preference", () => {
  test("animates only when editing is enabled and motion is allowed", () => {
    expect(shouldAnimateReveal(false, false)).toBe(true);
    expect(shouldAnimateReveal(true, false)).toBe(false);
    expect(shouldAnimateReveal(false, true)).toBe(false);
  });
});
