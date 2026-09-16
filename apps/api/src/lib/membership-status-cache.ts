import {
  computeMembershipStatus,
  emptyMembershipStatus,
  MembershipComputationError,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { revalidateTag, unstable_cache } from "next/cache";

const MEMBERSHIP_CACHE_TTL_SECONDS = 10 * 60;

// This cache is app-local, despite sharing `membershipCacheTag` with the
// website's (apps/web/src/lib/actions/membership.ts). They are two separate
// Next data caches in two separate deployments, so a `revalidateTag` here
// never reaches the website's copy and vice versa — and neither is
// invalidated when a purchase is fulfilled.
//
// The practical effect: a membership bought on one surface stays invisible to
// the other until that side's own ten-minute TTL expires. The app's
// post-purchase `?refresh=1` shortens its own wait, but it is floored to once
// a minute per student (MEMBERSHIP_REFRESH_FLOOR_MS), so the app can still
// say "not a member yet" for up to a minute after paying.

/** A forced refresh within this long of the last computation is served from cache. */
export const MEMBERSHIP_REFRESH_FLOOR_MS = 60 * 1000;

/**
 * Failures are deliberately not cached by `unstable_cache`, so during a
 * 24SevenOffice outage every request would recompute and call it again.
 * This map throttles failing reads per student: each server instance holds
 * its own map, which is enough to stop the amplification.
 */
const recentFailures = new Map<number, { at: number; reason: string }>();

function cachedStatus(studentNumber: number): Promise<MembershipStatus> {
  const tag = membershipCacheTag(studentNumber);
  return unstable_cache(
    () => computeMembershipStatus(studentNumber),
    ["api-membership", tag],
    { revalidate: MEMBERSHIP_CACHE_TTL_SECONDS, tags: [tag] }
  )();
}

async function readStatus(studentNumber: number): Promise<MembershipStatus> {
  // Check if this student's read has recently failed and is still within
  // the floor window.
  const recentFailure = recentFailures.get(studentNumber);
  if (
    recentFailure &&
    Date.now() - recentFailure.at < MEMBERSHIP_REFRESH_FLOOR_MS
  ) {
    return emptyMembershipStatus(recentFailure.reason);
  }
  if (recentFailure) {
    // Entry exists but is older than the floor; discard it.
    recentFailures.delete(studentNumber);
  }

  try {
    const status = await cachedStatus(studentNumber);
    recentFailures.delete(studentNumber);
    return status;
  } catch (error) {
    // `unstable_cache` does not cache a thrown error, so without the
    // failure throttle above, a transient failure would cause every request
    // to call 24SevenOffice again. Record this failure for future calls.
    const reason =
      error instanceof MembershipComputationError
        ? error.reason
        : "unexpected_error";
    recentFailures.set(studentNumber, { at: Date.now(), reason });

    if (!(error instanceof MembershipComputationError)) {
      console.error("[membership] Unexpected status failure:", error);
    }

    // Keep the map from growing without bound.
    if (recentFailures.size > 500) {
      const floor = Date.now() - MEMBERSHIP_REFRESH_FLOOR_MS;
      for (const [num, entry] of recentFailures) {
        if (entry.at < floor) {
          recentFailures.delete(num);
        }
      }
    }

    return emptyMembershipStatus(reason);
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
  // A just-failed read returns early from readStatus via the failure throttle.
  // Repeat requests are held off by the throttle in readStatus and the cache TTL.
  if (Date.now() - status.checkedAt < MEMBERSHIP_REFRESH_FLOOR_MS) {
    return status;
  }
  revalidateTag(membershipCacheTag(studentNumber), { expire: 0 });
  return readStatus(studentNumber);
}
