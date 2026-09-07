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
  limit?: number;
  locale?: PublicLocale;
  search?: string;
  status?: string;
  /**
   * Opt-in: drop events that have already finished and order by start date
   * ascending instead of newest-created-first. Off by default — collection and
   * admin-ish surfaces legitimately want the full history.
   */
  upcomingOnly?: boolean;
}

const MS_PER_DAY = 86_400_000;

/**
 * How far back the Appwrite-side prefilter reaches. An event is "past" only
 * once its `end_date` (or `start_date` when there is no end) has gone by, and
 * Appwrite cannot express that coalesce in one query — so the server filter is
 * deliberately generous and the exact check runs in JS below. 30 days covers
 * any realistic multi-day event that started before today but is still running.
 */
const UPCOMING_PREFILTER_DAYS = 30;

/**
 * True when the event has not finished yet. Prefers `end_date`, falls back to
 * `start_date`. Rows with neither date (both columns are optional in the
 * schema) stay visible rather than silently disappearing from the listing.
 *
 * Same shape as the `application_deadline` post-filter `_listJobs` applies in
 * `apps/web/src/app/actions/jobs.ts`.
 */
export function isEventUpcoming(
  event: Pick<Events, "end_date" | "start_date">,
  now: number = Date.now()
): boolean {
  const endsAt = event.end_date ?? event.start_date;
  if (!endsAt) {
    return true;
  }
  const endsAtTime = new Date(endsAt).getTime();
  if (Number.isNaN(endsAtTime)) {
    return true;
  }
  return endsAtTime >= now;
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

export async function queryEvents(
  db: Db,
  params: ListEventsQuery = {}
): Promise<Events[]> {
  const {
    limit = 25,
    status = "published",
    campus,
    locale,
    search,
    upcomingOnly = false,
  } = params;

  const queries = [Query.select([...EVENT_SELECT])];

  if (upcomingOnly) {
    const prefilterFrom = new Date(
      Date.now() - UPCOMING_PREFILTER_DAYS * MS_PER_DAY
    ).toISOString();
    queries.push(
      // `isNull` keeps undated rows in the result set — a bare
      // `greaterThanEqual` would drop them server-side before the JS check
      // below ever sees them.
      Query.or([
        Query.greaterThanEqual("start_date", prefilterFrom),
        Query.isNull("start_date"),
      ]),
      Query.orderAsc("start_date")
    );
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

  if (search?.trim()) {
    queries.push(Query.search("translation_refs.title", search.trim()));
  }

  queries.push(Query.limit(limit));

  const eventsResponse = await db.listRows<Events>("app", "events", queries);

  const rows = upcomingOnly
    ? eventsResponse.rows.filter((event) => isEventUpcoming(event))
    : eventsResponse.rows;

  return rows.map((event) => filterTranslationRefs(event, locale));
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
