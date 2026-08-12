import { describe, expect, it } from "vitest";
import { mergeMembershipRow } from "./membership-sync-merge";

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
  it("seeds price from 24SO when the row is new", () => {
    expect(mergeMembershipRow(syncItem, null)).toMatchObject({
      membership_id: "54",
      name: "BISO Membership fall 2026",
      category: "113176",
      price: 350,
      canPurchase: false,
      status: true,
    });
  });

  it("preserves an administrator-set price on update", () => {
    const merged = mergeMembershipRow(syncItem, {
      price: 400,
      canPurchase: true,
    });
    expect(merged.price).toBe(400);
  });

  it("preserves canPurchase on update", () => {
    const merged = mergeMembershipRow(syncItem, {
      price: 350,
      canPurchase: true,
    });
    expect(merged.canPurchase).toBe(true);
  });

  it("falls back to the 24SO price when the existing row has none", () => {
    const merged = mergeMembershipRow(syncItem, {
      price: 0,
      canPurchase: false,
    });
    expect(merged.price).toBe(350);
  });

  it("still refreshes name, dates and status on update", () => {
    const merged = mergeMembershipRow(
      { ...syncItem, isActive: false, productName: "Renamed" },
      { price: 400, canPurchase: true }
    );
    expect(merged).toMatchObject({ name: "Renamed", status: false });
  });
});
