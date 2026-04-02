"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type News,
  type Locale,
} from "@repo/api/types/appwrite";

type ListNewsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
};

export async function listNews(
  params: ListNewsParams = {}
): Promise<News[]> {
  const { limit = 25, status, campus, locale, search } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "slug",
        "status",
        "campus_id",
        "department_id",
        "sticky",
        "url",
        "image",
        "metadata",
        "author",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "translation_refs.$id",
        "translation_refs.$createdAt",
        "translation_refs.$updatedAt",
        "translation_refs.content_id",
        "translation_refs.content_type",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.description",
        "translation_refs.short_description",
        "translation_refs.additional_fields",
      ]),
      Query.limit(limit),
      Query.orderDesc("$createdAt"),
    ];

    if (locale) {
      queries.push(Query.equal("translation_refs.locale", locale as Locale));
    }

    if (status && status !== "all") {
      queries.push(Query.equal("status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("campus_id", campus));
    }

    if (search?.trim()) {
      queries.push(Query.search("translation_refs.title", search.trim()));
    }

    const newsResponse = await db.listRows<News>("app", "news", queries);
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
): Promise<News | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<News>("app", "news", [
      Query.equal("$id", id),
      Query.equal("translation_refs.locale", locale as Locale),
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "slug",
        "status",
        "campus_id",
        "department_id",
        "sticky",
        "url",
        "image",
        "metadata",
        "author",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "translation_refs.$id",
        "translation_refs.$createdAt",
        "translation_refs.$updatedAt",
        "translation_refs.content_id",
        "translation_refs.content_type",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.description",
        "translation_refs.short_description",
        "translation_refs.additional_fields",
      ]),
      Query.limit(1),
    ]);

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching news item:", error);
    return null;
  }
}
