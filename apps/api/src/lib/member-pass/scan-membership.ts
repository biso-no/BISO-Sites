import {
  computeMembershipStatus,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { unstable_cache } from "next/cache";

// Short: a door queue re-checks the same member rarely, and a cancelled
// membership must stop working quickly.
const SCAN_STATUS_TTL_SECONDS = 60;

function cachedMembershipStatus(
  studentNumber: number
): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["api-member-pass-scan", tag],
    { revalidate: SCAN_STATUS_TTL_SECONDS, tags: [tag] }
  )();
}

/** Injectable seams for tests; production calls use the real Next.js cache. */
export interface ScanMembershipLookupDeps {
  compute?: (studentNumber: number) => Promise<MembershipStatus>;
  getCached?: (studentNumber: number) => Promise<MembershipStatus>;
}

/**
 * Live Finago membership for an app scan. Transient failures throw
 * `MembershipComputationError`, which `unstable_cache` does not store.
 *
 * `unstable_cache` is stale-while-revalidate: once an entry is older than
 * `revalidate`, it is served once more while a background refresh runs, and
 * if that refresh throws, the stale entry keeps being served on every
 * request after it — indefinitely, since there is no request path here that
 * ever awaits the refresh. A door scanner cannot afford that: a membership
 * cancelled during a Finago outage must stop scanning in quickly, not stay
 * "valid" until Finago recovers. So a cached result older than the TTL is
 * treated as a miss: this calls `computeMembershipStatus` directly
 * (uncached), so a Finago failure throws here and `verifyScan` reports
 * `unavailable` instead of serving a stale "is a member" result.
 *
 * This does not reuse `getMembershipStatusForStudent`
 * (`apps/api/src/lib/membership-status-cache.ts`): that cache never throws
 * (it swallows failures into an `emptyMembershipStatus`) and holds a ten-
 * minute TTL, which would turn a Finago outage into a stale "not a member"
 * or stale "is a member" answer instead of surfacing as `unavailable`.
 */
export async function getScanMembershipStatus(
  studentNumber: number,
  deps: ScanMembershipLookupDeps = {}
): Promise<MembershipStatus> {
  const compute = deps.compute ?? computeMembershipStatus;
  const getCached = deps.getCached ?? cachedMembershipStatus;

  const status = await getCached(studentNumber);
  const ageMs = Date.now() - status.checkedAt;
  if (ageMs > SCAN_STATUS_TTL_SECONDS * 1000) {
    return compute(studentNumber);
  }
  return status;
}
