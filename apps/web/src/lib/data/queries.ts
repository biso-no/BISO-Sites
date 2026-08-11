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
  const { limit = 25, status = "published", campus, locale, search } = params;

  const queries = [
    Query.select([...EVENT_SELECT]),
    Query.orderDesc("$createdAt"),
  ];

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

  if (campus && campus !== "all") {
    queries.push(Query.equal("campus_id", campus));
  }

  if (search?.trim()) {
    queries.push(Query.search("translation_refs.title", search.trim()));
  }

  queries.push(Query.limit(limit));

  const eventsResponse = await db.listRows<Events>("app", "events", queries);

  return eventsResponse.rows.map((event) =>
    filterTranslationRefs(event, locale)
  );
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

  if (campus && campus !== "all") {
    queries.push(Query.equal("campus_id", campus));
  }

  if (search?.trim()) {
    queries.push(Query.search("translation_refs.title", search.trim()));
  }

  const newsResponse = await db.listRows<News>("app", "news", queries);

  return newsResponse.rows.map((item) => filterTranslationRefs(item, locale));
}
