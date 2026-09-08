import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasUnrecordedReversal,
  type LedgerReverser,
  loadOrderRefunds,
  ORDER_WITH_REFUNDS_SELECT,
  type RefundExecutor,
  refundOrder,
  releaseStaleRefundLock,
  settlePendingRefund,
  toRecordedRefunds,
  toRefundableItems,
} from "./order-refunds";

const db = {
  createRow: vi.fn(),
  decrementRowColumn: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const ORDER_ID = "order-1";

function buildOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: ORDER_ID,
    currency: "NOK",
    finago_transaction_id: "tx-9",
    order_items: [
      {
        $id: "line-a",
        name: "Campus hoodie",
        product: { $id: "product-1" },
        quantity: 2,
        unit_price: 499,
      },
      {
        $id: "line-b",
        name: "Cap",
        product: { $id: "product-2" },
        quantity: 1,
        unit_price: 199,
      },
    ],
    payment_provider: "stripe",
    refunds: [],
    status: "paid",
    total: 1197,
    ...overrides,
  };
}

/** Succeeds and reports the refunded total the caller asked for. */
function executorReturning(refundedTotalMinor: number): RefundExecutor {
  return {
    refund: vi.fn().mockResolvedValue({
      providerRefundId: "re_123",
      refundedTotalMinor,
      settled: true,
    }),
  };
}

function orderRowFor(order: Record<string, unknown>) {
  // Returns a promise rather than being declared `async`: the code under test
  // chains `.catch()` onto `getRow`, so the mock must be thenable.
  return (_dbId: string, tableId: string, rowId: string): Promise<unknown> => {
    if (tableId === "orders" && rowId === ORDER_ID) {
      return Promise.resolve(order);
    }
    if (tableId === "webshop_products") {
      return Promise.resolve({
        $id: rowId,
        finago_account_number: 3000,
        stock: 5,
      });
    }
    return Promise.resolve(null);
  };
}

beforeEach(() => {
  process.env.APPWRITE_DATABASE_ID = "app";
  process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
  process.env.APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID = "webshop_products";

  for (const fn of Object.values(db)) {
    fn.mockReset();
  }
  db.createRow.mockResolvedValue({});
  db.listRows.mockResolvedValue({ rows: [] });
  db.updateRow.mockResolvedValue({});
  db.decrementRowColumn.mockResolvedValue({});
  db.incrementRowColumn.mockResolvedValue({ refund_lock: 1 });
  db.getRow.mockImplementation(orderRowFor(buildOrder()));
});

describe("toRefundableItems", () => {
  it("maps relational lines and drops zero-quantity ones", () => {
    const items = toRefundableItems(
      buildOrder({
        order_items: [
          { $id: "l1", name: "A", quantity: 1, unit_price: 10 },
          { $id: "l2", name: "B", quantity: 0, unit_price: 10 },
        ],
      })
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "l1", quantity: 1, unitPrice: 10 });
  });
});

describe("toRecordedRefunds", () => {
  it("flattens refund rows and their line relationships", () => {
    const recorded = toRecordedRefunds(
      buildOrder({
        refunds: [
          {
            $id: "r1",
            amount: 499,
            status: "succeeded",
            lines: [{ order_item: { $id: "line-a" }, quantity: 1 }],
          },
        ],
      }) as never
    );
    expect(recorded).toEqual([
      {
        amount: 499,
        status: "succeeded",
        lines: [{ orderItemId: "line-a", quantity: 1 }],
      },
    ]);
  });
});

describe("ORDER_WITH_REFUNDS_SELECT", () => {
  it("is a Query.select projection over the order and its lines", () => {
    // Must be a Query string, not a bare column list: `getRow`'s fourth
    // argument is a query array, so a raw list is not a projection at all.
    expect(typeof ORDER_WITH_REFUNDS_SELECT).toBe("string");
    expect(ORDER_WITH_REFUNDS_SELECT).toContain("select");
    expect(ORDER_WITH_REFUNDS_SELECT).toContain("order_items.*");
  });

  it("does NOT select a refunds back-reference off the order", () => {
    // Regression guard for a real bug: there is no `orders.refunds` attribute,
    // so selecting it made Appwrite reject the whole read. The admin order page
    // swallowed that as a 404, which is why it looked like a missing order
    // rather than a broken query. Refunds come from `loadOrderRefunds`.
    expect(ORDER_WITH_REFUNDS_SELECT).not.toContain("refunds");
  });

  it("is the projection refundOrder actually reads the order with", async () => {
    await refundOrder({
      db,
      executor: executorReturning(49_900),
      orderId: ORDER_ID,
      amount: 499,
    });

    const read = db.getRow.mock.calls.find((call) => call[1] === "orders");
    expect(read?.[3]).toEqual([ORDER_WITH_REFUNDS_SELECT]);
  });
});

