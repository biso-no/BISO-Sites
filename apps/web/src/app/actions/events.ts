"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type Campus,
  type ContentTranslations,
  ContentType,
  type Departments,
  type Locale,
} from "@repo/api/types/appwrite";

type ListEventsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
};

export async function listEvents(
  params: ListEventsParams = {}
): Promise<ContentTranslations[]> {
  const { limit = 25, status = "published", campus, locale } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [
      Query.equal("content_type", "event"),
      Query.select([
        "content_id",
        "$id",
        "locale",
        "title",
        "description",
        "event_ref.*",
      ]),
      Query.equal("locale", locale as Locale),
      Query.orderDesc("$createdAt"),
    ];

    // Get events with their translations using Appwrite's nested relationships
    const eventsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      queries
    );


    let events = eventsResponse.rows;

    // Filter on nested fields after the query (not possible to filter in Appwrite)
    if (status !== "all") {
      events = events.filter((event) => event.event_ref?.status === status);
    }

    if (campus && campus !== "all") {
      events = events.filter((event) => event.event_ref?.campus_id === campus);
    }

    const slicedEvents = events.slice(0, limit);

    // Apply limit after filtering
    return slicedEvents;
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

export async function getEvent(
  id: string,
  locale: "en" | "no"
): Promise<ContentTranslations | null> {
  try {
    const { db } = await createSessionClient();

    // Query content_translations by content_id and locale
    const translationsResponse = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.EVENT),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "event_ref.*",
        ]),
        Query.limit(1),
      ]
    );

    if (translationsResponse.rows.length === 0) {
      return null;
    }

    return translationsResponse.rows[0];
  } catch (error) {
    console.error("Error fetching event:", error);
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
): Promise<ContentTranslations[]> {
  try {
    const { db } = await createSessionClient();

    // Get all events with this collection_id
    const response = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", ContentType.EVENT),
        Query.equal("locale", locale),
        Query.equal("event_ref.collection_id", collectionId),
        Query.select([
          "content_id",
          "$id",
          "locale",
          "title",
          "description",
          "event_ref.*",
        ]),
        Query.orderAsc("event_ref.start_date"),
      ]
    );

    return response.rows;
  } catch (error) {
    console.error("Error fetching collection events:", error);
    return [];
  }
}
