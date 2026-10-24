import { isProjectNamespaceSlug } from "@repo/shared/utils/project-units";
import {
  isUnitPageSlug,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import type { MetadataRoute } from "next";
import { CAMPUS_SLUGS } from "@/lib/campus-scope";
import { sitemapEntries } from "@/lib/data/public-content";
import { PROJECT_HUB_SLUGS } from "@/lib/project-hub";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

// The other former subpages redirect into sections of /about.
const ABOUT_SUBROUTES = ["drugs-policy", "academics-contact"];

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
    { url: `${BASE}/documents`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/campus`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/membership`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/business`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/units`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/students`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/projects`, changeFrequency: "weekly", priority: 0.6 },
    {
      url: `${BASE}/okonomisk-stotte`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
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
    // Campus landing pages only.
    //
    // **No `?campus=` feed variants.** They were listed here at first, which
    // contradicted the pages themselves: `/events`, `/news` and `/jobs` each
    // hard-canonical every scoped request back to the unscoped feed, so a
    // sitemap entry for `/events?campus=bergen` tells a crawler "index this"
    // and the page it lands on replies "no, index /events instead". Caught in
    // PR review. The canonical is the half worth keeping — a scoped feed is a
    // filtered view of the same collection and should not compete with the
    // listing it filters — so the sitemap entries go.
    //
    // The campus *landing* pages stay: they self-canonical, and each is a
    // distinct page rather than a filtered view. `/units` and `/shop` also
    // accept `?campus=` and are likewise unlisted; `/units` already has all
    // 141 of its `/units/<campus>/<slug>` pages below, which is the
    // campus-specific content a crawler actually wants. `/projects` has no
    // campus_id and cannot be scoped at all.
    ...CAMPUS_SLUGS.map((slug) => ({
      url: `${BASE}/campus/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Minimal-select (slug + timestamp) cached reads serve every crawler, one
  // cache entry per table. Each listing is independently best-effort — a
  // failing table produces a partial sitemap rather than a 500 — and that
  // tolerance lives in `sitemapEntries`, outside the cache, so a degraded
  // result is never the thing the next crawler is served. It catches every
  // branch itself and cannot reject, so there is nothing to catch here.
  const entries = await sitemapEntries();

  // The flagship hubs render from their own copy with no `large_event` row,
  // and that table is empty, so the listing below never named them. A hub the
  // table does list keeps that entry (it carries a real timestamp) and is not
  // repeated here.
  const listedProjects = new Set(entries.projects.map((row) => row.slug));
  const projectHubs: MetadataRoute.Sitemap = PROJECT_HUB_SLUGS.filter(
    (slug) => !listedProjects.has(slug)
  ).map((slug) => ({
    url: `${BASE}/projects/${slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...mapSlugRoutes("/jobs", entries.jobs, "weekly", 0.8),
    ...mapSlugRoutes("/events", entries.events, "weekly", 0.7),
    ...mapSlugRoutes("/news", entries.news, "weekly", 0.7),
    ...mapSlugRoutes("/shop", entries.products, "weekly", 0.6),
    ...mapSlugRoutes("/projects", entries.projects, "weekly", 0.6),
    ...projectHubs,
    // A unit page's slug IS "units/<campus>/<slug>", so mapping it here would
    // emit the exact URL the units block below already emits, at a different
    // priority. The units listing owns those URLs. A `projects/<slug>` page
    // is the same: the projects entries already list /projects/<slug>.
    ...mapSlugRoutes(
      "",
      entries.pages.filter(
        (row) => !(isUnitPageSlug(row.slug) || isProjectNamespaceSlug(row.slug))
      ),
      "weekly",
      0.5
    ),
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
