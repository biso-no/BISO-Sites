import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  listRows: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@/lib/anon-session", () => ({
  ensureAnonymousSession: vi.fn(async () => undefined),
}));

import { createOrUpdateReservation } from "./cart-reservations";

describe("cart reservations", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminDb.createRow.mockReset();
    adminDb.listRows.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.listRows.mockReset();
    sessionDb.updateRow.mockReset();

    account.get.mockResolvedValue({ $id: "session-user-1" });
    sessionDb.getRow.mockResolvedValue({ $id: "product-1", stock: 5 });
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.createRow.mockResolvedValue({});
  });

  it("creates new reservations with the admin client and user row permissions", async () => {
    const result = await createOrUpdateReservation("product-1", 2);

    expect(result).toMatchObject({ quantity: 2, success: true });
    expect(sessionDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "cart_reservations",
      "unique()",
      expect.objectContaining({
        product_id: "product-1",
        quantity: 2,
        user_id: "session-user-1",
      }),
      [
        'read("user:session-user-1")',
        'update("user:session-user-1")',
        'delete("user:session-user-1")',
      ]
    );
  });
});
