import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import { getCustomerCategories } from "@repo/connectors/24sevenoffice";
import { normalizeMembershipDate, osloToday } from "./membership-dates";

export { osloToday } from "./membership-dates";

const DEFAULT_MEMBERSHIP_FINAGO_TIMEOUT_MS = 3000;

export interface MembershipInfo {
  category: string | null;
  expiryDate: string;
  id: string;
  name: string;
  startDate: string;
}

export interface MembershipStatus {
  checkedAt: number;
  /**
   * Matched memberships whose expiry has passed, newest expiry first. Lets a
   * client say when a membership ran out. Optional so existing callers that
   * build a status by hand stay valid.
   */
  expiredMemberships?: MembershipInfo[];
  finagoCategoryIds: number[];
  isMember: boolean;
  memberships: MembershipInfo[];
  reason?: string;
  /**
   * Held memberships that have not started yet (bought for next season),
   * earliest start first. They grant nothing until they start.
   */
  upcomingMemberships?: MembershipInfo[];
}

/**
 * Thrown inside the cached computation to signal a transient failure that must
 * NOT be persisted in the server-side cache. Caught by the caller, which maps
 * `reason` back onto an (uncached) `MembershipStatus`. `unstable_cache` does not
 * cache thrown errors, so this keeps failures out of the cache while successful
 * results (including the legitimate "not a member" negatives) are cached.
 */
export class MembershipComputationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`Membership computation failed: ${reason}`);
    this.name = "MembershipComputationError";
    this.reason = reason;
  }
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function membershipFinagoTimeoutMs(): number {
  return readPositiveInteger(
    process.env.MEMBERSHIP_FINAGO_TIMEOUT_MS,
    DEFAULT_MEMBERSHIP_FINAGO_TIMEOUT_MS
  );
}

async function withDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export type MembershipRowState = "active" | "upcoming" | "expired";

/**
 * Where a `memberships` row stands on Oslo's today: it counts from the whole
 * of its start day through the whole of its expiry day. A plan bought for
 * next season is "upcoming" and grants nothing until it starts.
 *
 * Accepts both `YYYY-MM-DD` and `DD.MM.YYYY` (see `normalizeMembershipDate`).
 * An unreadable date counts as expired: this check exists so memberships stop
 * counting, and bad data must not slip through it.
 */
export function membershipRowState(
  startDate: string | null | undefined,
  expiryDate: string | null | undefined,
  now: Date = new Date()
): MembershipRowState {
  const start = normalizeMembershipDate(startDate);
  const expiry = normalizeMembershipDate(expiryDate);
  if (!(start && expiry)) {
    return "expired";
  }
  const today = osloToday(now);
  if (today < start) {
    return "upcoming";
  }
  return expiry >= today ? "active" : "expired";
}

/** Whether a `memberships` row covers `now` — see `membershipRowState`. */
export function isMembershipRowActive(
  startDate: string | null | undefined,
  expiryDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  return membershipRowState(startDate, expiryDate, now) === "active";
}

export function emptyMembershipStatus(reason: string): MembershipStatus {
  return {
    isMember: false,
    memberships: [],
    finagoCategoryIds: [],
    reason,
    checkedAt: Date.now(),
    expiredMemberships: [],
    upcomingMemberships: [],
  };
}

/**
 * PURE, cacheable computation of membership status keyed by the sanitized
 * numeric student id.
 *
 * This function MUST NOT read `cookies()`, `headers()`, or any request-bound
 * API — it may run detached (via `unstable_cache`) outside the originating
 * request. Everything it needs (the numeric student id) is passed in as an
 * argument. The Appwrite read uses the ADMIN/service-key client
 * (`createAdminClient`), which authenticates with `APPWRITE_API_KEY` and never
 * touches the request session cookie, so it works safely when detached. The
 * security property is preserved because the id is resolved from the
 * authenticated user's own `student_id` in the dynamic part before this runs.
 *
 * On a transient failure (Finago error/timeout) it throws
 * `MembershipComputationError` so the failure is NOT cached; the successful
 * "no categories" / matched results ARE returned normally and cached.
 *
 * A category counts only while its row is active — see `membershipRowState`.
 */
