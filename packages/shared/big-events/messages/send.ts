import "server-only";

/**
 * The send engine for big event messages, shared by admin's "Send now" and
 * the api cron (scheduled and automatic messages).
 *
 * A run claims the message (`scheduled` → `sending`, then reads it back and
 * goes on only when its own claim stuck; Appwrite has no transactions). While
 * `sending`, `sent_at` holds the claim time; a message left in `sending` with
 * no write for 10 minutes may be claimed again. Each run then:
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
 * with the counts so far, and the error is rethrown; "Try again" sets a
 * failed message back to `scheduled`.
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
  /** The public website. Not used by the send itself yet. */
  webBase: string;
}

/** People the message is for, and how many of them each channel covers. */
export interface SendCounts {
  email: number;
  push: number;
  recipients: number;
  sms: number;
}

/**
 * `busy`: another run is sending it, or it failed (it is sent again only
 * after "Try again" puts it back to `scheduled`).
 */
export type SendError = "already_sent" | "busy" | "not_found";

export type SendResult =
  | { counts: SendCounts; ok: true }
  | { error: SendError; ok: false };

const DB = "app";
const MESSAGES = BIG_EVENT_TABLES.messages;
const RECIPIENTS = BIG_EVENT_TABLES.messageRecipients;
const STALE_AFTER_MS = 10 * 60_000;
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

async function claim(db: TablesDB, id: string, now: Date): Promise<Claim> {
  const row = await orNullIfNotFound(
    db.getRow<BigEventMessageRow>(DB, MESSAGES, id)
  );
  if (!row) {
    return { error: "not_found", ok: false };
  }
  const status = row.status ?? "scheduled";
  if (status === "sent") {
    return { error: "already_sent", ok: false };
  }
  const stale =
    status === "sending" &&
    Date.parse(row.$updatedAt) <= now.getTime() - STALE_AFTER_MS;
  if (!(status === "scheduled" || stale)) {
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
  await sendPushes(ctx, targets, async (people) => {
    counts.push += people;
    // Progress, which also tells other runs this one is still going.
    await db.updateRow(DB, MESSAGES, message.$id, countColumns(counts));
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
  messageId: string
): Promise<SendResult> {
  const now = deps.now ?? (() => new Date());
  const claimed = await claim(deps.db, messageId, now());
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
