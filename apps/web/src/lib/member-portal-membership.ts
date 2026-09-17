import {
  describeMembershipTerm,
  type MembershipDuration,
  type MembershipPlan,
} from "@repo/shared/utils/membership-plans";
import {
  type MembershipStatus,
  osloToday,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CurrentMembershipView {
  daysRemaining: number;
  duration: MembershipDuration | null;
  expiryDate: string;
  name: string;
  startDate: string;
  termDays: number;
}

export interface PlanView {
  duration: MembershipDuration;
  expiryDate: string;
  id: string;
  price: number;
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  );
}

export function toCurrentMembershipView(
  status: MembershipStatus,
  now: Date = new Date()
): CurrentMembershipView | null {
  if (!status.isMember) {
    return null;
  }
  const current = pickCurrentMembership(status.memberships);
  if (!current) {
    return null;
  }
  return {
    daysRemaining: Math.max(0, daysBetween(osloToday(now), current.expiryDate)),
    duration:
      describeMembershipTerm(current.startDate, current.expiryDate)?.duration ??
      null,
    expiryDate: current.expiryDate,
    name: current.name,
    startDate: current.startDate,
    termDays: Math.max(1, daysBetween(current.startDate, current.expiryDate)),
  };
}

export function upgradePlans(
  plans: MembershipPlan[],
  current: CurrentMembershipView | null
): PlanView[] {
  return plans
    .filter((plan) => !current || plan.expiryDate > current.expiryDate)
    .map(({ duration, expiryDate, id, price }) => ({
      duration,
      expiryDate,
      id,
      price,
    }));
}
