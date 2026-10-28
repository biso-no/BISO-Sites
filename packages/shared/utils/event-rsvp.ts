import { ID, Permission, Query, Role } from "@repo/api";

export const EVENT_RSVPS_TABLE = "event_rsvps";
export const EVENT_RSVP_STATUSES = ["going", "maybe", "not_going"] as const;
export type EventRsvpStatus = (typeof EVENT_RSVP_STATUSES)[number];

export interface EventRsvpSummary {
  counts: { going: number; maybe: number };
  mine: EventRsvpStatus | null;
  open: boolean;
}

export interface EventRsvpDb {
  createRow(
    table: string,
    id: string,
    data: Record<string, unknown>,
    permissions: string[]
  ): Promise<unknown>;
  deleteRow(table: string, id: string): Promise<unknown>;
  listRows<T>(table: string, queries: string[]): Promise<{ rows: T[] }>;
  updateRow(
    table: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<unknown>;
}

export type SetEventRsvpResult =
  | { ok: true; summary: EventRsvpSummary }
  | { ok: false; reason: "closed" | "members_only" | "not_found" };

interface EventRow {
  $id: string;
  end_date?: string | null;
  member_only?: boolean | null;
  start_date?: string | null;
  status: string;
}

interface RsvpRow {
  $id: string;
  status: string;
}

const PAGE_SIZE = 1000;

/** Shared modules can't import app helpers, so this mirrors the apps' check. */
const CONFLICT_TYPES = new Set([
  "row_already_exists",
  "document_already_exists",
]);

function isRowConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, type } = error as { code?: unknown; type?: unknown };
  return code === 409 || (typeof type === "string" && CONFLICT_TYPES.has(type));
}

/** `undefined` = not a valid body value; `null` = clear the answer. */
export function parseEventRsvpStatus(
  value: unknown
): EventRsvpStatus | null | undefined {
  if (value === null) {
    return null;
  }
  return EVENT_RSVP_STATUSES.find((status) => status === value);
}

/** Answers stay open until the event ends (or starts, when it has no end). */
export function isEventRsvpOpen(
  event: { end_date?: string | null; start_date?: string | null },
  now: Date
): boolean {
  const cutoff = event.end_date ?? event.start_date;
  if (!cutoff) {
    return true;
  }
  return now.getTime() <= new Date(cutoff).getTime();
}

async function readPublishedEvent(
  db: EventRsvpDb,
  eventId: string
): Promise<EventRow | null> {
  const { rows } = await db.listRows<EventRow>("events", [
    Query.equal("$id", eventId),
    Query.select(["$id", "status", "start_date", "end_date", "member_only"]),
    Query.limit(1),
  ]);
  const event = rows[0];
  return event && event.status === "published" ? event : null;
}

async function readOwnRow(
  db: EventRsvpDb,
  eventId: string,
  userId: string
): Promise<RsvpRow | null> {
  const { rows } = await db.listRows<RsvpRow>(EVENT_RSVPS_TABLE, [
    Query.equal("event_id", eventId),
    Query.equal("user_id", userId),
    Query.select(["$id", "status"]),
    Query.limit(1),
  ]);
  return rows[0] ?? null;
}

/** Counts by paging, since `total` reports the whole table on this Appwrite version. */
async function countAnswers(
  db: EventRsvpDb,
  eventId: string
): Promise<EventRsvpSummary["counts"]> {
  const counts = { going: 0, maybe: 0 };
  let cursor: string | undefined;
  while (true) {
    const queries = [
      Query.equal("event_id", eventId),
      Query.select(["$id", "status"]),
      Query.limit(PAGE_SIZE),
    ];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows<RsvpRow>(EVENT_RSVPS_TABLE, queries);
    for (const { status } of rows) {
      if (status === "going") {
        counts.going += 1;
      } else if (status === "maybe") {
        counts.maybe += 1;
      }
    }
    const last = rows.at(-1);
    if (rows.length < PAGE_SIZE || !last) {
      return counts;
    }
    cursor = last.$id;
  }
}

async function summarize(
  db: EventRsvpDb,
  event: EventRow,
  input: { now: Date; userId: string | null }
): Promise<EventRsvpSummary> {
  const [counts, own] = await Promise.all([
    countAnswers(db, event.$id),
    input.userId ? readOwnRow(db, event.$id, input.userId) : null,
  ]);
  return {
    counts,
    mine: parseEventRsvpStatus(own?.status) ?? null,
    open: isEventRsvpOpen(event, input.now),
  };
}

/** null when the event is missing or not published. */
export async function readEventRsvp(
  db: EventRsvpDb,
  input: { eventId: string; now: Date; userId: string | null }
): Promise<EventRsvpSummary | null> {
  const event = await readPublishedEvent(db, input.eventId);
  return event ? summarize(db, event, input) : null;
}

async function writeAnswer(
  db: EventRsvpDb,
  input: { eventId: string; status: EventRsvpStatus; userId: string },
  existing: RsvpRow | null
): Promise<void> {
  const { eventId, status, userId } = input;
  if (existing) {
    if (existing.status !== status) {
      await db.updateRow(EVENT_RSVPS_TABLE, existing.$id, { status });
    }
    return;
  }
  try {
    await db.createRow(
      EVENT_RSVPS_TABLE,
      ID.unique(),
      { event_id: eventId, status, user_id: userId },
      [Permission.read(Role.user(userId))]
    );
  } catch (error) {
    if (!isRowConflict(error)) {
      throw error;
    }
    // A concurrent request created the row first; fall back to updating it.
    const winner = await readOwnRow(db, eventId, userId);
    if (!winner) {
      throw error;
    }
    if (winner.status !== status) {
      await db.updateRow(EVENT_RSVPS_TABLE, winner.$id, { status });
    }
  }
}

/**
 * Applies the student's answer after every rule: published, still open, and
 * member-only gating (skipped when clearing, so anyone can withdraw).
 */
export async function setEventRsvp(
  db: EventRsvpDb,
  input: {
    eventId: string;
    isMember: () => Promise<boolean>;
    now: Date;
    status: EventRsvpStatus | null;
    userId: string;
  }
): Promise<SetEventRsvpResult> {
  const { eventId, status, userId } = input;
  const event = await readPublishedEvent(db, eventId);
  if (!event) {
    return { ok: false, reason: "not_found" };
  }
  if (!isEventRsvpOpen(event, input.now)) {
    return { ok: false, reason: "closed" };
  }
  if (
    event.member_only === true &&
    status !== null &&
    !(await input.isMember())
  ) {
    return { ok: false, reason: "members_only" };
  }

  const existing = await readOwnRow(db, eventId, userId);
  if (status === null) {
    if (existing) {
      await db.deleteRow(EVENT_RSVPS_TABLE, existing.$id);
    }
  } else {
    await writeAnswer(db, { eventId, status, userId }, existing);
  }
  return {
    ok: true,
    summary: await summarize(db, event, { now: input.now, userId }),
  };
}
