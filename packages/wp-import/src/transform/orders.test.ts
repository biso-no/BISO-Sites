import { describe, expect, test } from "bun:test";
import {
  mapOrderStatus,
  transformOrder,
  WORDPRESS_IMPORT_LEDGER_EXCLUSION,
} from "./orders";

const baseOrder = {
  billing: {
    email: "student@biso.no",
    first_name: "Ola",
    last_name: "Nordmann",
    phone: "+4712345678",
  },
  currency: "NOK",
  date_created_gmt: "2026-03-01T09:00:00",
  date_modified_gmt: "2026-03-02T11:30:00",
  discount_total: "0.00",
  id: 1234,
  line_items: [
    {
      id: 987,
      name: "Booklocker",
      price: 250,
      product_id: 37_313,
      quantity: 1,
      total: "250.00",
    },
  ],
  payment_method_title: "Vipps",
  status: "completed",
  total: "250.00",
};

describe("mapOrderStatus", () => {
  test("maps completed and processing to paid", () => {
    expect(mapOrderStatus("completed")).toBe("paid");
    expect(mapOrderStatus("processing")).toBe("paid");
  });

  test("maps on-hold and pending to pending", () => {
    expect(mapOrderStatus("on-hold")).toBe("pending");
    expect(mapOrderStatus("pending")).toBe("pending");
  });

  test("passes through terminal statuses", () => {
    expect(mapOrderStatus("cancelled")).toBe("cancelled");
    expect(mapOrderStatus("refunded")).toBe("refunded");
    expect(mapOrderStatus("failed")).toBe("failed");
  });

  test("returns null for an unknown status rather than guessing", () => {
    expect(mapOrderStatus("checkout-draft")).toBeNull();
  });
});

describe("transformOrder", () => {
  test("builds an orders row with a deterministic id", () => {
    const result = transformOrder(baseOrder, new Map());

    expect("row" in result).toBe(true);
    if (!("row" in result)) {
      return;
    }
    expect(result.rowId).toBe("wporder1234");
    expect(result.row.status).toBe("paid");
    expect(result.row.total).toBe(250);
    expect(result.row.currency).toBe("NOK");
    expect(result.row.buyer_email).toBe("student@biso.no");
    expect(result.row.buyer_name).toBe("Ola Nordmann");
  });

  test("emits structured order_items rows pointing at the new Appwrite product id", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      name: "Booklocker",
      product_id: "wpprod37313",
      quantity: 1,
      rowId: "wpitem987",
      title: "Booklocker",
      unit_price: 250,
    });
  });

  test("no longer writes items_json — the column is gone from the orders table", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect("items_json" in result.row).toBe(false);
  });

  test("derives each item row id from the WooCommerce line id so a re-run updates rather than duplicates", () => {
    const result = transformOrder(
      {
        ...baseOrder,
        line_items: [
          { ...baseOrder.line_items[0], id: 11 },
          { ...baseOrder.line_items[0], id: 22 },
        ],
      },
      new Map()
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.items.map((item) => item.rowId)).toEqual([
      "wpitem11",
      "wpitem22",
    ]);
  });

  test("links a known buyer email to an Appwrite user id", () => {
    const result = transformOrder(
      baseOrder,
      new Map([["student@biso.no", "user-abc"]])
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBe("user-abc");
  });

  test("leaves userId null for an unknown buyer", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBeNull();
  });

  test("matches buyer email case-insensitively", () => {
    const result = transformOrder(
      {
        ...baseOrder,
        billing: { ...baseOrder.billing, email: "Student@BISO.no" },
      },
      new Map([["student@biso.no", "user-abc"]])
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.userId).toBe("user-abc");
  });

  test("rejects a non-NOK order rather than coercing the currency", () => {
    const result = transformOrder({ ...baseOrder, currency: "EUR" }, new Map());

    expect("reject" in result).toBe(true);
  });

  test("rejects an order with an unmappable status", () => {
    const result = transformOrder(
      { ...baseOrder, status: "checkout-draft" },
      new Map()
    );

    expect("reject" in result).toBe(true);
  });

  test("backdates $createdAt and $updatedAt to the WooCommerce dates so the archive is not stamped at cutover", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.$createdAt).toBe("2026-03-01T09:00:00.000Z");
    expect(result.row.$updatedAt).toBe("2026-03-02T11:30:00.000Z");
  });

  test("reads date_created_gmt as UTC, so a site-local offset never shifts the row", () => {
    // The same instant WooCommerce would report as 11:00 site-local (+02:00).
    const result = transformOrder(
      { ...baseOrder, date_created_gmt: "2026-03-01T11:00:00+02:00" },
      new Map()
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.$createdAt).toBe("2026-03-01T09:00:00.000Z");
  });

  test("omits the timestamp overrides when WooCommerce has no usable date", () => {
    const result = transformOrder(
      { ...baseOrder, date_created_gmt: "", date_modified_gmt: "" },
      new Map()
    );
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect("$createdAt" in result.row).toBe(false);
    expect("$updatedAt" in result.row).toBe(false);
  });

  test("does not set lock fields", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.finago_posting_lock).toBeUndefined();
    expect(result.row.transition_lock).toBeUndefined();
  });

  test("stamps the wordpress-import sentinel into finago_transaction_id so the reconcile cron never posts an imported order to the live ledger", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }

    expect(result.row.finago_transaction_id).toBe(
      WORDPRESS_IMPORT_LEDGER_EXCLUSION
    );
  });
});
