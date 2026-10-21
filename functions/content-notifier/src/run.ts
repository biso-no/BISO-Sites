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
 *
 * A group's announcement row id is derived from its lock ids, so a second
 * dispatch of the same group finds the row (409) and marks the locks sent
 * without pushing again.
 */

import { createHash } from "node:crypto";
import {
  type Announcements,
  type ContentNotifications,
  ContentNotificationsStatus,
} from "@repo/api/types/appwrite";
import {
  type AutoAnnouncementColumns,
  composeAutoAnnouncement,
  hasNotifyTitle,
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
const NO_TITLE_REASON = "no title";
const ANNOUNCEMENT_ID_PREFIX = "auto_";
const MAX_ROW_ID_LENGTH = 36;

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
  /**
   * Creates the announcement row under `id`. When the id is taken (Appwrite's
   * 409), resolves with the existing row and `created: false`.
   */
  createAnnouncement: (
    id: string,
    columns: AutoAnnouncementColumns
  ) => Promise<{ announcement: Announcements; created: boolean }>;
  /** Creates the lock row; Appwrite's 409 (already there) maps to "exists". */
  createLock: (lockId: string, data: NewLock) => Promise<"created" | "exists">;
  delayMinutes: number;
  /** Sends the push for an announcement row. */
  dispatch: (announcement: Announcements) => Promise<void>;
  /** Logs a failure the operator should see. */
  error: (msg: string) => void;
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
  /** Announcements created and pushed (or attempted) by this run. */
  announcements: number;
  cancelled: number;
  /** Re-checks and groups that failed; the handler answers 500 when > 0. */
  failed: number;
  /** Locks this run marked sent. */
  sent: number;
}

/** Where a content row says its lock should be, as of one event. */
type LockTarget =
  | { eligible: false; reason: string }
  | {
      campusId: string | null;
      channel: string;
      /** Used only when a lock (re)opens, so re-saves keep the due time. */
      dueAt: string;
      eligible: true;
      /**
       * The due time the item's schedule sets, when the schedule rather than
       * the delay decides it. A pending lock moves to it when it is later.
       */
      scheduledDueAt: string | null;
    };

/** What the dispatch re-check decided for one due lock. */
type DueCheck =
  | { kind: "cancelled" }
  | { kind: "held" }
  | { item: NotifyItem; kind: "send" }
  | { kind: "skipped" };

/** How one channel's group ended. */
type GroupOutcome = "existing" | "failed" | "push-failed" | "sent";

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

/**
 * The publish time that holds the push back. An event keeps its last
 * scheduled date after it is switched to "Publish now", so only a scheduled
 * event counts it. Scheduled jobs stay drafts until they go live, and
 * `publishDueJobs` clears the date then.
 */
function scheduledPublishAtFor(
  type: NotifyContentType,
  row: Record<string, unknown>
): string | null {
  if (type === "event" && row.publish_mode !== "scheduled") {
    return null;
  }
  return stringOrNull(row.scheduled_publish_at);
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
  const scheduledPublishAt = scheduledPublishAtFor(type, row);
  const { delayMinutes } = deps;
  const dueAt = dueAtFor({ delayMinutes, now, scheduledPublishAt });
  const scheduleDecides =
    dueAt.getTime() > dueAtFor({ delayMinutes, now }).getTime();
  return {
    campusId,
    channel: channelFor(type, campusId),
    dueAt: dueAt.toISOString(),
    eligible: true,
    scheduledDueAt: scheduleDecides ? dueAt.toISOString() : null,
  };
}

