import "server-only";

/**
 * The big-event email queue: one `big_event_deliveries` row per address per
 * send, processed in small batches by the api cron route at a pace the SMTP
 * relay accepts. Appwrite has no transactions, so a run claims a row
 * (`status: "sending"`, `claimed_by: runId`), reads it back and only sends
 * when its own claim stuck; a row left in `sending` by a run that died is
 * released after 10 minutes. Only `connect` / `connect_reminder` rows are
 * handled here; `message` rows wait for Stage 3.
 */

import { ID, type Models, Query } from "@repo/api";
import type { sendEmail } from "@repo/connectors/email";
import { buildConnectEmail } from "./connect-email";
import {
  deriveConnectToken,
  hashConnectToken,
  newConnectNonce,
} from "./connect-token";
import { BIG_EVENT_TABLES } from "./tables";
import type {
  BigEventDeliveryRow,
  BigEventParticipantRow,
  BigEventRow,
} from "./types";

type Data = Record<string, unknown>;

/** Minimal slice of `TablesDB`, satisfied by `createAdminClient().db`. */
export interface DeliveryDb {
  createRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Data
  ): Promise<unknown>;
  getRow<T extends Models.Row>(
    databaseId: string,
    tableId: string,
    rowId: string
  ): Promise<T>;
  listRows<T extends Models.Row>(
    databaseId: string,
    tableId: string,
    queries?: string[]
  ): Promise<{ rows: T[]; total: number }>;
  updateRow(
    databaseId: string,
    tableId: string,
    rowId: string,
    data: Data
  ): Promise<unknown>;
}

export type ConnectKind = "connect" | "connect_reminder";

export interface EnqueueConnectInput {
  bigEventId: string;
  kind: ConnectKind;
  participants: BigEventParticipantRow[];
}

/**
 * `queued`: people put in a new email; `addresses`: new emails (one per
 * address); `waiting`: people left out because an email of the same kind to
 * their address is already waiting to be sent.
 */
export interface EnqueueConnectResult {
  addresses: number;
  queued: number;
  waiting: number;
}

export interface ProcessDeps {
  db: DeliveryDb;
  now?: () => Date;
  /** `BIG_EVENTS_CONNECT_SECRET`. */
  secret: string;
  sendEmail: typeof sendEmail;
  sleep?: (ms: number) => Promise<void>;
  /** The public website, e.g. `https://biso.no`. */
  webBase: string;
}

export interface ProcessOptions {
  budgetMs: number;
  perMinute: number;
  runId: string;
}

/**
 * `sent` / `failed`: send attempts this run that went out or threw;
 * `remaining`: rows still due now (the caller kicks another run when > 0).
 */
export interface ProcessResult {
  failed: number;
  remaining: number;
  sent: number;
}

const DB = "app";
const EVENTS = BIG_EVENT_TABLES.events;
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const DELIVERIES = BIG_EVENT_TABLES.deliveries;

const CONNECT_KINDS: ConnectKind[] = ["connect", "connect_reminder"];
const BATCH_SIZE = 10;
const PAGE_SIZE = 100;
/** Appwrite refuses an `equal` query with more values than this. */
const MAX_QUERY_VALUES = 100;
const MAX_ATTEMPTS = 3;
const LAST_ERROR_MAX = 500;
const MINUTE_MS = 60_000;
const STUCK_AFTER_MS = 10 * MINUTE_MS;
/** A failed send waits 5 minutes per attempt so far before the next try. */
const RETRY_DELAY_MS = 5 * MINUTE_MS;
const REMINDER_AFTER_MS = 4 * 24 * 60 * MINUTE_MS;
const INTERRUPTED = "Interrupted while sending.";
const TRAILING_SLASHES = /\/+$/;

function normalizeAddress(address: string | null | undefined): string {
  return address?.trim().toLowerCase() ?? "";
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, LAST_ERROR_MAX);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listAll<T extends Models.Row>(
  db: DeliveryDb,
  table: string,
  queries: string[]
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = [...queries, Query.limit(PAGE_SIZE)];
    if (cursor) {
      page.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows<T>(DB, table, page);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) {
      return all;
    }
    cursor = rows.at(-1)?.$id;
  }
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

