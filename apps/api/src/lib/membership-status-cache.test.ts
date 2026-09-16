import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const computeMembershipStatus = vi.hoisted(() => vi.fn());
const revalidateTag = vi.hoisted(() => vi.fn());
const MembershipComputationError = vi.hoisted(
  () =>
    class MembershipComputationError extends Error {
      readonly reason: string;
      constructor(reason: string) {
        super(reason);
        this.reason = reason;
      }
    }
);

vi.mock("next/cache", () => ({
  revalidateTag,
  unstable_cache: (work: () => Promise<unknown>) => work,
}));
vi.mock("@repo/shared/utils/membership-status", () => ({
  computeMembershipStatus,
  emptyMembershipStatus: (reason: string) => ({
    checkedAt: Date.now(),
    expiredMemberships: [],
    finagoCategoryIds: [],
    isMember: false,
    memberships: [],
    reason,
  }),
  MembershipComputationError,
  membershipCacheTag: (studentNumber: number) => `membership:${studentNumber}`,
}));

import { getMembershipStatusForStudent } from "./membership-status-cache";

function statusCheckedAgo(ms: number, isMember = true) {
  return {
    checkedAt: Date.now() - ms,
    finagoCategoryIds: [113_178],
    isMember,
    memberships: [],
  };
}

describe("getMembershipStatusForStudent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves the cached status without forcing a recompute", async () => {
    computeMembershipStatus.mockResolvedValue(statusCheckedAgo(5 * 60_000));

    await getMembershipStatusForStudent(1_715_738);

    expect(computeMembershipStatus).toHaveBeenCalledTimes(1);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("recomputes on refresh when the cached status is more than a minute old", async () => {
    const fresh = statusCheckedAgo(0, false);
    computeMembershipStatus
      .mockResolvedValueOnce(statusCheckedAgo(5 * 60_000))
      .mockResolvedValueOnce(fresh);

    const status = await getMembershipStatusForStudent(1_715_738, {
      refresh: true,
    });

    expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
      expire: 0,
    });
    expect(computeMembershipStatus).toHaveBeenCalledTimes(2);
    expect(status).toBe(fresh);
  });

  it("serves a status less than a minute old even when asked to refresh", async () => {
    computeMembershipStatus.mockResolvedValue(statusCheckedAgo(10_000));

    await getMembershipStatusForStudent(1_715_738, { refresh: true });

    expect(revalidateTag).not.toHaveBeenCalled();
    expect(computeMembershipStatus).toHaveBeenCalledTimes(1);
  });

  it("turns a transient 24SevenOffice failure into an unavailable status", async () => {
    computeMembershipStatus.mockRejectedValue(
      new MembershipComputationError("finago_error")
    );

    const status = await getMembershipStatusForStudent(1_715_738, {
      refresh: true,
    });

    expect(status).toMatchObject({ isMember: false, reason: "finago_error" });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  // Failure throttling tests use separate student numbers so the module-level
  // map cannot leak between tests.
  it("does not recompute on a second call straight after a failure", async () => {
    computeMembershipStatus.mockRejectedValue(
      new MembershipComputationError("finago_error")
    );

    const first = await getMembershipStatusForStudent(2_000_000);
    const second = await getMembershipStatusForStudent(2_000_000);

    expect(first).toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
    expect(second).toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
    expect(computeMembershipStatus).toHaveBeenCalledTimes(1);
  });

  it("holds off ordinary requests after a failed refresh", async () => {
    computeMembershipStatus.mockRejectedValue(
      new MembershipComputationError("finago_error")
    );

    const first = await getMembershipStatusForStudent(2_000_001, {
      refresh: true,
    });
    const second = await getMembershipStatusForStudent(2_000_001);

    expect(first).toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
    expect(second).toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
    expect(computeMembershipStatus).toHaveBeenCalledTimes(1);
  });

  it("recomputes once the throttle window passes", async () => {
    const fresh = statusCheckedAgo(0, false);
    computeMembershipStatus
      .mockRejectedValueOnce(new MembershipComputationError("finago_error"))
      .mockResolvedValueOnce(fresh);

    await getMembershipStatusForStudent(2_000_002);

    vi.setSystemTime(new Date(Date.now() + 61 * 1000));

    const status = await getMembershipStatusForStudent(2_000_002);

    expect(status).toBe(fresh);
    expect(computeMembershipStatus).toHaveBeenCalledTimes(2);
  });

  it("clears the failure throttle on a successful read", async () => {
    computeMembershipStatus
      .mockRejectedValueOnce(new MembershipComputationError("finago_error"))
      .mockResolvedValueOnce(statusCheckedAgo(0));

    // First call fails and records throttle
    const first = await getMembershipStatusForStudent(2_000_003);
    expect(first).toMatchObject({
      isMember: false,
      reason: "finago_error",
    });

    // Advance past the throttle window
    vi.setSystemTime(new Date(Date.now() + 61 * 1000));

    // Second call recomputes and succeeds
    const second = await getMembershipStatusForStudent(2_000_003);
    expect(second.isMember).toBe(true);

    // Throttle is now cleared, so a new failure will be recorded fresh
    // (rather than suppressed by the old failure)
    computeMembershipStatus.mockRejectedValueOnce(
      new MembershipComputationError("finago_error_2")
    );
    const third = await getMembershipStatusForStudent(2_000_003);
    expect(third).toMatchObject({
      isMember: false,
      reason: "finago_error_2",
    });

    expect(computeMembershipStatus).toHaveBeenCalledTimes(3);
  });
});
