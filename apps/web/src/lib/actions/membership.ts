"use server";

import { Query } from "@repo/api/client";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Memberships, Users } from "@repo/api/types/appwrite";
import { getCustomerCategories } from "@repo/connectors/24sevenoffice";
import { cookies } from "next/headers";

// Cookie configuration
const MEMBERSHIP_COOKIE_NAME = "biso_membership";
const COOKIE_TTL_SECONDS = 10 * 60; // 10 minutes

export type MembershipInfo = {
  id: string;
  name: string;
  category: string | null;
  startDate: string;
  expiryDate: string;
};

export type MembershipStatus = {
  isMember: boolean;
  memberships: MembershipInfo[];
  finagoCategoryIds: number[];
  reason?: string;
  checkedAt: number;
};

type CachedMembershipData = {
  status: MembershipStatus;
  expiresAt: number;
};

/**
 * Get membership status for the current user.
 * Uses a short-lived cookie cache to avoid calling Finago on every request.
 *
 * This function is SSR-compatible and can be used in:
 * - Server Components
 * - Server Actions
 * - API Routes
 * - Layouts
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  const cookieStore = await cookies();

  // 1. Check for cached membership in cookie
  const cached = getCachedMembership(cookieStore);
  if (cached) {
    console.log("[Membership] Using cached membership status");
    return cached;
  }

  // 2. No valid cache - fetch fresh data
  console.log("[Membership] Cache miss - fetching from Finago");
  const freshStatus = await fetchMembershipFromFinago();

  // 3. Cache the result in a cookie
  cacheMembershipStatus(cookieStore, freshStatus);

  return freshStatus;
}

/**
 * Force refresh the membership status, bypassing the cache.
 * Useful for when you know the data has changed.
 */
export async function refreshMembershipStatus(): Promise<MembershipStatus> {
  const cookieStore = await cookies();

  console.log("[Membership] Force refreshing membership status");
  const freshStatus = await fetchMembershipFromFinago();
  cacheMembershipStatus(cookieStore, freshStatus);

  return freshStatus;
}

/**
 * Clear the membership cache.
 * Call this on logout or when you want to force a fresh check.
 */
export async function clearMembershipCache(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MEMBERSHIP_COOKIE_NAME);
  console.log("[Membership] Cache cleared");
}

/**
 * Get cached membership from cookie if valid
 */
function getCachedMembership(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): MembershipStatus | null {
  try {
    const cookie = cookieStore.get(MEMBERSHIP_COOKIE_NAME);
    if (!cookie?.value) {
      return null;
    }

    const data: CachedMembershipData = JSON.parse(cookie.value);

    // Check if cache is still valid
    if (Date.now() > data.expiresAt) {
      console.log("[Membership] Cache expired");
      return null;
    }

    return data.status;
  } catch (error) {
    console.error("[Membership] Error reading cache:", error);
    return null;
  }
}

/**
 * Cache membership status in a cookie.
 * Note: This will only succeed in a Server Action or Route Handler context.
 * When called from a Server Component render, the set operation will fail silently.
 */
function cacheMembershipStatus(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  status: MembershipStatus
): void {
  const data: CachedMembershipData = {
    status,
    expiresAt: Date.now() + COOKIE_TTL_SECONDS * 1000,
  };

  try {
    cookieStore.set(MEMBERSHIP_COOKIE_NAME, JSON.stringify(data), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_TTL_SECONDS,
      path: "/",
    });
  } catch {
    // Cookie setting is not allowed in Server Component render context.
    // This is expected when getMembershipStatus is called from a layout or page.
    // The cache will be populated on next Server Action call.
    console.log(
      "[Membership] Cannot cache in render context - will cache on next action"
    );
  }
}

/**
 * Fetch fresh membership status from Finago
 */
async function fetchMembershipFromFinago(): Promise<MembershipStatus> {
  const notAuthenticated: MembershipStatus = {
    isMember: false,
    memberships: [],
    finagoCategoryIds: [],
    reason: "not_authenticated",
    checkedAt: Date.now(),
  };

  try {
    // 1. Check if user is authenticated
    const cookieStore = await cookies();
    const session = cookieStore.get("a_session_biso");
    if (!session) {
      return notAuthenticated;
    }

    // 2. Get user profile
    let profile: Users | null = null;
    try {
      const { account, db: sessionDb } = await createSessionClient();
      const currentUser = await account.get();

      // Check if this is a real authenticated user
      const hasEmail = currentUser.email && currentUser.email.length > 0;
      const hasRealName =
        currentUser.name &&
        currentUser.name.length > 0 &&
        !currentUser.name.startsWith("guest_");
      const isEmailVerified = currentUser.emailVerification;

      if (!(hasEmail || (hasRealName && isEmailVerified))) {
        return notAuthenticated;
      }

      profile = await sessionDb.getRow<Users>("app", "user", currentUser.$id);
    } catch (error) {
      console.error("[Membership] Failed to get user profile:", error);
      return notAuthenticated;
    }

    // 3. Get student_id from profile
    const studentId = profile?.student_id;
    if (!studentId) {
      return {
        isMember: false,
        memberships: [],
        finagoCategoryIds: [],
        reason: "no_student_id",
        checkedAt: Date.now(),
      };
    }

    // 4. Sanitize student_id to get numeric company ID
    const sanitizedId = studentId.replace(/[^0-9]/g, "");
    if (!sanitizedId) {
      return {
        isMember: false,
        memberships: [],
        finagoCategoryIds: [],
        reason: "invalid_student_id",
        checkedAt: Date.now(),
      };
    }

    const numericId = Number.parseInt(sanitizedId, 10);

    // 5. Fetch category IDs from Finago
    let finagoCategoryIds: number[];
    try {
      finagoCategoryIds = await getCustomerCategories(numericId);
      console.log(
        `[Membership] Finago category IDs for ${numericId}:`,
        finagoCategoryIds
      );
    } catch (error) {
      console.error("[Membership] Failed to fetch from Finago:", error);
      return {
        isMember: false,
        memberships: [],
        finagoCategoryIds: [],
        reason: "finago_error",
        checkedAt: Date.now(),
      };
    }

    // 6. If no categories, user is not a member
    if (!finagoCategoryIds || finagoCategoryIds.length === 0) {
      return {
        isMember: false,
        memberships: [],
        finagoCategoryIds: [],
        reason: "no_categories",
        checkedAt: Date.now(),
      };
    }

    // 7. Query active memberships from database
    const { db } = await createAdminClient();
    const membershipsResponse = await db.listRows<Memberships>(
      "app",
      "memberships",
      [Query.equal("status", true)]
    );

    const activeMemberships = membershipsResponse.rows;
    const finagoCategoryIdStrings = finagoCategoryIds.map((id) => String(id));

    // 8. Match Finago category IDs with membership categories
    const matchedMemberships = activeMemberships.filter((membership) => {
      if (!membership.category) {
        return false;
      }
      return finagoCategoryIdStrings.includes(membership.category);
    });

    const isMember = matchedMemberships.length > 0;

    console.log(
      `[Membership] User is ${isMember ? "a member" : "not a member"}`
    );

    return {
      isMember,
      memberships: matchedMemberships.map((m) => ({
        id: m.$id,
        name: m.name,
        category: m.category,
        startDate: m.startDate,
        expiryDate: m.expiryDate,
      })),
      finagoCategoryIds,
      checkedAt: Date.now(),
    };
  } catch (error) {
    console.error("[Membership] Unexpected error:", error);
    return {
      isMember: false,
      memberships: [],
      finagoCategoryIds: [],
      reason: "unexpected_error",
      checkedAt: Date.now(),
    };
  }
}
