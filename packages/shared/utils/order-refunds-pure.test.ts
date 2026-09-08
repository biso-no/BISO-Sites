import { describe, expect, it } from "vitest";
import {
  allocateAmountAcrossAccounts,
  buildRefundLines,
  computeRefundable,
  isPartiallyRefunded,
  type RecordedRefund,
  type RefundableOrderItem,
  statusAfterRefund,
  validateRefundRequest,
} from "./order-refunds-pure";

const items: RefundableOrderItem[] = [
  {
    id: "line-a",
    name: "Hoodie",
    productId: "p1",
    quantity: 2,
    unitPrice: 499,
  },
  { id: "line-b", name: "Cap", productId: "p2", quantity: 1, unitPrice: 199 },
];

const order = { total: 1197 };

describe("computeRefundable", () => {
  it("returns the full total when nothing has been refunded", () => {
    const summary = computeRefundable(order, items, []);
    expect(summary.refundable).toBe(1197);
    expect(summary.refundableQuantityByItem).toEqual({
      "line-a": 2,
      "line-b": 1,
    });
  });

  it("subtracts succeeded refunds from the balance and the line quantities", () => {
    const refunds: RecordedRefund[] = [
      {
        amount: 499,
        status: "succeeded",
        lines: [{ orderItemId: "line-a", quantity: 1 }],
      },
    ];
    const summary = computeRefundable(order, items, refunds);
    expect(summary.refundable).toBe(698);
    expect(summary.refundableQuantityByItem["line-a"]).toBe(1);
    expect(summary.refundableQuantityByItem["line-b"]).toBe(1);
  });

  it("holds the balance for a pending refund, since money may be in flight", () => {
    const summary = computeRefundable(order, items, [
      { amount: 199, status: "pending", lines: [] },
    ]);
    expect(summary.refundable).toBe(998);
  });

  it("releases the balance of a failed refund", () => {
    const summary = computeRefundable(order, items, [
      { amount: 199, status: "failed", lines: [] },
    ]);
    expect(summary.refundable).toBe(1197);
  });

  it("never reports a negative balance when over-refunded externally", () => {
    const summary = computeRefundable(order, items, [
      { amount: 2000, status: "succeeded" },
    ]);
    expect(summary.refundable).toBe(0);
    expect(summary.refundableMinor).toBe(0);
  });
});

describe("buildRefundLines", () => {
  it("expands quantities into amounts", () => {
    const lines = buildRefundLines(
      [{ orderItemId: "line-a", quantity: 2 }],
      items
    );
    expect(lines).toEqual([
      {
        amount: 998,
        name: "Hoodie",
        orderItemId: "line-a",
        productId: "p1",
        quantity: 2,
      },
    ]);
  });

  it("drops unknown items and non-positive quantities", () => {
    const lines = buildRefundLines(
      [
        { orderItemId: "gone", quantity: 1 },
        { orderItemId: "line-b", quantity: 0 },
        { orderItemId: "line-b", quantity: 1 },
      ],
      items
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.orderItemId).toBe("line-b");
  });
});

