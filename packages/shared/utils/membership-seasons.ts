/**
 * What is for sale, decided from dates. Spring runs 1 Jan – 30 Jun and fall
 * 1 Jul – 31 Dec (Oslo). Each duration has one 24SO product per start season,
 * so a plan is on offer when it starts this season ("current") or next
 * season ("next"). Next season's plans are offered in the last month of a
 * season (June, December), or earlier when this season's plan would not
 * extend what the student already holds (a renewal).
 */

import { osloToday } from "./membership-dates";
import type {
  MembershipDuration,
  MembershipOffer,
  MembershipPlan,
} from "./membership-plans";

const FIRST_FALL_MONTH = 7;
const LAST_MONTHS = new Set([6, 12]);
const DURATION_ORDER: MembershipDuration[] = [
  "semester",
  "year",
  "three_years",
];

function todayParts(now: Date): { month: number; year: number } {
  const today = osloToday(now);
  return {
    month: Number(today.slice(5, 7)),
    year: Number(today.slice(0, 4)),
  };
}

export function currentSeasonStart(now: Date): string {
  const { month, year } = todayParts(now);
  return month >= FIRST_FALL_MONTH ? `${year}-07-01` : `${year}-01-01`;
}

export function nextSeasonStart(now: Date): string {
  const { month, year } = todayParts(now);
  return month >= FIRST_FALL_MONTH ? `${year + 1}-01-01` : `${year}-07-01`;
}

export function isLastMonthOfSeason(now: Date): boolean {
  return LAST_MONTHS.has(todayParts(now).month);
}

export function offerFor(startDate: string, now: Date): MembershipOffer | null {
  if (startDate === currentSeasonStart(now)) {
    return "current";
  }
  if (startDate === nextSeasonStart(now)) {
    return "next";
  }
  return null;
}

/**
 * Per duration: this season's plan when it extends `heldThrough`, plus next
 * season's in the last month of the season; next season's alone when this
 * season's would not extend what they hold. `candidates` must carry `offer`.
 */
export function selectOffers(
  candidates: MembershipPlan[],
  options: { heldThrough: string | null; now: Date }
): MembershipPlan[] {
  const extendsHeld = (plan: MembershipPlan) =>
    options.heldThrough === null || plan.expiryDate > options.heldThrough;
  const lastMonth = isLastMonthOfSeason(options.now);
  const offers: MembershipPlan[] = [];

  for (const duration of DURATION_ORDER) {
    const current = candidates.find(
      (p) => p.duration === duration && p.offer === "current"
    );
    const next = candidates.find(
      (p) => p.duration === duration && p.offer === "next"
    );
    const currentOffered = current !== undefined && extendsHeld(current);
    if (currentOffered) {
      offers.push(current);
    }
    if (next && extendsHeld(next) && (lastMonth || !currentOffered)) {
      offers.push(next);
    }
  }
  return offers;
}

/**
 * One offer per duration, preferring this season's — for plan lists that are
 * labelled by duration only (portal cards). The this/next choice is made in
 * the join wizard, which receives both.
 */
export function onePerDuration(offers: MembershipPlan[]): MembershipPlan[] {
  const seen = new Set<MembershipDuration>();
  const result: MembershipPlan[] = [];
  for (const offer of offers) {
    if (!seen.has(offer.duration)) {
      seen.add(offer.duration);
      result.push(offer);
    }
  }
  return result;
}
