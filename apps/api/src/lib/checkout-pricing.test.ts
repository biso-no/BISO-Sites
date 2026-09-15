import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@repo/shared/utils/membership-status", () => ({
  computeMembershipStatus: vi.fn(async () => ({ isMember: true })),
}));

vi.mock("@repo/shared/utils/finago-shop-accounting-server", () => ({
  resolveRevenueTarget: vi.fn(async () => null),
}));

import { discountedUnitPrice } from "@repo/shared/utils/member-discount";
import {
  type AuthenticatedClient,
  buildTrustedCheckoutParams,
  type CheckoutDb,
} from "./checkout-pricing";

const toMinor = (kroner: number) => Math.round(kroner * 100);

function fakeDb(regularPrice: number, discountPercent: number) {
  return {
    getRow: vi.fn(async () => ({
      $id: "product-1",
      metadata: JSON.stringify({
        member_discount_enabled: true,
        member_discount_percent: discountPercent,
      }),
      regular_price: regularPrice,
      slug: "trusted-product",
      stock: null,
      translation_refs: [],
      variations: [],
    })),
  } as unknown as CheckoutDb;
}

const memberClient = {
  db: { getRow: vi.fn(async () => ({ student_id: "s1234567" })) },
} as unknown as AuthenticatedClient;

describe("buildTrustedCheckoutParams member discount", () => {
  beforeEach(() => {
    vi.stubEnv("APPWRITE_DATABASE_ID", "app");
    vi.stubEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID", "webshop_products");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { expectedMinor: 34_826, percent: 12.5, price: 199, quantity: 2 },
    { expectedMinor: 16_916, percent: 15, price: 99.5, quantity: 2 },
  ])("prices $price kr at $percent % × $quantity the same as the shared helper the web cart uses", async ({
    expectedMinor,
    percent,
    price,
    quantity,
  }) => {
    const params = await buildTrustedCheckoutParams({
      authClient: memberClient,
      db: fakeDb(price, percent),
      items: [{ productId: "product-1", quantity }],
      reference: "ref-1",
      userId: "user-1",
    });

    // The web action computes its client total with the same helper; the
    // checkout route compares both totals to the øre.
    const webTotalMinor = toMinor(
      discountedUnitPrice(price, percent) * quantity
    );
    expect(toMinor(params.total)).toBe(expectedMinor);
    expect(toMinor(params.total)).toBe(webTotalMinor);
    expect(toMinor(params.items[0]?.unit_price ?? 0) * quantity).toBe(
      expectedMinor
    );
  });
});
