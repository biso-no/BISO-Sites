import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import {
  type MembershipPlan,
  toMembershipPlan,
} from "@repo/shared/utils/membership-plans";

/**
 * Purchasable membership plans, newest expiry first.
 *
 * Rows come from the `memberships` table, which `syncMembershipsFrom24SO`
 * keeps in step with 24SevenOffice. `canPurchase` is administrator-controlled,
 * so a plan only appears here once someone has priced it and switched it on.
 * Uses the admin client because the table is not readable by anonymous
 * sessions and the catalog is public, non-sensitive data.
 */
export async function getPurchasableMembershipPlans(): Promise<
  MembershipPlan[]
> {
  const { db } = await createAdminClient();
  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.equal("status", true),
    Query.equal("canPurchase", true),
    Query.limit(50),
  ]);

  return response.rows
    .map((row) => toMembershipPlan(row))
    .filter((plan): plan is MembershipPlan => plan !== null)
    .sort((a, b) => a.accrualMonths - b.accrualMonths);
}

export async function getMembershipPlanById(
  planId: string
): Promise<MembershipPlan | null> {
  const plans = await getPurchasableMembershipPlans();
  return plans.find((plan) => plan.id === planId) ?? null;
}
