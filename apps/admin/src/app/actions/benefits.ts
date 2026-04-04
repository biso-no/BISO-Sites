"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { BenefitPartner, CampusBenefit } from "@repo/api/types/appwrite";
import { BenefitStatus } from "@repo/api/types/appwrite";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { getUserAuthContext } from "@/lib/authorization";
import { getCampusManagementTeamId } from "@/lib/campus-constants";
import { buildBenefitPermissions } from "@/lib/permissions";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateBenefitInput {
  campus_id: string;
  category: string;
  description_en: string;
  description_nb: string;
  image_url?: string | null;
  is_featured?: boolean;
  kind: "offer" | "perk" | "service";
  partner_id?: string | null;
  partner_logo_url?: string | null;
  partner_name?: string | null;
  publish_end?: string | null;
  publish_start?: string | null;
  redemption_type: "none" | "code" | "link" | "qr" | "onsite";
  redemption_value?: string | null;
  sort_order?: number;
  status: BenefitStatus;
  teaser_en?: string | null;
  teaser_nb?: string | null;
  terms_en?: string | null;
  terms_nb?: string | null;
  title_en: string;
  title_nb: string;
}

export type UpdateBenefitInput = Partial<CreateBenefitInput>;

export interface BenefitFilters {
  campus_id?: string;
  category?: string;
  is_featured?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  status?: BenefitStatus;
}

export type BenefitListItem = CampusBenefit;

// ─── List ────────────────────────────────────────────────────────────────────

export async function listManagedBenefits(
  filters: BenefitFilters = {}
): Promise<{ benefits: BenefitListItem[]; total: number }> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const queries: string[] = [];

  // Apply role-based campus scope
  const scopeQueries = applyScopeQueries(ctx);
  queries.push(...scopeQueries);

  // Additional caller-supplied filters
  if (filters.campus_id) {
    queries.push(Query.equal("campus_id", filters.campus_id));
  }
  if (filters.status) {
    queries.push(Query.equal("status", filters.status));
  }
  if (filters.category) {
    queries.push(Query.equal("category", filters.category));
  }
  if (filters.is_featured !== undefined) {
    queries.push(Query.equal("is_featured", filters.is_featured));
  }

  queries.push(Query.orderDesc("$createdAt"));
  queries.push(Query.limit(filters.limit ?? 50));
  if (filters.offset) {
    queries.push(Query.offset(filters.offset));
  }

  const response = await db.listRows<CampusBenefit>(
    "app",
    "campus_benefits",
    queries
  );

  return {
    benefits: response.rows ?? [],
    total: response.total ?? 0,
  };
}

// ─── Get one ─────────────────────────────────────────────────────────────────

export async function getManagedBenefit(id: string): Promise<CampusBenefit> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const benefit = await db.getRow<CampusBenefit>("app", "campus_benefits", id);

  // Verify this user can actually manage this benefit's campus
  assertWriteAccess(ctx, benefit.campus_id);

  return benefit;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createBenefit(
  input: CreateBenefitInput
): Promise<CampusBenefit> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  assertWriteAccess(ctx, input.campus_id);

  const campusManagementTeamId = getCampusManagementTeamId(input.campus_id);
  const permissions = buildBenefitPermissions({
    status: input.status,
    campusManagementTeamId,
  });

  const { db } = await createAdminClient();
  return await db.createRow<CampusBenefit>(
    "app",
    "campus_benefits",
    ID.unique(),
    {
      ...input,
      is_featured: input.is_featured ?? false,
      is_member_only: false,
      sort_order: input.sort_order ?? 0,
      created_by: ctx.userId,
      updated_by: ctx.userId,
      $permissions: permissions,
    }
  );
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateBenefit(
  id: string,
  input: UpdateBenefitInput
): Promise<CampusBenefit> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const existing = await db.getRow<CampusBenefit>("app", "campus_benefits", id);
  assertWriteAccess(ctx, existing.campus_id);

  const newCampusId = input.campus_id ?? existing.campus_id;
  const newStatus = input.status ?? existing.status;
  const campusManagementTeamId = getCampusManagementTeamId(newCampusId);
  const permissions = buildBenefitPermissions({
    status: newStatus,
    campusManagementTeamId,
  });

  return await db.updateRow<CampusBenefit>("app", "campus_benefits", id, {
    ...input,
    updated_by: ctx.userId,
    $permissions: permissions,
  });
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export function publishBenefit(id: string): Promise<CampusBenefit> {
  return updateBenefit(id, { status: BenefitStatus.PUBLISHED });
}

