import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { ContentType, Locale } from "@repo/api/types/appwrite";
import type { MetadataRoute } from "next";

export async function generateSitemap() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://app.biso.no";

  const { db } = await createAdminClient();

  const news = await db.listRows("app", "content_translations", [
    Query.equal("content_type", ContentType.NEWS),
    Query.equal("locale", Locale.NO),
  ]);

  const events = await db.listRows("app", "content_translations", [
    Query.equal("content_type", ContentType.EVENT),
    Query.equal("locale", Locale.NO),
  ]);

  const jobs = await db.listRows("app", "content_translations", [
    Query.equal("content_type", ContentType.JOB),
    Query.equal("locale", Locale.NO),
  ]);

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date() },
    { url: `${base}/about`, lastModified: new Date() },
    { url: `${base}/campus`, lastModified: new Date() },
    { url: `${base}/students`, lastModified: new Date() },
  ];

  const dynamicPaths: MetadataRoute.Sitemap = [
    ...news.rows.map((n) => ({
      url: `${base}/news/${(n as any).$id}`,
      lastModified: new Date(n.$updatedAt || n.$createdAt),
    })),
    ...events.rows.map((e) => ({
      url: `${base}/events/${(e as any).$id}`,
      lastModified: new Date(e.$updatedAt || e.$createdAt),
    })),
    ...jobs.rows.map((j) => ({
      url: `${base}/jobs/${(j as any).slug || (j as any).$id}`,
      lastModified: new Date(j.$updatedAt || j.$createdAt),
    })),
  ];

  return [...staticPaths, ...dynamicPaths];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return await generateSitemap();
}
