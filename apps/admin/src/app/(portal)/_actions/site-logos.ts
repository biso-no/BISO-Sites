"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type Partners, PartnersLevel } from "@repo/api/types/appwrite";
import {
  CAMPUS_IDS,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { benefitAccessFor, canEditBenefitCampus } from "@/lib/benefit-access";
import { BENEFIT_ERRORS } from "@/lib/benefits/benefit-errors";
import { isRowNotFound } from "@/lib/shop/sales-type";
import { logAuditEvent } from "./audit-log";

const PARTNERS_TABLE = "partners";
const LOGO_LIMIT = 500;
const NAME_MAX = 128;
const PARTNERS_PATH = "/benefits/partners";
const RESOURCE_TYPE = "site_logo";
const GROUP_ORDER: readonly string[] = [NATIONAL_CAMPUS_ID, ...CAMPUS_IDS];
const LINK_INVALID = "The link must start with https://";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface SiteLogo {
  campus_id: string;
  id: string;
  image_url: string;
  name: string;
  sort_order: number;
  url: string | null;
}

export interface SiteLogoGroup {
  campusId: string;
  editable: boolean;
  logos: SiteLogo[];
}

const toSiteLogo = (row: Partners): SiteLogo => ({
  campus_id: row.campus_id,
  id: row.$id,
  image_url: row.image_url,
  name: row.name,
  sort_order: row.sort_order ?? 0,
  url: row.url ?? null,
});

const levelFor = (campusId: string): PartnersLevel =>
  campusId === NATIONAL_CAMPUS_ID
    ? PartnersLevel.NATIONAL
    : PartnersLevel.CAMPUS;

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

async function listGroupRows(db: AdminDb, campusId: string) {
  const result = await db.listRows<Partners>("app", PARTNERS_TABLE, [
    Query.equal("campus_id", campusId),
    Query.orderAsc("sort_order"),
    Query.orderAsc("$createdAt"),
    Query.limit(LOGO_LIMIT),
  ]);
  return result.rows;
}

async function nextSortOrder(db: AdminDb, campusId: string): Promise<number> {
  const rows = await listGroupRows(db, campusId);
  return rows.reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1) + 1;
}

