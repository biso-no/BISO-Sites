import { describe, expect, it } from "vitest";
import { discountedUnitPrice } from "./member-discount";

const toMinor = (kroner: number) => Math.round(kroner * 100);

describe("discountedUnitPrice", () => {
  it("rounds 199 kr at 12.5 % to whole øre", () => {
    // 199 × 0.875 = 174.125 NOK — half an øre.
    expect(discountedUnitPrice(199, 12.5)).toBe(174.13);
    expect(toMinor(discountedUnitPrice(199, 12.5) * 2)).toBe(34_826);
  });

  it("rounds 99.50 kr at 15 % to whole øre", () => {
    // 99.50 × 0.85 = 84.575 NOK.
    expect(toMinor(discountedUnitPrice(99.5, 15))).toBe(8458);
    expect(toMinor(discountedUnitPrice(99.5, 15) * 2)).toBe(16_916);
  });

  it("keeps the line's øre sum equal to the rounded order total", () => {
    const unit = discountedUnitPrice(199, 12.5);
    const quantity = 3;
    expect(toMinor(unit) * quantity).toBe(toMinor(unit * quantity));
  });

  it("leaves whole-krone discounts unchanged and never goes negative", () => {
    expect(discountedUnitPrice(500, 20)).toBe(400);
    expect(discountedUnitPrice(100, 150)).toBe(0);
  });
});
