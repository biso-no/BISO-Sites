import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const appwrite = vi.hoisted(() => ({
  createSessionJwt: vi.fn(),
}));

const sessionDb = vi.hoisted(() => ({
  getRow: vi.fn(),
}));

const membership = vi.hoisted(() => ({
  getMembershipStatus: vi.fn(),
}));

const webshop = vi.hoisted(() => ({
  parseProductMetadata: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({
    account,
    db: sessionDb,
    functions: { createExecution: vi.fn() },
  })),
  createSessionJwt: appwrite.createSessionJwt,
}));

vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  getFeatureFlagStates: vi.fn(async () => ({
    payments_stripe: true,
    payments_vipps: true,
  })),
}));

vi.mock("@/app/actions/cart-reservations", () => ({
  getAvailableStock: vi.fn(async () => 5),
  getUserReservation: vi.fn(async () => null),
}));

vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => "no"),
}));

vi.mock("@/app/actions/products", () => ({
  getProduct: vi.fn(async () => ({
    $id: "product-1",
    campus_id: "oslo",
    metadata: null,
    regular_price: 199,
    slug: "trusted-product",
    stock: 5,
    translation_refs: [{ locale: "no", title: "Trusted Product" }],
  })),
}));

vi.mock("@/app/actions/purchase-limits", () => ({
  validatePurchaseLimits: vi.fn(async () => ({ allowed: true })),
}));

vi.mock("@/lib/actions/membership", () => ({
  getMembershipStatus: membership.getMembershipStatus,
}));

vi.mock("@/lib/anon-session", () => ({
  ensureAnonymousSession: vi.fn(async () => undefined),
}));

vi.mock("@/lib/types/webshop", () => ({
  parseProductMetadata: webshop.parseProductMetadata,
}));

import { createCartCheckoutSession, verifyOrder } from "./orders";

