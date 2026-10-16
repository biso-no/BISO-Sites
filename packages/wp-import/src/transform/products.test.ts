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

const MEMBER_OPTION = /member/i;

/**
 * One `/wc/v3/products/<id>/variations` entry. `attributes[].option` (not
 * `value`, as in the Store API) is where the attribute's value lives; the
 * first option is the membership axis in the fixtures that carry one.
 */
const wcVariation = (id: number, regularPrice: string, options: string[]) => ({
  attributes: options.map((option, index) => ({
    name:
      index === 0 && MEMBER_OPTION.test(option)
        ? "Member status"
        : `Attr${index}`,
    option,
  })),
  id,
  menu_order: 0,
  price: regularPrice,
  regular_price: regularPrice,
  sku: "",
  status: "publish",
  stock_quantity: 649,
});

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

  test("collapses the member-status axis into member_price on one row per duration", () => {
    // The real /wc/v3 payload for wpprod37313 (the Booklocker): WooCommerce
    // models membership as separate variations, Appwrite as two price columns.
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [
        wcVariation(63_469, "1500", ["Non BISO-member", "A year"]),
        wcVariation(63_467, "750", ["Non BISO-member", "Semester"]),
        wcVariation(63_465, "500", ["BISO member", "A year"]),
        wcVariation(63_463, "250", ["BISO member", "Semester"]),
      ],
    });

    expect(product?.variations).toEqual([
      {
        row: {
          enabled: true,
          member_price: 500,
          name: "A year",
          regular_price: 1500,
          sku: null,
          sort_order: 0,
          stock: 649,
        },
        rowId: "wpvar63469",
      },
      {
        row: {
          enabled: true,
          member_price: 250,
          name: "Semester",
          regular_price: 750,
          sku: null,
          sort_order: 1,
          stock: 649,
        },
        rowId: "wpvar63467",
      },
    ]);
  });

  test("keeps one row per variation and a null member_price when there is no membership axis", () => {
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [
        wcVariation(65_977, "1350", [
          "3 Years Fall 2026 - Spring 2029",
          "Stavanger",
        ]),
      ],
    });

    expect(product?.variations).toEqual([
      {
        row: {
          enabled: true,
          member_price: null,
          name: "3 Years Fall 2026 - Spring 2029 / Stavanger",
          regular_price: 1350,
          sku: null,
          sort_order: 0,
          stock: 649,
        },
        rowId: "wpvar65977",
      },
    ]);
  });

  test("warns when a variable product has no extracted variations", () => {
    const { warnings } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [],
    });

    expect(
      warnings.some((w) => w.includes("no variations were extracted"))
    ).toBe(true);
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

  test("flags a product whose variations carry a member price", () => {
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [
        wcVariation(63_469, "1500", ["Non BISO-member", "A year"]),
        wcVariation(63_465, "500", ["BISO member", "A year"]),
      ],
    });

    expect(product?.memberVariantWarning).toBe(true);
    // The membership price lives on the variation row, never on the product.
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

describe("buildVariations pairing", () => {
  test("reads 'Not a BISO member' as the non-member half, not the member half", () => {
    // Product 6833's real shape: the attribute is called "Membership" and both
    // options contain the word "member", so only the negation separates them.
    const { product } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [
        {
          ...wcVariation(9492, "500", []),
          attributes: [{ name: "Membership", option: "Not a BISO member" }],
          sku: "BOK-1",
        },
        {
          ...wcVariation(9491, "100", []),
          attributes: [{ name: "Membership", option: "BISO member" }],
          sku: "BOK-1",
        },
      ],
    });

    expect(product?.variations).toHaveLength(1);
    expect(product?.variations[0]?.rowId).toBe("wpvar9492");
    expect(product?.variations[0]?.row.regular_price).toBe(500);
    expect(product?.variations[0]?.row.member_price).toBe(100);
  });

  test("never drops a variation it cannot pair, and warns instead", () => {
    const { product, warnings } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      // Two non-member variations with the same name: unpairable, but both
      // are real rows that must survive the import.
      variations: [
        {
          ...wcVariation(1, "100", []),
          attributes: [{ name: "Member status", option: "Non BISO-member" }],
        },
        {
          ...wcVariation(2, "200", []),
          attributes: [{ name: "Member status", option: "Non BISO-member" }],
        },
      ],
    });

    expect(product?.variations.map((v) => v.rowId)).toEqual([
      "wpvar1",
      "wpvar2",
    ]);
    expect(warnings.some((w) => w.includes("could not pair"))).toBe(true);
  });

  test("emits one row per variation when membership is not an axis at all", () => {
    const { product, warnings } = transformProduct({
      ...basePost,
      store: { ...baseStore, type: "variable" },
      variations: [
        wcVariation(7001, "750", ["HR"]),
        wcVariation(7002, "750", ["Control Committee"]),
      ],
    });

    expect(product?.variations).toHaveLength(2);
    expect(product?.variations[1]?.row).toMatchObject({
      member_price: null,
      name: "Control Committee",
      regular_price: 750,
      sort_order: 1,
    });
    expect(warnings.some((w) => w.includes("could not pair"))).toBe(false);
  });
});
