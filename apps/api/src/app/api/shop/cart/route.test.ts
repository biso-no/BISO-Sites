import { createAdminClient } from "@repo/api/server";
import { cartReservationRowId } from "@repo/shared/utils/cart-reservation-id";
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
  createConflict = false,
  product = { status: "published", stock: null as number | null },
  reservations = [] as ReservationRow[],
} = {}) {
  // Deletes really remove the row, because the route collapses a buyer's
  // duplicate holds *before* computing their ceiling — a delete that did not
  // stick would leave the phantom hold visible to the availability read and
  // hide the very thing these tests check.
  const stored = [...reservations];
  const db = {
    createRow: createConflict
      ? vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("row already exists"), { code: 409 })
          )
      : vi.fn().mockResolvedValue({}),
    deleteRow: vi.fn((_db: string, _table: string, rowId: string) => {
      const index = stored.findIndex((row) => row.$id === rowId);
      if (index >= 0) {
        stored.splice(index, 1);
      }
      return Promise.resolve({});
    }),
    getRow: vi.fn().mockResolvedValue(product),
    listRows: vi.fn((_db: string, _table: string, queries: string[]) => {
      // The own-row lookup filters ON user_id; the availability read only
      // SELECTS it, so match the attribute of an equality clause.
      const isOwnLookup = queries.some((query) =>
        query.includes('"attribute":"user_id"')
      );
      const rows = isOwnLookup
        ? stored.filter((row) => row.user_id === "buyer-1")
        : [...stored];
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

  // `user_product_idx` is not unique, so nothing in the schema stops two first
  // writes — the app and the website, or one request retried — from each
  // minting a row. The row id is derived from (buyer, product) so the primary
  // key settles the race instead.
  it("derives the row id from the buyer and product, not at random", async () => {
    const db = mockDb({ product: { status: "published", stock: null } });

    await PUT(putRequest({ productId: "product-1", quantity: 1 }));

    const [, , firstId] = db.createRow.mock.calls[0];
    expect(firstId).toBe(cartReservationRowId("buyer-1", "product-1"));
    expect(firstId).not.toBe(cartReservationRowId("buyer-2", "product-1"));
    expect(firstId).not.toBe(cartReservationRowId("buyer-1", "product-2"));
  });

  it("updates the winner's row when it loses the create race", async () => {
    const db = mockDb({
      createConflict: true,
      product: { status: "published", stock: null },
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 3 })
    );

    expect(response.status).toBe(200);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      cartReservationRowId("buyer-1", "product-1"),
      expect.objectContaining({ quantity: 3 })
    );
  });

  it("surfaces a create failure that is not the race being lost", async () => {
    const db = mockDb({ product: { status: "published", stock: null } });
    db.createRow.mockRejectedValue(new Error("appwrite is down"));

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 1 })
    );

    expect(response.status).toBe(500);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("drops a duplicate hold left by an earlier race", async () => {
    const db = mockDb({
      product: { status: "published", stock: 10 },
      reservations: [
        { $id: "r-legacy", quantity: 4, user_id: "buyer-1" },
        { $id: "r-dupe", quantity: 4, user_id: "buyer-1" },
      ],
    });

    await PUT(putRequest({ productId: "product-1", quantity: 1 }));

    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "r-dupe"
    );
    expect(db.deleteRow).not.toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "r-legacy"
    );
  });

  it("does not let a duplicate hold inflate the buyer's own ceiling", async () => {
    // Stock 10, another buyer holding 5, and this buyer holding 3 twice over
    // because of an earlier race. Crediting both rows back would offer them 6
    // of the 5 that are really theirs to take.
    mockDb({
      product: { status: "published", stock: 10 },
      reservations: [
        { $id: "r-other", quantity: 5, user_id: "buyer-2" },
        { $id: "r-mine", quantity: 3, user_id: "buyer-1" },
        { $id: "r-mine-dupe", quantity: 3, user_id: "buyer-1" },
      ],
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 6 })
    );

    await expect(response.json()).resolves.toMatchObject({ quantity: 5 });
  });

  it("holds the line when a duplicate could not be deleted", async () => {
    const db = mockDb({
      product: { status: "published", stock: 10 },
      reservations: [
        { $id: "r-other", quantity: 5, user_id: "buyer-2" },
        { $id: "r-mine", quantity: 3, user_id: "buyer-1" },
        { $id: "r-mine-dupe", quantity: 3, user_id: "buyer-1" },
      ],
    });
    // Cleanup is best effort, so the phantom row survives this request. It must
    // still not be credited back as stock this buyer is holding.
    db.deleteRow.mockRejectedValue(new Error("appwrite is down"));

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 6 })
    );

    // The phantom 3 still counts against availability like anyone else's hold
    // (10 - 5 - 3 - 3 = 0 free), and only the surviving row's 3 is credited
    // back — so the buyer is offered 3 rather than the 5 they could really
    // have. Under-offering is the safe direction; the next write retries the
    // cleanup.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ quantity: 3 });
  });

  it("credits nothing back on a buyer's first hold", async () => {
    mockDb({
      product: { status: "published", stock: 10 },
      reservations: [{ $id: "r-other", quantity: 5, user_id: "buyer-2" }],
    });

    const response = await PUT(
      putRequest({ productId: "product-1", quantity: 8 })
    );

    await expect(response.json()).resolves.toMatchObject({ quantity: 5 });
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
