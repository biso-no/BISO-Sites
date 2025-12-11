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
