"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import {
  type ContentTranslations,
  type Events,
  type EventsCategory,
  EventsCollectionPricing,
  type EventsStatus,
} from "@repo/api/types/appwrite";

const EVENTS_PUSH_TOPIC_ID = "events";

import type { Announcements } from "@repo/api/types/appwrite";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dispatchAnnouncement } from "@/lib/announcements/send";
import { requireAuth } from "@/lib/authorization";
import {
  type AutoTranslationOptions,
  type ContentLocale,
  getTargetLocale,
  isCurrentTranslationSource,
} from "@/lib/content-translation";
import {
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import { loadRecruitmentLookups } from "@/lib/recruitment";
import {
  buildContentRowPermissions,
  buildContentTranslationPermissions,
  deriveContentRowTeams,
} from "@/lib/utils";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { EVENTS_PAGE_SIZE, type EventFormValues, eventSchema } from "./schemas";

type SessionDb = Awaited<ReturnType<typeof createSessionClient>>["db"];
type EventAuthContext = Awaited<ReturnType<typeof requireAuth>>;

const eventTranslationDraftSchema = z
  .object({
    campusId: z.string().trim().min(1),
    description: z.string().trim(),
    departmentId: z.string().trim().nullable().optional(),
    shortDescription: z.string().trim().nullable().optional(),
    sourceLocale: z.enum(["no", "en"]),
    title: z.string().trim(),
  })
  .refine(
    (value) =>
      Boolean(
        value.title || value.description || value.shortDescription?.trim()
      ),
    "Add source content first."
  );

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

interface EventTranslationSnapshot {
  description: string;
  short_description: string;
  title: string;
}

/**
 * Send a published-event push through the unified announcement delivery path.
 * Creates a transient `announcement` row (category "event", topic audience on
 * the "events" topic) and dispatches it. Resilient by design: any failure is
 * logged and never blocks publishing.
 */
async function sendEventAnnouncement(input: {
  eventId: string;
  titleEn: string;
  titleNo: string | null;
  bodyEn: string | null;
  bodyNo: string | null;
  campusId: string | null;
}): Promise<void> {
  try {
    const { db, messaging, users } = await createAdminClient();
    const deepLink = `biso://event?id=${input.eventId}`;
    const announcement = await db.createRow(
      "app",
      "announcements",
      ID.unique(),
      {
        status: "sent",
        category: "event",
        audience_type: "topic",
        audience_value: EVENTS_PUSH_TOPIC_ID,
        title_en: input.titleEn,
        title_no: input.titleNo,
        body_en: input.bodyEn,
        body_no: input.bodyNo,
        event_id: input.eventId,
        campus_id: input.campusId,
        deep_link: deepLink,
        push: true,
        sent_at: new Date().toISOString(),
      }
    );

    await dispatchAnnouncement(announcement as unknown as Announcements, {
      db,
      messaging,
      users,
    });
  } catch (error) {
    console.error("Failed to send event push notification:", error);
  }
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
  },
  permissions: string[]
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
      data,
      permissions
    );
    return;
  }

  await db.createRow(
    "app",
    "content_translations",
    ID.unique(),
    data,
    permissions
  );
}

function getEventTranslationSnapshot(
  values: EventFormValues,
  locale: ContentLocale
): EventTranslationSnapshot {
  if (locale === "no") {
    return {
      description: values.description_no ?? "",
      short_description: values.short_description_no ?? "",
      title: values.title_no,
    };
  }
  return {
    description: values.description_en ?? "",
    short_description: values.short_description_en ?? "",
    title: values.title_en,
  };
}

async function translateEventSnapshot(
  source: EventTranslationSnapshot,
  sourceLocale: ContentLocale
): Promise<EventTranslationSnapshot> {
  const translated = await translateContentFields({
    contentType: "event",
    fields: [
      { format: "plain", key: "title", value: source.title },
      {
        format: "plain",
        key: "short_description",
        value: source.short_description,
      },
      { format: "html", key: "description", value: source.description },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    description: translated.description ?? "",
    short_description: translated.short_description ?? "",
    title: translated.title ?? "",
  };
}

function scheduleEventTranslation(input: {
  campusId: string | null;
  departmentId: string | null;
  enabled: boolean;
  eventId: string;
  memberOnly: boolean;
  source: EventTranslationSnapshot;
  sourceLocale: ContentLocale;
  status: string;
}): boolean {
  const hasSource = Boolean(input.source.title.trim());
  if (!(input.enabled && hasSource)) {
    return false;
  }
  return scheduleContentTranslation({
    enabled: true,
    task: async () => {
      const translated = await translateEventSnapshot(
        input.source,
        input.sourceLocale
      );
      const { db } = await createAdminClient();
      const currentEvent = await db.getRow<Events>(
        "app",
        "events",
        input.eventId
      );
      if (
        !isCurrentTranslationSource(
          {
            campusId: input.campusId,
            departmentId: input.departmentId,
            memberOnly: input.memberOnly,
            status: input.status,
          },
          {
            campusId: currentEvent.campus_id,
            departmentId: currentEvent.department_id ?? null,
            memberOnly: currentEvent.member_only,
            status: currentEvent.status,
          }
        )
      ) {
        return;
      }
      const sourceRows = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "event"),
          Query.equal("content_id", input.eventId),
          Query.equal("locale", input.sourceLocale),
          Query.limit(1),
        ]
      );
      const currentSource = sourceRows.rows[0];
      if (!currentSource) {
        return;
      }
      const currentSnapshot: EventTranslationSnapshot = {
        description: currentSource.description ?? "",
        short_description: currentSource.short_description ?? "",
        title: currentSource.title ?? "",
      };
      if (!isCurrentTranslationSource(input.source, currentSnapshot)) {
        return;
      }
      const { translationPermissions } = await buildEventPermissions(db, {
        campusId: input.campusId,
        departmentId: input.departmentId,
        memberOnly: input.memberOnly,
        status: input.status,
      });
      await upsertEventTranslation(
        db,
        input.eventId,
        getTargetLocale(input.sourceLocale),
        {
          description: translated.description,
          shortDescription: translated.short_description || null,
          title: translated.title,
        },
        translationPermissions
      );
    },
  });
}

