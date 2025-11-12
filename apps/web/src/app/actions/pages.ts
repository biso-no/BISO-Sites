"use server";

import { cache } from "react";
import type { Locale } from "@repo/api/types/appwrite";
import { getPublishedPage, type PublishedPage } from "@repo/api/page-builder";

const resolvePublishedPage = cache(async (slug: string, locale: Locale) => {
  return getPublishedPage({ slug, locale, preview: false });
});

export async function getPublicPage(slug: string, locale: Locale): Promise<PublishedPage | null> {
  return resolvePublishedPage(slug, locale);
}

export async function getPublicPagePreview(slug: string, locale: Locale): Promise<PublishedPage | null> {
  return getPublishedPage({ slug, locale, preview: true });
}
