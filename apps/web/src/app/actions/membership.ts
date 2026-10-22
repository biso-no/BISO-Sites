"use server";

import { getPurchasableMembershipPlans } from "@repo/shared/utils/membership-catalog";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { onePerDuration } from "@repo/shared/utils/membership-seasons";

/**
 * Client-callable wrapper around the catalog read — the member portal's CTA
 * section renders inside a client component tree, so it fetches this on
 * mount rather than receiving it as a prop from a server component several
 * layers up.
 */
export async function getMembershipPlansForPurchase(): Promise<
  MembershipPlan[]
> {
  // One card per duration (the CTA labels plans by duration only); the join
  // wizard offers the this/next season choice in June and December.
  return onePerDuration(await getPurchasableMembershipPlans());
}
