"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ContentTranslations,
  News,
  NewsStatus,
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
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
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
import {
  getNewsTranslationInputs,
  type NewsTranslationDraft,
  type NewsTranslationInput,
} from "../news/[id]/_components/news-studio-state";
import { logAuditEvent } from "./audit-log";
import { NEWS_PAGE_SIZE, type NewsFormValues, newsSchema } from "./schemas";

type NewsDatabase = Awaited<ReturnType<typeof createAdminClient>>["db"];
type TranslationPermissions = ReturnType<
  typeof buildContentTranslationPermissions
>;

type NewsWithTranslations = News & {
  translation_refs?: ContentTranslations[] | null;
};

type GenerateNewsTranslationDraftInput = NewsTranslationDraft & {
  campusId: string;
  departmentId?: string | null;
  sourceLocale: ContentLocale;
};

interface ScheduleNewsTranslationInput {
  additionalFields: string;
  articleId: string;
  autoTranslation?: AutoTranslationOptions;
  permissions: TranslationPermissions;
  values: NewsFormValues;
}

const NEWS_RELATIONSHIP_SELECT = Query.select([
  "*",
  "campus.$id",
  "department.$id",
  "translation_refs.*",
]);

const translateNewsDraft = async (
  sourceLocale: ContentLocale,
  source: NewsTranslationDraft
): Promise<NewsTranslationDraft> => {
  const translated = await translateContentFields({
    contentType: "news article",
    fields: [
      { format: "plain", key: "title", value: source.title },
      {
        format: "html",
        key: "description",
        value: source.description,
      },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    title: translated.title ?? "",
  };
};

/**
 * The destination is only ours to overwrite while it still holds exactly what
 * this save wrote. An editor who translated the other locale by hand while the
 * model request was in flight owns the newer text.
 */
const isUntouchedNewsDestination = (
  values: NewsFormValues,
  targetLocale: ContentLocale,
  currentTarget: ContentTranslations | undefined
): boolean => {
  const scheduledTarget = getNewsTranslationInputs(values).find(
    (translation) => translation.locale === targetLocale
  );
  return isCurrentTranslationSource(
    {
      description: scheduledTarget?.description ?? "",
      title: scheduledTarget?.title ?? "",
    },
    {
      description: currentTarget?.description ?? "",
      title: currentTarget?.title ?? "",
    }
  );
};

const scheduleNewsTranslation = ({
  additionalFields,
  articleId,
  autoTranslation,
  permissions,
  values,
}: ScheduleNewsTranslationInput): boolean => {
  const sourceLocale = autoTranslation?.sourceLocale;
  const source = sourceLocale
    ? getNewsTranslationInputs(values).find(
        (translation) => translation.locale === sourceLocale
      )
    : undefined;

  return scheduleContentTranslation({
    enabled: Boolean(autoTranslation?.enabled && source?.title.trim()),
    task: async () => {
      if (!(source && sourceLocale)) {
        return;
      }
      const translated = await translateNewsDraft(sourceLocale, source);
      // Fresh admin client: the request that scheduled this callback is done.
      const { db } = await createAdminClient();
      const currentArticle = await db.getRow<NewsWithTranslations>(
        "app",
        "news",
        articleId,
        [NEWS_RELATIONSHIP_SELECT]
      );
      const ownership = getContentOwnership(currentArticle, {
        legacyFallback: true,
      });
      if (
        !isCurrentTranslationSource(
          {
            campusId: values.campus_id,
            departmentId: values.department_id ?? null,
            status: values.status,
          },
          {
            campusId: ownership.campus,
            departmentId: ownership.department,
            status: currentArticle.status,
          }
        )
      ) {
        return;
      }
      // The synchronous save linked the source locale before scheduling, so
      // the parent relation is the authoritative read path here.
      const currentTranslations = currentArticle.translation_refs ?? [];
      const currentSource = currentTranslations.find(
        (translation) => translation.locale === sourceLocale
      );
      if (
        !(
          currentSource &&
          isCurrentTranslationSource(
            { description: source.description, title: source.title },
            {
              description: currentSource.description ?? "",
              title: currentSource.title ?? "",
            }
          )
        )
      ) {
        return;
      }
      if ((currentSource.additional_fields ?? "") !== additionalFields) {
        return;
      }

      const targetLocale = getTargetLocale(sourceLocale);
      const currentTarget = currentTranslations.find(
        (translation) => translation.locale === targetLocale
      );
      if (!isUntouchedNewsDestination(values, targetLocale, currentTarget)) {
        return;
      }
      const data = {
        additional_fields: additionalFields,
        content_id: articleId,
        content_type: "news" as const,
        description: translated.description,
        locale: targetLocale,
        title: translated.title,
      };
      if (currentTarget) {
        await db.updateRow(
          "app",
          "content_translations",
          currentTarget.$id,
          data,
          permissions
        );
        return;
      }
      await db.createRow(
        "app",
        "content_translations",
        ID.unique(),
        // A fresh destination row must arrive already related to its parent.
        { ...data, news_ref: articleId },
        permissions
      );
    },
  });
};

export async function generateNewsTranslationDraft(
  input: GenerateNewsTranslationDraftInput
) {
  const ctx = await requireAuth();
  if (input.sourceLocale !== "no" && input.sourceLocale !== "en") {
    return { error: "Unsupported source locale" };
  }
  const source = {
    description: input.description ?? "",
    title: input.title ?? "",
  };
  if (!(source.title.trim() || source.description.trim())) {
    return { error: "Add source content before translating" };
  }

  try {
    assertWriteAccess(ctx, input.campusId, input.departmentId ?? null);
    return { data: await translateNewsDraft(input.sourceLocale, source) };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to translate news",
    };
  }
}

interface NestedTranslationChild {
  $id?: string;
  $permissions: TranslationPermissions;
  additional_fields: string;
  content_id: string;
  content_type: "news";
  description: string;
  locale: string;
  title: string;
}

/**
 * Nested relationship children for the parent upsert: an existing `$id` makes
 * Appwrite update-and-keep that child, omitting it creates and links a new
 * one. Explicit `$permissions` avoid relying on permission inheritance.
 */
const buildNestedTranslations = (
  articleId: string,
  translations: NewsTranslationInput[],
  existingByLocale: Map<string, ContentTranslations>,
  additionalFields: string,
  permissions: TranslationPermissions
): NestedTranslationChild[] =>
  translations.map((translation) => {
    const existing = existingByLocale.get(translation.locale);
    return {
      ...(existing ? { $id: existing.$id } : {}),
      $permissions: permissions,
      additional_fields: additionalFields,
      content_id: articleId,
      content_type: "news",
      description: translation.description,
      locale: translation.locale,
      title: translation.title,
    };
  });

/**
 * Existing locales are looked up by content metadata, not the relation: rows
 * that predate the relationship backfill are unlinked, and matching them here
 * both prevents duplicate locale rows and re-links them on the next save.
 */
const loadTranslationsByLocale = async (
  db: NewsDatabase,
  articleId: string
): Promise<Map<string, ContentTranslations>> => {
  const current = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "news"),
      Query.equal("content_id", articleId),
      Query.limit(10),
    ]
  );
  return new Map(
    current.rows.map((translation) => [translation.locale, translation])
  );
};

