"use server";

import { campusScopeIds } from "@/lib/campus-scope";
import { filterTranslationRefs, queryEvents } from "@/lib/data/queries";
import {
  emptyWebResult,
  WEB_PAGE_SIZE,
  type WebPaginatedResult,
} from "@/lib/list-params";
import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  Campus,
  ContentTranslationsLocale,
  Departments,
  Events,
} from "@repo/api/types/appwrite";
import { EventsCategory } from "@repo/api/types/appwrite";

interface ListEventsParams {
  campus?: string;
  category?: string | null;
  locale?: "en" | "no";
  page?: number;
  /**
   * Rows per page. Defaults to `WEB_PAGE_SIZE` (12) — the paginated surfaces
   * (`/events`, `/jobs`, `/shop`) should omit this so they keep the size the
   * load-more UI expects. First-N consumers (`/students`) that need more than
   * one page's worth of rows in a single fetch should set this explicitly
   * rather than relying on a `limit` field that this action no longer honors.
   */
  pageSize?: number;
  search?: string;
  /** Opt-in: hide events that have already finished, sorted soonest-first. */
  upcomingOnly?: boolean;
}

/**
 * Published events, one page at a time — the public feed's reader, called from
 * the server and from the `/events` load-more island alike.
 *
 * The status is fixed here and never taken from `params`. A server action is
 * an ordinary POST endpoint whose arguments are whatever the browser sends,
 * and `events` grants `read("any")`, so this filter is all that stands between
 * a visitor and every draft and cancelled event: `status: "all"` used to drop
 * it. #76 closed the same hole in `listProducts`. The parameters are picked
 * one by one for the same reason — no spread lets an unknown key through.
 */
export async function listEvents(
  params: ListEventsParams = {}
): Promise<WebPaginatedResult<Events>> {
  const { campus, category, locale, search, upcomingOnly } = params;
  const page = params.page ?? 1;
  const size = params.pageSize ?? WEB_PAGE_SIZE;
  try {
    const { db } = await createSessionClient();
    const { rows, total, capped } = await queryEvents(db, {
      campus,
      category,
      locale,
      search,
      upcomingOnly,
      status: "published",
      limit: size,
      offset: (page - 1) * size,
    });
    return { rows, total, page, size, capped };
  } catch (error) {
    // Logged with context: this catch returning [] is exactly how the
    // rejected Query.search stayed invisible in production.
    console.error("Error fetching events:", error);
    return emptyWebResult<Events>(page, size);
  }
}

/**
 * Categories present in the current event set.
 *
 * Rendering all eight `EventsCategory` values would give six chips that
 * return nothing — only 3 events are published today.
 */
export async function listEventFacets(params: {
  campus?: string;
}): Promise<{ categories: EventsCategory[] }> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      Query.equal("status", "published"),
      Query.select(["category"]),
      Query.limit(300),
    ];
    const campusScope = campusScopeIds(params.campus ?? null);
    if (campusScope) {
      queries.push(Query.equal("campus_id", campusScope));
    }

    const response = await db.listRows<Events>("app", "events", queries);
    const present = new Set(
      response.rows.map((e) => e.category).filter(Boolean)
    );
    // Ordered by the enum so chips never reshuffle between renders.
    return {
      categories: Object.values(EventsCategory).filter((c) => present.has(c)),
    };
  } catch (error) {
    console.error("listEventFacets failed:", error);
    return { categories: [] };
  }
}

async function _getEvent(
  id: string,
  locale: "en" | "no"
): Promise<Events | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.equal(
        "translation_refs.locale",
        locale as ContentTranslationsLocale
      ),
      Query.select([
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
      ]),
      Query.limit(1),
    ]);

    const event = response.rows[0];

    if (!event) {
      return null;
    }

    return filterTranslationRefs(event, locale);
  } catch (error) {
    console.error("Error fetching event:", error);
    return null;
  }
}

