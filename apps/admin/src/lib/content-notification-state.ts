import type { ContentNotifications } from "@repo/api/types/appwrite";

export type ContentNotificationState =
  | { kind: "none" }
  | { kind: "pending"; dueAt: string }
  | { kind: "sent"; sentAt: string }
  | { kind: "skipped" }
  | { kind: "cancelled" };

/**
 * A lock carrying `announcement_id` or `sent_at` was sent, whatever `status`
 * says: a stale write can leave `cancelled` on a lock that already went out.
 */
export function toNotificationState(
  lock: ContentNotifications | null
): ContentNotificationState {
  if (!lock) {
    return { kind: "none" };
  }
  if (lock.announcement_id || lock.sent_at) {
    return { kind: "sent", sentAt: lock.sent_at ?? lock.$updatedAt };
  }
  switch (lock.status) {
    case "pending":
      return { dueAt: lock.due_at ?? lock.$updatedAt, kind: "pending" };
    case "sent":
      return { kind: "sent", sentAt: lock.sent_at ?? lock.$updatedAt };
    case "skipped":
      return { kind: "skipped" };
    case "cancelled":
      return { kind: "cancelled" };
    default:
      return { kind: "none" };
  }
}
