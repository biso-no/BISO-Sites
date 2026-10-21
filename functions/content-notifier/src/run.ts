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
 * `sent` and `skipped` are final, and so is any lock carrying an
 * `announcement_id`/`sent_at`: updates are partial, so those survive a stale
 * write that changed the status. Event-driven status writes and the dispatch
 * re-check re-read the lock first; the mark-sent loop writes right after the
 * announcement is created, off the lock read that listed the item as due.
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
  /**
   * MUST be a partial update (`db.updateRow`), never an upsert or a replace:
   * the "sent is final" guarantee relies on `announcement_id` and `sent_at`
   * surviving later writes that only carry a status, channel or due time.
   */
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
type LockTarget =
  | { eligible: false; reason: string }
  | {
      campusId: string | null;
      channel: string;
      /** Computed only when a lock (re)opens, so re-saves keep the due time. */
      dueAt: () => string;
      eligible: true;
    };

/** What the dispatch re-check decided for one due lock. */
type DueCheck =
  | { kind: "cancelled" }
  | { item: NotifyItem; kind: "send" }
  | { kind: "skipped" };

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

/** The lock was marked sent at some point, whatever its status says now. */
function wasSent(lock: ContentNotifications): boolean {
  return Boolean(lock.announcement_id || lock.sent_at);
}

/** A lock reopened after listing carries a new, later due time. */
function isDueBy(lock: ContentNotifications, now: Date): boolean {
  return (
    lock.due_at !== null && new Date(lock.due_at).getTime() <= now.getTime()
  );
}

function isFinal(lock: ContentNotifications): boolean {
  return (
    wasSent(lock) ||
    lock.status === ContentNotificationsStatus.SENT ||
    lock.status === ContentNotificationsStatus.SKIPPED
  );
}

/** Put `sent` back on a lock that went out but was overwritten by a stale write. */
async function restoreSent(
  deps: NotifierDeps,
  lock: ContentNotifications
): Promise<void> {
  if (!wasSent(lock) || lock.status === ContentNotificationsStatus.SENT) {
    return;
  }
  deps.log(
    `Lock ${lock.$id} went out but reads ${lock.status}; restoring sent`
  );
  await deps.updateLock(lock.$id, { status: ContentNotificationsStatus.SENT });
}

/**
 * Write only if the lock still has the status the decision was based on, so
 * an older read never overwrites a newer state (such as `sent`).
 */
async function updateIfStill(
  deps: NotifierDeps,
  lockId: string,
  expected: ContentNotificationsStatus,
  data: LockPatch
): Promise<boolean> {
  const current = await deps.getLock(lockId);
  if (!current || current.status !== expected || isFinal(current)) {
    return false;
  }
  await deps.updateLock(lockId, data);
  return true;
}

function targetFor(
  deps: NotifierDeps,
  type: NotifyContentType,
  row: Record<string, unknown>,
  now: Date
): LockTarget {
  const eligibility = eligibilityFor(type, row, now);
  if (!eligibility.ok) {
    return { eligible: false, reason: eligibility.reason };
  }
  const campusId = stringOrNull(row.campus_id);
  return {
    campusId,
    channel: channelFor(type, campusId),
    dueAt: () =>
      dueAtFor({
        delayMinutes: deps.delayMinutes,
        now,
        scheduledPublishAt: stringOrNull(row.scheduled_publish_at),
      }).toISOString(),
    eligible: true,
  };
}