export async function computeMembershipStatus(
  numericId: number,
  now: Date = new Date()
): Promise<MembershipStatus> {
  // 1. Fetch category IDs from Finago (bounded by the per-request deadline).
  let finagoCategoryIds: number[];
  try {
    finagoCategoryIds = await withDeadline(
      getCustomerCategories(numericId),
      membershipFinagoTimeoutMs(),
      "Finago membership category lookup timed out"
    );
  } catch (error) {
    console.error("[Membership] Failed to fetch from Finago:", error);
    throw new MembershipComputationError("finago_error");
  }

  // 2. If no categories, user is (legitimately) not a member — cache this.
  if (!finagoCategoryIds || finagoCategoryIds.length === 0) {
    return emptyMembershipStatus("no_categories");
  }

  // 3. Query active memberships. Uses the admin client so the cached callback
  //    has no dependency on the request session cookie (the `memberships`
  //    table is read("users"); the service key bypasses row permissions).
  const { db } = await createAdminClient();
  const membershipsResponse = await db.listRows<Memberships>(
    "app",
    "memberships",
    [
      Query.equal(
        "category",
        finagoCategoryIds.map((id) => String(id))
      ),
      Query.limit(200),
    ]
  );

  const heldCategories = new Set(finagoCategoryIds.map((id) => String(id)));
  const matched = membershipsResponse.rows.filter(
    (membership) =>
      membership.category !== null &&
      membership.category !== undefined &&
      heldCategories.has(membership.category)
  );

  // 4. A held category counts only between its row's start and expiry.
  const active: Memberships[] = [];
  const upcoming: Memberships[] = [];
  const expired: Memberships[] = [];
  for (const membership of matched) {
    const state = membershipRowState(
      membership.startDate,
      membership.expiryDate,
      now
    );
    if (state === "active") {
      active.push(membership);
      continue;
    }
    if (state === "upcoming") {
      upcoming.push(membership);
      continue;
    }
    if (
      !(
        normalizeMembershipDate(membership.startDate) &&
        normalizeMembershipDate(membership.expiryDate)
      )
    ) {
      console.warn(
        `[Membership] memberships row ${membership.$id} has an unreadable date (start "${membership.startDate}", expiry "${membership.expiryDate}"); treating it as expired`
      );
    }
    expired.push(membership);
  }

  // Dates go out as `YYYY-MM-DD` so callers can sort, compare and render them
  // without knowing which form the row was written in.
  const toInfo = (membership: Memberships): MembershipInfo => ({
    category: membership.category,
    expiryDate:
      normalizeMembershipDate(membership.expiryDate) ?? membership.expiryDate,
    id: membership.$id,
    name: membership.name,
    startDate:
      normalizeMembershipDate(membership.startDate) ?? membership.startDate,
  });
  const expiredInfo = expired
    .map(toInfo)
    .sort((a, b) => (b.expiryDate ?? "").localeCompare(a.expiryDate ?? ""));

  const isMember = active.length > 0;
  let reason: string | undefined;
  if (!isMember && upcoming.length > 0) {
    reason = "upcoming";
  } else if (!isMember && expired.length > 0) {
    reason = "expired";
  }

  return {
    checkedAt: Date.now(),
    expiredMemberships: expiredInfo,
    finagoCategoryIds,
    isMember,
    memberships: active.map(toInfo),
    upcomingMemberships: upcoming
      .map(toInfo)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    ...(reason ? { reason } : {}),
  };
}

export function membershipCacheTag(numericId: number): string {
  return `membership:${numericId}`;
}

/**
 * The membership a member holds for longest — what the pass and the portal
 * show when Finago reports more than one held category.
 */
export function pickCurrentMembership(
  memberships: MembershipInfo[]
): MembershipInfo | null {
  let current: MembershipInfo | null = null;
  for (const membership of memberships) {
    if (!current || membership.expiryDate > current.expiryDate) {
      current = membership;
    }
  }
  return current;
}
