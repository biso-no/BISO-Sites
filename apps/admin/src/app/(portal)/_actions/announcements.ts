"use server";

import { openai } from "@ai-sdk/openai";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Announcements } from "@repo/api/types/appwrite";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildDeepLink, dispatchAnnouncement } from "@/lib/announcements/send";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import {
  ANNOUNCEMENTS_PAGE_SIZE,
  type AnnouncementFormValues,
  announcementSchema,
} from "./schemas";

const EMAIL_PATTERN = /@/;

const announcementTranslationDraftSchema = z.object({
  title_en: z.string().trim().min(1),
  body_en: z.string().trim().optional().default(""),
});

const announcementTranslationResultSchema = z.object({
  title_no: z.string().describe("Norwegian Bokmål announcement title"),
  body_no: z
    .string()
    .describe(
      "Natural Norwegian Bokmål HTML preserving p, h3, ul, li, strong and em tags"
    ),
});

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

function buildDataPayload(announcement: Announcements): string {
  return JSON.stringify({
    type: "announcement",
    announcement_id: announcement.$id,
    event_id: announcement.event_id ?? "",
    segment_id:
      announcement.audience_type === "segment"
        ? (announcement.audience_value ?? "")
        : "",
    deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    category: announcement.category ?? "general",
  });
}

/**
 * For "users" audiences, the editor may submit a comma-separated mix of user
 * ids and emails. Resolve emails to Appwrite user ids (best-effort) and store
 * the result as a JSON array of ids in `audience_value`.
 */
async function normalizeAudienceValue(
  audienceType: string,
  rawValue: string | null | undefined
): Promise<string | null> {
  if (audienceType !== "users") {
    return rawValue ?? null;
  }

  const tokens = (rawValue ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return JSON.stringify([]);
  }

  const emails = tokens.filter((token) => EMAIL_PATTERN.test(token));
  const ids = tokens.filter((token) => !EMAIL_PATTERN.test(token));

  if (emails.length > 0) {
    try {
      const { users } = await createAdminClient();
      await Promise.all(
        emails.map(async (email) => {
          // `search` is fuzzy — require an exact email match before targeting.
          const found = await users.list([Query.limit(5)], email);
          const user = found.users.find(
            (candidate) =>
              candidate.email?.toLowerCase() === email.toLowerCase()
          );
          if (user) {
            ids.push(user.$id);
          }
        })
      );
    } catch (error) {
      console.error("Failed to resolve announcement recipient emails:", error);
    }
  }

  return JSON.stringify(Array.from(new Set(ids)));
}

function buildAnnouncementColumns(
  values: AnnouncementFormValues,
  audienceValue: string | null
): Record<string, unknown> {
  return {
    title_en: values.title_en,
    title_no: values.title_no ?? null,
    body_en: values.body_en ?? null,
    body_no: values.body_no ?? null,
    category: values.category,
    audience_type: values.audience_type,
    audience_value: audienceValue,
    event_id: values.event_id || null,
    campus_id: values.campus_id || null,
    push: values.push,
    scheduled_at: values.scheduled_at || null,
    deep_link: values.event_id ? `biso://event?id=${values.event_id}` : null,
  };
}

export async function listAnnouncements(opts?: {
  status?: string;
  campusId?: string;
  page?: number;
}) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    ...applyScopeQueries(ctx),
    Query.limit(ANNOUNCEMENTS_PAGE_SIZE),
    Query.offset((page - 1) * ANNOUNCEMENTS_PAGE_SIZE),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }
  if (opts?.campusId) {
    queries.push(Query.equal("campus_id", opts.campusId));
  }

  const response = await db.listRows<Announcements>(
    "app",
    "announcements",
    queries
  );
  return { rows: response.rows, total: response.total };
}

