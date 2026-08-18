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
  date_created: "2026-03-01T10:00:00",
  discount_total: "0.00",
  id: 1234,
  line_items: [
    {
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

  test("points items_json product_id at the new Appwrite product id", () => {
    const result = transformOrder(baseOrder, new Map());
    if (!("row" in result)) {
      throw new Error("expected a row");
    }
    const items = JSON.parse(String(result.row.items_json));

    expect(items[0].product_id).toBe("wpprod37313");
    expect(items[0].quantity).toBe(1);
    expect(items[0].unit_price).toBe(250);
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
