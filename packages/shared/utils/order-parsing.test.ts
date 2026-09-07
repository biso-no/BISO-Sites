import { describe, expect, it } from "vitest";
import { getOrderItems, parseOrderItems } from "./order-parsing";

describe("parseOrderItems", () => {
  it("normalizes relational order-item rows for existing consumers", () => {
    expect(
      parseOrderItems([
        {
          $id: "line-1",
          custom_fields_json: JSON.stringify([
            { id: "engraving", label: "Engraving", value: "Ada" },
          ]),
          line_total: 998,
          name: "Campus hoodie — Large",
          product: { $id: "product-1" },
          product_type: "webshop_product",
          quantity: 2,
          unit_price: 499,
          variation: { $id: "variation-1", name: "Large" },
        },
      ])
    ).toEqual([
      expect.objectContaining({
        custom_fields: [{ id: "engraving", label: "Engraving", value: "Ada" }],
        name: "Campus hoodie — Large",
        product_id: "product-1",
        quantity: 2,
        title: "Campus hoodie — Large",
        unit_price: 499,
        variation_id: "variation-1",
        variation_name: "Large",
      }),
    ]);
  });

  it("prefers loaded relationship rows while retaining legacy-order fallback", () => {
    const relational = getOrderItems({
      items_json: JSON.stringify([{ product_id: "legacy-product" }]),
      order_items: [
        {
          name: "Relational product",
          product: "product-1",
          quantity: 1,
          unit_price: 250,
        },
      ],
    });

    expect(relational).toEqual([
      expect.objectContaining({
        product_id: "product-1",
        title: "Relational product",
      }),
    ]);
    expect(
      getOrderItems({
        items_json: JSON.stringify([
          { productId: "legacy-product", quantity: 1 },
        ]),
      })
    ).toEqual([
      expect.objectContaining({ product_id: "legacy-product", quantity: 1 }),
    ]);
  });
});
