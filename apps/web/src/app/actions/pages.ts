"use server";

import { Query } from "@repo/api";
import { getPublishedPage, type PublishedPage } from "@repo/api/page-builder";
import { createSessionClient } from "@repo/api/server";
import type { Locale, Pages, PageTranslations } from "@repo/api/types/appwrite";
import type { Data } from "@repo/editor";
import { cache } from "react";

const _resolvePublishedPage = cache(async (slug: string, locale: Locale) =>
  getPublishedPage({ slug, locale, preview: false })
);

export async function getPublicPage(
  slug: string,
  locale: Locale
): Promise<Data | null> {
  const { db } = await createSessionClient();

  console.log("Locale:", locale);
  console.log("Slug:", slug);

  const response = await db.listRows<Pages>({
    databaseId: "app",
    tableId: "pages",
    queries: [
      Query.equal("slug", slug),
      Query.equal("translation_refs.locale", locale),
      Query.limit(1),
      Query.select([
        "title",
        "slug",
        "translation_refs.$id",
        "translation_refs.$createdAt",
        "translation_refs.$updatedAt",
        "translation_refs.page_id",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.slug",
        "translation_refs.description",
        "translation_refs.puck_document",
        "translation_refs.draft_document",
        "translation_refs.is_published",
        "translation_refs.published_at",
      ]),
    ],
  });

  const page = response.rows[0];
  if (!(page && Array.isArray(page.translation_refs))) {
    return null;
  }

  const translation = page.translation_refs.find(
    (item): item is PageTranslations =>
      typeof item === "object" && item !== null && item.locale === locale
  );

  if (!translation?.is_published) {
    return null;
  }

  const pageData = JSON.parse(translation.puck_document) as Data;
  return pageData;
}

function getPublicPagePreview(
  slug: string,
  locale: Locale
): Promise<PublishedPage | null> {
  return getPublishedPage({ slug, locale, preview: true });
}

async function getDemoPage(
  slug: string,
  locale: Locale
): Promise<PageTranslations | null> {
  const { db } = await createSessionClient();

  const response = await db.listRows<Pages>({
    databaseId: "app",
    tableId: "pages",
    queries: [
      Query.equal("slug", slug),
      Query.equal("translation_refs.locale", locale),
      Query.limit(1),
      Query.select([
        "title",
        "slug",
        "translation_refs.$id",
        "translation_refs.$createdAt",
        "translation_refs.$updatedAt",
        "translation_refs.page_id",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.slug",
        "translation_refs.description",
        "translation_refs.puck_document",
        "translation_refs.draft_document",
        "translation_refs.is_published",
        "translation_refs.published_at",
      ]),
    ],
  });

  const page = response.rows[0];
  if (!(page && Array.isArray(page.translation_refs))) {
    return null;
  }

  const translation = page.translation_refs.find(
    (item): item is PageTranslations =>
      typeof item === "object" && item !== null && item.locale === locale
  );

  return translation ?? null;
}
