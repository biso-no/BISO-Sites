import { describe, expect, test } from "bun:test";
import {
  buildJobUpsert,
  buildOrderItemRows,
  buildProductCampusIndex,
  buildProductUpsert,
  buildTranslationRows,
  type ExistingTranslation,
  existingTargetContent,
  resolveOrderCampusId,
  translationKey,
} from "./index";

const job = {
  departmentConfidence: 1,
  departmentName: "Bergensbaneløpet",
  descriptionHtml: "<p>Tekst</p>",
  row: { campus_id: "1", slug: "pr-manager", status: "published" },
  rowId: "wpjob63903",
  shortDescription: "Tekst",
  sourceLocale: "no" as const,
  title: "PR Manager",
};

describe("buildTranslationRows", () => {
  test("creates a row for each locale with the source stored verbatim", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob63903",
      contentType: "job",
      permissions: ['read("any")'],
      source: {
        description: "<p>Tekst</p>",
        locale: "no",
        shortDescription: "Tekst",
        title: "PR Manager",
      },
      target: {
        description: "<p>Text</p>",
        locale: "en",
        shortDescription: "Text",
        title: "PR Manager EN",
      },
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.locale).toBe("no");
    expect(rows[0]?.title).toBe("PR Manager");
    expect(rows[1]?.locale).toBe("en");
  });

  test("stamps content_type and content_id on every row", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.content_id).toBe("wpjob1");
    expect(rows[0]?.content_type).toBe("job");
  });

  test("omits the target row when translation was skipped", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows).toHaveLength(1);
  });

  test("truncates a translated short_description to 500 chars", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: "a".repeat(600),
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.short_description).toHaveLength(500);
  });

  test("truncates a translated description to 8000 chars", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      permissions: [],
      source: {
        description: "a".repeat(9000),
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.description).toHaveLength(8000);
  });

  test("omits $id when no existing row matches, so upsertRow creates a new row", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      existing: new Map([
        [
          translationKey("wpjob2", "no"),
          {
            $id: "existing-id",
            description: "<p>a</p>",
            locale: "no" as const,
            short_description: null,
            title: "a",
          },
        ],
      ]),
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: null,
    });

    expect(rows[0]?.$id).toBeUndefined();
  });

  test("threads the existing row's $id per locale so a second load --apply upserts in place instead of colliding on uniq_content_locale", () => {
    const rows = buildTranslationRows({
      contentId: "wpjob1",
      contentType: "job",
      existing: new Map([
        [
          translationKey("wpjob1", "no"),
          {
            $id: "row-no",
            description: "<p>a</p>",
            locale: "no" as const,
            short_description: null,
            title: "a",
          },
        ],
        [
          translationKey("wpjob1", "en"),
          {
            $id: "row-en",
            description: "<p>b</p>",
            locale: "en" as const,
            short_description: null,
            title: "b",
          },
        ],
      ]),
      permissions: [],
      source: {
        description: "<p>a</p>",
        locale: "no",
        shortDescription: null,
        title: "a",
      },
      target: {
        description: "<p>b</p>",
        locale: "en",
        shortDescription: null,
        title: "b",
      },
    });

    expect(rows[0]?.$id).toBe("row-no");
    expect(rows[1]?.$id).toBe("row-en");
  });
});

describe("buildProductCampusIndex", () => {
  test("maps a product rowId to its campus_id", () => {
    const index = buildProductCampusIndex([
      { row: { campus_id: "1" }, rowId: "wpprod37313" },
    ]);

    expect(index.get("wpprod37313")).toBe("1");
  });

  test("skips a product with no string campus_id", () => {
    const index = buildProductCampusIndex([
      { row: { campus_id: null }, rowId: "wpprod1" },
    ]);

    expect(index.has("wpprod1")).toBe(false);
  });
});

const orderItem = (
  productRowId: string,
  rowId = "wpitem1",
  variationRowId: string | null = null
) => ({
  line_total: 250,
  name: "Booklocker",
  productRowId,
  quantity: 1,
  rowId,
  unit_price: 250,
  variationRowId,
});

describe("resolveOrderCampusId", () => {
  const campusByRowId = new Map([["wpprod37313", "1"]]);

  test("resolves the campus from the first line item whose product matches", () => {
    expect(
      resolveOrderCampusId([orderItem("wpprod37313")], campusByRowId)
    ).toBe("1");
  });

  test("skips a line item whose product does not resolve and tries the next", () => {
    expect(
      resolveOrderCampusId(
        [
          orderItem("wpprod-unknown", "wpitem1"),
          orderItem("wpprod37313", "wpitem2"),
        ],
        campusByRowId
      )
    ).toBe("1");
  });

  test("returns null when no line item resolves", () => {
    expect(
      resolveOrderCampusId([orderItem("wpprod-unknown")], campusByRowId)
    ).toBeNull();
  });

  test("returns null for an order with no line items", () => {
    expect(resolveOrderCampusId([], campusByRowId)).toBeNull();
  });
});

