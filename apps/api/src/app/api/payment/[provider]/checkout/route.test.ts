import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const productRow = {
  $id: "product-1",
  campus_id: "oslo",
  metadata: null,
  regular_price: 199,
  slug: "trusted-product",
  stock: null,
  translation_refs: [{ locale: "no", title: "Trusted Product" }],
};

function checkoutRequest({
  authorization,
  total = 199,
  userId = "attacker-user",
}: {
  authorization?: string;
  total?: number;
  userId?: string;
} = {}): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request("https://api.biso.no/api/payment/vipps/checkout", {
    body: JSON.stringify({
      currency: "NOK",
      customerInfo: {
        email: "buyer@example.com",
        firstName: "Buyer",
        lastName: "Person",
      },
      items: [
        {
          productId: "product-1",
          quantity: 1,
          slug: "trusted-product",
        },
      ],
      reference: "checkout-ref",
      subtotal: total,
      total,
      userId,
    }),
    headers,
    method: "POST",
  }) as unknown as NextRequest;
}

async function postVipps(request: NextRequest) {
  return await POST(request, {
    params: Promise.resolve({ provider: "vipps" }),
  });
}

function mockAuthenticatedUser(userId = "session-user") {
  mockedCreateAuthenticatedClient.mockResolvedValue({
    account: {
      get: vi.fn().mockResolvedValue({ $id: userId }),
    },
    db: {
      getRow: vi.fn().mockResolvedValue({ studentId: null }),
    },
    functions: {
      createExecution: vi.fn(),
    },
  } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
}

function mockAdminClient() {
  const db = {
    getRow: vi.fn().mockResolvedValue(productRow),
  };
  mockedCreateAdminClient.mockResolvedValue({
    db,
  } as unknown as Awaited<ReturnType<typeof createAdminClient>>);
  return db;
}

describe("payment checkout authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APPWRITE_DATABASE_ID", "app");
    vi.stubEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID", "webshop_products");
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no");

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
      order: { total: 199 },
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
    mockedUpdateOrderWithSession.mockResolvedValue({} as never);
  });

  it("rejects missing bearer tokens before admin order creation", async () => {
    const response = await postVipps(checkoutRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Authentication required",
    });
    expect(mockedCreateAuthenticatedClient).not.toHaveBeenCalled();
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
  });

  it("rejects invalid JWTs before admin order creation", async () => {
    mockedCreateAuthenticatedClient.mockResolvedValue({
      account: {
        get: vi.fn().mockRejectedValue(new Error("invalid jwt")),
      },
    } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);

    const response = await postVipps(
      checkoutRequest({ authorization: "Bearer invalid" })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "Authentication required",
    });
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
  });

  it("derives the order user id from the authenticated JWT", async () => {
    mockAuthenticatedUser("session-user");

    const response = await postVipps(
      checkoutRequest({
        authorization: "Bearer valid",
        userId: "spoofed-user",
      })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "session-user" }),
      expect.anything()
    );
  });

  it("rejects client totals that do not match trusted product pricing", async () => {
    const response = await postVipps(
      checkoutRequest({ authorization: "Bearer valid", total: 1 })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "Checkout total mismatch",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(mockedCreateVippsPayment).not.toHaveBeenCalled();
  });

  it("uses trusted product rows to create the Vipps checkout amount", async () => {
    const response = await postVipps(
      checkoutRequest({ authorization: "Bearer valid", total: 199 })
    );

    expect(response.status).toBe(200);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            name: "Trusted Product",
            price: 199,
            productId: "product-1",
            quantity: 1,
            unit_price: 199,
          }),
        ],
        subtotal: 199,
        total: 199,
        userId: "session-user",
      }),
      expect.anything()
    );
    expect(mockedCreateVippsPayment).toHaveBeenCalledWith(
      expect.objectContaining({ total: 199 }),
      expect.anything(),
      expect.anything()
    );
  });
});
