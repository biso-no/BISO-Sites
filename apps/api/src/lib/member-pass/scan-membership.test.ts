import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScanMembershipStatus } from "./scan-membership";

// Injected rather than a `vi.mock` of "@repo/shared/utils/membership-status":
// keeps this test decoupled from the real Finago-computation module, same
// reasoning as apps/admin's membership-lookup.test.ts.
const compute = vi.fn();
const getCached = vi.fn();

const BASE_STATUS = {
  checkedAt: Date.now(),
  finagoCategoryIds: [113_176],
  isMember: true,
  memberships: [],
};

const STALE_AGE_MS = 61_000;

describe("getScanMembershipStatus", () => {
  beforeEach(() => {
    compute.mockReset();
    getCached.mockReset();
  });

  it("returns the cached status when it is still fresh", async () => {
    const fresh = { ...BASE_STATUS, checkedAt: Date.now() };
    getCached.mockResolvedValue(fresh);

    const result = await getScanMembershipStatus(1_715_738, {
      compute,
      getCached,
    });

    expect(result).toBe(fresh);
    expect(getCached).toHaveBeenCalledWith(1_715_738);
    expect(compute).not.toHaveBeenCalled();
  });

  it("recomputes directly, bypassing the cache, once the entry is stale", async () => {
    const stale = { ...BASE_STATUS, checkedAt: Date.now() - STALE_AGE_MS };
    const recomputed = { ...BASE_STATUS, checkedAt: Date.now() };
    getCached.mockResolvedValue(stale);
    compute.mockResolvedValue(recomputed);

    const result = await getScanMembershipStatus(1_715_738, {
      compute,
      getCached,
    });

    expect(result).toBe(recomputed);
    expect(compute).toHaveBeenCalledWith(1_715_738);
  });

  it("propagates a Finago failure instead of serving a stale cached member", async () => {
    const stale = { ...BASE_STATUS, checkedAt: Date.now() - STALE_AGE_MS };
    getCached.mockResolvedValue(stale);
    const error = new Error("finago down");
    compute.mockRejectedValue(error);

    await expect(
      getScanMembershipStatus(1_715_738, { compute, getCached })
    ).rejects.toThrow("finago down");
    expect(compute).toHaveBeenCalledWith(1_715_738);
  });
});
