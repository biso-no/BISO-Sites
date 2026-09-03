"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  CampusBenefits,
  CampusBenefitsStatus,
  ContentTranslations,
  Partners,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  type AutoTranslationOptions,
  type ContentLocale,
  getTargetLocale,
  isCurrentTranslationSource,
} from "@/lib/content-translation";
import {
  contentLocaleSchema,
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import {
  type ListParams,
  type PaginatedResult,
  paginationQueries,
} from "@/lib/list-params";
import { loadRecruitmentLookups } from "@/lib/recruitment";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
  deriveContentRowTeams,
} from "@/lib/utils";
import {
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { type BenefitFormValues, benefitSchema } from "./schemas";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

interface BenefitTranslationSnapshot {
  description: string;
  teaser: string;
  title: string;
}

type BenefitTranslationDraftInput = BenefitTranslationSnapshot & {
  campusId: string;
  departmentId?: string | null;
  sourceLocale: ContentLocale;
};

type BenefitMutationResult =
  | {
      data: string;
      error?: undefined;
      translationQueued?: true;
    }
  | {
      data?: undefined;
      error: string | Record<string, string[] | undefined>;
      translationQueued?: undefined;
    };

const getBenefitTranslationSnapshot = (
  benefit: Pick<
    CampusBenefits,
    | "description_en"
    | "description_nb"
    | "teaser_en"
    | "teaser_nb"
    | "title_en"
    | "title_nb"
  >,
  sourceLocale: ContentLocale
): BenefitTranslationSnapshot =>
  sourceLocale === "no"
    ? {
        description: benefit.description_nb,
        teaser: benefit.teaser_nb ?? "",
        title: benefit.title_nb,
      }
    : {
        description: benefit.description_en,
        teaser: benefit.teaser_en ?? "",
        title: benefit.title_en,
      };

const getBenefitValuesTranslationSnapshot = (
  values: BenefitFormValues,
  sourceLocale: ContentLocale
): BenefitTranslationSnapshot =>
  sourceLocale === "no"
    ? {
        description: values.description_nb,
        teaser: values.teaser_nb ?? "",
        title: values.title_nb,
      }
    : {
        description: values.description_en,
        teaser: values.teaser_en ?? "",
        title: values.title_en,
      };

const translateBenefitSnapshot = async (
  source: BenefitTranslationSnapshot,
  sourceLocale: ContentLocale
): Promise<BenefitTranslationSnapshot> => {
  const translated = await translateContentFields({
    contentType: "member benefit",
    fields: [
      { format: "plain", key: "title", value: source.title },
      { format: "html", key: "description", value: source.description },
      { format: "plain", key: "teaser", value: source.teaser },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    teaser: translated.teaser ?? "",
    title: translated.title ?? "",
  };
};

const hasBenefitTranslationSource = ({
  description,
  title,
}: BenefitTranslationSnapshot): boolean =>
  Boolean(description.trim() && title.trim());

const hasBenefitLocaleContent = (
  snapshot: BenefitTranslationSnapshot
): boolean => Boolean(snapshot.title.trim() || snapshot.description.trim());

interface NestedBenefitTranslation {
  $id?: string;
  $permissions: string[];
  additional_fields: null;
  content_id: string;
  content_type: "memberBenefit";
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

/**
 * Linked `content_translations` children mirroring the inline bilingual
 * columns, so existing consumers keep reading the inline fields while the
 * relationship becomes complete. An existing `$id` updates that child in
 * place; omitting it creates and links a new one.
 */
const buildBenefitTranslationChildren = (
  benefitId: string,
  values: BenefitFormValues,
  existingByLocale: Map<string, ContentTranslations>,
  permissions: string[]
): NestedBenefitTranslation[] => {
  const children: NestedBenefitTranslation[] = [];
  for (const locale of ["no", "en"] as const) {
    const snapshot = getBenefitValuesTranslationSnapshot(values, locale);
    const existing = existingByLocale.get(locale);
    if (!(hasBenefitLocaleContent(snapshot) || existing)) {
      continue;
    }
    children.push({
      ...(existing ? { $id: existing.$id } : {}),
      $permissions: permissions,
      additional_fields: null,
      content_id: benefitId,
      content_type: "memberBenefit",
      description: snapshot.description,
      locale,
      short_description: snapshot.teaser || null,
      title: snapshot.title,
    });
  }
  return children;
};

/**
 * Existing locales are looked up by content metadata, not the relation: rows
 * that predate the relationship backfill are unlinked, and matching them here
 * both prevents duplicate locale rows and re-links them on the next save.
 */
const loadBenefitTranslationsByLocale = async (
  db: AdminDb,
  benefitId: string
): Promise<Map<string, ContentTranslations>> => {
  const current = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "memberBenefit"),
      Query.equal("content_id", benefitId),
      Query.limit(5),
    ]
  );
  return new Map(
    current.rows.map((translation) => [translation.locale, translation])
  );
};

const buildBenefitPermissions = async (
  db: AdminDb,
  values: Pick<
    BenefitFormValues,
    "campus_id" | "department_id" | "is_member_only" | "status"
  >
): Promise<{ rowPermissions: string[]; translationPermissions: string[] }> => {
  const lookups = await loadRecruitmentLookups(db);
  const audience = values.is_member_only ? "members" : "public";
  const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
    campus_id: values.campus_id,
    department_id: values.department_id ?? null,
  });
  return {
    rowPermissions: buildContentRowPermissions({
      status: values.status,
      audience,
      campusTeam,
      deptTeam,
    }),
    translationPermissions: buildContentTranslationPermissions({
      audience,
      status: values.status,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    }),
  };
};

