import { describe, expect, test } from "bun:test";
import {
  resolveAcfCampusAndDepartment,
  resolvePrice,
  transformProduct,
} from "./products";

const baseStore = {
  categories: [],
  description: "<p>Beskrivelse</p>",
  id: 65_946,
  images: [],
  name: "overlapstur",
  prices: {
    currency_minor_unit: 0,
    price: "3000",
    price_range: null,
  },
  short_description: "",
  slug: "overlapstur",
  type: "simple",
  variations: [],
};

const basePost = {
  acf: { campus: "1", department_oslo: "21" },
  content: { rendered: "<p>Beskrivelse</p>" },
  date_gmt: "2025-04-05T08:15:00",
  id: 65_946,
  modified_gmt: "2025-04-09T13:45:00",
  slug: "overlapstur",
  status: "publish",
  title: { rendered: "overlapstur" },
};

describe("resolveAcfCampusAndDepartment", () => {
  test("reads the campus id and the matching department field", () => {
    expect(
      resolveAcfCampusAndDepartment({ campus: "1", department_oslo: "21" })
    ).toEqual({ campusId: "1", departmentId: "21" });
  });

  test("ignores department fields for other campuses", () => {
    expect(
      resolveAcfCampusAndDepartment({
        campus: "4",
        department_oslo: "21",
        department_stavanger: "801",
      })
    ).toEqual({ campusId: "4", departmentId: "801" });
  });

  test("treats false as unset", () => {
    expect(
      resolveAcfCampusAndDepartment({ campus: "5", department_national: false })
    ).toEqual({ campusId: "5", departmentId: null });
  });

  test("returns a null campus when ACF has none", () => {
    expect(resolveAcfCampusAndDepartment({}).campusId).toBeNull();
  });
});

describe("resolvePrice", () => {
  test("reads a simple product price", () => {
    expect(resolvePrice(baseStore)).toBe(3000);
  });

  test("applies currency_minor_unit rather than assuming zero", () => {
    const store = {
      ...baseStore,
      prices: { ...baseStore.prices, currency_minor_unit: 2, price: "300000" },
    };

    expect(resolvePrice(store)).toBe(3000);
  });

  test("uses the lowest variation price for a variable product", () => {
    const store = {
      ...baseStore,
      prices: {
        currency_minor_unit: 0,
        price: "250",
        price_range: { max_amount: "1500", min_amount: "250" },
      },
      type: "variable",
    };

    expect(resolvePrice(store)).toBe(250);
  });

  test("returns null when no price can be resolved", () => {
    const store = {
      ...baseStore,
      prices: { ...baseStore.prices, price: "" },
    };

    expect(resolvePrice(store)).toBeNull();
  });
});

