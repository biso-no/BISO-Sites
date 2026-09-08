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

const getMembershipStatus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/membership", () => ({ getMembershipStatus }));

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

    getMembershipStatus.mockReset();
    getMembershipStatus.mockResolvedValue({ isMember: false });

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

  it("does not resolve membership for a product that is not member-only", async () => {
    await createOrUpdateReservation("product-1", 1);

    // getMembershipStatus is a Finago-backed lookup; running it on every
    // add-to-cart would put a network round-trip on the hot path.
    expect(getMembershipStatus).not.toHaveBeenCalled();
  });

  it("refuses a member-only product for a non-member", async () => {
    sessionDb.getRow.mockResolvedValue({
      $id: "product-1",
      member_only: true,
      stock: 5,
    });

    const result = await createOrUpdateReservation("product-1", 1);

    // Member-only products are visible to everyone now, so this server-side
    // refusal — not the listing filter — is what makes them members-only.
    expect(result).toMatchObject({ reason: "members_only", success: false });
    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(sessionDb.updateRow).not.toHaveBeenCalled();
  });

  it("reserves a member-only product for a member", async () => {
    sessionDb.getRow.mockResolvedValue({
      $id: "product-1",
      member_only: true,
      stock: 5,
    });
    getMembershipStatus.mockResolvedValue({ isMember: true });

    const result = await createOrUpdateReservation("product-1", 1);

    expect(result).toMatchObject({ quantity: 1, success: true });
    expect(adminDb.createRow).toHaveBeenCalled();
  });
});
