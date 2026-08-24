/**
 * Queries behind the page-builder's auto-source blocks.
 *
 * These take a `db` rather than creating one, because the two hosts need
 * different plumbing around the same rows:
 *
 * - `apps/web` wraps each one in a `"use cache"` reader on the guest client,
 *   so a published page carrying an auto-source block cannot fan one Appwrite
 *   round-trip out per visitor. See `apps/web/src/lib/data/public-content.ts`
 *   and the incident note at the top of it.
 * - `apps/admin` calls them uncached from `/api/pages/*` so the editor canvas
 *   shows the author their department's real feed as they edit.
 *
 * Everything here filters to published, publicly visible rows. The admin
 * canvas is a preview of a public page, so it must not surface rows a visitor
 * would never see.
 */

import { Query } from "@repo/api";
import type { createPublicClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Departments,
  Events,
  Jobs,
  News,
  Partners,
} from "@repo/api/types/appwrite";
import { JobsStatus, NewsStatus } from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "../types/recruitment";

/** Erased at runtime — this module never constructs a client. */
type FeedDb = Awaited<ReturnType<typeof createPublicClient>>["db"];

export type PageFeedLocale = "en" | "no";

const FEED_LIMIT = 6;
/**
 * Headroom, not a page size. The `departmentGrid` block has no pagination, so
 * whatever this cuts off simply disappears from the page — and because the
 * query orders by name, a low limit lops off the alphabet's tail rather than
 * something evenly spread. At 100 that silently dropped 34 of 134 active
 * departments, taking every STV unit with it. 500 clears even the full
 * departments table (263 rows, active and inactive), and the whole mapped
 * payload is ~15KB.
 */
const DEPARTMENT_LIMIT = 500;
const PARTNER_LIMIT = 100;

/** Pick the translation for `locale`, falling back to whatever exists. */
function pickTranslation(
  refs: ContentTranslations[] | undefined,
  locale: PageFeedLocale
): ContentTranslations | undefined {
  if (!Array.isArray(refs) || refs.length === 0) {
    return;
  }
  return refs.find((ref) => ref.locale === locale) ?? refs[0];
}

function departmentName(department: Departments | undefined): string {
  return department?.Name ?? "";
}

function formatFeedDate(value: string | null, locale: PageFeedLocale): string {
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
export function toPlainSummary(html: string): string {
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
 * `going` is always 0: `event_attendees` carries no row permissions
 * (`$permissions: []` in appwrite.config.json), so it is service-only and the
 * guest client cannot read it. Publishing attendance counts would mean routing
 * this through the admin client and exposing data the rest of the public site
 * deliberately never shows — a product decision, not a rendering fix. The
 * events block hides the counter when it is 0.
 */
export async function readPageEventsFeed(
  db: FeedDb,
  departmentId: string,
  locale: PageFeedLocale
): Promise<PageEventItem[]> {
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
export async function readPageNewsFeed(
  db: FeedDb,
  departmentId: string,
  locale: PageFeedLocale
): Promise<PageNewsItem[]> {
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
export function jobCommitment(metadata: string | null): string {
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
 *
 * The open-deadline test is pushed into the query rather than applied to the
 * page afterwards. Filtering after a `limit` bounds the newest N rows and then
 * discards the expired ones, so a department whose newest N vacancies have all
 * expired would report no open roles even while older ones are still open.
 * `isRecruitmentVacancyOpen` still runs on the result as the authority — it
 * additionally treats an unparseable deadline as open, which the query cannot.
 */
export async function readPageJobsFeed(
  db: FeedDb,
  departmentId: string,
  locale: PageFeedLocale
): Promise<PageJobItem[]> {
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
    Query.or([
      Query.isNull("application_deadline"),
      Query.greaterThanEqual("application_deadline", new Date().toISOString()),
    ]),
    Query.orderDesc("$createdAt"),
    Query.limit(FEED_LIMIT),
  ]);

  return jobs.rows
    .filter((job) =>
      isRecruitmentVacancyOpen(job.status, job.application_deadline)
    )
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
export async function readPagePartnersFeed(
  db: FeedDb
): Promise<PagePartnerItem[]> {
  const partners = await db.listRows<Partners>("app", "partners", [
    Query.select(["$id", "name", "url", "image_url"]),
    Query.equal("level", "national"),
    Query.limit(PARTNER_LIMIT),
  ]);

  return partners.rows.map((partner) => ({
    href: partner.url ?? undefined,
    logoSrc: partner.image_url || undefined,
    name: partner.name,
  }));
}

export interface PageDepartmentItem {
  campusId: string | null;
  id: string;
  internalId: string | null;
  logo: string | null;
  name: string;
  type: string | null;
}

export interface PageDepartmentsFeed {
  departments: PageDepartmentItem[];
  /**
   * Departments matching the filters, which is NOT `departments.length`.
   *
   * Appwrite's `total` counts every row matching the query and ignores
   * `limit`/`offset` (verified against 1.9.6: it stays at the full count
   * whether the limit is 2 or 500). Keep the two separate even now that
   * `DEPARTMENT_LIMIT` exceeds the real row count: collapsing them would
   * under-report to anything using this endpoint for counts, and it is what
   * makes a future overflow of the limit visible instead of silent —
   * `total > departments.length` means rows were cut.
   */
  total: number;
}

/** Active departments for the auto-source `departmentGrid` block. */
export async function readPageDepartmentsFeed(
  db: FeedDb,
  campusId: string | null = null,
  type: string | null = null
): Promise<PageDepartmentsFeed> {
  const queries: string[] = [
    Query.select(["$id", "Id", "Name", "campus_id", "type", "logo"]),
    Query.equal("active", true),
    Query.orderAsc("Name"),
    Query.limit(DEPARTMENT_LIMIT),
  ];
  if (campusId) {
    queries.push(Query.equal("campus_id", campusId));
  }
  if (type) {
    queries.push(Query.equal("type", type));
  }

  const departments = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );

  return {
    departments: departments.rows.map((department) => ({
      campusId: department.campus_id,
      id: department.$id,
      internalId: department.Id,
      logo: department.logo,
      name: department.Name,
      type: department.type,
    })),
    total: departments.total,
  };
}
