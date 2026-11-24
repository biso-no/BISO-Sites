import { DEFAULT_LOCALE } from "@repo/i18n/config";
import {
  isProjectNamespaceSlug,
  PROJECT_UNIT_SLUGS,
  type ProjectSlug,
  projectPageSlug,
} from "@repo/shared/utils/project-units";
import {
  isUnitPageSlug,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import type { MetadataRoute } from "next";
import { cachedPublishedPage, sitemapEntries } from "@/lib/data/public-content";
import { PROJECT_HUB_SLUGS } from "@/lib/project-hub";
import { isServableProjectPage, nationalProjectForUnit } from "@/lib/unit-page";
import { STATIC_SITEMAP_ROUTES } from "./sitemap-static";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

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

/**
 * The projects whose own page `/projects/<project>` serves, by the predicate
 * that route and the C3 unit redirect use. A crawler carries no locale
 * cookie, so it is asked in the default locale. Best-effort per project: a
 * failed read counts as no page, which leaves the sitemap as it was without
 * one (the coded hubs listed, the unit URL kept).
 */
async function servableProjectPages(): Promise<Set<ProjectSlug>> {
  const projects = Object.keys(PROJECT_UNIT_SLUGS) as ProjectSlug[];
  const servable = await Promise.all(
    projects.map(async (project) => {
      try {
        const page = await cachedPublishedPage(
          projectPageSlug(project),
          DEFAULT_LOCALE
        );
        return (await isServableProjectPage(page, project)) ? project : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(
    servable.filter((project): project is ProjectSlug => project !== null)
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${BASE}${path}`,
      changeFrequency,
      priority,
    })
  );

  // Minimal-select (slug + timestamp) cached reads serve every crawler, one
  // cache entry per table. Each listing is independently best-effort — a
  // failing table produces a partial sitemap rather than a 500 — and that
  // tolerance lives in `sitemapEntries`, outside the cache, so a degraded
  // result is never the thing the next crawler is served. It catches every
  // branch itself and cannot reject, so there is nothing to catch here.
  const [entries, projectPages] = await Promise.all([
    sitemapEntries(),
    servableProjectPages(),
  ]);

  // The flagship hubs render from their own copy with no `large_event` row,
  // and that table is empty, so the listing below never named them. A project
  // with a published page of its own is served too, Bergensbaneløpet among
  // them, which has no coded copy. A hub the table does list keeps that entry
  // (it carries a real timestamp) and is not repeated here.
  const listedProjects = new Set(entries.projects.map((row) => row.slug));
  const projectHubs: MetadataRoute.Sitemap = [
    ...new Set<string>([...PROJECT_HUB_SLUGS, ...projectPages]),
  ]
    .filter((slug) => !listedProjects.has(slug))
    .map((slug) => ({
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
    // canonical here. A national project unit whose project page is served
    // redirects there (C3), so only the project URL is listed.
    ...entries.units
      .filter((row) => {
        const project = nationalProjectForUnit(row);
        return !(project && projectPages.has(project));
      })
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
