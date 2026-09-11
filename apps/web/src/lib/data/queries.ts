/**
 * Pure Appwrite query builders for public content, shared between the dynamic
 * server actions (session client — respects the visitor's row permissions)
 * and the cached readers in `public-content.ts` (public/guest client inside
 * `"use cache"`). Plain module: no directives, no cookies, no caching — the
 * caller decides both the client and the cache policy.
 */

import { Query } from "@repo/api";
import type { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslationsLocale,
  Events,
  News,
} from "@repo/api/types/appwrite";
import { campusScopeIds } from "@/lib/campus-scope";
import { WEB_PAGE_SIZE } from "@/lib/list-params";
import { findContentIdsBySearch } from "./search-content";

export type Db = Awaited<ReturnType<typeof createSessionClient>>["db"];

export type PublicLocale = "en" | "no";

export function filterTranslationRefs<T extends { translation_refs?: unknown }>(
  item: T,
  locale: string | undefined
): T {
  if (!(locale && Array.isArray(item.translation_refs))) {
    return item;
  }
  return {
    ...item,
    translation_refs: item.translation_refs.filter(
      (ref) =>
        typeof ref === "object" &&
        ref !== null &&
        "locale" in ref &&
        (ref as Record<string, unknown>).locale === locale
    ),
  };
}

export interface ListEventsQuery {
  campus?: string;
  category?: string | null;
  limit?: number;
  locale?: PublicLocale;
  offset?: number;
  search?: string;
  status?: string;
  /**
   * Opt-in: drop events that have already finished and order by start date
   * ascending instead of newest-created-first. Off by default — collection and
   * admin-ish surfaces legitimately want the full history.
   */
  upcomingOnly?: boolean;
}

const EVENT_SELECT = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "metadata",
  "start_date",
  "end_date",
  "location",
  "price",
  "ticket_url",
  "image",
  "member_only",
  "registration_deadline",
  "capacity",
  "pricing_mode",
  "collection_id",
  "is_collection",
  "collection_pricing",
  "department_id",
  "campus.$id",
  "campus.name",
  "department.$id",
  "department.Name",
  "translation_refs.$id",
  "translation_refs.$createdAt",
  "translation_refs.$updatedAt",
  "translation_refs.content_id",
  "translation_refs.content_type",
  "translation_refs.locale",
  "translation_refs.title",
  "translation_refs.description",
  "translation_refs.short_description",
  "translation_refs.additional_fields",
] as const;

/**
 * "Has not finished yet", as a query rather than a post-fetch filter.
 *
 * Prefers `end_date`, falls back to `start_date`, and keeps rows with neither
 * (both columns are optional). Appwrite allows one level of `and` nested in
 * `or`, which is what makes the fallback expressible — verified against the
 * live instance.
 */
function upcomingQueries(nowIso: string): string[] {
  return [
    Query.or([
      Query.greaterThanEqual("end_date", nowIso),
      Query.and([
        Query.isNull("end_date"),
        Query.greaterThanEqual("start_date", nowIso),
      ]),
      Query.and([Query.isNull("end_date"), Query.isNull("start_date")]),
    ]),
  ];
}

export async function queryEvents(
  db: Db,
  params: ListEventsQuery = {}
): Promise<{ capped: boolean; rows: Events[]; total: number }> {
  const {
    campus,
    category,
    limit = WEB_PAGE_SIZE,
    locale,
    offset = 0,
    search,
    status = "published",
    upcomingOnly = false,
  } = params;

  const queries = [Query.select([...EVENT_SELECT])];

  let capped = false;

  if (search?.trim()) {
    const found = await findContentIdsBySearch(db, "event", search, locale);
    if (found.ids.length === 0) {
      return { rows: [], total: 0, capped: false };
    }
    capped = found.capped;
    queries.push(Query.equal("$id", found.ids));
  }

  if (upcomingOnly) {
    queries.push(...upcomingQueries(new Date().toISOString()));
    queries.push(Query.orderAsc("start_date"));
  } else {
    queries.push(Query.orderDesc("$createdAt"));
  }

  if (locale) {
    queries.push(
      Query.equal(
        "translation_refs.locale",
        locale as ContentTranslationsLocale
      )
    );
  }

  if (status !== "all") {
    queries.push(Query.equal("status", status));
  }

  const campusScope = campusScopeIds(campus);
  if (campusScope) {
    queries.push(Query.equal("campus_id", campusScope));
  }

  if (category) {
    queries.push(Query.equal("category", category));
  }

  // Deliberately no `member_only` filter, for anyone: members-only limits who
  // can JOIN an event, not who can see it. Surfaces render a badge instead.

  // Collections and standalone events only — never an item inside a
  // collection. Also formerly client-side. The empty-string arm is defensive:
  // every current row has collection_id NULL, but the admin editor may write "".
  queries.push(
    Query.or([
      Query.equal("is_collection", true),
      Query.isNull("collection_id"),
      Query.equal("collection_id", ""),
    ])
  );

  queries.push(Query.limit(limit), Query.offset(offset));

  const response = await db.listRows<Events>("app", "events", queries);

  return {
    rows: response.rows.map((event) => filterTranslationRefs(event, locale)),
    total: response.total,
    capped,
  };
}

export interface ListNewsQuery {
  campus?: string;
  limit?: number;
  locale?: PublicLocale;
  search?: string;
  status?: string;
}

const NEWS_SELECT = [
  "$id",
  "$createdAt",
  "$updatedAt",
  "slug",
  "status",
  "campus_id",
  "department_id",
  "sticky",
  "url",
  "image",
  "metadata",
  "author",
  "campus.$id",
  "campus.name",
  "department.$id",
  "department.Name",
  "translation_refs.$id",
  "translation_refs.$createdAt",
  "translation_refs.$updatedAt",
  "translation_refs.content_id",
  "translation_refs.content_type",
  "translation_refs.locale",
  "translation_refs.title",
  "translation_refs.description",
  "translation_refs.short_description",
  "translation_refs.additional_fields",
] as const;

export async function queryNews(
  db: Db,
  params: ListNewsQuery = {}
): Promise<News[]> {
  const { limit = 25, status, campus, locale, search } = params;

  const queries = [
    Query.select([...NEWS_SELECT]),
    Query.limit(limit),
    Query.orderDesc("$createdAt"),
  ];

  if (locale) {
    queries.push(Query.equal("translation_refs.locale", locale));
  }

  if (status && status !== "all") {
    queries.push(Query.equal("status", status));
  }

  const campusScope = campusScopeIds(campus);
  if (campusScope) {
    queries.push(Query.equal("campus_id", campusScope));
  }

  if (search?.trim()) {
    queries.push(Query.search("translation_refs.title", search.trim()));
  }

  const newsResponse = await db.listRows<News>("app", "news", queries);

  return newsResponse.rows.map((item) => filterTranslationRefs(item, locale));
}
