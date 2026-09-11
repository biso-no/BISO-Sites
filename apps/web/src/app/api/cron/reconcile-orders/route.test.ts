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
  stampNonMembershipOrder: vi.fn(),
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
  stampNonMembershipOrder: mocks.stampNonMembershipOrder,
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

const OLD_CREATED_AT = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function shopOrder(id: string) {
  return {
    $id: id,
    $createdAt: OLD_CREATED_AT,
    $updatedAt: OLD_CREATED_AT,
    status: "paid",
    items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
    membership_invoice_id: null,
    membership_fulfilment_lock: 0,
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
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.isMembershipOrder.mockImplementation(
      (order: { items_json?: string | null }) =>
        (order.items_json ?? "").includes('"product_type":"membership"')
    );
    mocks.releaseStaleMembershipClaim.mockResolvedValue(false);
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
    mocks.releaseStaleFinagoClaim.mockResolvedValue(false);
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
    mocks.reconcileVippsPayment.mockResolvedValue(undefined);
    db.updateRow.mockResolvedValue({});
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

describe("reconcile-orders cron: membership recovery under crowding (C4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(process.env, "CRON_SECRET");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    mockedCreateAdminClient.mockResolvedValue({ db } as never);
    mocks.isMembershipOrder.mockImplementation(
      (order: { items_json?: string | null }) =>
        (order.items_json ?? "").includes('"product_type":"membership"')
    );
    mocks.releaseStaleMembershipClaim.mockResolvedValue(false);
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: true });
    mocks.releaseStaleFinagoClaim.mockResolvedValue(false);
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
    mocks.reconcileVippsPayment.mockResolvedValue(undefined);
    db.updateRow.mockResolvedValue({});
  });

  it("reaches and fulfils a membership order present alongside 50 old paid shop orders in one page", async () => {
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    const theMembershipOrder = membershipOrder();

    wireListRows([...shopOrders, theMembershipOrder]);

    const response = await GET(cronRequest());
    const body = (await response.json()) as { membershipFulfilled: number };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledTimes(1);
    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(body.membershipFulfilled).toBe(1);
  });

  it("permanently excludes non-membership orders so the SAME crowd can't starve the sweep again next run — the actual crowding fix", async () => {
    // This is the regression this test exists to catch: the OLD sweep query
    // (`Query.isNull("membership_invoice_id")`, no ordering clause,
    // `Query.limit(50)`) matches every unposted shop order forever, since
    // that column is only ever written for a membership order. With 50+ such
    // shop orders older than the cutoff, a real Appwrite query can return a
    // full page of nothing but shop orders — the membership order isn't
    // merely deprioritized within one page, it can be entirely absent from
    // it. Run 1 below simulates exactly that page. The fix's job is to make
    // sure run 2's page can no longer be identical.
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    const theMembershipOrder = membershipOrder();

    wireListRows(shopOrders);

    const firstRun = await GET(cronRequest());
    const firstBody = (await firstRun.json()) as {
      membershipFulfilled: number;
    };

    // Run 1: the membership order isn't even in this page, so it can't be
    // fulfilled yet — but every shop order in the crowd must get the
    // exclusion sentinel, which is what stops it filling the NEXT page too.
    expect(firstBody.membershipFulfilled).toBe(0);
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(mocks.stampNonMembershipOrder).toHaveBeenCalledTimes(50);
    for (const order of shopOrders) {
      expect(mocks.stampNonMembershipOrder).toHaveBeenCalledWith(order.$id, db);
    }

    // Run 2: with the 50 shop orders now excluded (membership_invoice_id no
    // longer NULL for them — represented here by them simply no longer
    // matching the sweep's query), the membership order is finally reached.
    mocks.stampNonMembershipOrder.mockClear();
    mocks.fulfilMembershipOrder.mockClear();
    wireListRows([theMembershipOrder]);

    const secondRun = await GET(cronRequest());
    const secondBody = (await secondRun.json()) as {
      membershipFulfilled: number;
    };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledTimes(1);
    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(secondBody.membershipFulfilled).toBe(1);
  });

  it("stamps the sentinel for a mixed-status crowd without ever touching a real membership order's claim", async () => {
    const shopOrders = Array.from({ length: 5 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    wireListRows(shopOrders);

    await GET(cronRequest());

    expect(mocks.releaseStaleMembershipClaim).not.toHaveBeenCalled();
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(mocks.stampNonMembershipOrder).toHaveBeenCalledTimes(5);
  });
});
