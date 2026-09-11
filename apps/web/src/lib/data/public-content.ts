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
import { isPublicUnit } from "@repo/shared/utils/unit-visibility";
import { cacheLife } from "next/cache";
import type { Partner } from "@/app/actions/about";
import { campusScopeIds } from "@/lib/campus-scope";
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
  const { rows } = await queryEvents(db, {
    campus: campusId ?? undefined,
    limit,
    locale,
    status: "published",
  });
  return rows;
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
  const campusScope = campusScopeIds(campusId);
  if (campusScope) {
    eventQueries.push(Query.equal("campus_id", campusScope));
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

/*
 * The three readers below all apply `isPublicUnit` on top of `active`.
 *
 * They are the ROUTING layer for /units/…, so the exclusion has to bite here,
 * not only at render time: an operating ledger ("Drift Campus Oslo") is an
 * active row with a slug, and letting it resolve would give it a live URL
 * whose `generateMetadata` puts the accounting name in the page <title> before
 * the body 404s. Excluding it here makes it indistinguishable from a slug that
 * was never a unit — which is what it is, publicly.
 *
 * `Name` and `active` are in DEPARTMENT_SELECT for exactly this check.
 */

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
  return res.rows.filter(isPublicUnit);
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
  const row = res.rows[0];
  return row && isPublicUnit(row) ? row : null;
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
  const row = res.rows[0];
  return row && isPublicUnit(row) ? row : null;
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

export interface UnitSitemapRow {
  $updatedAt: string;
  campus_id: string;
  slug: string | null;
}

export interface SitemapEntries {
  events: SitemapRow[];
  jobs: SitemapRow[];
  news: SitemapRow[];
  pages: SitemapRow[];
  products: SitemapRow[];
  projects: SitemapRow[];
  units: UnitSitemapRow[];
}

/*
 * sitemap.xml
 *
 * Each listing is its OWN cache entry, and each one THROWS on failure. This
 * looks like more machinery than one composite reader, and it exists for one
 * reason: `"use cache"` does not cache a rejected promise but it does cache a
 * resolved `[]`. The previous single-entry version caught each query inside
 * the cached function, so one transient Appwrite failure was written into the
 * cache as "this table has no published rows" and every crawler for the next
 * hour was served a sitemap silently missing a whole content type.
 *
 * The best-effort behaviour that catch was there for is preserved — it just
 * moved to `sitemapEntries` below, where an empty list lives for one request
 * instead of an hour. A failing table still yields a partial sitemap rather
 * than a 500, and the lists now revalidate independently.
 */

/** Minimal projection shared by the status-filtered content tables. */
async function cachedSitemapPublished(table: string): Promise<SitemapRow[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const res = await db.listRows<Events>("app", table, [
    Query.select([...SITEMAP_SELECT]),
    Query.equal("status", "published"),
    Query.limit(SITEMAP_LIMIT),
  ]);
  return sitemapRows(res.rows);
}

/**
 * Jobs need the open-vacancy predicate: getJobBySlug() rejects vacancies past
 * their application deadline, so a plain status filter would emit sitemap URLs
 * that resolve to 404.
 */
async function cachedSitemapJobs(): Promise<SitemapRow[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const res = await db.listRows<Jobs>("app", "jobs", [
    Query.select([...SITEMAP_SELECT, "status", "application_deadline"]),
    Query.equal("status", JobsStatus.PUBLISHED),
    Query.limit(SITEMAP_LIMIT),
  ]);
  return sitemapRows(
    res.rows.filter((job) =>
      isRecruitmentVacancyOpen(job.status, job.application_deadline)
    )
  );
}

async function cachedSitemapProjects(): Promise<SitemapRow[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const res = await db.listRows<LargeEvent>("app", "large_event", [
    Query.select([...SITEMAP_SELECT]),
    Query.limit(SITEMAP_LIMIT),
  ]);
  return sitemapRows(res.rows);
}

async function cachedSitemapPages(): Promise<SitemapRow[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const res = await db.listRows<Pages>("app", "pages", [
    Query.select([...SITEMAP_SELECT]),
    Query.equal("status", PagesStatus.PUBLISHED),
    Query.equal("visibility", PagesVisibility.PUBLIC),
    Query.limit(SITEMAP_LIMIT),
  ]);
  return sitemapRows(res.rows);
}

async function cachedSitemapUnits(): Promise<UnitSitemapRow[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();
  const res = await db.listRows<Departments>("app", "departments", [
    // `Name` is selected only to run the public-visibility rule: an operating
    // ledger ("Drift BISO") and the national governance rows are
    // `active: true` but have no public page, so advertising their URLs here
    // would hand a crawler ~16 guaranteed 404s.
    Query.select(["$id", "$updatedAt", "Name", "active", "campus_id", "slug"]),
    Query.equal("active", true),
    Query.limit(SITEMAP_LIMIT),
  ]);
  return res.rows.filter(isPublicUnit).map((row) => ({
    $updatedAt: row.$updatedAt,
    campus_id: row.campus_id,
    slug: row.slug ?? null,
  }));
}

/**
 * Every slug the sitemap advertises.
 *
 * NOT itself a `"use cache"` entry — it composes the cached readers above and
 * owns their fallbacks. That split is the whole point: the readers cache only
 * answers they are sure of, and the tolerance for a failing table lives out
 * here, where a degraded result is discarded at the end of the request instead
 * of being served to every crawler for an hour.
 */
export async function sitemapEntries(): Promise<SitemapEntries> {
  const [jobs, events, news, products, projects, pages, units] =
    await Promise.all([
      cachedSitemapJobs().catch(() => [] as SitemapRow[]),
      cachedSitemapPublished("events").catch(() => [] as SitemapRow[]),
      cachedSitemapPublished("news").catch(() => [] as SitemapRow[]),
      cachedSitemapPublished("webshop_products").catch(
        () => [] as SitemapRow[]
      ),
      cachedSitemapProjects().catch(() => [] as SitemapRow[]),
      cachedSitemapPages().catch(() => [] as SitemapRow[]),
      cachedSitemapUnits().catch(() => [] as UnitSitemapRow[]),
    ]);

  return { events, jobs, news, pages, products, projects, units };
}
