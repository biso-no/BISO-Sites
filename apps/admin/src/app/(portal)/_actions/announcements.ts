"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Announcements } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { buildDeepLink, dispatchAnnouncement } from "@/lib/announcements/send";
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
  contentLocaleSchema,
  parseAutoTranslationOptions,
  scheduleContentTranslation,
  translateContentFields,
} from "@/lib/content-translation.server";
import {
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
const TRANSLATION_PENDING_KEY = "translation_pending";

interface AnnouncementTranslationSnapshot {
  body: string;
  title: string;
}

interface AnnouncementDeliverySnapshot {
  audienceType: string;
  audienceValue: string | null;
  campusId: string | null;
  category: string;
  deepLink: string | null;
  departmentId: string | null;
  eventId: string | null;
  push: boolean;
  scheduledAt: string | null;
  status: string;
}

interface AnnouncementDeliveryClaim {
  snapshot: AnnouncementDeliverySnapshot;
  token: string;
}

type AnnouncementTranslationDraftInput = AnnouncementTranslationSnapshot & {
  campusId: string | null;
  sourceLocale: ContentLocale;
};

type AnnouncementAdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type AnnouncementMutationResult =
  | {
      data: string;
      error?: undefined;
      translationQueued?: true;
    }
  | {
      data?: undefined;
      error: string | Record<string, string[] | undefined>;
      translationQueued?: undefined;
    };

type SendAnnouncementResult =
  | {
      data: {
        recipients?: number;
        status: "queued" | "scheduled" | "sent";
      };
      error?: undefined;
      translationQueued?: true;
    }
  | {
      data?: undefined;
      error: string;
      translationQueued?: undefined;
    };

const getAnnouncementTranslationSnapshot = (
  announcement: Pick<
    Announcements,
    "body_en" | "body_no" | "title_en" | "title_no"
  >,
  sourceLocale: ContentLocale
): AnnouncementTranslationSnapshot =>
  sourceLocale === "no"
    ? {
        body: announcement.body_no ?? "",
        title: announcement.title_no ?? "",
      }
    : {
        body: announcement.body_en ?? "",
        title: announcement.title_en,
      };

const getAnnouncementValuesTranslationSnapshot = (
  values: AnnouncementFormValues,
  sourceLocale: ContentLocale
): AnnouncementTranslationSnapshot =>
  sourceLocale === "no"
    ? { body: values.body_no ?? "", title: values.title_no ?? "" }
    : { body: values.body_en ?? "", title: values.title_en };

const translateAnnouncementSnapshot = async (
  source: AnnouncementTranslationSnapshot,
  sourceLocale: ContentLocale
): Promise<AnnouncementTranslationSnapshot> => {
  const translated = await translateContentFields({
    contentType: "announcement",
    fields: [
      { format: "plain", key: "title", value: source.title },
      { format: "html", key: "body", value: source.body },
    ],
    sourceLocale,
    targetLocale: getTargetLocale(sourceLocale),
  });
  return {
    body: translated.body ?? "",
    title: translated.title ?? "",
  };
};

const hasAnnouncementTranslationSource = ({
  title,
}: AnnouncementTranslationSnapshot): boolean => Boolean(title.trim());

const getAnnouncementDeliverySnapshot = (
  announcement: Announcements
): AnnouncementDeliverySnapshot => {
  const ownership = getContentOwnership(announcement, { legacyFallback: true });
  return {
    audienceType: announcement.audience_type,
    audienceValue: announcement.audience_value ?? null,
    campusId: ownership.campus,
    category: announcement.category,
    deepLink: announcement.deep_link ?? null,
    departmentId: ownership.department,
    eventId: announcement.event_id ?? null,
    push: announcement.push,
    scheduledAt: announcement.scheduled_at ?? null,
    status: announcement.status,
  };
};

const buildTranslationPendingData = (token: string): string =>
  JSON.stringify({ [TRANSLATION_PENDING_KEY]: token });

const getTranslationPendingToken = (data: string | null): string | null => {
  if (!data) {
    return null;
  }
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    const token = parsed[TRANSLATION_PENDING_KEY];
    return typeof token === "string" ? token : null;
  } catch {
    return null;
  }
};

const loadClaimedAnnouncement = async (
  client: AnnouncementAdminClient,
  announcementId: string,
  claim: AnnouncementDeliveryClaim
): Promise<Announcements | null> => {
  const response = await client.db.listRows<Announcements>(
    "app",
    "announcements",
    [Query.equal("$id", announcementId), Query.limit(1)]
  );
  const current = response.rows[0];
  if (
    !(
      current &&
      getTranslationPendingToken(current.data) === claim.token &&
      isCurrentTranslationSource(
        claim.snapshot,
        getAnnouncementDeliverySnapshot(current)
      )
    )
  ) {
    return null;
  }
  return current;
};

