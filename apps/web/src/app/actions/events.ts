"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  Campus,
  Departments,
  Events,
  Locale,
} from "@repo/api/types/appwrite";

interface ListEventsParams {
  campus?: string;
  limit?: number;
  locale?: "en" | "no";
  search?: string;
  status?: string;
}

export async function listEvents(
  params: ListEventsParams = {}
): Promise<Events[]> {
  const { limit = 25, status = "published", campus, locale, search } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
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
      Query.orderDesc("$createdAt"),
    ];

    if (locale) {
      queries.push(Query.equal("translation_refs.locale", locale as Locale));
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

    return eventsResponse.rows;
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

async function getEvent(
  id: string,
  locale: "en" | "no"
): Promise<Events | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.equal("translation_refs.locale", locale as Locale),
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

    return event;
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
      Query.equal("translation_refs.locale", locale as Locale),
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

    return response.rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching event by slug:", error);
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
      Query.equal("translation_refs.locale", locale as Locale),
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
      Query.orderAsc("start_date"),
    ]);

    return response.rows;
  } catch (error) {
    console.error("Error fetching collection events:", error);
    return [];
  }
}
