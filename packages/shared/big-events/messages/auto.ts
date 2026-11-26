import "server-only";

/**
 * Automatic big event messages (plan M9, spec D7): their texts, and the run
 * behind the api's messages cron. `runDueMessages`:
 * 1. sends messages whose time has come, and finishes sends left in
 *    `sending` for 10 minutes (a run that crashed or timed out);
 * 2. bus messages (bus-messages.ts), for published big events with Travel
 *    on and the bus lists published;
 * 3. departure reminders (reminders.ts), for the same big events unless
 *    switched off.
 * A new message is written `scheduled` for now before anyone is marked as
 * told, so a run that dies after writing it is finished by step 1 of the
 * next run. One message or big event failing never stops the others.
 */

import { ID, Query, type TablesDB } from "@repo/api";
import { BIG_EVENT_TABLES, type GroupLeg, type MessageKind } from "../tables";
import type { BigEventMessageRow, BigEventRow } from "../types";
import type { Audience } from "./audience";
import { sendBusMessages } from "./bus-messages";
import { listAll } from "./load";
import { sendDueReminders } from "./reminders";
import { type SendDeps, sendMessage } from "./send";
import { defaultAutoTexts, MESSAGE_BODY_MAX, MESSAGE_TITLE_MAX } from "./text";

const DB = "app";
const EVENTS = BIG_EVENT_TABLES.events;
const MESSAGES = BIG_EVENT_TABLES.messages;
const MINUTE_MS = 60_000;
/** A `sending` message with no write for this long may be claimed again. */
const STALE_AFTER_MS = 10 * MINUTE_MS;
/** A big event that ended longer ago than this has nothing left to send. */
const ENDED_GRACE_MS = 24 * 60 * MINUTE_MS;
/** No new send starts after this; what is left goes out on the next run. */
const DEFAULT_BUDGET_MS = 40_000;
const LOG_TAG = "[big-event-messages]";

// ── Texts ─────────────────────────────────────────────────────────────────────

export type AutoMessageKind = Exclude<MessageKind, "manual">;
type Locale = "no" | "en";

export interface AutoText {
  body: string;
  title: string;
}

/** `big_events.auto_texts`: the organizers' own texts (ruling R18). */
export type AutoTexts = Partial<
  Record<AutoMessageKind, Partial<Record<Locale, Partial<AutoText>>>>
>;

const AUTO_KINDS: readonly AutoMessageKind[] = [
  "bus_assigned",
  "bus_moved",
  "bus_none",
  "departure_reminder",
];
const LOCALES: readonly Locale[] = ["no", "en"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The texts stored in `auto_texts`; anything unreadable is left out. */
export function parseAutoTexts(raw: string | null | undefined): AutoTexts {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return {};
  }
  const texts: AutoTexts = {};
  if (!isRecord(parsed)) {
    return texts;
  }
  for (const kind of AUTO_KINDS) {
    const entry = parsed[kind];
    if (!isRecord(entry)) {
      continue;
    }
    const languages: Partial<Record<Locale, Partial<AutoText>>> = {};
    for (const locale of LOCALES) {
      const text = entry[locale];
      if (isRecord(text)) {
        languages[locale] = {
          ...(typeof text.title === "string" && { title: text.title }),
          ...(typeof text.body === "string" && { body: text.body }),
        };
      }
    }
    texts[kind] = languages;
  }
  return texts;
}

/**
 * What an automatic message of `kind` says: the big event's own title and
 * body per language, and the default where one is missing or empty.
 */
export function autoTextsFor(
  event: Pick<BigEventRow, "auto_texts">,
  kind: AutoMessageKind
): Record<Locale, AutoText> {
  const custom = parseAutoTexts(event.auto_texts)[kind];
  const defaults = defaultAutoTexts(kind);
  const pick = (locale: Locale, field: keyof AutoText): string =>
    custom?.[locale]?.[field]?.trim() || defaults[locale][field];
  return {
    en: { body: pick("en", "body"), title: pick("en", "title") },
    no: { body: pick("no", "body"), title: pick("no", "title") },
  };
}

// ── Writing and sending ───────────────────────────────────────────────────────

export type AutoEvent = Pick<
  BigEventRow,
  | "$id"
  | "auto_bus_assigned"
  | "auto_bus_moved"
  | "auto_departure_reminder"
  | "auto_texts"
>;

/** One cron run: its time and how it writes and sends messages. */
export interface AutoRun {
  db: TablesDB;
  now: Date;
  /** Sends a message unless the run is out of time; true when it went out. */
  send: (messageId: string) => Promise<boolean>;
  /** Writes an automatic message, `scheduled` for now; returns its id. */
  write: (input: NewAutoMessage) => Promise<string>;
}

export interface NewAutoMessage {
  audience: Audience;
  campusIds: string[];
  event: AutoEvent;
  kind: AutoMessageKind;
  leg: GroupLeg;
}

