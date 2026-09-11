import { createAdminClient } from "@repo/api/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

    mocks.stampNonMembershipOrder.mockClear();
    wireListRows([membershipOrder()]);

    const secondRun = await GET(cronRequest());
    const secondBody = (await secondRun.json()) as {
      membershipFulfilled: number;
    };

    expect(mocks.fulfilMembershipOrder).toHaveBeenCalledWith("order-1", db);
    expect(secondBody.membershipFulfilled).toBe(1);
  });
});
