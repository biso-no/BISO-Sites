import { describe, expect, test } from "bun:test";
import type { Orders } from "@repo/api/types/appwrite";
import { escapeCsvValue, ordersToCsv } from "./orders-csv";

const HEADERS = [
  "Order",
  "Date",
  "Buyer",
  "Email",
  "Phone",
  "Items",
  "Subtotal",
  "Discount",
  "Total",
  "Currency",
  "Status",
  "Provider",
  "Member discount",
  "Receipt",
];

/** A row shaped like the projection `listOrders` returns, cast at the edge. */
function makeOrder(overrides: Record<string, unknown> = {}): Orders {
  return {
    $id: "wporder1",
    $createdAt: "2026-02-03T10:11:12.000Z",
    buyer_name: "Andreas",
    buyer_email: "andreas@example.com",
    buyer_phone: "+4712345678",
    subtotal: 200,
    discount_total: 20,
    total: 180,
    currency: "NOK",
    status: "paid",
    payment_provider: "vipps",
    member_discount_percent: 10,
    payment_receipt_url: "https://receipts.example.com/1",
    receipt_link: null,
    items_json: JSON.stringify([{ name: "Genser", quantity: 2 }]),
    ...overrides,
  } as unknown as Orders;
}

describe("escapeCsvValue", () => {
  test("returns an empty string for null and undefined", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  test("leaves a plain value unquoted", () => {
    expect(escapeCsvValue("Andreas")).toBe("Andreas");
    expect(escapeCsvValue(180)).toBe("180");
    expect(escapeCsvValue(0)).toBe("0");
  });

  test("quotes a value containing a comma", () => {
    expect(escapeCsvValue("Heien, Markus")).toBe('"Heien, Markus"');
  });

  test("quotes and doubles an embedded quote", () => {
    expect(escapeCsvValue('He said "hei"')).toBe('"He said ""hei"""');
  });

  test("quotes a value containing a newline", () => {
    expect(escapeCsvValue("line one\nline two")).toBe('"line one\nline two"');
  });
});

describe("ordersToCsv", () => {
  test("writes the header row and one row per order in column order", () => {
    const csv = ordersToCsv([makeOrder()], HEADERS);
    const lines = csv.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(HEADERS.join(","));
    expect(lines[1]).toBe(
      [
        "wporder1",
        "2026-02-03",
        "Andreas",
        "andreas@example.com",
        "+4712345678",
        "Genser x2",
        "200",
        "20",
        "180",
        "NOK",
        "paid",
        "vipps",
        "10",
        "https://receipts.example.com/1",
      ].join(",")
    );
  });

  test("escapes header cells as well as row cells", () => {
    const csv = ordersToCsv([], ["a,b", 'c"d']);
    expect(csv).toBe('"a,b","c""d"');
  });

  test("joins multiple items with a semicolon and quotes the cell", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          items_json: JSON.stringify([
            { name: "Genser", quantity: 2 },
            { name: "Skjerf", quantity: 1 },
          ]),
        }),
      ],
      HEADERS
    );

    // The separator is a semicolon, so the cell needs no quoting.
    expect(csv.split("\n")[1]).toContain("Genser x2; Skjerf x1");
  });

  test("falls back to the product name and then to ? for an unnamed item", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          items_json: JSON.stringify([
            { product_name: "Bokskap", quantity: 1 },
            { quantity: null },
          ]),
        }),
      ],
      HEADERS
    );

    expect(csv.split("\n")[1]).toContain("Bokskap x1; ?");
  });

  test("quotes the items cell when an item name contains a comma", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          items_json: JSON.stringify([{ name: "Genser, sort", quantity: 1 }]),
        }),
      ],
      HEADERS
    );

    expect(csv.split("\n")[1]).toContain('"Genser, sort x1"');
  });

  test("reads relational order_items when present", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          items_json: null,
          order_items: [{ $id: "i1", name: "Bokskap", quantity: 3 }],
        }),
      ],
      HEADERS
    );

    expect(csv.split("\n")[1]).toContain("Bokskap x3");
  });

  test("defaults a missing discount to 0 and blanks a missing receipt", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          discount_total: null,
          payment_receipt_url: null,
          receipt_link: null,
        }),
      ],
      HEADERS
    );
    const cells = csv.split("\n")[1]?.split(",");

    expect(cells?.[7]).toBe("0");
    expect(cells?.at(-1)).toBe("");
  });

  test("falls back to receipt_link when there is no payment receipt url", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          payment_receipt_url: null,
          receipt_link: "https://legacy.example.com/1",
        }),
      ],
      HEADERS
    );

    expect(csv.split("\n")[1]).toContain("https://legacy.example.com/1");
  });

  test("escapes a buyer name containing a comma", () => {
    const csv = ordersToCsv(
      [makeOrder({ buyer_name: "Heien, Markus" })],
      ["Buyer"]
    );

    expect(csv.split("\n")[1]).toContain('"Heien, Markus"');
  });

  test("returns just the header row for no orders", () => {
    expect(ordersToCsv([], HEADERS)).toBe(HEADERS.join(","));
  });
});
