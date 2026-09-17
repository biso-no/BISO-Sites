import {
  computeMembershipStatus,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { unstable_cache } from "next/cache";

// Short: a door queue re-checks the same member rarely, and a cancelled
// membership must stop working quickly.
const SCAN_STATUS_TTL_SECONDS = 60;

/**
 * Live Finago membership for a scan. Transient failures throw
 * `MembershipComputationError`, which `unstable_cache` does not store.
 */
export function getScanMembershipStatus(
  studentNumber: number
): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["member-pass-scan", tag],
    { revalidate: SCAN_STATUS_TTL_SECONDS, tags: [tag] }
  )();
}