export async function listNews(opts?: {
  campusId?: string;
  status?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(NEWS_PAGE_SIZE),
    Query.offset((page - 1) * NEWS_PAGE_SIZE),
    ...applyContentRelationshipScopeQueries(ctx),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<News>("app", "news", queries);
  const total = response.total;

  const newsIds = response.rows.map((n) => n.$id);
  const translations: ContentTranslations[] = [];

  if (newsIds.length > 0) {
    const chunkSize = 25;
    for (let i = 0; i < newsIds.length; i += chunkSize) {
      const chunk = newsIds.slice(i, i + chunkSize);
      const res = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "news"),
          Query.equal("content_id", chunk),
          Query.limit(chunk.length * 2),
        ]
      );
      translations.push(...res.rows);
    }
  }

  const rows = response.rows.map((article) => ({
    ...article,
    translation_refs: translations.filter((t) => t.content_id === article.$id),
  }));

  return { rows, total };
}

export async function getNewsArticle(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = response.rows[0];
  if (!article) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(article, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }

  const translationsResponse = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "news"),
      Query.equal("content_id", id),
      Query.limit(10),
    ]
  );

  return { ...article, translation_refs: translationsResponse.rows };
}

export async function createNews(
  values: NewsFormValues,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = newsSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createAdminClient();
    // Requested ownership is untrusted client input: verify the department
    // belongs to the campus and the caller may author in that scope.
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

    const lookups = await loadRecruitmentLookups(db);
    const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const translationPermissions = buildContentTranslationPermissions({
      audience: "public",
      status: validated.data.status,
      ownerUserId: ctx.userId,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    });
    const additionalFields = JSON.stringify({
      author: validated.data.author,
      category: validated.data.category,
    });

    const articleId = ID.unique();
    const article = await db.upsertRow(
      "app",
      "news",
      articleId,
      {
        slug: validated.data.slug,
        status: validated.data.status as NewsStatus,
        // Canonical ownership relationships; the scalar columns remain as
        // migration-era compatibility metadata only.
        campus: validated.data.campus_id,
        campus_id: validated.data.campus_id,
        department: validated.data.department_id ?? null,
        department_id: validated.data.department_id ?? null,
        image: validated.data.image || null,
        sticky: validated.data.sticky ?? false,
        author: validated.data.author ?? null,
        translation_refs: buildNestedTranslations(
          articleId,
          getNewsTranslationInputs(validated.data),
          new Map(),
          additionalFields,
          translationPermissions
        ),
      },
      buildContentRowPermissions({
        status: validated.data.status,
        audience: "public",
        campusTeam,
        deptTeam,
      })
    );

    await logAuditEvent(ctx, "news_created", {
      resourceId: article.$id,
      resourceType: "news",
    });
    const translationQueued = scheduleNewsTranslation({
      additionalFields,
      articleId: article.$id,
      autoTranslation: translationOptions,
      permissions: translationPermissions,
      values: validated.data,
    });
    revalidatePath("/news");
    return translationQueued
      ? { data: article.$id, translationQueued: true as const }
      : { data: article.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save article",
    };
  }
}

