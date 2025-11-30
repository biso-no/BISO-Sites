"use server";

import { listPages as apiListPages } from "@repo/api/page-builder";

export type PageOption = {
  label: string;
  value: string;
};

export async function getPages(): Promise<PageOption[]> {
  const pages = await apiListPages({ limit: 100 });

  return pages.map((page) => ({
    label: page.title,
    value: `/${page.translations[0]?.locale || "en"}/${page.slug}`, // Construct a basic path, or just use the slug if handled elsewhere
  }));
}
