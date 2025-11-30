"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { AppNotices } from "@repo/api/types/appwrite";
import type {
  Notification,
  NotificationType,
} from "@/components/notifications/notifications-dropdown";

const DATABASE_ID = "app";
const NOTICES_TABLE = "notices";

/**
 * Fetch notifications for the admin dashboard
 * Uses the notices table from Appwrite
 */
export async function fetchNotifications(): Promise<Notification[]> {
  try {
    const { db } = await createAdminClient();

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
      read: false, // Will be managed client-side
      actionUrl: notice.actionUrl || undefined,
      metadata: {
        noticeId: notice.$id,
        color: notice.color,
        originalPriority: notice.priority,
      },
    }));
  } catch (error) {
    console.error("[notifications] Failed to fetch notifications:", error);
    return [];
  }
}

/**
 * Create a new notification in the database
 */
export async function createNotification(data: {
  title: string;
  description: string;
  color?: string;
  priority?: number;
  link?: string;
  isActive?: boolean;
}): Promise<{ success: boolean; notificationId?: string; error?: string }> {
  try {
    const { db } = await createAdminClient();

    const noticeData = {
      title: data.title,
      description: data.description,
      color: data.color || "blue",
      priority: data.priority || 1,
      link: data.link || null,
      isActive: data.isActive !== false,
    };

    const response = await db.createRow(
      DATABASE_ID,
      NOTICES_TABLE,
      ID.unique(),
      noticeData
    );

    return {
      success: true,
      notificationId: response.$id,
    };
  } catch (error) {
    console.error("[notifications] Failed to create notification:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create notification",
    };
  }
}

/**
 * Mark a notification as inactive (soft delete)
 */
async function dismissNotification(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await createAdminClient();

    await db.updateRow(DATABASE_ID, NOTICES_TABLE, notificationId, {
      isActive: false,
    });

    return { success: true };
  } catch (error) {
    console.error("[notifications] Failed to dismiss notification:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to dismiss notification",
    };
  }
}

/**
 * Update notification priority
 */
async function updateNotificationPriority(
  notificationId: string,
  priority: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await createAdminClient();

    await db.updateRow(DATABASE_ID, NOTICES_TABLE, notificationId, {
      priority,
    });

    return { success: true };
  } catch (error) {
    console.error(
      "[notifications] Failed to update notification priority:",
      error
    );
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update priority",
    };
  }
}

/**
 * Map notice color to notification type
 */
function mapColorToType(color?: string | null): NotificationType {
  if (!color) {
    return "info";
  }

  const normalized = color.toLowerCase();

  if (
    normalized.includes("red") ||
    normalized.includes("error") ||
    normalized.includes("danger")
  ) {
    return "error";
  }
  if (
    normalized.includes("yellow") ||
    normalized.includes("orange") ||
    normalized.includes("amber") ||
    normalized.includes("warning")
  ) {
    return "warning";
  }
  if (normalized.includes("green") || normalized.includes("success")) {
    return "success";
  }

  return "info";
}

/**
 * Map notice priority number to notification priority level
 */
function mapPriorityToLevel(
  priority?: number | null
): "low" | "medium" | "high" {
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

/**
 * Get notification statistics
 */
async function getNotificationStats(): Promise<{
  total: number;
  active: number;
  byType: Record<NotificationType, number>;
}> {
  try {
    const { db } = await createAdminClient();

    const [allNotices, activeNotices] = await Promise.all([
      db.listRows<AppNotices>(DATABASE_ID, NOTICES_TABLE, [
        Query.select(["$id", "color"]),
        Query.limit(1000),
      ]),
      db.listRows<AppNotices>(DATABASE_ID, NOTICES_TABLE, [
        Query.select(["$id", "color"]),
        Query.equal("isActive", true),
        Query.limit(1000),
      ]),
    ]);

    const byType: Record<NotificationType, number> = {
      success: 0,
      error: 0,
      warning: 0,
      info: 0,
    };

    for (const notice of activeNotices.rows) {
      const type = mapColorToType(notice.color);
      byType[type] += 1;
    }

    return {
      total: allNotices.rows.length,
      active: activeNotices.rows.length,
      byType,
    };
  } catch (error) {
    console.error("[notifications] Failed to get notification stats:", error);
    return {
      total: 0,
      active: 0,
      byType: { success: 0, error: 0, warning: 0, info: 0 },
    };
  }
}