const translateAndPersistAnnouncement = async ({
  announcementId,
  client,
  deliveryClaim,
  source,
  sourceLocale,
}: {
  announcementId: string;
  client: AnnouncementAdminClient;
  deliveryClaim?: AnnouncementDeliveryClaim;
  source: AnnouncementTranslationSnapshot;
  sourceLocale: ContentLocale;
}): Promise<Announcements | null> => {
  const translated = await translateAnnouncementSnapshot(source, sourceLocale);
  const response = await client.db.listRows<Announcements>(
    "app",
    "announcements",
    [Query.equal("$id", announcementId), Query.limit(1)]
  );
  const current = response.rows[0];
  if (!current) {
    return null;
  }
  const currentSource = getAnnouncementTranslationSnapshot(
    current,
    sourceLocale
  );
  if (!isCurrentTranslationSource({ ...source }, { ...currentSource })) {
    return null;
  }
  if (
    deliveryClaim &&
    !(
      getTranslationPendingToken(current.data) === deliveryClaim.token &&
      isCurrentTranslationSource(
        deliveryClaim.snapshot,
        getAnnouncementDeliverySnapshot(current)
      )
    )
  ) {
    return null;
  }

  const destinationColumns =
    getTargetLocale(sourceLocale) === "en"
      ? { body_en: translated.body, title_en: translated.title }
      : { body_no: translated.body, title_no: translated.title };
  await client.db.updateRow(
    "app",
    "announcements",
    announcementId,
    destinationColumns
  );
  return { ...current, ...destinationColumns };
};

const scheduleAnnouncementTranslation = ({
  announcementId,
  options,
  source,
}: {
  announcementId: string;
  options?: AutoTranslationOptions;
  source: AnnouncementTranslationSnapshot;
}): boolean => {
  if (!(options?.enabled && hasAnnouncementTranslationSource(source))) {
    return false;
  }

  return scheduleContentTranslation({
    enabled: true,
    task: async () => {
      const client = await createAdminClient();
      await translateAndPersistAnnouncement({
        announcementId,
        client,
        source,
        sourceLocale: options.sourceLocale,
      });
    },
  });
};

export async function generateAnnouncementTranslationDraft(
  input: AnnouncementTranslationDraftInput
) {
  const ctx = await requireAuth();
  if (!contentLocaleSchema.safeParse(input.sourceLocale).success) {
    return { error: "Unsupported source locale" };
  }
  if (!(input.title.trim() || input.body.trim())) {
    return { error: "Add source-language announcement content first." };
  }

  try {
    if (input.campusId) {
      assertWriteAccess(ctx, input.campusId);
    } else if (!ctx.roles.includes("globaladmin")) {
      return { error: "A campus is required for non-global admins." };
    }
    return {
      data: await translateAnnouncementSnapshot(input, input.sourceLocale),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate announcement translation",
    };
  }
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
    // Canonical ownership relationships; the scalar column remains as
    // migration-era compatibility metadata only.
    campus: values.campus_id || null,
    campus_id: values.campus_id || null,
    department: values.department_id ?? null,
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
    ...applyContentRelationshipScopeQueries(ctx),
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
  if (!announcement) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(announcement, { legacyFallback: true });
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }
  return announcement;
}

