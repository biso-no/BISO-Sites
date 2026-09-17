import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  test("allows up to the limit per key within the window", () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 100)).toBe(true);
    expect(allow("a", 200)).toBe(false);
    expect(allow("b", 200)).toBe(true);
    expect(allow("a", 1101)).toBe(true);
  });
});
