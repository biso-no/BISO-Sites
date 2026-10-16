import { describe, expect, it } from "vitest";
import { type RevenueTarget, revenueTargetKey } from "./finago-shop-accounting";
import {
  allocateAmountAcrossTargets,
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

describe("buildRefundLines — duplicate entries", () => {
  it("sums duplicate entries for one item into a single line", () => {
    // Two entries each within the remaining quantity would otherwise both pass
    // validation independently and together over-refund (and double-restock).
    const lines = buildRefundLines(
      [
        { orderItemId: "line-a", quantity: 1 },
        { orderItemId: "line-a", quantity: 1 },
      ],
      items
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(2);
    expect(lines[0]?.amount).toBe(998);
  });

  it("lets validation reject the aggregate when it exceeds what is left", () => {
    const summary = computeRefundable(order, items, [
      {
        amount: 499,
        status: "succeeded",
        lines: [{ orderItemId: "line-a", quantity: 1 }],
      },
    ]);
    const lines = buildRefundLines(
      [
        { orderItemId: "line-a", quantity: 1 },
        { orderItemId: "line-a", quantity: 1 },
      ],
      items
    );
    expect(
      validateRefundRequest({
        amountMinor: 99_800,
        lines,
        status: "paid",
        summary,
      })
    ).toEqual({ ok: false, error: "amount_exceeds_refundable" });
  });
});

describe("computeRefundable — provider aggregate", () => {
  it("caps the balance with the stored provider total", () => {
    // A refund issued straight from the Stripe dashboard has no local row, so
    // summing local rows alone would offer money already returned.
    const summary = computeRefundable(
      { refundedTotal: 1000, total: 1197 },
      items,
      []
    );
    expect(summary.refundable).toBe(197);
  });

  it("keeps the larger local sum when it exceeds the stored total", () => {
    const summary = computeRefundable(
      { refundedTotal: 100, total: 1197 },
      items,
      [{ amount: 499, status: "succeeded" }]
    );
    expect(summary.refundable).toBe(698);
  });
});

const HOODIE: RevenueTarget = {
  accountNumber: 3000,
  departmentId: "44",
  vatCode: 3,
};
const CAP: RevenueTarget = {
  accountNumber: 3010,
  departmentId: "44",
  vatCode: 3,
};

describe("allocateAmountAcrossTargets", () => {
  const targetByItemId = { "line-a": HOODIE, "line-b": CAP };

  it("maps line refunds straight onto their targets", () => {
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 49_900,
      items,
      lines: buildRefundLines([{ orderItemId: "line-a", quantity: 1 }], items),
      targetByItemId,
    });
    expect(allocation).toEqual([{ ...HOODIE, amountMinor: 49_900 }]);
  });

  it("splits a free-amount refund proportionally and sums back exactly", () => {
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 10_000,
      items,
      lines: [],
      targetByItemId,
    });
    expect(allocation).toEqual([
      { ...HOODIE, amountMinor: 8338 },
      { ...CAP, amountMinor: 1662 },
    ]);
  });

  it("keeps the same account apart per department", () => {
    const twoDepartments: RefundableOrderItem[] = [
      { id: "line-a", name: "A", quantity: 1, unitPrice: 50 },
      { id: "line-b", name: "B", quantity: 1, unitPrice: 50 },
    ];
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 10_000,
      items: twoDepartments,
      lines: [],
      targetByItemId: {
        "line-a": HOODIE,
        "line-b": { ...HOODIE, departmentId: "16" },
      },
    });
    expect(allocation).toEqual([
      { ...HOODIE, departmentId: "16", amountMinor: 5000 },
      { ...HOODIE, amountMinor: 5000 },
    ]);
  });

  it("returns nothing when no line has a target", () => {
    expect(
      allocateAmountAcrossTargets({
        amountMinor: 10_000,
        items,
        lines: [],
        targetByItemId: {},
      })
    ).toEqual([]);
  });
});

describe("allocateAmountAcrossTargets — remaining balance", () => {
  const evenItems: RefundableOrderItem[] = [
    { id: "line-a", name: "A", quantity: 1, unitPrice: 50 },
    { id: "line-b", name: "B", quantity: 1, unitPrice: 50 },
  ];
  const targetByItemId = { "line-a": HOODIE, "line-b": CAP };

  it("sends a free-amount refund to the targets not yet reversed", () => {
    const allocation = allocateAmountAcrossTargets({
      alreadyReversedByTarget: { [revenueTargetKey(HOODIE)]: 5000 },
      amountMinor: 5000,
      items: evenItems,
      lines: [],
      targetByItemId,
    });
    expect(allocation).toEqual([{ ...CAP, amountMinor: 5000 }]);
  });

  it("free refund first, then a line refund, never over-reverses a target", () => {
    const free = allocateAmountAcrossTargets({
      amountMinor: 5000,
      items: evenItems,
      lines: [],
      targetByItemId,
    });
    expect(free).toEqual([
      { ...HOODIE, amountMinor: 2500 },
      { ...CAP, amountMinor: 2500 },
    ]);

    const then = allocateAmountAcrossTargets({
      alreadyReversedByTarget: {
        [revenueTargetKey(HOODIE)]: 2500,
        [revenueTargetKey(CAP)]: 2500,
      },
      amountMinor: 5000,
      items: evenItems,
      lines: buildRefundLines(
        [{ orderItemId: "line-a", quantity: 1 }],
        evenItems
      ),
      targetByItemId,
    });
    const forHoodie =
      then.find((entry) => entry.accountNumber === 3000)?.amountMinor ?? 0;
    expect(forHoodie).toBe(2500);
    expect(then.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(5000);
  });

  it("never reverses more than a target was credited", () => {
    expect(
      allocateAmountAcrossTargets({
        alreadyReversedByTarget: {
          [revenueTargetKey(HOODIE)]: 5000,
          [revenueTargetKey(CAP)]: 5000,
        },
        amountMinor: 5000,
        items: evenItems,
        lines: [],
        targetByItemId,
      })
    ).toEqual([]);
  });

  it("never charges another line's target for a line with none", () => {
    expect(
      allocateAmountAcrossTargets({
        amountMinor: 5000,
        items: evenItems,
        lines: buildRefundLines(
          [{ orderItemId: "line-b", quantity: 1 }],
          evenItems
        ),
        targetByItemId: { "line-a": HOODIE, "line-b": null },
      })
    ).toEqual([]);
  });
});
