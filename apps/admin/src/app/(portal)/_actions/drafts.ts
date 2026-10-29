"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Events,
  Jobs,
  News,
} from "@repo/api/types/appwrite";
import { eventReadPermissions } from "@repo/shared/utils/content-read-permissions";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  getContentOwnership,
} from "@/lib/content-authorization";
import { restampTranslationReads } from "@/lib/content-translation-reads";
import {
  assertRecruitmentVacancyWriteAccess,
  buildJobRowPermissions,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import { hasNavAccess } from "@/lib/roles";
import { buildContentRowPermissions } from "@/lib/utils";
import {
  applyScopeQueries,
  assertPublishAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";

export interface DraftItem {
  campus_id: string;
  id: string;
  image?: string | null;
  status: string;
  title: string;
  type: "job" | "event" | "news";
  updatedAt: string;
}

export async function listDrafts(): Promise<DraftItem[]> {
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();
  const scopeQueries = applyContentRelationshipScopeQueries(ctx);
  const eventScopeQueries = scopeQueries;
  // Jobs are outside the relationship-canonical content set (recruitment keeps
  // its own scope model), and the ownership repair never backfills them, so
  // legacy vacancies still carry ownership only on the scalar columns. Scope
  // them there or every pre-relationship draft disappears from this queue.
  const jobScopeQueries = applyScopeQueries(ctx);

  const drafts: DraftItem[] = [];

  // Vacancies are listed for recruiters only.
  const canSeeJobs = hasNavAccess(
    "portal.jobs",
    ctx.roles,
    ctx.departmentTeamIds.length > 0
  );
  const jobsResponse = canSeeJobs
    ? await db.listRows<Jobs>("app", "jobs", [
        Query.equal("status", "draft"),
        Query.orderDesc("$updatedAt"),
        Query.limit(50),
        ...jobScopeQueries,
      ])
    : { rows: [] as Jobs[], total: 0 };

  // Fetch draft events
  const eventsResponse = await db.listRows<Events>("app", "events", [
    Query.equal("status", "draft"),
    Query.orderDesc("$updatedAt"),
    Query.limit(50),
    ...eventScopeQueries,
  ]);

  // Fetch draft news
  const newsResponse = await db.listRows<News>("app", "news", [
    Query.equal("status", "draft"),
    Query.orderDesc("$updatedAt"),
    Query.limit(50),
    ...scopeQueries,
  ]);

  // Gather all IDs for translation lookup
  const jobIds = jobsResponse.rows.map((j) => j.$id);
  const eventIds = eventsResponse.rows.map((e) => e.$id);
  const newsIds = newsResponse.rows.map((n) => n.$id);

  const allTranslations = new Map<string, string>();

  async function fetchTranslations(ids: string[], contentType: string) {
    if (ids.length === 0) {
      return;
    }
    const res = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", contentType),
        Query.equal("content_id", ids),
        Query.equal("locale", "no"),
        Query.limit(ids.length),
      ]
    );
    for (const t of res.rows) {
      allTranslations.set(t.content_id, t.title);
    }
  }

  await Promise.all([
    fetchTranslations(jobIds, "job"),
    fetchTranslations(eventIds, "event"),
    fetchTranslations(newsIds, "news"),
  ]);

  for (const job of jobsResponse.rows) {
    drafts.push({
      id: job.$id,
      type: "job",
      title: allTranslations.get(job.$id) ?? "Untitled job",
      campus_id: job.campus_id,
      status: job.status,
      updatedAt: job.$updatedAt,
    });
  }

  for (const event of eventsResponse.rows) {
    drafts.push({
      id: event.$id,
      type: "event",
      title: allTranslations.get(event.$id) ?? "Untitled event",
      campus_id: event.campus_id,
      status: event.status,
      updatedAt: event.$updatedAt,
      image: event.image,
    });
  }

  for (const article of newsResponse.rows) {
    drafts.push({
      id: article.$id,
      type: "news",
      title: allTranslations.get(article.$id) ?? "Untitled article",
      campus_id: article.campus_id,
      status: article.status,
      updatedAt: article.$updatedAt,
      image: article.image,
    });
  }

  drafts.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return drafts;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/**
 * Publish an event draft: the row and each of its translation rows become
 * world-readable together with the status change.
 */
async function publishEventReadAccess(
  db: AdminDb,
  id: string,
  row: Jobs | Events | News
): Promise<void> {
  const readPermissions = eventReadPermissions("published");
  await db.updateRow(
    "app",
    "events",
    id,
    { status: "published" },
    readPermissions
  );

  const refs = (row as Events).translation_refs ?? [];
  let translationIds = refs.map((ref) =>
    typeof ref === "string" ? ref : ref.$id
  );
  if (translationIds.length === 0) {
    const found = await db.listRows<ContentTranslations>(
      "app",
      "content_translations",
      [
        Query.equal("content_type", "event"),
        Query.equal("content_id", id),
        Query.limit(10),
      ]
    );
    translationIds = found.rows.map((translation) => translation.$id);
  }
  await Promise.all(
    translationIds.map((translationId) =>
      db.updateRow(
        "app",
        "content_translations",
        translationId,
        {},
        readPermissions
      )
    )
  );
}

async function publishJobOrNewsDraft(
  db: AdminDb,
  type: "job" | "news",
  id: string
): Promise<void> {
  const rowPermissions =
    type === "job"
      ? buildJobRowPermissions("public", "published")
      : buildContentRowPermissions({ audience: "public", status: "published" });
  await db.updateRow(
    "app",
    type === "job" ? "jobs" : "news",
    id,
    { status: "published" },
    rowPermissions
  );
  await restampTranslationReads(db, type, id, "published");
}

export async function approveDraft(id: string, type: "job" | "event" | "news") {
  const ctx = await requireAuth();

  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return { error: "Unauthorized: only admins can approve drafts" };
  }

  const tableMap = { job: "jobs", event: "events", news: "news" } as const;
  const table = tableMap[type];

  try {
    const { db } = await createAdminClient();

    // Load the draft and verify the caller may publish for its ownership
    // scope; campus team membership alone grants nothing.
    const row = await db.getRow<Jobs | Events | News>("app", table, id);
    const ownership = getContentOwnership(row, { legacyFallback: true });
    assertPublishAccess(ctx, ownership.campus, ownership.department);
    if (type === "job") {
      const lookups = await loadRecruitmentLookups(db);
      assertRecruitmentVacancyWriteAccess(
        toRecruitmentAdminScope(ctx),
        lookups,
        row as Jobs
      );
    }

    if (type === "event") {
      await publishEventReadAccess(db, id, row);
    } else {
      await publishJobOrNewsDraft(db, type, id);
    }

    await logAuditEvent(ctx, "draft_approved", {
      resourceId: id,
      resourceType: type,
    });

    revalidatePath("/drafts");
    revalidatePath(`/${table}`);
    return { data: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to approve draft",
    };
  }
}

export async function rejectDraft(
  id: string,
  type: "job" | "event" | "news",
  reason?: string
) {
  const ctx = await requireAuth();

  if (
    !(ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin"))
  ) {
    return { error: "Unauthorized: only admins can reject drafts" };
  }

  if (type === "job") {
    try {
      const { db } = await createAdminClient();
      const row = await db.getRow<Jobs>("app", "jobs", id);
      const lookups = await loadRecruitmentLookups(db);
      assertRecruitmentVacancyWriteAccess(
        toRecruitmentAdminScope(ctx),
        lookups,
        row
      );
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Failed to reject draft",
      };
    }
  }

  // Keep as draft but optionally log the rejection
  if (reason) {
    await logAuditEvent(ctx, "draft_rejected", {
      resourceId: id,
      resourceType: type,
      payload: { reason },
    });
  }

  revalidatePath("/drafts");
  return { data: true };
}
