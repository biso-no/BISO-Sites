import "server-only";

/**
 * The send engine for big event messages, shared by admin's "Send now" and
 * the api cron (scheduled and automatic messages).
 *
 * A run claims the message (`scheduled` → `sending`, then reads it back and
 * goes on only when its own claim stuck; Appwrite has no transactions), or
 * goes on from a claim its caller made (`claimedAt`). While `sending`,
 * `sent_at` holds the claim time; a message left in `sending` with no write
 * for 10 minutes may be claimed again, and so may an automatic message that
 * failed at least 10 minutes ago and was due within the last 2 hours (ruling
 * R33). Each run then:
 * 1. works out who gets it and how (load.ts);
 * 2. writes one recipient row per person (kept from earlier runs);
 * 3. pushes, one `announcements` row per group of people whose push text is
 *    identical, at most 100 people per push (plan M1), and stamps
 *    `pushed_at`;
 * 4. queues emails and SMS in the delivery queue (plan M2), one email per
 *    address and identical text (Stage 3 ruling R10);
 * 5. writes the counts and `sent`.
 * A retry only pushes people without `pushed_at` and only queues deliveries
 * nobody queued yet (plan M8). A step that throws marks the message `failed`
 * with the counts so far, and the error is rethrown; a failed manual message
 * goes out again only by "Try again", which claims it itself.
 */

import { ID, type Messaging, Query, type TablesDB } from "@repo/api";
import { orNullIfNotFound } from "@repo/api/errors";
import { mapWithConcurrency } from "../../utils/concurrency";
import { BIG_EVENT_TABLES } from "../tables";
import type { BigEventMessageRecipientRow, BigEventMessageRow } from "../types";
import { queueDeliveries, type SendTarget, sendPushes } from "./channels";
import { listAll, loadDelivery } from "./load";
import { type PlannedRecipient, parseStoredVars, serializeVars } from "./plan";
import type { UsersApi } from "./push-targets";

export interface SendDeps {
  db: TablesDB;
  /** Whether the `big_events_sms` switch is on. */
  isSmsEnabled: () => Promise<boolean>;
  messaging: Messaging;
  now?: () => Date;
  users: UsersApi;
  /** The public website, when known. Not used by the send itself yet. */
  webBase?: string;
}

export interface SendOptions {
  /**
   * The caller already claimed the message: its `sent_at` when it set it to
   * `sending`. The send goes on from that claim while it still holds.
   */
  claimedAt?: string;
}

/** People the message is for, and how many of them each channel covers. */
export interface SendCounts {
  email: number;
  push: number;
  recipients: number;
  sms: number;
}

/**
 * `busy`: another run is sending it, or it failed (a manual message is sent
 * again only by "Try again"; an automatic one by the cron, ruling R33).
 */
export type SendError = "already_sent" | "busy" | "not_found";

export type SendResult =
  | { counts: SendCounts; ok: true }
  | { error: SendError; ok: false };

const DB = "app";
const MESSAGES = BIG_EVENT_TABLES.messages;
const RECIPIENTS = BIG_EVENT_TABLES.messageRecipients;
const STALE_AFTER_MS = 10 * 60_000;
/** A failed automatic message due longer ago than this is left alone (R33). */
const RETRY_WINDOW_MS = 2 * 60 * 60_000;
const WRITE_CONCURRENCY = 8;
const CONFLICT = 409;

function isConflict(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === CONFLICT;
}

function countColumns(counts: SendCounts) {
  return {
    email_count: counts.email,
    push_count: counts.push,
    recipients: counts.recipients,
    sms_count: counts.sms,
  };
}

// ── Claim ─────────────────────────────────────────────────────────────────────

type Claim =
  | { message: BigEventMessageRow; ok: true }
  | { error: SendError; ok: false };

/** The row is `sending` under the caller's own claim. */
function heldBy(row: BigEventMessageRow, claimedAt: string): boolean {
  return (
    row.status === "sending" &&
    row.sent_at !== null &&
    Date.parse(row.sent_at) === Date.parse(claimedAt)
  );
}

/**
 * Whether a run may claim it: scheduled; `sending` with no write for 10
 * minutes; or automatic, failed at least 10 minutes ago and due within the
 * last 2 hours (ruling R33).
 */
function claimable(row: BigEventMessageRow, now: Date): boolean {
  const quiet = Date.parse(row.$updatedAt) <= now.getTime() - STALE_AFTER_MS;
  switch (row.status ?? "scheduled") {
    case "scheduled":
      return true;
    case "sending":
      return quiet;
    case "failed":
      return (
        row.kind !== "manual" &&
        quiet &&
        row.scheduled_at !== null &&
        Date.parse(row.scheduled_at) >= now.getTime() - RETRY_WINDOW_MS
      );
    default:
      return false;
  }
}

