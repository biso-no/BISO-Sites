import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  createVippsPayment: vi.fn(),
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
}: {
  authorization?: string;
  campusId?: string;
  planId?: string;
} = {}): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request(
    "https://api.biso.no/api/payment/vipps/membership-checkout",
    {
      body: JSON.stringify({ campusId, planId }),
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

function mockAdminClient({
  profile = VALID_PROFILE,
  planRow = VALID_PLAN_ROW,
  existingOrders = [],
}: {
  profile?: Record<string, unknown> | null;
  planRow?: Record<string, unknown> | null;
  existingOrders?: Record<string, unknown>[];
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
  const listRows = vi.fn().mockResolvedValue({
    rows: existingOrders,
    total: existingOrders.length,
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
          items_json: JSON.stringify([
            { product_id: "71", product_type: "membership", quantity: 1 },
          ]),
          payment_link: "https://vipps.example/checkout",
        },
      ],
    });

    // A retry after the caller's own fetch timeout — same plan, same user.
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
});
