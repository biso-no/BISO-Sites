import {
  describeMembershipTerm,
  type MembershipDuration,
  type MembershipPlan,
} from "@repo/shared/utils/membership-plans";
import { selectOffers } from "@repo/shared/utils/membership-seasons";
import {
  type MembershipInfo,
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

/**
 * The latest expiry among active and not-yet-started memberships, so a
 * student who already bought next season isn't offered it again.
 */
export function heldThrough(status: MembershipStatus | null): string | null {
  if (!status) {
    return null;
  }
  const held = [
    ...(status.isMember ? status.memberships : []),
    ...(status.upcomingMemberships ?? []),
  ];
  return (
    held
      .map((membership) => membership.expiryDate)
      .sort()
      .at(-1) ?? null
  );
}

/** A bought-but-not-started membership, shown to someone not yet a member. */
export function upcomingMembership(
  status: MembershipStatus | null
): MembershipInfo | null {
  if (!status || status.isMember) {
    return null;
  }
  return status.upcomingMemberships?.[0] ?? null;
}

/**
 * What the portal offers to buy: the same per-duration selection as the join
 * page's gate (`selectOffers`), from catalog candidates. `heldThrough` is the
 * latest expiry among active and not-yet-started memberships.
 */
export function upgradePlans(
  candidates: MembershipPlan[],
  heldThrough: string | null,
  now: Date = new Date()
): PlanView[] {
  return selectOffers(candidates, { heldThrough, now }).map(
    ({ duration, expiryDate, id, price }) => ({
      duration,
      expiryDate,
      id,
      price,
    })
  );
}
