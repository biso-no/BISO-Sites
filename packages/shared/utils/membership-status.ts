import { Query } from "@repo/api/client";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import { getCustomerCategories } from "@repo/connectors/24sevenoffice";
import { normalizeMembershipDate } from "./membership-dates";

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

const osloDateFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

/** Today's calendar date in Oslo, as `YYYY-MM-DD`. */
export function osloToday(now: Date = new Date()): string {
  return osloDateFormat.format(now);
}

/**
 * Whether a `memberships` row still covers `now`: a membership is valid
 * through the whole of its expiry day in Oslo.
 *
 * Accepts both `YYYY-MM-DD` and `DD.MM.YYYY` (see `normalizeMembershipDate`).
 * A date that cannot be read counts as expired. This check exists so expired
 * memberships stop counting; an unreadable date must not slip through it.
 */
export function isMembershipRowActive(
  expiryDate: string | null | undefined,
  now: Date = new Date()
): boolean {
  const expiry = normalizeMembershipDate(expiryDate);
  if (!expiry) {
    return false;
  }
  return expiry >= osloToday(now);
}

export function emptyMembershipStatus(reason: string): MembershipStatus {
  return {
    isMember: false,
    memberships: [],
    finagoCategoryIds: [],
    reason,
    checkedAt: Date.now(),
    expiredMemberships: [],
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
 * A category counts only while its row has not expired — see `isMembershipRowActive`.
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
    [Query.equal("status", true), Query.limit(200)]
  );

  const heldCategories = new Set(finagoCategoryIds.map((id) => String(id)));
  const matched = membershipsResponse.rows.filter(
    (membership) =>
      membership.category !== null &&
      membership.category !== undefined &&
      heldCategories.has(membership.category)
  );

  // 4. A held category counts only while its row has not expired.
  const active: Memberships[] = [];
  const expired: Memberships[] = [];
  for (const membership of matched) {
    if (isMembershipRowActive(membership.expiryDate, now)) {
      active.push(membership);
      continue;
    }
    if (!normalizeMembershipDate(membership.expiryDate)) {
      console.warn(
        `[Membership] memberships row ${membership.$id} has an unreadable expiryDate "${membership.expiryDate}"; treating it as expired`
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

  return {
    checkedAt: Date.now(),
    expiredMemberships: expiredInfo,
    finagoCategoryIds,
    isMember,
    memberships: active.map(toInfo),
    ...(isMember || expired.length === 0 ? {} : { reason: "expired" }),
  };
}

export function membershipCacheTag(numericId: number): string {
  return `membership:${numericId}`;
}
