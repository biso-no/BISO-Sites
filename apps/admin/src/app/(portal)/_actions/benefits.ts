"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type {
  CampusBenefits,
  CampusBenefitsStatus,
  Partners,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
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
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { type BenefitFormValues, benefitSchema } from "./schemas";

interface BenefitTranslationSnapshot {
  description: string;
  teaser: string;
  title: string;
}

type BenefitTranslationDraftInput = BenefitTranslationSnapshot & {
  campusId: string;
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

const scheduleBenefitTranslation = ({
  benefitId,
  options,
  source,
}: {
  benefitId: string;
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

      const destinationColumns =
        getTargetLocale(options.sourceLocale) === "en"
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
    assertWriteAccess(ctx, input.campusId);
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

export async function listBenefits(opts?: {
  campusId?: string;
  status?: string;
  kind?: string;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  if (opts?.kind) {
    queries.push(Query.equal("kind", opts.kind));
  }

  // campus_benefits is campus-scoped only (no department column). This also
  // honors the global-admin campus switcher (activeCampusId).
  queries.push(...applyScopeQueries(ctx, { departmentField: null }));

  const response = await db.listRows<CampusBenefits>(
    "app",
    "campus_benefits",
    queries
  );
  return response.rows;
}

export async function getBenefit(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = response.rows[0] ?? null;
  // Treat a row outside the caller's campus scope as not found.
  if (!(benefit && hasRowAccess(ctx, benefit.campus_id))) {
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
    assertWriteAccess(ctx, validated.data.campus_id);
    if (validated.data.status === "published") {
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    const { db } = await createSessionClient();

    const benefit = await db.createRow("app", "campus_benefits", "unique()", {
      campus_id: validated.data.campus_id,
      status: validated.data.status as CampusBenefitsStatus,
      kind: validated.data.kind,
      redemption_type: validated.data.redemption_type,
      redemption_value: validated.data.redemption_value ?? null,
      category: validated.data.category,
      partner_name: validated.data.partner_name ?? null,
      title_nb: validated.data.title_nb,
      title_en: validated.data.title_en,
      description_nb: validated.data.description_nb,
      description_en: validated.data.description_en,
      teaser_nb: validated.data.teaser_nb ?? null,
      teaser_en: validated.data.teaser_en ?? null,
      image_url: validated.data.image_url || null,
      is_featured: validated.data.is_featured ?? false,
      is_member_only: validated.data.is_member_only ?? true,
      publish_start: validated.data.publish_start ?? null,
      publish_end: validated.data.publish_end ?? null,
      sort_order: validated.data.sort_order ?? 0,
    });

    await logAuditEvent(ctx, "benefit_created", {
      resourceId: benefit.$id,
      resourceType: "campus_benefit",
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: benefit.$id,
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

  const { db } = await createSessionClient();

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
    assertWriteAccess(ctx, benefit.campus_id);
    assertWriteAccess(ctx, validated.data.campus_id);
    if (
      benefit.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, benefit.campus_id);
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    await db.updateRow("app", "campus_benefits", id, {
      campus_id: validated.data.campus_id,
      status: validated.data.status as CampusBenefitsStatus,
      kind: validated.data.kind,
      redemption_type: validated.data.redemption_type,
      redemption_value: validated.data.redemption_value ?? null,
      category: validated.data.category,
      partner_name: validated.data.partner_name ?? null,
      title_nb: validated.data.title_nb,
      title_en: validated.data.title_en,
      description_nb: validated.data.description_nb,
      description_en: validated.data.description_en,
      teaser_nb: validated.data.teaser_nb ?? null,
      teaser_en: validated.data.teaser_en ?? null,
      image_url: validated.data.image_url || null,
      is_featured: validated.data.is_featured ?? false,
      is_member_only: validated.data.is_member_only ?? true,
      publish_start: validated.data.publish_start ?? null,
      publish_end: validated.data.publish_end ?? null,
      sort_order: validated.data.sort_order ?? 0,
    });

    await logAuditEvent(ctx, "benefit_updated", {
      resourceId: id,
      resourceType: "campus_benefit",
      payload: { status: validated.data.status },
    });
    const translationQueued = scheduleBenefitTranslation({
      benefitId: id,
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
  const { db } = await createSessionClient();

  const existing = await db.listRows<CampusBenefits>("app", "campus_benefits", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const benefit = existing.rows[0];
  if (!benefit) {
    return { error: "Benefit not found" };
  }

  assertWriteAccess(ctx, benefit.campus_id);

  await db.deleteRow("app", "campus_benefits", id);

  revalidatePath("/benefits");
  return { data: true };
}

export async function listPartners(opts?: { campusId?: string }) {
  const ctx = await requireAuth();
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
