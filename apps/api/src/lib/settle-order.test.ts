import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateMembershipStatus: vi.fn(),
  settleOrderIfPaid: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/shared/utils/order-settlement", () => ({
  settleOrderIfPaid: mocks.settleOrderIfPaid,
}));
vi.mock("@/lib/membership-status-cache", () => ({
  invalidateMembershipStatus: mocks.invalidateMembershipStatus,
}));

import { settleOrder } from "./settle-order";

const db = {} as never;

describe("settleOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("invalidates the buyer's membership status after fulfilling it", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({
      membershipStudentNumber: 1_715_738,
    });

    await settleOrder("order-1", db);

    expect(mocks.settleOrderIfPaid).toHaveBeenCalledWith("order-1", db);
    expect(mocks.invalidateMembershipStatus).toHaveBeenCalledWith(1_715_738);
  });

  it("leaves the cache alone when nothing was fulfilled", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({});

    await settleOrder("order-1", db);

    expect(mocks.invalidateMembershipStatus).not.toHaveBeenCalled();
  });

  it("does not throw when invalidation fails", async () => {
    mocks.settleOrderIfPaid.mockResolvedValue({
      membershipStudentNumber: 1_715_738,
    });
    mocks.invalidateMembershipStatus.mockImplementation(() => {
      throw new Error("static generation store missing");
    });

    await expect(settleOrder("order-1", db)).resolves.toBeUndefined();
  });
});