describe("buildOrderItemRows", () => {
  const permissions = ['read("user:abc")'];
  const noVariations = new Set<string>();

  test("moves rowId into $id and carries the parent permissions", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313", "wpitem987")],
      new Set(["wpprod37313"]),
      noVariations,
      permissions
    );

    expect(row?.$id).toBe("wpitem987");
    expect(row?.$permissions).toEqual(permissions);
    expect(row?.rowId).toBeUndefined();
    expect(row?.name).toBe("Booklocker");
    expect(row?.unit_price).toBe(250);
    expect(row?.line_total).toBe(250);
  });

  test("writes only real order_items columns, never the join keys", () => {
    // The whole 14k-order archive failed on "Unknown attribute: product_id"
    // because the transformed shape was spread wholesale into the payload.
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313", "wpitem987", "wpvar63469")],
      new Set(["wpprod37313"]),
      new Set(["wpvar63469"]),
      permissions
    );

    expect([...Object.keys(row ?? {})].sort()).toEqual([
      "$id",
      "$permissions",
      "line_total",
      "name",
      "product",
      "quantity",
      "unit_price",
      "variation",
    ]);
  });

  test("links the product relationship when that product is being imported", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313")],
      new Set(["wpprod37313"]),
      noVariations,
      permissions
    );

    expect(row?.product).toBe("wpprod37313");
  });

  test("omits the relationship for a product that is not being imported, since Appwrite rejects a dangling relationship", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod-rejected")],
      new Set(["wpprod37313"]),
      noVariations,
      permissions
    );

    expect("product" in (row ?? {})).toBe(false);
    // The line still records what was bought.
    expect(row?.name).toBe("Booklocker");
  });

  test("omits the variation relationship when the collapsed pair kept the other half", () => {
    // WooCommerce names the member variation (63465); buildVariations keeps
    // only the non-member anchor (63469), so this must stay unlinked.
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313", "wpitem1", "wpvar63465")],
      new Set(["wpprod37313"]),
      new Set(["wpvar63469"]),
      permissions
    );

    expect("variation" in (row ?? {})).toBe(false);
    expect(row?.product).toBe("wpprod37313");
  });

  test("omits the variation relationship for a non-variation line", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313", "wpitem1", null)],
      new Set(["wpprod37313"]),
      new Set(["wpvar63469"]),
      permissions
    );

    expect("variation" in (row ?? {})).toBe(false);
  });
});

describe("buildJobUpsert", () => {
  test("includes every required column plus nested translations", () => {
    const payload = buildJobUpsert(job, [
      {
        $permissions: [],
        content_id: "wpjob63903",
        content_type: "job",
        description: "<p>Tekst</p>",
        locale: "no",
        short_description: null,
        title: "PR Manager",
      },
    ]);

    expect(payload.slug).toBe("pr-manager");
    expect(payload.status).toBe("published");
    expect(payload.campus_id).toBe("1");
    expect(Array.isArray(payload.translations)).toBe(true);
  });

  test("attaches permissions derived from status", () => {
    const payload = buildJobUpsert(job, []);

    expect(payload.$permissions).toContain('read("any")');
  });

  test("carries the transform's backdated timestamps through to the upsert payload", () => {
    // The loader hands `data` straight to db.upsertRow, which is where
    // Appwrite reads these system columns from — a key filter added here
    // would silently re-stamp the whole archive at cutover.
    const payload = buildJobUpsert(
      {
        ...job,
        row: {
          ...job.row,
          $createdAt: "2026-08-01T12:56:35.000Z",
          $updatedAt: "2026-08-03T09:10:00.000Z",
        },
      },
      []
    );

    expect(payload.$createdAt).toBe("2026-08-01T12:56:35.000Z");
    expect(payload.$updatedAt).toBe("2026-08-03T09:10:00.000Z");
  });

  test("a closed job gets no public read permission", () => {
    const payload = buildJobUpsert(
      { ...job, row: { ...job.row, status: "closed" } },
      []
    );

    expect(payload.$permissions).not.toContain('read("any")');
  });
});

describe("existingTargetContent", () => {
  const englishRow: ExistingTranslation = {
    $id: "row-en",
    description: "<p>already translated</p>",
    locale: "en",
    short_description: "summary",
    title: "Translated title",
  };

  test("returns the stored text so a resumed run can skip the OpenAI call", () => {
    const content = existingTargetContent(
      new Map([[translationKey("wpjob1", "en"), englishRow]]),
      "wpjob1",
      "en"
    );

    expect(content).toEqual({
      description: "<p>already translated</p>",
      locale: "en",
      shortDescription: "summary",
      title: "Translated title",
    });
  });

  test("returns null when only the other locale exists, so the target still gets generated", () => {
    expect(
      existingTargetContent(
        new Map([[translationKey("wpjob1", "no"), englishRow]]),
        "wpjob1",
        "en"
      )
    ).toBeNull();
  });

  test("returns null for a different content id", () => {
    expect(
      existingTargetContent(
        new Map([[translationKey("wpjob2", "en"), englishRow]]),
        "wpjob1",
        "en"
      )
    ).toBeNull();
  });

  test("returns null when no translations have been loaded at all", () => {
    expect(existingTargetContent(undefined, "wpjob1", "en")).toBeNull();
  });
});

describe("buildProductUpsert variations", () => {
  const variations = [
    {
      row: { member_price: 500, name: "A year", regular_price: 1500 },
      rowId: "wpvar63469",
    },
  ];

  test("nests variations as children keyed by their deterministic row id", () => {
    const upsert = buildProductUpsert(
      { row: { status: "published" }, rowId: "wpprod37313", variations },
      []
    );

    expect(upsert.variations).toEqual([
      {
        $id: "wpvar63469",
        $permissions: ['read("any")'],
        member_price: 500,
        name: "A year",
        regular_price: 1500,
      },
    ]);
  });

  test("gives children the parent's permissions, so a draft product's variations stay private", () => {
    const upsert = buildProductUpsert(
      { row: { status: "draft" }, rowId: "wpprod37313", variations },
      []
    );

    expect(
      (upsert.variations as Record<string, unknown>[])[0]?.$permissions
    ).toEqual([]);
  });

  test("writes an empty variations array for a simple product, detaching any stale children", () => {
    const upsert = buildProductUpsert(
      { row: { status: "published" }, rowId: "wpprod1" },
      []
    );

    expect(upsert.variations).toEqual([]);
  });
});
