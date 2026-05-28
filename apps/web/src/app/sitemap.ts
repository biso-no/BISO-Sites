import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Pages } from "@repo/api/types/appwrite";
import { PagesStatus, PagesVisibility } from "@repo/api/types/appwrite";
import type { MetadataRoute } from "next";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { listNews } from "@/app/actions/news";
import { listProducts } from "@/app/actions/webshop";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

export const revalidate = 3600;

interface SlugWithTimestamp {
  slug: string | null;
  $updatedAt: string;
}

function mapSlugRoutes(
  base: string,
  rows: SlugWithTimestamp[],
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number
): MetadataRoute.Sitemap {
  return rows
    .filter((row): row is SlugWithTimestamp & { slug: string } =>
      Boolean(row.slug)
    )
    .map((row) => ({
      url: `${BASE}${base}/${row.slug}`,
      lastModified: new Date(row.$updatedAt),
      changeFrequency,
      priority,
    }));
}

async function listEditorPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const { db } = await createSessionClient();
    const result = await db.listRows<Pages>("app", "pages", [
      Query.equal("status", PagesStatus.PUBLISHED),
      Query.equal("visibility", PagesVisibility.PUBLIC),
      Query.limit(500),
    ]);
    return mapSlugRoutes("", result.rows, "weekly", 0.5);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/jobs`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/news`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/shop`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/campus`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/membership`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/business`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Each listing is best-effort: if one upstream call fails the rest still
  // produce a valid (partial) sitemap rather than a 500.
  const [jobs, events, news, products, editorPages] = await Promise.all([
    listJobs({ limit: 500 }).catch(() => []),
    listEvents({ status: "published", limit: 500 }).catch(() => []),
    listNews({ status: "published", limit: 500 }).catch(() => []),
    listProducts({ status: "published", limit: 500 }).catch(() => []),
    listEditorPages(),
  ]);

  return [
    ...staticRoutes,
    ...mapSlugRoutes("/jobs", jobs, "weekly", 0.8),
    ...mapSlugRoutes("/events", events, "weekly", 0.7),
    ...mapSlugRoutes("/news", news, "weekly", 0.7),
    ...mapSlugRoutes("/shop", products, "weekly", 0.6),
    ...editorPages,
  ];
}
