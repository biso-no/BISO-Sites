import type { MembershipPlan } from "@repo/shared/utils/membership-plans";

export type MembershipGateState =
  | "signed_out"
  | "needs_bi_link"
  | "needs_directory_record"
  | "already_member"
  | "no_plans_available"
  | "eligible";

export interface MembershipGateInput {
  employeeId: string | null | undefined;
  isAuthenticated: boolean;
  plans: MembershipPlan[];
  status: {
    isMember: boolean;
    memberships: Array<{ expiryDate: string }>;
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
 * link, directory record, then catalog.
 *
 * Six states:
 * - `signed_out`: not authenticated
 * - `needs_bi_link`: authenticated but no BI student account linked
 * - `needs_directory_record`: authenticated with BI link, but no Azure employee
 *   ID. The directory record is checked BEFORE payment deliberately — without
 *   an employee id there is no Finago customer number, so the purchase could
 *   not be fulfilled and the student must not be charged.
 * - `already_member`: authenticated, linked, has employee ID, and is currently
 *   a member with no plans available that would extend their coverage
 * - `no_plans_available`: authenticated, linked, has employee ID, but is not a
 *   member and the catalog is empty
 * - `eligible`: authenticated, linked, has employee ID, and at least one plan
 *   is available for purchase or renewal
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

  const expiries = (input.status?.memberships ?? [])
    .map((membership) => membership.expiryDate)
    .filter(Boolean)
    .sort();
  const currentExpiry = input.status?.isMember
    ? (expiries.at(-1) ?? null)
    : null;

  const offeredPlans = currentExpiry
    ? input.plans.filter((plan) => plan.expiryDate > currentExpiry)
    : input.plans;

  if (offeredPlans.length === 0) {
    const state = input.status?.isMember
      ? "already_member"
      : "no_plans_available";
    return { state, offeredPlans: [], currentExpiry };
  }

  return { state: "eligible", offeredPlans, currentExpiry };
}
