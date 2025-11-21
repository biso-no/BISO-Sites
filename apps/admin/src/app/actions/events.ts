"use server";

import { getStorageFileUrl, ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type Campus,
  type ContentTranslations,
  ContentType,
  type Departments,
  type Events,
  Locale,
  type Status,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import type { AdminEvent, EventMetadata } from "@/lib/types/event";

// Helper to parse metadata JSON safely
function parseMetadata(metadata: string | null): EventMetadata {
  if (!metadata) {
    return {};
  }
  try {
    return JSON.parse(metadata) as EventMetadata;
  } catch {
    return {};
  }
}

// Helper to transform raw event data into AdminEvent format
function transformEventData(event: Events): AdminEvent {
  // Handle translation_refs which can be an array of ContentTranslations or strings
  const rawRefs = event.translation_refs || [];
  const translationRefs = Array.isArray(rawRefs)
    ? rawRefs.filter((t): t is ContentTranslations => typeof t !== "string")
    : [];

  const metadata_parsed = parseMetadata(event.metadata as string | null);

  // Build translations map from translation_refs
  const translations = {
    en: translationRefs.find((t) => t.locale === Locale.EN) || {
      title: "",
      description: "",
    },
    no: translationRefs.find((t) => t.locale === Locale.NO) || {
      title: "",
      description: "",
    },
  };

  return {
    ...event,
    translation_refs: translationRefs,
    translations,
    metadata_parsed,
  } as AdminEvent;
}

export type ListEventsParams = {
  limit?: number;
  status?: string;
  campus?: string;
  search?: string;
  locale?: "en" | "no";
};

export type CreateEventData = {
  slug?: string;
  status: "draft" | "published" | "cancelled";
  campus_id: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  price?: number;
  ticket_url?: string;
  image?: string;
  member_only?: boolean;
  collection_id?: string;
  is_collection?: boolean;
  collection_pricing?: "bundle" | "individual";
  department_id?: string;
  metadata?: {
    start_time?: string;
    end_time?: string;
    units?: string[];
  };
  translations: {
    en: {
      title: string;
      description: string;
    };
    no: {
      title: string;
      description: string;
    };
  };
};

export type UpdateEventData = {
  slug?: string;
  status?: "draft" | "published" | "cancelled";
  campus_id?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  price?: number;
  ticket_url?: string;
  image?: string;
  member_only?: boolean;
  collection_id?: string;
  is_collection?: boolean;
  collection_pricing?: "bundle" | "individual";
  department_id?: string;
  metadata?: {
    start_time?: string;
    end_time?: string;
    units?: string[];
  };
  translations?: {
    en: {
      title: string;
      description: string;
    };
    no: {
      title: string;
      description: string;
    };
  };
};

export async function listEvents(
  params: ListEventsParams = {}
): Promise<AdminEvent[]> {
  const { limit = 25, status = "published", campus, search } = params;

  try {
    const { db } = await createSessionClient();

    const queries = [Query.limit(limit), Query.orderDesc("$createdAt")];

    if (status !== "all") {
      queries.push(Query.equal("status", status));
    }

    if (campus && campus !== "all") {
      queries.push(Query.equal("campus_id", campus));
    }

    if (search) {
      queries.push(Query.search("slug", search));
    }

    const eventsResponse = await db.listRows<Events>("app", "events", queries);
    return eventsResponse.rows.map(transformEventData);
  } catch (error) {
    console.error("Error fetching events:", error);
    return [];
  }
}

export async function getEvent(id: string): Promise<AdminEvent | null> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
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
        "price",
        "ticket_url",
        "image",
        "member_only",
        "collection_id",
        "is_collection",
        "collection_pricing",
        "department_id",
        "metadata",
        "campus.*",
        "department.*",
        "translation_refs.*",
      ]),
      Query.limit(1),
    ]);

    const event = response.rows[0];
    if (!event) {
      return null;
    }

    return transformEventData(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return null;
  }
}