/** Apply the state machine to an existing lock. */
async function advanceLock(
  deps: NotifierDeps,
  lockId: string,
  lock: ContentNotifications,
  target: LockTarget
): Promise<ContentChangeResult> {
  if (isFinal(lock)) {
    await restoreSent(deps, lock);
    return "unchanged";
  }

  if (lock.status === ContentNotificationsStatus.PENDING) {
    if (!target.eligible) {
      const cancelled = await updateIfStill(
        deps,
        lockId,
        ContentNotificationsStatus.PENDING,
        { reason: target.reason, status: ContentNotificationsStatus.CANCELLED }
      );
      return cancelled ? "cancelled" : "unchanged";
    }
    // Moved to another campus: follow it, but keep the original due time.
    if (lock.channel !== target.channel || lock.campus_id !== target.campusId) {
      await updateIfStill(deps, lockId, ContentNotificationsStatus.PENDING, {
        campus_id: target.campusId,
        channel: target.channel,
      });
    }
    return "unchanged";
  }

  if (lock.status === ContentNotificationsStatus.CANCELLED && target.eligible) {
    const reopened = await updateIfStill(
      deps,
      lockId,
      ContentNotificationsStatus.CANCELLED,
      {
        campus_id: target.campusId,
        channel: target.channel,
        due_at: target.dueAt(),
        reason: null,
        status: ContentNotificationsStatus.PENDING,
      }
    );
    return reopened ? "reopened" : "unchanged";
  }

  // A cancelled lock stays put while the item is ineligible.
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
  const target: LockTarget = row
    ? targetFor(deps, type, row, now)
    : { eligible: false, reason: DELETED_REASON };

  if (lock) {
    return await advanceLock(deps, lockId, lock, target);
  }
  if (!target.eligible) {
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

/** Re-fetch a due item and decide whether it may still go out. */
async function recheckDue(
  deps: NotifierDeps,
  lock: ContentNotifications,
  now: Date
): Promise<DueCheck> {
  const type: NotifyContentType = lock.content_type;
  const row = await deps.getContent(type, lock.content_id);
  const eligibility: Eligibility = row
    ? eligibilityFor(type, row, now)
    : { ok: false, reason: DELETED_REASON };

  // Re-read right before deciding: an event may have moved the lock since it
  // was listed, or a stale write may have put a sent lock back to pending.
  const current = await deps.getLock(lock.$id);
  if (
    !current ||
    current.status !== ContentNotificationsStatus.PENDING ||
    isFinal(current) ||
    !isDueBy(current, now)
  ) {
    if (current) {
      await restoreSent(deps, current);
    }
    return { kind: "skipped" };
  }

  if (!(row && eligibility.ok)) {
    await deps.updateLock(lock.$id, {
      reason: eligibility.ok ? DELETED_REASON : eligibility.reason,
      status: ContentNotificationsStatus.CANCELLED,
    });
    return { kind: "cancelled" };
  }

  const translations = await deps.getTranslations(type, lock.content_id);
  return { item: toNotifyItem(type, row, translations), kind: "send" };
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
    // The channel and campus are the ones the push actually went to.
    const sentAt = now.toISOString();
    for (const { item, lockId } of entries) {
      await deps.updateLock(lockId, {
        announcement_id: announcement.$id,
        campus_id: item.campusId,
        channel: item.channel,
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
 * Re-check every due lock and group the items that may go out by the channel
 * their current row maps to. A failing re-check leaves only that lock pending.
 */
async function collectDue(
  deps: NotifierDeps,
  now: Date,
  result: DispatchResult
): Promise<Map<string, DueItem[]>> {
  const groups = new Map<string, DueItem[]>();
  for (const lock of await deps.listDueLocks(now, DUE_PAGE_SIZE)) {
    let check: DueCheck;
    try {
      check = await recheckDue(deps, lock, now);
    } catch (error) {
      deps.log(
        `Could not re-check lock ${lock.$id}; it stays pending: ${errorMessage(error)}`
      );
      continue;
    }
    if (check.kind === "cancelled") {
      result.cancelled += 1;
    } else if (check.kind === "send") {
      const group = groups.get(check.item.channel) ?? [];
      group.push({ item: check.item, lockId: lock.$id });
      groups.set(check.item.channel, group);
    }
  }
  return groups;
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
  const groups = await collectDue(deps, now, result);

  for (const [channel, entries] of groups) {
    if (await sendGroup(deps, channel, entries, now)) {
      result.announcements += 1;
      result.sent += entries.length;
    }
  }

  return result;
}