describe("transformProduct", () => {
  test("backdates $createdAt and $updatedAt to the WordPress post dates", () => {
    const { product } = transformProduct({ ...basePost, store: baseStore });

    expect(product?.row.$createdAt).toBe("2025-04-05T08:15:00.000Z");
    expect(product?.row.$updatedAt).toBe("2025-04-09T13:45:00.000Z");
  });

  test("falls back to the publish date when the post was never modified", () => {
    const { product } = transformProduct({
      ...basePost,
      modified_gmt: "",
      store: baseStore,
    });

    expect(product?.row.$updatedAt).toBe("2025-04-05T08:15:00.000Z");
  });
  test("builds a webshop_products row from ACF and store data", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      store: baseStore,
    });

    expect(reject).toBeNull();
    expect(product?.rowId).toBe("wpprod65946");
    expect(product?.row.campus_id).toBe("1");
    expect(product?.row.departmentId).toBe("21");
    expect(product?.row.regular_price).toBe(3000);
    expect(product?.row.status).toBe("published");
    expect(product?.row.slug).toBe("overlapstur");
  });

  test("decodes numeric HTML entities in the title", () => {
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, name: "Booklocker &#8211; Campus Oslo" },
      title: { rendered: "Booklocker &#8211; Campus Oslo" },
    });

    expect(product?.title).toBe("Booklocker – Campus Oslo");
  });

  test("rejects a product with no ACF campus, because campus_id is required", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      acf: {},
      store: baseStore,
    });

    expect(product).toBeNull();
    expect(reject?.reason).toContain("campus");
  });

  test("rejects a product with no resolvable price", () => {
    const { product, reject } = transformProduct({
      ...basePost,
      store: { ...baseStore, prices: { ...baseStore.prices, price: "" } },
    });

    expect(product).toBeNull();
    expect(reject?.reason).toContain("price");
  });

  test("stores variations as variants_json in the shape the shop studio parses", () => {
    const store = {
      ...baseStore,
      type: "variable",
      variations: [
        {
          attributes: [
            { name: "Member status", value: "BISO member" },
            { name: "Duration", value: "Semester" },
          ],
          id: 63_463,
        },
      ],
      prices: {
        currency_minor_unit: 0,
        price: "250",
        price_range: { max_amount: "1500", min_amount: "250" },
      },
    };
    const { product } = transformProduct({ ...basePost, store });
    const variants = JSON.parse(String(product?.row.variants_json));

    expect(variants).toHaveLength(1);
    expect(variants[0]).toEqual({
      id: "63463",
      name: "BISO member / Semester",
      price: 0,
      stock: 0,
      type: "default",
    });
  });

  test("imports a variable product as draft, even when the WordPress post is published", () => {
    const store = {
      ...baseStore,
      type: "variable",
      variations: [
        { attributes: [{ name: "Duration", value: "Semester" }], id: 1 },
      ],
      prices: {
        currency_minor_unit: 0,
        price: "250",
        price_range: { max_amount: "1500", min_amount: "250" },
      },
    };
    const { product, warnings } = transformProduct({
      ...basePost,
      status: "publish",
      store,
    });

    expect(product?.row.status).toBe("draft");
    expect(warnings.some((w) => w.includes("variable"))).toBe(true);
  });

  test("caps variants_json at 8192 chars by trimming variants from the end", () => {
    const manyVariations = Array.from({ length: 400 }, (_, index) => ({
      attributes: [{ name: "Duration", value: `Option ${index}` }],
      id: index,
    }));
    const store = {
      ...baseStore,
      type: "variable",
      variations: manyVariations,
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(String(product?.row.variants_json).length).toBeLessThanOrEqual(8192);
  });

  test("maps the WooCommerce default category to null instead of the literal 'Uncategorized'", () => {
    const store = {
      ...baseStore,
      categories: [{ id: 1, name: "Uncategorized", slug: "uncategorized" }],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.row.category).toBeNull();
  });

  test("keeps a real category name", () => {
    const store = {
      ...baseStore,
      categories: [{ id: 2, name: "Merch", slug: "merch" }],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.row.category).toBe("Merch");
  });

  test("flags member-status variants instead of guessing member_price", () => {
    const store = {
      ...baseStore,
      type: "variable",
      variations: [
        {
          attributes: [{ name: "Member status", value: "BISO member" }],
          id: 63_463,
        },
      ],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.memberVariantWarning).toBe(true);
    expect(product?.row.member_price).toBeUndefined();
  });

  test("collects image urls for mirroring", () => {
    const store = {
      ...baseStore,
      images: [{ alt: "", id: 1, src: "https://biso.no/wp-content/a.jpg" }],
    };
    const { product } = transformProduct({ ...basePost, store });

    expect(product?.imageUrls).toEqual(["https://biso.no/wp-content/a.jpg"]);
  });

  test("falls back to post content when the store description is empty", () => {
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, description: "" },
    });

    expect(product?.descriptionHtml).toBe("<p>Beskrivelse</p>");
  });

  test("rejects when the store record is missing, because price is unresolvable", () => {
    const { product, reject } = transformProduct({ ...basePost, store: null });

    expect(product).toBeNull();
    expect(reject?.reason).toContain("price");
  });
});