function scheduleEventFormTranslation(
  eventId: string,
  values: EventFormValues,
  status: string,
  autoTranslation?: AutoTranslationOptions
): boolean {
  const sourceLocale = autoTranslation?.sourceLocale ?? "en";
  return scheduleEventTranslation({
    campusId: values.campus_id,
    departmentId: values.department_id ?? null,
    enabled: autoTranslation?.enabled ?? false,
    eventId,
    memberOnly: values.member_only,
    source: getEventTranslationSnapshot(values, sourceLocale),
    sourceLocale,
    status,
  });
}

function assertEventPublishTransitionAccess(
  ctx: EventAuthContext,
  event: Events,
  values: EventFormValues
): void {
  if (event.status !== "published" && values.status !== "published") {
    return;
  }
  assertPublishAccess(ctx, event.campus_id);
  assertPublishAccess(ctx, values.campus_id);
}

/**
 * Compute the row and translation $permissions for an event from its status,
 * member-only flag, and owning campus/department. Loads recruitment lookups
 * to derive team IDs.
 */
async function buildEventPermissions(
  db: SessionDb,
  opts: {
    status: string;
    memberOnly: boolean;
    campusId: string | null;
    departmentId: string | null;
  }
): Promise<{ rowPermissions: string[]; translationPermissions: string[] }> {
  const lookups = await loadRecruitmentLookups(db);
  const audience = opts.memberOnly ? "members" : "public";
  const { campusTeam, deptTeam } = deriveContentRowTeams(lookups, {
    campus_id: opts.campusId,
    department_id: opts.departmentId,
  });
  return {
    rowPermissions: buildContentRowPermissions({
      status: opts.status,
      audience,
      campusTeam,
      deptTeam,
    }),
    translationPermissions: buildContentTranslationPermissions({
      audience,
      status: opts.status,
      writeTeams: deptTeam ? [deptTeam] : [],
      readTeams: campusTeam ? [campusTeam] : [],
    }),
  };
}

