import "server-only";

import { ID, Permission, Query, Role } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  type Announcements,
  AnnouncementsAudienceType,
  AnnouncementsStatus,
  type SegmentMembers,
  type UserNotifications,
} from "@repo/api/types/appwrite";

/** Appwrite list pagination ceiling for a single `Query.limit` call. */
const SEGMENT_MEMBER_PAGE_SIZE = 200;

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
      announcement.audience_type === AnnouncementsAudienceType.SEGMENT
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

/**
 * Collect every `user_id` assigned to a segment, paginating through
 * `segment_members` with a cursor so we capture all members regardless of size.
 */
async function collectSegmentUserIds(
  db: DispatchClients["db"],
  segmentId: string
): Promise<string[]> {
  const userIds: string[] = [];
  let cursor: string | null = null;

  for (;;) {
    const queries: string[] = [
      Query.equal("segment_id", segmentId),
      Query.limit(SEGMENT_MEMBER_PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const page = await db.listRows<SegmentMembers>(
      "app",
      "segment_members",
      queries
    );
    for (const member of page.rows) {
      userIds.push(member.user_id);
    }

    if (page.rows.length < SEGMENT_MEMBER_PAGE_SIZE) {
      break;
    }
    cursor = page.rows.at(-1)?.$id ?? null;
    if (!cursor) {
      break;
    }
  }

  return Array.from(new Set(userIds));
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
 * Set the row-level read permissions on a (row-secured) announcement so the
 * Flutter app can read exactly the right rows: broadcasts for everyone,
 * targeted/segment sends only for their recipients. Best-effort — failures are
 * logged and don't abort the send.
 */
async function applyAnnouncementReadPermissions(
  db: DispatchClients["db"],
  announcementId: string,
  permissions: string[]
): Promise<void> {
  try {
    await db.updateRow(
      "app",
      "announcements",
      announcementId,
      undefined,
      permissions
    );
  } catch (error) {
    console.error(
      `Failed to set read permissions for announcement ${announcementId}:`,
      error
    );
  }
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
    announcement.audience_type === AnnouncementsAudienceType.TOPIC ||
    announcement.audience_type === AnnouncementsAudienceType.BROADCAST
  ) {
    const topic =
      announcement.audience_type === AnnouncementsAudienceType.TOPIC
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
    // Broadcasts are readable by any signed-in student so they surface in the
    // in-app feed (the row carries the body, which is non-sensitive here).
    await applyAnnouncementReadPermissions(db, announcement.$id, [
      Permission.read(Role.users()),
    ]);
    // Topic/broadcast pushes are surfaced in-app by querying announcements,
    // so we do not fan out user_notifications rows here.
    return { recipients: 0 };
  }

  // `segment` resolves audience_value as a segment_id → its assigned members.
  // `users` treats audience_value as a JSON array of user ids.
  const userIds =
    announcement.audience_type === AnnouncementsAudienceType.SEGMENT
      ? await collectSegmentUserIds(db, announcement.audience_value ?? "")
      : parseUserIds(announcement.audience_value);

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

  // Targeted/segment bodies are personal — restrict row read to the recipients
  // so they are not world-readable (row security is on for announcements).
  await applyAnnouncementReadPermissions(
    db,
    announcement.$id,
    userIds.map((userId) => Permission.read(Role.user(userId)))
  );

  return { recipients: userIds.length };
}

/** Max scheduled announcements processed in a single dispatch run. */
const DUE_ANNOUNCEMENTS_PAGE_SIZE = 50;

export interface DispatchDueResult {
  failed: number;
  processed: number;
  sent: number;
}

/**
 * Find every announcement whose scheduled send time has passed and dispatch it,
 * flipping each to `sent` (or `failed`). Intended to be driven by a scheduled
 * Appwrite Function via the secret-gated dispatch route.
 */
export async function dispatchDueAnnouncements(
  clients: DispatchClients,
  now: Date = new Date()
): Promise<DispatchDueResult> {
  const { db } = clients;
  const due = await db.listRows<Announcements>("app", "announcements", [
    Query.equal("status", AnnouncementsStatus.SCHEDULED),
    Query.lessThanEqual("scheduled_at", now.toISOString()),
    Query.limit(DUE_ANNOUNCEMENTS_PAGE_SIZE),
  ]);

  const result: DispatchDueResult = {
    processed: due.rows.length,
    sent: 0,
    failed: 0,
  };

  for (const announcement of due.rows) {
    const enriched: Announcements = {
      ...announcement,
      data: JSON.stringify(buildPushData(announcement)),
      deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    };
    try {
      await dispatchAnnouncement(enriched, clients);
      await db.updateRow("app", "announcements", announcement.$id, {
        status: AnnouncementsStatus.SENT,
        sent_at: now.toISOString(),
        data: enriched.data,
        deep_link: enriched.deep_link,
      });
      result.sent += 1;
    } catch (error) {
      console.error(
        `Failed to dispatch scheduled announcement ${announcement.$id}:`,
        error
      );
      await db
        .updateRow("app", "announcements", announcement.$id, {
          status: AnnouncementsStatus.FAILED,
        })
        .catch(() => {
          // Best-effort; leave it scheduled to retry on the next run.
        });
      result.failed += 1;
    }
  }

  return result;
}
