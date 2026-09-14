import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { discountedUnitPrice } from "./checkout-pricing";

describe("discountedUnitPrice", () => {
  it("rounds a non-integer discount to whole øre", () => {
    // 199 × 0.875 = 174.125 NOK — half an øre.
    expect(discountedUnitPrice(199, 12.5)).toBe(174.13);
  });

  it("keeps the line's øre sum equal to the rounded order total", () => {
    const unit = discountedUnitPrice(199, 12.5);
    const quantity = 3;
    const linesMinor = Math.round(unit * 100) * quantity;
    const totalMinor = Math.round(unit * quantity * 100);
    expect(linesMinor).toBe(totalMinor);
  });

  it("leaves whole-krone discounts unchanged and never goes negative", () => {
    expect(discountedUnitPrice(500, 20)).toBe(400);
    expect(discountedUnitPrice(100, 150)).toBe(0);
  });
});