async function findLogoRow(db: AdminDb, id: string): Promise<Partners | null> {
  try {
    return await db.getRow<Partners>("app", PARTNERS_TABLE, id);
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function validateLogo(input: {
  image_url: string;
  name: string;
  url?: string | null;
}): { error: string } | { imageUrl: string; name: string; url: string | null } {
  const name = input.name.trim();
  if (name.length === 0 || name.length > NAME_MAX) {
    return { error: BENEFIT_ERRORS.companyNameRequired };
  }
  const imageUrl = input.image_url.trim();
  if (!isHttpsUrl(imageUrl)) {
    return { error: BENEFIT_ERRORS.logoRequired };
  }
  const url = input.url?.trim() || null;
  if (url !== null && !isHttpsUrl(url)) {
    return { error: LINK_INVALID };
  }
  return { imageUrl, name, url };
}

/** One group per campus the caller can see, Hele BISO first. */
export async function loadSiteLogos(): Promise<SiteLogoGroup[]> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  const campusIds = GROUP_ORDER.filter((id) =>
    access.visibleCampusIds.includes(id)
  );
  if (campusIds.length === 0) {
    return [];
  }
  const { db } = await createAdminClient();
  const result = await db.listRows<Partners>("app", PARTNERS_TABLE, [
    Query.equal("campus_id", campusIds),
    Query.orderAsc("sort_order"),
    Query.orderAsc("$createdAt"),
    Query.limit(LOGO_LIMIT),
  ]);
  return campusIds.map((campusId) => ({
    campusId,
    editable: canEditBenefitCampus(access, campusId),
    logos: result.rows
      .filter((row) => row.campus_id === campusId)
      .map(toSiteLogo),
  }));
}

export async function saveSiteLogo(input: {
  campus_id: string;
  id?: string;
  image_url: string;
  name: string;
  url?: string | null;
}): Promise<{ data: SiteLogo } | { error: string }> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  if (!canEditBenefitCampus(access, input.campus_id)) {
    return { error: BENEFIT_ERRORS.noCampusAccess };
  }
  const { db } = await createAdminClient();
  let stored: Partners | null = null;
  if (input.id) {
    stored = await findLogoRow(db, input.id);
    if (!stored) {
      return { error: BENEFIT_ERRORS.partnerNotFound };
    }
    if (!canEditBenefitCampus(access, stored.campus_id)) {
      return { error: BENEFIT_ERRORS.noCampusAccess };
    }
  }
  const checked = validateLogo(input);
  if ("error" in checked) {
    return checked;
  }
  const fields: Record<string, unknown> = {
    image_url: checked.imageUrl,
    name: checked.name,
    url: checked.url,
  };
  const placement = async (): Promise<Record<string, unknown>> => ({
    campus: input.campus_id,
    campus_id: input.campus_id,
    level: levelFor(input.campus_id),
    sort_order: await nextSortOrder(db, input.campus_id),
  });

  let saved: Partners;
  if (stored && input.id) {
    const moved = stored.campus_id !== input.campus_id;
    saved = await db.updateRow<Partners>("app", PARTNERS_TABLE, input.id, {
      ...fields,
      ...(moved ? await placement() : {}),
    });
  } else {
    saved = await db.upsertRow<Partners>("app", PARTNERS_TABLE, ID.unique(), {
      ...fields,
      ...(await placement()),
    });
  }
  await logAuditEvent(ctx, "site_logo_saved", {
    resourceId: saved.$id,
    resourceType: RESOURCE_TYPE,
  });
  revalidatePath(PARTNERS_PATH);
  return { data: toSiteLogo(saved) };
}

export async function deleteSiteLogo(
  id: string
): Promise<{ data: true } | { error: string }> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  const { db } = await createAdminClient();
  const stored = await findLogoRow(db, id);
  if (!stored) {
    return { error: BENEFIT_ERRORS.partnerNotFound };
  }
  if (!canEditBenefitCampus(access, stored.campus_id)) {
    return { error: BENEFIT_ERRORS.noCampusAccess };
  }
  await db.deleteRow("app", PARTNERS_TABLE, id);
  await logAuditEvent(ctx, "site_logo_deleted", {
    resourceId: id,
    resourceType: RESOURCE_TYPE,
  });
  revalidatePath(PARTNERS_PATH);
  return { data: true };
}

export async function reorderSiteLogos(
  campusId: string,
  orderedIds: string[]
): Promise<{ data: true } | { error: string }> {
  const ctx = await requireAuth();
  if (!canEditBenefitCampus(benefitAccessFor(ctx), campusId)) {
    return { error: BENEFIT_ERRORS.noCampusAccess };
  }
  const { db } = await createAdminClient();
  const rows = await listGroupRows(db, campusId);
  const stored = new Set(rows.map((row) => row.$id));
  const isCurrent =
    orderedIds.length === stored.size &&
    new Set(orderedIds).size === stored.size &&
    orderedIds.every((id) => stored.has(id));
  if (!isCurrent) {
    return { error: BENEFIT_ERRORS.reorderOutOfDate };
  }
  const current = new Map(rows.map((row) => [row.$id, row.sort_order ?? 0]));
  for (const [index, id] of orderedIds.entries()) {
    if (current.get(id) !== index) {
      await db.updateRow("app", PARTNERS_TABLE, id, { sort_order: index });
    }
  }
  await logAuditEvent(ctx, "site_logos_reordered", {
    payload: { campusId },
    resourceId: campusId,
    resourceType: RESOURCE_TYPE,
  });
  revalidatePath(PARTNERS_PATH);
  return { data: true };
}
