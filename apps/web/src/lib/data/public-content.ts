/**
 * Cached readers for public, identical-for-every-anonymous-visitor content.
 *
 * Every function here is a `"use cache"` entry built on `createPublicClient()`
 * (guest permissions, no cookies), so one Appwrite round-trip serves every
 * visitor until the cache revalidates. This is the fix for the Appwrite
 * worker-exhaustion incident: page renders inside a synchronous Site
 * execution must not fan out into the same Appwrite worker pool on every
 * request. See WEB_APP_APPWRITE_INCIDENT_AUDIT.md.
 *
 * Rules of the module:
 * - Guest-visible content only. Anything per-user (session, membership,
 *   prefs) stays in the dynamic actions and must never move here.
 * - No `cookies()` / `headers()` — `"use cache"` forbids request-bound APIs.
 * - Prefer letting errors throw: `"use cache"` does not cache rejected
 *   promises, so a transient Appwrite failure never poisons the cache.
 *   Call sites decide the fallback (`.catch(() => [])`).
 */

import { Query } from "@repo/api";
import { getPage } from "@repo/api/page-builder";
import { createPublicClient } from "@repo/api/server";
import type {
  Campus,
  Departments,
  Events,
  Jobs,
  LargeEvent,
  News,
  Pages,
} from "@repo/api/types/appwrite";
import {
  JobsStatus,
  PagesStatus,
  PagesVisibility,
} from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
import type {
  PageDepartmentsFeed,
  PageEventItem,
  PageJobItem,
  PageNewsItem,
  PagePartnerItem,
} from "@repo/shared/utils/page-feeds";
import {
  readPageDepartmentsFeed,
  readPageEventsFeed,
  readPageJobsFeed,
  readPageNewsFeed,
  readPagePartnersFeed,
} from "@repo/shared/utils/page-feeds";
import { cacheLife } from "next/cache";
import type { Partner } from "@/app/actions/about";
import type { NavFeatured } from "@/lib/types/nav";
import { buildNavFeatured } from "./nav-featured";
import { type PublicLocale, queryEvents, queryNews } from "./queries";

export async function cachedPublishedEvents(
  locale: PublicLocale,
  campusId: string | null,
  limit: number
): Promise<Events[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await queryEvents(db, {
    campus: campusId ?? undefined,
    limit,
    locale,
    status: "published",
  });
}

export async function cachedPublishedNews(
  locale: PublicLocale,
  campusId: string | null,
  limit: number
): Promise<News[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await queryNews(db, {
    campus: campusId ?? undefined,
    limit,
    locale,
    status: "published",
  });
}

/**
 * Homepage stat counters. The event count comes from the query `total`
 * (no rows transferred); the job count needs the open-deadline rule, so it
 * reads a minimal three-column projection — no relationship expansion.
 */
export async function cachedHomeCounts(
  campusId: string | null
): Promise<{ eventCount: number; jobCount: number }> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const eventQueries = [Query.equal("status", "published"), Query.limit(1)];
  if (campusId) {
    eventQueries.push(Query.equal("campus_id", campusId));
  }

  const [eventsRes, jobsRes] = await Promise.all([
    db.listRows<Events>("app", "events", eventQueries),
    db.listRows<Jobs>("app", "jobs", [
      Query.select(["$id", "status", "application_deadline"]),
      Query.equal("status", JobsStatus.PUBLISHED),
      Query.limit(200),
    ]),
  ]);

  const jobCount = jobsRes.rows.filter((job) =>
    isRecruitmentVacancyOpen(job.status, job.application_deadline)
  ).length;

  return { eventCount: eventsRes.total, jobCount };
}

export async function cachedCampuses(
  selectedCampusId: string | null,
  includeNational: boolean,
  includeDepartments: boolean
): Promise<Campus[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();

  const query: string[] = [Query.limit(500)];

  if (!includeNational) {
    query.push(Query.notEqual("name", "National"));
  }

  if (selectedCampusId && selectedCampusId !== "all") {
    query.push(Query.equal("$id", selectedCampusId));
  }

  if (includeDepartments) {
    query.push(
      Query.select([
        "departments.$id",
        "departments.Name",
        "departments.active",
      ])
    );
  }

  const campuses = await db.listRows<Campus>("app", "campus", query);
  return campuses.rows;
}