// ─── Archive ─────────────────────────────────────────────────────────────────

export function archiveBenefit(id: string): Promise<CampusBenefit> {
  return updateBenefit(id, { status: BenefitStatus.ARCHIVED });
}

// ─── Duplicate ───────────────────────────────────────────────────────────────

export async function duplicateBenefit(
  id: string,
  targetCampusId?: string
): Promise<CampusBenefit> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const source = await db.getRow<CampusBenefit>("app", "campus_benefits", id);
  assertWriteAccess(ctx, source.campus_id);

  const destCampusId = targetCampusId ?? source.campus_id;
  assertWriteAccess(ctx, destCampusId);

  return createBenefit({
    campus_id: destCampusId,
    status: BenefitStatus.DRAFT,
    kind: source.kind,
    redemption_type: source.redemption_type,
    category: source.category,
    partner_id: source.partner_id,
    partner_name: source.partner_name,
    partner_logo_url: source.partner_logo_url,
    title_nb: `${source.title_nb} (kopi)`,
    title_en: `${source.title_en} (copy)`,
    description_nb: source.description_nb,
    description_en: source.description_en,
    teaser_nb: source.teaser_nb,
    teaser_en: source.teaser_en,
    terms_nb: source.terms_nb,
    terms_en: source.terms_en,
    redemption_value: source.redemption_value,
    image_url: source.image_url,
    is_featured: false,
    publish_start: source.publish_start,
    publish_end: source.publish_end,
    sort_order: source.sort_order,
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteBenefit(id: string): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const existing = await db.getRow<CampusBenefit>("app", "campus_benefits", id);
  assertWriteAccess(ctx, existing.campus_id);

  await db.deleteRow("app", "campus_benefits", id);
}

// ─── Campus scoped list for web (no auth required) ───────────────────────────

export async function getPublishedBenefitsByCampus(
  campusId?: string | null
): Promise<CampusBenefit[]> {
  const campusIds = resolveBenefitCampusIds(campusId);
  const { db } = await createAdminClient();

  const response = await db.listRows<CampusBenefit>("app", "campus_benefits", [
    Query.equal("campus_id", campusIds),
    Query.equal("status", BenefitStatus.PUBLISHED),
    Query.orderAsc("sort_order"),
    Query.orderDesc("is_featured"),
    Query.limit(100),
  ]);

  return response.rows ?? [];
}

// ─── Featured benefits for a campus ──────────────────────────────────────────

export async function getFeaturedBenefitsByCampus(
  campusId?: string | null
): Promise<CampusBenefit[]> {
  const campusIds = resolveBenefitCampusIds(campusId);
  const { db } = await createAdminClient();

  const response = await db.listRows<CampusBenefit>("app", "campus_benefits", [
    Query.equal("campus_id", campusIds),
    Query.equal("status", BenefitStatus.PUBLISHED),
    Query.equal("is_featured", true),
    Query.orderAsc("sort_order"),
    Query.limit(6),
  ]);

  return response.rows ?? [];
}

// ─── Partners (needed by benefit editor) ─────────────────────────────────────

export async function listPartnersForCampus(
  campusId?: string | null
): Promise<BenefitPartner[]> {
  const { db } = await createAdminClient();
  const queries: string[] = [
    Query.equal("is_active", true),
    Query.orderAsc("name"),
  ];

  if (campusId) {
    queries.push(Query.equal("campus_id", [campusId, "5"]));
  }

  const response = await db.listRows<BenefitPartner>(
    "app",
    "benefit_partners",
    queries
  );
  return response.rows ?? [];
}
