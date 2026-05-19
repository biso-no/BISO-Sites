"use server";

import { Query } from "@repo/api";
import {
  PAGE_LOCALES,
  type PageDoc,
  type PageEditorLocale,
  getPage as pbGetPage,
  getPageById as pbGetPageById,
  getPageEditorById as pbGetPageEditorById,
  publishPage as pbPublishPage,
  unpublishPage as pbUnpublishPage,
  savePageDraft,
} from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Pages, PageViewEvents } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { logAuditEvent } from "./audit-log";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

export async function listPages(opts?: { status?: string; campusId?: string }) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const queries: string[] = [
    Query.select(["*", "translation_refs.*"]),
    Query.orderDesc("$updatedAt"),
    Query.limit(100),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  // Scope by campus if not global admin
  if (!ctx.roles.includes("globaladmin")) {
    if (ctx.managedCampusIds.length > 0) {
      queries.push(Query.equal("campus_id", ctx.managedCampusIds));
    } else if (ctx.resolvedCampusIds.length > 0) {
      queries.push(Query.equal("campus_id", ctx.resolvedCampusIds));
    }
  }

  const response = await db.listRows<Pages>("app", "pages", queries);
  return response.rows;
}

export async function getDashboardStats() {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scopeFilter: string[] = [];
  if (!ctx.roles.includes("globaladmin")) {
    if (ctx.managedCampusIds.length > 0) {
      scopeFilter.push(Query.equal("campus_id", ctx.managedCampusIds));
    } else if (ctx.resolvedCampusIds.length > 0) {
      scopeFilter.push(Query.equal("campus_id", ctx.resolvedCampusIds));
    }
  }

  const [jobsRes, eventsRes, newsRes, draftsRes] = await Promise.allSettled([
    db.listRows("app", "jobs", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "events", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "news", [
      Query.equal("status", "published"),
      Query.limit(1),
      ...scopeFilter,
    ]),
    db.listRows("app", "jobs", [
      Query.equal("status", "draft"),
      Query.limit(1),
      ...scopeFilter,
    ]),
  ]);

  return {
    jobs: jobsRes.status === "fulfilled" ? (jobsRes.value.total ?? 0) : 0,
    events: eventsRes.status === "fulfilled" ? (eventsRes.value.total ?? 0) : 0,
    news: newsRes.status === "fulfilled" ? (newsRes.value.total ?? 0) : 0,
    drafts: draftsRes.status === "fulfilled" ? (draftsRes.value.total ?? 0) : 0,
  };
}

export interface PageViewDay {
  date: string;
  views: number;
}

async function _getPageViewStats(days = 14): Promise<PageViewDay[]> {
  await requireAuth();

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  try {
    const { db } = await createAdminClient();
    const response = await db.listRows<PageViewEvents>(
      "app",
      "page_view_events",
      [
        Query.greaterThanEqual("$createdAt", since.toISOString()),
        Query.orderAsc("$createdAt"),
        Query.limit(5000),
      ]
    );

    // Bucket by day
    const buckets: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets[
        d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      ] = 0;
    }

    for (const row of response.rows) {
      const label = new Date(row.$createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (label in buckets) {
        buckets[label]++;
      }
    }

    return Object.entries(buckets).map(([date, views]) => ({ date, views }));
  } catch {
    return [];
  }
}

export async function getPageBySlug(slug: string, locale: "no" | "en" = "no") {
  await requireAuth();
  return pbGetPage(slug, locale);
}

export async function getPageById(id: string, locale: "no" | "en" = "no") {
  await requireAuth();
  return pbGetPageById(id, locale);
}

export async function getPageEditorById(id: string) {
  await requireAuth();
  return pbGetPageEditorById(id);
}

export async function getPageEditorLocales(): Promise<PageEditorLocale[]> {
  await requireAuth();
  return [...PAGE_LOCALES];
}

export async function savePageEditorDoc({
  id,
  doc,
  locale = "no",
}: {
  id: string | null;
  doc: PageDoc;
  locale?: PageEditorLocale;
}): Promise<{ pageId: string; slug: string } | { error: string }> {
  const ctx = await requireAuth();
  try {
    const { pageId, slug } = await savePageDraft({ id, doc, locale, ctx });
    await logAuditEvent(ctx, "page_saved", {
      resourceId: pageId,
      resourceType: "page",
    });
    revalidatePath("/pages");
    return { pageId, slug };
  } catch (e) {
    console.error("[savePageEditorDoc]", e);
    return { error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function publishPageAction(
  id: string,
  locale: "no" | "en" = "no"
) {
  const ctx = await requireAuth();
  await pbPublishPage({ id, locale });
  await logAuditEvent(ctx, "page_published", {
    resourceId: id,
    resourceType: "page",
  });
  revalidatePath("/pages");
}

export async function unpublishPageAction(
  id: string,
  locale: "no" | "en" = "no"
) {
  const ctx = await requireAuth();
  await pbUnpublishPage({ id, locale });
  await logAuditEvent(ctx, "page_unpublished", {
    resourceId: id,
    resourceType: "page",
  });
  revalidatePath("/pages");
}

export async function deletePageAction(id: string) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  await db.updateRow("app", "pages", id, { status: "archived" });
  await logAuditEvent(ctx, "page_deleted", {
    resourceId: id,
    resourceType: "page",
  });
  revalidatePath("/pages");
}
