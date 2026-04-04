"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  ContentTranslations,
  Events,
  Jobs,
  News,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";
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

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export async function listDrafts(): Promise<DraftItem[]> {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const scopeQueries = applyScopeQueries(ctx);

  const drafts: DraftItem[] = [];

  // Fetch draft jobs
  const jobsResponse = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("status", "draft"),
    Query.orderDesc("$updatedAt"),
    Query.limit(50),
    ...scopeQueries,
  ]);

  // Fetch draft events
  const eventsResponse = await db.listRows<Events>("app", "events", [
    Query.equal("status", "draft"),
    Query.orderDesc("$updatedAt"),
    Query.limit(50),
    ...scopeQueries,
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

  const { db } = await createSessionClient();
  const tableMap = { job: "jobs", event: "events", news: "news" } as const;
  const table = tableMap[type];

  await db.updateRow("app", table, id, { status: "published" });

  revalidatePath("/admin/drafts");
  revalidatePath(`/admin/${table}`);
  return { data: true };
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

  const { db } = await createSessionClient();
  const tableMap = { job: "jobs", event: "events", news: "news" } as const;
  const _table = tableMap[type];

  // Keep as draft but optionally log the rejection
  if (reason) {
    void logAuditEvent(ctx, "draft_rejected", {
      resourceId: id,
      resourceType: type,
      payload: { reason },
    });
  }

  revalidatePath("/admin/drafts");
  return { data: true };
}
