import { ID, Permission, Query, Role } from "@repo/api";

/** What a student did to a notification in the app's inbox. */
export type NotificationStateAction = "read" | "clear";

/** The most announcement ids one request may carry. */
export const MAX_ANNOUNCEMENT_IDS = 100;

// Appwrite custom ids: up to 36 chars of [a-zA-Z0-9._-], not starting with a symbol.
const ANNOUNCEMENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

const ANNOUNCEMENTS = "announcements";
const USER_NOTIFICATIONS = "user_notifications";

/** The database the state is written with, bound to the "app" database. */
export interface NotificationStateDb {
  createRow(
    table: string,
    id: string,
    data: Record<string, unknown>,
    permissions: string[]
  ): Promise<unknown>;
  listRows<T>(table: string, queries: string[]): Promise<{ rows: T[] }>;
  updateRow(
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown>;
}

interface StateRow {
  $id: string;
  announcement_id: string;
}

/**
 * The announcement ids in a request body, once each and in first-seen order,
 * or null unless the body is `{ announcementIds: string[] }` holding 1 to
 * [MAX_ANNOUNCEMENT_IDS] valid Appwrite ids.
 */
export function parseAnnouncementIds(body: unknown): string[] | null {
  const raw = (body as { announcementIds?: unknown } | null)?.announcementIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const unique = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || !ANNOUNCEMENT_ID_RE.test(id)) {
      return null;
    }
    unique.add(id);
  }
  if (unique.size > MAX_ANNOUNCEMENT_IDS) {
    return null;
  }
  return [...unique];
}

function isConflict(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 409;
}

/**
 * Saves [action] on each of [announcementIds] for [userId], in the student's
 * own `user_notifications` rows.
 *
 * Only ids of existing announcements are written, whatever their status: a
 * push can be tapped before the send that carried it is marked sent. A row is
 * updated when the student has one (a targeted send fans one out) and created
 * otherwise, readable by that student only. A read sets only `read`, so it
 * never brings back a notification cleared elsewhere, and nothing here ever
 * sets either flag back to false.
 *
 * Resolves once every write has landed; rejects if any failed. Writing the
 * same state again is harmless, so the caller may retry the whole request.
 */
export async function applyNotificationState(
  db: NotificationStateDb,
  {
    action,
    announcementIds,
    userId,
  }: {
    action: NotificationStateAction;
    announcementIds: string[];
    userId: string;
  }
): Promise<void> {
  const known = await db.listRows<{ $id: string }>(ANNOUNCEMENTS, [
    Query.equal("$id", announcementIds),
    Query.select(["$id"]),
    Query.limit(announcementIds.length),
  ]);
  const knownIds = known.rows.map((row) => row.$id);
  if (knownIds.length === 0) {
    return;
  }

  const existing = await db.listRows<StateRow>(USER_NOTIFICATIONS, [
    Query.equal("user_id", userId),
    Query.equal("announcement_id", knownIds),
    Query.limit(knownIds.length),
  ]);
  const rowIdByAnnouncement = new Map(
    existing.rows.map((row) => [row.announcement_id, row.$id])
  );

  const update =
    action === "clear" ? { cleared: true, read: true } : { read: true };

  const findRowId = async (announcementId: string) => {
    const found = await db.listRows<StateRow>(USER_NOTIFICATIONS, [
      Query.equal("user_id", userId),
      Query.equal("announcement_id", announcementId),
      Query.limit(1),
    ]);
    const rowId = found.rows[0]?.$id;
    if (!rowId) {
      throw new Error("user_notifications row vanished after a conflict");
    }
    return rowId;
  };

  const write = async (announcementId: string) => {
    const rowId = rowIdByAnnouncement.get(announcementId);
    if (rowId) {
      await db.updateRow(USER_NOTIFICATIONS, rowId, update);
      return;
    }
    try {
      await db.createRow(
        USER_NOTIFICATIONS,
        ID.unique(),
        {
          announcement_id: announcementId,
          cleared: action === "clear",
          read: true,
          user_id: userId,
        },
        [Permission.read(Role.user(userId))]
      );
    } catch (error) {
      if (!isConflict(error)) {
        throw error;
      }
      // Another request created the row first.
      await db.updateRow(
        USER_NOTIFICATIONS,
        await findRowId(announcementId),
        update
      );
    }
  };

  await Promise.all(knownIds.map(write));
}