const buildBenefitColumns = (values: BenefitFormValues) => ({
  // Canonical ownership relationships; the scalar column remains as
  // migration-era compatibility metadata only.
  campus: values.campus_id,
  campus_id: values.campus_id,
  department: values.department_id ?? null,
  status: values.status as CampusBenefitsStatus,
  kind: values.kind,
  redemption_type: values.redemption_type,
  redemption_value: values.redemption_value ?? null,
  category: values.category,
  partner_name: values.partner_name ?? null,
  title_nb: values.title_nb,
  title_en: values.title_en,
  description_nb: values.description_nb,
  description_en: values.description_en,
  teaser_nb: values.teaser_nb ?? null,
  teaser_en: values.teaser_en ?? null,
  image_url: values.image_url || null,
  is_featured: values.is_featured ?? false,
  is_member_only: values.is_member_only ?? true,
  publish_start: values.publish_start ?? null,
  publish_end: values.publish_end ?? null,
  sort_order: values.sort_order ?? 0,
});

const scheduleBenefitTranslation = ({
  benefitId,
  destination,
  options,
  source,
}: {
  benefitId: string;
  /** The target locale as this save left it — see the stale check below. */
  destination: BenefitTranslationSnapshot;
  options?: AutoTranslationOptions;
  source: BenefitTranslationSnapshot;
}): boolean => {
  if (!(options?.enabled && hasBenefitTranslationSource(source))) {
    return false;
  }

  return scheduleContentTranslation({
    enabled: true,
    task: async () => {
      const translated = await translateBenefitSnapshot(
        source,
        options.sourceLocale
      );
      // Fresh admin client: the request that scheduled this callback is done.
      const { db } = await createAdminClient();
      const response = await db.listRows<CampusBenefits>(
        "app",
        "campus_benefits",
        [Query.equal("$id", benefitId), Query.limit(1)]
      );
      const current = response.rows[0];
      if (!current) {
        return;
      }
      const currentSource = getBenefitTranslationSnapshot(
        current,
        options.sourceLocale
      );
      if (!isCurrentTranslationSource({ ...source }, { ...currentSource })) {
        return;
      }

      const targetLocale = getTargetLocale(options.sourceLocale);
      // The destination is only ours to overwrite while it still holds exactly
      // what this save wrote. An editor who translated the other locale by hand
      // while the model request was in flight owns the newer text.
      if (
        !isCurrentTranslationSource(
          { ...destination },
          { ...getBenefitTranslationSnapshot(current, targetLocale) }
        )
      ) {
        return;
      }
      const destinationColumns =
        targetLocale === "en"
          ? {
              description_en: translated.description,
              teaser_en: translated.teaser,
              title_en: translated.title,
            }
          : {
              description_nb: translated.description,
              teaser_nb: translated.teaser,
              title_nb: translated.title,
            };
      await db.updateRow(
        "app",
        "campus_benefits",
        benefitId,
        destinationColumns
      );

      // Mirror the destination into its linked content_translations child so
      // the relationship stays complete alongside the inline columns.
      const ownership = getContentOwnership(current, { legacyFallback: true });
      const { translationPermissions } = await buildBenefitPermissions(db, {
        campus_id: ownership.campus ?? "",
        department_id: ownership.department,
        is_member_only: current.is_member_only ?? true,
        status: current.status,
      });
      const existingByLocale = await loadBenefitTranslationsByLocale(
        db,
        benefitId
      );
      const existingTarget = existingByLocale.get(targetLocale);
      const childData = {
        additional_fields: null,
        content_id: benefitId,
        content_type: "memberBenefit" as const,
        description: translated.description,
        locale: targetLocale,
        short_description: translated.teaser || null,
        title: translated.title,
      };
      if (existingTarget) {
        await db.updateRow(
          "app",
          "content_translations",
          existingTarget.$id,
          childData,
          translationPermissions
        );
        return;
      }
      await db.createRow(
        "app",
        "content_translations",
        ID.unique(),
        // A fresh destination row must arrive already related to its parent.
        { ...childData, memberBenefit: benefitId },
        translationPermissions
      );
    },
  });
};

