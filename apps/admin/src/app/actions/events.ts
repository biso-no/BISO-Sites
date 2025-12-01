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

type AdminDbClient = Awaited<ReturnType<typeof createSessionClient>>["db"];
type EventStatus = CreateEventData["status"];
type EventTranslationsInput = CreateEventData["translations"];

const EVENT_STATUS_MAP: Record<EventStatus, Status> = {
  draft: "draft" as Status,
  published: "published" as Status,
  cancelled: "cancelled" as Status,
};

const mapEventStatus = (status: EventStatus): Status =>
  EVENT_STATUS_MAP[status] ?? EVENT_STATUS_MAP.draft;

const serializeEventMetadata = (
  metadata: CreateEventData["metadata"] | UpdateEventData["metadata"]
) => {
  const metadataJson: EventMetadata = {};

  if (!metadata) {
    return null;
  }

  if (metadata.start_time) {
    metadataJson.start_time = metadata.start_time;
  }
  if (metadata.end_time) {
    metadataJson.end_time = metadata.end_time;
  }
  if (metadata.units?.length) {
    metadataJson.units = metadata.units;
  }

  return Object.keys(metadataJson).length ? JSON.stringify(metadataJson) : null;
};

const EVENT_UPDATE_FIELDS: (keyof UpdateEventData)[] = [
  "slug",
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
];

const collectEventUpdateData = (data: UpdateEventData) => {
  const updateData: Record<string, unknown> = {};

  for (const field of EVENT_UPDATE_FIELDS) {
    const value = data[field];
    if (value !== undefined) {
      updateData[field] = value;
    }
  }

  if (data.status !== undefined) {
    updateData.status = mapEventStatus(data.status);
  }

  if (data.metadata !== undefined) {
    updateData.metadata = serializeEventMetadata(data.metadata);
  }

  return updateData;
};

const buildEventTranslations = (
  contentId: string,
  translations: EventTranslationsInput
) =>
  [
    { locale: Locale.EN, data: translations.en },
    { locale: Locale.NO, data: translations.no },
  ].map(
    ({ locale, data }) =>
      ({
        content_id: contentId,
        content_type: ContentType.EVENT,
        locale,
        title: data.title,
        description: data.description,
      }) as ContentTranslations
  );

const buildEventTranslationRefsForUpdate = async (
  db: AdminDbClient,
  eventId: string,
  translations: EventTranslationsInput | undefined
) => {
  if (!translations) {
    return;
  }

  const existingEvent = await db.listRows<Events>("app", "events", [
    Query.equal("$id", eventId),
    Query.select(["translation_refs.$id", "translation_refs.locale"]),
    Query.limit(1),
  ]);

  const existingTranslations = existingEvent.rows[0]?.translation_refs || [];
  const existingTranslationsArray = Array.isArray(existingTranslations)
    ? existingTranslations.filter(
        (translation): translation is ContentTranslations =>
          typeof translation !== "string"
      )
    : [];

  const buildTranslation = (
    locale: Locale,
    translation: EventTranslationsInput[keyof EventTranslationsInput]
  ): ContentTranslations => {
    const existing = existingTranslationsArray.find(
      (item) => item.locale === locale
    );

    return {
      ...(existing?.$id ? { $id: existing.$id } : {}),
      content_type: ContentType.EVENT,
      content_id: eventId,
      locale,
      title: translation.title,
      description: translation.description,
    } as ContentTranslations;
  };

  return [
    buildTranslation(Locale.EN, translations.en),
    buildTranslation(Locale.NO, translations.no),
  ];
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
    const metadata = serializeEventMetadata(data.metadata);
    const translationRefs = buildEventTranslations(eventId, data.translations);

    const event = await db.createRow<Events>("app", "events", eventId, {
      slug: data.slug ?? null,
      status: mapEventStatus(data.status),
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
      metadata,
      campus: data.campus_id,
      department: data.department_id ?? null,
      // Nested relationship creation - Appwrite creates translations atomically
      translation_refs: translationRefs,
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

    const updateData = collectEventUpdateData(data);
    const translationRefs = await buildEventTranslationRefsForUpdate(
      db,
      eventId,
      data.translations
    );

    if (translationRefs) {
      updateData.translation_refs = translationRefs;
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
      model: openai("gpt-5-mini"),
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

function _getEventImageViewUrl(fileId: string) {
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
