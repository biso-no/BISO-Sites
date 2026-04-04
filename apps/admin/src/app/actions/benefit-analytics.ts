"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { BenefitInteraction } from "@repo/api/types/appwrite";
import { BenefitInteractionAction } from "@repo/api/types/appwrite";
import { getUserAuthContext } from "@/lib/authorization";

export interface BenefitAnalyticsSummary {
  byCampus: { campus_id: string; count: number }[];
  byCategory: { category: string; count: number }[];
  topBenefits: { benefit_id: string; count: number; action: string }[];
  totalClicks: number;
  totalRedeems: number;
  totalReveals: number;
  totalViews: number;
}

export interface BenefitAnalyticsFilters {
  action?: BenefitInteractionAction;
  benefitId?: string;
  campusId?: string;
  since?: string; // ISO date string
}

export async function getBenefitInteractions(
  filters: BenefitAnalyticsFilters = {}
): Promise<BenefitInteraction[]> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const queries: string[] = [];

  // Apply campus scope for campus admins
  if (!ctx.roles.includes("globaladmin") && ctx.managedCampusIds.length > 0) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  if (filters.campusId) {
    queries.push(Query.equal("campus_id", filters.campusId));
  }
  if (filters.benefitId) {
    queries.push(Query.equal("benefit_id", filters.benefitId));
  }
  if (filters.action) {
    queries.push(Query.equal("action", filters.action));
  }
  if (filters.since) {
    queries.push(Query.greaterThanEqual("$createdAt", filters.since));
  }

  queries.push(Query.orderDesc("$createdAt"));
  queries.push(Query.limit(500));

  const response = await db.listRows<BenefitInteraction>(
    "app",
    "benefit_interactions",
    queries
  );

  return response.rows ?? [];
}

export async function getBenefitAnalyticsSummary(
  campusId?: string
): Promise<BenefitAnalyticsSummary> {
  const interactions = await getBenefitInteractions({ campusId });

  const countByAction = (action: BenefitInteractionAction) =>
    interactions.filter((i) => i.action === action).length;

  // Top benefits by total interactions
  const benefitCounts = new Map<string, number>();
  for (const interaction of interactions) {
    benefitCounts.set(
      interaction.benefit_id,
      (benefitCounts.get(interaction.benefit_id) ?? 0) + 1
    );
  }
  const topBenefits = [...benefitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([benefit_id, count]) => ({ benefit_id, count, action: "total" }));

  // Campus breakdown
  const campusCounts = new Map<string, number>();
  for (const interaction of interactions) {
    if (interaction.campus_id) {
      campusCounts.set(
        interaction.campus_id,
        (campusCounts.get(interaction.campus_id) ?? 0) + 1
      );
    }
  }
  const byCampus = [...campusCounts.entries()].map(([campus_id, count]) => ({
    campus_id,
    count,
  }));

  return {
    totalViews: countByAction(BenefitInteractionAction.VIEW),
    totalReveals: countByAction(BenefitInteractionAction.REVEAL),
    totalClicks: countByAction(BenefitInteractionAction.CLICK),
    totalRedeems: countByAction(BenefitInteractionAction.REDEEM),
    topBenefits,
    byCampus,
    byCategory: [], // Extended analytics would join with benefits table
  };
}
