"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  CollectionPricing,
  type ContentTranslations,
  type EventCategory,
  type EventStatus,
  type Events,
} from "@repo/api/types/appwrite";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import {
  listCampuses as _listCampuses,
  listDepartmentsForCampus as _listDepartmentsForCampus,
} from "./lookups";
import { EVENTS_PAGE_SIZE, type EventFormValues, eventSchema } from "./schemas";

export async function listCampuses() {
  return _listCampuses();
}

export async function listDepartmentsForCampus(campusId: string) {
  return _listDepartmentsForCampus(campusId);
}

type SessionDb = Awaited<ReturnType<typeof createSessionClient>>["db"];

const eventTranslationDraftSchema = z.object({
  title_en: z.string().trim().min(1),
  description_en: z.string().trim().min(1),
  short_description_en: z.string().trim().nullable().optional(),
});

const eventTranslationResultSchema = z.object({
  title_no: z.string().describe("Norwegian Bokmål event title"),
  description_no: z
    .string()
    .describe("Natural Norwegian Bokmål HTML preserving p, h3, ul and li tags"),
  short_description_no: z
    .string()
    .describe("Norwegian one-line teaser, maximum 280 characters"),
});

const eventSuggestionDraftSchema = z.object({
  current_description: z.string().trim().optional().default(""),
  category: z.string().trim().optional(),
});

const eventSuggestionResultSchema = z.object({
  heading: z.string().describe("Short, descriptive section heading"),
  content: z
    .string()
    .describe(
      "Section body as simple HTML (p, h3, ul, li). Useful for a run-of-show, what-to-bring, schedule, or similar block."
    ),
});

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

function serializeAdditionalFields(payload: {
  short_description: string | null;
}): string | null {
  if (!payload.short_description) {
    return null;
  }
  return JSON.stringify({ short_description: payload.short_description });
}

async function upsertEventTranslation(
  db: SessionDb,
  eventId: string,
  locale: "no" | "en",
  payload: {
    title: string;
    description: string;
    shortDescription: string | null;
  }
): Promise<void> {
  const existing = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "event"),
      Query.equal("content_id", eventId),
      Query.equal("locale", locale),
      Query.limit(1),
    ]
  );

  const data = {
    content_id: eventId,
    content_type: "event",
    locale,
    title: payload.title,
    description: payload.description,
    short_description: payload.shortDescription,
    additional_fields: serializeAdditionalFields({
      short_description: payload.shortDescription,
    }),
  };

  if (existing.rows[0]) {
    await db.updateRow(
      "app",
      "content_translations",
      existing.rows[0].$id,
      data
    );
    return;
  }

  await db.createRow("app", "content_translations", ID.unique(), data);
}

function buildEventColumns(values: EventFormValues): Record<string, unknown> {
  return {
    slug: values.slug,
    campus_id: values.campus_id,
    department_id: values.department_id ?? null,
    category: (values.category ?? null) as EventCategory | null,
    tags: values.tags ?? [],
    start_date: values.start_date ?? null,
    end_date: values.end_date ?? null,
    registration_deadline: values.registration_deadline ?? null,
    location_mode: values.location_mode,
    location: values.location ?? null,
    online_url: values.online_url ?? null,
    capacity: values.capacity,
    waitlist: values.waitlist,
    cover_pattern: values.cover_pattern,
    image: values.image || null,
    pricing_mode: values.pricing_mode,
    price: values.price ?? null,
    member_price: values.member_price ?? null,
    ticket_url: values.ticket_url || null,
    member_only: values.member_only,
    is_collection: values.is_collection,
    collection_pricing: CollectionPricing.INDIVIDUAL,
    notify_push: values.notify_push,
    publish_mode: values.publish_mode,
    scheduled_publish_at: values.scheduled_publish_at ?? null,
    contact_name: values.contact_name ?? null,
    contact_role: values.contact_role ?? null,
    contact_email: values.contact_email ?? null,
    metadata: null,
  };
}

export async function listEvents(opts?: {
  campusId?: string;
  departmentId?: string;
  status?: string;
  search?: string;
  timeframe?: "all" | "upcoming" | "past";
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const page = Math.max(1, opts?.page ?? 1);
  const search = opts?.search?.trim().toLowerCase() ?? "";
  const timeframe = opts?.timeframe ?? "all";

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.select(["*", "translation_refs.*"]),
    ...applyScopeQueries(ctx),
  ];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  if (opts?.departmentId) {
    queries.push(Query.equal("department_id", opts.departmentId));
  }

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const needsClientFilter = Boolean(search) || timeframe !== "all";

  if (needsClientFilter) {
    queries.push(Query.limit(300));
  } else {
    queries.push(Query.limit(EVENTS_PAGE_SIZE));
    queries.push(Query.offset((page - 1) * EVENTS_PAGE_SIZE));
  }

  const response = await db.listRows<Events>("app", "events", queries);

  if (!needsClientFilter) {
    return { rows: response.rows, total: response.total };
  }

  const now = new Date();
  const filtered = response.rows.filter((event) => {
    if (search) {
      const matches = event.translation_refs.some((translation) =>
        translation.title?.toLowerCase().includes(search)
      );
      if (!matches) {
        return false;
      }
    }

    if (timeframe !== "all") {
      if (!event.start_date) {
        return false;
      }
      const startsAt = new Date(event.start_date);
      if (timeframe === "upcoming" && startsAt < now) {
        return false;
      }
      if (timeframe === "past" && startsAt >= now) {
        return false;
      }
    }

    return true;
  });

  const start = (page - 1) * EVENTS_PAGE_SIZE;
  return {
    rows: filtered.slice(start, start + EVENTS_PAGE_SIZE),
    total: filtered.length,
  };
}

