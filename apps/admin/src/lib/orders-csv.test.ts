import { describe, expect, test } from "bun:test";
import type { Orders } from "@repo/api/types/appwrite";
import { escapeCsvValue, orderCsvRowCount, ordersToCsv } from "./orders-csv";

/**
 * The 21 columns the pagination design spec fixes for this file, in order.
 * Only their COUNT and ORDER matter to the renderer — the labels are localised
 * by the caller — so the test uses the column names themselves as headers.
 */
const HEADERS = [
  "order_id",
  "order_date",
  "status",
  "buyer_name",
  "buyer_email",
  "buyer_phone",
  "campus",
  "product_name",
  "product_id",
  "variation",
  "quantity",
  "unit_price",
  "line_total",
  "currency",
  "order_subtotal",
  "order_discount_total",
  "order_total",
  "member_discount_percent",
  "payment_provider",
  "receipt_url",
  "custom_fields",
];

const COLUMN = {
  buyerEmail: 4,
  buyerName: 3,
  buyerPhone: 5,
  campus: 6,
  currency: 13,
  customFields: 20,
  lineTotal: 12,
  memberDiscountPercent: 17,
  orderDate: 1,
  orderDiscountTotal: 15,
  orderId: 0,
  orderSubtotal: 14,
  orderTotal: 16,
  paymentProvider: 18,
  productId: 8,
  productName: 7,
  quantity: 10,
  receiptUrl: 19,
  status: 2,
  unitPrice: 11,
  variation: 9,
} as const;

/**
 * A deliberately small RFC 4180 reader, so the escaping assertions test what a
 * spreadsheet actually sees rather than the string the renderer happened to
 * build. Returns rows of raw (unquoted, unescaped) cells.
 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/** A row shaped like the projection the export returns, cast at the edge. */
