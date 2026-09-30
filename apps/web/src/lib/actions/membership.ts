"use server";

import { createSessionJwt } from "@repo/api/server";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import {
  emptyMembershipStatus,
  type MembershipStatus,
} from "@repo/shared/utils/membership-status";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getLoggedInUser } from "@/lib/actions/user";

export type {
  MembershipInfo,
  MembershipStatus,
} from "@repo/shared/utils/membership-status";

// Membership status is owned by apps/api (`/api/membership?view=status`): it
// holds the only cache, which it invalidates when it fulfils a purchase, and
// the student app reads the same endpoint. This module only forwards the
// signed-in student's session to it — it never talks to 24SevenOffice itself.

const MEMBERSHIP_API_TIMEOUT_MS = 5000;
const HTTP_UNAUTHORIZED = 401;

function isMembershipStatus(value: unknown): value is MembershipStatus {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<MembershipStatus>;
  return (
    typeof candidate.isMember === "boolean" &&
    typeof candidate.checkedAt === "number" &&
    Array.isArray(candidate.memberships) &&
    Array.isArray(candidate.finagoCategoryIds)
  );
}

/**
 * The answer for a visitor with nothing to look up (not signed in, no or an
 * unreadable student id), or `null` when the api should be asked.
 */
async function statusWithoutLookup(): Promise<MembershipStatus | null> {
  // Membership status is per-request state. `connection()` declares that
  // explicitly, so prerendering stops here instead of running on with an
  // empty cookie store.
  await connection();
  try {
    const userData = await getLoggedInUser();
    if (!userData) {
      return emptyMembershipStatus("not_authenticated");
    }
    const studentId = userData.profile?.student_id;
    if (!studentId) {
      return emptyMembershipStatus("no_student_id");
    }
    if (sanitizeStudentNumber(studentId) === null) {
      return emptyMembershipStatus("invalid_student_id");
    }
    return null;
  } catch (error) {
    // Preserve Next.js control-flow signals (prerender bailout, redirect).
    unstable_rethrow(error);
    console.error("[Membership] Unexpected error:", error);
    return emptyMembershipStatus("unexpected_error");
  }
}

async function readFromApi(refresh: boolean): Promise<MembershipStatus> {
  const early = await statusWithoutLookup();
  if (early) {
    return early;
  }

  try {
    // Null only without a usable session; an Appwrite outage throws below.
    const jwt = await createSessionJwt();
    if (!jwt) {
      return emptyMembershipStatus("not_authenticated");
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      console.error("[Membership] NEXT_PUBLIC_API_BASE_URL is not set");
      return emptyMembershipStatus("api_unavailable");
    }

    const query = refresh ? "view=status&refresh=1" : "view=status";
    const response = await fetch(`${apiBaseUrl}/api/membership?${query}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${jwt}` },
      signal: AbortSignal.timeout(MEMBERSHIP_API_TIMEOUT_MS),
    });

    if (response.status === HTTP_UNAUTHORIZED) {
      return emptyMembershipStatus("not_authenticated");
    }
    if (!response.ok) {
      console.error(`[Membership] api answered ${response.status}`);
      return emptyMembershipStatus("api_unavailable");
    }

    const body: unknown = await response.json().catch(() => null);
    if (!isMembershipStatus(body)) {
      console.error("[Membership] api returned an unexpected body");
      return emptyMembershipStatus("api_unavailable");
    }
    return body;
  } catch (error) {
    unstable_rethrow(error);
    console.error("[Membership] Could not reach the api:", error);
    return emptyMembershipStatus("api_unavailable");
  }
}

// One api call per server render: the layout, the page and nested components
// all ask for membership, and they should share a single answer.
const readOncePerRequest = cache(() => readFromApi(false));

/**
 * Membership status for the signed-in student — for prices, badges, the
 * portal and the member pass. Served from apps/api's short-lived cache.
 */
export async function getMembershipStatus(): Promise<MembershipStatus> {
  return await readOncePerRequest();
}

/**
 * Membership status for a gate that is about to REFUSE something (members-only
 * products, members-only vacancies). Asks apps/api to recompute rather than
 * serve its cache, subject to its once-a-minute-per-student floor.
 */
export async function getLiveMembershipStatus(): Promise<MembershipStatus> {
  return await readFromApi(true);
}

/**
 * Force a fresh status — the `/api/membership?refresh=true` route, after a
 * purchase or when the student asks.
 */
export async function refreshMembershipStatus(): Promise<MembershipStatus> {
  return await readFromApi(true);
}
