"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { BenefitPartners } from "@repo/api/types/appwrite";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  assertBenefitCampusWrite,
  benefitAccessFor,
} from "@/lib/benefit-access";
import { logAuditEvent } from "./audit-log";
import type { BoardPartner } from "./benefits";

const PARTNERS_TABLE = "benefit_partners";
const PARTNER_LIMIT = 500;
const NAME_MAX = 200;
const NAME_REQUIRED = "Add the partner's name";
const WEBSITE_INVALID = "The website must start with https://";

const toBoardPartner = (row: BenefitPartners): BoardPartner => ({
  campus_id: row.campus_id ?? null,
  id: row.$id,
  is_active: row.is_active ?? true,
  logo_url: row.logo_url ?? null,
  name: row.name,
});

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** Partners of a campus tab: the campus's own plus Hele BISO, active or not. */
export async function listBenefitPartners(
  campusId: string
): Promise<BoardPartner[]> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  if (!access.visibleCampusIds.includes(campusId)) {
    throw new Error("Unauthorized: no access to this campus");
  }
  const { db } = await createAdminClient();
  const result = await db.listRows<BenefitPartners>("app", PARTNERS_TABLE, [
    Query.equal("campus_id", resolveBenefitCampusIds(campusId)),
    Query.orderAsc("name"),
    Query.limit(PARTNER_LIMIT),
  ]);
  return result.rows.map(toBoardPartner);
}

export async function createBenefitPartner(input: {
  campus_id: string;
  logo_url?: string | null;
  name: string;
  website_url?: string | null;
}): Promise<{ data: BoardPartner } | { error: string }> {
  const ctx = await requireAuth();
  assertBenefitCampusWrite(ctx, input.campus_id);

  const name = input.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) {
    return { error: NAME_REQUIRED };
  }
  const websiteUrl = blankToNull(input.website_url);
  if (websiteUrl !== null && !isHttpsUrl(websiteUrl)) {
    return { error: WEBSITE_INVALID };
  }

  const { db } = await createAdminClient();
  const id = ID.unique();
  const saved = await db.upsertRow<BenefitPartners>(
    "app",
    PARTNERS_TABLE,
    id,
    {
      campus_id: input.campus_id,
      is_active: true,
      logo_url: blankToNull(input.logo_url),
      name,
      website_url: websiteUrl,
    },
    ['read("any")']
  );

  await logAuditEvent(ctx, "benefit_partner_created", {
    resourceId: id,
    resourceType: "benefit_partner",
  });
  revalidatePath("/benefits");
  return { data: toBoardPartner(saved) };
}