function makeOrder(overrides: Record<string, unknown> = {}): Orders {
  return {
    $id: "wporder1",
    $createdAt: "2026-02-03T10:11:12.000Z",
    buyer_name: "Andreas",
    buyer_email: "andreas@example.com",
    buyer_phone: "+4712345678",
    campus_id: "campus-oslo",
    subtotal: 200,
    discount_total: 20,
    total: 180,
    currency: "NOK",
    status: "paid",
    payment_provider: "vipps",
    member_discount_percent: 10,
    payment_receipt_url: "https://receipts.example.com/1",
    receipt_link: null,
    order_items: [
      {
        $id: "line-1",
        custom_fields_json: null,
        line_total: 200,
        name: "Genser",
        product: { $id: "product-1" },
        quantity: 2,
        unit_price: 100,
        variation: null,
      },
    ],
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
  test("writes the header row and escapes header cells", () => {
    const csv = ordersToCsv([], ["a,b", 'c"d']);
    expect(csv).toBe('"a,b","c""d"');
  });

  test("returns just the header row for no orders", () => {
    expect(ordersToCsv([], HEADERS)).toBe(HEADERS.join(","));
  });

  test("writes every one of the 21 spec columns for a single-item order", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              custom_fields_json: JSON.stringify([
                { id: "size", label: "Størrelse", value: "L" },
              ]),
              line_total: 200,
              name: "Genser",
              product: { $id: "product-1" },
              quantity: 2,
              unit_price: 100,
              variation: { $id: "variation-1", name: "Large" },
            },
          ],
        }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(HEADERS);
    expect(rows[1]).toEqual([
      "wporder1",
      "2026-02-03",
      "paid",
      "Andreas",
      "andreas@example.com",
      "+4712345678",
      "campus-oslo",
      "Genser",
      "product-1",
      "Large",
      "2",
      "100",
      "200",
      "NOK",
      "200",
      "20",
      "180",
      "10",
      "vipps",
      "https://receipts.example.com/1",
      "Størrelse=L",
    ]);
  });

  test("emits one row per order item, not one row per order", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              line_total: 200,
              name: "Genser",
              product: { $id: "product-1" },
              quantity: 2,
              unit_price: 100,
            },
            {
              $id: "line-2",
              line_total: 150,
              name: "Skjerf",
              product: { $id: "product-2" },
              quantity: 1,
              unit_price: 150,
            },
            {
              $id: "line-3",
              line_total: 50,
              name: "Bokskap",
              product: { $id: "product-3" },
              quantity: 1,
              unit_price: 50,
            },
          ],
        }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv).slice(1);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row[COLUMN.productName])).toEqual([
      "Genser",
      "Skjerf",
      "Bokskap",
    ]);
    expect(rows.map((row) => row[COLUMN.productId])).toEqual([
      "product-1",
      "product-2",
      "product-3",
    ]);
    expect(rows.map((row) => row[COLUMN.lineTotal])).toEqual([
      "200",
      "150",
      "50",
    ]);
  });

  test("repeats the order-level columns on every item row", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            { $id: "line-1", name: "Genser", quantity: 1, unit_price: 100 },
            { $id: "line-2", name: "Skjerf", quantity: 1, unit_price: 100 },
          ],
        }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv).slice(1);

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row[COLUMN.orderId]).toBe("wporder1");
      expect(row[COLUMN.orderDate]).toBe("2026-02-03");
      expect(row[COLUMN.status]).toBe("paid");
      expect(row[COLUMN.buyerName]).toBe("Andreas");
      expect(row[COLUMN.buyerEmail]).toBe("andreas@example.com");
      expect(row[COLUMN.buyerPhone]).toBe("+4712345678");
      expect(row[COLUMN.campus]).toBe("campus-oslo");
      expect(row[COLUMN.currency]).toBe("NOK");
      expect(row[COLUMN.orderSubtotal]).toBe("200");
      expect(row[COLUMN.orderDiscountTotal]).toBe("20");
      expect(row[COLUMN.orderTotal]).toBe("180");
      expect(row[COLUMN.memberDiscountPercent]).toBe("10");
      expect(row[COLUMN.paymentProvider]).toBe("vipps");
      expect(row[COLUMN.receiptUrl]).toBe("https://receipts.example.com/1");
    }
  });

  test("emits one row with empty item columns for an order with no items", () => {
    // A paid order with no line rows must still reach finance, so it is a row
    // with the product half blank — never a silently dropped order.
    const csv = ordersToCsv([makeOrder({ order_items: [] })], HEADERS);
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    const row = rows[1] as string[];
    expect(row).toHaveLength(HEADERS.length);
    expect(row[COLUMN.orderId]).toBe("wporder1");
    expect(row[COLUMN.orderTotal]).toBe("180");
    for (const column of [
      COLUMN.productName,
      COLUMN.productId,
      COLUMN.variation,
      COLUMN.quantity,
      COLUMN.unitPrice,
      COLUMN.lineTotal,
      COLUMN.customFields,
    ]) {
      expect(row[column]).toBe("");
    }
  });

  test("flattens custom_fields_json to label=value pairs", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              custom_fields_json: JSON.stringify([
                { id: "size", label: "Størrelse", value: "L" },
                { id: "diet", label: "Allergier", value: "Ingen" },
              ]),
              name: "Genser",
              quantity: 1,
            },
          ],
        }),
      ],
      HEADERS
    );

    expect(parseCsv(csv)[1]?.[COLUMN.customFields]).toBe(
      "Størrelse=L; Allergier=Ingen"
    );
  });

  test("falls back to the field id when a custom field has no label", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              custom_fields_json: JSON.stringify([
                { id: "gift", value: "yes" },
              ]),
              name: "Genser",
              quantity: 1,
            },
          ],
        }),
      ],
      HEADERS
    );

    expect(parseCsv(csv)[1]?.[COLUMN.customFields]).toBe("gift=yes");
  });

  test("leaves the custom fields cell empty for malformed or empty json", () => {
    for (const customFieldsJson of ["{not json", "", null, "[]", '"plain"']) {
      const csv = ordersToCsv(
        [
          makeOrder({
            order_items: [
              {
                $id: "line-1",
                custom_fields_json: customFieldsJson,
                name: "Genser",
                quantity: 1,
              },
            ],
          }),
        ],
        HEADERS
      );
      const row = parseCsv(csv)[1] as string[];

      expect(row[COLUMN.customFields]).toBe("");
      // The item is still exported — a broken answer blob must not cost the
      // fulfilment team the line itself.
      expect(row[COLUMN.productName]).toBe("Genser");
    }
  });

  test("escapes commas, quotes and newlines inside item cells", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              custom_fields_json: JSON.stringify([
                { id: "note", label: "Notat", value: 'Ring, "raskt"\nherre' },
              ]),
              name: 'Genser, sort "L"',
              quantity: 1,
            },
          ],
        }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[1]?.[COLUMN.productName]).toBe('Genser, sort "L"');
    expect(rows[1]?.[COLUMN.customFields]).toBe('Notat=Ring, "raskt"\nherre');
    // …and the raw document really did quote those cells.
    expect(csv).toContain('"Genser, sort ""L"""');
  });

  test("computes a missing line total from unit price and quantity", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              line_total: null,
              name: "Genser",
              quantity: 3,
              unit_price: 99,
            },
          ],
        }),
      ],
      HEADERS
    );

    expect(parseCsv(csv)[1]?.[COLUMN.lineTotal]).toBe("297");
  });

  test("leaves the line total empty when neither the column nor the parts exist", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [{ $id: "line-1", name: "Genser", quantity: null }],
        }),
      ],
      HEADERS
    );
    const row = parseCsv(csv)[1] as string[];

    expect(row[COLUMN.lineTotal]).toBe("");
    expect(row[COLUMN.unitPrice]).toBe("");
    expect(row[COLUMN.quantity]).toBe("");
  });

  test("falls back to the variation id when only the relationship id was loaded", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: [
            {
              $id: "line-1",
              name: "Genser",
              quantity: 1,
              variation: "variation-7",
            },
          ],
        }),
      ],
      HEADERS
    );

    expect(parseCsv(csv)[1]?.[COLUMN.variation]).toBe("variation-7");
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
    const row = parseCsv(csv)[1] as string[];

    expect(row[COLUMN.orderDiscountTotal]).toBe("0");
    expect(row[COLUMN.receiptUrl]).toBe("");
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

    expect(parseCsv(csv)[1]?.[COLUMN.receiptUrl]).toBe(
      "https://legacy.example.com/1"
    );
  });

  test("reads a legacy items_json order that has no relationship rows", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          order_items: undefined,
          items_json: JSON.stringify([
            { name: "Bokskap", product_id: "legacy-1", quantity: 3, price: 50 },
            { name: "Genser", product_id: "legacy-2", quantity: 1 },
          ]),
        }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv).slice(1);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row[COLUMN.productId])).toEqual([
      "legacy-1",
      "legacy-2",
    ]);
    expect(rows[0]?.[COLUMN.productName]).toBe("Bokskap");
  });

  test("writes every order's rows, in the order given", () => {
    const csv = ordersToCsv(
      [
        makeOrder({
          $id: "newest",
          order_items: [
            { $id: "a", name: "Genser", quantity: 1 },
            { $id: "b", name: "Skjerf", quantity: 1 },
          ],
        }),
        makeOrder({ $id: "older", order_items: [] }),
      ],
      HEADERS
    );
    const rows = parseCsv(csv).slice(1);

    expect(rows.map((row) => row[COLUMN.orderId])).toEqual([
      "newest",
      "newest",
      "older",
    ]);
  });
});