describe("validateRefundRequest", () => {
  const summary = computeRefundable(order, items, []);

  it("accepts a refund within the balance", () => {
    expect(
      validateRefundRequest({
        amountMinor: 49_900,
        lines: [],
        status: "paid",
        summary,
      })
    ).toEqual({ ok: true });
  });

  it("accepts refunding the exact remaining balance built from summed doubles", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; comparing in minor units is
    // what keeps a "refund the rest" request from failing its own check.
    const pennyOrder = { total: 0.3 };
    const pennyItems: RefundableOrderItem[] = [
      { id: "l", name: "x", quantity: 3, unitPrice: 0.1 },
    ];
    const pennySummary = computeRefundable(pennyOrder, pennyItems, []);
    expect(
      validateRefundRequest({
        amountMinor: pennySummary.refundableMinor,
        lines: [],
        status: "paid",
        summary: pennySummary,
      })
    ).toEqual({ ok: true });
  });

  it("rejects an amount over the remaining balance", () => {
    expect(
      validateRefundRequest({
        amountMinor: 119_800,
        lines: [],
        status: "paid",
        summary,
      })
    ).toEqual({ ok: false, error: "amount_exceeds_refundable" });
  });

  it("rejects a non-positive amount", () => {
    expect(
      validateRefundRequest({
        amountMinor: 0,
        lines: [],
        status: "paid",
        summary,
      })
    ).toEqual({ ok: false, error: "amount_not_positive" });
  });

  it("rejects an authorized (uncaptured) order — that is a cancellation", () => {
    expect(
      validateRefundRequest({
        amountMinor: 100,
        lines: [],
        status: "authorized",
        summary,
      })
    ).toEqual({ ok: false, error: "order_not_refundable" });
  });

  it("rejects a line quantity beyond what is left on that line", () => {
    const partial = computeRefundable(order, items, [
      {
        amount: 499,
        status: "succeeded",
        lines: [{ orderItemId: "line-a", quantity: 1 }],
      },
    ]);
    // The amount stays inside the remaining 698 balance, so only the per-line
    // check can catch that line-a has just one unit left, not two.
    expect(
      validateRefundRequest({
        amountMinor: 69_800,
        lines: [
          {
            amount: 698,
            name: "Hoodie",
            orderItemId: "line-a",
            quantity: 2,
          },
        ],
        status: "paid",
        summary: partial,
      })
    ).toEqual({ ok: false, error: "line_quantity_exceeds_refundable" });
  });
});

describe("allocateAmountAcrossAccounts", () => {
  const accountByItemId = { "line-a": 3000, "line-b": 3010 };

  it("maps line refunds straight onto their product accounts", () => {
    const allocation = allocateAmountAcrossAccounts({
      accountByItemId,
      amountMinor: 49_900,
      items,
      lines: buildRefundLines([{ orderItemId: "line-a", quantity: 1 }], items),
    });
    expect(allocation).toEqual([{ accountNumber: 3000, amountMinor: 49_900 }]);
  });

  it("splits a free-amount refund proportionally and sums back exactly", () => {
    const allocation = allocateAmountAcrossAccounts({
      accountByItemId,
      amountMinor: 10_000,
      items,
      lines: [],
    });
    const sum = allocation.reduce((acc, line) => acc + line.amountMinor, 0);
    expect(sum).toBe(10_000);
    // line-a is 998/1197 of the order, line-b 199/1197. Both shares floor to
    // .5, so the 1 øre rounding remainder lands on the larger share.
    expect(allocation.find((l) => l.accountNumber === 3000)?.amountMinor).toBe(
      8338
    );
    expect(allocation.find((l) => l.accountNumber === 3010)?.amountMinor).toBe(
      1662
    );
  });

  it("returns nothing when no line has a ledger account", () => {
    expect(
      allocateAmountAcrossAccounts({
        accountByItemId: {},
        amountMinor: 10_000,
        items,
        lines: [],
      })
    ).toEqual([]);
  });
});

describe("statusAfterRefund", () => {
  it("stays paid while a balance remains", () => {
    expect(statusAfterRefund(119_700, 49_900)).toBe("paid");
  });

  it("flips to refunded once the full amount is returned", () => {
    expect(statusAfterRefund(119_700, 119_700)).toBe("refunded");
  });

  it("treats an over-refund as fully refunded", () => {
    expect(statusAfterRefund(119_700, 130_000)).toBe("refunded");
  });
});

describe("isPartiallyRefunded", () => {
  it("is true between zero and the total", () => {
    expect(isPartiallyRefunded({ refunded_total: 499, total: 1197 })).toBe(
      true
    );
  });

  it("is false at zero and at the full total", () => {
    expect(isPartiallyRefunded({ refunded_total: 0, total: 1197 })).toBe(false);
    expect(isPartiallyRefunded({ refunded_total: 1197, total: 1197 })).toBe(
      false
    );
  });
});
