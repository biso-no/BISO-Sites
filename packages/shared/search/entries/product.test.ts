import {
  WebshopProductsInventoryMode,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { ctx, noText } from "./fixtures";
import { productEntries } from "./product";

type Row = Parameters<typeof productEntries>[0];
const product = (o: Partial<Row> = {}): Row => ({
  $id: "p1",
  slug: "hoodie",
  status: WebshopProductsStatus.PUBLISHED,
  campus_id: "5",
  departmentId: "d2",
  regular_price: 450,
  member_price: 400,
  member_only: false,
  category: "Merch",
  tags: ["klaer"],
  image: "pimg",
  images: ["a", "b"],
  cover_pattern: "none" as Row["cover_pattern"],
  stock: 3,
  inventory_mode: WebshopProductsInventoryMode.TRACKED,
  unlisted: false,
  ...o,
});

describe("productEntries", () => {
  it("maps a listed product", () => {
    expect(productEntries(product(), noText, ctx())[0]).toMatchObject({
      type: "product",
      url: "/shop/hoodie",
      price: 450,
      member_price: 400,
      in_stock: true,
      department: "Dept d2",
      image: "pimg",
      keywords: ["klaer"],
      category: "Merch",
    });
  });
  it("tracks stock", () => {
    expect(
      productEntries(product({ stock: 0 }), noText, ctx())[0].in_stock
    ).toBe(false);
    expect(
      productEntries(
        product({
          stock: 0,
          inventory_mode: WebshopProductsInventoryMode.UNLIMITED,
        }),
        noText,
        ctx()
      )[0].in_stock
    ).toBe(true);
  });
  it("treats negative stock as out of stock and missing stock as in stock", () => {
    expect(
      productEntries(product({ stock: -2 }), noText, ctx())[0].in_stock
    ).toBe(false);
    expect(
      productEntries(product({ stock: null }), noText, ctx())[0].in_stock
    ).toBe(true);
  });
  it("hides unlisted and unpublished products", () => {
    expect(productEntries(product({ unlisted: true }), noText, ctx())).toEqual(
      []
    );
    expect(
      productEntries(
        product({ status: WebshopProductsStatus.DRAFT }),
        noText,
        ctx()
      )
    ).toEqual([]);
  });
  it("never leaks the stock count", () => {
    expect(
      JSON.stringify(productEntries(product({ stock: 7 }), noText, ctx()))
    ).not.toContain('"stock"');
  });
});