describe("orderCsvRowCount", () => {
  test("counts one row per item across orders", () => {
    expect(
      orderCsvRowCount([
        makeOrder({
          order_items: [
            { $id: "a", name: "Genser", quantity: 1 },
            { $id: "b", name: "Skjerf", quantity: 1 },
            { $id: "c", name: "Bokskap", quantity: 1 },
          ],
        }),
        makeOrder({
          order_items: [{ $id: "d", name: "Genser", quantity: 1 }],
        }),
      ])
    ).toBe(4);
  });

  test("counts an order with no items as the one row it writes", () => {
    expect(orderCsvRowCount([makeOrder({ order_items: [] })])).toBe(1);
  });

  test("is zero for no orders", () => {
    expect(orderCsvRowCount([])).toBe(0);
  });

  test("matches the data rows ordersToCsv actually writes", () => {
    // The two must never drift: the toast counts rows this function returned,
    // and a newline inside a custom-field answer makes line-splitting the CSV
    // an unusable cross-check.
    const orders = [
      makeOrder({
        order_items: [
          {
            $id: "a",
            custom_fields_json: JSON.stringify([
              { id: "note", label: "Notat", value: "line one\nline two" },
            ]),
            name: "Genser",
            quantity: 1,
          },
          { $id: "b", name: "Skjerf", quantity: 1 },
        ],
      }),
      makeOrder({ order_items: [] }),
    ];

    expect(parseCsv(ordersToCsv(orders, HEADERS)).length - 1).toBe(
      orderCsvRowCount(orders)
    );
  });
});
