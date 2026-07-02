import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postShopTransaction = vi.hoisted(() => vi.fn());

vi.mock("@repo/connectors/24sevenoffice", () => ({
  postShopTransaction,
}));

import {
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "./finago-order-posting";

const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  decrementRowColumn: vi.fn(),
};

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    status: "paid",
    total: 998,
    campus_id: "1",
    items_json: JSON.stringify([
      { product_id: "product-1", quantity: 2, unit_price: 499 },
    ]),
    finago_transaction_id: null,
    finago_posting_lock: 0,
    ...overrides,
  };
}

describe("postFinagoTransactionForOrder", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID = "webshop_products";

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
    postShopTransaction.mockReset();

    db.getRow.mockImplementation((_dbId: string, collId: string) =>
      collId === "orders"
        ? Promise.resolve(paidOrder())
        : Promise.resolve({ $id: "product-1", finago_account_number: 3000 })
    );
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({ finago_posting_lock: 0 });
    db.updateRow.mockResolvedValue({});
    postShopTransaction.mockResolvedValue("finago-tx-1");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims atomically, posts, and records the transaction id", async () => {
    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    expect(db.incrementRowColumn).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "orders",
      rowId: "order-1",
      column: "finago_posting_lock",
      value: 1,
    });
    expect(postShopTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        total: 998,
        items: [
          {
            unit_price: 499,
            quantity: 2,
            finago_account_number: 3000,
          },
        ],
      })
    );
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "finago-tx-1",
    });
  });

  it("skips without posting when another caller holds the claim", async () => {
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 2 });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "claimed_elsewhere" });
    expect(postShopTransaction).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("skips orders that already have a Finago transaction", async () => {
    db.getRow.mockResolvedValue(
      paidOrder({ finago_transaction_id: "finago-tx-0" })
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "already_posted" });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(postShopTransaction).not.toHaveBeenCalled();
  });

  it("skips orders that are not paid or authorized", async () => {
    db.getRow.mockResolvedValue(paidOrder({ status: "pending" }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "not_paid" });
    expect(postShopTransaction).not.toHaveBeenCalled();
  });

  it("releases the claim when the Finago post fails so a sweep can retry", async () => {
    postShopTransaction.mockRejectedValue(new Error("24SO down"));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(db.decrementRowColumn).toHaveBeenCalledWith({
      databaseId: "app",
      tableId: "orders",
      rowId: "order-1",
      column: "finago_posting_lock",
      value: 1,
      min: 0,
    });
    expect(db.updateRow).not.toHaveBeenCalledWith(
      "app",
      "orders",
      "order-1",
      expect.objectContaining({ finago_transaction_id: expect.any(String) })
    );
  });
});

describe("releaseStaleFinagoClaim", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.updateRow.mockReset();
    db.updateRow.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets a lock that was claimed long ago without a transaction id", async () => {
    const staleOrder = paidOrder({
      finago_posting_lock: 1,
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    const released = await releaseStaleFinagoClaim(
      staleOrder as never,
      db,
      Date.now()
    );

    expect(released).toBe(true);
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_posting_lock: 0,
    });
  });

  it("leaves fresh claims and posted orders alone", async () => {
    const freshClaim = paidOrder({ finago_posting_lock: 1 });
    const posted = paidOrder({
      finago_posting_lock: 1,
      finago_transaction_id: "finago-tx-1",
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });

    expect(await releaseStaleFinagoClaim(freshClaim as never, db)).toBe(false);
    expect(await releaseStaleFinagoClaim(posted as never, db)).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
