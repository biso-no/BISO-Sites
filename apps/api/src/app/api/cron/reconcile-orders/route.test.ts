import { createAdminClient } from "@repo/api/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isFeatureEnabled: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
  reconcileOrderPayment: vi.fn(),
  releaseStaleFinagoClaim: vi.fn(),
  releaseStaleMembershipClaim: vi.fn(),
  stampNonMembershipOrder: vi.fn(),
  sweepPendingRefunds: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));
vi.mock("@repo/payment/reconcile", () => ({
  reconcileOrderPayment: mocks.reconcileOrderPayment,
  sweepPendingRefunds: mocks.sweepPendingRefunds,
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

const CRON_SECRET = "test-cron-secret";
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

// Only the membership sweep's listRows call resolves to test rows; the payment
// reconcile and Finago sweeps run first and must see no rows.
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

function cronRequest(secret: string | null = CRON_SECRET): Request {
  const headers = new Headers();
  if (secret) {
    headers.set("x-cron-secret", secret);
  }
  return new Request("https://api.biso.no/api/cron/reconcile-orders", {
    headers,
  });
}

function resetMocks() {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  mockedCreateAdminClient.mockResolvedValue({ db } as never);
  mocks.isFeatureEnabled.mockResolvedValue(true);
  mocks.isMembershipOrder.mockImplementation(
    (order: { items_json?: string | null }) =>
      (order.items_json ?? "").includes('"product_type":"membership"')
  );
  mocks.releaseStaleMembershipClaim.mockResolvedValue(false);
  mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: false });
  mocks.releaseStaleFinagoClaim.mockResolvedValue(false);
  mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: false });
  mocks.reconcileOrderPayment.mockResolvedValue(undefined);
  mocks.sweepPendingRefunds.mockResolvedValue({
    failed: 0,
    settled: 0,
    unresolved: 0,
  });
  db.updateRow.mockResolvedValue({});
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("reconcile-orders cron: auth", () => {
  beforeEach(resetMocks);

  it("rejects a request without the cron secret", async () => {
    wireListRows([]);
    const response = await GET(cronRequest(null));
    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("accepts the secret as a bearer token", async () => {
    wireListRows([]);
    const response = await GET(
      new Request("https://api.biso.no/api/cron/reconcile-orders", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      })
    );
    expect(response.status).toBe(200);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(cronRequest());
    expect(response.status).toBe(500);
  });
});

describe("reconcile-orders cron: membership sweep", () => {
  beforeEach(resetMocks);

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

    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipClaimsReleased).toBe(1);
    expect(body.membershipFulfilled).toBe(0);
  });

  it("skips a row whose claim is live rather than probing it", async () => {
    wireListRows([membershipOrder({ membership_fulfilment_lock: 1 })]);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
    expect(body.membershipFulfilled).toBe(0);
    expect(body.membershipClaimsReleased).toBe(0);
  });
});

