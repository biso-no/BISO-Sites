import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPendingRefunds: vi.fn(),
  loadOrderRefunds: vi.fn(),
  reconcileVippsPayment: vi.fn(),
  resolveStripeCredentials: vi.fn(),
  settlePendingRefund: vi.fn(),
}));

vi.mock("@repo/shared/utils/finago-refund-reverser", () => ({
  finagoRefundReverser: { reverse: vi.fn() },
}));
vi.mock("@repo/shared/utils/order-refunds", () => ({
  listPendingRefunds: mocks.listPendingRefunds,
  loadOrderRefunds: mocks.loadOrderRefunds,
  ORDER_WITH_REFUNDS_SELECT: "select",
  settlePendingRefund: mocks.settlePendingRefund,
}));
vi.mock("@repo/shared/utils/vipps-order-ops", () => ({
  applyOrderStatusTransition: vi.fn(),
}));
vi.mock("./credentials", () => ({
  resolveStripeCredentials: mocks.resolveStripeCredentials,
}));
vi.mock("./stripe", () => ({
  getStripeReceiptUrl: vi.fn(),
  getStripeRefundedTotal: vi.fn(),
  getStripeRefundState: vi.fn(),
  getStripeSession: vi.fn(),
  hasStripePaymentFailed: vi.fn(),
}));
vi.mock("./vipps", () => ({
  reconcileVippsPayment: mocks.reconcileVippsPayment,
}));

const { reconcileOrderPayment, sweepPendingRefunds } = await import(
  "./reconcile"
);

function appwriteError(code: number, message = `error ${code}`) {
  return Object.assign(new Error(message), { code });
}

const getRow = vi.fn();
const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow,
  listRows: vi.fn(),
  updateRow: vi.fn(),
} as never;

beforeEach(() => {
  for (const fn of Object.values(mocks)) {
    fn.mockReset();
  }
  getRow.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("reconcileOrderPayment", () => {
  it("is a quiet no-op when the order does not exist", async () => {
    getRow.mockRejectedValue(appwriteError(404));

    await expect(reconcileOrderPayment("order-1", db)).resolves.toBeUndefined();
    expect(mocks.reconcileVippsPayment).not.toHaveBeenCalled();
  });

  it("throws when the order read fails for any other reason", async () => {
    getRow.mockRejectedValue(appwriteError(503, "Service unavailable"));

    await expect(reconcileOrderPayment("order-1", db)).rejects.toThrow(
      "Service unavailable"
    );
  });

  it("reconciles a Vipps order", async () => {
    getRow.mockResolvedValue({
      payment_provider: "vipps",
      payment_session_id: "order-1",
    });

    await reconcileOrderPayment("order-1", db);

    expect(mocks.reconcileVippsPayment).toHaveBeenCalledWith("order-1", db);
  });
});

describe("sweepPendingRefunds", () => {
  const refund = { $id: "refund-1", order: "order-1" };

  beforeEach(() => {
    mocks.listPendingRefunds.mockResolvedValue([refund]);
    mocks.resolveStripeCredentials.mockResolvedValue(null);
    mocks.loadOrderRefunds.mockResolvedValue([]);
  });

  it("counts an order read outage as an error, not unresolved", async () => {
    getRow.mockRejectedValue(appwriteError(500));

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({
      errors: 1,
      failed: 0,
      settled: 0,
      stillPending: 0,
      unresolved: 0,
    });
    expect(mocks.settlePendingRefund).not.toHaveBeenCalled();
  });

  it("counts a missing order as unresolved", async () => {
    getRow.mockRejectedValue(appwriteError(404));

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({
      errors: 0,
      failed: 0,
      settled: 0,
      stillPending: 0,
      unresolved: 1,
    });
  });

  it("counts a refund-history read failure as an error", async () => {
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.loadOrderRefunds.mockRejectedValue(appwriteError(503));

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally.errors).toBe(1);
    expect(tally.unresolved).toBe(0);
  });

  it("counts a settlement that throws as an error", async () => {
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.settlePendingRefund.mockRejectedValue(
      new Error("status flip failed")
    );

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally.errors).toBe(1);
  });

  it("tallies settlement outcomes", async () => {
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.settlePendingRefund.mockResolvedValue("settled");

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({
      errors: 0,
      failed: 0,
      settled: 1,
      stillPending: 0,
      unresolved: 0,
    });
  });

  it("counts a refund still processing as pending, not an error", async () => {
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.settlePendingRefund.mockResolvedValue("still_pending");

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({
      errors: 0,
      failed: 0,
      settled: 0,
      stillPending: 1,
      unresolved: 0,
    });
  });
});

const stripe = await import("./stripe");
const { finagoRefundReverser } = await import(
  "@repo/shared/utils/finago-refund-reverser"
);