export async function updateNews(
  id: string,
  values: NewsFormValues,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = newsSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { db } = await createAdminClient();

  const existing = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = existing.rows[0];
  if (!article) {
    return { error: "Article not found" };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    // Authorize both the persisted scope and the requested scope so ownership
    // transfers require access on each side.
    const persisted = getContentOwnership(article, { legacyFallback: true });
    assertWriteAccess(ctx, persisted.campus, persisted.department);
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (
      article.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, persisted.campus, persisted.department);
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const lookups = await loadRecruitmentLookups(db);
    const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });
    const translationPermissions = buildContentTranslationPermissions({
      audience: "public",
      status: validated.data.status,
      ownerUserId: ctx.userId,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    });
    const additionalFields = JSON.stringify({
      author: validated.data.author,
      category: validated.data.category,
    });

    const existingByLocale = await loadTranslationsByLocale(db, id);
    const submittedTranslations = getNewsTranslationInputs(validated.data);
    const submittedLocales = new Set(
      submittedTranslations.map((translation) => translation.locale)
    );

    await db.upsertRow(
      "app",
      "news",
      id,
      {
        slug: validated.data.slug,
        status: validated.data.status as NewsStatus,
        campus: validated.data.campus_id,
        campus_id: validated.data.campus_id,
        department: validated.data.department_id ?? null,
        department_id: validated.data.department_id ?? null,
        image: validated.data.image || null,
        sticky: validated.data.sticky ?? false,
        author: validated.data.author ?? null,
        translation_refs: buildNestedTranslations(
          id,
          submittedTranslations,
          existingByLocale,
          additionalFields,
          translationPermissions
        ),
      },
      buildContentRowPermissions({
        status: validated.data.status,
        audience: "public",
        campusTeam,
        deptTeam,
      })
    );

    // A locale the editor cleared is really deleted, not just unlinked.
    await Promise.all(
      [...existingByLocale.values()]
        .filter((translation) => !submittedLocales.has(translation.locale))
        .map((translation) =>
          db.deleteRow("app", "content_translations", translation.$id)
        )
    );

    await logAuditEvent(ctx, "news_updated", {
      resourceId: id,
      resourceType: "news",
      payload: { status: validated.data.status },
    });
    const translationQueued = scheduleNewsTranslation({
      additionalFields,
      articleId: id,
      autoTranslation: translationOptions,
      permissions: translationPermissions,
      values: validated.data,
    });
    revalidatePath("/news");
    revalidatePath(`/news/${id}`);
    return translationQueued
      ? { data: id, translationQueued: true as const }
      : { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save article",
    };
  }
}

export async function deleteNews(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = existing.rows[0];
  if (!article) {
    return { error: "Article not found" };
  }

  try {
    const ownership = getContentOwnership(article, { legacyFallback: true });
    assertWriteAccess(ctx, ownership.campus, ownership.department);

    const translations = await db.listRows("app", "content_translations", [
      Query.equal("content_type", "news"),
      Query.equal("content_id", id),
      Query.limit(100),
    ]);
    await Promise.all(
      translations.rows.map((t) =>
        db.deleteRow("app", "content_translations", t.$id)
      )
    );
    await db.deleteRow("app", "news", id);

    await logAuditEvent(ctx, "news_deleted", {
      resourceId: id,
      resourceType: "news",
    });
    revalidatePath("/news");
    return { data: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete article",
    };
  }
}