function buildEventColumns(values: EventFormValues): Record<string, unknown> {
  return {
    slug: values.slug,
    campus_id: values.campus_id,
    department_id: values.department_id ?? null,
    category: (values.category ?? null) as EventsCategory | null,
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
    collection_pricing: EventsCollectionPricing.INDIVIDUAL,
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
    // events has a campus_id but no department_id column.
    ...applyScopeQueries(ctx, { departmentField: null }),
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
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Events>("app", "events", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const event = response.rows[0];
  // Treat a row outside the caller's campus/department scope as not found.
  if (!(event && hasRowAccess(ctx, event.campus_id, event.department_id))) {
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

export async function createEvent(
  values: EventFormValues,
  autoTranslation?: AutoTranslationOptions
) {
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
  if (validated.data.status === "published") {
    assertPublishAccess(ctx, validated.data.campus_id);
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createSessionClient();

    const status = validated.data.status;
    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status,
        memberOnly: validated.data.member_only,
        campusId: validated.data.campus_id,
        departmentId: validated.data.department_id ?? null,
      });

    const event = await db.createRow(
      "app",
      "events",
      ID.unique(),
      {
        ...buildEventColumns(validated.data),
        status: status as EventsStatus,
      },
      rowPermissions
    );

    await Promise.all([
      upsertEventTranslation(
        db,
        event.$id,
        "no",
        {
          title: validated.data.title_no,
          description: validated.data.description_no ?? "",
          shortDescription: validated.data.short_description_no ?? null,
        },
        translationPermissions
      ),
      upsertEventTranslation(
        db,
        event.$id,
        "en",
        {
          title: validated.data.title_en,
          description: validated.data.description_en ?? "",
          shortDescription: validated.data.short_description_en ?? null,
        },
        translationPermissions
      ),
    ]);

    const translationQueued = scheduleEventFormTranslation(
      event.$id,
      validated.data,
      status,
      translationOptions
    );

    await logAuditEvent(ctx, "event.create", {
      resourceId: event.$id,
      resourceType: "event",
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status,
      },
    });

    if (status === "published" && validated.data.notify_push) {
      await sendEventAnnouncement({
        bodyEn: validated.data.short_description_en ?? null,
        bodyNo: validated.data.short_description_no ?? null,
        campusId: validated.data.campus_id ?? null,
        eventId: event.$id,
        titleEn: validated.data.title_en,
        titleNo: validated.data.title_no || null,
      });
    }

    revalidatePath("/events");
    return {
      data: event.$id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create event",
    };
  }
}

export async function updateEvent(
  id: string,
  values: EventFormValues,
  autoTranslation?: AutoTranslationOptions
) {
  const ctx = await requireAuth();
  const validated = eventSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
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
    assertEventPublishTransitionAccess(ctx, event, validated.data);

    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status: validated.data.status,
        memberOnly: validated.data.member_only,
        campusId: validated.data.campus_id,
        departmentId: validated.data.department_id ?? null,
      });

    await db.updateRow(
      "app",
      "events",
      id,
      {
        ...buildEventColumns(validated.data),
        status: validated.data.status,
      },
      rowPermissions
    );

    await Promise.all([
      upsertEventTranslation(
        db,
        id,
        "no",
        {
          title: validated.data.title_no,
          description: validated.data.description_no ?? "",
          shortDescription: validated.data.short_description_no ?? null,
        },
        translationPermissions
      ),
      upsertEventTranslation(
        db,
        id,
        "en",
        {
          title: validated.data.title_en,
          description: validated.data.description_en ?? "",
          shortDescription: validated.data.short_description_en ?? null,
        },
        translationPermissions
      ),
    ]);

    const translationQueued = scheduleEventFormTranslation(
      id,
      validated.data,
      validated.data.status,
      translationOptions
    );

    await logAuditEvent(ctx, "event.update", {
      resourceId: id,
      resourceType: "event",
      payload: {
        campus_id: validated.data.campus_id,
        department_id: validated.data.department_id ?? null,
        status: validated.data.status,
      },
    });

    if (validated.data.status === "published" && validated.data.notify_push) {
      await sendEventAnnouncement({
        eventId: id,
        titleEn: validated.data.title_en,
        titleNo: validated.data.title_no || null,
        bodyEn: validated.data.short_description_en ?? null,
        bodyNo: validated.data.short_description_no ?? null,
        campusId: validated.data.campus_id ?? null,
      });
    }

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return {
      data: id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
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

    assertPublishAccess(ctx, event.campus_id);

    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status: "published",
        memberOnly: event.member_only,
        campusId: event.campus_id,
        departmentId: event.department_id ?? null,
      });

    await db.updateRow(
      "app",
      "events",
      id,
      {
        status: "published" as EventsStatus,
      },
      rowPermissions
    );

    const publishTranslations = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "event"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );
    await Promise.all(
      publishTranslations.rows.map((translation) =>
        db.updateRow(
          "app",
          "content_translations",
          translation.$id,
          {},
          translationPermissions
        )
      )
    );

    await logAuditEvent(ctx, "event.update", {
      resourceId: id,
      resourceType: "event",
      payload: { status: "published" },
    });

    if (event.notify_push) {
      const translationsResult = await db.listRows<ContentTranslations>(
        "app",
        "content_translations",
        [
          Query.equal("content_type", "event"),
          Query.equal("content_id", id),
          Query.limit(2),
        ]
      );
      const enTranslation = translationsResult.rows.find(
        (row) => row.locale === "en"
      );
      const noTranslation = translationsResult.rows.find(
        (row) => row.locale === "no"
      );

      await sendEventAnnouncement({
        eventId: id,
        titleEn: enTranslation?.title ?? event.slug ?? "New Event",
        titleNo: noTranslation?.title ?? null,
        bodyEn: enTranslation?.short_description ?? null,
        bodyNo: noTranslation?.short_description ?? null,
        campusId: event.campus_id ?? null,
      });
    }

    revalidatePath("/events");
    revalidatePath(`/events/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to publish event",
    };
  }
}

export async function generateEventTranslationDraft(input: {
  campusId: string;
  description: string;
  departmentId?: string | null;
  shortDescription?: string | null;
  sourceLocale: ContentLocale;
  title: string;
}) {
  const ctx = await requireAuth();
  const validated = eventTranslationDraftSchema.safeParse(input);
  if (!validated.success) {
    return { error: "Add source content first." };
  }

  try {
    assertWriteAccess(
      ctx,
      validated.data.campusId,
      validated.data.departmentId ?? null
    );
    const translated = await translateEventSnapshot(
      {
        description: validated.data.description,
        short_description: validated.data.shortDescription ?? "",
        title: validated.data.title,
      },
      validated.data.sourceLocale
    );
    if (getTargetLocale(validated.data.sourceLocale) === "en") {
      return {
        data: {
          description_en: translated.description,
          short_description_en: translated.short_description,
          title_en: translated.title,
        },
      };
    }
    return {
      data: {
        description_no: translated.description,
        short_description_no: translated.short_description,
        title_no: translated.title,
      },
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate translation draft",
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
