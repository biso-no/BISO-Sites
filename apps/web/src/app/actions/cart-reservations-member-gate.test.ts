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

const account = vi.hoisted(() => ({ get: vi.fn() }));
/** Stands in for `getLiveMembershipStatus`. */
const getMembershipStatus = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@/lib/anon-session", () => ({
  ensureAnonymousSession: vi.fn(async () => undefined),
}));

vi.mock("@/lib/actions/membership", () => ({
  getLiveMembershipStatus: getMembershipStatus,
}));

import { createOrUpdateReservation } from "./cart-reservations";

/**
 * The reservation path is a `"use server"` action, so it is an ordinary POST
 * endpoint the browser can call with any arguments. Holding stock of a
 * members-only product has to be refused here and not only in the app's API
 * route, or a non-member can park the stock of exactly the products the gate
 * was added to protect.
 */
describe("reserving a members-only product", () => {
  beforeEach(() => {
    for (const fn of [
      account.get,
      adminDb.createRow,
      adminDb.listRows,
      getMembershipStatus,
      sessionDb.createRow,
      sessionDb.getRow,
      sessionDb.listRows,
      sessionDb.updateRow,
    ]) {
      fn.mockReset();
    }
    account.get.mockResolvedValue({ $id: "session-user-1" });
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.createRow.mockResolvedValue({});
  });

  it("refuses a non-member, with a reason the cart can explain", async () => {
    sessionDb.getRow.mockResolvedValue({
      $id: "product-1",
      member_only: true,
      status: "published",
      stock: 5,
    });
    getMembershipStatus.mockResolvedValue({ isMember: false });

    const result = await createOrUpdateReservation("product-1", 2);

    expect(result).toMatchObject({ reason: "members_only", success: false });
    // No hold may be written, or the stock is parked anyway.
    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(sessionDb.createRow).not.toHaveBeenCalled();
  });

  it("lets a member hold it", async () => {
    sessionDb.getRow.mockResolvedValue({
      $id: "product-1",
      member_only: true,
      status: "published",
      stock: 5,
    });
    getMembershipStatus.mockResolvedValue({ isMember: true });

    const result = await createOrUpdateReservation("product-1", 2);

    expect(result).toMatchObject({ quantity: 2, success: true });
    expect(adminDb.createRow).toHaveBeenCalled();
  });

  it("does not ask about membership for an open product", async () => {
    sessionDb.getRow.mockResolvedValue({
      $id: "product-1",
      status: "published",
      stock: 5,
    });

    const result = await createOrUpdateReservation("product-1", 2);

    expect(result).toMatchObject({ success: true });
    expect(getMembershipStatus).not.toHaveBeenCalled();
  });
});

describe("reserving an unpublished product", () => {
  beforeEach(() => {
    for (const fn of [
      account.get,
      adminDb.createRow,
      adminDb.listRows,
      getMembershipStatus,
      sessionDb.createRow,
      sessionDb.getRow,
      sessionDb.listRows,
      sessionDb.updateRow,
    ]) {
      fn.mockReset();
    }
    account.get.mockResolvedValue({ $id: "session-user-1" });
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.createRow.mockResolvedValue({});
  });

  // A draft has never been offered for sale. `webshop_products` grants read to
  // `any`, so without this check a known id can be reserved — and the hold
  // takes real stock off a product nobody was supposed to see yet.
  it.each([
    "draft",
    "pending_approval",
    "archived",
  ])("refuses to hold a %s product", async (status) => {
    sessionDb.getRow.mockResolvedValue({ $id: "product-1", status, stock: 5 });

    const result = await createOrUpdateReservation("product-1", 2);

    expect(result).toMatchObject({ reason: "unavailable", success: false });
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });
});
