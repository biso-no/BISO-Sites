"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { News } from "@repo/api/types/appwrite";
import { filterTranslationRefs, queryNews } from "@/lib/data/queries";

interface ListNewsParams {
  campus?: string;
  limit?: number;
  locale?: "en" | "no";
  search?: string;
  status?: string;
}

export async function listNews(params: ListNewsParams = {}): Promise<News[]> {
  try {
    const { db } = await createSessionClient();
    return await queryNews(db, params);
  } catch (error) {
    console.error("Error fetching news:", error);
    return [];
  }
}

async function _getNewsItem(
  id: string,
  locale: "en" | "no"
): Promise<News | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<News>("app", "news", [
      Query.equal("$id", id),
      Query.equal("translation_refs.locale", locale),
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

    const item = response.rows[0];
    return item ? filterTranslationRefs(item, locale) : null;
  } catch (error) {
    console.error("Error fetching news item:", error);
    return null;
  }
}

export async function getNewsBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<News | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<News>("app", "news", [
      Query.equal("slug", slug),
      // `news` grants row read to `any`; keep unpublished articles from
      // surfacing on the public detail route (the page guards too — this is the
      // data-layer backstop so a future caller can't regress it).
      Query.equal("status", "published"),
      Query.equal("translation_refs.locale", locale),
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

    const item = response.rows[0];
    return item ? filterTranslationRefs(item, locale) : null;
  } catch (error) {
    console.error("Error fetching news item by slug:", error);
    return null;
  }
}
