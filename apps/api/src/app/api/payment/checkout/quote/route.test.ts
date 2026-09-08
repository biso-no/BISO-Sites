import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  computeMembershipStatus: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(),
}));
vi.mock("@repo/shared/utils/membership-status", () => ({
  computeMembershipStatus: mocks.computeMembershipStatus,
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);

const productRow = {
  $id: "product-1",
  campus_id: "oslo",
  metadata: null,
  regular_price: 199,
  slug: "hoodie",
  stock: null,
  translation_refs: [{ locale: "no", title: "BISO Hoodie" }],
  variations: [],
};

function quoteRequest(
  body: unknown,
  { authorization }: { authorization?: string } = {}
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://api.biso.no/api/payment/checkout/quote", {
    body: JSON.stringify(body),
    headers,
    method: "POST",
  }) as unknown as NextRequest;
}

function mockAuthenticatedUser(
  userId = "session-user",
  profile: Record<string, unknown> = { student_id: null }
) {
  mockedCreateAuthenticatedClient.mockResolvedValue({
    account: { get: vi.fn().mockResolvedValue({ $id: userId }) },
    db: { getRow: vi.fn().mockResolvedValue(profile) },
  } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
}

function mockAdminClient(product: Record<string, unknown> = productRow) {
  const db = {
    getRow: vi.fn().mockResolvedValue(product),
    listRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  mockedCreateAdminClient.mockResolvedValue({ db } as unknown as Awaited<
    ReturnType<typeof createAdminClient>
  >);
  return db;
}

describe("checkout quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APPWRITE_DATABASE_ID", "app");
    vi.stubEnv("APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID", "webshop_products");
    mockAdminClient();
    mockAuthenticatedUser();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires authentication", async () => {
    const response = await POST(
      quoteRequest({ items: [{ productId: "product-1", quantity: 1 }] })
    );

    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an empty cart", async () => {
    const response = await POST(
      quoteRequest({ items: [] }, { authorization: "Bearer valid" })
    );

    expect(response.status).toBe(400);
  });

  it("prices from the stored product, ignoring any client-sent price", async () => {
    const response = await POST(
      quoteRequest(
        {
          items: [
            {
              price: 1,
              productId: "product-1",
              quantity: 2,
              title: "BISO Hoodie",
              unit_price: 1,
            },
          ],
        },
        { authorization: "Bearer valid" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      currency: "NOK",
      discountTotal: 0,
      items: [
        {
          lineTotal: 398,
          name: "BISO Hoodie",
          productId: "product-1",
          quantity: 2,
          unitPrice: 199,
        },
      ],
      membershipApplied: false,
      subtotal: 398,
      total: 398,
    });
  });

  it("prices a variation from its own row, not the product base price", async () => {
    mockAdminClient({
      ...productRow,
      variations: [
        { $id: "var-l", enabled: true, name: "Large", regular_price: 249 },
      ],
    });

    const response = await POST(
      quoteRequest(
        {
          items: [
            { productId: "product-1", quantity: 1, variationId: "var-l" },
          ],
        },
        { authorization: "Bearer valid" }
      )
    );

    await expect(response.json()).resolves.toMatchObject({
      items: [{ unitPrice: 249, variationId: "var-l", variationName: "Large" }],
      total: 249,
    });
  });

  it("applies the member discount when the buyer is a verified member", async () => {
    mockAdminClient({
      ...productRow,
      metadata: JSON.stringify({
        member_discount_enabled: true,
        member_discount_percent: 50,
      }),
    });
    mockAuthenticatedUser("session-user", { student_id: "1234567" });
    mocks.computeMembershipStatus.mockResolvedValue({ isMember: true });

    const response = await POST(
      quoteRequest(
        { items: [{ productId: "product-1", quantity: 1 }] },
        { authorization: "Bearer valid" }
      )
    );

    await expect(response.json()).resolves.toMatchObject({
      discountTotal: 99.5,
      memberDiscountPercent: 50,
      membershipApplied: true,
      total: 99.5,
    });
  });

  it("reports an oversell as a 409 rather than quoting an unfulfillable cart", async () => {
    const db = mockAdminClient({ ...productRow, stock: 1 });
    db.listRows.mockResolvedValue({ rows: [], total: 0 });

    const response = await POST(
      quoteRequest(
        { items: [{ productId: "product-1", quantity: 3 }] },
        { authorization: "Bearer valid" }
      )
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("available"),
    });
  });
});
