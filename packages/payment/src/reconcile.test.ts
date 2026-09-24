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

    expect(tally).toEqual({ errors: 1, failed: 0, settled: 0, stillPending: 0, unresolved: 0 });
    expect(mocks.settlePendingRefund).not.toHaveBeenCalled();
  });

  it("counts a missing order as unresolved", async () => {
    getRow.mockRejectedValue(appwriteError(404));

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({ errors: 0, failed: 0, settled: 0, stillPending: 0, unresolved: 1 });
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

    expect(tally).toEqual({ errors: 0, failed: 0, settled: 1, stillPending: 0, unresolved: 0 });
  });

  it("counts a refund still processing as pending, not an error", async () => {
    getRow.mockResolvedValue({ $id: "order-1" });
    mocks.settlePendingRefund.mockResolvedValue("still_pending");

    const tally = await sweepPendingRefunds(db, new Date().toISOString());

    expect(tally).toEqual({ errors: 0, failed: 0, settled: 0, stillPending: 1, unresolved: 0 });
  });
});