interface AddressGroup {
  address: string;
  ids: string[];
}

function groupByAddress(
  bigEventId: string,
  participants: BigEventParticipantRow[]
): Map<string, AddressGroup> {
  const groups = new Map<string, AddressGroup>();
  for (const person of participants) {
    const key = normalizeAddress(person.ticket_email);
    if (person.big_event_id !== bigEventId || person.user_id || !key) {
      continue;
    }
    const group = groups.get(key);
    if (group) {
      group.ids.push(person.$id);
    } else {
      groups.set(key, {
        address: person.ticket_email?.trim() ?? key,
        ids: [person.$id],
      });
    }
  }
  return groups;
}

/**
 * Queues one `pending` email per ticket address for the unlinked participants
 * with a ticket email (people sharing an address share one email), due at
 * once. Someone already in a `pending` or `sending` email of the same kind to
 * the same address is left out, so nobody gets the same email twice; an
 * address with nobody left gets no email. (An email waiting for someone's old
 * address doesn't count: it is skipped at send time.)
 */
export async function enqueueConnectEmails(
  db: DeliveryDb,
  input: EnqueueConnectInput
): Promise<EnqueueConnectResult> {
  const groups = groupByAddress(input.bigEventId, input.participants);
  if (groups.size === 0) {
    return { addresses: 0, queued: 0, waiting: 0 };
  }

  const open = await listAll<BigEventDeliveryRow>(db, DELIVERIES, [
    Query.equal("big_event_id", input.bigEventId),
    Query.equal("kind", input.kind),
    Query.equal("status", ["pending", "sending"]),
  ]);
  const waiting = new Set(
    open.flatMap((delivery) =>
      (delivery.participant_ids ?? []).map(
        (id) => `${normalizeAddress(delivery.to_address)} ${id}`
      )
    )
  );

  let addresses = 0;
  let queued = 0;
  let alreadyWaiting = 0;
  for (const [key, group] of groups) {
    const ids = group.ids.filter((id) => !waiting.has(`${key} ${id}`));
    alreadyWaiting += group.ids.length - ids.length;
    if (ids.length === 0) {
      continue;
    }
    await db.createRow(DB, DELIVERIES, ID.unique(), {
      attempts: 0,
      big_event_id: input.bigEventId,
      channel: "email",
      kind: input.kind,
      participant_ids: ids,
      scheduled_for: null,
      status: "pending",
      to_address: group.address,
    });
    addresses += 1;
    queued += ids.length;
  }
  return { addresses, queued, waiting: alreadyWaiting };
}

/**
 * Queues the one connect reminder for participants still unlinked 4 days
 * after their first connect email, in published big events that have not
 * ended. Someone who already had a reminder queued (sent, failed or skipped)
 * never gets another. Returns how many people were queued.
 */
export async function enqueueDueReminders(
  db: DeliveryDb,
  now: Date = new Date()
): Promise<number> {
  const cutoff = new Date(now.getTime() - REMINDER_AFTER_MS).toISOString();
  const events = await listAll<BigEventRow>(db, EVENTS, [
    Query.equal("status", "published"),
    Query.greaterThan("ends_at", now.toISOString()),
  ]);

  let queued = 0;
  for (const event of events) {
    const due = await listAll<BigEventParticipantRow>(db, PARTICIPANTS, [
      Query.equal("big_event_id", event.$id),
      Query.isNull("user_id"),
      Query.isNull("connect_reminded_at"),
      Query.lessThanEqual("connect_sent_at", cutoff),
    ]);
    if (due.length === 0) {
      continue;
    }
    const earlier = await listAll<BigEventDeliveryRow>(db, DELIVERIES, [
      Query.equal("big_event_id", event.$id),
      Query.equal("kind", "connect_reminder"),
    ]);
    const reminded = new Set(
      earlier.flatMap((delivery) => delivery.participant_ids ?? [])
    );
    const result = await enqueueConnectEmails(db, {
      bigEventId: event.$id,
      kind: "connect_reminder",
      participants: due.filter((person) => !reminded.has(person.$id)),
    });
    queued += result.queued;
  }
  return queued;
}