export async function generateBenefitTranslationDraft(
  input: BenefitTranslationDraftInput
) {
  const ctx = await requireAuth();
  if (!contentLocaleSchema.safeParse(input.sourceLocale).success) {
    return { error: "Unsupported source locale" };
  }
  if (
    !(input.title.trim() || input.description.trim() || input.teaser.trim())
  ) {
    return { error: "Add source-language benefit content first." };
  }

  try {
    // Department authors own their department's benefits, so the selected
    // department has to travel with the campus or they fail this check.
    assertWriteAccess(ctx, input.campusId, input.departmentId ?? null);
    return {
      data: await translateBenefitSnapshot(input, input.sourceLocale),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate benefit translation",
    };
  }
}

export async function listBenefits(
  params: ListParams & {
    campusId?: string;
    status?: string;
    kind?: string;
  }
): Promise<PaginatedResult<CampusBenefits>> {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    ...paginationQueries(params),
  ];

  if (params.status && params.status !== "all") {
    queries.push(Query.equal("status", params.status));
  }

  if (params.kind) {
    queries.push(Query.equal("kind", params.kind));
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

  queries.push(...applyContentRelationshipScopeQueries(ctx));

  const response = await db.listRows<CampusBenefits>(
    "app",
    "campus_benefits",
    queries
  );

  return {
    rows: response.rows,
    total: response.total,
    page: params.page,
    size: params.size,
  };
}

export async function getBenefit(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = response.rows[0] ?? null;
  if (!benefit) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(benefit, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }
  return benefit;
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
    const { db } = await createAdminClient();
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (validated.data.status === "published") {
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const { rowPermissions, translationPermissions } =
      await buildBenefitPermissions(db, validated.data);

    const benefitId = ID.unique();
    const benefit = await db.upsertRow(
      "app",
      "campus_benefits",
      benefitId,
      {
        ...buildBenefitColumns(validated.data),
        contentTranslations: buildBenefitTranslationChildren(
          benefitId,
          validated.data,
          new Map(),
          translationPermissions
        ),
      },
      rowPermissions
    );

    await logAuditEvent(ctx, "benefit_created", {
      resourceId: benefit.$id,
      resourceType: "campus_benefit",
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: benefit.$id,
      destination: getBenefitValuesTranslationSnapshot(
        validated.data,
        getTargetLocale(translationOptions?.sourceLocale ?? "no")
      ),
      options: translationOptions,
      source: getBenefitValuesTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "no"
      ),
    });
    revalidatePath("/benefits");
    return {
      data: benefit.$id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save benefit",
    };
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

  const { db } = await createAdminClient();

  const existing = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = existing.rows[0];
  if (!benefit) {
    return { error: "Benefit not found" };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    // Authorize both the persisted scope and the requested scope so ownership
    // transfers require access on each side.
    const persisted = getContentOwnership(benefit, { legacyFallback: true });
    assertWriteAccess(ctx, persisted.campus, persisted.department);
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (
      benefit.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, persisted.campus, persisted.department);
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const { rowPermissions, translationPermissions } =
      await buildBenefitPermissions(db, validated.data);
    const existingByLocale = await loadBenefitTranslationsByLocale(db, id);

    await db.upsertRow(
      "app",
      "campus_benefits",
      id,
      {
        ...buildBenefitColumns(validated.data),
        contentTranslations: buildBenefitTranslationChildren(
          id,
          validated.data,
          existingByLocale,
          translationPermissions
        ),
      },
      rowPermissions
    );

    await logAuditEvent(ctx, "benefit_updated", {
      resourceId: id,
      resourceType: "campus_benefit",
      payload: { status: validated.data.status },
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: id,
      destination: getBenefitValuesTranslationSnapshot(
        validated.data,
        getTargetLocale(translationOptions?.sourceLocale ?? "no")
      ),
      options: translationOptions,
      source: getBenefitValuesTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "no"
      ),
    });
    revalidatePath("/benefits");
    revalidatePath(`/benefits/${id}`);
    return {
      data: id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save benefit",
    };
  }
}

async function _deleteBenefit(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = existing.rows[0];
  if (!benefit) {
    return { error: "Benefit not found" };
  }

  const ownership = getContentOwnership(benefit, { legacyFallback: true });
  assertWriteAccess(ctx, ownership.campus, ownership.department);

  await db.deleteRow("app", "campus_benefits", id);

  revalidatePath("/benefits");
  return { data: true };
}

export async function listPartners(opts?: { campusId?: string }) {
  const ctx = await requireAuth();
  // Partner administration keeps its existing narrow, campus-scoped access.
  const { db } = await createSessionClient();

  const queries: string[] = [Query.orderAsc("name"), Query.limit(100)];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
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
  return response.rows;
}
