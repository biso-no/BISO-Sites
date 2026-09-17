import {
  computeMembershipStatus,
  type MembershipStatus,
} from "@repo/shared/utils/membership-status";

// Short: a door queue re-checks the same member rarely, and a cancelled
// membership must stop working quickly.
export const SCAN_STATUS_TTL_MS = 60_000;

export interface FreshMembershipStatusDeps {
  /** Defaults to the real (uncached) Finago computation. */
  compute?: (studentNumber: number) => Promise<MembershipStatus>;
  /**
   * The caller's cached reader — each app builds its own `unstable_cache`
   * wrapper around `computeMembershipStatus` (its own cache key, its own
   * revalidate tag) and passes it in here. This module stays free of any
   * `next` import so it can be shared by every app, including ones that
   * don't run Next's data cache.
   */
  getCached: (studentNumber: number) => Promise<MembershipStatus>;
  /** Defaults to `Date.now`; injectable for tests. */
  now?: () => number;
}

/**
 * Live Finago membership for a door scan, shared by every app that scans
 * member passes (`apps/admin`'s staff/guest scanner, `apps/api`'s app
 * scanner). Transient failures throw `MembershipComputationError`.
 *
 * A cache built on `unstable_cache` is stale-while-revalidate: once an entry
 * is older than its `revalidate` window, it is served once more while a
 * background refresh runs, and if that refresh throws, the stale entry keeps
 * being served on every request after it — indefinitely, since there is no
 * request path here that ever awaits the refresh. A door scanner cannot
 * afford that: a membership cancelled during a Finago outage must stop
 * scanning in quickly, not stay "valid" until Finago recovers. So a cached
 * result older than `SCAN_STATUS_TTL_MS` is treated as a miss: this calls
 * `compute` directly (uncached), so a Finago failure throws here and
 * `verifyScan` reports `unavailable` instead of serving a stale "is a
 * member" result.
 *
 * This is not the same as a general-purpose membership cache (e.g.
 * `apps/api/src/lib/membership-status-cache.ts`'s
 * `getMembershipStatusForStudent`): those never throw (failures are
 * swallowed into an `emptyMembershipStatus`) and hold a much longer TTL,
 * which would turn a Finago outage into a stale answer instead of
 * `unavailable`.
 */
export async function getFreshMembershipStatus(
  studentNumber: number,
  deps: FreshMembershipStatusDeps
): Promise<MembershipStatus> {
  const compute = deps.compute ?? computeMembershipStatus;
  const now = deps.now ?? Date.now;

  const status = await deps.getCached(studentNumber);
  const ageMs = now() - status.checkedAt;
  if (ageMs > SCAN_STATUS_TTL_MS) {
    return compute(studentNumber);
  }
  return status;
}