describe("sweepPendingRefunds, pinned before its complexity is split up", () => {
  const creds = { secretKey: "sk_test_x" };

  beforeEach(() => {
    mocks.loadOrderRefunds.mockResolvedValue([{ $id: "earlier" }]);
    vi.mocked(stripe.getStripeRefundState).mockReset();
    vi.mocked(stripe.getStripeRefundedTotal).mockReset();
  });

  it("tallies each outcome across refunds", async () => {
    mocks.listPendingRefunds.mockResolvedValue(
      ["a", "b", "c", "d"].map((id) => ({ $id: id, order: "order-1" }))
    );
    mocks.resolveStripeCredentials.mockResolvedValue(null);
    getRow.mockResolvedValue({ $id: "order-1" });
    for (const outcome of [
      "failed",
      "settled",
      "still_pending",
      "unresolved",
    ]) {
      mocks.settlePendingRefund.mockResolvedValueOnce(outcome);
    }

    const tally = await sweepPendingRefunds(db, "2026-01-01T00:00:00.000Z");

    expect(tally).toEqual({
      errors: 0,
      failed: 1,
      settled: 1,
      stillPending: 1,
      unresolved: 1,
    });
  });

  it("counts a refund with no order as unresolved without reading", async () => {
    mocks.listPendingRefunds.mockResolvedValue([{ $id: "a", order: null }]);
    mocks.resolveStripeCredentials.mockResolvedValue(null);

    const tally = await sweepPendingRefunds(db, "2026-01-01T00:00:00.000Z");

    expect(tally.unresolved).toBe(1);
    expect(getRow).not.toHaveBeenCalled();
    expect(mocks.settlePendingRefund).not.toHaveBeenCalled();
  });

  it("reads an expanded order relation and settles with its history", async () => {
    const refund = { $id: "a", order: { $id: "order-9" } };
    mocks.listPendingRefunds.mockResolvedValue([refund]);
    mocks.resolveStripeCredentials.mockResolvedValue(null);
    getRow.mockResolvedValue({ $id: "order-9" });
    mocks.settlePendingRefund.mockResolvedValue("settled");

    await sweepPendingRefunds(db, "2026-01-01T00:00:00.000Z");

    expect(getRow.mock.calls[0]?.[2]).toBe("order-9");
    expect(getRow.mock.calls[0]?.[3]).toEqual(["select"]);
    expect(mocks.loadOrderRefunds).toHaveBeenCalledWith("order-9", db);
    const args = mocks.settlePendingRefund.mock.calls[0]?.[0];
    expect(args.db).toBe(db);
    expect(args.ledger).toBe(finagoRefundReverser);
    expect(args.refund).toBe(refund);
    expect(args.order).toEqual({
      $id: "order-9",
      refunds: [{ $id: "earlier" }],
    });
  });

  async function resolverFor(credentials: unknown) {
    mocks.listPendingRefunds.mockResolvedValue([
      { $id: "a", order: "order-1" },
    ]);
    mocks.resolveStripeCredentials.mockResolvedValue(credentials);
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.settlePendingRefund.mockResolvedValue("settled");
    await sweepPendingRefunds(db, "2026-01-01T00:00:00.000Z");
    return mocks.settlePendingRefund.mock.calls[0]?.[0].resolver as {
      state: (input: {
        paymentIntentId?: string | null;
        providerRefundId?: string | null;
      }) => Promise<unknown>;
    };
  }

  it("refuses to guess without Stripe credentials or a refund id", async () => {
    const noCreds = await resolverFor(null);
    await expect(
      noCreds.state({ paymentIntentId: "pi_1", providerRefundId: "re_1" })
    ).rejects.toThrow("No resolvable provider refund id");

    mocks.settlePendingRefund.mockClear();
    const noId = await resolverFor(creds);
    await expect(
      noId.state({ paymentIntentId: "pi_1", providerRefundId: null })
    ).rejects.toThrow("No resolvable provider refund id");
    expect(stripe.getStripeRefundState).not.toHaveBeenCalled();
  });

  it("asks Stripe for the refund and the payment's refunded total", async () => {
    vi.mocked(stripe.getStripeRefundState).mockResolvedValue({
      status: "succeeded",
    } as never);
    vi.mocked(stripe.getStripeRefundedTotal).mockResolvedValue(500);
    const resolver = await resolverFor(creds);

    await expect(
      resolver.state({ paymentIntentId: "pi_1", providerRefundId: "re_1" })
    ).resolves.toEqual({ refundedTotalMinor: 500, status: "succeeded" });
    expect(stripe.getStripeRefundState).toHaveBeenCalledWith("re_1", creds);
    expect(stripe.getStripeRefundedTotal).toHaveBeenCalledWith("pi_1", creds);
  });

  it("reports a zero total when Stripe's total fails or there is no payment", async () => {
    vi.mocked(stripe.getStripeRefundState).mockResolvedValue({
      status: "pending",
    } as never);
    vi.mocked(stripe.getStripeRefundedTotal).mockRejectedValue(new Error("x"));
    const resolver = await resolverFor(creds);

    await expect(
      resolver.state({ paymentIntentId: "pi_1", providerRefundId: "re_1" })
    ).resolves.toEqual({ refundedTotalMinor: 0, status: "pending" });

    vi.mocked(stripe.getStripeRefundedTotal).mockClear();
    await expect(
      resolver.state({ paymentIntentId: null, providerRefundId: "re_1" })
    ).resolves.toEqual({ refundedTotalMinor: 0, status: "pending" });
    expect(stripe.getStripeRefundedTotal).not.toHaveBeenCalled();
  });
});
