import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  createVippsPayment: vi.fn(),
  getMembershipStatusForStudent: vi.fn(),
  resolveStripeCredentials: vi.fn(),
  resolveVippsCredentials: vi.fn(),
  updateOrderWithSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(),
}));
vi.mock("@/lib/membership-status-cache", () => ({
  getMembershipStatusForStudent: mocks.getMembershipStatusForStudent,
}));
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@repo/payment/credentials", () => ({
  resolveStripeCredentials: mocks.resolveStripeCredentials,
  resolveVippsCredentials: mocks.resolveVippsCredentials,
}));
vi.mock("@repo/payment/stripe", () => ({
  createStripeCheckoutSession: mocks.createStripeCheckoutSession,
}));
vi.mock("@repo/payment/vipps", () => ({
  createVippsPayment: mocks.createVippsPayment,
}));
vi.mock("@repo/shared/utils/vipps-order-ops", () => ({
  createOrder: mocks.createOrder,
  updateOrderWithSession: mocks.updateOrderWithSession,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);
const mockedResolveStripeCredentials = mocks.resolveStripeCredentials;
const mockedResolveVippsCredentials = mocks.resolveVippsCredentials;
const mockedCreateStripeCheckoutSession = mocks.createStripeCheckoutSession;
const mockedCreateVippsPayment = mocks.createVippsPayment;
const mockedCreateOrder = mocks.createOrder;
const mockedUpdateOrderWithSession = mocks.updateOrderWithSession;

// Mirrors the shape from task-17's fulfilment brief: a "fall 2026 and spring
// 2027" membership snaps to a 12-month (year) accrual.
const VALID_PLAN_ROW = {
  $id: "71",
  category: "113178",
  canPurchase: true,
  expiryDate: "2027-06-30",
  membership_id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  price: 550,
  startDate: "2026-08-01",
  status: true,
};

const VALID_PROFILE = {
  $id: "user-1",
  bi_employee_id: "9001234",
  student_id: "s1715738",
};

function membershipCheckoutRequest({
  authorization,
  campusId = "1",
  planId = "71",
  client,
}: {
  authorization?: string;
  campusId?: string;
  planId?: string;
  client?: string;
} = {}): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request(
    "https://api.biso.no/api/payment/vipps/membership-checkout",
    {
      body: JSON.stringify({ campusId, planId, ...(client ? { client } : {}) }),
      headers,
      method: "POST",
    }
  ) as unknown as NextRequest;
}

async function postVipps(request: NextRequest) {
  return await POST(request, {
    params: Promise.resolve({ provider: "vipps" }),
  });
}

async function postStripe(request: NextRequest) {
  return await POST(request, {
    params: Promise.resolve({ provider: "stripe" }),
  });
}

function mockAuthenticatedUser(userId = "user-1") {
  mockedCreateAuthenticatedClient.mockResolvedValue({
    account: {
      get: vi.fn().mockResolvedValue({
        $id: userId,
        email: "student@example.com",
        name: "Ola Nordmann",
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
}

function membershipOrder(planId: string, id = "order-9") {
  return {
    $id: id,
    campus_id: "1",
    items_json: JSON.stringify([
      { product_id: planId, product_type: "membership", quantity: 1 },
    ]),
    payment_provider: "vipps",
    status: "paid",
  };
}

function mockAdminClient({
  profile = VALID_PROFILE,
  planRow = VALID_PLAN_ROW,
  existingOrders = [],
  settledOrders = [],
}: {
  profile?: Record<string, unknown> | null;
  planRow?: Record<string, unknown> | null;
  existingOrders?: Record<string, unknown>[];
  settledOrders?: Record<string, unknown>[];
} = {}) {
  const getRow = vi.fn((_dbId: string, table: string) => {
    if (table === "user") {
      return profile
        ? Promise.resolve(profile)
        : Promise.reject(new Error("not found"));
    }
    if (table === "memberships") {
      return planRow
        ? Promise.resolve(planRow)
        : Promise.reject(new Error("not found"));
    }
    return Promise.reject(new Error(`unexpected table: ${table}`));
  });
  // The settled-order guard and the pending-order idempotency lookup hit the
  // same table; tell them apart by the status the query filters on.
  const listRows = vi.fn((_dbId: string, _table: string, queries: string[]) => {
    const rows = queries.some((query) => query.includes("paid"))
      ? settledOrders
      : existingOrders;
    return Promise.resolve({ rows, total: rows.length });
  });

  mockedCreateAdminClient.mockResolvedValue({
    db: { getRow, listRows },
  } as unknown as Awaited<ReturnType<typeof createAdminClient>>);

  return { getRow, listRows };
}

describe("membership checkout authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");

    mockAdminClient();
    mockAuthenticatedUser();
    mockedResolveVippsCredentials.mockResolvedValue({
      clientId: "vipps-client",
      clientSecret: "vipps-secret",
      merchantSerialNumber: "123456",
      subscriptionKey: "vipps-subscription",
      testMode: true,
    });
    mockedResolveStripeCredentials.mockResolvedValue({
      secretKey: "stripe-secret",
      testMode: true,
      webhookSecret: "stripe-webhook",
    });
    mockedCreateOrder.mockResolvedValue({
      order: { total: 550 },
      orderId: "order-1",
    });
    mockedCreateVippsPayment.mockResolvedValue({
      checkoutUrl: "https://vipps.example/checkout",
      reference: "vipps-session",
    });
    mockedCreateStripeCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://stripe.example/checkout",
      sessionId: "stripe-session",
    });
    mockedUpdateOrderWithSession.mockResolvedValue(undefined);
    mocks.getMembershipStatusForStudent.mockResolvedValue({
      checkedAt: Date.now(),
      finagoCategoryIds: [],
      isMember: false,
      memberships: [],
      reason: "no_categories",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects an unauthenticated caller before any order is created", async () => {
    const response = await postVipps(membershipCheckoutRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Authentication required",
    });
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("refuses a profile with no bi_employee_id (no Finago customer number) before any order is created", async () => {
    mockAdminClient({ profile: { ...VALID_PROFILE, bi_employee_id: null } });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "BI student record could not be verified",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("refuses a plan row with canPurchase false before any order is created", async () => {
    mockAdminClient({ planRow: { ...VALID_PLAN_ROW, canPurchase: false } });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "That membership is no longer available",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("rejects a campusId that resolves via the Object.prototype chain instead of a real campus entry", async () => {
    const response = await postVipps(
      membershipCheckoutRequest({
        authorization: "Bearer valid",
        campusId: "constructor",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Invalid campus",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("returns 503 and creates no order when the provider's payment credentials are not configured", async () => {
    mockedResolveVippsCredentials.mockResolvedValue(null);

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Vipps is not configured",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
  });

  it("marks the order line product_type membership and prices strictly from the database row", async () => {
    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkoutUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    });
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: "1",
        items: [
          expect.objectContaining({
            price: 550,
            product_type: "membership",
            productId: "71",
            unit_price: 550,
          }),
        ],
        subtotal: 550,
        total: 550,
        userId: "user-1",
      }),
      expect.anything()
    );
    // Pins the amount that actually reaches the provider call, not just the
    // order row — a bug decoupling the two would still pass on createOrder
    // alone.
    expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
      expect.objectContaining({ total: 550 }),
      expect.anything(),
      expect.anything()
    );
  });

  it("reuses the existing pending order on a repeat call within the idempotency window instead of creating a duplicate", async () => {
    // First call: no prior order exists for this user/plan yet — creates one.
    const first = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      checkoutUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    });
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);

    // Simulate that the order created above is now visible to the
    // idempotency lookup — exactly as it would be once persisted with its
    // stored checkout link (updateOrderWithSession has already run).
    mockAdminClient({
      existingOrders: [
        {
          $id: "order-1",
          campus_id: "1",
          items_json: JSON.stringify([
            { product_id: "71", product_type: "membership", quantity: 1 },
          ]),
          payment_link: "https://vipps.example/checkout",
          payment_provider: "vipps",
        },
      ],
    });

    // A retry after the caller's own fetch timeout — same plan, same user,
    // same provider, same campus.
    const second = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      checkoutUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    });
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockedCreateVippsPayment).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh order — not the stale Vipps one — when the caller switches to a different payment provider", async () => {
    // A prior, still-pending Vipps attempt for the same user/plan/campus, with
    // its own stored checkout link.
    mockAdminClient({
      existingOrders: [
        {
          $id: "order-1",
          campus_id: "1",
          items_json: JSON.stringify([
            { product_id: "71", product_type: "membership", quantity: 1 },
          ]),
          payment_link: "https://vipps.example/checkout",
          payment_provider: "vipps",
        },
      ],
    });
    mockedCreateOrder.mockResolvedValue({
      order: { total: 550 },
      orderId: "order-2",
    });

    const response = await postStripe(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkoutUrl: "https://stripe.example/checkout",
      orderId: "order-2",
    });
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
  });

  it("creates a fresh order when the caller resubmits the same plan and provider under a different campus", async () => {
    // A prior, still-pending Vipps attempt for campus "1".
    mockAdminClient({
      existingOrders: [
        {
          $id: "order-1",
          campus_id: "1",
          items_json: JSON.stringify([
            { product_id: "71", product_type: "membership", quantity: 1 },
          ]),
          payment_link: "https://vipps.example/checkout",
          payment_provider: "vipps",
        },
      ],
    });
    mockedCreateOrder.mockResolvedValue({
      order: { total: 550 },
      orderId: "order-2",
    });

    const response = await postVipps(
      membershipCheckoutRequest({
        authorization: "Bearer valid",
        campusId: "2",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ orderId: "order-2" })
    );
    expect(mockedCreateOrder).toHaveBeenCalledTimes(1);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ campusId: "2" }),
      expect.anything()
    );
  });

  it("returns 504 when the Vipps checkout call times out, and creates no session", async () => {
    vi.stubEnv("VIPPS_CHECKOUT_TIMEOUT_MS", "20");
    mockedCreateVippsPayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              checkoutUrl: "https://vipps.example/checkout",
              reference: "vipps-session",
            });
          }, 100);
        })
    );

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      message: "Vipps checkout timed out",
    });
    expect(mockedUpdateOrderWithSession).not.toHaveBeenCalled();
  });

  it("sends an app buyer back through the return route marked for the app", async () => {
    const response = await postVipps(
      membershipCheckoutRequest({
        authorization: "Bearer valid",
        client: "app",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        returnUrl:
          "https://api.biso.no/api/payment/return?orderId=order-1&client=app",
      }
    );
  });

  it("gives an app buyer's Stripe cancel URL the cancelled marker instead of the website", async () => {
    const response = await postStripe(
      membershipCheckoutRequest({
        authorization: "Bearer valid",
        client: "app",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateStripeCheckoutSession).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        cancelUrl:
          "https://api.biso.no/api/payment/return?orderId=order-1&client=app&cancelled=1",
        successUrl:
          "https://api.biso.no/api/payment/return?orderId=order-1&client=app",
      }
    );
  });

  it("refuses a plan that would not extend the buyer's current cover", async () => {
    mocks.getMembershipStatusForStudent.mockResolvedValue({
      checkedAt: Date.now(),
      finagoCategoryIds: [113_178],
      isMember: true,
      memberships: [
        {
          category: "113178",
          expiryDate: "2027-06-30",
          id: "71",
          name: "BISO Membership fall 2026 and spring 2027",
          startDate: "2026-08-01",
        },
      ],
    });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "Your membership already covers this period.",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("sells a plan that extends a member's cover", async () => {
    mocks.getMembershipStatusForStudent.mockResolvedValue({
      checkedAt: Date.now(),
      finagoCategoryIds: [113_176],
      isMember: true,
      memberships: [
        {
          category: "113176",
          expiryDate: "2026-12-31",
          id: "54",
          name: "BISO Membership fall 2026",
          startDate: "2026-08-01",
        },
      ],
    });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateOrder).toHaveBeenCalled();
  });

  it("refuses a second order for a plan the buyer has already paid for", async () => {
    // 24SevenOffice can lag a fulfilled purchase by up to the cache's ten
    // minutes, and the idempotency lookup only reuses PENDING orders — so
    // without this guard the gate would happily sell the same category twice
    // and raise a second invoice.
    mockAdminClient({ settledOrders: [membershipOrder("71")] });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "Your membership already covers this period.",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it("sells a plan the buyer's earlier settled order was not for", async () => {
    mockAdminClient({ settledOrders: [membershipOrder("54")] });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateOrder).toHaveBeenCalled();
  });

  it("reads membership status with a forced refresh, not a ten-minute-old cache", async () => {
    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(200);
    expect(mocks.getMembershipStatusForStudent).toHaveBeenCalledWith(
      1_715_738,
      { refresh: true }
    );
  });

  it("takes no payment while membership cannot be verified", async () => {
    mocks.getMembershipStatusForStudent.mockResolvedValue({
      checkedAt: Date.now(),
      finagoCategoryIds: [],
      isMember: false,
      memberships: [],
      reason: "finago_error",
    });

    const response = await postVipps(
      membershipCheckoutRequest({ authorization: "Bearer valid" })
    );

    expect(response.status).toBe(503);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });
});
