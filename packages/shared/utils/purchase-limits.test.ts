import { describe, expect, it } from "vitest";
import {
  checkMaxPerOrder,
  evaluatePerUserLimit,
  summarizePurchases,
} from "./purchase-limits";

function order(items: unknown): { items_json: string } {
  return { items_json: JSON.stringify(items) };
}

describe("summarizePurchases", () => {
  it("sums quantity and counts orders for the matching product", () => {
    const orders = [
      order([{ product_id: "p1", quantity: 2 }]),
      order([
        { product_id: "p1", quantity: 3 },
        { product_id: "p2", quantity: 9 },
      ]),
    ];

    expect(summarizePurchases(orders, "p1")).toEqual({
      totalPurchased: 5,
      orderCount: 2,
    });
  });

  it("counts legacy productId-keyed line items so limits cannot be bypassed", () => {
    const orders = [
      order([{ productId: "p1", quantity: 4 }]),
      order([{ product_id: "p1", quantity: 1 }]),
    ];

    expect(summarizePurchases(orders, "p1")).toEqual({
      totalPurchased: 5,
      orderCount: 2,
    });
  });

  it("ignores other products and tolerates empty or malformed item data", () => {
    const orders = [
      order([{ product_id: "p2", quantity: 7 }]),
      { items_json: null },
      { items_json: "not-json" },
      order([{ product_id: "p1" }]),
    ];

    expect(summarizePurchases(orders, "p1")).toEqual({
      totalPurchased: 0,
      orderCount: 1,
    });
  });
});

describe("checkMaxPerOrder", () => {
  it("allows any quantity when no limit is configured", () => {
    expect(checkMaxPerOrder(100, undefined)).toEqual({ allowed: true });
    expect(checkMaxPerOrder(100, 0)).toEqual({ allowed: true });
  });

  it("allows a quantity at or under the limit", () => {
    expect(checkMaxPerOrder(3, 3)).toEqual({ allowed: true, limit: 3 });
  });

  it("rejects a quantity over the limit with a reason", () => {
    const result = checkMaxPerOrder(4, 3);
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(3);
    expect(result.reason).toContain("3 per order");
  });
});

describe("evaluatePerUserLimit", () => {
  it("allows any quantity when no per-user limit is configured", () => {
    expect(evaluatePerUserLimit(99, 5, undefined)).toEqual({ allowed: true });
    expect(evaluatePerUserLimit(99, 5, 0)).toEqual({ allowed: true });
  });

  it("allows a request that fits within the remaining allowance", () => {
    expect(evaluatePerUserLimit(2, 3, 5)).toEqual({
      allowed: true,
      currentPurchases: 2,
      limit: 5,
    });
  });

  it("allows a request exactly equal to the remaining allowance", () => {
    expect(evaluatePerUserLimit(2, 3, 5).allowed).toBe(true);
  });

  it("rejects with a remaining count when some allowance is left", () => {
    const result = evaluatePerUserLimit(3, 5, 5);
    expect(result.allowed).toBe(false);
    expect(result.currentPurchases).toBe(3);
    expect(result.limit).toBe(5);
    expect(result.reason).toContain("only buy 2 more");
  });

  it("rejects with a maxed-out message when nothing is left", () => {
    const result = evaluatePerUserLimit(5, 1, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("already purchased the maximum");
  });
});