export async function createEvent(
  data: CreateEventData,
  skipRevalidation = false
) {
  try {
    const { db } = await createSessionClient();
    const eventId = ID.unique();

    // Build metadata JSON with non-schema fields only
    const metadataJson: EventMetadata = {};
    if (data.metadata?.start_time) {
      metadataJson.start_time = data.metadata.start_time;
    }
    if (data.metadata?.end_time) {
      metadataJson.end_time = data.metadata.end_time;
    }
    if (data.metadata?.units?.length) {
      metadataJson.units = data.metadata.units;
    }

    // Create event with nested translations in ONE atomic operation
    // Appwrite will automatically create the translation rows when no IDs are provided
    const event = await db.createRow<Events>("app", "events", eventId, {
      slug: data.slug ?? null,
      status: data.status as Status,
      campus_id: data.campus_id,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      location: data.location ?? null,
      price: data.price ?? null,
      ticket_url: data.ticket_url ?? null,
      image: data.image ?? null,
      member_only: data.member_only ?? false,
      collection_id: data.collection_id ?? null,
      is_collection: data.is_collection ?? false,
      collection_pricing: data.collection_pricing ?? null,
      department_id: data.department_id ?? null,
      metadata: Object.keys(metadataJson).length
        ? JSON.stringify(metadataJson)
        : null,
      campus: data.campus_id,
      department: data.department_id ?? null,
      // Nested relationship creation - Appwrite creates translations atomically
      translation_refs: [
        {
          content_id: eventId,
          content_type: ContentType.EVENT,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
        },
        {
          content_id: eventId,
          content_type: ContentType.EVENT,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
        },
      ] as ContentTranslations[],
    });

    if (!skipRevalidation) {
      revalidatePath("/admin/events");
      revalidatePath("/events");
    }

    return event;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
}

export async function updateEvent(
  eventId: string,
  data: UpdateEventData
): Promise<Events | null> {
  try {
    const { db } = await createSessionClient();

    // Build update object - same pattern as products
    const updateData: Record<string, unknown> = {};

    if (data.slug !== undefined) {
      updateData.slug = data.slug;
    }
    if (data.status !== undefined) {
      updateData.status = data.status as Status;
    }
    if (data.campus_id !== undefined) {
      updateData.campus_id = data.campus_id;
    }
    if (data.start_date !== undefined) {
      updateData.start_date = data.start_date;
    }
    if (data.end_date !== undefined) {
      updateData.end_date = data.end_date;
    }
    if (data.location !== undefined) {
      updateData.location = data.location;
    }
    if (data.price !== undefined) {
      updateData.price = data.price;
    }
    if (data.ticket_url !== undefined) {
      updateData.ticket_url = data.ticket_url;
    }
    if (data.image !== undefined) {
      updateData.image = data.image;
    }
    if (data.member_only !== undefined) {
      updateData.member_only = data.member_only;
    }
    if (data.collection_id !== undefined) {
      updateData.collection_id = data.collection_id;
    }
    if (data.is_collection !== undefined) {
      updateData.is_collection = data.is_collection;
    }
    if (data.collection_pricing !== undefined) {
      updateData.collection_pricing = data.collection_pricing;
    }
    if (data.department_id !== undefined) {
      updateData.department_id = data.department_id;
    }

    // Build metadata only if provided
    if (data.metadata !== undefined) {
      const metadataJson: EventMetadata = {};
      if (data.metadata.start_time) {
        metadataJson.start_time = data.metadata.start_time;
      }
      if (data.metadata.end_time) {
        metadataJson.end_time = data.metadata.end_time;
      }
      if (data.metadata.units?.length) {
        metadataJson.units = data.metadata.units;
      }
      updateData.metadata = Object.keys(metadataJson).length
        ? JSON.stringify(metadataJson)
        : null;
    }

    // Build translation_refs array with both translations if provided
    // For updates, we need to fetch existing translation IDs to properly update them
    if (data.translations) {
      // Fetch existing translations to get their IDs
      const existingEvent = await db.listRows<Events>("app", "events", [
        Query.equal("$id", eventId),
        Query.select(["translation_refs.$id", "translation_refs.locale"]),
        Query.limit(1),
      ]);

      const existingTranslations =
        existingEvent.rows[0]?.translation_refs || [];
      const existingTranslationsArray = Array.isArray(existingTranslations)
        ? existingTranslations.filter(
            (t): t is ContentTranslations => typeof t !== "string"
          )
        : [];

      const enTranslation = existingTranslationsArray.find(
        (t) => t.locale === Locale.EN
      );
      const noTranslation = existingTranslationsArray.find(
        (t) => t.locale === Locale.NO
      );

      updateData.translation_refs = [
        {
          ...(enTranslation?.$id ? { $id: enTranslation.$id } : {}),
          content_type: ContentType.EVENT,
          content_id: eventId,
          locale: Locale.EN,
          title: data.translations.en.title,
          description: data.translations.en.description,
        } as ContentTranslations,
        {
          ...(noTranslation?.$id ? { $id: noTranslation.$id } : {}),
          content_type: ContentType.EVENT,
          content_id: eventId,
          locale: Locale.NO,
          title: data.translations.no.title,
          description: data.translations.no.description,
        } as ContentTranslations,
      ];
    }

    const event = await db.updateRow<Events>(
      "app",
      "events",
      eventId,
      updateData
    );

    revalidatePath("/events");
    revalidatePath("/admin/events");

    return event;
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
}

async function _deleteEvent(id: string): Promise<boolean> {
  try {
    const { db } = await createSessionClient();

    await db.deleteRow("app", "events", id);
    revalidatePath("/events");
    revalidatePath("/admin/events");
    return true;
  } catch (error) {
    console.error("Error deleting event:", error);
    return false;
  }
}

// AI Translation function for events
export async function translateEventContent(
  content: { title: string; description: string },
  fromLocale: "en" | "no",
  toLocale: "en" | "no"
): Promise<{ title: string; description: string } | null> {
  try {
    const { generateObject } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");
    const { z } = await import("zod");

    const targetLanguage = toLocale === "en" ? "English" : "Norwegian";
    const sourceLanguage = fromLocale === "en" ? "English" : "Norwegian";

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: z.object({
        title: z.string(),
        description: z.string(),
      }),
      prompt: `Translate the following event content from ${sourceLanguage} to ${targetLanguage}. 
      Maintain the same professional tone suitable for a student organization event.
      Keep any HTML formatting intact if present.
      
      Title: ${content.title}
      Description: ${content.description}
      
      Provide the translation in ${targetLanguage}.`,
    });

    return {
      title: result.object.title,
      description: result.object.description,
    };
  } catch (error) {
    console.error("Error translating event content:", error);
    return null;
  }
}
export async function uploadEventImage(formData: FormData) {
  const { storage } = await createSessionClient();
  const file = formData.get("file") as File;
  const uploaded = await storage.createFile("content", "unique()", file);
  const url = getStorageFileUrl("content", uploaded.$id);
  return { id: uploaded.$id, url };
}

async function _getEventImageViewUrl(fileId: string) {
  return getStorageFileUrl("content", fileId);
}

// Helper function to get departments for a specific campus
export async function listDepartments(campusId?: string) {
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
export async function listCampuses() {
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
async function _getCollectionEvents(
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
