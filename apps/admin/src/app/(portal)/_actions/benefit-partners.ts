"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { BenefitPartners, CampusBenefits } from "@repo/api/types/appwrite";
import { NATIONAL_CAMPUS_ID } from "@repo/shared/utils/benefit-catalog";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { benefitAccessFor, canEditBenefitCampus } from "@/lib/benefit-access";
import { BENEFIT_ERRORS } from "@/lib/benefits/benefit-errors";
import { isRowNotFound } from "@/lib/shop/sales-type";
import { logAuditEvent } from "./audit-log";
import type { BoardPartner } from "./benefits";

const PARTNERS_TABLE = "benefit_partners";
const BENEFITS_TABLE = "campus_benefits";
const CODES_TABLE = "benefit_codes";
const DEAL_QUERY_CHUNK = 25;
const PUBLISHED_STATUS = "published";
const PARTNER_LIMIT = 500;
const NAME_MAX = 200;
const NAME_REQUIRED = BENEFIT_ERRORS.partnerNameRequired;
const WRITE_REFUSED = BENEFIT_ERRORS.noCampusAccess;
const LOGO_INVALID = BENEFIT_ERRORS.partnerLogoInvalid;
const WEBSITE_INVALID = BENEFIT_ERRORS.partnerWebsiteInvalid;
const PARTNER_NOT_FOUND = BENEFIT_ERRORS.partnerNotFound;
const PARTNER_HAS_OTHER_CAMPUS_OFFERS =
  BENEFIT_ERRORS.partnerHasOffersOnOtherCampus;
const BENEFITS_PATH = "/benefits";
const PARTNERS_PATH = "/benefits/partners";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface PartnerDeal {
  $id: string;
  campus_id: string;
  partner_id: string | null;
  publish_end: string | null;
  publish_start: string | null;
  section: string | null;
  status: string;
  title_en: string;
  title_nb: string;
}

export interface PartnerWithDeals extends BoardPartner {
  deals: PartnerDeal[];
  description_en: string | null;
  description_nb: string | null;
  editable: boolean;
  website_url: string | null;
}

export interface PartnersPageData {
  editableCampusIds: string[];
  partners: PartnerWithDeals[];
  visibleCampusIds: string[];
}

export interface PartnerInput {
  campus_id: string;
  description_en?: string | null;
  description_nb?: string | null;
  logo_url?: string | null;
  name: string;
  website_url?: string | null;
}

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

function validatePartnerInput(
  input: PartnerInput
):
  | { error: string }
  | { logoUrl: string | null; name: string; websiteUrl: string | null } {
  const name = input.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) {
    return { error: NAME_REQUIRED };
  }
  const websiteUrl = blankToNull(input.website_url);
  if (websiteUrl !== null && !isHttpsUrl(websiteUrl)) {
    return { error: WEBSITE_INVALID };
  }
  const logoUrl = blankToNull(input.logo_url);
  if (logoUrl !== null && !isHttpsUrl(logoUrl)) {
    return { error: LOGO_INVALID };
  }
  return { logoUrl, name, websiteUrl };
}

