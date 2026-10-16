import { describe, expect, test } from "bun:test";
import {
  resolveCatalogParams,
  resolveOrderParams,
  resolveShopTab,
  toOrderStatsFilters,
} from "./shop-view-params";

describe("resolveShopTab", () => {
  test("defaults to the catalog when no tab is named", () => {
    expect(resolveShopTab({}, true)).toBe("catalog");
  });

  test("honours ?tab=orders for a viewer with shop operations access", () => {
    expect(resolveShopTab({ tab: "orders" }, true)).toBe("orders");
  });

  test("falls back to the catalog when the viewer cannot see orders", () => {
    // A department product author who hand-types ?tab=orders must land on the
    // catalog, so the page never fetches order data for them at all.
    expect(resolveShopTab({ tab: "orders" }, false)).toBe("catalog");
  });

  test("falls back to the catalog for a junk tab value", () => {
    expect(resolveShopTab({ tab: "nonsense" }, true)).toBe("catalog");
  });
});

describe("resolveCatalogParams", () => {
  test("reads the catalog's own page/size/q keys and its status filter", () => {
    const params = resolveCatalogParams({
      page: "3",
      q: "  hoodie  ",
      size: "50",
      status: "draft",
    });

    expect(params).toEqual({ page: 3, q: "hoodie", size: 50, status: "draft" });
  });

  test("defaults the status filter to all", () => {
    expect(resolveCatalogParams({}).status).toBe("all");
  });

  test("ignores the orders tab's params", () => {
    const params = resolveCatalogParams({
      oq: "nordmann",
      opage: "7",
      osize: "100",
      ostatus: "refunded",
    });

    expect(params).toEqual({ page: 1, q: "", size: 25, status: "all" });
  });
});

describe("resolveOrderParams", () => {
  test("reads the orders tab's own page/size/q keys and every filter", () => {
    const params = resolveOrderParams({
      from: "2026-01-01",
      opage: "4",
      oq: " nordmann ",
      osize: "100",
      ostatus: "paid",
      product: "product-1",
      to: "2026-02-01",
    });

    expect(params).toEqual({
      from: "2026-01-01",
      page: 4,
      productId: "product-1",
      q: "nordmann",
      size: 100,
      status: "paid",
      to: "2026-02-01",
    });
  });

  test("ignores the catalog tab's params", () => {
    const params = resolveOrderParams({
      page: "3",
      q: "hoodie",
      size: "50",
      status: "draft",
    });

    expect(params.page).toBe(1);
    expect(params.q).toBe("");
    expect(params.size).toBe(25);
    expect(params.status).toBe("all");
  });

  test('drops the "all" sentinel from the product filter', () => {
    expect(resolveOrderParams({ product: "all" }).productId).toBeUndefined();
    expect(resolveOrderParams({}).productId).toBeUndefined();
  });

  test("drops empty date bounds rather than passing empty strings", () => {
    const params = resolveOrderParams({ from: "", to: "" });
    expect(params.from).toBeUndefined();
    expect(params.to).toBeUndefined();
  });
});

describe("toOrderStatsFilters", () => {
  test("omits status so the per-status tallies do not collapse", () => {
    const filters = toOrderStatsFilters(
      resolveOrderParams({
        from: "2026-01-01",
        oq: "nordmann",
        ostatus: "paid",
        product: "product-1",
      })
    );

    expect(filters.status).toBeUndefined();
    expect(filters).toEqual({
      from: "2026-01-01",
      productId: "product-1",
      q: "nordmann",
      status: undefined,
      to: undefined,
    });
  });
});
