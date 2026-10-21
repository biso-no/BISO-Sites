"use server";

import { createAdminClient } from "@repo/api/server";
import type { ContentNotifications } from "@repo/api/types/appwrite";
import {
  lockRowIdFor,
  type NotifyContentType,
} from "@repo/shared/utils/content-notifications";
import { requireAuth } from "@/lib/authorization";
import {
  type ContentNotificationState,
  toNotificationState,
} from "@/lib/content-notification-state";
import { isRowNotFound } from "@/lib/shop/sales-type";

const NOTIFY_CONTENT_TYPES: readonly string[] = ["event", "news", "job"];

export async function getContentNotificationState(
  type: NotifyContentType,
  contentId: string
): Promise<ContentNotificationState> {
  const ctx = await requireAuth();
  if (!NOTIFY_CONTENT_TYPES.includes(type)) {
    return { kind: "none" };
  }
  const { db } = await createAdminClient();
  try {
    const lock = await db.getRow<ContentNotifications>(
      "app",
      "content_notifications",
      lockRowIdFor(type, contentId)
    );
    const inScope =
      ctx.roles.includes("globaladmin") ||
      !lock.campus_id ||
      ctx.managedCampusIds.includes(lock.campus_id) ||
      ctx.resolvedCampusIds.includes(lock.campus_id);
    return inScope ? toNotificationState(lock) : { kind: "none" };
  } catch (error) {
    if (isRowNotFound(error)) {
      return { kind: "none" };
    }
    throw error;
  }
}
