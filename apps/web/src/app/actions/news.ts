"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  ContentType,
  Locale,
  type News,
  type Status,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";

type ListNewsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
};

type CreateNewsData = {
  status: string;
  campus_id: string;
  department_id: string;
  slug?: string;
  url?: string;
  image?: string;
  sticky?: boolean;
  translations: {
    en?: {
      title: string;
      content: string;
    };
    no?: {
      title: string;
      content: string;
    };
  };
};

export async function listNews(
  params: ListNewsParams = {}
): Promise<ContentTranslations[]> {
  const { limit = 25, status, campus, locale } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.equal("content_type", ContentType.NEWS),
      Query.select([
        "content_id",
        "$id",
        "locale",
        "title",
        "description",
        "news_ref.*",
      ]),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    // Only add locale filter if provided
    if (locale) {
      queries.push(Query.equal("locale", locale as Locale));
    }

    if (status && status !== "all") {
      queries.push(Query.equal("news_ref.status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("news_ref.campus_id", campus));
    }

    // Get news with their translations using Appwrite's nested relationships
    const newsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );
    const newsItems = newsResponse.rows;

    return newsItems;
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

export async function getNewsItem(
  id: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.NEWS),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "news_ref.*",
        ]),
        Query.limit(1),
      ]
    );

    if (translationsResponse.rows.length === 0) {
      return null;
    }

    return translationsResponse.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching news item:", error);
    return null;
  }
}

async function _createNewsItem(
  data: CreateNewsData,
  skipRevalidation = false
): Promise<News | null> {
  try {
    const { db } = await createSessionClient();

    // Build translation_refs array from provided translations only
    const translationRefs: ContentTranslations[] = [];

    if (data.translations.en) {
      translationRefs.push({
        content_type: ContentType.NEWS,
        content_id: "unique()",
        locale: Locale.EN,
        title: data.translations.en.title,
        description: data.translations.en.content,
      } as ContentTranslations);
    }

    if (data.translations.no) {
      translationRefs.push({
        content_type: ContentType.NEWS,
        content_id: "unique()",
        locale: Locale.NO,
        title: data.translations.no.title,
        description: data.translations.no.content,
      } as ContentTranslations);
    }

    const newsItem = await db.createRow<News>("app", "news", "unique()", {
      status: data.status as Status,
      campus_id: data.campus_id,
      campus: data.campus_id,
      department_id: data.department_id ?? null,
      department: data.department_id,
      slug: data.slug ?? null,
      url: data.url ?? null,
      image: data.image ?? null,
      metadata: [],
      sticky: data.sticky ?? null,
      translation_refs: translationRefs,
    });

    if (!skipRevalidation) {
      revalidatePath("/news");
      revalidatePath("/admin/posts");
    }

    return newsItem;
  } catch (error) {
    console.error("Error creating news item:", error);
    return null;
  }
}

async function _updateNewsItem(
  id: string,
  data: Partial<CreateNewsData>,
  _skipRevalidation = false
): Promise<News | null> {
  try {
    const { db } = await createSessionClient();

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.campus_id !== undefined) {
      updateData.campus_id = data.campus_id;
    }
    if (data.department_id !== undefined) {
      updateData.department_id = data.department_id;
    }
    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }
    if (data.url !== undefined) {
      updateData.url = data.url;
    }
    if (data.image !== undefined) {
      updateData.image = data.image;
    }
    if (data.sticky !== undefined) {
      updateData.sticky = data.sticky;
    }

    // Build translation_refs array from provided translations only
    if (data.translations) {
      const translationRefs: ContentTranslations[] = [];

      if (data.translations.en) {
        translationRefs.push({
          content_type: ContentType.NEWS,
          content_id: id,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.content,
        } as ContentTranslations);
      }

      if (data.translations.no) {
        translationRefs.push({
          content_type: ContentType.NEWS,
          content_id: id,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.content,
        } as ContentTranslations);
      }

      if (translationRefs.length > 0) {
        updateData.translation_refs = translationRefs;
      }
    }

    const newsItem = await db.updateRow<News>("app", "news", id, updateData);
    return newsItem ?? null;
  } catch (error) {
    console.error("Error updating news item:", error);
    return null;
  }
}