function stubCheckoutFetch() {
  const fetchMock = vi.fn(async () =>
    Response.json({
      checkoutUrl: "https://vipps.example/checkout",
      orderId: "order-1",
    })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function checkoutFetchPayload(fetchMock: ReturnType<typeof vi.fn>) {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("order checkout actions", () => {
  beforeEach(() => {
    appwrite.createSessionJwt.mockResolvedValue("session-jwt");
    account.get.mockResolvedValue({ $id: "session-user" });
    webshop.parseProductMetadata.mockReturnValue({});
    membership.getMembershipStatus.mockResolvedValue({
      checkedAt: Date.now(),
      finagoCategoryIds: [],
      isMember: false,
      memberships: [],
    });
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fails fast when the checkout API request exceeds its deadline", async () => {
    vi.stubEnv("CHECKOUT_FETCH_TIMEOUT_MS", "20");
    const fetchMock = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError")
            );
          });
          setTimeout(() => {
            resolve(
              Response.json({
                checkoutUrl: "https://vipps.example/checkout",
                orderId: "order-1",
              })
            );
          }, 100);
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCartCheckoutSession({
      email: "buyer@example.com",
      items: [
        {
          productId: "product-1",
          quantity: 1,
          slug: "trusted-product",
        },
      ],
      name: "Buyer Person",
      provider: "vipps",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.biso.no/api/payment/vipps/checkout",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(result).toEqual({
      error: "Checkout request timed out. Please try again.",
      success: false,
    });
  });

  describe("member discount pricing", () => {
    it("applies the member discount for an active Finago member", async () => {
      webshop.parseProductMetadata.mockReturnValue({
        member_discount_enabled: true,
        member_discount_percent: 50,
      });
      membership.getMembershipStatus.mockResolvedValue({
        checkedAt: Date.now(),
        finagoCategoryIds: [123],
        isMember: true,
        memberships: [],
      });
      const fetchMock = stubCheckoutFetch();

      const result = await createCartCheckoutSession({
        email: "buyer@example.com",
        items: [
          { productId: "product-1", quantity: 1, slug: "trusted-product" },
        ],
        name: "Buyer Person",
        provider: "vipps",
      });

      expect(result.success).toBe(true);
      const payload = checkoutFetchPayload(fetchMock);
      expect(payload.subtotal).toBe(99.5);
      expect(payload.total).toBe(99.5);
    });

    it("rounds a fractional-øre member price the same way the API does", async () => {
      // 199 × 0.875 = 174.125 NOK. The API rounds each unit to whole øre
      // (174.13), so 2 units must total 348.26, not 348.25, or the API
      // rejects the checkout with "Checkout total mismatch".
      webshop.parseProductMetadata.mockReturnValue({
        member_discount_enabled: true,
        member_discount_percent: 12.5,
      });
      membership.getMembershipStatus.mockResolvedValue({
        checkedAt: Date.now(),
        finagoCategoryIds: [123],
        isMember: true,
        memberships: [],
      });
      const fetchMock = stubCheckoutFetch();

      const result = await createCartCheckoutSession({
        email: "buyer@example.com",
        items: [
          { productId: "product-1", quantity: 2, slug: "trusted-product" },
        ],
        name: "Buyer Person",
        provider: "vipps",
      });

      expect(result.success).toBe(true);
      const payload = checkoutFetchPayload(fetchMock);
      expect(Math.round(payload.total * 100)).toBe(34_826);
      expect(Math.round(payload.subtotal * 100)).toBe(34_826);
    });

    it("charges full price for a non-member", async () => {
      webshop.parseProductMetadata.mockReturnValue({
        member_discount_enabled: true,
        member_discount_percent: 50,
      });
      membership.getMembershipStatus.mockResolvedValue({
        checkedAt: Date.now(),
        finagoCategoryIds: [],
        isMember: false,
        memberships: [],
      });
      const fetchMock = stubCheckoutFetch();

      const result = await createCartCheckoutSession({
        email: "buyer@example.com",
        items: [
          { productId: "product-1", quantity: 1, slug: "trusted-product" },
        ],
        name: "Buyer Person",
        provider: "vipps",
      });

      expect(result.success).toBe(true);
      const payload = checkoutFetchPayload(fetchMock);
      expect(payload.subtotal).toBe(199);
      expect(payload.total).toBe(199);
    });

    it("fails closed to full price when the membership lookup throws", async () => {
      webshop.parseProductMetadata.mockReturnValue({
        member_discount_enabled: true,
        member_discount_percent: 50,
      });
      membership.getMembershipStatus.mockRejectedValue(
        new Error("Finago unavailable")
      );
      const fetchMock = stubCheckoutFetch();

      const result = await createCartCheckoutSession({
        email: "buyer@example.com",
        items: [
          { productId: "product-1", quantity: 1, slug: "trusted-product" },
        ],
        name: "Buyer Person",
        provider: "vipps",
      });

      expect(result.success).toBe(true);
      const payload = checkoutFetchPayload(fetchMock);
      expect(payload.subtotal).toBe(199);
      expect(payload.total).toBe(199);
    });

    it("charges full price for a member whose profile has no student id", async () => {
      webshop.parseProductMetadata.mockReturnValue({
        member_discount_enabled: true,
        member_discount_percent: 50,
      });
      // Mirrors what the real getMembershipStatus() resolves to when the
      // profile has no student_id: emptyMembershipStatus("no_student_id").
      membership.getMembershipStatus.mockResolvedValue({
        checkedAt: Date.now(),
        finagoCategoryIds: [],
        isMember: false,
        memberships: [],
        reason: "no_student_id",
      });
      const fetchMock = stubCheckoutFetch();

      const result = await createCartCheckoutSession({
        email: "buyer@example.com",
        items: [
          { productId: "product-1", quantity: 1, slug: "trusted-product" },
        ],
        name: "Buyer Person",
        provider: "vipps",
      });

      expect(result.success).toBe(true);
      const payload = checkoutFetchPayload(fetchMock);
      expect(payload.subtotal).toBe(199);
      expect(payload.total).toBe(199);
    });
  });
});

describe("verifyOrder", () => {
  const pendingOrder = {
    $id: "order-1",
    payment_provider: "vipps",
    payment_session_id: "session-1",
    status: "pending",
  };

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");
    appwrite.createSessionJwt.mockResolvedValue("jwt-1");
    sessionDb.getRow.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks the API app to verify and settle, then re-reads the order", async () => {
    sessionDb.getRow
      .mockResolvedValueOnce(pendingOrder)
      .mockResolvedValueOnce({ ...pendingOrder, status: "paid" });
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "order-1", status: "paid" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOrder("order-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.biso.no/api/payment/orders/order-1",
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer jwt-1" },
      })
    );
    expect(result?.status).toBe("paid");
  });

  it("returns the stored order without calling the API when there is no payment session", async () => {
    sessionDb.getRow.mockResolvedValueOnce({
      ...pendingOrder,
      payment_session_id: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyOrder("order-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result?.status).toBe("pending");
  });

  it("returns the stored order when the API app answers with an error", async () => {
    sessionDb.getRow.mockResolvedValueOnce(pendingOrder);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 }))
    );

    const result = await verifyOrder("order-1");

    expect(result?.status).toBe("pending");
    expect(sessionDb.getRow).toHaveBeenCalledTimes(1);
  });
});
