"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  BenefitCodes,
  BenefitPartners,
  CampusBenefits,
  ContentTranslations,
  Partners,
} from "@repo/api/types/appwrite";
import {
  isBenefitSection,
  mapLegacyBenefitCategory,
  NATIONAL_CAMPUS_ID,
} from "@repo/shared/utils/benefit-catalog";
import { resolveBenefitCampusIds } from "@repo/shared/utils/benefit-scope";
import { revalidatePath } from "next/cache";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import {
  assertBenefitCampusWrite,
  benefitAccessFor,
  canEditBenefitCampus,
} from "@/lib/benefit-access";
import {
  type BenefitPartnerSnapshot,
  benefitRowPermissions,
  benefitSecretValue,
  buildBenefitColumns,
  type LegacyPartnerSnapshot,
  normalizeBenefitValues,
} from "@/lib/benefits/benefit-columns";
import { benefitDateFromIso } from "@/lib/benefits/benefit-dates";
import { BENEFIT_ERRORS } from "@/lib/benefits/benefit-errors";
import {
  benefitTranslationPermissions,
  buildBenefitTranslationChildren,
  loadBenefitTranslationsByLocale,
  scheduleBenefitTranslation,
  translateBenefitSnapshot,
} from "@/lib/benefits/benefit-translations";
import type {
  AutoTranslationOptions,
  ContentLocale,
} from "@/lib/content-translation";
import {
  contentLocaleSchema,
  parseAutoTranslationOptions,
} from "@/lib/content-translation.server";
import type { ListParams, PaginatedResult } from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";
import { isRowNotFound } from "@/lib/shop/sales-type";
import { logAuditEvent } from "./audit-log";
import { type BenefitFormValues, benefitSchema } from "./schemas";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** One board card or line. Never carries the code or member link. */
export interface BoardBenefit {
  $createdAt: string;
  $id: string;
  campus_id: string;
  category: string | null;
  image_url: string | null;
  is_featured: boolean;
  partner_id: string | null;
  publish_end: string | null;
  publish_start: string | null;
  redemption_type: string;
  section: string;
  sort_order: number;
  status: string;
  title_en: string;
  title_nb: string;
}

export interface BoardPartner {
  campus_id: string | null;
  id: string;
  is_active: boolean;
  logo_url: string | null;
  name: string;
}

export interface BenefitBoardData {
  benefits: BoardBenefit[];
  campusId: string;
  editable: boolean;
  partners: BoardPartner[];
}

export interface BenefitEditData extends BoardBenefit {
  description_en: string | null;
  description_nb: string | null;
  editable: boolean;
  redemption_value: string | null;
  terms_en: string | null;
  terms_nb: string | null;
}

export type BenefitMutationResult =
  | { data: string; translationQueued?: true }
  | { error: string | Record<string, string[] | undefined> };

const BOARD_LIMIT = 500;
const BENEFITS_TABLE = "campus_benefits";
const CODES_TABLE = "benefit_codes";
const PARTNERS_TABLE = "benefit_partners";
const TRANSLATIONS_TABLE = "content_translations";
const SAVE_FAILED = "Failed to save benefit";
const REDEMPTION_TYPES = ["none", "code", "link", "onsite"] as const;
/** Matches no row: a caller without benefit access lists nothing. */
const NO_MATCH_FILTER = Query.equal("$id", "__no_benefit_access__");

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const isRedemptionType = (
  value: string | null | undefined
): value is (typeof REDEMPTION_TYPES)[number] =>
  REDEMPTION_TYPES.some((type) => type === value);

/** Rows saved before sections existed have none; they are member benefits. */
const sectionFilter = (section: string): string =>
  section === "member"
    ? Query.or([Query.equal("section", "member"), Query.isNull("section")])
    : Query.equal("section", section);

