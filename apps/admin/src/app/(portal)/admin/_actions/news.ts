"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  News,
  NewsStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { NEWS_PAGE_SIZE, type NewsFormValues, newsSchema } from "./schemas";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

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
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<News>("app", "news", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const article = response.rows[0];
  if (!article) {
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

  assertWriteAccess(ctx, validated.data.campus_id);

  const { db } = await createSessionClient();

  const article = await db.createRow("app", "news", "unique()", {
    slug: validated.data.slug,
    status: "draft" as NewsStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
    image: validated.data.image || null,
    sticky: validated.data.sticky ?? false,
    author: validated.data.author ?? null,
  });

  await db.createRow("app", "content_translations", "unique()", {
    content_id: article.$id,
    content_type: "news",
    locale: validated.data.locale,
    title: validated.data.title,
    description: validated.data.description ?? "",
    additional_fields: JSON.stringify({
      category: validated.data.category,
      author: validated.data.author,
    }),
  });

  await logAuditEvent(ctx, "news_created", {
    resourceId: article.$id,
    resourceType: "news",
  });
  revalidatePath("/admin/news");
  return { data: article.$id };
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

  assertWriteAccess(ctx, article.campus_id, article.department_id);

  await db.updateRow("app", "news", id, {
    slug: validated.data.slug,
    status: validated.data.status as NewsStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
    image: validated.data.image || null,
    sticky: validated.data.sticky ?? false,
    author: validated.data.author ?? null,
  });

  const existingTranslation = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "news"),
      Query.equal("content_id", id),
      Query.equal("locale", validated.data.locale),
      Query.limit(1),
    ]
  );

  const translationData = {
    content_id: id,
    content_type: "news",
    locale: validated.data.locale,
    title: validated.data.title,
    description: validated.data.description ?? "",
    additional_fields: JSON.stringify({
      category: validated.data.category,
      author: validated.data.author,
    }),
  };

  if (existingTranslation.rows[0]) {
    await db.updateRow(
      "app",
      "content_translations",
      existingTranslation.rows[0].$id,
      translationData
    );
  } else {
    await db.createRow(
      "app",
      "content_translations",
      "unique()",
      translationData
    );
  }

  await logAuditEvent(ctx, "news_updated", {
    resourceId: id,
    resourceType: "news",
    payload: { status: validated.data.status },
  });
  revalidatePath("/admin/news");
  revalidatePath(`/admin/news/${id}`);
  return { data: id };
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

  assertWriteAccess(ctx, article.campus_id, article.department_id);

  const translations = await db.listRows("app", "content_translations", [
    Query.equal("content_type", "news"),
    Query.equal("content_id", id),
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
  revalidatePath("/admin/news");
  return { data: true };
}