async function claim(
  db: TablesDB,
  id: string,
  now: Date,
  claimedAt: string | undefined
): Promise<Claim> {
  const row = await orNullIfNotFound(
    db.getRow<BigEventMessageRow>(DB, MESSAGES, id)
  );
  if (!row) {
    return { error: "not_found", ok: false };
  }
  if (claimedAt && heldBy(row, claimedAt)) {
    return { message: row, ok: true };
  }
  if (row.status === "sent") {
    return { error: "already_sent", ok: false };
  }
  if (!claimable(row, now)) {
    return { error: "busy", ok: false };
  }
  await db.updateRow(DB, MESSAGES, id, {
    sent_at: now.toISOString(),
    status: "sending",
  });
  const fresh = await db.getRow<BigEventMessageRow>(DB, MESSAGES, id);
  const ours =
    fresh.status === "sending" &&
    fresh.sent_at !== null &&
    Date.parse(fresh.sent_at) === now.getTime();
  return ours ? { message: fresh, ok: true } : { error: "busy", ok: false };
}

// ── Recipient rows ────────────────────────────────────────────────────────────

/** One row per person; rows from an earlier run are kept as they are. */
async function recipientRows(
  db: TablesDB,
  message: BigEventMessageRow,
  planned: PlannedRecipient[]
): Promise<SendTarget[]> {
  const byMessage = [Query.equal("message_id", message.$id)];
  const rows = new Map(
    (await listAll<BigEventMessageRecipientRow>(db, RECIPIENTS, byMessage)).map(
      (row) => [row.participant_id, row]
    )
  );
  let conflict = false;
  const missing = planned.filter((person) => !rows.has(person.participantId));
  const created = await mapWithConcurrency(
    missing,
    WRITE_CONCURRENCY,
    async (person) => {
      try {
        return await db.createRow<BigEventMessageRecipientRow>(
          DB,
          RECIPIENTS,
          ID.unique(),
          {
            big_event_id: message.big_event_id,
            email: person.email,
            message_id: message.$id,
            participant_id: person.participantId,
            push: person.push,
            pushed_at: null,
            sms: person.sms,
            user_id: person.userId,
            vars: serializeVars(person.vars),
          }
        );
      } catch (error) {
        if (!isConflict(error)) {
          throw error;
        }
        conflict = true;
        return null;
      }
    }
  );
  for (const row of created) {
    if (row) {
      rows.set(row.participant_id, row);
    }
  }
  if (conflict) {
    // Another run wrote some rows first: use theirs.
    for (const row of await listAll<BigEventMessageRecipientRow>(
      db,
      RECIPIENTS,
      byMessage
    )) {
      if (!rows.has(row.participant_id)) {
        rows.set(row.participant_id, row);
      }
    }
  }
  return planned.flatMap((person) => {
    const row = rows.get(person.participantId);
    // The stored copy is what every channel and the email queue use.
    return row
      ? [
          {
            planned: person,
            row,
            vars: parseStoredVars(row.vars) ?? person.vars,
          },
        ]
      : [];
  });
}

// ── Send ──────────────────────────────────────────────────────────────────────

async function deliver(
  deps: SendDeps,
  message: BigEventMessageRow,
  counts: SendCounts,
  now: () => Date
): Promise<void> {
  const { db } = deps;
  const sms = Boolean(message.also_sms) && (await deps.isSmsEnabled());
  const { event, planned } = await loadDelivery(deps, message, sms);
  counts.recipients = planned.length;
  const targets = await recipientRows(db, message, planned);
  counts.push = targets.filter((target) => target.row.pushed_at).length;

  const ctx = { db, event, message, messaging: deps.messaging, now };
  await sendPushes(ctx, targets, async (people, write) => {
    counts.push += people;
    // Progress, which also tells other runs this one is still going. None
    // once a push has failed: the failed mark carries the count (R39).
    if (write) {
      await db.updateRow(DB, MESSAGES, message.$id, countColumns(counts));
    }
  });
  Object.assign(counts, await queueDeliveries(ctx, targets, sms));
  await db.updateRow(DB, MESSAGES, message.$id, {
    ...countColumns(counts),
    sent_at: now().toISOString(),
    status: "sent",
  });
}

/**
 * Sends a big event message by push, email and SMS (plan M1–M3, M8).
 * Refusals come back as `{ ok: false }`; anything unexpected marks the
 * message `failed` and throws.
 */
export async function sendMessage(
  deps: SendDeps,
  messageId: string,
  options: SendOptions = {}
): Promise<SendResult> {
  const now = deps.now ?? (() => new Date());
  const claimed = await claim(deps.db, messageId, now(), options.claimedAt);
  if (!claimed.ok) {
    return claimed;
  }
  const counts: SendCounts = { email: 0, push: 0, recipients: 0, sms: 0 };
  try {
    await deliver(deps, claimed.message, counts, now);
  } catch (error) {
    try {
      await deps.db.updateRow(DB, MESSAGES, messageId, {
        ...countColumns(counts),
        status: "failed",
      });
    } catch {
      // Left in `sending`: it may be claimed again after 10 minutes.
    }
    throw error;
  }
  return { counts, ok: true };
}
