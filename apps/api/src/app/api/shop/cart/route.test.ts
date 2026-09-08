import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { DELETE, PUT } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ createAuthenticatedClient: vi.fn() }));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);

interface ReservationRow {
  $id: string;
  product_id?: string;
  quantity: number;
  user_id: string;
}

function mockUser(userId = "buyer-1") {
  mockedCreateAuthenticatedClient.mockResolvedValue({
    account: { get: vi.fn().mockResolvedValue({ $id: userId }) },
  } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
}

function mockDb({
  product = { status: "published", stock: null as number | null },
  reservations = [] as ReservationRow[],
} = {}) {
  const db = {
    createRow: vi.fn().mockResolvedValue({}),
    deleteRow: vi.fn().mockResolvedValue({}),
    getRow: vi.fn().mockResolvedValue(product),
    listRows: vi.fn((_db: string, _table: string, queries: string[]) => {
      // The own-row lookup filters ON user_id; the availability read only
      // SELECTS it, so match the attribute of an equality clause.
      const isOwnLookup = queries.some((query) =>
        query.includes('"attribute":"user_id"')
      );
      const rows = isOwnLookup
        ? reservations.filter((row) => row.user_id === "buyer-1")
        : reservations;
      return Promise.resolve({ rows, total: rows.length });
    }),
    updateRow: vi.fn().mockResolvedValue({}),
  };
  mockedCreateAdminClient.mockResolvedValue({ db } as unknown as Awaited<
    ReturnType<typeof createAdminClient>
  >);
  return db;
}

function putRequest(body: unknown, authorized = true): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorized) {
    headers.set("authorization", "Bearer valid");
  }
  return new Request("https://api.biso.no/api/shop/cart", {
    body: JSON.stringify(body),
    headers,
    method: "PUT",
  }) as unknown as NextRequest;
}

function deleteRequest(productId?: string): NextRequest {
  const url = productId
    ? `https://api.biso.no/api/shop/cart?productId=${productId}`
    : "https://api.biso.no/api/shop/cart";
  return new Request(url, {
    headers: new Headers({ authorization: "Bearer valid" }),
    method: "DELETE",
  }) as unknown as NextRequest;
}

describe("cart reservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser();
  });

  it("requires authentication", async () => {
    mockDb();
    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 1 }, false)
    );

    expect(response.status).toBe(401);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("refuses to hold stock for an unpublished product", async () => {
    mockDb({ product: { status: "draft", stock: 5 } });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 1 })
    );

    expect(response.status).toBe(404);
  });

  it("creates a reservation for an untracked product without capping it", async () => {
    const db = mockDb({ product: { status: "published", stock: null } });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 4 })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ quantity: 4 });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      expect.any(String),
      expect.objectContaining({
        product_id: "product-1",
        quantity: 4,
        user_id: "buyer-1",
      }),
      expect.arrayContaining([expect.stringContaining("buyer-1")])
    );
  });

  it("clamps to what is left after other buyers' holds", async () => {
    const db = mockDb({
      product: { status: "published", stock: 5 },
      reservations: [{ $id: "r-other", quantity: 3, user_id: "buyer-2" }],
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 5 })
    );

    await expect(response.json()).resolves.toMatchObject({ quantity: 2 });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      expect.any(String),
      expect.objectContaining({ quantity: 2 }),
      expect.anything()
    );
  });

  it("credits the buyer's own hold back so they can raise their own quantity", async () => {
    const db = mockDb({
      product: { status: "published", stock: 5 },
      reservations: [
        {
          $id: "r-mine",
          product_id: "product-1",
          quantity: 4,
          user_id: "buyer-1",
        },
      ],
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 5 })
    );

    await expect(response.json()).resolves.toMatchObject({ quantity: 5 });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "r-mine",
      expect.objectContaining({ quantity: 5 })
    );
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("does not wipe stored answers on a plain quantity change", async () => {
    const db = mockDb({
      product: { status: "published", stock: null },
      reservations: [
        {
          $id: "r-mine",
          product_id: "product-1",
          quantity: 1,
          user_id: "buyer-1",
        },
      ],
    });

    await PUT(putRequest({ productId: "product-1", quantity: 2 }));

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "r-mine",
      expect.not.objectContaining({ field_answers: expect.anything() })
    );
  });

  it("reports an out-of-stock product as a conflict", async () => {
    mockDb({
      product: { status: "published", stock: 2 },
      reservations: [{ $id: "r-other", quantity: 2, user_id: "buyer-2" }],
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 1 })
    );

    expect(response.status).toBe(409);
  });

  it("releases only the caller's own rows", async () => {
    const db = mockDb({
      reservations: [
        {
          $id: "r-mine",
          product_id: "product-1",
          quantity: 1,
          user_id: "buyer-1",
        },
        {
          $id: "r-other",
          product_id: "product-1",
          quantity: 1,
          user_id: "buyer-2",
        },
      ],
    });

    const response = await DELETE(deleteRequest("product-1"));

    await expect(response.json()).resolves.toEqual({ released: 1 });
    expect(db.deleteRow).toHaveBeenCalledTimes(1);
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "r-mine"
    );
  });
});