async function findPartnerRow(
  db: AdminDb,
  id: string
): Promise<BenefitPartners | null> {
  try {
    return await db.getRow<BenefitPartners>("app", PARTNERS_TABLE, id);
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function listDeals(
  db: AdminDb,
  partnerIds: string[]
): Promise<CampusBenefits[]> {
  if (partnerIds.length === 0) {
    return [];
  }
  const deals: CampusBenefits[] = [];
  for (let i = 0; i < partnerIds.length; i += DEAL_QUERY_CHUNK) {
    const result = await db.listRows<CampusBenefits>("app", BENEFITS_TABLE, [
      Query.equal("partner_id", partnerIds.slice(i, i + DEAL_QUERY_CHUNK)),
      Query.limit(PARTNER_LIMIT),
    ]);
    deals.push(...result.rows);
  }
  return deals;
}

/** `undefined` keeps the stored value; null or blank clears it. */
function optionalField(value: string | null | undefined): {
  provided: boolean;
  value: string | null;
} {
  return { provided: value !== undefined, value: blankToNull(value) };
}

const toPartnerDeal = (row: CampusBenefits): PartnerDeal => ({
  $id: row.$id,
  campus_id: row.campus_id,
  partner_id: row.partner_id ?? null,
  publish_end: row.publish_end ?? null,
  publish_start: row.publish_start ?? null,
  section: row.section ?? null,
  status: row.status,
  title_en: row.title_en ?? "",
  title_nb: row.title_nb ?? "",
});

function revalidatePartnerPaths() {
  revalidatePath(BENEFITS_PATH);
  revalidatePath(PARTNERS_PATH);
}

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

export async function createBenefitPartner(
  input: PartnerInput
): Promise<{ data: BoardPartner } | { error: string }> {
  const ctx = await requireAuth();
  if (!canEditBenefitCampus(benefitAccessFor(ctx), input.campus_id)) {
    return { error: WRITE_REFUSED };
  }

  const checked = validatePartnerInput(input);
  if ("error" in checked) {
    return checked;
  }
  const { logoUrl, name, websiteUrl } = checked;

  const { db } = await createAdminClient();
  const id = ID.unique();
  const saved = await db.upsertRow<BenefitPartners>(
    "app",
    PARTNERS_TABLE,
    id,
    {
      campus_id: input.campus_id,
      description_en: blankToNull(input.description_en),
      description_nb: blankToNull(input.description_nb),
      is_active: true,
      logo_url: logoUrl,
      name,
      website_url: websiteUrl,
    },
    ['read("any")']
  );

  await logAuditEvent(ctx, "benefit_partner_created", {
    resourceId: id,
    resourceType: "benefit_partner",
  });
  revalidatePartnerPaths();
  return { data: toBoardPartner(saved) };
}

/** Every partner the caller can see, with the deals linked to each. */
export async function loadPartnersPage(): Promise<PartnersPageData> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  if (access.visibleCampusIds.length === 0) {
    return { editableCampusIds: [], partners: [], visibleCampusIds: [] };
  }
  const { db } = await createAdminClient();
  const result = await db.listRows<BenefitPartners>("app", PARTNERS_TABLE, [
    Query.equal("campus_id", access.visibleCampusIds),
    Query.orderAsc("name"),
    Query.limit(PARTNER_LIMIT),
  ]);
  const deals = await listDeals(
    db,
    result.rows.map((row) => row.$id)
  );
  const partners = result.rows.map(
    (row): PartnerWithDeals => ({
      ...toBoardPartner(row),
      deals: deals
        .filter((deal) => deal.partner_id === row.$id)
        .map(toPartnerDeal),
      description_en: row.description_en ?? null,
      description_nb: row.description_nb ?? null,
      editable: canEditBenefitCampus(access, row.campus_id),
      website_url: row.website_url ?? null,
    })
  );
  return {
    editableCampusIds: access.editableCampusIds,
    partners,
    visibleCampusIds: access.visibleCampusIds,
  };
}

export async function updateBenefitPartner(
  id: string,
  input: PartnerInput
): Promise<{ data: BoardPartner } | { error: string }> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  const { db } = await createAdminClient();
  const stored = await findPartnerRow(db, id);
  if (!stored) {
    return { error: PARTNER_NOT_FOUND };
  }
  if (
    !(
      canEditBenefitCampus(access, stored.campus_id) &&
      canEditBenefitCampus(access, input.campus_id)
    )
  ) {
    return { error: WRITE_REFUSED };
  }
  const checked = validatePartnerInput(input);
  if ("error" in checked) {
    return checked;
  }

  if (input.campus_id !== stored.campus_id) {
    const deals = await listDeals(db, [id]);
    const fits =
      input.campus_id === NATIONAL_CAMPUS_ID ||
      deals.every((deal) => deal.campus_id === input.campus_id);
    if (!fits) {
      return { error: PARTNER_HAS_OTHER_CAMPUS_OFFERS };
    }
  }

  const patch: Record<string, string | null> = {
    campus_id: input.campus_id,
    name: checked.name,
  };
  const optionals = {
    description_en: optionalField(input.description_en),
    description_nb: optionalField(input.description_nb),
    logo_url: {
      provided: input.logo_url !== undefined,
      value: checked.logoUrl,
    },
    website_url: {
      provided: input.website_url !== undefined,
      value: checked.websiteUrl,
    },
  };
  for (const [key, field] of Object.entries(optionals)) {
    if (field.provided) {
      patch[key] = field.value;
    }
  }
  const saved = await db.updateRow<BenefitPartners>(
    "app",
    PARTNERS_TABLE,
    id,
    patch
  );
  await logAuditEvent(ctx, "benefit_partner_updated", {
    resourceId: id,
    resourceType: "benefit_partner",
  });
  revalidatePartnerPaths();
  return { data: toBoardPartner(saved) };
}

