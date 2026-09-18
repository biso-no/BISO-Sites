import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFreshMembershipStatus } from "./scan-membership";

// Injected rather than a `vi.mock` of "@repo/shared/utils/membership-status":
// verify-scan.test.ts imports the real module (for `MembershipComputationError`)
// and module mocks can leak across test files run together.
const compute = vi.fn();
const getCached = vi.fn();
const now = vi.fn();

const BASE_STATUS = {
  checkedAt: 1_000_000,
  finagoCategoryIds: [113_176],
  isMember: true,
  memberships: [],
};

const FRESH_NOW = 1_000_000;
const BOUNDARY_NOW = 1_060_000; // exactly 60_000ms after checkedAt
const STALE_NOW = 1_060_001; // one ms past the boundary

describe("getFreshMembershipStatus", () => {
  beforeEach(() => {
    compute.mockReset();
    getCached.mockReset();
    now.mockReset();
  });

  it("returns the cached status when it is still fresh", async () => {
    const fresh = { ...BASE_STATUS, checkedAt: FRESH_NOW };
    getCached.mockResolvedValue(fresh);
    now.mockReturnValue(FRESH_NOW);

    const result = await getFreshMembershipStatus(1_715_738, {
      compute,
      getCached,
      now,
    });

    expect(result).toBe(fresh);
    expect(getCached).toHaveBeenCalledWith(1_715_738);
    expect(compute).not.toHaveBeenCalled();
  });

  it("still serves the cache at exactly the 60s boundary (age <= TTL is fresh)", async () => {
    const status = { ...BASE_STATUS, checkedAt: BASE_STATUS.checkedAt };
    getCached.mockResolvedValue(status);
    now.mockReturnValue(BOUNDARY_NOW);

    const result = await getFreshMembershipStatus(1_715_738, {
      compute,
      getCached,
      now,
    });

    expect(result).toBe(status);
    expect(compute).not.toHaveBeenCalled();
  });

  it("recomputes directly, bypassing the cache, once the entry is one ms past the boundary", async () => {
    const stale = { ...BASE_STATUS, checkedAt: BASE_STATUS.checkedAt };
    const recomputed = { ...BASE_STATUS, checkedAt: STALE_NOW };
    getCached.mockResolvedValue(stale);
    compute.mockResolvedValue(recomputed);
    now.mockReturnValue(STALE_NOW);

    const result = await getFreshMembershipStatus(1_715_738, {
      compute,
      getCached,
      now,
    });

    expect(result).toBe(recomputed);
    expect(compute).toHaveBeenCalledWith(1_715_738);
  });

  it("propagates a Finago failure instead of serving a stale cached member", async () => {
    const stale = { ...BASE_STATUS, checkedAt: BASE_STATUS.checkedAt };
    getCached.mockResolvedValue(stale);
    now.mockReturnValue(STALE_NOW);
    const error = new Error("finago down");
    compute.mockRejectedValue(error);

    await expect(
      getFreshMembershipStatus(1_715_738, { compute, getCached, now })
    ).rejects.toThrow("finago down");
    expect(compute).toHaveBeenCalledWith(1_715_738);
  });

  it("defaults `now` to the real clock when omitted", async () => {
    const fresh = { ...BASE_STATUS, checkedAt: Date.now() };
    getCached.mockResolvedValue(fresh);

    const result = await getFreshMembershipStatus(1_715_738, { getCached });

    expect(result).toBe(fresh);
    expect(compute).not.toHaveBeenCalled();
  });
});
