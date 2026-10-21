/**
 * Content-notifier core with injected I/O, so the lock state machine and the
 * send order are testable without Appwrite. `main.ts` wires the real
 * dependencies.
 *
 * One lock row per piece of content (`content_notifications`):
 *   none ──eligible──▶ pending ──due──▶ sent
 *                        │  ▲
 *            ineligible  │  │ eligible again (new due time)
 *                        ▼  │
 *                      cancelled
 * `sent` and `skipped` are final.
 */

import {
  type Announcements,
  type ContentNotifications,
  ContentNotificationsStatus,
} from "@repo/api/types/appwrite";
import {
  type AutoAnnouncementColumns,
  composeAutoAnnouncement,
  type NotifyItem,
  toNotifyItem,
} from "@repo/shared/utils/content-notification-compose";
import {
  channelFor,
  dueAtFor,
  type Eligibility,
  eligibilityFor,
  lockRowIdFor,
  type NotifyContentType,
} from "@repo/shared/utils/content-notifications";

/** How many due locks one dispatch run reads; the rest wait for the next run. */
export const DUE_PAGE_SIZE = 100;

const DELETED_REASON = "deleted";

/** The translation columns `toNotifyItem` reads. */
export type TranslationRow = Parameters<typeof toNotifyItem>[2][number];

/** Columns written when a lock row is created. */
export interface NewLock {
  campus_id: string | null;
  channel: string;
  content_id: string;
  content_type: NotifyContentType;
  due_at: string;
  reason: null;
  status: ContentNotificationsStatus.PENDING;
}

/** Columns a lock update may change. */
export interface LockPatch {
  announcement_id?: string;
  campus_id?: string | null;
  channel?: string;
  due_at?: string;
  reason?: string | null;
  sent_at?: string;
  status?: ContentNotificationsStatus;
}

export interface NotifierDeps {
  createAnnouncement: (
    columns: AutoAnnouncementColumns
  ) => Promise<Announcements>;
  /** Creates the lock row; Appwrite's 409 (already there) maps to "exists". */
  createLock: (lockId: string, data: NewLock) => Promise<"created" | "exists">;
  delayMinutes: number;
  /** Sends the push for an announcement row. */
  dispatch: (announcement: Announcements) => Promise<void>;
  /** The content row, or null when it no longer exists (404). */
  getContent: (
    type: NotifyContentType,
    id: string
  ) => Promise<Record<string, unknown> | null>;
  getLock: (lockId: string) => Promise<ContentNotifications | null>;
  getTranslations: (
    type: NotifyContentType,
    id: string
  ) => Promise<TranslationRow[]>;
  /** Pending locks with `due_at <= now`, oldest due first. */
  listDueLocks: (now: Date, limit: number) => Promise<ContentNotifications[]>;
  log: (msg: string) => void;
  updateLock: (lockId: string, data: LockPatch) => Promise<void>;
}

export type ContentChangeResult =
  | "created"
  | "reopened"
  | "cancelled"
  | "unchanged";

export interface DispatchResult {
  announcements: number;
  cancelled: number;
  sent: number;
}

/** Where a content row says its lock should be, as of one event. */
interface LockTarget {
  campusId: string | null;
  channel: string;
  /** Computed only when a lock (re)opens, so re-saves keep the due time. */
  dueAt: () => string;
  eligibility: Eligibility;
}

