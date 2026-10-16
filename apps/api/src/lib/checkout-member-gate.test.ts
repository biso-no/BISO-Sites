import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const computeMembershipStatus = vi.hoisted(() => vi.fn());

vi.mock("@repo/shared/utils/membership-status", () => ({
  computeMembershipStatus,
}));

vi.mock("@repo/shared/utils/finago-shop-accounting-server", () => ({
  resolveRevenueTarget: vi.fn(async () => null),
}));

import {
  type AuthenticatedClient,
  buildTrustedCheckoutParams,
  type CheckoutDb,
} from "./checkout-pricing";

const MEMBERS_ONLY_MESSAGE = /members only/i;
const NOT_AVAILABLE_MESSAGE = /not available for purchase/i;
const LOOKUP_FAILURE = /24SO unavailable/;

function fakeDb(memberOnly: boolean, status = "published") {
  return {
    getRow: vi.fn(async () => ({
      $id: "product-1",
      member_only: memberOnly,
      metadata: "{}",
      regular_price: 250,
      slug: "medlemsgenser",
      status,
      stock: null,
      translation_refs: [],
      variations: [],
    })),
    listRows: vi.fn(async () => ({ rows: [], total: 0 })),
  } as unknown as CheckoutDb;
}

const buyer = {
  db: { getRow: vi.fn(async () => ({ student_id: "s1234567" })) },
} as unknown as AuthenticatedClient;

const checkout = (memberOnly: boolean) =>
  buildTrustedCheckoutParams({
    authClient: buyer,
    db: fakeDb(memberOnly),
    items: [{ productId: "product-1", quantity: 1 }],
    reference: "ref-1",
    userId: "user-1",
  });

describe("member-only products are gated at purchase, not at display", () => {
  beforeEach(() => {
    computeMembershipStatus.mockReset();
    vi.stubEnv("APPWRITE_DATABASE_ID", "app");
    vi.stubEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID", "webshop_products");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses a member-only product for a non-member", async () => {
    // The storefront lists this product to everyone and disables its buy
    // button, but the button is bypassed by posting straight here — so this is
    // the check that actually holds.
    computeMembershipStatus.mockResolvedValue({ isMember: false });

    await expect(checkout(true)).rejects.toThrow(MEMBERS_ONLY_MESSAGE);
  });

  it("lets a member buy the same product", async () => {
    computeMembershipStatus.mockResolvedValue({ isMember: true });

    const params = await checkout(true);

    expect(params.items).toHaveLength(1);
  });

  it("leaves an open product alone without a membership lookup", async () => {
    const params = await checkout(false);

    expect(params.items).toHaveLength(1);
    // No member discount is configured either, so nothing should have asked
    // 24SevenOffice about this buyer at all.
    expect(computeMembershipStatus).not.toHaveBeenCalled();
  });

  it("fails the checkout rather than calling a member a non-member", async () => {
    // `computeMembershipStatus` reaches 24SevenOffice. Treating an outage as
    // "not a member" would tell a paying member they are not one and lose the
    // sale, so the error propagates instead.
    computeMembershipStatus.mockRejectedValue(new Error("24SO unavailable"));

    await expect(checkout(true)).rejects.toThrow(LOOKUP_FAILURE);
  });

  it("looks the buyer up once for a cart of several member-only products", async () => {
    computeMembershipStatus.mockResolvedValue({ isMember: true });
    // Two DISTINCT products, or `validatedProducts` in
    // `buildTrustedCheckoutParams` would collapse them to a single gate call
    // and the test would pass with no memoization at all.
    const db = {
      getRow: vi.fn(async (_dbId: string, _table: string, rowId: string) => ({
        $id: rowId,
        member_only: true,
        metadata: "{}",
        regular_price: 250,
        slug: rowId,
        status: "published",
        stock: null,
        translation_refs: [],
        variations: [],
      })),
      listRows: vi.fn(async () => ({ rows: [], total: 0 })),
    } as unknown as CheckoutDb;

    await buildTrustedCheckoutParams({
      authClient: buyer,
      db,
      items: [
        { productId: "product-1", quantity: 1 },
        { productId: "product-2", quantity: 2 },
      ],
      reference: "ref-2",
      userId: "user-1",
    });

    expect(db.getRow).toHaveBeenCalledTimes(2);
    expect(computeMembershipStatus).toHaveBeenCalledTimes(1);
  });

  it("treats a buyer with no profile row as a non-member, not a server error", async () => {
    // `getRow` throws a 404 rather than returning null. Letting that escape
    // turned "you are not a member" into a 500 with no reason attached.
    const noProfile = {
      db: {
        getRow: vi.fn(() =>
          Promise.reject(
            Object.assign(new Error("row not found"), { code: 404 })
          )
        ),
      },
    } as unknown as AuthenticatedClient;

    await expect(
      buildTrustedCheckoutParams({
        authClient: noProfile,
        db: fakeDb(true),
        items: [{ productId: "product-1", quantity: 1 }],
        reference: "ref-3",
        userId: "user-1",
      })
    ).rejects.toThrow(MEMBERS_ONLY_MESSAGE);
  });
});

describe("unpublished products cannot be bought", () => {
  beforeEach(() => {
    computeMembershipStatus.mockReset();
    computeMembershipStatus.mockResolvedValue({ isMember: true });
    vi.stubEnv("APPWRITE_DATABASE_ID", "app");
    vi.stubEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID", "webshop_products");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // `webshop_products` grants read to `any` and this runs on the admin client,
  // so nothing except this check stands between a known id and a paid order.
  // Both trusted entry points (`/checkout` and `/checkout/quote`) come through
  // `loadProduct`, so covering it covers both.
  it.each([
    "draft",
    "pending_approval",
    "archived",
  ])("refuses a %s product", async (status) => {
    await expect(
      buildTrustedCheckoutParams({
        authClient: buyer,
        db: fakeDb(false, status),
        items: [{ productId: "product-1", quantity: 1 }],
        reference: "ref-status",
        userId: "user-1",
      })
    ).rejects.toThrow(NOT_AVAILABLE_MESSAGE);
  });

  it("still allows a published one", async () => {
    const params = await buildTrustedCheckoutParams({
      authClient: buyer,
      db: fakeDb(false, "published"),
      items: [{ productId: "product-1", quantity: 1 }],
      reference: "ref-ok",
      userId: "user-1",
    });

    expect(params.items).toHaveLength(1);
  });
});