export async function createAnnouncement(
  values: AnnouncementFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<AnnouncementMutationResult> {
  const ctx = await requireAuth();
  const validated = announcementSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createAdminClient();
    // Global announcements (null campus) stay global-admin only; everyone
    // else needs a campus, and department authors their own department.
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: true,
      campusId: validated.data.campus_id || null,
      departmentId: validated.data.department_id ?? null,
    });
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

    const translationQueued = scheduleAnnouncementTranslation({
      announcementId: announcement.$id,
      options: translationOptions,
      source: getAnnouncementValuesTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "en"
      ),
    });
    revalidatePath("/communications");
    return {
      data: announcement.$id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
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
  values: AnnouncementFormValues,
  autoTranslation?: AutoTranslationOptions
): Promise<AnnouncementMutationResult> {
  const ctx = await requireAuth();
  const validated = announcementSchema.safeParse(values);
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors };
  }

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    const { db } = await createAdminClient();
    const existing = await db.listRows<Announcements>("app", "announcements", [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    const announcement = existing.rows[0];
    if (!announcement) {
      return { error: "Announcement not found" };
    }

    // Authorize both the persisted scope and the requested scope so ownership
    // transfers require access on each side.
    const persisted = getContentOwnership(announcement, {
      legacyFallback: true,
    });
    assertWriteAccess(ctx, persisted.campus, persisted.department);
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: true,
      campusId: validated.data.campus_id || null,
      departmentId: validated.data.department_id ?? null,
    });

    const audienceValue = await normalizeAudienceValue(
      validated.data.audience_type,
      validated.data.audience_value
    );

    await db.updateRow("app", "announcements", id, {
      ...buildAnnouncementColumns(validated.data, audienceValue),
      ...(getTranslationPendingToken(announcement.data) ? { data: null } : {}),
    });

    await logAuditEvent(ctx, "announcement.update", {
      resourceId: id,
      resourceType: "announcement",
      payload: {
        campus_id: validated.data.campus_id ?? null,
        audience_type: validated.data.audience_type,
      },
    });

    const translationQueued = scheduleAnnouncementTranslation({
      announcementId: id,
      options: translationOptions,
      source: getAnnouncementValuesTranslationSnapshot(
        validated.data,
        translationOptions?.sourceLocale ?? "en"
      ),
    });
    revalidatePath("/communications");
    revalidatePath(`/communications/${id}`);
    return {
      data: id,
      ...(translationQueued ? { translationQueued: true as const } : {}),
    };
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

    const ownership = getContentOwnership(announcement, {
      legacyFallback: true,
    });
    assertWriteAccess(ctx, ownership.campus, ownership.department);

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

const dispatchPersistedAnnouncement = async ({
  announcement,
  client,
  ctx,
}: {
  announcement: Announcements;
  client: AnnouncementAdminClient;
  ctx: Awaited<ReturnType<typeof requireAuth>>;
}): Promise<SendAnnouncementResult> => {
  const dataPayload = buildDataPayload(announcement);
  const enriched: Announcements = {
    ...announcement,
    data: dataPayload,
    deep_link: announcement.deep_link ?? buildDeepLink(announcement),
  };

  let recipients = 0;
  try {
    const result = await dispatchAnnouncement(enriched, {
      db: client.db,
      messaging: client.messaging,
      users: client.users,
    });
    recipients = result.recipients;
  } catch (error) {
    console.error("Failed to dispatch announcement:", error);
    await client.db.updateRow("app", "announcements", announcement.$id, {
      status: "failed",
      data: dataPayload,
    });
    return { error: "Failed to send announcement" };
  }

  await client.db.updateRow("app", "announcements", announcement.$id, {
    status: "sent",
    sent_at: new Date().toISOString(),
    data: dataPayload,
    deep_link: enriched.deep_link,
  });

  await logAuditEvent(ctx, "announcement.send", {
    resourceId: announcement.$id,
    resourceType: "announcement",
    payload: {
      audience_type: announcement.audience_type,
      recipients,
    },
  });

  revalidatePath("/communications");
  revalidatePath(`/communications/${announcement.$id}`);
  return { data: { status: "sent" as const, recipients } };
};

const queueScheduledAnnouncement = async ({
  announcement,
  automaticSource,
  client,
  ctx,
  translationOptions,
}: {
  announcement: Announcements;
  automaticSource: AnnouncementTranslationSnapshot | null;
  client: AnnouncementAdminClient;
  ctx: Awaited<ReturnType<typeof requireAuth>>;
  translationOptions?: AutoTranslationOptions;
}): Promise<SendAnnouncementResult> => {
  const deliveryToken = translationOptions?.enabled ? ID.unique() : null;
  const scheduledAnnouncement = {
    ...announcement,
    data: deliveryToken ? buildTranslationPendingData(deliveryToken) : null,
    status: "scheduled",
  } as Announcements;
  await client.db.updateRow("app", "announcements", announcement.$id, {
    data: scheduledAnnouncement.data,
    status: scheduledAnnouncement.status,
  });
  await logAuditEvent(ctx, "announcement.schedule", {
    payload: { scheduled_at: announcement.scheduled_at },
    resourceId: announcement.$id,
    resourceType: "announcement",
  });

  const translationQueued = Boolean(deliveryToken && automaticSource);
  if (deliveryToken && automaticSource && translationOptions?.enabled) {
    const deliveryClaim: AnnouncementDeliveryClaim = {
      snapshot: getAnnouncementDeliverySnapshot(scheduledAnnouncement),
      token: deliveryToken,
    };
    scheduleContentTranslation({
      enabled: true,
      task: async () => {
        const backgroundClient = await createAdminClient();
        const translatedAnnouncement = await translateAndPersistAnnouncement({
          announcementId: announcement.$id,
          client: backgroundClient,
          deliveryClaim,
          source: automaticSource,
          sourceLocale: translationOptions.sourceLocale,
        });
        if (!translatedAnnouncement) {
          return;
        }
        const claimedAnnouncement = await loadClaimedAnnouncement(
          backgroundClient,
          announcement.$id,
          deliveryClaim
        );
        if (!claimedAnnouncement) {
          return;
        }
        await backgroundClient.db.updateRow(
          "app",
          "announcements",
          announcement.$id,
          { data: null }
        );
      },
    });
  }
  revalidatePath("/communications");
  return {
    data: { status: "scheduled" },
    ...(translationQueued ? { translationQueued: true } : {}),
  };
};

