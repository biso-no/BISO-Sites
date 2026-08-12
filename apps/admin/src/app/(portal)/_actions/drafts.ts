"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Events,
  Jobs,
  News,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  getContentOwnership,
} from "@/lib/content-authorization";
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

  // Fetch draft jobs
  const jobsResponse = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("status", "draft"),
    Query.orderDesc("$updatedAt"),
    Query.limit(50),
    ...jobScopeQueries,
  ]);

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

    await db.updateRow("app", table, id, { status: "published" });

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
