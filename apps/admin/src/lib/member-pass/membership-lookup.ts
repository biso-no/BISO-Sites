import {
  type FreshMembershipStatusDeps,
  getFreshMembershipStatus,
} from "@repo/shared/member-pass/scan-membership";
import {
  computeMembershipStatus,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { unstable_cache } from "next/cache";

// Short: a door queue re-checks the same member rarely, and a cancelled
// membership must stop working quickly. Kept in sync with
// `@repo/shared/member-pass/scan-membership`'s `SCAN_STATUS_TTL_MS`.
const SCAN_STATUS_TTL_SECONDS = 60;

function cachedMembershipStatus(
  studentNumber: number
): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["member-pass-scan", tag],
    { revalidate: SCAN_STATUS_TTL_SECONDS, tags: [tag] }
  )();
}

/** Injectable seams for tests; production calls use the real Next.js cache. */
export type ScanMembershipLookupDeps = Partial<FreshMembershipStatusDeps>;

/**
 * Live Finago membership for a scan: this app's own `unstable_cache` reader
 * (own cache key, own revalidate tag) plumbed into the shared freshness rule
 * (`@repo/shared/member-pass/scan-membership`). See that module for why a
 * stale cache entry is treated as a miss instead of being served — a door
 * scanner cannot afford a Finago outage to look like a valid pass.
 */
export function getScanMembershipStatus(
  studentNumber: number,
  deps: ScanMembershipLookupDeps = {}
): Promise<MembershipStatus> {
  return getFreshMembershipStatus(studentNumber, {
    getCached: cachedMembershipStatus,
    ...deps,
  });
}