async function setPartnerActive(
  id: string,
  isActive: boolean
): Promise<{ data: { hiddenDeals: number } } | { error: string }> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const stored = await findPartnerRow(db, id);
  if (!stored) {
    return { error: PARTNER_NOT_FOUND };
  }
  if (!canEditBenefitCampus(benefitAccessFor(ctx), stored.campus_id)) {
    return { error: WRITE_REFUSED };
  }
  const deals = isActive ? [] : await listDeals(db, [id]);
  await db.updateRow("app", PARTNERS_TABLE, id, { is_active: isActive });
  await logAuditEvent(
    ctx,
    isActive ? "benefit_partner_restarted" : "benefit_partner_ended",
    { resourceId: id, resourceType: "benefit_partner" }
  );
  revalidatePartnerPaths();
  return {
    data: {
      hiddenDeals: deals.filter((deal) => deal.status === PUBLISHED_STATUS)
        .length,
    },
  };
}

/** Hides the partner and, through it, its published deals. Deals keep their status. */
export async function endBenefitPartner(
  id: string
): Promise<{ data: { hiddenDeals: number } } | { error: string }> {
  return await setPartnerActive(id, false);
}

export async function restartBenefitPartner(
  id: string
): Promise<{ data: true } | { error: string }> {
  const result = await setPartnerActive(id, true);
  return "error" in result ? result : { data: true };
}

async function deleteDealWithCode(db: AdminDb, dealId: string) {
  try {
    await db.deleteRow("app", CODES_TABLE, dealId);
  } catch (error) {
    if (!isRowNotFound(error)) {
      throw error;
    }
  }
  await db.deleteRow("app", BENEFITS_TABLE, dealId);
}

/** Deletes the partner, every deal linked to it and those deals' codes. */
export async function deleteBenefitPartner(
  id: string
): Promise<{ data: { deletedDeals: number } } | { error: string }> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  const { db } = await createAdminClient();
  const stored = await findPartnerRow(db, id);
  if (!stored) {
    return { error: PARTNER_NOT_FOUND };
  }
  const deals = await listDeals(db, [id]);
  const allowed =
    canEditBenefitCampus(access, stored.campus_id) &&
    deals.every((deal) => canEditBenefitCampus(access, deal.campus_id));
  if (!allowed) {
    return { error: WRITE_REFUSED };
  }
  const deletedIds: string[] = [];
  try {
    for (const deal of deals) {
      await deleteDealWithCode(db, deal.$id);
      deletedIds.push(deal.$id);
    }
    await db.deleteRow("app", PARTNERS_TABLE, id);
  } catch {
    await logAuditEvent(ctx, "benefit_partner_delete_failed", {
      payload: { deletedDeals: deletedIds.length, partnerId: id },
      resourceId: id,
      resourceType: "benefit_partner",
    });
    revalidatePartnerPaths();
    return { error: BENEFIT_ERRORS.partnerDeleteFailed };
  }
  await logAuditEvent(ctx, "benefit_partner_deleted", {
    payload: {
      campusId: stored.campus_id,
      dealIds: deletedIds,
      deletedDeals: deletedIds.length,
      name: stored.name,
    },
    resourceId: id,
    resourceType: "benefit_partner",
  });
  revalidatePartnerPaths();
  return { data: { deletedDeals: deals.length } };
}