describe("loadOrderRefunds", () => {
  it("queries the refund table by parent order id", async () => {
    await loadOrderRefunds(ORDER_ID, db);

    const [, table, queries] = db.listRows.mock.calls[0] ?? [];
    expect(table).toBe("order_refunds");
    expect(queries.some((q: string) => q.includes(ORDER_ID))).toBe(true);
    expect(queries.some((q: string) => q.includes("lines.*"))).toBe(true);
  });

  it("propagates a read failure instead of reporting no refunds", async () => {
    // An empty list and "the query broke" are the same value to
    // `computeRefundable`; treating the second as the first would let a refund
    // spend the order's full total a second time.
    db.listRows.mockRejectedValueOnce(new Error("appwrite down"));
    await expect(loadOrderRefunds(ORDER_ID, db)).rejects.toThrow(
      "appwrite down"
    );
  });

  it("aborts a refund when the refund history cannot be read", async () => {
    db.listRows.mockRejectedValueOnce(new Error("appwrite down"));
    const executor = executorReturning(49_900);

    await expect(
      refundOrder({ db, executor, orderId: ORDER_ID, amount: 499 })
    ).rejects.toThrow("appwrite down");
    expect(executor.refund).not.toHaveBeenCalled();
  });
});

describe("refundOrder", () => {
  it("refunds a line, records it, and leaves the order paid", async () => {
    const executor = executorReturning(49_900);

    const result = await refundOrder({
      db,
      executor,
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(result).toMatchObject({ ok: true, amount: 499, status: "paid" });
    expect(executor.refund).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinor: 49_900, currency: "NOK" })
    );

    const orderUpdate = db.updateRow.mock.calls.find(
      (call) => call[1] === "orders"
    );
    expect(orderUpdate?.[3]).toMatchObject({
      refunded_total: 499,
      status: "paid",
    });
  });

  it("flips the order to refunded once the full total is returned", async () => {
    const result = await refundOrder({
      db,
      executor: executorReturning(119_700),
      orderId: ORDER_ID,
      amount: 1197,
    });

    expect(result).toMatchObject({ ok: true, status: "refunded" });
    const orderUpdate = db.updateRow.mock.calls.find(
      (call) => call[1] === "orders"
    );
    expect(orderUpdate?.[3]).toMatchObject({ status: "refunded" });
  });

  it("writes the refund row as pending BEFORE calling the provider", async () => {
    const calls: string[] = [];
    db.createRow.mockImplementation((_d: string, table: string) => {
      calls.push(`create:${table}`);
      return Promise.resolve({});
    });
    const executor: RefundExecutor = {
      refund: vi.fn().mockImplementation(() => {
        calls.push("provider");
        return Promise.resolve({ refundedTotalMinor: 49_900, settled: true });
      }),
    };

    await refundOrder({
      db,
      executor,
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(calls[0]).toBe("create:order_refunds");
    expect(calls.indexOf("provider")).toBeGreaterThan(0);
  });

  it("marks the refund failed when the provider definitively rejects it", async () => {
    const rejection = new Error("card_declined");
    rejection.name = "PaymentRefundRejectedError";
    const executor: RefundExecutor = {
      refund: vi.fn().mockRejectedValue(rejection),
    };

    const result = await refundOrder({
      db,
      executor,
      orderId: ORDER_ID,
      amount: 100,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "provider_failed",
      message: "card_declined",
    });
    const failedUpdate = db.updateRow.mock.calls.find(
      (call) => call[1] === "order_refunds" && call[3]?.status === "failed"
    );
    expect(failedUpdate?.[3]).toMatchObject({ error: "card_declined" });
    // The order itself must not move when no money was returned.
    expect(db.updateRow.mock.calls.some((call) => call[1] === "orders")).toBe(
      false
    );
  });

  it("rejects an amount beyond the remaining balance", async () => {
    // Prior refunds are read from the refund table, not off the order row.
    db.listRows.mockResolvedValue({
      rows: [{ $id: "r1", amount: 1000, status: "succeeded", lines: [] }],
    });

    const result = await refundOrder({
      db,
      executor: executorReturning(0),
      orderId: ORDER_ID,
      amount: 500,
    });

    expect(result).toEqual({ ok: false, reason: "amount_exceeds_refundable" });
  });

  it("refuses to refund an authorized (uncaptured) order", async () => {
    db.getRow.mockImplementation(
      orderRowFor(buildOrder({ status: "authorized" }))
    );

    const result = await refundOrder({
      db,
      executor: executorReturning(0),
      orderId: ORDER_ID,
      amount: 100,
    });

    expect(result).toEqual({ ok: false, reason: "order_not_refundable" });
  });

  it("bails out when another caller already holds the refund lock", async () => {
    db.incrementRowColumn.mockResolvedValue({ refund_lock: 2 });
    const executor = executorReturning(0);

    const result = await refundOrder({
      db,
      executor,
      orderId: ORDER_ID,
      amount: 100,
    });

    expect(result).toEqual({ ok: false, reason: "claimed_elsewhere" });
    expect(executor.refund).not.toHaveBeenCalled();
    // The loser undoes its own increment so the lock cannot drift upward.
    expect(db.decrementRowColumn).toHaveBeenCalled();
  });

  it("releases the lock after a successful refund", async () => {
    await refundOrder({
      db,
      executor: executorReturning(49_900),
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: "refund_lock", min: 0 })
    );
  });

  it("restocks refunded quantities only when asked", async () => {
    await refundOrder({
      db,
      executor: executorReturning(49_900),
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
      restock: true,
    });

    expect(db.incrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({
        column: "stock",
        rowId: "product-1",
        value: 1,
      })
    );
  });

  it("does not restock a product that does not track stock", async () => {
    db.getRow.mockImplementation(
      (_d: string, tableId: string, rowId: string) => {
        if (tableId === "orders") {
          return Promise.resolve(buildOrder());
        }
        return Promise.resolve({
          $id: rowId,
          finago_account_number: 3000,
          stock: null,
        });
      }
    );

    await refundOrder({
      db,
      executor: executorReturning(49_900),
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
      restock: true,
    });

    const stockCalls = db.incrementRowColumn.mock.calls.filter(
      (call) => call[0]?.column === "stock"
    );
    expect(stockCalls).toHaveLength(0);
  });

  it("posts a ledger reversal for the refunded revenue accounts", async () => {
    const ledger: LedgerReverser = {
      reverse: vi.fn().mockResolvedValue("rev-tx-1"),
    };

    await refundOrder({
      db,
      executor: executorReturning(49_900),
      ledger,
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(ledger.reverse).toHaveBeenCalledWith(
      expect.objectContaining({
        allocation: [{ accountNumber: 3000, amountMinor: 49_900 }],
        amount: 499,
      })
    );
  });

  it("skips the ledger reversal for a membership order", async () => {
    db.getRow.mockImplementation(
      orderRowFor(buildOrder({ finago_transaction_id: "membership" }))
    );
    const ledger: LedgerReverser = { reverse: vi.fn() };

    await refundOrder({
      db,
      executor: executorReturning(49_900),
      ledger,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(ledger.reverse).not.toHaveBeenCalled();
  });

  it("still succeeds when the ledger reversal throws", async () => {
    const ledger: LedgerReverser = {
      reverse: vi.fn().mockRejectedValue(new Error("24SO down")),
    };

    const result = await refundOrder({
      db,
      executor: executorReturning(49_900),
      ledger,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(result).toMatchObject({ ok: true });
    const errorUpdate = db.updateRow.mock.calls.find((call) =>
      String(call[3]?.error ?? "").includes("Ledger reversal failed")
    );
    expect(errorUpdate).toBeDefined();
  });

  it("returns not_found for a missing order", async () => {
    db.getRow.mockResolvedValue(null);

    const result = await refundOrder({
      db,
      executor: executorReturning(0),
      orderId: "nope",
      amount: 10,
    });

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("refundOrder — uncertain and unsettled provider outcomes", () => {
  it("leaves the attempt pending when the provider outcome is unknown", async () => {
    // A timeout may have been accepted before the response was lost. Marking
    // it failed would release the balance, and a retry mints a fresh
    // idempotency key — refunding the same money twice.
    const executor: RefundExecutor = {
      refund: vi.fn().mockRejectedValue(new Error("socket hang up")),
    };

    const result = await refundOrder({
      db,
      executor,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(result).toMatchObject({ ok: false, reason: "provider_uncertain" });
    const statusWrites = db.updateRow.mock.calls.filter(
      (call) => call[1] === "order_refunds" && call[3]?.status
    );
    expect(statusWrites).toHaveLength(0);
    expect(db.updateRow.mock.calls.some((call) => call[1] === "orders")).toBe(
      false
    );
  });

  it("does not restock or reverse the ledger for an unsettled refund", async () => {
    const ledger: LedgerReverser = { reverse: vi.fn() };
    const executor: RefundExecutor = {
      refund: vi
        .fn()
        .mockResolvedValue({ refundedTotalMinor: 49_900, settled: false }),
    };

    const result = await refundOrder({
      db,
      executor,
      ledger,
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
      restock: true,
    });

    expect(result).toMatchObject({ ok: true, settled: false });
    expect(ledger.reverse).not.toHaveBeenCalled();
    const stockCalls = db.incrementRowColumn.mock.calls.filter(
      (call) => call[0]?.column === "stock"
    );
    expect(stockCalls).toHaveLength(0);
  });

  it("aborts before calling the provider when a line row cannot be written", async () => {
    db.createRow.mockImplementation((_d: string, table: string) => {
      if (table === "order_refund_lines") {
        return Promise.reject(new Error("appwrite write failed"));
      }
      return Promise.resolve({});
    });
    const executor = executorReturning(49_900);

    const result = await refundOrder({
      db,
      executor,
      lines: [{ orderItemId: "line-a", quantity: 1 }],
      orderId: ORDER_ID,
    });

    expect(result).toMatchObject({ ok: false, reason: "lines_not_recorded" });
    // Nothing may reach the provider: the quantity tracking those rows feed
    // would otherwise be lost after the money moved.
    expect(executor.refund).not.toHaveBeenCalled();
  });

  it("refuses to refund when the lock cannot be acquired", async () => {
    db.incrementRowColumn.mockRejectedValueOnce(new Error("appwrite down"));
    const executor = executorReturning(49_900);

    const result = await refundOrder({
      db,
      executor,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(result).toEqual({ ok: false, reason: "claimed_elsewhere" });
    expect(executor.refund).not.toHaveBeenCalled();
  });
});

describe("releaseStaleRefundLock", () => {
  const HELD = { $id: ORDER_ID, $updatedAt: "", refund_lock: 1 };

  it("clears a lock on a row untouched for longer than the window", async () => {
    // Without this, a lock stranded by a crashed process blocks the order's
    // refunds forever: every later attempt bumps to 2, loses, drops back to 1.
    const released = await releaseStaleRefundLock(
      { ...HELD, $updatedAt: new Date(1000).toISOString() } as never,
      db,
      1000 + 16 * 60 * 1000
    );
    expect(released).toBe(true);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "orders",
      ORDER_ID,
      expect.objectContaining({ refund_lock: 0 })
    );
  });

  it("leaves a freshly-touched lock alone", async () => {
    const released = await releaseStaleRefundLock(
      { ...HELD, $updatedAt: new Date(1000).toISOString() } as never,
      db,
      1000 + 60 * 1000
    );
    expect(released).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("does nothing when no lock is held", async () => {
    const released = await releaseStaleRefundLock(
      { ...HELD, refund_lock: 0 } as never,
      db,
      Date.now()
    );
    expect(released).toBe(false);
  });
});

describe("settlePendingRefund", () => {
  const pendingRefund = {
    $id: "refund-1",
    amount: 499,
    lines: [{ name: "Campus hoodie", order_item: "line-a", quantity: 1 }],
    provider_refund_id: "re_123",
    restock: true,
    status: "pending" as const,
  };

  it("runs the deferred effects once the provider settles it", async () => {
    const ledger: LedgerReverser = {
      reverse: vi.fn().mockResolvedValue("rev-1"),
    };

    const outcome = await settlePendingRefund({
      db,
      ledger,
      order: buildOrder() as never,
      refund: pendingRefund,
      resolver: {
        state: vi.fn().mockResolvedValue({
          failed: false,
          refundedTotalMinor: 49_900,
          settled: true,
        }),
      },
    });

    expect(outcome).toBe("settled");
    const succeeded = db.updateRow.mock.calls.find(
      (call) => call[1] === "order_refunds" && call[3]?.status === "succeeded"
    );
    expect(succeeded).toBeDefined();
    // The effects the pending branch deferred must now actually happen.
    expect(ledger.reverse).toHaveBeenCalled();
    expect(db.incrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: "stock" })
    );
  });

  it("releases the balance when the provider reports failure", async () => {
    const outcome = await settlePendingRefund({
      db,
      order: buildOrder() as never,
      refund: pendingRefund,
      resolver: {
        state: vi.fn().mockResolvedValue({
          failed: true,
          refundedTotalMinor: 0,
          settled: false,
        }),
      },
    });

    expect(outcome).toBe("failed");
    const failed = db.updateRow.mock.calls.find(
      (call) => call[1] === "order_refunds" && call[3]?.status === "failed"
    );
    expect(failed).toBeDefined();
  });

  it("keeps it pending when the provider cannot be reached", async () => {
    // Guessing "failed" here would release the balance for a refund that may
    // yet land, letting the same money be refunded twice.
    const outcome = await settlePendingRefund({
      db,
      order: buildOrder() as never,
      refund: pendingRefund,
      resolver: {
        state: vi.fn().mockRejectedValue(new Error("stripe unreachable")),
      },
    });

    expect(outcome).toBe("unresolved");
    expect(
      db.updateRow.mock.calls.some((call) => call[3]?.status === "failed")
    ).toBe(false);
  });
});

describe("settlePendingRefund — concurrency and bookkeeping", () => {
  const pending = {
    $id: "refund-1",
    amount: 499,
    lines: [{ name: "Campus hoodie", order_item: "line-a", quantity: 1 }],
    provider_refund_id: "re_123",
    restock: true,
    status: "pending" as const,
  };
  const settledResolver = {
    state: vi.fn().mockResolvedValue({
      failed: false,
      refundedTotalMinor: 49_900,
      settled: true,
    }),
  };

  it("does not run the effects when it loses the order's refund lock", async () => {
    // Two overlapping sweeps must not both restock and both post a reversal.
    db.incrementRowColumn.mockResolvedValue({ refund_lock: 2 });
    const ledger: LedgerReverser = { reverse: vi.fn() };

    const outcome = await settlePendingRefund({
      db,
      ledger,
      order: buildOrder() as never,
      refund: pending,
      resolver: settledResolver,
    });

    expect(outcome).toBe("still_pending");
    expect(ledger.reverse).not.toHaveBeenCalled();
  });

  it("leaves the row pending when the succeeded write fails, so effects do not half-run", async () => {
    // The status flip is the claim on the effects; swallowing its failure
    // would run them and let the next sweep run them again.
    db.updateRow.mockImplementation((_d: string, table: string, _id, data) => {
      if (table === "order_refunds" && data?.status === "succeeded") {
        return Promise.reject(new Error("appwrite write failed"));
      }
      return Promise.resolve({});
    });
    const ledger: LedgerReverser = { reverse: vi.fn() };

    await expect(
      settlePendingRefund({
        db,
        ledger,
        order: buildOrder() as never,
        refund: pending,
        resolver: settledResolver,
      })
    ).rejects.toThrow("appwrite write failed");

    expect(ledger.reverse).not.toHaveBeenCalled();
  });

  it("releases the order lock even when finalization throws", async () => {
    db.updateRow.mockImplementation((_d: string, table: string, _id, data) => {
      if (table === "order_refunds" && data?.status === "succeeded") {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve({});
    });

    await settlePendingRefund({
      db,
      order: buildOrder() as never,
      refund: pending,
      resolver: settledResolver,
    }).catch(() => undefined);

    expect(db.decrementRowColumn).toHaveBeenCalledWith(
      expect.objectContaining({ column: "refund_lock" })
    );
  });
});

describe("hasUnrecordedReversal", () => {
  it("is true when a prior reversal posted without recording its allocation", () => {
    // The dangerous combination: money returned to accounts we can no longer
    // identify, so remaining balances are unknowable.
    expect(
      hasUnrecordedReversal({
        refunds: [
          {
            $id: "r1",
            amount: 100,
            finago_transaction_id: "tx-1",
            status: "succeeded",
          },
        ],
      } as never)
    ).toBe(true);
  });

  it("is false once the allocation is recorded", () => {
    expect(
      hasUnrecordedReversal({
        refunds: [
          {
            $id: "r1",
            amount: 100,
            finago_transaction_id: "tx-1",
            ledger_allocation: "[]",
            status: "succeeded",
          },
        ],
      } as never)
    ).toBe(false);
  });

  it("is false for a refund that never posted a reversal", () => {
    expect(
      hasUnrecordedReversal({
        refunds: [{ $id: "r1", amount: 100, status: "succeeded" }],
      } as never)
    ).toBe(false);
  });

  it("skips the ledger reversal rather than over-reversing", async () => {
    db.getRow.mockImplementation(
      orderRowFor(buildOrder({ finago_transaction_id: "tx-order" }))
    );
    db.listRows.mockResolvedValue({
      rows: [
        {
          $id: "r0",
          amount: 100,
          finago_transaction_id: "tx-1",
          status: "succeeded",
        },
      ],
    });
    const ledger: LedgerReverser = { reverse: vi.fn() };

    const result = await refundOrder({
      db,
      executor: executorReturning(49_900),
      ledger,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(result).toMatchObject({ ok: true });
    expect(ledger.reverse).not.toHaveBeenCalled();
  });
});