export async function cachedPartners(): Promise<Partner[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const partners = await db.listRows<Partner>("app", "partners", [
    Query.equal("level", "national"),
  ]);
  return partners.rows;
}

/**
 * Mega-nav featured slots for ANONYMOUS visitors. Runs for EVERY public URL
 * via the `(public)` layout — including bot probes of nonexistent paths —
 * which is exactly why it must be served from cache rather than fan out per
 * request (F-5). Signed-in visitors use `sessionNavFeatured` instead so
 * member-only rows still surface.
 */
export async function cachedNavFeatured(
  locale: PublicLocale
): Promise<NavFeatured> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await buildNavFeatured(db, locale);
}

/**
 * Published block-editor page for the public catch-all route. Guest
 * permissions only — members-only pages come back null here and the route
 * falls back to a session-scoped lookup.
 */
export async function cachedPublishedPage(slug: string, locale: PublicLocale) {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await getPage(slug, locale, db);
}

const DEPARTMENT_SELECT = [
  "$id",
  "Name",
  "campus_id",
  "slug",
  "active",
  "type",
] as const;

/**
 * Every active department sharing one slug — one row per campus.
 *
 * Served by the leftmost prefix of the (slug, campus_id) unique index, which is
 * why that index is ordered slug-first. Drives the campus chooser and the
 * one-segment /units/<slug> route.
 */
export async function cachedDepartmentsBySlug(
  slug: string
): Promise<Departments[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("slug", slug),
    Query.equal("active", true),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(10),
  ]);
  return res.rows;
}

/** The single active department at one campus. Full (slug, campus_id) hit. */
export async function cachedDepartmentBySlugAndCampus(
  slug: string,
  campusId: string
): Promise<Departments | null> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("slug", slug),
    Query.equal("campus_id", campusId),
    Query.equal("active", true),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(1),
  ]);
  return res.rows[0] ?? null;
}

/** Legacy 24SO-id lookup, used only to redirect old /units/<number> links. */
export async function cachedDepartmentById(
  id: string
): Promise<Departments | null> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    Query.equal("$id", id),
    Query.select([...DEPARTMENT_SELECT]),
    Query.limit(1),
  ]);
  return res.rows[0] ?? null;
}

/* ------------------------------------------------------------------------ *
 * Page-builder auto-source feeds
 *
 * The events/news/jobs/partners/departmentGrid blocks in `@repo/editor` render
 * these. The public page resolves them on the SERVER before rendering (see
 * `./page-feeds`), so the first HTML a crawler receives carries real rows;
 * `/api/pages/*` serves the same readers to the editor canvas and to any
 * client-side refetch.
 *
 * The queries themselves live in `@repo/shared/utils/page-feeds` because
 * `apps/admin` runs them too, against its own client. What belongs HERE is the
 * caching: each wrapper is `"use cache"` on the guest client, so a page
 * carrying an auto-source block cannot fan one Appwrite round-trip out per
 * visitor. Keep that split — a query that reaches Appwrite directly from this
 * app without a `"use cache"` wrapper reintroduces the incident this module
 * was written for.
 * ------------------------------------------------------------------------ */

// Re-exported so call sites keep importing feed item types from this module.
// `export ... from` rather than re-exporting the local import above: the two
// forms are equivalent to TypeScript, and Biome's `noExportedImports` wants
// the intent spelled out.
export type {
  PageDepartmentItem,
  PageDepartmentsFeed,
  PageEventItem,
  PageJobItem,
  PageNewsItem,
  PagePartnerItem,
} from "@repo/shared/utils/page-feeds";

export async function cachedPageEventsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageEventItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await readPageEventsFeed(db, departmentId, locale);
}

