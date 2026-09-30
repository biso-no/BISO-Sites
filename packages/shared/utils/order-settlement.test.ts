import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fulfilMembershipOrder: vi.fn(),
  isMembershipOrder: vi.fn(),
  postFinagoTransactionForOrder: vi.fn(),
}));

vi.mock("./finago-order-posting", () => ({
  postFinagoTransactionForOrder: mocks.postFinagoTransactionForOrder,
}));
vi.mock("./membership-fulfilment", () => ({
  fulfilMembershipOrder: mocks.fulfilMembershipOrder,
  isMembershipOrder: mocks.isMembershipOrder,
}));

import { settleOrderIfPaid } from "./order-settlement";

const db = { getRow: vi.fn() };

describe("settleOrderIfPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    db.getRow.mockResolvedValue({ $id: "order-1", status: "paid" });
  });

  it("reports the student whose membership it fulfilled", async () => {
    mocks.isMembershipOrder.mockReturnValue(true);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: true,
      invoiceId: 1,
      studentNumber: 1_715_738,
    });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual({
      membershipStudentNumber: 1_715_738,
    });
  });

  it("reports nothing when the membership was not fulfilled on this call", async () => {
    mocks.isMembershipOrder.mockReturnValue(true);
    mocks.fulfilMembershipOrder.mockResolvedValue({
      fulfilled: false,
      reason: "already_fulfilled",
    });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
  });

  it("reports nothing for a shop order", async () => {
    mocks.isMembershipOrder.mockReturnValue(false);

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
    expect(mocks.postFinagoTransactionForOrder).toHaveBeenCalledWith(
      "order-1",
      db
    );
  });

  it("reports nothing for an unpaid order", async () => {
    db.getRow.mockResolvedValue({ $id: "order-1", status: "pending" });

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
    expect(mocks.fulfilMembershipOrder).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    db.getRow.mockRejectedValue(new Error("appwrite down"));

    await expect(settleOrderIfPaid("order-1", db as never)).resolves.toEqual(
      {}
    );
  });
});
