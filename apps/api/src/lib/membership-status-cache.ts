import {
  computeMembershipStatus,
  emptyMembershipStatus,
  MembershipComputationError,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { revalidateTag, unstable_cache } from "next/cache";

const MEMBERSHIP_CACHE_TTL_SECONDS = 10 * 60;

/** A forced refresh within this long of the last computation is served from cache. */
export const MEMBERSHIP_REFRESH_FLOOR_MS = 60 * 1000;

function cachedStatus(studentNumber: number): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["api-membership", tag],
    { revalidate: MEMBERSHIP_CACHE_TTL_SECONDS, tags: [tag] }
  )();
}

async function readStatus(studentNumber: number): Promise<MembershipStatus> {
  try {
    return await cachedStatus(studentNumber);
  } catch (error) {
    // `unstable_cache` does not cache a thrown error, so a transient failure
    // is retried on the next read rather than remembered for ten minutes.
    if (error instanceof MembershipComputationError) {
      return emptyMembershipStatus(error.reason);
    }
    console.error("[membership] Unexpected status failure:", error);
    return emptyMembershipStatus("unexpected_error");
  }
}

/**
 * Live 24SevenOffice membership status for one student, cached for ten
 * minutes like the website's.
 *
 * `refresh` recomputes — after a purchase, or when a student pulls to
 * refresh — but no more than once a minute per student, so a client cannot
 * turn this endpoint into a 24SevenOffice load generator.
 */
export async function getMembershipStatusForStudent(
  studentNumber: number,
  { refresh = false }: { refresh?: boolean } = {}
): Promise<MembershipStatus> {
  const status = await readStatus(studentNumber);
  if (!refresh) {
    return status;
  }
  // An uncached failure is always stamped "now", so it never passes this
  // check: recomputing it straight away would only repeat the failing call.
  if (Date.now() - status.checkedAt < MEMBERSHIP_REFRESH_FLOOR_MS) {
    return status;
  }
  revalidateTag(membershipCacheTag(studentNumber), { expire: 0 });
  return readStatus(studentNumber);
}