// ── Process ───────────────────────────────────────────────────────────────────

interface RunContext {
  /** Waits out the pace before every send but the run's first. */
  beforeSend: () => Promise<void>;
  db: DeliveryDb;
  events: Map<string, BigEventRow | null>;
  now: () => Date;
  runId: string;
  secret: string;
  sendEmail: typeof sendEmail;
  webBase: string;
}

interface PreparedEmail {
  html: string;
  people: BigEventParticipantRow[];
  subject: string;
  text: string;
}

function dueQueries(now: Date, limit: number): string[] {
  return [
    Query.equal("status", "pending"),
    Query.equal("channel", "email"),
    Query.equal("kind", CONNECT_KINDS),
    Query.or([
      Query.isNull("scheduled_for"),
      Query.lessThanEqual("scheduled_for", now.toISOString()),
    ]),
    Query.orderAsc("$createdAt"),
    Query.limit(limit),
  ];
}

function isDue(row: BigEventDeliveryRow, now: Date): boolean {
  return !row.scheduled_for || Date.parse(row.scheduled_for) <= now.getTime();
}

/**
 * A failed attempt: back to `pending` after a pause, or `failed` at the last
 * attempt. The claim stays on the row: the cron route reads a recent
 * `claimed_at` as "a chain is sending", and the next claim overwrites it.
 */
async function recordFailure(
  db: DeliveryDb,
  row: BigEventDeliveryRow,
  message: string,
  now: Date
): Promise<void> {
  const attempts = (row.attempts ?? 0) + 1;
  const final = attempts >= MAX_ATTEMPTS;
  const retryAt = new Date(now.getTime() + RETRY_DELAY_MS * attempts);
  await db.updateRow(DB, DELIVERIES, row.$id, {
    attempts,
    last_error: message,
    scheduled_for: final ? row.scheduled_for : retryAt.toISOString(),
    status: final ? "failed" : "pending",
  });
}

/**
 * Connect emails a dead run left in `sending` for over 10 minutes; the
 * interruption counts as an attempt. Other kinds belong to their own sender.
 */
async function releaseStuck(db: DeliveryDb, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MS).toISOString();
  const { rows } = await db.listRows<BigEventDeliveryRow>(DB, DELIVERIES, [
    Query.equal("status", "sending"),
    Query.equal("channel", "email"),
    Query.equal("kind", CONNECT_KINDS),
    Query.or([
      Query.isNull("claimed_at"),
      Query.lessThan("claimed_at", cutoff),
    ]),
    Query.limit(PAGE_SIZE),
  ]);
  for (const row of rows) {
    const attempts = (row.attempts ?? 0) + 1;
    await db.updateRow(DB, DELIVERIES, row.$id, {
      attempts,
      claimed_at: null,
      claimed_by: null,
      last_error: INTERRUPTED,
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
    });
  }
}

/** Claims a still-due row for this run; null when another run has it. */
async function claim(
  db: DeliveryDb,
  id: string,
  runId: string,
  now: Date
): Promise<BigEventDeliveryRow | null> {
  const fresh = await db.getRow<BigEventDeliveryRow>(DB, DELIVERIES, id);
  if (fresh.status !== "pending" || !isDue(fresh, now)) {
    return null;
  }
  await db.updateRow(DB, DELIVERIES, id, {
    claimed_at: now.toISOString(),
    claimed_by: runId,
    status: "sending",
  });
  const claimed = await db.getRow<BigEventDeliveryRow>(DB, DELIVERIES, id);
  return claimed.claimed_by === runId && claimed.status === "sending"
    ? claimed
    : null;
}

