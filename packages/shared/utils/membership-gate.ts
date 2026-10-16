import type { MembershipPlan } from "./membership-plans";
import { selectOffers } from "./membership-seasons";

export type MembershipGateState =
  | "signed_out"
  | "needs_bi_link"
  | "needs_directory_record"
  | "membership_check_unavailable"
  | "already_member"
  | "no_plans_available"
  | "eligible";

// `MembershipStatus.reason` values that mean the check itself failed
// transiently — Finago timed out or errored, the profile could not be read,
// or the website could not reach apps/api — as opposed to a legitimate
// resolved state such as `no_categories` (genuinely not a member) or
// `not_authenticated`/`no_student_id`/`invalid_student_id` (already handled by
// the earlier gate checks in this function, before `status.reason` is even
// consulted).
const TRANSIENT_STATUS_REASONS: ReadonlySet<string> = new Set([
  "api_unavailable",
  "finago_error",
  "profile_unavailable",
  "unexpected_error",
]);

/** True when a `MembershipStatus.reason` means the check failed, not "no". */
export function isTransientMembershipReason(
  reason: string | null | undefined
): boolean {
  return reason != null && TRANSIENT_STATUS_REASONS.has(reason);
}

export interface MembershipGateInput {
  employeeId: string | null | undefined;
  isAuthenticated: boolean;
  /** Defaults to the current time. */
  now?: Date;
  /** Catalog candidates (`getMembershipOfferCandidates`), tagged with `offer`. */
  plans: MembershipPlan[];
  status: {
    isMember: boolean;
    memberships: Array<{ expiryDate: string }>;
    reason?: string;
    upcomingMemberships?: Array<{ expiryDate: string }>;
  } | null;
  studentId: string | null | undefined;
}

export interface MembershipGate {
  currentExpiry: string | null;
  offeredPlans: MembershipPlan[];
  state: MembershipGateState;
}

/**
 * Decides which purchase state applies, in strict order: authentication, BI
 * link, directory record, live-status availability, then catalog.
 *
 * Seven states:
 * - `signed_out`: not authenticated
 * - `needs_bi_link`: authenticated but no BI student account linked
 * - `needs_directory_record`: authenticated with BI link, but no Azure employee
 *   ID. The directory record is checked BEFORE payment deliberately — without
 *   an employee id there is no Finago customer number, so the purchase could
 *   not be fulfilled and the student must not be charged.
 * - `membership_check_unavailable`: authenticated, linked, has employee ID,
 *   but the live Finago membership read itself failed transiently
 *   (`status.reason` is `finago_error` or `unexpected_error`). Distinct from
 *   the general "treated as a non-member for that read only" rule that
 *   applies to the nav/shop read paths: here, a false negative would let an
 *   existing member pay for overlapping cover, so this is routed to an
 *   honest "try again" state instead of falling through to the catalog.
 * - `already_member`: authenticated, linked, has employee ID, status resolved
 *   normally, and is currently a member with no plans available that would
 *   extend their coverage
 * - `no_plans_available`: authenticated, linked, has employee ID, status
 *   resolved normally, but is not a member and the catalog is empty
 * - `eligible`: authenticated, linked, has employee ID, status resolved
 *   normally, and at least one plan is available for purchase or renewal
 */
export function resolveMembershipGate(
  input: MembershipGateInput
): MembershipGate {
  const empty = { offeredPlans: [], currentExpiry: null };

  if (!input.isAuthenticated) {
    return { state: "signed_out", ...empty };
  }
  if (!input.studentId) {
    return { state: "needs_bi_link", ...empty };
  }
  if (!input.employeeId) {
    return { state: "needs_directory_record", ...empty };
  }
  if (
    input.status?.reason &&
    isTransientMembershipReason(input.status.reason)
  ) {
    return { state: "membership_check_unavailable", ...empty };
  }

  // Held-through date counts active and not-yet-started memberships, so a
  // student who already bought next season isn't sold it again.
  const held = [
    ...(input.status?.isMember ? (input.status.memberships ?? []) : []),
    ...(input.status?.upcomingMemberships ?? []),
  ]
    .map((membership) => membership.expiryDate)
    .filter(Boolean)
    .sort();
  const currentExpiry = held.at(-1) ?? null;
  const offeredPlans = selectOffers(input.plans, {
    heldThrough: currentExpiry,
    now: input.now ?? new Date(),
  });

  if (offeredPlans.length === 0) {
    const state = currentExpiry ? "already_member" : "no_plans_available";
    return { state, offeredPlans: [], currentExpiry };
  }

  return { state: "eligible", offeredPlans, currentExpiry };
}
