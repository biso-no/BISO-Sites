import {
  type MembershipPlan,
  type MembershipRowLike,
  toMembershipPlan,
} from "./membership-plans";
import { offerFor } from "./membership-seasons";

/**
 * Catalog rows starting this season or next, as plans tagged with `offer`.
 * Pure so it can be tested without Appwrite; `membership-catalog` feeds it.
 */
export function toOfferCandidates(
  rows: MembershipRowLike[],
  now: Date
): MembershipPlan[] {
  const candidates: MembershipPlan[] = [];
  for (const row of rows) {
    const plan = toMembershipPlan(row);
    const offer = plan ? offerFor(plan.startDate, now) : null;
    if (plan && offer) {
      candidates.push({ ...plan, offer });
    }
  }
  return candidates;
}