async function loadEvent(
  ctx: RunContext,
  id: string
): Promise<BigEventRow | null> {
  if (!ctx.events.has(id)) {
    const { rows } = await ctx.db.listRows<BigEventRow>(DB, EVENTS, [
      Query.equal("$id", id),
      Query.limit(1),
    ]);
    ctx.events.set(id, rows[0] ?? null);
  }
  return ctx.events.get(id) ?? null;
}

async function loadParticipants(
  db: DeliveryDb,
  ids: string[]
): Promise<BigEventParticipantRow[]> {
  const found: BigEventParticipantRow[] = [];
  for (let start = 0; start < ids.length; start += MAX_QUERY_VALUES) {
    const chunk = ids.slice(start, start + MAX_QUERY_VALUES);
    const { rows } = await db.listRows<BigEventParticipantRow>(
      DB,
      PARTICIPANTS,
      [Query.equal("$id", chunk), Query.limit(chunk.length)]
    );
    found.push(...rows);
  }
  return found;
}

/** The person's link, giving them a nonce and stored token hash first when needed. */
async function connectUrl(
  ctx: RunContext,
  person: BigEventParticipantRow
): Promise<string> {
  const updates: Data = {};
  let nonce = person.connect_nonce;
  if (!nonce) {
    nonce = newConnectNonce();
    updates.connect_nonce = nonce;
  }
  const token = deriveConnectToken(ctx.secret, person.$id, nonce);
  const hash = hashConnectToken(token);
  if (person.connect_token_hash !== hash) {
    updates.connect_token_hash = hash;
  }
  if (Object.keys(updates).length > 0) {
    await ctx.db.updateRow(DB, PARTICIPANTS, person.$id, updates);
  }
  return `${ctx.webBase}/connect/${token}`;
}

/**
 * The email for a claimed row, or null when there is nobody left to send to:
 * the big event is no longer published or has ended, or every person has
 * connected or now has another ticket email.
 */
async function prepareConnectEmail(
  ctx: RunContext,
  row: BigEventDeliveryRow
): Promise<PreparedEmail | null> {
  const address = normalizeAddress(row.to_address);
  const ids = row.participant_ids ?? [];
  const event = await loadEvent(ctx, row.big_event_id);
  const live =
    event?.status === "published" &&
    Date.parse(event.ends_at) > ctx.now().getTime();
  if (!(live && address && ids.length > 0)) {
    return null;
  }

  const rows = await loadParticipants(ctx.db, ids);
  const people = ids
    .map((id) => rows.find((person) => person.$id === id))
    .filter(
      (person): person is BigEventParticipantRow =>
        person?.big_event_id === row.big_event_id &&
        !person.user_id &&
        normalizeAddress(person.ticket_email) === address
    );
  if (people.length === 0) {
    return null;
  }

  const links: { firstName: string; lastName: string | null; url: string }[] =
    [];
  for (const person of people) {
    links.push({
      firstName: person.first_name,
      lastName: person.last_name,
      url: await connectUrl(ctx, person),
    });
  }
  const email = buildConnectEmail({
    eventNameEn: event.name_en,
    eventNameNo: event.name_no,
    helpUrl: `${ctx.webBase}/connect/help`,
    people: links,
    reminder: row.kind === "connect_reminder",
  });
  return { ...email, people };
}

async function markSent(
  ctx: RunContext,
  row: BigEventDeliveryRow,
  people: BigEventParticipantRow[]
): Promise<void> {
  const at = ctx.now().toISOString();
  const status = { last_error: null, sent_at: at, status: "sent" };
  try {
    await ctx.db.updateRow(DB, DELIVERIES, row.$id, status);
  } catch {
    // The email is out: one more try, so a hiccup doesn't leave the row to
    // be released and sent again.
    await ctx.db.updateRow(DB, DELIVERIES, row.$id, status);
  }
  const reminder = row.kind === "connect_reminder";
  for (const person of people) {
    if (reminder) {
      await ctx.db.updateRow(DB, PARTICIPANTS, person.$id, {
        connect_reminded_at: at,
      });
    } else if (!person.connect_sent_at) {
      await ctx.db.updateRow(DB, PARTICIPANTS, person.$id, {
        connect_sent_at: at,
      });
    }
  }
}

