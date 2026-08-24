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
  ContentTranslations,
  Departments,
  Events,
  Jobs,
  LargeEvent,
  News,
  Pages,
  Partners,
} from "@repo/api/types/appwrite";
import {
  JobsStatus,
  NewsStatus,
  PagesStatus,
  PagesVisibility,
} from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "@repo/shared/types/recruitment";
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

/* ------------------------------------------------------------------------ *
 * Page-builder auto-source feeds
 *
 * The events/news/jobs/partners blocks in `@repo/editor` fetch these from
 * `/api/pages/*` on the client. Each reader is cached so a page carrying an
 * auto-source block cannot fan one Appwrite round-trip out per visitor.
 * ------------------------------------------------------------------------ */

const FEED_LIMIT = 6;

/** Pick the translation for `locale`, falling back to whatever exists. */
function pickTranslation(
  refs: ContentTranslations[] | undefined,
  locale: PublicLocale
): ContentTranslations | undefined {
  if (!Array.isArray(refs) || refs.length === 0) {
    return;
  }
  return refs.find((ref) => ref.locale === locale) ?? refs[0];
}

function departmentName(department: Departments | undefined): string {
  return department?.Name ?? "";
}

function formatFeedDate(value: string | null, locale: PublicLocale): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "nb-NO", {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

const HTML_TAG = /<[^>]*>/g;
const WHITESPACE_RUN = /\s+/g;
const SUMMARY_MAX = 160;
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};
const HTML_ENTITY = /&(?:amp|lt|gt|quot|#39|nbsp);/g;

/**
 * News bodies are stored as HTML, but the news block renders the summary as
 * plain text inside a meta line — without this the public page shows literal
 * `<h3>…</h3><p>…` markup.
 */
function toPlainSummary(html: string): string {
  const text = html
    .replace(HTML_TAG, " ")
    .replace(HTML_ENTITY, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(WHITESPACE_RUN, " ")
    .trim();
  return text.length > SUMMARY_MAX
    ? `${text.slice(0, SUMMARY_MAX).trimEnd()}…`
    : text;
}

export interface PageEventItem {
  date: string;
  going: number;
  title: string;
  where: string;
}

/**
 * Upcoming events for one department.
 *
 * `EventItem.going` is always 0: `event_attendees` carries no row permissions
 * (`$permissions: []` in appwrite.config.json), so it is service-only and the
 * guest client cannot read it. Publishing attendance counts would mean routing
 * this through the admin client and exposing data the rest of the public site
 * deliberately never shows — a product decision, not a rendering fix. The
 * events block hides the counter when it is 0.
 */
export async function cachedPageEventsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageEventItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const events = await db.listRows<Events>("app", "events", [
    Query.select([
      "$id",
      "start_date",
      "location",
      "translation_refs.locale",
      "translation_refs.title",
    ]),
    Query.equal("status", "published"),
    Query.equal("department_id", departmentId),
    Query.greaterThanEqual("start_date", new Date().toISOString()),
    Query.orderAsc("start_date"),
    Query.limit(FEED_LIMIT),
  ]);

  return events.rows.map((event) => ({
    date: formatFeedDate(event.start_date, locale),
    going: 0,
    title: pickTranslation(event.translation_refs, locale)?.title ?? "",
    where: event.location ?? "",
  }));
}

export interface PageNewsItem {
  department: string;
  publishedAt: string;
  summary: string;
  title: string;
}

/** Latest published news for one department. */
export async function cachedPageNewsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageNewsItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const news = await db.listRows<News>("app", "news", [
    Query.select([
      "$id",
      "$createdAt",
      "department.Name",
      "translation_refs.locale",
      "translation_refs.title",
      "translation_refs.short_description",
      "translation_refs.description",
    ]),
    Query.equal("status", NewsStatus.PUBLISHED),
    Query.equal("department_id", departmentId),
    Query.orderDesc("$createdAt"),
    Query.limit(FEED_LIMIT),
  ]);

  return news.rows.map((row) => {
    const translation = pickTranslation(row.translation_refs, locale);
    return {
      department: departmentName(row.department),
      publishedAt: formatFeedDate(row.$createdAt, locale),
      summary: toPlainSummary(
        translation?.short_description ?? translation?.description ?? ""
      ),
      title: translation?.title ?? "",
    };
  });
}

export interface PageJobItem {
  commitment: string;
  deadline: string;
  department: string;
  title: string;
}

/** `jobs.metadata` is a JSON blob; only `commitment` matters to this feed. */
function jobCommitment(metadata: string | null): string {
  if (!metadata) {
    return "";
  }
  try {
    const parsed = JSON.parse(metadata) as {
      commitment?: unknown;
      employment_type?: unknown;
    };
    // The admin job studio writes `commitment`; rows imported from the legacy
    // WordPress job board only carry `employment_type`.
    for (const value of [parsed.commitment, parsed.employment_type]) {
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Open vacancies for one department. Mirrors the sitemap's rule: a published
 * job past its application deadline is closed, so it must not surface here.
 */
export async function cachedPageJobsFeed(
  departmentId: string,
  locale: PublicLocale
): Promise<PageJobItem[]> {
  "use cache";
  cacheLife("minutes");
  const { db } = await createPublicClient();

  const jobs = await db.listRows<Jobs>("app", "jobs", [
    Query.select([
      "$id",
      "status",
      "metadata",
      "application_deadline",
      "department.Name",
      "translations.locale",
      "translations.title",
    ]),
    Query.equal("status", JobsStatus.PUBLISHED),
    Query.equal("department_id", departmentId),
    Query.orderDesc("$createdAt"),
    Query.limit(FEED_LIMIT * 3),
  ]);

  return jobs.rows
    .filter((job) =>
      isRecruitmentVacancyOpen(job.status, job.application_deadline)
    )
    .slice(0, FEED_LIMIT)
    .map((job) => ({
      commitment: jobCommitment(job.metadata),
      deadline: formatFeedDate(job.application_deadline, locale),
      department: departmentName(job.department),
      title: pickTranslation(job.translations, locale)?.title ?? "",
    }));
}

export interface PagePartnerItem {
  href?: string;
  logoSrc?: string;
  name: string;
}

/** National partners for the auto-source partners block. */
export async function cachedPagePartnersFeed(): Promise<PagePartnerItem[]> {
  "use cache";
  cacheLife("hours");
  const { db } = await createPublicClient();

  const partners = await db.listRows<Partners>("app", "partners", [
    Query.select(["$id", "name", "url", "image_url"]),
    Query.equal("level", "national"),
    Query.limit(100),
  ]);

  return partners.rows.map((partner) => ({
    href: partner.url ?? undefined,
    logoSrc: partner.image_url || undefined,
    name: partner.name,
  }));
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
