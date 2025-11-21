"use server";

import { Query } from "@repo/api";
import { getPublishedPage, type PublishedPage } from "@repo/api/page-builder";
import { createSessionClient } from "@repo/api/server";
import type { Locale, PageTranslations } from "@repo/api/types/appwrite";
import { cache } from "react";

const resolvePublishedPage = cache(async (slug: string, locale: Locale) => {
  return getPublishedPage({ slug, locale, preview: false });
});

export async function getPublicPage(slug: string, locale: Locale): Promise<PublishedPage | null> {
  return resolvePublishedPage(slug, locale);
}

export async function getPublicPagePreview(
  slug: string,
  locale: Locale,
): Promise<PublishedPage | null> {
  return getPublishedPage({ slug, locale, preview: true });
}

export async function getDemoPage(slug: string, locale: Locale): Promise<PageTranslations | null> {
  const { db } = await createSessionClient();

  const response = await db.listRows<PageTranslations>({
    databaseId: "app",
    tableId: "page_translations",
    queries: [
      Query.equal("slug", slug),
      Query.equal("locale", locale),
      Query.limit(1),
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "page_id",
        "locale",
        "title",
        "slug",
        "description",
        "puck_document",
        "draft_document",
        "is_published",
        "published_at",
      ]),
    ],
  });
  console.log("response", response);

  if (!response.rows.length) {
    return null;
  }

  return response.rows[0] as PageTranslations;
}
