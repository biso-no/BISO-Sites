import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  createJWT: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({
    account,
    db: { getRow: vi.fn() },
    functions: { createExecution: vi.fn() },
  })),
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

vi.mock("@/lib/types/webshop", () => ({
  parseProductMetadata: vi.fn(() => ({})),
}));

import { createCartCheckoutSession } from "./orders";

describe("order checkout actions", () => {
  beforeEach(() => {
    account.createJWT.mockResolvedValue({ jwt: "session-jwt" });
    account.get.mockResolvedValue({ $id: "session-user" });
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
});
