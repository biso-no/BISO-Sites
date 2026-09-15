import { describe, expect, it } from "vitest";
import {
  PRODUCT_SALES_TYPES,
  PRODUCTS_TO_ARCHIVE,
  planProductUpdates,
} from "./product-sales-type-map";

const allMapped = Object.values(PRODUCT_SALES_TYPES).flat();

describe("product sales type map", () => {
  it("covers all 58 products exactly once", () => {
    const every = [...allMapped, ...PRODUCTS_TO_ARCHIVE];
    expect(every).toHaveLength(58);
    expect(new Set(every).size).toBe(58);
  });

  it("uses only the seeded sales types", () => {
    expect(Object.keys(PRODUCT_SALES_TYPES).sort()).toEqual([
      "annet-avgiftsfritt",
      "bokskapleie",
      "egenandel",
      "varesalg",
    ]);
  });

  it("puts the stranded order's sweater under Varesalg pending the accountant", () => {
    expect(PRODUCT_SALES_TYPES.varesalg).toContain("wpprod65924");
  });
});

describe("planProductUpdates", () => {
  it("assigns missing sales types, skips correct ones, archives, and reports unmapped", () => {
    const plan = planProductUpdates([
      { $id: "wpprod65924", sales_type: null, status: "published" },
      {
        $id: "wpprod65811",
        sales_type: "annet-avgiftsfritt",
        status: "published",
      },
      { $id: "wpprod32094", sales_type: null, status: "draft" },
      { $id: "brand-new", sales_type: null, status: "published" },
    ]);

    expect(plan.assign).toEqual([
      { from: null, id: "wpprod65924", to: "varesalg" },
    ]);
    expect(plan.archive).toEqual(["wpprod32094"]);
    expect(plan.unmapped).toEqual(["brand-new"]);
  });

  it("does not archive a product that is already archived", () => {
    expect(
      planProductUpdates([
        { $id: "wpprod32094", sales_type: null, status: "archived" },
      ]).archive
    ).toEqual([]);
  });
});
