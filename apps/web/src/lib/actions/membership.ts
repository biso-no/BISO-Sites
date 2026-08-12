"use server";

import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import {
  computeMembershipStatus,
  emptyMembershipStatus,
  MembershipComputationError,
  type MembershipStatus,
  membershipCacheTag,
} from "@repo/shared/utils/membership-status";
import { revalidateTag, unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getLoggedInUser } from "@/lib/actions/user";

export type {
  MembershipInfo,
  MembershipStatus,
} from "@repo/shared/utils/membership-status";

// Server-side cache TTL for the resolved membership status, in seconds.
const MEMBERSHIP_CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * Server-side cached wrapper around `computeMembershipStatus`, keyed per user
 * by the numeric student id. Persists across requests and users correctly,
 * needs no cookie write, and cannot be spoofed by the client. Cache is
 * invalidated after `MEMBERSHIP_CACHE_TTL_SECONDS` or via `revalidateTag`.
 */
function getCachedMembershipStatus(
  numericId: number
): Promise<MembershipStatus> {
  const cacheTag = membershipCacheTag(numericId);
  return unstable_cache(
    () => computeMembershipStatus(numericId),
    ["membership", cacheTag],
    {
      revalidate: MEMBERSHIP_CACHE_TTL_SECONDS,
      tags: ["membership", cacheTag],
    }
  )();
}

/**
 * Read the cached membership status for a numeric student id, mapping the
 * non-cached failure signal back onto an error `MembershipStatus`.
 */
async function resolveMembershipStatus(
  numericId: number
): Promise<MembershipStatus> {
  try {
    return await getCachedMembershipStatus(numericId);
  } catch (error) {
    if (error instanceof MembershipComputationError) {
      return emptyMembershipStatus(error.reason);
    }
    // Preserve Next.js control-flow signals (prerender bailout, redirect).
    unstable_rethrow(error);
    console.error("[Membership] Unexpected error:", error);
    return emptyMembershipStatus("unexpected_error");
  }
}

/**
 * DYNAMIC part: resolve the current authenticated account and its numeric
 * student id. Reads cookies/session, so it must stay dynamic and cannot run
 * inside `unstable_cache`. Returns either the numeric id to look up, or a
 * terminal `MembershipStatus` for the not-authenticated / no-student-id cases.
 */
async function resolveCurrentStudentId(): Promise<
  { numericId: number } | { status: MembershipStatus }
> {
  // Membership status is per-request state (session-derived, wall-clock
  // `checkedAt` stamps). `connection()` declares that explicitly, so
  // prerendering stops here instead of running into `Date.now()` — the
  // cookie read alone doesn't abort the prerender pass, it just resolves
  // to an empty store and would let execution continue.
  await connection();
  try {
    // 1.+2. Resolve the authenticated account + profile through the
    // request-memoized getLoggedInUser() so the layout's call and this one
    // share a single account.get()/profile read per render.
    const userData = await getLoggedInUser();
    if (!userData) {
      return { status: emptyMembershipStatus("not_authenticated") };
    }

    // 3. Get student_id from profile
    const studentId = userData.profile?.student_id;
    if (!studentId) {
      return { status: emptyMembershipStatus("no_student_id") };
    }

    // 4. Sanitize student_id to get numeric company ID
    const numericId = sanitizeStudentNumber(studentId);
    if (numericId === null) {
      return { status: emptyMembershipStatus("invalid_student_id") };
    }

    return { numericId };
  } catch (error) {
    // Preserve Next.js control-flow signals (prerender bailout, redirect)
    // rethrown out of getLoggedInUser() — swallowing them lets prerendering
    // run past the dynamic access and trips blocking-prerender errors.
    unstable_rethrow(error);
    console.error("[Membership] Unexpected error:", error);
    return { status: emptyMembershipStatus("unexpected_error") };
  }
}

/**
 * Get membership status for the current user.
 *
 * Resolves the authenticated user's student id (dynamic, cookie-bound) and then
 * reads a server-side cache keyed by that id — so the expensive Finago SOAP call
 * + DB match only run on a cache miss and are shared safely across requests.
 *
 * SSR-compatible: usable in Server Components, Server Actions, API Routes, and
 * Layouts. Never writes cookies, so it is safe to call during render.
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  const resolved = await resolveCurrentStudentId();
  if ("status" in resolved) {
    return resolved.status;
  }
  return resolveMembershipStatus(resolved.numericId);
}

/**
 * Force refresh the membership status, bypassing the cache by invalidating the
 * per-user cache tag before re-reading. Must be called from a Server Action or
 * Route Handler (where `revalidateTag` is allowed), e.g. the `/api/membership`
 * route with `?refresh=true`.
 */
export async function refreshMembershipStatus(): Promise<MembershipStatus> {
  const resolved = await resolveCurrentStudentId();
  if ("status" in resolved) {
    return resolved.status;
  }

  // `{ expire: 0 }` purges the tag immediately with read-your-own-writes
  // semantics, so the re-read below returns freshly computed data. (`updateTag`
  // is Server-Action-only and would throw from this route handler.)
  revalidateTag(membershipCacheTag(resolved.numericId), { expire: 0 });
  return resolveMembershipStatus(resolved.numericId);
}
