"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
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
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
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
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { EVENTS_PAGE_SIZE, type EventFormValues, eventSchema } from "./schemas";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type EventAuthContext = Awaited<ReturnType<typeof requireAuth>>;

type EventWithTranslations = Events & {
  translation_refs?: ContentTranslations[] | null;
};

const EVENT_RELATIONSHIP_SELECT = Query.select([
  "*",
  "campus.$id",
  "department.$id",
  "translation_refs.*",
]);

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
        campus: input.campusId,
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

interface NestedEventTranslation {
  $id?: string;
  $permissions: string[];
  additional_fields: string | null;
  content_id: string;
  content_type: "event";
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

/**
 * Nested relationship children for the event upsert: an existing `$id` makes
 * Appwrite update-and-keep that child, omitting it creates and links a new
 * one. Explicit `$permissions` avoid relying on permission inheritance.
 */
function buildNestedEventTranslation(
  eventId: string,
  locale: ContentLocale,
  values: EventFormValues,
  existingByLocale: Map<string, ContentTranslations>,
  permissions: string[]
): NestedEventTranslation {
  const snapshot = getEventTranslationSnapshot(values, locale);
  const existing = existingByLocale.get(locale);
  return {
    ...(existing ? { $id: existing.$id } : {}),
    $permissions: permissions,
    additional_fields: serializeAdditionalFields({
      short_description: snapshot.short_description || null,
    }),
    content_id: eventId,
    content_type: "event",
    description: snapshot.description,
    locale,
    short_description: snapshot.short_description || null,
    title: snapshot.title,
  };
}

/**
 * Existing locales are looked up by content metadata, not the relation: rows
 * that predate the relationship backfill are unlinked, and matching them here
 * both prevents duplicate locale rows and re-links them on the next save.
 */
async function loadEventTranslationsByLocale(
  db: AdminDb,
  eventId: string
): Promise<Map<string, ContentTranslations>> {
  const current = await db.listRows<ContentTranslations>(
    "app",
    "content_translations",
    [
      Query.equal("content_type", "event"),
      Query.equal("content_id", eventId),
      Query.limit(10),
    ]
  );
  return new Map(
    current.rows.map((translation) => [translation.locale, translation])
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
  /** The target locale as this save left it — see the stale check below. */
  destination: EventTranslationSnapshot;
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
      // Fresh admin client: the request that scheduled this callback is done.
      const { db } = await createAdminClient();
      const currentEvent = await db.getRow<EventWithTranslations>(
        "app",
        "events",
        input.eventId,
        [EVENT_RELATIONSHIP_SELECT]
      );
      const ownership = getContentOwnership(currentEvent, {
        legacyFallback: true,
      });
      if (
        !isCurrentTranslationSource(
          {
            campusId: input.campusId,
            departmentId: input.departmentId,
            memberOnly: input.memberOnly,
            status: input.status,
          },
          {
            campusId: ownership.campus,
            departmentId: ownership.department,
            memberOnly: currentEvent.member_only,
            status: currentEvent.status,
          }
        )
      ) {
        return;
      }
      // The synchronous save linked the source locale before scheduling, so
      // the parent relation is the authoritative read path here.
      const currentTranslations = currentEvent.translation_refs ?? [];
      const currentSource = currentTranslations.find(
        (translation) => translation.locale === input.sourceLocale
      );
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

      const targetLocale = getTargetLocale(input.sourceLocale);
      const currentTarget = currentTranslations.find(
        (translation) => translation.locale === targetLocale
      );
      // The destination is only ours to overwrite while it still holds exactly
      // what this save wrote. An editor who translated the other locale by hand
      // while the model request was in flight owns the newer text.
      if (
        !isCurrentTranslationSource(input.destination, {
          description: currentTarget?.description ?? "",
          short_description: currentTarget?.short_description ?? "",
          title: currentTarget?.title ?? "",
        })
      ) {
        return;
      }
      const data = {
        additional_fields: serializeAdditionalFields({
          short_description: translated.short_description || null,
        }),
        content_id: input.eventId,
        content_type: "event",
        description: translated.description,
        locale: targetLocale,
        short_description: translated.short_description || null,
        title: translated.title,
      };
      if (currentTarget) {
        await db.updateRow(
          "app",
          "content_translations",
          currentTarget.$id,
          data,
          translationPermissions
        );
        return;
      }
      await db.createRow(
        "app",
        "content_translations",
        ID.unique(),
        // A fresh destination row must arrive already related to its parent.
        { ...data, event_ref: input.eventId },
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
    destination: getEventTranslationSnapshot(
      values,
      getTargetLocale(sourceLocale)
    ),
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
  const persisted = getContentOwnership(event, { legacyFallback: true });
  assertPublishAccess(ctx, persisted.campus, persisted.department);
  assertPublishAccess(ctx, values.campus_id, values.department_id ?? null);
}

/**
 * Compute the row and translation $permissions for an event from its status,
 * member-only flag, and owning campus/department. Loads recruitment lookups
 * to derive team IDs.
 */
async function buildEventPermissions(
  db: AdminDb,
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
    // Canonical ownership relationships; the scalar columns remain as
    // migration-era compatibility metadata only.
    campus: values.campus_id,
    campus_id: values.campus_id,
    department: values.department_id ?? null,
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

function buildEventTranslationChildren(
  eventId: string,
  values: EventFormValues,
  existingByLocale: Map<string, ContentTranslations>,
  permissions: string[]
): NestedEventTranslation[] {
  return (["no", "en"] as const).map((locale) =>
    buildNestedEventTranslation(
      eventId,
      locale,
      values,
      existingByLocale,
      permissions
    )
  );
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
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);
  const search = opts?.search?.trim().toLowerCase() ?? "";
  const timeframe = opts?.timeframe ?? "all";

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.select(["*", "translation_refs.*"]),
    ...applyContentRelationshipScopeQueries(ctx),
  ];

  if (opts?.campusId) {
    queries.push(Query.equal("campus.$id", opts.campusId));
  }

  if (opts?.departmentId) {
    queries.push(Query.equal("department.$id", opts.departmentId));
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
  const { db } = await createAdminClient();

  const response = await db.listRows<Events>("app", "events", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const event = response.rows[0];
  if (!event) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(event, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
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

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createAdminClient();
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    if (validated.data.status === "published") {
      assertPublishAccess(
        ctx,
        validated.data.campus_id,
        validated.data.department_id ?? null
      );
    }

    const status = validated.data.status;
    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status,
        memberOnly: validated.data.member_only,
        campusId: validated.data.campus_id,
        departmentId: validated.data.department_id ?? null,
      });

    const eventId = ID.unique();
    const event = await db.upsertRow(
      "app",
      "events",
      eventId,
      {
        ...buildEventColumns(validated.data),
        status: status as EventsStatus,
        translation_refs: buildEventTranslationChildren(
          eventId,
          validated.data,
          new Map(),
          translationPermissions
        ),
      },
      rowPermissions
    );

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
    const { db } = await createAdminClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    // Authorize both the persisted scope and the requested scope so ownership
    // transfers require access on each side.
    const persisted = getContentOwnership(event, { legacyFallback: true });
    assertWriteAccess(ctx, persisted.campus, persisted.department);
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: false,
      campusId: validated.data.campus_id,
      departmentId: validated.data.department_id ?? null,
    });
    assertEventPublishTransitionAccess(ctx, event, validated.data);

    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status: validated.data.status,
        memberOnly: validated.data.member_only,
        campusId: validated.data.campus_id,
        departmentId: validated.data.department_id ?? null,
      });

    const existingByLocale = await loadEventTranslationsByLocale(db, id);
    await db.upsertRow(
      "app",
      "events",
      id,
      {
        ...buildEventColumns(validated.data),
        status: validated.data.status,
        translation_refs: buildEventTranslationChildren(
          id,
          validated.data,
          existingByLocale,
          translationPermissions
        ),
      },
      rowPermissions
    );

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
    const { db } = await createAdminClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    const ownership = getContentOwnership(event, { legacyFallback: true });
    assertWriteAccess(ctx, ownership.campus, ownership.department);

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
    const { db } = await createAdminClient();

    const existing = await db.listRows<Events>("app", "events", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const event = existing.rows[0];
    if (!event) {
      return { error: "Event not found" };
    }

    const ownership = getContentOwnership(event, { legacyFallback: true });
    assertPublishAccess(ctx, ownership.campus, ownership.department);

    const { rowPermissions, translationPermissions } =
      await buildEventPermissions(db, {
        status: "published",
        memberOnly: event.member_only,
        campusId: ownership.campus,
        departmentId: ownership.department,
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
      const enTranslation = publishTranslations.rows.find(
        (row) => row.locale === "en"
      );
      const noTranslation = publishTranslations.rows.find(
        (row) => row.locale === "no"
      );

      await sendEventAnnouncement({
        eventId: id,
        titleEn: enTranslation?.title ?? event.slug ?? "New Event",
        titleNo: noTranslation?.title ?? null,
        bodyEn: enTranslation?.short_description ?? null,
        bodyNo: noTranslation?.short_description ?? null,
        campusId: ownership.campus,
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
