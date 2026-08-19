import { describe, expect, test } from "bun:test";
import {
  buildJobUpsert,
  buildOrderItemRows,
  buildProductCampusIndex,
  buildTranslationRows,
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
      existingIds: new Map([[translationKey("wpjob2", "no"), "existing-id"]]),
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
      existingIds: new Map([
        [translationKey("wpjob1", "no"), "row-no"],
        [translationKey("wpjob1", "en"), "row-en"],
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

const orderItem = (productId: string, rowId = "wpitem1") => ({
  name: "Booklocker",
  product_id: productId,
  quantity: 1,
  rowId,
  title: "Booklocker",
  unit_price: 250,
});

describe("resolveOrderCampusId", () => {
  const campusByRowId = new Map([["wpprod37313", "1"]]);

  test("resolves the campus from the first line item whose product_id matches", () => {
    expect(
      resolveOrderCampusId([orderItem("wpprod37313")], campusByRowId)
    ).toBe("1");
  });

  test("skips a line item whose product_id does not resolve and tries the next", () => {
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

  test("moves rowId into $id and carries the parent permissions", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313", "wpitem987")],
      new Set(["wpprod37313"]),
      permissions
    );

    expect(row?.$id).toBe("wpitem987");
    expect(row?.$permissions).toEqual(permissions);
    expect(row?.rowId).toBeUndefined();
    expect(row?.name).toBe("Booklocker");
    expect(row?.unit_price).toBe(250);
  });

  test("links the product relationship when that product is being imported", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod37313")],
      new Set(["wpprod37313"]),
      permissions
    );

    expect(row?.product).toBe("wpprod37313");
    expect(row?.product_id).toBe("wpprod37313");
  });

  test("omits the relationship for a product that is not being imported, since Appwrite rejects a dangling relationship", () => {
    const [row] = buildOrderItemRows(
      [orderItem("wpprod-rejected")],
      new Set(["wpprod37313"]),
      permissions
    );

    expect("product" in (row ?? {})).toBe(false);
    // The line still records what was bought.
    expect(row?.product_id).toBe("wpprod-rejected");
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