export async function cachedPageNewsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageNewsItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await readPageNewsFeed(db, departmentId, locale);
}

export async function cachedPageJobsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageJobItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();
  return await readPageJobsFeed(db, departmentId, locale);
}

export async function cachedPagePartnersFeed(): Promise<PagePartnerItem[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  return await readPagePartnersFeed(db);
}

/**
 * This feed predates the others and read through `createAdminClient()`, which
 * put a service-key round-trip on every render of any page carrying the block
 * — exactly the per-visitor fan-out the rest of this module exists to prevent.
 * It does not need the service key: `app.departments` grants `read("any")` at
 * the table level, so the guest client sees the same rows.
 *
 * `campusId`/`type` are part of the cache key rather than applied afterwards,
 * so the unfiltered call the block actually makes stays one hot entry.
 */
export async function cachedPageDepartmentsFeed(
  campusId: string | null = null,
  type: string | null = null
): Promise<PageDepartmentsFeed> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  return await readPageDepartmentsFeed(db, campusId, type);
}

interface SitemapRow {
  $updatedAt: string;
  slug: string | null;
}

const SITEMAP_SELECT = ["$id", "slug", "$updatedAt"] as const;
const SITEMAP_LIMIT = 500;

function sitemapRows(
  rows: Array<{ $updatedAt: string; slug?: string | null }>
) {
  return rows.map((row) => ({
    $updatedAt: row.$updatedAt,
    slug: row.slug ?? null,
  }));
}

export interface SitemapEntries {
  events: SitemapRow[];
  jobs: SitemapRow[];
  news: SitemapRow[];
  pages: SitemapRow[];
  products: SitemapRow[];
  projects: SitemapRow[];
}

/**
 * Slug + timestamp projections for sitemap.xml. Minimal three-column selects:
 * no relationship expansion, one cached result for every crawler. Each list
 * is best-effort so one failing table cannot break the whole sitemap.
 */
export async function cachedSitemapEntries(): Promise<SitemapEntries> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();

  const published = (table: string) =>
    db
      .listRows<Events>("app", table, [
        Query.select([...SITEMAP_SELECT]),
        Query.equal("status", "published"),
        Query.limit(SITEMAP_LIMIT),
      ])
      .then((res) => sitemapRows(res.rows))
      .catch(() => [] as SitemapRow[]);

  // Jobs need the open-vacancy predicate: getJobBySlug() rejects vacancies
  // past their application deadline, so a plain status filter would emit
  // sitemap URLs that resolve to 404.
  const openJobs = db
    .listRows<Jobs>("app", "jobs", [
      Query.select([...SITEMAP_SELECT, "status", "application_deadline"]),
      Query.equal("status", JobsStatus.PUBLISHED),
      Query.limit(SITEMAP_LIMIT),
    ])
    .then((res) =>
      sitemapRows(
        res.rows.filter((job) =>
          isRecruitmentVacancyOpen(job.status, job.application_deadline)
        )
      )
    )
    .catch(() => [] as SitemapRow[]);

  const [jobs, events, news, products, projects, pages] = await Promise.all([
    openJobs,
    published("events"),
    published("news"),
    published("webshop_products"),
    db
      .listRows<LargeEvent>("app", "large_event", [
        Query.select([...SITEMAP_SELECT]),
        Query.limit(SITEMAP_LIMIT),
      ])
      .then((res) => sitemapRows(res.rows))
      .catch(() => [] as SitemapRow[]),
    db
      .listRows<Pages>("app", "pages", [
        Query.select([...SITEMAP_SELECT]),
        Query.equal("status", PagesStatus.PUBLISHED),
        Query.equal("visibility", PagesVisibility.PUBLIC),
        Query.limit(SITEMAP_LIMIT),
      ])
      .then((res) => sitemapRows(res.rows))
      .catch(() => [] as SitemapRow[]),
  ]);

  return { events, jobs, news, pages, products, projects };
}
