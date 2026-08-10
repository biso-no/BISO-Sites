"use server";

import { Permission, Query, Role } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  News,
  NewsStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import { loadRecruitmentLookups } from "@/lib/recruitment";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
  deriveContentRowTeams,
} from "@/lib/utils";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import {
  getNewsTranslationInputs,
  type NewsTranslationInput,
} from "../news/[id]/_components/news-studio-state";
import { logAuditEvent } from "./audit-log";
import { NEWS_PAGE_SIZE, type NewsFormValues, newsSchema } from "./schemas";

type NewsDatabase = Awaited<ReturnType<typeof createSessionClient>>["db"];
type TranslationPermissions = ReturnType<
  typeof buildContentTranslationPermissions
>;
type RowPermissions = ReturnType<typeof buildContentRowPermissions>;

const buildStagingNewsRowPermissions = (
  canonicalPermissions: RowPermissions,
  creatorUserId: string
): RowPermissions => {
  const creator = Role.user(creatorUserId);
  return [
    ...new Set([
      ...canonicalPermissions,
      Permission.read(creator),
      Permission.update(creator),
      Permission.delete(creator),
    ]),
  ];
};

const createNewsTranslations = async (
  db: NewsDatabase,
  articleId: string,
  translations: NewsTranslationInput[],
  additionalFields: string,
  permissions: TranslationPermissions,
  translationIds: string[]
): Promise<void> => {
  for (const translation of translations) {
    const createdTranslation = await db.createRow(
      "app",
      "content_translations",
      "unique()",
      {
        additional_fields: additionalFields,
        content_id: articleId,
        content_type: "news",
        description: translation.description,
        locale: translation.locale,
        title: translation.title,
      },
      permissions
    );
    translationIds.push(createdTranslation.$id);
  }
};

const publishStagedNewsTranslations = async (
  db: NewsDatabase,
  translationIds: string[],
  translationPermissions: TranslationPermissions
): Promise<void> => {
  for (const translationId of translationIds) {
    await db.updateRow(
      "app",
      "content_translations",
      translationId,
      {},
      translationPermissions
    );
  }
};

const finalizeStagedNewsRow = async (
  db: NewsDatabase,
  articleId: string,
  status: NewsFormValues["status"],
  rowPermissions: RowPermissions
): Promise<void> => {
  await db.updateRow(
    "app",
    "news",
    articleId,
    { status: status as NewsStatus },
    rowPermissions
  );
};

const rollbackCreatedNews = async (
  db: NewsDatabase,
  articleId: string,
  translationIds: string[]
): Promise<void> => {
  await Promise.allSettled(
    translationIds.map((translationId) =>
      db.deleteRow("app", "content_translations", translationId)
    )
  );
  try {
    await db.deleteRow("app", "news", articleId);
  } catch {
    // Best-effort rollback: the original persistence error is more useful.
  }
};

