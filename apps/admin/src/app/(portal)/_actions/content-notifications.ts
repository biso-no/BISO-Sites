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

export async function getContentNotificationState(
  type: NotifyContentType,
  contentId: string
): Promise<ContentNotificationState> {
  await requireAuth();
  const { db } = await createAdminClient();
  try {
    const lock = await db.getRow<ContentNotifications>(
      "app",
      "content_notifications",
      lockRowIdFor(type, contentId)
    );
    return toNotificationState(lock);
  } catch (error) {
    if (isRowNotFound(error)) {
      return { kind: "none" };
    }
    throw error;
  }
}
