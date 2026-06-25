"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  AppNotices,
  ContentTranslations,
  Events,
  Jobs,
  News,
} from "@repo/api/types/appwrite";
import { getUserAuthContext } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";

const DATABASE_ID = "app";
const NOTICES_TABLE = "notices";

export type NotificationType = "success" | "error" | "warning" | "info";
export type NotificationPriority = "low" | "medium" | "high";

export interface Notification {
  actionUrl?: string;
  id: string;
  message: string;
  priority: NotificationPriority;
  timestamp: string;
  title: string;
  type: NotificationType;
}

export interface PendingItem {
  campusId: string;
  editUrl: string;
  id: string;
  status: string;
  title: string;
  type: "job" | "event" | "news";
  updatedAt: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const { db } = await createSessionClient();

    const response = await db.listRows<AppNotices>(DATABASE_ID, NOTICES_TABLE, [
      Query.equal("isActive", true),
      Query.orderDesc("priority"),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
    ]);

    return response.rows.map((notice) => ({
      id: notice.$id,
      type: mapColorToType(notice.color),
      priority: mapPriorityToLevel(notice.priority),
      title: notice.title,
      message: notice.description || notice.title,
      timestamp: notice.$createdAt,
      actionUrl: notice.actionUrl || undefined,
    }));
  } catch {
    return [];
  }
}

export async function fetchPendingItems(): Promise<PendingItem[]> {
  try {
    const ctx = await getUserAuthContext();
    if (!ctx) {
      return [];
    }

    const canApprove =
      ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin");
    if (!canApprove) {
      return [];
    }

    const { db } = await createSessionClient();
    const scopeQueries = applyScopeQueries(ctx);
    // events has no department_id column — scope it by campus only.
    const eventScopeQueries = applyScopeQueries(ctx, { departmentField: null });

    const [jobsRes, eventsRes, newsRes] = await Promise.all([
      db.listRows<Jobs>(DATABASE_ID, "jobs", [
        Query.equal("status", "draft"),
        Query.orderDesc("$updatedAt"),
        Query.limit(20),
        ...scopeQueries,
      ]),
      db.listRows<Events>(DATABASE_ID, "events", [
        Query.equal("status", "draft"),
        Query.orderDesc("$updatedAt"),
        Query.limit(20),
        ...eventScopeQueries,
      ]),
      db.listRows<News>(DATABASE_ID, "news", [
        Query.equal("status", "draft"),
        Query.orderDesc("$updatedAt"),
        Query.limit(20),
        ...scopeQueries,
      ]),
    ]);

    const allIds = [
      ...jobsRes.rows.map((j) => j.$id),
      ...eventsRes.rows.map((e) => e.$id),
      ...newsRes.rows.map((n) => n.$id),
    ];

    const translationMap = new Map<string, string>();

    if (allIds.length > 0) {
      const translationsRes = await db.listRows<ContentTranslations>(
        DATABASE_ID,
        "content_translations",
        [
          Query.equal("content_id", allIds),
          Query.equal("locale", "no"),
          Query.limit(allIds.length),
        ]
      );
      for (const t of translationsRes.rows) {
        translationMap.set(t.content_id, t.title);
      }
    }

    const items: PendingItem[] = [];

    for (const job of jobsRes.rows) {
      items.push({
        id: job.$id,
        title: translationMap.get(job.$id) ?? "Untitled job",
        type: "job",
        status: job.status,
        campusId: job.campus_id,
        updatedAt: job.$updatedAt,
        editUrl: `/jobs/${job.$id}`,
      });
    }
    for (const event of eventsRes.rows) {
      items.push({
        id: event.$id,
        title: translationMap.get(event.$id) ?? "Untitled event",
        type: "event",
        status: event.status,
        campusId: event.campus_id,
        updatedAt: event.$updatedAt,
        editUrl: `/events/${event.$id}`,
      });
    }
    for (const article of newsRes.rows) {
      items.push({
        id: article.$id,
        title: translationMap.get(article.$id) ?? "Untitled article",
        type: "news",
        status: article.status,
        campusId: article.campus_id,
        updatedAt: article.$updatedAt,
        editUrl: `/news/${article.$id}`,
      });
    }

    items.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return items.slice(0, 30);
  } catch {
    return [];
  }
}

function mapColorToType(color?: string | null): NotificationType {
  if (!color) {
    return "info";
  }
  const c = color.toLowerCase();
  if (c.includes("red") || c.includes("error") || c.includes("danger")) {
    return "error";
  }
  if (
    c.includes("yellow") ||
    c.includes("orange") ||
    c.includes("amber") ||
    c.includes("warning")
  ) {
    return "warning";
  }
  if (c.includes("green") || c.includes("success")) {
    return "success";
  }
  return "info";
}

function mapPriorityToLevel(priority?: number | null): NotificationPriority {
  if (!priority) {
    return "low";
  }
  if (priority >= 3) {
    return "high";
  }
  if (priority >= 2) {
    return "medium";
  }
  return "low";
}
