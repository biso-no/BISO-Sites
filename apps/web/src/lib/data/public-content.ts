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
import { cacheLife } from "next/cache";
import type { Partner } from "@/app/actions/about";
import { getPrimaryTranslation } from "@/lib/content-translation";
import type { NavFeatured, NavFeaturedItem } from "@/lib/types/nav";
import { type PublicLocale, queryEvents, queryNews } from "./queries";

const FEATURED_EVENT_POOL = 6;

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

function toFeaturedEvent(
  events: Events[],
  locale: PublicLocale
): NavFeaturedItem | null {
  const now = Date.now();
  const upcoming = events
    .map((event) => ({
      event,
      time: event.start_date ? new Date(event.start_date).getTime() : null,
    }))
    .filter(
      (entry): entry is { event: Events; time: number } =>
        entry.time !== null && entry.time >= now && Boolean(entry.event.slug)
    )
    .sort((a, b) => a.time - b.time);

  const next = upcoming[0]?.event;
  if (!next?.slug) {
    return null;
  }

  const translation = getPrimaryTranslation(next, locale);
  return {
    title: translation?.title ?? "",
    slug: next.slug,
    image: next.image ?? null,
    startDate: next.start_date ?? null,
  };
}

function toFeaturedNews(
  news: News[],
  locale: PublicLocale
): NavFeaturedItem | null {
  const item = news[0];
  if (!item?.slug) {
    return null;
  }
  const translation = getPrimaryTranslation(item, locale);
  return {
    title: translation?.title ?? "",
    slug: item.slug,
    image: item.image ?? null,
  };
}

function toFeaturedProject(rows: LargeEvent[]): NavFeaturedItem | null {
  const project = rows[0];
  if (!project?.slug) {
    return null;
  }
  return {
    title: project.name,
    slug: project.slug,
    image: project.backgroundImageUrl ?? project.logoUrl ?? null,
  };
}

/**
 * Mega-nav featured slots. Runs for EVERY public URL via the `(public)`
 * layout — including bot probes of nonexistent paths — which is exactly why
 * it must be served from cache rather than fan out per request (F-5).
 */
export async function cachedNavFeatured(
  locale: PublicLocale
): Promise<NavFeatured> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const [events, projects, news] = await Promise.all([
    queryEvents(db, {
      limit: FEATURED_EVENT_POOL,
      locale,
      status: "published",
    }).catch(() => [] as Events[]),
    db
      .listRows<LargeEvent>("app", "large_event", [
        Query.equal("isActive", true),
        Query.orderDesc("priority"),
        Query.limit(1),
      ])
      .then((res) => res.rows)
      .catch(() => [] as LargeEvent[]),
    queryNews(db, { limit: 1, locale, status: "published" }).catch(
      () => [] as News[]
    ),
  ]);

  return {
    event: toFeaturedEvent(events, locale),
    project: toFeaturedProject(projects),
    news: toFeaturedNews(news, locale),
  };
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

  const [jobs, events, news, products, projects, pages] = await Promise.all([
    published("jobs"),
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
