import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import { toOfferCandidates } from "./membership-offers";
import type { MembershipPlan } from "./membership-plans";
import { selectOffers } from "./membership-seasons";

/**
 * Plans starting this season or next, from the `memberships` catalog that the
 * member-roster-sync function mirrors from 24SevenOffice. What a given
 * student may buy is decided from these by `resolveMembershipGate` (or
 * `selectOffers`). Uses the admin client because the table is not readable by
 * anonymous sessions and the catalog is public, non-sensitive data.
 */
export async function getMembershipOfferCandidates(
  now: Date = new Date()
): Promise<MembershipPlan[]> {
  const { db } = await createAdminClient();
  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.isNotNull("category"),
    Query.limit(200),
  ]);
  return toOfferCandidates(response.rows, now);
}

/** What someone with no membership may buy right now. */
export async function getPurchasableMembershipPlans(
  now: Date = new Date()
): Promise<MembershipPlan[]> {
  return selectOffers(await getMembershipOfferCandidates(now), {
    heldThrough: null,
    now,
  });
}

/**
 * A plan on offer this season or next, by id. Whether this student may buy it
 * is for the gate to decide.
 */
export async function getMembershipPlanById(
  planId: string,
  now: Date = new Date()
): Promise<MembershipPlan | null> {
  const candidates = await getMembershipOfferCandidates(now);
  return candidates.find((plan) => plan.id === planId) ?? null;
}
