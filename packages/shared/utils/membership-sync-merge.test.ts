import { describe, expect, it } from "vitest";
import { mergeMembershipRow, parsePrice } from "./membership-sync-merge";

const syncItem = {
  productId: 54,
  productName: "BISO Membership fall 2026",
  categoryId: 113_176,
  expiryDate: "2026-12-31",
  startDate: "2026-08-01",
  isActive: true,
  price: 350,
};

describe("mergeMembershipRow", () => {
  it("writes the 24SO price and never marks a row purchasable", () => {
    expect(mergeMembershipRow({ ...syncItem, price: 350 })).toEqual({
      canPurchase: false,
      category: String(syncItem.categoryId),
      expiryDate: syncItem.expiryDate,
      membership_id: String(syncItem.productId),
      name: syncItem.productName,
      price: 350,
      startDate: syncItem.startDate,
      status: syncItem.isActive,
    });
  });

  it("no longer keeps an administrator-set price or canPurchase", () => {
    // Older callers passed the existing row; 24SO now owns price and sales.
    const merged = (
      mergeMembershipRow as (...args: unknown[]) => Record<string, unknown>
    )(syncItem, { canPurchase: true, price: 400 });
    expect(merged).toMatchObject({ canPurchase: false, price: 350 });
  });

  it("writes a null category when the product has no matching category", () => {
    expect(
      mergeMembershipRow({ ...syncItem, categoryId: null }).category
    ).toBeNull();
  });
});

describe("parsePrice", () => {
  it("passes through a numeric price", () => {
    expect(parsePrice(350)).toBe(350);
  });

  it("coerces a string-numeric price", () => {
    expect(parsePrice("350")).toBe(350);
  });

  it("defaults an absent price to 0", () => {
    expect(parsePrice(undefined)).toBe(0);
  });

  it("defaults a null price to 0", () => {
    expect(parsePrice(null)).toBe(0);
  });

  it("defaults a non-numeric price to 0", () => {
    expect(parsePrice("garbage")).toBe(0);
  });

  it("clamps a negative price to 0", () => {
    expect(parsePrice(-50)).toBe(0);
  });

  it("defaults a non-finite price to 0", () => {
    expect(parsePrice(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
