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

import { Query, resolveStorageFileUrl } from "@repo/api";
import type { createPublicClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Departments,
  Events,
  Jobs,
  News,
  Partners,
  WebshopProducts,
} from "@repo/api/types/appwrite";
import {
  JobsStatus,
  NewsStatus,
  WebshopProductsStatus,
} from "@repo/api/types/appwrite";
import { isRecruitmentVacancyOpen } from "../types/recruitment";
import { listedProductsOnly } from "./product-visibility";
import { isUnitCategory, parseUnitCategory } from "./unit-categories";
import { unitDisplayName } from "./unit-names";
import { campusIdToLabel, unitCanonicalPath } from "./unit-urls";
import { isPublicUnit } from "./unit-visibility";

/** Erased at runtime — this module never constructs a client. */
type FeedDb = Awaited<ReturnType<typeof createPublicClient>>["db"];

export type PageFeedLocale = "en" | "no";

const FEED_LIMIT = 6;
const FEED_LIMIT_MAX = 12;

/** The caller's `limit`, clamped to 1..12 and defaulting to `FEED_LIMIT`. */
function feedLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return FEED_LIMIT;
  }
  return Math.min(FEED_LIMIT_MAX, Math.max(1, Math.floor(limit)));
}

/** ISO instant for a stored date, or undefined when absent or unparseable. */
function toIso(value: string | null | undefined): string | undefined {
  if (!value) {
    return;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** `${base}/${slug}`, or undefined for a row with no usable slug. */
function detailHref(
  base: string,
  slug: string | null | undefined
): string | undefined {
  const trimmed = slug?.trim();
  return trimmed ? `${base}/${encodeURIComponent(trimmed)}` : undefined;
}
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
  category?: string;
  date: string;
  going: number;
  /** Event detail route, as `getEventHref` builds it. Absent without a slug. */
  href?: string;
  id: string;
  image?: string;
  memberOnly?: boolean;
  /** ISO instant of `start_date`. */
  startsAt?: string;
  ticketUrl?: string;
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
  locale: PageFeedLocale,
  limit?: number
): Promise<PageEventItem[]> {
  const events = await db.listRows<Events>("app", "events", [
    Query.select([
      "$id",
      "slug",
      "image",
      "category",
      "ticket_url",
      "member_only",
      "start_date",
      "location",
      "translation_refs.locale",
      "translation_refs.title",
    ]),
    Query.equal("status", "published"),
    Query.equal("department_id", departmentId),
    Query.greaterThanEqual("start_date", new Date().toISOString()),
    Query.orderAsc("start_date"),
    Query.limit(feedLimit(limit)),
  ]);

  return events.rows.map((event) => ({
    category: event.category ?? undefined,
    date: formatFeedDate(event.start_date, locale),
    going: 0,
    href: detailHref("/events", event.slug),
    id: event.$id,
    image: resolveStorageFileUrl(event.image) ?? undefined,
    memberOnly: event.member_only || undefined,
    startsAt: toIso(event.start_date),
    ticketUrl: event.ticket_url || undefined,
    title: pickTranslation(event.translation_refs, locale)?.title ?? "",
    where: event.location ?? "",
  }));
}

export interface PageNewsItem {
  department: string;
  /** Article route, as the coded news list builds it. Absent without a slug. */
  href?: string;
  id: string;
  image?: string;
  publishedAt: string;
  publishedAtIso?: string;
  summary: string;
  title: string;
}

/** Latest published news for one department. */
export async function readPageNewsFeed(
  db: FeedDb,
  departmentId: string,
  locale: PageFeedLocale,
  limit?: number
): Promise<PageNewsItem[]> {
  const news = await db.listRows<News>("app", "news", [
    Query.select([
      "$id",
      "$createdAt",
      "slug",
      "image",
      "department.Name",
      "translation_refs.locale",
      "translation_refs.title",
      "translation_refs.short_description",
      "translation_refs.description",
    ]),
    Query.equal("status", NewsStatus.PUBLISHED),
    Query.equal("department_id", departmentId),
    Query.orderDesc("$createdAt"),
    Query.limit(feedLimit(limit)),
  ]);

  return news.rows.map((row) => {
    const translation = pickTranslation(row.translation_refs, locale);
    return {
      department: departmentName(row.department),
      href: detailHref("/news", row.slug),
      id: row.$id,
      image: resolveStorageFileUrl(row.image) ?? undefined,
      publishedAt: formatFeedDate(row.$createdAt, locale),
      publishedAtIso: toIso(row.$createdAt),
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
  deadlineIso?: string;
  department: string;
  employmentType?: string;
  /** Vacancy route, as the sitemap and applications list build it. */
  href?: string;
  id: string;
  paid?: boolean;
  title: string;
}

/** `paid` and `employment_type` from the `jobs.metadata` JSON blob. */
export function jobExtras(metadata: string | null): {
  employmentType?: string;
  paid?: boolean;
} {
  if (!metadata) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadata) as {
      employment_type?: unknown;
      paid?: unknown;
    };
    const employmentType =
      typeof parsed.employment_type === "string" &&
      parsed.employment_type.trim()
        ? parsed.employment_type
        : undefined;
    return {
      employmentType,
      paid: typeof parsed.paid === "boolean" ? parsed.paid : undefined,
    };
  } catch {
    return {};
  }
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
  locale: PageFeedLocale,
  limit?: number
): Promise<PageJobItem[]> {
  const jobs = await db.listRows<Jobs>("app", "jobs", [
    Query.select([
      "$id",
      "slug",
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
    Query.limit(feedLimit(limit)),
  ]);

  return jobs.rows
    .filter((job) =>
      isRecruitmentVacancyOpen(job.status, job.application_deadline)
    )
    .map((job) => ({
      commitment: jobCommitment(job.metadata),
      deadline: formatFeedDate(job.application_deadline, locale),
      deadlineIso: toIso(job.application_deadline),
      department: departmentName(job.department),
      href: detailHref("/jobs", job.slug),
      id: job.$id,
      ...jobExtras(job.metadata),
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
    Query.select(["$id", "name", "url", "image_url", "sort_order"]),
    Query.equal("level", "national"),
    Query.orderAsc("sort_order"),
    Query.orderAsc("$createdAt"),
    Query.limit(PARTNER_LIMIT),
  ]);

  return partners.rows.map((partner) => ({
    href: partner.url ?? undefined,
    logoSrc: partner.image_url || undefined,
    name: partner.name,
  }));
}

export interface PageProductItem {
  /** `/shop/<slug>`. Absent without a slug: the shop resolves by slug only. */
  href?: string;
  id: string;
  image?: string;
  /** Purchase is gated to members; the product is still listed. */
  memberOnly: boolean;
  memberPrice?: number;
  price: number;
  /** `stock === 0`; null stock means untracked, not sold out. */
  soldOut: boolean;
  title: string;
}

/**
 * Published, listed products of one department, newest first. Mirrors the
 * web's `cachedUnitProducts`: link-only (`unlisted`) products never appear.
 */
export async function readPageProductsFeed(
  db: FeedDb,
  departmentId: string,
  locale: PageFeedLocale,
  limit?: number
): Promise<PageProductItem[]> {
  const products = await db.listRows<WebshopProducts>(
    "app",
    "webshop_products",
    [
      Query.select([
        "$id",
        "$createdAt",
        "slug",
        "image",
        "regular_price",
        "member_price",
        "member_only",
        "stock",
        "translation_refs.locale",
        "translation_refs.title",
      ]),
      // The column is camelCase, unlike `department_id` on the other tables.
      Query.equal("departmentId", departmentId),
      Query.equal("status", WebshopProductsStatus.PUBLISHED),
      listedProductsOnly(),
      Query.orderDesc("$createdAt"),
      Query.limit(feedLimit(limit)),
    ]
  );

  return products.rows.map((product) => ({
    href: detailHref("/shop", product.slug),
    id: product.$id,
    image: resolveStorageFileUrl(product.image) ?? undefined,
    memberOnly: product.member_only === true,
    memberPrice: product.member_price ?? undefined,
    price: product.regular_price,
    soldOut: product.stock === 0,
    // Every translation is fetched and `locale` preferred: most products
    // have no English row, and a hard filter would empty the block on /en.
    title:
      pickTranslation(product.translation_refs, locale)?.title ??
      product.slug ??
      "",
  }));
}

export interface PageDepartmentItem {
  campusId: string | null;
  campusLabel?: string;
  /** `unitCanonicalPath`; absent for a department with no slug or campus. */
  href?: string;
  id: string;
  internalId: string | null;
  logo: string | null;
  /** `logo` expanded from a bare file id into a renderable URL. */
  logoUrl?: string;
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
    Query.select([
      "$id",
      "Id",
      "Name",
      "active",
      "campus_id",
      "type",
      "logo",
      "slug",
    ]),
    Query.equal("active", true),
    Query.orderAsc("Name"),
    Query.limit(DEPARTMENT_LIMIT),
  ];
  if (campusId) {
    queries.push(Query.equal("campus_id", campusId));
  }

  const departments = await db.listRows<Departments>(
    "app",
    "departments",
    queries
  );

  // `active` is not a publication flag — the table mirrors the 24SO chart of
  // accounts, so operating ledgers ("Drift BISO") and the national governance
  // rows are live accounts with no public page. They must never reach a
  // rendered block. `total` deliberately keeps reporting Appwrite's count for
  // the reason documented on the type; it is a query cardinality, not the size
  // of what was rendered.
  // The category is matched through `parseUnitCategory` here, not by an
  // equality query, so legacy values ("forening") land in their category.
  // At most DEPARTMENT_LIMIT rows, so filtering in memory is cheap.
  const wanted = type ? parseUnitCategory(type) : null;
  const visible = departments.rows
    .filter(isPublicUnit)
    .filter(
      (department) =>
        !type || (wanted && parseUnitCategory(department.type) === wanted)
    );

  return {
    departments: visible.map((department) => ({
      campusId: department.campus_id,
      campusLabel: campusIdToLabel(department.campus_id) ?? undefined,
      href:
        unitCanonicalPath({
          campusId: department.campus_id,
          slug: department.slug,
        }) ?? undefined,
      id: department.$id,
      internalId: department.Id,
      logo: department.logo,
      logoUrl: resolveStorageFileUrl(department.logo) ?? undefined,
      // The student-facing label, not the campus-prefixed accounting name.
      name: unitDisplayName(department.Name),
      type: department.type,
    })),
    total: departments.total,
  };
}

/**
 * The departments feed's `campus_id` and `type` query parameters, narrowed to
 * known campuses and unit categories. They become part of a cache key, so an
 * unknown value must collapse to "no filter" instead of minting entries.
 */
export function departmentsFeedFilters(params: URLSearchParams): {
  campusId: string | null;
  type: string | null;
} {
  const campus = params.get("campus_id");
  const type = params.get("type");
  return {
    campusId: campusIdToLabel(campus) ? campus : null,
    type: isUnitCategory(type) ? type : null,
  };
}

const FEED_DEPARTMENT_ID = /^[A-Za-z0-9._-]{1,36}$/;

/**
 * The `dept` query parameter of a feed route, or null when blank or not shaped
 * like an Appwrite id. It becomes part of a cache key, so anything else must
 * never reach a cached reader.
 */
export function feedDepartmentId(
  raw: string | null | undefined
): string | null {
  const value = raw?.trim();
  return value && FEED_DEPARTMENT_ID.test(value) ? value : null;
}
