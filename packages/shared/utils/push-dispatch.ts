import {
  ID,
  MessagePriority,
  type Messaging,
  Permission,
  Query,
  Role,
  type TablesDB,
} from "@repo/api";
import {
  type Announcements,
  AnnouncementsAudienceType,
  type SegmentMembers,
  type UserNotifications,
  type Users,
} from "@repo/api/types/appwrite";
import {
  localizedTopicId,
  PUSH_LOCALES,
  type PushLocale,
  resolvePushChannel,
} from "./notification-topics";

/** Appwrite list pagination ceiling for a single `Query.limit` call. */
const SEGMENT_MEMBER_PAGE_SIZE = 200;
/** How many user ids go into one `Query.equal("$id", …)` lookup. */
const USER_LOCALE_CHUNK_SIZE = 100;

export interface DispatchClients {
  db: TablesDB;
  messaging: Messaging;
}

export interface LocalizedPush {
  body: string;
  title: string;
}

/**
 * The string→string push `data` map contract shared with the Flutter app.
 * Missing ids are empty strings (never absent) so the client can read them
 * unconditionally.
 */
export function buildPushData(
  announcement: Announcements
): Record<string, string> {
  return {
    type: "announcement",
    announcement_id: announcement.$id,
    content_type: announcement.content_type ?? "",
    content_id: announcement.content_id ?? "",
    deep_link: announcement.deep_link ?? buildDeepLink(announcement),
    category: announcement.category ?? "general",
  };
}

/**
 * `biso://<content_type>?id=<content_id>` when content is attached, the legacy
 * `biso://event?id=<event_id>` for old rows, otherwise
 * `biso://announcement?id=<announcement_id>`.
 */
export function buildDeepLink(
  announcement: Pick<
    Announcements,
    "$id" | "content_type" | "content_id" | "event_id"
  >
): string {
  if (announcement.content_type && announcement.content_id) {
    return `biso://${announcement.content_type}?id=${announcement.content_id}`;
  }
  if (announcement.event_id) {
    return `biso://event?id=${announcement.event_id}`;
  }
  return `biso://announcement?id=${announcement.$id}`;
}

const HTML_TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Strip HTML tags, decode a handful of common entities, and collapse
 * whitespace. Announcement bodies are stored as rich HTML, but pushes carry
 * plain text, so dispatch flattens them here.
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
 * Title/body per push language. Each language uses its own text and falls back
 * to the other when missing. Bodies are flattened to plain text first, so a
 * body that is only markup (e.g. `<p>&nbsp;</p>`) counts as missing.
 */
export function localizedPushContent(
  a: Pick<Announcements, "title_en" | "title_no" | "body_en" | "body_no">
): Record<PushLocale, LocalizedPush> {
  const titleEn = a.title_en?.trim() ?? "";
  const titleNo = a.title_no?.trim() ?? "";
  const bodyEn = htmlToPlainText(a.body_en);
  const bodyNo = htmlToPlainText(a.body_no);
  return {
    no: {
      title: titleNo || titleEn,
      body: bodyNo || bodyEn,
    },
    en: {
      title: titleEn || titleNo,
      body: bodyEn || bodyNo,
    },
  };
}

/** Urgent announcements are delivered at high priority. */
export function pushPriorityFor(
  category: string | null | undefined
): MessagePriority {
  return category === "urgent" ? MessagePriority.High : MessagePriority.Normal;
}

/**
 * Split user ids by their stored language. Norwegian users go to `no`;
 * everything else (English, unset, missing row, failed lookup) goes to `en`.
 */
export async function groupUserIdsByLocale(
  db: TablesDB,
  userIds: string[]
): Promise<Record<PushLocale, string[]>> {
  const ids = Array.from(new Set(userIds));
  const grouped: Record<PushLocale, string[]> = { no: [], en: [] };

  for (let i = 0; i < ids.length; i += USER_LOCALE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + USER_LOCALE_CHUNK_SIZE);
    const localeById = new Map<string, string | null>();
    try {
      const page = await db.listRows<Users>("app", "user", [
        Query.equal("$id", chunk),
        Query.select(["$id", "locale"]),
        Query.limit(chunk.length),
      ]);
      for (const row of page.rows) {
        localeById.set(row.$id, row.locale);
      }
    } catch (error) {
      console.error("Failed to look up user locales:", error);
    }
    for (const id of chunk) {
      grouped[localeById.get(id) === "no" ? "no" : "en"].push(id);
    }
  }

  return grouped;
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
  db: TablesDB,
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
  db: TablesDB,
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
 * Flutter app can read exactly the right rows. Best-effort: failures are
 * logged and don't abort the send.
 */
