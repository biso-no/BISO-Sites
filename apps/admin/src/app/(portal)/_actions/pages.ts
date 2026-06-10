"use server";

import { Query } from "@repo/api";
import {
  PAGE_LOCALES,
  type PageDoc,
  type PageEditorLocale,
  getPageById as pbGetPageById,
  getPageEditorById as pbGetPageEditorById,
  publishPage as pbPublishPage,
  unpublishPage as pbUnpublishPage,
  savePageDraft,
} from "@repo/api/page-builder";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Pages, PageViewEvents } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireAuth, type UserAuthContext } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";

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

  // Single source of truth for campus/department scoping: campus admins see
  // their managed campuses, department users see their department(s), and
  // global admins see everything (or their active-campus filter if set).
  queries.push(...applyScopeQueries(ctx));

  const response = await db.listRows<Pages>("app", "pages", queries);
  return response.rows;
}

export async function getDashboardStats() {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();

  const scopeFilter = applyScopeQueries(ctx);

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

/**
 * Department users are scoped to pages whose department_id matches one of their
 * departments (see applyScopeQueries). Default a saved page's department to the
 * saver's department when they belong to exactly one and haven't picked one, so
 * a department user never creates a page they immediately can't see again.
 * Admins (global/campus) are left untouched — they routinely manage pages that
 * belong to other departments or none.
 */
function ensureDepartmentForScoping(
  doc: PageDoc,
  ctx: UserAuthContext
): PageDoc {
  const isAdmin =
    ctx.roles.includes("globaladmin") || ctx.managedCampusIds.length > 0;
  if (isAdmin || doc.meta.department) {
    return doc;
  }
  if (ctx.resolvedDepartmentIds.length !== 1) {
    return doc;
  }
  return {
    ...doc,
    meta: { ...doc.meta, department: ctx.resolvedDepartmentIds[0] },
  };
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
    const scopedDoc = ensureDepartmentForScoping(doc, ctx);
    const { pageId, slug } = await savePageDraft({
      id,
      doc: scopedDoc,
      locale,
      ctx,
    });
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