export async function getEventBySlug(
  slug: string,
  locale: "en" | "no"
): Promise<Events | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("slug", slug),
      // The `events` collection grants row read to `any`, so unpublished rows
      // are reachable by anonymous visitors. This filter is the guard that
      // keeps draft/cancelled events from leaking via a direct slug URL.
      Query.equal("status", "published"),
      Query.equal(
        "translation_refs.locale",
        locale as ContentTranslationsLocale
      ),
      Query.select([
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
        "contact_name",
        "contact_role",
        "contact_email",
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
      ]),
      Query.limit(1),
    ]);

    const event = response.rows[0];
    return event ? filterTranslationRefs(event, locale) : null;
  } catch (error) {
    console.error("Error fetching event by slug:", error);
    return null;
  }
}

/**
 * The detail read for the redesigned event page (RD-020).
 *
 * Two deliberate differences from `getEventBySlug`, which is left untouched so
 * the current page keeps behaving exactly as it does:
 *
 * 1. **All locales are fetched.** `getEventBySlug` filters `translation_refs`
 *    to the requested locale at the query. Two of the three published events
 *    have a Norwegian row whose `description` is empty, so that filter leaves a
 *    Norwegian reader with a headline and a blank page while the English copy
 *    sits one row away. `pickContent` picks per field and discloses a fallback.
 * 2. **The columns the page actually shows are selected** — category, capacity,
 *    the real member price, the per-event contact, tags and the location mode.
 *    The current page reads all of that out of `metadata`, which is `null` on
 *    every published row.
 */
export async function getEventDetailBySlug(
  slug: string
): Promise<Events | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("slug", slug),
      // Same guard as `getEventBySlug`: `events` grants row read to `any`, so
      // without this a draft or cancelled event is reachable by direct URL.
      Query.equal("status", "published"),
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "slug",
        "status",
        "campus_id",
        "start_date",
        "end_date",
        "location",
        "location_mode",
        "online_url",
        "price",
        "member_price",
        "pricing_mode",
        "ticket_url",
        "image",
        "member_only",
        "capacity",
        "registration_deadline",
        "category",
        "tags",
        "contact_name",
        "contact_role",
        "contact_email",
        "collection_id",
        "is_collection",
        "collection_pricing",
        "department_id",
        "campus.$id",
        "campus.name",
        "department.$id",
        "department.Name",
        "translation_refs.$id",
        "translation_refs.locale",
        "translation_refs.title",
        "translation_refs.description",
        "translation_refs.short_description",
      ]),
      Query.limit(1),
    ]);

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching event detail by slug:", error);
    return null;
  }
}

async function _getEventImageViewUrl(fileId: string) {
  const { storage } = await createSessionClient();
  const url = await storage.getFileView("events", fileId);
  return url;
}

// Helper function to get departments for a specific campus
async function _listDepartments(campusId?: string) {
  const queries = [Query.equal("active", true)];

  if (campusId) {
    queries.push(Query.equal("campus_id", campusId));
  }

  try {
    const { db } = await createSessionClient();
    const response = await db.listRows<Departments>(
      "app",
      "departments",
      queries
    );
    return response.rows;
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

// Helper function to get campuses
async function _listCampuses() {
  try {
    const { db } = await createSessionClient();
    const response = await db.listRows<Campus>("app", "campus");
    return response.rows;
  } catch (error) {
    console.error("Error fetching campuses:", error);
    return [];
  }
}

// Helper function to get collection events
export async function getCollectionEvents(
  collectionId: string,
  locale: "en" | "no"
): Promise<Events[]> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("collection_id", collectionId),
      // A draft or cancelled session of a published collection must not be
      // listed on its page: it links to a 404, and `events` is readable by
      // `any`, so nothing else hides it.
      Query.equal("status", "published"),
      Query.equal(
        "translation_refs.locale",
        locale as ContentTranslationsLocale
      ),
      Query.limit(100),
      Query.select([
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
        "department.campus",
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
      ]),
      Query.orderAsc("start_date"),
    ]);

    return response.rows.map((event) => filterTranslationRefs(event, locale));
  } catch (error) {
    console.error("Error fetching collection events:", error);
    return [];
  }
}
