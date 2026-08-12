import type { MembershipPlan } from "@repo/shared/utils/membership-plans";

export type MembershipGateState =
  | "signed_out"
  | "needs_bi_link"
  | "needs_directory_record"
  | "already_member"
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
 * The directory record is checked BEFORE payment deliberately — without an
 * Azure employee id there is no Finago customer number, so the purchase could
 * not be fulfilled and the student must not be charged.
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
    return { state: "already_member", offeredPlans: [], currentExpiry };
  }

  return { state: "eligible", offeredPlans, currentExpiry };
}
