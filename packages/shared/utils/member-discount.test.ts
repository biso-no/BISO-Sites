import { describe, expect, it } from "vitest";
import {
  discountedUnitPrice,
  memberDiscountPercent,
  memberUnitPrice,
} from "./member-discount";

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

describe("memberUnitPrice", () => {
  it("uses the product's fixed member price", () => {
    expect(memberUnitPrice(100, { productMemberPrice: 50 })).toBe(50);
  });

  it("prefers the fixed member price over the legacy percent", () => {
    expect(
      memberUnitPrice(100, {
        productMemberPrice: 50,
        legacyDiscountPercent: 10,
      })
    ).toBe(50);
  });

  it("prefers the variation's member price over the product's", () => {
    expect(
      memberUnitPrice(150, {
        productMemberPrice: 50,
        variationMemberPrice: 90,
        variationModifier: 50,
      })
    ).toBe(90);
  });

  it("shifts the product's member price by the variation modifier", () => {
    expect(
      memberUnitPrice(150, { productMemberPrice: 50, variationModifier: 50 })
    ).toBe(100);
  });

  it("falls back to the legacy percent", () => {
    expect(memberUnitPrice(100, { legacyDiscountPercent: 25 })).toBe(75);
  });

  it("returns null when there is no discount to give", () => {
    expect(memberUnitPrice(100, {})).toBeNull();
    expect(memberUnitPrice(100, { productMemberPrice: null })).toBeNull();
    expect(memberUnitPrice(100, { productMemberPrice: 0 })).toBeNull();
    expect(memberUnitPrice(100, { productMemberPrice: 100 })).toBeNull();
    expect(memberUnitPrice(100, { productMemberPrice: 120 })).toBeNull();
  });
});

describe("memberDiscountPercent", () => {
  it("expresses the discount as a whole percent", () => {
    expect(memberDiscountPercent(100, 50)).toBe(50);
    expect(memberDiscountPercent(299, 199)).toBe(33);
    expect(memberDiscountPercent(0, 0)).toBe(0);
  });
});