const toBoardBenefit = (row: CampusBenefits): BoardBenefit => ({
  $createdAt: row.$createdAt,
  $id: row.$id,
  campus_id: row.campus_id,
  category: row.category ?? null,
  image_url: row.image_url ?? null,
  is_featured: row.is_featured ?? false,
  partner_id: row.partner_id ?? null,
  publish_end: row.publish_end ?? null,
  publish_start: row.publish_start ?? null,
  redemption_type: row.redemption_type ?? "none",
  section: row.section ?? "member",
  sort_order: row.sort_order ?? 0,
  status: row.status,
  title_en: row.title_en ?? "",
  title_nb: row.title_nb ?? "",
});

const toBoardPartner = (row: BenefitPartners): BoardPartner => ({
  campus_id: row.campus_id ?? null,
  id: row.$id,
  is_active: row.is_active ?? true,
  logo_url: row.logo_url ?? null,
  name: row.name,
});

async function loadBenefitRow(
  db: AdminDb,
  id: string
): Promise<CampusBenefits | null> {
  const response = await db.listRows<CampusBenefits>("app", BENEFITS_TABLE, [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

async function readBenefitCode(
  db: AdminDb,
  benefitId: string
): Promise<string | null> {
  try {
    const code = await db.getRow<BenefitCodes>("app", CODES_TABLE, benefitId);
    return code.value;
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function deleteBenefitCode(db: AdminDb, benefitId: string) {
  try {
    await db.deleteRow("app", CODES_TABLE, benefitId);
  } catch (error) {
    if (!isRowNotFound(error)) {
      throw error;
    }
  }
}

/** Codes and member links live in `benefit_codes`, readable by nobody. */
async function writeBenefitCode(
  db: AdminDb,
  ctx: UserAuthContext,
  benefitId: string,
  values: BenefitFormValues
) {
  const secret = benefitSecretValue(values);
  if (!secret) {
    await deleteBenefitCode(db, benefitId);
    return;
  }
  await db.upsertRow(
    "app",
    CODES_TABLE,
    benefitId,
    { benefit_id: benefitId, updated_by: ctx.userId, value: secret },
    []
  );
}

async function findPartner(
  db: AdminDb,
  partnerId: string
): Promise<BenefitPartners | null> {
  try {
    return await db.getRow<BenefitPartners>("app", PARTNERS_TABLE, partnerId);
  } catch (error) {
    if (isRowNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/** One past the highest `sort_order` of the campus and section. */
async function nextSortOrder(
  db: AdminDb,
  campusId: string,
  section: string
): Promise<number> {
  const response = await db.listRows<CampusBenefits>("app", BENEFITS_TABLE, [
    Query.equal("campus_id", campusId),
    sectionFilter(section),
    Query.orderDesc("sort_order"),
    Query.limit(1),
  ]);
  return Math.max(-1, ...response.rows.map((row) => row.sort_order ?? 0)) + 1;
}

/**
 * The single write path for create, update and publishing: the benefit row
 * (with its translation children), then its private code row.
 */
async function saveBenefitRow({
  ctx,
  db,
  existingTranslations,
  id,
  legacyPartner = null,
  partner,
  sortOrder,
  values,
}: {
  ctx: UserAuthContext;
  db: AdminDb;
  existingTranslations: Map<string, ContentTranslations>;
  id: string;
  legacyPartner?: LegacyPartnerSnapshot | null;
  partner: BenefitPartnerSnapshot | null;
  sortOrder: number;
  values: BenefitFormValues;
}) {
  const columns = buildBenefitColumns(
    values,
    partner,
    sortOrder,
    legacyPartner
  );
  const saved = await db.upsertRow(
    "app",
    BENEFITS_TABLE,
    id,
    {
      ...columns,
      contentTranslations: buildBenefitTranslationChildren(
        id,
        values,
        existingTranslations,
        benefitTranslationPermissions(values.status)
      ),
    },
    benefitRowPermissions(values.status)
  );
  await writeBenefitCode(db, ctx, saved.$id, values);
  return { columns, id: saved.$id };
}

type PartnerLookup =
  | { ok: true; partner: BenefitPartnerSnapshot | null }
  | { ok: false };

/**
 * A deal links to a partner on its own campus or a national one (spec D5).
 * Any other partner reads as missing, so other campuses' partners stay hidden.
 */
async function lookupPartner(
  db: AdminDb,
  values: BenefitFormValues
): Promise<PartnerLookup> {
  if (!values.partner_id) {
    return { ok: true, partner: null };
  }
  const partner = await findPartner(db, values.partner_id);
  const inScope =
    partner?.campus_id === values.campus_id ||
    partner?.campus_id === NATIONAL_CAMPUS_ID;
  if (!(partner && inScope)) {
    return { ok: false };
  }
  return {
    ok: true,
    partner: {
      id: partner.$id,
      logo_url: partner.logo_url ?? null,
      name: partner.name,
    },
  };
}

/**
 * The free-text partner of a row saved before partners were linked. Kept
 * while the save links no partner either, since the website still reads it.
 */
function legacyPartnerOf(
  stored: CampusBenefits,
  values: BenefitFormValues
): LegacyPartnerSnapshot | null {
  const name = stored.partner_name?.trim();
  if (values.partner_id || stored.partner_id || !name) {
    return null;
  }
  return { logo_url: stored.partner_logo_url ?? null, name };
}

/** Maps a stored row back to form values so publishing re-saves it. */
function formValuesFromRow(
  row: CampusBenefits,
  code: string | null
): BenefitFormValues {
  const section = isBenefitSection(row.section) ? row.section : "member";
  const redemptionType = isRedemptionType(row.redemption_type)
    ? row.redemption_type
    : "none";
  return {
    // The schema re-validates the campus id inside `updateBenefit`.
    campus_id: row.campus_id as BenefitFormValues["campus_id"],
    category: row.category ? mapLegacyBenefitCategory(row.category) : null,
    description_en: row.description_en ?? null,
    description_nb: row.description_nb ?? null,
    image_url: row.image_url ?? null,
    is_featured: row.is_featured ?? false,
    partner_id: row.partner_id ?? null,
    publish_end: benefitDateFromIso(row.publish_end),
    publish_start: benefitDateFromIso(row.publish_start),
    redemption_type: redemptionType,
    redemption_value: code,
    section,
    status: row.status,
    terms_en: row.terms_en ?? null,
    terms_nb: row.terms_nb ?? null,
    title_en: row.title_en ?? "",
    title_nb: row.title_nb ?? "",
  };
}

export async function generateBenefitTranslationDraft(input: {
  campusId: string;
  description: string;
  sourceLocale: ContentLocale;
  title: string;
}): Promise<
  { data: { description: string; title: string } } | { error: string }
> {
  const ctx = await requireAuth();
  if (!contentLocaleSchema.safeParse(input.sourceLocale).success) {
    return { error: "Unsupported source locale" };
  }
  if (!(input.title.trim() || input.description.trim())) {
    return { error: "Add source-language benefit content first." };
  }

  try {
    assertBenefitCampusWrite(ctx, input.campusId);
    return {
      data: await translateBenefitSnapshot(
        { description: input.description, title: input.title },
        input.sourceLocale
      ),
    };
  } catch (error) {
    return {
      error: errorMessage(error, "Failed to generate benefit translation"),
    };
  }
}

/** Every benefit of a campus tab: the campus's own rows plus Hele BISO. */
export async function loadBenefitBoard(
  campusId: string
): Promise<BenefitBoardData> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  if (!access.visibleCampusIds.includes(campusId)) {
    throw new Error("Unauthorized: no access to this campus");
  }
  const campusIds = resolveBenefitCampusIds(campusId);
  const { db } = await createAdminClient();

  const benefitRows = await db.listRows<CampusBenefits>("app", BENEFITS_TABLE, [
    Query.equal("campus_id", campusIds),
    Query.orderAsc("sort_order"),
    Query.orderAsc("$createdAt"),
    Query.limit(BOARD_LIMIT),
  ]);
  const benefits = benefitRows.rows.map(toBoardBenefit);

  const partnerIds = [
    ...new Set(
      benefits.flatMap((benefit) =>
        benefit.partner_id ? [benefit.partner_id] : []
      )
    ),
  ];
  const campusPartners = Query.equal("campus_id", campusIds);
  const partnerRows = await db.listRows<BenefitPartners>(
    "app",
    PARTNERS_TABLE,
    [
      partnerIds.length > 0
        ? Query.or([Query.equal("$id", partnerIds), campusPartners])
        : campusPartners,
      Query.orderAsc("name"),
      Query.limit(BOARD_LIMIT),
    ]
  );

  return {
    benefits,
    campusId,
    editable: canEditBenefitCampus(access, campusId),
    partners: partnerRows.rows.map(toBoardPartner),
  };
}

/** The panel's data, including the code. Null when missing or not visible. */
export async function getBenefitForEdit(
  id: string
): Promise<BenefitEditData | null> {
  const ctx = await requireAuth();
  const access = benefitAccessFor(ctx);
  const { db } = await createAdminClient();

  const row = await loadBenefitRow(db, id);
  if (!(row && access.visibleCampusIds.includes(row.campus_id))) {
    return null;
  }
  const editable = canEditBenefitCampus(access, row.campus_id);
  // Only editors of the row's campus see the code; Hele BISO is read-only
  // for campus admins. Rows saved before `benefit_codes` existed still hold
  // the value inline.
  const code = editable
    ? ((await readBenefitCode(db, id)) ?? row.redemption_value ?? null)
    : null;

  return {
    ...toBoardBenefit(row),
    description_en: row.description_en ?? null,
    description_nb: row.description_nb ?? null,
    editable,
    redemption_value: code,
    terms_en: row.terms_en ?? null,
    terms_nb: row.terms_nb ?? null,
  };
}

export async function createBenefit(
  values: BenefitFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<BenefitMutationResult> {
  const ctx = await requireAuth();
  const validated = benefitSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const data = normalizeBenefitValues(validated.data);
    assertBenefitCampusWrite(ctx, data.campus_id);
    const { db } = await createAdminClient();

    const lookup = await lookupPartner(db, data);
    if (!lookup.ok) {
      return { error: BENEFIT_ERRORS.partnerNotFound };
    }
    const saved = await saveBenefitRow({
      ctx,
      db,
      existingTranslations: new Map(),
      id: ID.unique(),
      partner: lookup.partner,
      sortOrder: await nextSortOrder(db, data.campus_id, data.section),
      values: data,
    });

    await logAuditEvent(ctx, "benefit_created", {
      payload: { section: data.section, status: data.status },
      resourceId: saved.id,
      resourceType: "campus_benefit",
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: saved.id,
      columns: saved.columns,
      options: translationOptions,
      values: data,
    });
    revalidatePath("/benefits");
    return {
      data: saved.id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return { error: errorMessage(error, SAVE_FAILED) };
  }
}

export async function updateBenefit(
  id: string,
  values: BenefitFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<BenefitMutationResult> {
  const ctx = await requireAuth();
  const validated = benefitSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const data = normalizeBenefitValues(validated.data);
    const { db } = await createAdminClient();
    const stored = await loadBenefitRow(db, id);
    if (!stored) {
      return { error: BENEFIT_ERRORS.benefitNotFound };
    }
    // Moving a benefit needs write access on both campuses.
    assertBenefitCampusWrite(ctx, stored.campus_id);
    assertBenefitCampusWrite(ctx, data.campus_id);

    const lookup = await lookupPartner(db, data);
    if (!lookup.ok) {
      return { error: BENEFIT_ERRORS.partnerNotFound };
    }
    const keepsPlace =
      stored.campus_id === data.campus_id &&
      (stored.section ?? "member") === data.section;
    const saved = await saveBenefitRow({
      ctx,
      db,
      existingTranslations: await loadBenefitTranslationsByLocale(db, id),
      id,
      legacyPartner: legacyPartnerOf(stored, data),
      partner: lookup.partner,
      sortOrder: keepsPlace
        ? (stored.sort_order ?? 0)
        : await nextSortOrder(db, data.campus_id, data.section),
      values: data,
    });

    await logAuditEvent(ctx, "benefit_updated", {
      payload: { section: data.section, status: data.status },
      resourceId: id,
      resourceType: "campus_benefit",
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: id,
      columns: saved.columns,
      options: translationOptions,
      values: data,
    });
    revalidatePath("/benefits");
    revalidatePath(`/benefits/${id}`);
    return {
      data: id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return { error: errorMessage(error, SAVE_FAILED) };
  }
}

export async function deleteBenefit(
  id: string
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();

  try {
    const { db } = await createAdminClient();
    const stored = await loadBenefitRow(db, id);
    if (!stored) {
      return { error: BENEFIT_ERRORS.benefitNotFound };
    }
    assertBenefitCampusWrite(ctx, stored.campus_id);

    await deleteBenefitCode(db, id);
    // Translation children cascade with the row.
    await db.deleteRow("app", BENEFITS_TABLE, id);

    await logAuditEvent(ctx, "benefit_deleted", {
      payload: { campusId: stored.campus_id, section: stored.section },
      resourceId: id,
      resourceType: "campus_benefit",
    });
    revalidatePath("/benefits");
    return { data: id };
  } catch (error) {
    return { error: errorMessage(error, "Failed to delete benefit") };
  }
}

/**
 * Stores the order of one campus section. The list must name exactly the
 * section's current rows, so a stale board cannot drop or steal a row.
 */
export async function reorderBenefits(
  campusId: string,
  section: string,
  orderedIds: string[]
): Promise<{ data: true } | { error: string }> {
  const ctx = await requireAuth();

  try {
    assertBenefitCampusWrite(ctx, campusId);
    if (!isBenefitSection(section)) {
      return { error: BENEFIT_ERRORS.reorderOutOfDate };
    }
    const { db } = await createAdminClient();
    const response = await db.listRows<CampusBenefits>("app", BENEFITS_TABLE, [
      Query.equal("campus_id", campusId),
      sectionFilter(section),
      Query.limit(BOARD_LIMIT),
    ]);
    const current = new Map(
      response.rows
        .filter(
          (row) =>
            row.campus_id === campusId && (row.section ?? "member") === section
        )
        .map((row) => [row.$id, row.sort_order ?? 0])
    );
    const covers =
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.length === current.size &&
      orderedIds.every((id) => current.has(id));
    if (!covers) {
      return { error: BENEFIT_ERRORS.reorderOutOfDate };
    }

    const changed = orderedIds.flatMap((id, index) =>
      current.get(id) === index ? [] : [{ id, index }]
    );
    await Promise.all(
      changed.map(({ id, index }) =>
        db.updateRow("app", BENEFITS_TABLE, id, { sort_order: index })
      )
    );

    await logAuditEvent(ctx, "benefits_reordered", {
      payload: { campusId, ids: orderedIds, section },
      resourceType: "campus_benefit",
    });
    revalidatePath("/benefits");
    return { data: true };
  } catch (error) {
    return { error: errorMessage(error, "Failed to reorder benefits") };
  }
}

/**
 * Takes a benefit off the website: only the status and the permissions of
 * the row and its translation children change. Nothing is re-validated, so
 * a row the form would refuse (an old redemption type, a partner now out of
 * scope, longer text than the form allows) can always be hidden, and its
 * code row stays exactly as it is.
 */
async function withdrawBenefit(
  db: AdminDb,
  ctx: UserAuthContext,
  stored: CampusBenefits,
  status: "archived" | "draft"
): Promise<BenefitMutationResult> {
  const id = stored.$id;
  await db.updateRow(
    "app",
    BENEFITS_TABLE,
    id,
    { status },
    benefitRowPermissions(status)
  );
  const translations = await loadBenefitTranslationsByLocale(db, id);
  const translationPermissions = benefitTranslationPermissions(status);
  await Promise.all(
    [...translations.values()].map((translation) =>
      db.updateRow(
        "app",
        TRANSLATIONS_TABLE,
        translation.$id,
        {},
        translationPermissions
      )
    )
  );

  await logAuditEvent(ctx, "benefit_updated", {
    payload: { section: stored.section ?? "member", status },
    resourceId: id,
    resourceType: "campus_benefit",
  });
  revalidatePath("/benefits");
  revalidatePath(`/benefits/${id}`);
  return { data: id };
}

/**
 * Publishing goes through the same write path as a save, so the row is
 * validated and its partner and code are checked. Hiding and moving back to
 * draft change only the status and who can read it.
 */
export async function setBenefitStatus(
  id: string,
  status: "draft" | "published" | "archived"
): Promise<BenefitMutationResult> {
  const ctx = await requireAuth();

  try {
    const { db } = await createAdminClient();
    const stored = await loadBenefitRow(db, id);
    if (!stored) {
      return { error: BENEFIT_ERRORS.benefitNotFound };
    }
    // Refuse before the code row is read.
    assertBenefitCampusWrite(ctx, stored.campus_id);
    if (status !== "published") {
      return await withdrawBenefit(db, ctx, stored, status);
    }
    const code =
      (await readBenefitCode(db, id)) ?? stored.redemption_value ?? null;
    // Mapping a legacy type (e.g. "qr") to "none" would delete its value.
    if (
      stored.redemption_type &&
      !isRedemptionType(stored.redemption_type) &&
      code?.trim()
    ) {
      return { error: BENEFIT_ERRORS.legacyRedemption };
    }
    return await updateBenefit(id, {
      ...formValuesFromRow(stored, code),
      status,
    });
  } catch (error) {
    return { error: errorMessage(error, SAVE_FAILED) };
  }
}

/** Paginated benefit list, kept for the admin assistant. */
export async function listBenefits(
  params: ListParams & { status?: string }
): Promise<PaginatedResult<CampusBenefits>> {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // campus filter below is the authorization boundary.
  const { db } = await createAdminClient();
  const { visibleCampusIds } = benefitAccessFor(ctx);

  const queries: string[] = [
    visibleCampusIds.length > 0
      ? Query.equal("campus_id", visibleCampusIds)
      : NO_MATCH_FILTER,
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    ...paginationQueries(params),
  ];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }

  // Titles are duplicated onto the row, so one query covers both locales —
  // no content_translations round trip needed here.
  if (params.q) {
    queries.push(
      Query.or([
        Query.contains("title_nb", params.q),
        Query.contains("title_en", params.q),
      ])
    );
  }

  const response = await db.listRows<CampusBenefits>(
    "app",
    BENEFITS_TABLE,
    queries
  );

  return {
    // The list never needs codes; drop the compatibility copy.
    rows: response.rows.map((row) => ({ ...row, redemption_value: null })),
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

export async function listPartners(
  params: ListParams & { campusId?: string }
): Promise<PaginatedResult<Partners>> {
  const ctx = await requireAuth();
  // Partner administration keeps its existing narrow, campus-scoped access.
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("name"),
    ...paginationQueries(params),
  ];

  // `partners` carries a fulltext index on name (idx_name).
  if (params.q) {
    queries.push(Query.contains("name", params.q));
  }

  if (params.campusId) {
    queries.push(Query.equal("campus_id", params.campusId));
  } else if (ctx.activeCampusId) {
    // Global admin scoped to a campus via the switcher.
    queries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  } else if (
    ctx.managedCampusIds.length > 0 &&
    !ctx.roles.includes("globaladmin")
  ) {
    queries.push(Query.equal("campus_id", ctx.managedCampusIds));
  }

  const response = await db.listRows<Partners>("app", "partners", queries);

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}