export async function getAnnouncement(id: string) {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const response = await db.listRows<Announcements>("app", "announcements", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const announcement = response.rows[0];
  if (!(announcement && hasRowAccess(ctx, announcement.campus_id))) {
    return null;
  }
  return announcement;
}

export async function createAnnouncement(values: AnnouncementFormValues) {
  const ctx = await requireAuth();
  const validated = announcementSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  // Global admins may target a null (app-wide) campus; otherwise require write
  // access to the chosen campus.
  if (validated.data.campus_id) {
    assertWriteAccess(ctx, validated.data.campus_id);
  } else if (!ctx.roles.includes("globaladmin")) {
    return { error: "A campus is required for non-global admins." };
  }

  try {
    const { db } = await createAdminClient();
    const audienceValue = await normalizeAudienceValue(
      validated.data.audience_type,
      validated.data.audience_value
    );

    const announcement = await db.createRow(
      "app",
      "announcements",
      ID.unique(),
      {
        ...buildAnnouncementColumns(validated.data, audienceValue),
        status: "draft",
        created_by: ctx.userId,
      }
    );

    await logAuditEvent(ctx, "announcement.create", {
      resourceId: announcement.$id,
      resourceType: "announcement",
      payload: {
        campus_id: validated.data.campus_id ?? null,
        audience_type: validated.data.audience_type,
        category: validated.data.category,
      },
    });

    revalidatePath("/communications");
    return { data: announcement.$id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create announcement",
    };
  }
}

export async function updateAnnouncement(
  id: string,
  values: AnnouncementFormValues
) {
  const ctx = await requireAuth();
  const validated = announcementSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const { db } = await createAdminClient();
    const existing = await db.listRows<Announcements>("app", "announcements", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const announcement = existing.rows[0];
    if (!announcement) {
      return { error: "Announcement not found" };
    }

    assertWriteAccess(ctx, announcement.campus_id);
    if (validated.data.campus_id) {
      assertWriteAccess(ctx, validated.data.campus_id);
    }

    const audienceValue = await normalizeAudienceValue(
      validated.data.audience_type,
      validated.data.audience_value
    );

    await db.updateRow(
      "app",
      "announcements",
      id,
      buildAnnouncementColumns(validated.data, audienceValue)
    );

    await logAuditEvent(ctx, "announcement.update", {
      resourceId: id,
      resourceType: "announcement",
      payload: {
        campus_id: validated.data.campus_id ?? null,
        audience_type: validated.data.audience_type,
      },
    });

    revalidatePath("/communications");
    revalidatePath(`/communications/${id}`);
    return { data: id };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to update announcement",
    };
  }
}

export async function deleteAnnouncement(id: string) {
  const ctx = await requireAuth();

  try {
    const { db } = await createAdminClient();
    const existing = await db.listRows<Announcements>("app", "announcements", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const announcement = existing.rows[0];
    if (!announcement) {
      return { error: "Announcement not found" };
    }

    assertWriteAccess(ctx, announcement.campus_id);

    await db.deleteRow("app", "announcements", id);

    await logAuditEvent(ctx, "announcement.delete", {
      resourceId: id,
      resourceType: "announcement",
    });

    revalidatePath("/communications");
    return { data: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete announcement",
    };
  }
}

export async function sendAnnouncement(id: string) {
  const ctx = await requireAuth();

  try {
    // Announcements use row security; admin operations go through the
    // service-key client (authorization enforced here via assertPublishAccess).
    const { db, messaging, users } = await createAdminClient();
    const existing = await db.listRows<Announcements>("app", "announcements", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const announcement = existing.rows[0];
    if (!announcement) {
      return { error: "Announcement not found" };
    }

    // Sending is a publish-grade action: require campus/global admin.
    assertPublishAccess(ctx, announcement.campus_id);

    // Future-dated: just mark as scheduled. The scheduled-dispatch cron sends it.
    if (
      announcement.scheduled_at &&
      new Date(announcement.scheduled_at).getTime() > Date.now()
    ) {
      await db.updateRow("app", "announcements", id, {
        status: "scheduled",
      });
      await logAuditEvent(ctx, "announcement.schedule", {
        resourceId: id,
        resourceType: "announcement",
        payload: { scheduled_at: announcement.scheduled_at },
      });
      revalidatePath("/communications");
      return { data: { status: "scheduled" as const } };
    }

    // Persist the data payload contract on the row before dispatch so the
    // helper and downstream consumers read a consistent value.
    const dataPayload = buildDataPayload(announcement);
    const enriched: Announcements = {
      ...announcement,
      data: dataPayload,
      deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    };

    let recipients = 0;
    try {
      const result = await dispatchAnnouncement(enriched, {
        db,
        messaging,
        users,
      });
      recipients = result.recipients;
    } catch (error) {
      console.error("Failed to dispatch announcement:", error);
      await db.updateRow("app", "announcements", id, {
        status: "failed",
        data: dataPayload,
      });
      return { error: "Failed to send announcement" };
    }

    await db.updateRow("app", "announcements", id, {
      status: "sent",
      sent_at: new Date().toISOString(),
      data: dataPayload,
      deep_link: enriched.deep_link,
    });

    await logAuditEvent(ctx, "announcement.send", {
      resourceId: id,
      resourceType: "announcement",
      payload: {
        audience_type: announcement.audience_type,
        recipients,
      },
    });

    revalidatePath("/communications");
    revalidatePath(`/communications/${id}`);
    return { data: { status: "sent" as const, recipients } };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to send announcement",
    };
  }
}

export async function generateAnnouncementNorwegianDraft(input: {
  title_en: string;
  body_en?: string;
}) {
  await requireAuth();
  const validated = announcementTranslationDraftSchema.safeParse(input);
  if (!validated.success) {
    return { error: "Add an English title first." };
  }

  try {
    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: announcementTranslationResultSchema,
      prompt: `Translate this push announcement to Norwegian Bokmål. Return a natural-sounding translation appropriate for Norwegian students.
Keep the tone clear, concise, and student-facing.
Preserve the simple HTML structure in the body. Only use p, h3, ul, li, strong and em tags.
Do not add information that is not present in the source.

Title:
${validated.data.title_en}

Body HTML:
${validated.data.body_en}`,
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
