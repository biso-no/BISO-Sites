"use server";

import { ID, Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { BenefitPartner } from "@repo/api/types/appwrite";
import { getUserAuthContext } from "@/lib/authorization";
import { getCampusManagementTeamId } from "@/lib/campus-constants";
import { assertWriteAccess } from "@/lib/utils/authorization";

export interface CreatePartnerInput {
  campus_id?: string | null;
  description_en?: string | null;
  description_nb?: string | null;
  is_active?: boolean;
  logo_url?: string | null;
  name: string;
  website_url?: string | null;
}

export type UpdatePartnerInput = Partial<CreatePartnerInput>;

export async function listManagedPartners(
  campusId?: string | null
): Promise<{ partners: BenefitPartner[]; total: number }> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const queries: string[] = [];

  // Global admins see all partners; campus admins see their campus + national
  if (!ctx.roles.includes("globaladmin") && ctx.managedCampusIds.length > 0) {
    queries.push(Query.equal("campus_id", [...ctx.managedCampusIds, "5"]));
  }

  if (campusId) {
    queries.push(Query.equal("campus_id", campusId));
  }

  queries.push(Query.orderAsc("name"));
  queries.push(Query.limit(100));

  const response = await db.listRows<BenefitPartner>(
    "app",
    "benefit_partners",
    queries
  );

  return { partners: response.rows ?? [], total: response.total ?? 0 };
}

async function getPartner(id: string): Promise<BenefitPartner> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const partner = await db.getRow<BenefitPartner>(
    "app",
    "benefit_partners",
    id
  );

  if (partner.campus_id) {
    assertWriteAccess(ctx, partner.campus_id);
  }

  return partner;
}

export async function createPartner(
  input: CreatePartnerInput
): Promise<BenefitPartner> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  if (input.campus_id) {
    assertWriteAccess(ctx, input.campus_id);
  }

  const campusManagementTeamId = input.campus_id
    ? getCampusManagementTeamId(input.campus_id)
    : null;

  const permissions: string[] = [Permission.read(Role.any())];
  if (campusManagementTeamId) {
    permissions.push(Permission.update(Role.team(campusManagementTeamId)));
    permissions.push(Permission.delete(Role.team(campusManagementTeamId)));
  }

  const { db } = await createAdminClient();
  return await db.createRow<BenefitPartner>(
    "app",
    "benefit_partners",
    ID.unique(),
    {
      name: input.name,
      website_url: input.website_url ?? null,
      logo_url: input.logo_url ?? null,
      description_nb: input.description_nb ?? null,
      description_en: input.description_en ?? null,
      campus_id: input.campus_id ?? null,
      is_active: input.is_active ?? true,
      $permissions: permissions,
    }
  );
}

export async function updatePartner(
  id: string,
  input: UpdatePartnerInput
): Promise<BenefitPartner> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const existing = await db.getRow<BenefitPartner>(
    "app",
    "benefit_partners",
    id
  );

  if (existing.campus_id) {
    assertWriteAccess(ctx, existing.campus_id);
  }

  return await db.updateRow<BenefitPartner>("app", "benefit_partners", id, {
    ...input,
  });
}

export async function deletePartner(id: string): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const { db } = await createAdminClient();
  const existing = await db.getRow<BenefitPartner>(
    "app",
    "benefit_partners",
    id
  );

  if (existing.campus_id) {
    assertWriteAccess(ctx, existing.campus_id);
  }

  await db.deleteRow("app", "benefit_partners", id);
}