export async function listNews(opts?: {
  campusId?: string;
  status?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(NEWS_PAGE_SIZE),
    Query.offset((page - 1) * NEWS_PAGE_SIZE),
    ...applyScopeQueries(ctx),
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
  const { db } = await createSessionClient();

  const response = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = response.rows[0];
  // Treat a row outside the caller's campus/department scope as not found.
  if (
    !(article && hasRowAccess(ctx, article.campus_id, article.department_id))
  ) {
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

export async function createNews(values: NewsFormValues) {
  const ctx = await requireAuth();
  const validated = newsSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  let rollback: (() => Promise<void>) | null = null;

  try {
    // News is reachable by department users (see NAV_ACCESS), so authorize
    // against both the target campus and department — matching the
    // update/delete paths, which pass the row's department_id.
    assertWriteAccess(
      ctx,
      validated.data.campus_id,
      validated.data.department_id ?? null
    );
    const requestedStatus = validated.data.status;
    if (requestedStatus === "published") {
      assertPublishAccess(ctx, validated.data.campus_id);
    }

    const { db } = await createSessionClient();

    const lookups = await loadRecruitmentLookups(db);
    const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
      campus_id: validated.data.campus_id,
      department_id: validated.data.department_id ?? null,
    });

    const stagingStatus =
      requestedStatus === "published" ? "draft" : requestedStatus;
    const article = await db.createRow(
      "app",
      "news",
      "unique()",
      {
        slug: validated.data.slug,
        status: stagingStatus as NewsStatus,
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        image: validated.data.image || null,
        sticky: validated.data.sticky ?? false,
        author: validated.data.author ?? null,
      },
      buildStagingNewsRowPermissions(
        buildContentRowPermissions({
          status: stagingStatus,
          audience: "public",
          campusTeam,
          deptTeam,
        }),
        ctx.userId
      )
    );

    const stagingTranslationPermissions = buildContentTranslationPermissions({
      audience: "public",
      status: stagingStatus,
      ownerUserId: ctx.userId,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    });
    const translations = getNewsTranslationInputs(validated.data);
    const createdTranslationIds: string[] = [];
    rollback = () =>
      rollbackCreatedNews(db, article.$id, createdTranslationIds);
    await createNewsTranslations(
      db,
      article.$id,
      translations,
      JSON.stringify({
        author: validated.data.author,
        category: validated.data.category,
      }),
      stagingTranslationPermissions,
      createdTranslationIds
    );

    if (requestedStatus === "published") {
      const publishedTranslationPermissions =
        buildContentTranslationPermissions({
          audience: "public",
          status: requestedStatus,
          ownerUserId: ctx.userId,
          writeTeams: deptTeam ? [deptTeam] : [],
          readTeams: campusTeam ? [campusTeam] : [],
        });
      await publishStagedNewsTranslations(
        db,
        createdTranslationIds,
        publishedTranslationPermissions
      );
    }
    await finalizeStagedNewsRow(
      db,
      article.$id,
      requestedStatus,
      buildContentRowPermissions({
        status: requestedStatus,
        audience: "public",
        campusTeam,
        deptTeam,
      })
    );

    await logAuditEvent(ctx, "news_created", {
      resourceId: article.$id,
      resourceType: "news",
    });
    revalidatePath("/news");
    return { data: article.$id };
  } catch (error) {
    await rollback?.();
    return {
      error: error instanceof Error ? error.message : "Failed to save article",
    };
  }
}

export async function updateNews(id: string, values: NewsFormValues) {
  const ctx = await requireAuth();
  const validated = newsSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  const { db } = await createSessionClient();

  const existing = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = existing.rows[0];
  if (!article) {
    return { error: "Article not found" };
  }

  try {
    assertWriteAccess(ctx, article.campus_id, article.department_id);
    assertWriteAccess(
      ctx,
      validated.data.campus_id,
      validated.data.department_id ?? null
    );
    if (
      article.status === "published" ||
      validated.data.status === "published"
    ) {
      assertPublishAccess(ctx, article.campus_id);
      assertPublishAccess(ctx, validated.data.campus_id);
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

    await db.updateRow(
      "app",
      "news",
      id,
      {
        slug: validated.data.slug,
        status: validated.data.status as NewsStatus,
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        image: validated.data.image || null,
        sticky: validated.data.sticky ?? false,
        author: validated.data.author ?? null,
      },
      buildContentRowPermissions({
        status: validated.data.status,
        audience: "public",
        campusTeam,
        deptTeam,
      })
    );

    const currentTranslations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "news"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );
    const currentByLocale = new Map<string, ContentTranslations>(
      currentTranslations.rows.map((translation) => [
        translation.locale,
        translation,
      ])
    );
    const submittedTranslations = getNewsTranslationInputs(validated.data);
    const submittedLocales = new Set(
      submittedTranslations.map((translation) => translation.locale)
    );

    await Promise.all(
      submittedTranslations.map((translation) => {
        const existingTranslation = currentByLocale.get(translation.locale);
        const data = {
          additional_fields: JSON.stringify({
            author: validated.data.author,
            category: validated.data.category,
          }),
          content_id: id,
          content_type: "news",
          description: translation.description,
          locale: translation.locale,
          title: translation.title,
        };
        return existingTranslation
          ? db.updateRow(
              "app",
              "content_translations",
              existingTranslation.$id,
              data,
              translationPermissions
            )
          : db.createRow(
              "app",
              "content_translations",
              "unique()",
              data,
              translationPermissions
            );
      })
    );

    await Promise.all(
      currentTranslations.rows
        .filter((translation) => !submittedLocales.has(translation.locale))
        .map((translation) =>
          db.updateRow(
            "app",
            "content_translations",
            translation.$id,
            {},
            translationPermissions
          )
        )
    );

    await logAuditEvent(ctx, "news_updated", {
      resourceId: id,
      resourceType: "news",
      payload: { status: validated.data.status },
    });
    revalidatePath("/news");
    revalidatePath(`/news/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to save article",
    };
  }
}

export async function deleteNews(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const existing = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = existing.rows[0];
  if (!article) {
    return { error: "Article not found" };
  }

  try {
    assertWriteAccess(ctx, article.campus_id, article.department_id);

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