async function createAutoMessage(
  db: TablesDB,
  now: Date,
  input: NewAutoMessage
): Promise<string> {
  const texts = autoTextsFor(input.event, input.kind);
  // A text too long for its column is cut, so the notice can't get stuck.
  const row = await db.createRow<BigEventMessageRow>(
    DB,
    MESSAGES,
    ID.unique(),
    {
      also_sms: false,
      audience: JSON.stringify(input.audience),
      big_event_id: input.event.$id,
      body_en: texts.en.body.slice(0, MESSAGE_BODY_MAX),
      body_no: texts.no.body.slice(0, MESSAGE_BODY_MAX),
      campus_ids: input.campusIds,
      created_by: null,
      email_count: 0,
      failed_count: 0,
      important: false,
      kind: input.kind,
      leg: input.leg,
      pinned: false,
      push_count: 0,
      recipients: 0,
      scheduled_at: now.toISOString(),
      sent_at: null,
      sms_count: 0,
      status: "scheduled",
      title_en: texts.en.title.slice(0, MESSAGE_TITLE_MAX),
      title_no: texts.no.title.slice(0, MESSAGE_TITLE_MAX),
    }
  );
  return row.$id;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * Sends one message; true when this run sent it. Another run holding it is
 * not an error. A failure is logged (ids only) and the run goes on; after
 * the deadline the message is left for the next run.
 */
async function sendAutoMessage(
  deps: SendDeps,
  deadline: number,
  messageId: string
): Promise<boolean> {
  if (Date.now() >= deadline) {
    return false;
  }
  try {
    return (await sendMessage(deps, messageId)).ok;
  } catch (error) {
    console.error(
      `${LOG_TAG} Message ${messageId} could not be sent: ${errorText(error)}`
    );
    return false;
  }
}

// ── Step 1: scheduled messages ────────────────────────────────────────────────

async function dueMessageIds(db: TablesDB, now: Date): Promise<string[]> {
  const due = Query.lessThanEqual("scheduled_at", now.toISOString());
  const stale = new Date(now.getTime() - STALE_AFTER_MS).toISOString();
  const idOnly = Query.select(["$id"]);
  const lists = await Promise.all([
    listAll<BigEventMessageRow>(db, MESSAGES, [
      Query.equal("status", "scheduled"),
      due,
      Query.orderAsc("scheduled_at"),
      idOnly,
    ]),
    listAll<BigEventMessageRow>(db, MESSAGES, [
      Query.isNull("status"),
      due,
      idOnly,
    ]),
    listAll<BigEventMessageRow>(db, MESSAGES, [
      Query.equal("status", "sending"),
      Query.lessThanEqual("$updatedAt", stale),
      idOnly,
    ]),
  ]);
  return [...new Set(lists.flat().map((row) => row.$id))];
}

// ── The run ───────────────────────────────────────────────────────────────────

/**
 * Published big events (ruling R26: a draft isn't live, an archived one is
 * done) with Travel on and the bus lists published, that haven't long ended.
 */
async function busEvents(db: TablesDB, now: Date): Promise<AutoEvent[]> {
  const endedBefore = new Date(now.getTime() - ENDED_GRACE_MS).toISOString();
  return await listAll<BigEventRow>(db, EVENTS, [
    Query.equal("status", "published"),
    Query.isNotNull("bus_lists_published_at"),
    Query.equal("travel_enabled", true),
    Query.greaterThanEqual("ends_at", endedBefore),
    Query.select([
      "$id",
      "auto_bus_assigned",
      "auto_bus_moved",
      "auto_departure_reminder",
      "auto_texts",
    ]),
  ]);
}

/** Runs one step for one big event; a failure is logged and counts 0. */
async function isolated(
  label: string,
  bigEventId: string,
  step: () => Promise<number>
): Promise<number> {
  try {
    return await step();
  } catch (error) {
    console.error(
      `${LOG_TAG} ${label} failed for big event ${bigEventId}: ${errorText(error)}`
    );
    return 0;
  }
}

export interface DueMessagesResult {
  /** Bus messages written this run. */
  busMessages: number;
  /** Departure reminders written this run. */
  reminders: number;
  /** Scheduled (or stalled) messages this run sent. */
  scheduled: number;
}

/**
 * The messages cron (plan M9): scheduled messages, bus messages, departure
 * reminders. After `budgetMs` (default 40 s) no send starts, and no step 2
 * or 3 for a further big event: what is left goes out on the next run.
 */
export async function runDueMessages(
  deps: SendDeps,
  now: Date,
  options: { budgetMs?: number } = {}
): Promise<DueMessagesResult> {
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_BUDGET_MS);
  const outOfTime = () => Date.now() >= deadline;
  const run: AutoRun = {
    db: deps.db,
    now,
    send: (id) => sendAutoMessage(deps, deadline, id),
    write: (input) => createAutoMessage(deps.db, now, input),
  };
  const result: DueMessagesResult = {
    busMessages: 0,
    reminders: 0,
    scheduled: 0,
  };
  for (const id of await dueMessageIds(deps.db, now)) {
    if (await run.send(id)) {
      result.scheduled += 1;
    }
  }
  for (const event of await busEvents(deps.db, now)) {
    if (outOfTime()) {
      break;
    }
    result.busMessages += await isolated("Bus messages", event.$id, () =>
      sendBusMessages(run, event)
    );
    if (!outOfTime() && event.auto_departure_reminder !== false) {
      result.reminders += await isolated("Reminders", event.$id, () =>
        sendDueReminders(run, event)
      );
    }
  }
  return result;
}