/** Whether `candidate` is later than the lock's stored due time. */
function isLaterThanDue(
  lock: ContentNotifications,
  candidate: string
): boolean {
  return (
    lock.due_at === null ||
    new Date(candidate).getTime() > new Date(lock.due_at).getTime()
  );
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
    // Moved to another campus: follow it. Keep the due time unless the item's
    // schedule moved later; a plain re-save never pushes it back.
    const patch: LockPatch = {};
    if (lock.channel !== target.channel || lock.campus_id !== target.campusId) {
      patch.campus_id = target.campusId;
      patch.channel = target.channel;
    }
    if (
      target.scheduledDueAt !== null &&
      isLaterThanDue(lock, target.scheduledDueAt)
    ) {
      patch.due_at = target.scheduledDueAt;
    }
    if (Object.keys(patch).length > 0) {
      await updateIfStill(
        deps,
        lockId,
        ContentNotificationsStatus.PENDING,
        patch
      );
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
        due_at: target.dueAt,
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
    due_at: target.dueAt,
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

  // Due just before the night but dispatched inside it: wait for the morning.
  const morning = dueAtFor({ delayMinutes: 0, now });
  if (morning.getTime() > now.getTime()) {
    await deps.updateLock(lock.$id, { due_at: morning.toISOString() });
    deps.log(
      `Lock ${lock.$id} came due at night; moved to ${morning.toISOString()}`
    );
    return { kind: "held" };
  }

  const translations = await deps.getTranslations(type, lock.content_id);
  const item = toNotifyItem(type, row, translations);
  if (!hasNotifyTitle(item)) {
    await deps.updateLock(lock.$id, {
      reason: NO_TITLE_REASON,
      status: ContentNotificationsStatus.CANCELLED,
    });
    deps.log(`Lock ${lock.$id} has no title or slug; left out and cancelled`);
    return { kind: "cancelled" };
  }
  return { item, kind: "send" };
}

/**
 * The announcement row id for a group: `auto_` plus the start of the sha256
 * of its sorted lock ids, 36 characters in all. The same group always gets
 * the same id, so a second dispatch of it collides instead of pushing twice.
 */
export function announcementIdFor(lockIds: string[]): string {
  const hash = createHash("sha256")
    .update([...lockIds].sort().join(","))
    .digest("hex");
  return `${ANNOUNCEMENT_ID_PREFIX}${hash.slice(0, MAX_ROW_ID_LENGTH - ANNOUNCEMENT_ID_PREFIX.length)}`;
}

/** Mark sent before the push: a crash after this skips once, never twice. */
async function markSent(
  deps: NotifierDeps,
  entries: DueItem[],
  announcementId: string,
  now: Date
): Promise<void> {
  // The channel and campus are the ones the push actually went to.
  const sentAt = now.toISOString();
  for (const { item, lockId } of entries) {
    await deps.updateLock(lockId, {
      announcement_id: announcementId,
      campus_id: item.campusId,
      channel: item.channel,
      sent_at: sentAt,
      status: ContentNotificationsStatus.SENT,
    });
  }
}

/**
 * Record one channel's notification, mark its locks sent, then push it. When
 * the announcement or a lock write fails, nothing is pushed and the unmarked
 * locks stay pending for the next run. When another dispatch already recorded
 * this group, its locks are marked sent and nothing is pushed.
 */
async function sendGroup(
  deps: NotifierDeps,
  channel: string,
  entries: DueItem[],
  now: Date
): Promise<GroupOutcome> {
  const announcementId = announcementIdFor(
    entries.map((entry) => entry.lockId)
  );
  let announcement: Announcements;
  let created: boolean;
  try {
    ({ announcement, created } = await deps.createAnnouncement(
      announcementId,
      composeAutoAnnouncement(
        entries.map((entry) => entry.item),
        now
      )
    ));
  } catch (error) {
    deps.error(
      `Could not record the ${channel} notification; nothing pushed: ${errorMessage(error)}`
    );
    return "failed";
  }

  try {
    await markSent(deps, entries, announcement.$id, now);
  } catch (error) {
    deps.error(
      `Announcement ${announcement.$id} (${channel}) is recorded but its locks could not all be marked sent; nothing pushed: ${errorMessage(error)}`
    );
    return "failed";
  }

  if (!created) {
    deps.log(
      `Announcement ${announcement.$id} (${channel}) already existed; marked its locks sent without pushing`
    );
    return "existing";
  }

  try {
    await deps.dispatch(announcement);
  } catch (error) {
    deps.error(
      `Push for announcement ${announcement.$id} (${channel}) failed; its locks stay sent: ${errorMessage(error)}`
    );
    return "push-failed";
  }
  return "sent";
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
      deps.error(
        `Could not re-check lock ${lock.$id}; it stays pending: ${errorMessage(error)}`
      );
      result.failed += 1;
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
  const result: DispatchResult = {
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  };
  const groups = await collectDue(deps, now, result);

  for (const [channel, entries] of groups) {
    const outcome = await sendGroup(deps, channel, entries, now);
    if (outcome === "failed") {
      result.failed += 1;
      continue;
    }
    result.sent += entries.length;
    if (outcome !== "existing") {
      result.announcements += 1;
    }
    if (outcome === "push-failed") {
      result.failed += 1;
    }
  }

  return result;
}