export async function sendAnnouncement(
  id: string,
  autoTranslation?: AutoTranslationOptions
): Promise<SendAnnouncementResult> {
  const ctx = await requireAuth();

  try {
    const translationOptions = parseAutoTranslationOptions(autoTranslation);
    // Announcements use row security; admin operations go through the
    // service-key client (authorization enforced here via assertPublishAccess).
    const client = await createAdminClient();
    const existing = await client.db.listRows<Announcements>(
      "app",
      "announcements",
      [Query.equal("$id", id), Query.limit(1)]
    );
    const announcement = existing.rows[0];
    if (!announcement) {
      return { error: "Announcement not found" };
    }

    // Sending is publish-grade: general write scope over the announcement's
    // ownership (department members may send their own department's).
    const sendOwnership = getContentOwnership(announcement, {
      legacyFallback: true,
    });
    assertPublishAccess(ctx, sendOwnership.campus, sendOwnership.department);

    const automaticSource = translationOptions?.enabled
      ? getAnnouncementTranslationSnapshot(
          announcement,
          translationOptions.sourceLocale
        )
      : null;
    if (automaticSource && !hasAnnouncementTranslationSource(automaticSource)) {
      return { error: "Add source-language announcement content first." };
    }

    // Future-dated: mark as scheduled. When translation is enabled, a claim in
    // `data` keeps the cron from delivering until the deferred translation has
    // completed and cleared the claim.
    if (
      announcement.scheduled_at &&
      new Date(announcement.scheduled_at).getTime() > Date.now()
    ) {
      return await queueScheduledAnnouncement({
        announcement,
        automaticSource,
        client,
        ctx,
        translationOptions,
      });
    }

    if (translationOptions?.enabled) {
      if (!automaticSource) {
        return { error: "Add source-language announcement content first." };
      }
      const deliveryToken = ID.unique();
      const claimedAnnouncement = {
        ...announcement,
        data: buildTranslationPendingData(deliveryToken),
      } as Announcements;
      const deliveryClaim: AnnouncementDeliveryClaim = {
        snapshot: getAnnouncementDeliverySnapshot(claimedAnnouncement),
        token: deliveryToken,
      };
      await client.db.updateRow("app", "announcements", id, {
        data: claimedAnnouncement.data,
      });
      scheduleContentTranslation({
        enabled: true,
        task: async () => {
          const backgroundClient = await createAdminClient();
          const translatedAnnouncement = await translateAndPersistAnnouncement({
            announcementId: id,
            client: backgroundClient,
            deliveryClaim,
            source: automaticSource,
            sourceLocale: translationOptions.sourceLocale,
          });
          if (!translatedAnnouncement) {
            return;
          }
          const currentClaimedAnnouncement = await loadClaimedAnnouncement(
            backgroundClient,
            id,
            deliveryClaim
          );
          if (!currentClaimedAnnouncement) {
            return;
          }
          // The claim froze the ownership snapshot, but re-assert the actor
          // against the reloaded row before anything is delivered.
          const claimedOwnership = getContentOwnership(
            currentClaimedAnnouncement,
            { legacyFallback: true }
          );
          assertPublishAccess(
            ctx,
            claimedOwnership.campus,
            claimedOwnership.department
          );
          const result = await dispatchPersistedAnnouncement({
            announcement: currentClaimedAnnouncement,
            client: backgroundClient,
            ctx,
          });
          if ("error" in result) {
            throw new Error(result.error);
          }
        },
      });
      return { data: { status: "queued" as const } };
    }

    return await dispatchPersistedAnnouncement({
      announcement,
      client,
      ctx,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to send announcement",
    };
  }
}