type Outcome = "failed" | "none" | "sent" | "unclaimed";

/**
 * Claims, builds and sends one row. A send that throws (or a failure while
 * preparing it) is recorded on the row; writes after a successful send are
 * not, so a sent email is never retried because of them.
 */
async function deliverRow(ctx: RunContext, id: string): Promise<Outcome> {
  let row: BigEventDeliveryRow | null;
  try {
    row = await claim(ctx.db, id, ctx.runId, ctx.now());
  } catch {
    // A transient read/write error: leave this row to a later run (or to the
    // stuck-row release if the claim landed) and carry on with the rest.
    return "unclaimed";
  }
  if (!row) {
    return "none";
  }

  let email: PreparedEmail | null = null;
  try {
    email = await prepareConnectEmail(ctx, row);
    if (email) {
      await ctx.beforeSend();
      await ctx.sendEmail({
        html: email.html,
        subject: email.subject,
        text: email.text,
        to: row.to_address ?? "",
      });
    }
  } catch (error) {
    await recordFailure(ctx.db, row, errorMessage(error), ctx.now());
    return "failed";
  }

  if (!email) {
    await ctx.db.updateRow(DB, DELIVERIES, row.$id, { status: "skipped" });
    return "none";
  }
  await markSent(ctx, row, email.people);
  return "sent";
}

/** `60000 / perMinute` ms between sends; the first send of a run goes at once. */
function createPacer(perMinute: number, sleep: (ms: number) => Promise<void>) {
  const pace = MINUTE_MS / perMinute;
  let attempted = false;
  return {
    async beforeSend(): Promise<void> {
      if (attempted) {
        await sleep(pace);
      }
      attempted = true;
    },
    nextWait: (): number => (attempted ? pace : 0),
  };
}

/**
 * Sends due connect emails, oldest first, waiting `60000 / perMinute` ms
 * between sends, until none are due or `budgetMs` is spent.
 */
export async function processDeliveries(
  deps: ProcessDeps,
  opts: ProcessOptions
): Promise<ProcessResult> {
  if (!(opts.perMinute > 0)) {
    throw new Error("perMinute must be a positive number.");
  }
  const now = deps.now ?? (() => new Date());
  const pacer = createPacer(opts.perMinute, deps.sleep ?? defaultSleep);
  const ctx: RunContext = {
    beforeSend: pacer.beforeSend,
    db: deps.db,
    events: new Map(),
    now,
    runId: opts.runId,
    secret: deps.secret,
    sendEmail: deps.sendEmail,
    webBase: deps.webBase.replace(TRAILING_SLASHES, ""),
  };
  const started = now().getTime();
  const budgetLeft = () =>
    now().getTime() - started + pacer.nextWait() < opts.budgetMs;

  await releaseStuck(deps.db, now());

  let sent = 0;
  let failed = 0;
  /** Rows whose claim hit an error; not tried again this run. */
  const passed = new Set<string>();
  while (budgetLeft()) {
    const { rows } = await deps.db.listRows<BigEventDeliveryRow>(
      DB,
      DELIVERIES,
      dueQueries(now(), BATCH_SIZE)
    );
    const fresh = rows.filter((row) => !passed.has(row.$id));
    if (fresh.length === 0) {
      break;
    }
    for (const listed of fresh) {
      if (!budgetLeft()) {
        break;
      }
      const outcome = await deliverRow(ctx, listed.$id);
      if (outcome === "sent") {
        sent += 1;
      } else if (outcome === "failed") {
        failed += 1;
      } else if (outcome === "unclaimed") {
        passed.add(listed.$id);
      }
    }
  }

  const { total } = await deps.db.listRows<BigEventDeliveryRow>(
    DB,
    DELIVERIES,
    dueQueries(now(), 1)
  );
  return { failed, remaining: total, sent };
}