describe("reconcile-orders cron: membership recovery under crowding", () => {
  beforeEach(() => {
    resetMocks();
    mocks.fulfilMembershipOrder.mockResolvedValue({ fulfilled: true });
  });

  it("reaches a membership order present alongside 50 old paid shop orders", async () => {
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    wireListRows([...shopOrders, membershipOrder()]);

    const response = await GET(cronRequest());
    const body = (await response.json()) as { membershipFulfilled: number };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledTimes(1);
    expect(body.membershipFulfilled).toBe(1);
  });

  it("stamps every crowding shop order so the next run reaches the membership order", async () => {
    const shopOrders = Array.from({ length: 50 }, (_, i) =>
      shopOrder(`shop-${i}`)
    );
    wireListRows(shopOrders);

    const firstRun = await GET(cronRequest());
    const firstBody = (await firstRun.json()) as {
      membershipFulfilled: number;
    };

    expect(firstBody.membershipFulfilled).toBe(0);
    expect(mocks.stampNonMembershipOrder).toHaveBeenCalledTimes(50);
    for (const order of shopOrders) {
      expect(mocks.stampNonMembershipOrder).toHaveBeenCalledWith(order.$id, db);
    }

    mocks.stampNonMembershipOrder.mockClear();
    wireListRows([membershipOrder()]);

    const secondRun = await GET(cronRequest());
    const secondBody = (await secondRun.json()) as {
      membershipFulfilled: number;
    };

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

// Routes db.listRows for the payment-reconcile, Finago and membership passes
// independently by inspecting each call's query strings, so a single test can
// target one pass without the others' empty-row default interfering.
function wireListRowsForPasses(rows: {
  authorized?: unknown[];
  finago?: unknown[];
  membership?: unknown[];
  pending?: unknown[];
}) {
  db.listRows.mockImplementation(
    (_dbId: string, _tableId: string, queries: string[]) => {
      const joined = queries.join(" ");
      if (joined.includes("finago_transaction_id")) {
        return Promise.resolve({ rows: rows.finago ?? [] });
      }
      if (joined.includes("membership_invoice_id")) {
        return Promise.resolve({ rows: rows.membership ?? [] });
      }
      if (joined.includes('"values":["pending"]')) {
        return Promise.resolve({ rows: rows.pending ?? [] });
      }
      if (joined.includes('"values":["authorized"]')) {
        return Promise.resolve({ rows: rows.authorized ?? [] });
      }
      return Promise.resolve({ rows: [] });
    }
  );
}

describe("reconcile-orders cron: passes", () => {
  beforeEach(resetMocks);

  it("passes pending/authorized orders with a payment_session_id to reconcileOrderPayment, and skips ones without", async () => {
    const withSession = {
      ...shopOrder("order-with-session"),
      payment_session_id: "sess_1",
    };
    const withoutSession = shopOrder("order-without-session");
    wireListRowsForPasses({ pending: [withSession, withoutSession] });

    const response = await GET(cronRequest());
    const body = (await response.json()) as { reconciled: number };

    expect(mocks.reconcileOrderPayment).toHaveBeenCalledTimes(1);
    expect(mocks.reconcileOrderPayment).toHaveBeenCalledWith(
      "order-with-session",
      db
    );
    expect(body.reconciled).toBe(1);
  });

  it("passes a paid shop order with no finago_transaction_id to postFinagoTransactionForOrder and counts it in finagoPosted", async () => {
    const order = shopOrder("order-finago");
    wireListRowsForPasses({ finago: [order] });
    mocks.postFinagoTransactionForOrder.mockResolvedValue({ posted: true });

    const response = await GET(cronRequest());
    const body = (await response.json()) as { finagoPosted: number };

    expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
      "order-finago",
      db
    );
    expect(body.finagoPosted).toBe(1);
  });

  it("calls sweepPendingRefunds with db and an ISO cutoff, and reports its counts", async () => {
    wireListRowsForPasses({});
    mocks.sweepPendingRefunds.mockResolvedValue({
      failed: 1,
      settled: 2,
      unresolved: 3,
    });

    const response = await GET(cronRequest());
    const body = (await response.json()) as {
      refundsFailed: number;
      refundsSettled: number;
      refundsUnresolved: number;
    };

    expect(mocks.sweepPendingRefunds).toHaveBeenCalledWith(
      db,
      expect.any(String)
    );
    const [, cutoff] = mocks.sweepPendingRefunds.mock.calls.at(0) as [
      unknown,
      string,
    ];
    expect(new Date(cutoff).toISOString()).toBe(cutoff);
    expect(body.refundsSettled).toBe(2);
    expect(body.refundsFailed).toBe(1);
    expect(body.refundsUnresolved).toBe(3);
  });
});

describe("reconcile-orders cron: Finago pass", () => {
  beforeEach(resetMocks);

  function wireFinagoRows(rows: unknown[]) {
    db.listRows.mockImplementation(
      (_dbId: string, _tableId: string, queries: string[]) => {
        const isFinagoSweep = queries.some((q) =>
          q.includes("finago_transaction_id")
        );
        return Promise.resolve({ rows: isFinagoSweep ? rows : [] });
      }
    );
  }

  it("skips the pass entirely while shop ledger posting is off", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    wireFinagoRows([shopOrder("shop-1")]);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith("shop_ledger_posting");
    expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    expect(body.finagoSkipped).toBe(true);
    expect(body.finagoPosted).toBe(0);
  });

  it("reads the least recently attempted unposted orders first", async () => {
    wireFinagoRows([]);

    await GET(cronRequest());

    const finagoQueries = db.listRows.mock.calls
      .map((call) => call[2] as string[])
      .find((queries) =>
        queries.some((q) => q.includes("finago_transaction_id"))
      );
    expect(
      finagoQueries?.some(
        (q) => q.includes('"orderAsc"') && q.includes('"$updatedAt"')
      )
    ).toBe(true);
  });

  it("reaches a postable order queued behind 50 blocked ones within two runs", async () => {
    // A tiny stand-in for the orders table: the Finago query sorts by
    // $updatedAt and caps at the sweep limit, and every posting attempt
    // refreshes $updatedAt the way the claim/release writes do in Appwrite.
    let clock = Date.now() - 60 * 60 * 1000;
    const tick = () => {
      clock += 1000;
      return new Date(clock).toISOString();
    };
    const table = [
      ...Array.from({ length: 50 }, (_, i) => ({
        ...shopOrder(`blocked-${i}`),
        $updatedAt: tick(),
      })),
      { ...shopOrder("postable"), $updatedAt: tick() },
    ];
    db.listRows.mockImplementation(
      (_dbId: string, _tableId: string, queries: string[]) => {
        if (!queries.some((q) => q.includes("finago_transaction_id"))) {
          return Promise.resolve({ rows: [] });
        }
        const byUpdatedAt = queries.some(
          (q) => q.includes('"orderAsc"') && q.includes('"$updatedAt"')
        );
        const rows = byUpdatedAt
          ? [...table].sort((a, b) => a.$updatedAt.localeCompare(b.$updatedAt))
          : [...table];
        return Promise.resolve({ rows: rows.slice(0, 50) });
      }
    );
    mocks.postFinagoTransactionForOrder.mockImplementation((id: string) => {
      const row = table.find((order) => order.$id === id);
      if (row) {
        row.$updatedAt = tick();
      }
      return Promise.resolve(
        id === "postable"
          ? { posted: true, transactionId: "tx-1" }
          : { detail: "no sales type", posted: false, reason: "not_configured" }
      );
    });

    const first = await (await GET(cronRequest())).json();
    const second = await (await GET(cronRequest())).json();

    expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
      "postable",
      db
    );
    expect(first.finagoPosted + second.finagoPosted).toBe(1);
  });

  it("counts orders that cannot be posted yet without calling them errors", async () => {
    wireFinagoRows([shopOrder("shop-1"), shopOrder("shop-2")]);
    mocks.postFinagoTransactionForOrder
      .mockResolvedValueOnce({ posted: true, transactionId: "tx-1" })
      .mockResolvedValueOnce({
        detail: '"Hoodie" has no sales type',
        posted: false,
        reason: "not_configured",
      });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body.finagoSkipped).toBe(false);
    expect(body.finagoPosted).toBe(1);
    expect(body.finagoNotConfigured).toBe(1);
    expect(body.errors).toBe(0);
  });

  it("counts orders refunded before posting as needing manual posting, not errors", async () => {
    wireFinagoRows([shopOrder("shop-1"), shopOrder("refunded")]);
    mocks.postFinagoTransactionForOrder
      .mockResolvedValueOnce({ posted: true, transactionId: "tx-1" })
      .mockResolvedValueOnce({
        detail: "Order has refunds recorded before it was posted",
        posted: false,
        reason: "needs_manual",
      });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body.finagoPosted).toBe(1);
    expect(body.finagoNeedsManual).toBe(1);
    expect(body.finagoNotConfigured).toBe(0);
    expect(body.errors).toBe(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("refunded")
    );
  });
});