interface DueItem {
  item: NotifyItem;
  lockId: string;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function cancelIfPending(
  deps: NotifierDeps,
  lockId: string,
  lock: ContentNotifications,
  reason: string
): Promise<ContentChangeResult> {
  if (lock.status !== ContentNotificationsStatus.PENDING) {
    return "unchanged";
  }
  await deps.updateLock(lockId, {
    reason,
    status: ContentNotificationsStatus.CANCELLED,
  });
  return "cancelled";
}

/** Apply the state machine to an existing lock. */
async function advanceLock(
  deps: NotifierDeps,
  lockId: string,
  lock: ContentNotifications,
  target: LockTarget
): Promise<ContentChangeResult> {
  const { eligibility } = target;

  if (lock.status === ContentNotificationsStatus.PENDING) {
    if (!eligibility.ok) {
      return await cancelIfPending(deps, lockId, lock, eligibility.reason);
    }
    // Moved to another campus: follow it, but keep the original due time.
    if (lock.channel !== target.channel || lock.campus_id !== target.campusId) {
      await deps.updateLock(lockId, {
        campus_id: target.campusId,
        channel: target.channel,
      });
    }
    return "unchanged";
  }

  if (lock.status === ContentNotificationsStatus.CANCELLED && eligibility.ok) {
    await deps.updateLock(lockId, {
      campus_id: target.campusId,
      channel: target.channel,
      due_at: target.dueAt(),
      reason: null,
      status: ContentNotificationsStatus.PENDING,
    });
    return "reopened";
  }

  // `sent` and `skipped` are final; `cancelled` stays put while ineligible.
  return "unchanged";
}

/**
 * React to a create or update of a content row: re-read it and move its lock.
 * A lock is only ever created for an eligible item.
 */
export async function handleContentChange(
  deps: NotifierDeps,
  type: NotifyContentType,
  contentId: string,
  now: Date
): Promise<ContentChangeResult> {
  const lockId = lockRowIdFor(type, contentId);
  const [row, lock] = await Promise.all([
    deps.getContent(type, contentId),
    deps.getLock(lockId),
  ]);

  if (!row) {
    return lock
      ? await cancelIfPending(deps, lockId, lock, DELETED_REASON)
      : "unchanged";
  }

  const campusId = stringOrNull(row.campus_id);
  const target: LockTarget = {
    campusId,
    channel: channelFor(type, campusId),
    dueAt: () =>
      dueAtFor({
        delayMinutes: deps.delayMinutes,
        now,
        scheduledPublishAt: stringOrNull(row.scheduled_publish_at),
      }).toISOString(),
    eligibility: eligibilityFor(type, row, now),
  };

  if (lock) {
    return await advanceLock(deps, lockId, lock, target);
  }
  if (!target.eligibility.ok) {
    return "unchanged";
  }

  const outcome = await deps.createLock(lockId, {
    campus_id: target.campusId,
    channel: target.channel,
    content_id: contentId,
    content_type: type,
    due_at: target.dueAt(),
    reason: null,
    status: ContentNotificationsStatus.PENDING,
  });
  if (outcome === "created") {
    return "created";
  }

  // A concurrent event created the lock first; converge on that one.
  const existing = await deps.getLock(lockId);
  if (!existing) {
    throw new Error(`Lock ${lockId} already exists but could not be read`);
  }
  return await advanceLock(deps, lockId, existing, target);
}

/** Re-fetch a due item; cancel its lock and return null when it may not go out. */
async function recheckDue(
  deps: NotifierDeps,
  lock: ContentNotifications,
  now: Date
): Promise<NotifyItem | null> {
  const type: NotifyContentType = lock.content_type;
  const row = await deps.getContent(type, lock.content_id);
  const eligibility: Eligibility = row
    ? eligibilityFor(type, row, now)
    : { ok: false, reason: DELETED_REASON };

  if (!(row && eligibility.ok)) {
    await deps.updateLock(lock.$id, {
      reason: eligibility.ok ? DELETED_REASON : eligibility.reason,
      status: ContentNotificationsStatus.CANCELLED,
    });
    return null;
  }

  const translations = await deps.getTranslations(type, lock.content_id);
  return toNotifyItem(type, row, translations);
}

/**
 * Record one channel's notification, then push it. Returns false when nothing
 * was recorded; the locks then stay pending for the next run.
 */
async function sendGroup(
  deps: NotifierDeps,
  channel: string,
  entries: DueItem[],
  now: Date
): Promise<boolean> {
  let announcement: Announcements;
  try {
    announcement = await deps.createAnnouncement(
      composeAutoAnnouncement(
        entries.map((entry) => entry.item),
        now
      )
    );
    // Mark sent before the push: a crash after this skips once, never twice.
    const sentAt = now.toISOString();
    for (const { lockId } of entries) {
      await deps.updateLock(lockId, {
        announcement_id: announcement.$id,
        sent_at: sentAt,
        status: ContentNotificationsStatus.SENT,
      });
    }
  } catch (error) {
    deps.log(
      `Could not record the ${channel} notification; nothing pushed: ${errorMessage(error)}`
    );
    return false;
  }

  try {
    await deps.dispatch(announcement);
  } catch (error) {
    deps.log(
      `Push for announcement ${announcement.$id} (${channel}) failed; its locks stay sent: ${errorMessage(error)}`
    );
  }
  return true;
}

/**
 * Send every due pending lock. Items still eligible are grouped by channel;
 * two or more on one channel become a single grouped notification.
 */
export async function dispatchDue(
  deps: NotifierDeps,
  now: Date
): Promise<DispatchResult> {
  const result: DispatchResult = { announcements: 0, cancelled: 0, sent: 0 };
  const groups = new Map<string, DueItem[]>();

  for (const lock of await deps.listDueLocks(now, DUE_PAGE_SIZE)) {
    const item = await recheckDue(deps, lock, now);
    if (!item) {
      result.cancelled += 1;
      continue;
    }
    const group = groups.get(lock.channel) ?? [];
    group.push({ item, lockId: lock.$id });
    groups.set(lock.channel, group);
  }

  for (const [channel, entries] of groups) {
    if (await sendGroup(deps, channel, entries, now)) {
      result.announcements += 1;
      result.sent += entries.length;
    }
  }

  return result;
}