export async function getEvent(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Events>("app", "events", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const event = response.rows[0];
  if (!event) {
    return null;
  }

  const translationsResponse = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "event"),
      Query.equal("content_id", id),
      Query.limit(10),
    ]
  );

  return { ...event, translation_refs: translationsResponse.rows };
}

export async function createEvent(values: EventFormValues) {
  const ctx = await requireAuth();
  const validated = eventSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  assertWriteAccess(
    ctx,
    validated.data.campus_id,
    validated.data.department_id
  );

  try {
    const { db } = await createSessionClient();

    const event = await db.createRow("app", "events", ID.unique(), {
      ...buildEventColumns(validated.data),
      status: "draft" as EventStatus,
    });

    await Promise.all([
      upsertEventTranslation(db, event.$id, "no", {
        title: validated.data.title_no,
        description: validated.data.description_no ?? "",
        shortDescription: validated.data.short_description_no ?? null,
      }),
      upsertEventTranslation(db, event.$id, "en", {
        title: validated.data.title_en,
        description: validated.data.description_en ?? "",
        shortDescription: validated.data.short_description_en ?? null,
      }),
    ]);

    await logAuditEvent(ctx, "event.create", {
      resourceId: event.$id,
      resourceType: "event",
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status: "draft",
      },
    });

    // TODO(messaging): if values.notify_push, call messaging.createPush(...)

    revalidatePath("/events");
    return { data: event.$id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create event",
    };
  }
}

export async function updateEvent(id: string, values: EventFormValues) {
  const ctx = await requireAuth();
  const validated = eventSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const { db } = await createSessionClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    assertWriteAccess(ctx, event.campus_id, event.department_id);
    assertWriteAccess(
      ctx,
      validated.data.campus_id,
      validated.data.department_id ?? null
    );

    await db.updateRow("app", "events", id, {
      ...buildEventColumns(validated.data),
      status: validated.data.status,
    });

    await Promise.all([
      upsertEventTranslation(db, id, "no", {
        title: validated.data.title_no,
        description: validated.data.description_no ?? "",
        shortDescription: validated.data.short_description_no ?? null,
      }),
      upsertEventTranslation(db, id, "en", {
        title: validated.data.title_en,
        description: validated.data.description_en ?? "",
        shortDescription: validated.data.short_description_en ?? null,
      }),
    ]);

    await logAuditEvent(ctx, "event.update", {
      resourceId: id,
      resourceType: "event",
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status: validated.data.status,
      },
    });

    // TODO(messaging): if values.notify_push, call messaging.createPush(...)

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update event",
    };
  }
}

export async function deleteEvent(id: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    assertWriteAccess(ctx, event.campus_id, event.department_id);

    const translations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "event"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );

    await Promise.all(
      translations.rows.map((translation) =>
        db.deleteRow("app", "content_translations", translation.$id)
      )
    );
    await db.deleteRow("app", "events", id);

    await logAuditEvent(ctx, "event.delete", {
      resourceId: id,
      resourceType: "event",
    });

    revalidatePath("/events");
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete event",
    };
  }
}

export async function publishEvent(id: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createSessionClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    assertWriteAccess(ctx, event.campus_id, event.department_id);

    await db.updateRow("app", "events", id, {
      status: "published" as EventStatus,
    });

    await logAuditEvent(ctx, "event.update", {
      resourceId: id,
      resourceType: "event",
      payload: { status: "published" },
    });

    // TODO(messaging): if values.notify_push, call messaging.createPush(...)

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to publish event",
    };
  }
}

export async function generateEventNorwegianDraft(input: {
  title_en: string;
  description_en: string;
  short_description_en?: string;
}) {
  await requireAuth();
  const validated = eventTranslationDraftSchema.safeParse(input);
  if (!validated.success) {
    return { error: "Add an English title and description first." };
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: eventTranslationResultSchema,
      prompt: `Translate this event content to Norwegian Bokmål. Return a natural-sounding translation appropriate for Norwegian students.
Keep the tone warm, inviting, and student-facing.
Preserve the simple HTML structure in the description. Only use p, h3, ul and li tags.
Do not add information that is not present in the source.

Title:
${validated.data.title_en}

Teaser:
${validated.data.short_description_en ?? ""}

Description HTML:
${validated.data.description_en}`,
    });

    return { data: object };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate Norwegian draft",
    };
  }
}

export async function suggestEventDescriptionSection(input: {
  current_description: string;
  category?: string;
}) {
  await requireAuth();
  const validated = eventSuggestionDraftSchema.safeParse(input);
  if (!validated.success) {
    return { error: "Provide the current description first." };
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: eventSuggestionResultSchema,
      prompt: `Suggest one useful description section for a student organization event.
The output should be a run-of-show block, schedule, what-to-bring list, or similar helpful section that fits the event category.
Return one short heading and a concise HTML body using only p, h3, ul and li tags.
Do not repeat information already present in the current description.

Category: ${validated.data.category ?? "Any"}
Current description:
${validated.data.current_description}`,
    });

    return { data: object };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to suggest a description section",
    };
  }
}
