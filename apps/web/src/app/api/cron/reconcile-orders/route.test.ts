import { createAdminClient } from "@repo/api/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
  reconcileVippsPayment: vi.fn(),
  releaseStaleFinagoClaim: vi.fn(),
  releaseStaleMembershipClaim: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@repo/payment/vipps", () => ({
  reconcileVippsPayment: mocks.reconcileVippsPayment,
}));
vi.mock("@repo/shared/utils/finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
  releaseStaleFinagoClaim: mocks.releaseStaleFinagoClaim,
}));
vi.mock("@repo/shared/utils/membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
  releaseStaleMembershipClaim: mocks.releaseStaleMembershipClaim,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);

const db = {
  decrementRowColumn: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

function membershipOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    items_json: JSON.stringify([
      {
        product_id: "71",
        product_type: "membership",
        quantity: 1,
        unit_price: 550,
      },
    ]),
    membership_fulfilment_lock: 0,
    membership_invoice_id: null,
    status: "paid",
    ...overrides,
  };
}

// Only the membership-invoice sweep's listRows call should resolve to test
// rows; the payment-reconcile (x2 statuses) and Finago sweeps run first in
// `handle` and must see no rows so they don't interfere with the assertions.
function wireListRows(membershipRows: unknown[]) {
  db.listRows.mockImplementation(
    (_dbId: string, _tableId: string, queries: string[]) => {
      const isMembershipSweep = queries.some((q) =>
        q.includes("membership_invoice_id")
      );
      return Promise.resolve({ rows: isMembershipSweep ? membershipRows : [] });
    }
  );
}

function cronRequest(): Request {
  return new Request("https://web.biso.no/api/cron/reconcile-orders");
}

describe("reconcile-orders cron: membership sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `delete` on process.env is flagged by lint/performance/noDelete, and its
    // suggested "= undefined" fix is wrong here: Node coerces env assignments
    // to strings, so CRON_SECRET would become the literal string "undefined"
    // (truthy) instead of being unset.
    Reflect.deleteProperty(process.env, "CRON_SECRET");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.isMembershipOrder.mockReturnValue(true);
    mocks.releaseStaleMembershipClaim.mockResolvedValue(false);
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
    mocks.releaseStaleFinagoClaim.mockResolvedValue(false);
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
    mocks.reconcileVippsPayment.mockResolvedValue(undefined);
  });

  it("fulfils a paid membership order that has no invoice id", async () => {
    const order = membershipOrder();
    wireListRows([order]);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: true,
      invoiceId: 556_677,
    });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.releaseStaleMembershipClaim).toHaveBeenCalledWith(order, db);
    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(body.membershipFulfilled).toBe(1);
    expect(body.membershipClaimsReleased).toBe(0);
  });

  it("releases a stale claim and defers fulfilment to the next sweep", async () => {
    const order = membershipOrder({ membership_fulfilment_lock: 1 });
    wireListRows([order]);
    mocks.releaseStaleMembershipClaim.mockResolvedValue(true);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.releaseStaleMembershipClaim).toHaveBeenCalledWith(order, db);
    // A released claim is retried on a later sweep, not immediately in the
    // same pass — mirrors sweepMissingFinagoPostings.
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipClaimsReleased).toBe(1);
    expect(body.membershipFulfilled).toBe(0);
  });

  it("skips a row whose claim is live rather than probing it", async () => {
    const order = membershipOrder({ membership_fulfilment_lock: 1 });
    wireListRows([order]);
    // Not stale (releaseStaleMembershipClaim returns false) but the lock is
    // still held — this is the "live claim held by an active fulfiller" case.
    mocks.releaseStaleMembershipClaim.mockResolvedValue(false);

    const response = await GET(cronRequest());
    const body = await response.json();

    // fulfilMembershipOrder must never be called for a live claim: calling it
    // would touch the row and refresh $updatedAt, preventing a crashed claim
    // from ever ageing out via releaseStaleMembershipClaim.
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipFulfilled).toBe(0);
    expect(body.membershipClaimsReleased).toBe(0);
  });
});
