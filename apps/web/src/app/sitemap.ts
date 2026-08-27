import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import type { MetadataRoute } from "next";
import { cachedSitemapEntries } from "@/lib/data/public-content";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://web.biso.no";

const ABOUT_SUBROUTES = [
  "what-is-biso",
  "politics",
  "study-quality",
  "history",
  "bylaws",
  "operations",
  "alumni",
  "saih",
  "academics-contact",
];

interface SlugWithTimestamp {
  $updatedAt: string;
  slug: string | null;
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
    { url: `${BASE}/units`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/projects`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/bi-fondet`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/resources`, changeFrequency: "monthly", priority: 0.5 },
    {
      url: `${BASE}/business-hotspot`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    { url: `${BASE}/safety`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/press`, changeFrequency: "monthly", priority: 0.3 },
    ...ABOUT_SUBROUTES.map((slug) => ({
      url: `${BASE}/about/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // One cached, minimal-select (slug + timestamp) read serves every crawler;
  // inside the cached reader each listing is still best-effort so a failing
  // table produces a partial sitemap rather than a 500.
  const entries = await cachedSitemapEntries().catch(() => ({
    events: [],
    jobs: [],
    news: [],
    pages: [],
    products: [],
    projects: [],
    units: [],
  }));

  return [
    ...staticRoutes,
    ...mapSlugRoutes("/jobs", entries.jobs, "weekly", 0.8),
    ...mapSlugRoutes("/events", entries.events, "weekly", 0.7),
    ...mapSlugRoutes("/news", entries.news, "weekly", 0.7),
    ...mapSlugRoutes("/shop", entries.products, "weekly", 0.6),
    ...mapSlugRoutes("/projects", entries.projects, "weekly", 0.6),
    ...mapSlugRoutes("", entries.pages, "weekly", 0.5),
    // Only the campus-explicit /units/<campus>/<slug> URLs are listed — the
    // one-segment /units/<slug> route is cookie-dependent and points its
    // canonical here.
    ...entries.units
      .map((row) => ({
        path: unitCanonicalPath({ campusId: row.campus_id, slug: row.slug }),
        lastModified: new Date(row.$updatedAt),
      }))
      .filter((row): row is { path: string; lastModified: Date } =>
        Boolean(row.path)
      )
      .map((row) => ({
        url: `${BASE}${row.path}`,
        lastModified: row.lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
  ];
}
