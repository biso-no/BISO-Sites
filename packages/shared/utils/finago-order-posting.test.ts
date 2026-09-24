import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildShopTransactionInput: vi.fn(),
  isFeatureEnabled: vi.fn(),
  postLedgerTransaction: vi.fn(),
}));

vi.mock("@repo/connectors/24sevenoffice", () => ({
  buildShopTransactionInput: mocks.buildShopTransactionInput,
  postLedgerTransaction: mocks.postLedgerTransaction,
}));
vi.mock("./feature-flags-server", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

import {
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "./finago-order-posting";

const db = {
  createRow: vi.fn(),
  decrementRowColumn: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const SETTINGS_ROW = {
  general: JSON.stringify({
    clearingAccounts: { stripe: 1540, vipps: 1530 },
    transactionTypeNumber: 8,
  }),
};

const snapshotLine = {
  $id: "line-1",
  finago_account_number: 3000,
  finago_department: "44",
  finago_vat_code: 3,
  name: "Gensere til børsgruppen",
  product: { $id: "product-1" },
  quantity: 2,
  unit_price: 499,
};

const lineWithoutCopy = {
  $id: "line-1",
  name: "Gensere til børsgruppen",
  product: { $id: "product-1" },
  quantity: 2,
  unit_price: 499,
};

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    campus_id: "1",
    finago_posting_lock: 0,
    finago_transaction_id: null,
    order_items: [snapshotLine],
    payment_provider: "vipps",
    status: "paid",
    total: 998,
    ...overrides,
  };
}

function wireRows(
  order: Record<string, unknown>,
  rows: Record<string, Record<string, unknown>> = {
    "ledger_accounts/3000": { vat_code: 3 },
    "sales_types/varesalg": { account_number: 3000, active: true },
    "shop_settings/accounting": SETTINGS_ROW,
    "webshop_products/product-1": {
      departmentId: "44",
      sales_type: "varesalg",
    },
  }
) {
  db.getRow.mockImplementation((_db: string, table: string, id: string) => {
    if (table === "orders") {
      return Promise.resolve(order);
    }
    const row = rows[`${table}/${id}`];
    return row
      ? Promise.resolve(row)
      : Promise.reject(
          Object.assign(new Error("row_not_found"), { code: 404 })
        );
  });
}

const CLAIM_RELEASE = {
  column: "finago_posting_lock",
  databaseId: "app",
  min: 0,
  rowId: "order-1",
  tableId: "orders",
  value: 1,
};

describe("postFinagoTransactionForOrder", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    vi.stubEnv("TFSO_REST_CLIENT_ID", "client");
    vi.stubEnv("TFSO_REST_CLIENT_SECRET", "secret");
    vi.stubEnv("TFSO_REST_ORG_ID", "org");

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
    for (const fn of Object.values(mocks)) {
      fn.mockReset();
    }

    wireRows(paidOrder());
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({ finago_posting_lock: 0 });
    db.updateRow.mockResolvedValue({});
    db.listRows.mockResolvedValue({ rows: [] });
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.buildShopTransactionInput.mockReturnValue({ built: true });
    mocks.postLedgerTransaction.mockResolvedValue("finago-tx-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("claims, builds the voucher from the line copy, posts it, and records the id", async () => {
    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith("shop_ledger_posting");
    expect(db.incrementRowColumn).toHaveBeenCalledWith({
      column: "finago_posting_lock",
      databaseId: "app",
      rowId: "order-1",
      tableId: "orders",
      value: 1,
    });
    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: "1",
        clearingAccount: 1530,
        comment: "Nettbutikk order-1",
        lines: [
          {
            accountNumber: 3000,
            amount: 998,
            comment: "Gensere til børsgruppen ×2",
            departmentId: "44",
            vatCode: 3,
          },
        ],
        total: 998,
        transactionTypeNumber: 8,
      })
    );
    expect(mocks.postLedgerTransaction).toHaveBeenCalledWith({ built: true });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "posting",
    });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "finago-tx-1",
    });
  });

  it("falls back to the product's sales type for a line without a copy", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }));

    await postFinagoTransactionForOrder("order-1", db);

    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.objectContaining({ accountNumber: 3000, vatCode: 3 })],
      })
    );
  });

  it("writes the fallback target back onto a line without a copy after posting", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "order_items", "line-1", {
      finago_account_number: 3000,
      finago_department: "44",
      finago_vat_code: 3,
    });
  });

  it("does not rewrite lines that already carry a checkout copy", async () => {
    wireRows(
      paidOrder({
        order_items: [
          snapshotLine,
          { ...lineWithoutCopy, $id: "line-2", quantity: 1, unit_price: 100 },
        ],
        total: 1098,
      })
    );

    await postFinagoTransactionForOrder("order-1", db);

    const itemWrites = db.updateRow.mock.calls.filter(
      ([, table]) => table === "order_items"
    );
    expect(itemWrites).toEqual([
      [
        "app",
        "order_items",
        "line-2",
        {
          finago_account_number: 3000,
          finago_department: "44",
          finago_vat_code: 3,
        },
      ],
    ]);
  });

  it("does not write back lines of a legacy items_json order", async () => {
    wireRows(
      paidOrder({
        items_json: JSON.stringify([
          {
            name: "Gensere til børsgruppen",
            product_id: "product-1",
            quantity: 2,
            unit_price: 499,
          },
        ]),
        order_items: undefined,
      })
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result.posted).toBe(true);
    expect(
      db.updateRow.mock.calls.filter(([, table]) => table === "order_items")
    ).toEqual([]);
  });

  it("still reports the posting when the write-back fails", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }));
    db.updateRow.mockImplementation((_db: string, table: string) =>
      table === "order_items"
        ? Promise.reject(new Error("appwrite timeout"))
        : Promise.resolve({})
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "finago-tx-1",
    });
  });

  it("uses the Stripe clearing account for a Stripe order", async () => {
    wireRows(paidOrder({ payment_provider: "stripe" }));

    await postFinagoTransactionForOrder("order-1", db);

    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({ clearingAccount: 1540 })
    );
  });

  it("does nothing while shop ledger posting is switched off", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "disabled" });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("releases the claim and writes no marker when a line has no sales type", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }), {
      "shop_settings/accounting": SETTINGS_ROW,
    });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: '"Gensere til børsgruppen" has no sales type',
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("releases the claim when shop accounting settings are missing", async () => {
    wireRows(paidOrder(), {});

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "Shop accounting settings have not been saved in admin",
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });

  it("returns not_found only when the order read 404s", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("row_not_found"), { code: 404 })
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "not_found" });
  });

  it("throws when the order read fails for any other reason", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("Service unavailable"), { code: 503 })
    );

    await expect(postFinagoTransactionForOrder("order-1", db)).rejects.toThrow(
      "Service unavailable"
    );
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("reports post_failed, not not_configured, when a settings read fails", async () => {
    db.getRow.mockImplementation((_db: string, table: string) =>
      table === "orders"
        ? Promise.resolve(paidOrder())
        : Promise.reject(
            Object.assign(new Error("Request timed out"), { code: 504 })
          )
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("releases the claim when Finago credentials are missing", async () => {
    vi.stubEnv("TFSO_REST_CLIENT_ID", "");

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "Finago REST credentials are not set on this app",
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("releases the claim when the builder refuses the voucher", async () => {
    mocks.buildShopTransactionInput.mockImplementation(() => {
      throw new Error("[Finago] unbalanced voucher");
    });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "[Finago] unbalanced voucher",
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("stamps a zero-total order so it leaves the sweep for good", async () => {
    wireRows(paidOrder({ total: 0 }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "zero_total" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "zero-total",
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("skips without posting and undoes its increment when another caller holds the claim", async () => {
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 2 });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "claimed_elsewhere" });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });

  it("skips orders that already carry a transaction id or sentinel", async () => {
    wireRows(paidOrder({ finago_transaction_id: "finago-tx-0" }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "already_posted" });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("skips orders that are not paid or authorized", async () => {
    wireRows(paidOrder({ status: "pending" }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "not_paid" });
  });

  it("stamps membership orders out instead of posting them", async () => {
    wireRows(
      paidOrder({
        order_items: [{ ...snapshotLine, product_type: "membership" }],
      })
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "membership_order" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "membership",
    });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("keeps the marker and does not release the claim when the Finago post fails", async () => {
    mocks.postLedgerTransaction.mockRejectedValue(new Error("Finago down"));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "posting",
    });
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });

  it("releases the claim when the marker write fails before posting", async () => {
    db.updateRow.mockRejectedValueOnce(new Error("appwrite timeout"));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });

  describe("an order refunded before it was posted", () => {
    it("is not posted automatically when a refund row exists", async () => {
      db.listRows.mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "succeeded" }],
      });

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false, reason: "needs_manual" });
      expect(result.detail).toContain("refund");
      expect(db.listRows).toHaveBeenCalledWith(
        "app",
        "order_refunds",
        expect.arrayContaining([expect.stringContaining("order.$id")])
      );
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
      expect(db.updateRow).not.toHaveBeenCalledWith(
        "app",
        "orders",
        "order-1",
        { finago_transaction_id: "posting" }
      );
      expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("order-1")
      );
    });

    it("is not posted while a refund is still pending at the provider", async () => {
      db.listRows.mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "pending" }],
      });

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false, reason: "needs_manual" });
      expect(result.detail).toContain(
        "1 refund(s) still pending — wait for them to settle before booking the net sale by hand"
      );
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    });

    it("does not mention pending refunds when every refund has settled", async () => {
      db.listRows.mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "succeeded" }],
      });

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result.detail).not.toContain("still pending");
    });

    it("is not posted when the order carries a refunded total without a readable refund row", async () => {
      wireRows(paidOrder({ refunded_total: 100 }));

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false, reason: "needs_manual" });
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    });

    it("does not post when a refund row appears after the first check", async () => {
      // The refund created its row between the pre-marker check and the post.
      db.listRows.mockResolvedValueOnce({ rows: [] }).mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "pending" }],
      });

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false, reason: "needs_manual" });
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
      const orderWrites = db.updateRow.mock.calls
        .filter((call) => call[1] === "orders")
        .map((call) => call[3]);
      expect(orderWrites).toEqual([
        { finago_transaction_id: "posting" },
        { finago_transaction_id: null },
      ]);
      expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    });

    it("leaves the marker and the claim when the reset after a late refund fails", async () => {
      db.listRows.mockResolvedValueOnce({ rows: [] }).mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "pending" }],
      });
      db.updateRow
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("appwrite timeout"));

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false, reason: "needs_manual" });
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
      expect(db.decrementRowColumn).not.toHaveBeenCalled();
    });

    it("does not post when the refund history cannot be re-read after the marker", async () => {
      db.listRows
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValue(new Error("appwrite timeout"));

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result.posted).toBe(false);
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    });

    it("still posts when every earlier refund attempt failed", async () => {
      db.listRows.mockResolvedValue({
        rows: [{ $id: "refund-1", amount: 499, status: "failed" }],
      });

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    });

    it("releases the claim and does not post when the refund history cannot be read", async () => {
      db.listRows.mockRejectedValue(new Error("appwrite timeout"));

      const result = await postFinagoTransactionForOrder("order-1", db);

      expect(result).toMatchObject({ posted: false });
      expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
      expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    });
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
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finago_posting_lock: 1,
    });

    expect(
      await releaseStaleFinagoClaim(staleOrder as never, db, Date.now())
    ).toBe(true);
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_posting_lock: 0,
    });
  });

  it("leaves fresh claims and posted orders alone", async () => {
    const freshClaim = paidOrder({ finago_posting_lock: 1 });
    const posted = paidOrder({
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finago_posting_lock: 1,
      finago_transaction_id: "finago-tx-1",
    });

    expect(await releaseStaleFinagoClaim(freshClaim as never, db)).toBe(false);
    expect(await releaseStaleFinagoClaim(posted as never, db)).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
