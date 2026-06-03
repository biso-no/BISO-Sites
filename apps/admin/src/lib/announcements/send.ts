import "server-only";

import { ID, Permission, Role } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { Announcements, UserNotifications } from "./types";

type AdminClients = Awaited<ReturnType<typeof createAdminClient>>;

/**
 * Subset of an admin Appwrite client needed to dispatch an announcement.
 * `users` is only required for resolving user-targeted pushes, but the
 * `createAdminClient()` shape always provides it.
 */
export interface DispatchClients {
  db: AdminClients["db"];
  messaging: AdminClients["messaging"];
  users: AdminClients["users"];
}

/** Default app-wide topic used for broadcasts with no explicit topic. */
const DEFAULT_BROADCAST_TOPIC = "events";

/**
 * The string→string push `data` map contract shared with the Flutter app.
 * Every push carries `{ type, announcement_id, event_id, segment_id, deep_link,
 * category }`. Missing ids are empty strings (never absent) so the client can
 * read them unconditionally.
 */
export function buildPushData(
  announcement: Announcements
): Record<string, string> {
  return {
    type: "announcement",
    announcement_id: announcement.$id,
    event_id: announcement.event_id ?? "",
    segment_id:
      announcement.audience_type === "segment"
        ? (announcement.audience_value ?? "")
        : "",
    deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    category: announcement.category ?? "general",
  };
}

/**
 * `biso://event?id=<event_id>` when an event is attached, otherwise
 * `biso://announcement?id=<announcement_id>`.
 */
export function buildDeepLink(announcement: Announcements): string {
  if (announcement.event_id) {
    return `biso://event?id=${announcement.event_id}`;
  }
  return `biso://announcement?id=${announcement.$id}`;
}

const HTML_TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Strip HTML tags, decode a handful of common entities, and collapse
 * whitespace. Announcement bodies are now stored as rich HTML, but pushes
 * carry plain text, so dispatch flattens them here.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  return html
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "$& ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(HTML_TAG_PATTERN, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

/**
 * Norwegian-first localized title/body, falling back to English. Titles are
 * plain text already; bodies are rich HTML and are flattened to plain text for
 * the push payload.
 */
function localizedContent(announcement: Announcements): {
  title: string;
  body: string;
} {
  return {
    title: announcement.title_no?.trim() || announcement.title_en,
    body: htmlToPlainText(announcement.body_no?.trim() || announcement.body_en),
  };
}

/** Parse `audience_value` as a JSON array of user ids; empty array on failure. */
function parseUserIds(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
  } catch {
    // Not JSON — fall through to empty.
  }
  return [];
}

async function fanOutUserNotifications(
  db: DispatchClients["db"],
  announcementId: string,
  userIds: string[]
): Promise<void> {
  await Promise.all(
    userIds.map((userId) =>
      db
        .createRow(
          "app",
          "user_notifications",
          ID.unique(),
          {
            user_id: userId,
            announcement_id: announcementId,
            read: false,
          } satisfies Partial<UserNotifications>,
          [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId)),
          ]
        )
        .catch((error) => {
          console.error(
            `Failed to create user_notification for ${userId}:`,
            error
          );
        })
    )
  );
}

/**
 * Send the push for an announcement and (for user-targeted sends) fan out
 * in-app `user_notifications` rows. Resolves recipients by `audience_type`.
 *
 * Push failures are logged but swallowed so the caller can still mark the
 * announcement as sent — mirroring the resilient event-push behaviour.
 */
export async function dispatchAnnouncement(
  announcement: Announcements,
  clients: DispatchClients
): Promise<{ recipients: number }> {
  const { db, messaging } = clients;
  const { title, body } = localizedContent(announcement);
  const data = buildPushData(announcement);
  const messageId = ID.unique();

  if (
    announcement.audience_type === "topic" ||
    announcement.audience_type === "broadcast"
  ) {
    const topic =
      announcement.audience_type === "topic"
        ? announcement.audience_value?.trim() || DEFAULT_BROADCAST_TOPIC
        : DEFAULT_BROADCAST_TOPIC;

    if (announcement.push) {
      try {
        await messaging.createPush(
          messageId,
          title,
          body,
          [topic],
          [],
          [],
          data
        );
      } catch (error) {
        console.error("Failed to send announcement push:", error);
      }
    }
    // Topic/broadcast pushes are surfaced in-app by querying announcements,
    // so we do not fan out user_notifications rows here.
    return { recipients: 0 };
  }

  // `users` and (Phase 1 fallback) `segment` both treat audience_value as a
  // JSON array of user ids.
  // TODO(phase2): resolve segment_members for audience_type "segment" instead
  // of treating audience_value as a user-id list.
  const userIds = parseUserIds(announcement.audience_value);

  if (userIds.length === 0) {
    return { recipients: 0 };
  }

  if (announcement.push) {
    try {
      await messaging.createPush(messageId, title, body, [], userIds, [], data);
    } catch (error) {
      console.error("Failed to send announcement push:", error);
    }
  }

  await fanOutUserNotifications(db, announcement.$id, userIds);

  return { recipients: userIds.length };
}
