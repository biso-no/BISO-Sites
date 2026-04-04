"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  CollectionPricing,
  type ContentTranslations,
  ContentType,
  type EventStatus,
  type Events,
  Locale,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { EVENTS_PAGE_SIZE, type EventFormValues, eventSchema } from "./schemas";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export async function listEvents(opts?: {
  campusId?: string;
  status?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(EVENTS_PAGE_SIZE),
    Query.offset((page - 1) * EVENTS_PAGE_SIZE),
    Query.select(["*", "translation_refs.*"]),
    ...applyScopeQueries(ctx),
  ];

  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<Events>("app", "events", queries);

  return { rows: response.rows, total: response.total };
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

  assertWriteAccess(ctx, validated.data.campus_id);

  const { db } = await createSessionClient();

  const event = await db.upsertRow<Events>("app", "events", "unique()", {
    slug: validated.data.slug,
    status: "draft" as EventStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
    start_date: validated.data.start_date ?? null,
    end_date: validated.data.end_date ?? null,
    location: validated.data.location ?? null,
    image: validated.data.image || null,
    price: validated.data.price ?? null,
    ticket_url: validated.data.ticket_url || null,
    member_only: validated.data.member_only ?? false,
    is_collection: false,
    collection_pricing: CollectionPricing.INDIVIDUAL,
    metadata: null,
    campus: validated.data.campus_id,
    department: validated.data.department_id ?? null,
    translation_refs: [
      {
        content_id: "", // Placeholder, will be created after event
        content_type: ContentType.EVENT,
        locale: Locale.NO,
        title: validated.data.title_no,
        description: validated.data.description_no ?? "",
        additional_fields: null,
      },
      {
        content_id: "", // Placeholder, will be created after event
        content_type: ContentType.EVENT,
        locale: Locale.EN,
        title: validated.data.title_en,
        description: validated.data.description_en ?? "",
        additional_fields: null,
      },
    ],
  });

  for (const locale of ["no", "en"] as const) {
    await db.createRow("app", "content_translations", "unique()", {
      content_id: event.$id,
      content_type: "event",
      locale,
      title:
        locale === "no" ? validated.data.title_no : validated.data.title_en,
      description:
        locale === "no"
          ? (validated.data.description_no ?? "")
          : (validated.data.description_en ?? ""),
    });
  }

  void logAuditEvent(ctx, "event_created", {
    resourceId: event.$id,
    resourceType: "event",
  });
  revalidatePath("/admin/events");
  return { data: event.$id };
}

export async function updateEvent(id: string, values: EventFormValues) {
  const ctx = await requireAuth();
  const validated = eventSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

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
    slug: validated.data.slug,
    status: validated.data.status as EventStatus,
    campus_id: validated.data.campus_id,
    department_id: validated.data.department_id ?? null,
    start_date: validated.data.start_date ?? null,
    end_date: validated.data.end_date ?? null,
    location: validated.data.location ?? null,
    image: validated.data.image || null,
    price: validated.data.price ?? null,
    ticket_url: validated.data.ticket_url || null,
    member_only: validated.data.member_only ?? false,
  });

  for (const locale of ["no", "en"] as const) {
    const existingTranslation = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "event"),
        Query.equal("content_id", id),
        Query.equal("locale", locale),
        Query.limit(1),
      ]
    );

    const translationData = {
      content_id: id,
      content_type: "event",
      locale,
      title:
        locale === "no" ? validated.data.title_no : validated.data.title_en,
      description:
        locale === "no"
          ? (validated.data.description_no ?? "")
          : (validated.data.description_en ?? ""),
    };

    if (existingTranslation.rows[0]) {
      await db.updateRow(
        "app",
        "content_translations",
        existingTranslation.rows[0].$id,
        translationData
      );
    } else {
      await db.createRow(
        "app",
        "content_translations",
        "unique()",
        translationData
      );
    }
  }

  void logAuditEvent(ctx, "event_updated", {
    resourceId: id,
    resourceType: "event",
    payload: { status: validated.data.status },
  });
  revalidatePath("/admin/events");
  revalidatePath(`/admin/events/${id}`);
  return { data: id };
}

export async function deleteEvent(id: string) {
  const ctx = await requireAuth();
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

  const translations = await db.listRows("app", "content_translations", [
    Query.equal("content_type", "event"),
    Query.equal("content_id", id),
  ]);
  await Promise.all(
    translations.rows.map((t) =>
      db.deleteRow("app", "content_translations", t.$id)
    )
  );
  await db.deleteRow("app", "events", id);

  void logAuditEvent(ctx, "event_deleted", {
    resourceId: id,
    resourceType: "event",
  });
  revalidatePath("/admin/events");
  return { data: true };
}
