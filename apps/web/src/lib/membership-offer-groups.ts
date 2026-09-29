import type {
  MembershipDuration,
  MembershipPlan,
} from "@repo/shared/utils/membership-plans";

export interface MembershipOfferGroup {
  current?: MembershipPlan;
  duration: MembershipDuration;
  next?: MembershipPlan;
}

const DURATION_ORDER: MembershipDuration[] = [
  "semester",
  "year",
  "three_years",
];

/**
 * The join wizard shows one card per duration; when both this season's and
 * next season's plan are on offer (June/December), the buyer then picks one.
 */
export function groupOffersByDuration(
  plans: MembershipPlan[]
): MembershipOfferGroup[] {
  const groups: MembershipOfferGroup[] = [];
  for (const duration of DURATION_ORDER) {
    const current = plans.find(
      (plan) => plan.duration === duration && plan.offer !== "next"
    );
    const next = plans.find(
      (plan) => plan.duration === duration && plan.offer === "next"
    );
    if (current || next) {
      groups.push({ current, duration, next });
    }
  }
  return groups;
}