async function applyAnnouncementReadPermissions(
  db: TablesDB,
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
 * Result of dispatching a single announcement.
 *
 * `topic` is the language-neutral channel the push went to: for a TOPIC
 * audience e.g. `events_bergen`, for a BROADCAST `general_bergen` (one campus)
 * or `general` (everyone). Callers persist it back onto the row's
 * `audience_value` so the app inbox can filter on it. SEGMENT and USERS
 * audiences never carry a topic.
 */
export interface DispatchAnnouncementResult {
  recipients: number;
  topic?: string;
}

interface PushTarget {
  topics?: string[];
  users?: string[];
}

/** Send one push; failures are logged and swallowed. */
async function sendPush(
  messaging: Messaging,
  content: LocalizedPush,
  target: PushTarget,
  data: Record<string, string>,
  priority: MessagePriority
): Promise<void> {
  try {
    await messaging.createPush({
      messageId: ID.unique(),
      title: content.title,
      body: content.body,
      ...target,
      data,
      priority,
    });
  } catch (error) {
    console.error("Failed to send announcement push:", error);
  }
}

/**
 * Send the push for an announcement (one per language) and, for user-targeted
 * sends, fan out in-app `user_notifications` rows.
 *
 * The row's read permissions are set before any push goes out, so a fast tap
 * on the push's `biso://announcement?id=` link never lands on a row the app
 * cannot read yet. Order: permissions → push(es) → `user_notifications`.
 *
 * Push failures are logged but swallowed so the caller can still mark the
 * announcement as sent.
 */
export async function dispatchAnnouncement(
  announcement: Announcements,
  clients: DispatchClients
): Promise<DispatchAnnouncementResult> {
  const { db, messaging } = clients;
  const content = localizedPushContent(announcement);
  const data = buildPushData(announcement);
  const priority = pushPriorityFor(announcement.category);

  const channel = resolvePushChannel(
    announcement.audience_type,
    announcement.audience_value,
    announcement.campus_id
  );

  if (channel !== null) {
    // Topic/broadcast rows are readable by any signed-in student so they
    // surface in the in-app feed (the row carries the body, which is
    // non-sensitive here).
    await applyAnnouncementReadPermissions(db, announcement.$id, [
      Permission.read(Role.users()),
    ]);
    if (announcement.push) {
      for (const locale of PUSH_LOCALES) {
        await sendPush(
          messaging,
          content[locale],
          { topics: [localizedTopicId(channel, locale)] },
          data,
          priority
        );
      }
    }
    // Topic/broadcast pushes are surfaced in-app by querying announcements,
    // so we do not fan out user_notifications rows here.
    return { recipients: 0, topic: channel };
  }

  // `segment` resolves audience_value as a segment_id → its assigned members.
  // `users` treats audience_value as a JSON array of user ids.
  const rawUserIds =
    announcement.audience_type === AnnouncementsAudienceType.SEGMENT
      ? await collectSegmentUserIds(db, announcement.audience_value ?? "")
      : parseUserIds(announcement.audience_value);
  const userIds = Array.from(new Set(rawUserIds));

  if (userIds.length === 0) {
    return { recipients: 0 };
  }

  // Targeted/segment bodies are personal: restrict row read to the recipients
  // so they are not world-readable (row security is on for announcements).
  await applyAnnouncementReadPermissions(
    db,
    announcement.$id,
    userIds.map((userId) => Permission.read(Role.user(userId)))
  );

  if (announcement.push) {
    const byLocale = await groupUserIdsByLocale(db, userIds);
    for (const locale of PUSH_LOCALES) {
      if (byLocale[locale].length === 0) {
        continue;
      }
      await sendPush(
        messaging,
        content[locale],
        { users: byLocale[locale] },
        data,
        priority
      );
    }
  }

  await fanOutUserNotifications(db, announcement.$id, userIds);

  return { recipients: userIds.length };
}
