import "server-only";

/**
 * Bus messages (plan M9a, spec D5/D7), step 2 of the messages cron (auto.ts).
 * Once the bus lists are published, everyone whose `bus_notice_due_at` is at
 * least 10 minutes old is told about their bus: "assigned" the first time,
 * "moved" after that, "no bus" without a seat out on a bus of their own
 * campus. One message per kind and campus (ruling R17), for the way out
 * (ruling R13). With a kind switched off they are marked as told without a
 * message. A second move within the 10 minutes overwrites the timestamp, so
 * only the latest notice goes out, with the bus they have when it is sent.
 */

import { Query, type TablesDB } from "@repo/api";
import { mapAllSettledWithConcurrency } from "../../utils/concurrency";
import { BIG_EVENT_TABLES } from "../tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "../types";
import type { AutoEvent, AutoRun } from "./auto";
import { listAll } from "./load";

const DB = "app";
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const GROUPS = BIG_EVENT_TABLES.groups;
const MEMBERS = BIG_EVENT_TABLES.groupMembers;
/** A bus notice waits this long, so a second move replaces the first (D5). */
const SETTLE_MS = 10 * 60_000;
/** Appwrite refuses an `equal` query with more values than this. */
const MAX_QUERY_VALUES = 100;
const WRITE_CONCURRENCY = 8;
/** Size of `big_event_messages.audience`. */
const AUDIENCE_MAX_CHARS = 4000;
const LOG_TAG = "[big-event-messages]";

type DueParticipant = Pick<
  BigEventParticipantRow,
  "$id" | "bus_notice_due_at" | "bus_notified_at" | "campus_id"
>;
type BusKind = "bus_assigned" | "bus_moved" | "bus_none";

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    out.push(items.slice(start, start + size));
  }
  return out;
}

/**
 * Who among `people` has a seat out on a bus of their own campus. A seat on
 * another campus's bus counts as no bus (Stage 2 rulings R19, R23).
 */
async function outBusRiders(
  db: TablesDB,
  bigEventId: string,
  people: DueParticipant[]
): Promise<Set<string>> {
  const buses = await listAll<BigEventGroupRow>(db, GROUPS, [
    Query.equal("big_event_id", bigEventId),
    Query.equal("kind", "bus"),
    Query.select(["$id", "campus_id"]),
  ]);
  const busCampus = new Map(buses.map((bus) => [bus.$id, bus.campus_id]));
  const campusOf = new Map(
    people.map((person) => [person.$id, person.campus_id])
  );
  const riders = new Set<string>();
  for (const ids of chunks([...campusOf.keys()], MAX_QUERY_VALUES)) {
    const seats = await listAll<BigEventGroupMemberRow>(db, MEMBERS, [
      Query.equal("big_event_id", bigEventId),
      Query.equal("participant_id", ids),
      Query.equal("leg", "out"),
      Query.select(["$id", "group_id", "participant_id"]),
    ]);
    for (const seat of seats) {
      const campus = busCampus.get(seat.group_id);
      if (
        campus !== undefined &&
        campus === campusOf.get(seat.participant_id)
      ) {
        riders.add(seat.participant_id);
      }
    }
  }
  return riders;
}

/** The people whose `bus_notice_due_at` is still what the first read saw. */
async function unchangedSinceRead(
  db: TablesDB,
  people: DueParticipant[]
): Promise<DueParticipant[]> {
  const current = new Map<string, string | null>();
  for (const ids of chunks(
    people.map((person) => person.$id),
    MAX_QUERY_VALUES
  )) {
    const { rows } = await db.listRows<BigEventParticipantRow>(
      DB,
      PARTICIPANTS,
      [
        Query.equal("$id", ids),
        Query.select(["$id", "bus_notice_due_at"]),
        Query.limit(ids.length),
      ]
    );
    for (const row of rows) {
      current.set(row.$id, row.bus_notice_due_at);
    }
  }
  return people.filter(
    (person) => current.get(person.$id) === person.bus_notice_due_at
  );
}

interface BusGroup {
  campusId: string | null;
  kind: BusKind;
  people: DueParticipant[];
  /** The kind's switch is on: they get a message, not just the mark. */
  send: boolean;
}

/**
 * People grouped by kind, campus and whether their kind is switched on.
 * "No bus" follows the moved switch for someone told before, else the
 * assigned switch (ruling R16). A switch that is not set counts as on.
 */
function busGroups(
  event: AutoEvent,
  people: DueParticipant[],
  riders: Set<string>
): BusGroup[] {
  const groups = new Map<string, BusGroup>();
  for (const person of people) {
    const toldBefore = Boolean(person.bus_notified_at);
    const send =
      (toldBefore ? event.auto_bus_moved : event.auto_bus_assigned) !== false;
    let kind: BusKind = "bus_none";
    if (riders.has(person.$id)) {
      kind = toldBefore ? "bus_moved" : "bus_assigned";
    }
    const key = JSON.stringify([kind, person.campus_id, send]);
    const group = groups.get(key) ?? {
      campusId: person.campus_id,
      kind,
      people: [],
      send,
    };
    group.people.push(person);
    groups.set(key, group);
  }
  return [...groups.values()];
}

const EMPTY_AUDIENCE_CHARS = JSON.stringify({
  participantIds: [],
  type: "people",
}).length;

/**
 * A group's people a message at a time, sorted by id: each batch's people
 * audience fits the `audience` column. A muted group is one batch.
 */
function batches(group: BusGroup): DueParticipant[][] {
  if (!group.send) {
    return [group.people];
  }
  const sorted = [...group.people].sort((a, b) => (a.$id < b.$id ? -1 : 1));
  const out: DueParticipant[][] = [];
  let batch: DueParticipant[] = [];
  let size = EMPTY_AUDIENCE_CHARS;
  for (const person of sorted) {
    const cost = JSON.stringify(person.$id).length + 1;
    if (batch.length > 0 && size + cost > AUDIENCE_MAX_CHARS) {
      out.push(batch);
      batch = [];
      size = EMPTY_AUDIENCE_CHARS;
    }
    batch.push(person);
    size += cost;
  }
  if (batch.length > 0) {
    out.push(batch);
  }
  return out;
}

/** Marks people as told; a failed write is logged and they are told again. */
async function markTold(
  db: TablesDB,
  people: DueParticipant[],
  now: Date
): Promise<void> {
  const at = now.toISOString();
  const results = await mapAllSettledWithConcurrency(
    people,
    WRITE_CONCURRENCY,
    (person) =>
      db.updateRow<BigEventParticipantRow>(DB, PARTICIPANTS, person.$id, {
        bus_notice_due_at: null,
        bus_notified_at: at,
      })
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `${LOG_TAG} ${failed.length} bus notice(s) could not be marked as sent`
    );
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * One batch: write its message (none when the kind is switched off), mark
 * its people as told (checked once more, so a move made meanwhile is never
 * wiped out) and send it. A failure is logged and leaves only this batch's
 * people owed. Returns 1 when it wrote a message.
 */
async function tellBatch(
  run: AutoRun,
  event: AutoEvent,
  group: BusGroup,
  batch: DueParticipant[]
): Promise<number> {
  let written = 0;
  try {
    const messageId = group.send
      ? await run.write({
          audience: {
            participantIds: batch.map((person) => person.$id),
            type: "people",
          },
          campusIds: group.campusId ? [group.campusId] : [],
          event,
          kind: group.kind,
          leg: "out",
        })
      : null;
    written = messageId ? 1 : 0;
    await markTold(run.db, await unchangedSinceRead(run.db, batch), run.now);
    if (messageId) {
      await run.send(messageId);
    }
  } catch (error) {
    console.error(
      `${LOG_TAG} A bus message for big event ${event.$id} failed: ${errorText(error)}`
    );
  }
  return written;
}

/**
 * Step 2 for one big event (ruling R17): read who is due, re-read to keep
 * only people not moved again meanwhile, then per message write it, mark its
 * people (checked once more, so a move made meanwhile is never wiped out)
 * and send it. A message that fails leaves only its own people owed for the
 * next run, and so does running out of time (ruling R38). Returns how many
 * messages it wrote.
 */
export async function sendBusMessages(
  run: AutoRun,
  event: AutoEvent
): Promise<number> {
  const { db } = run;
  const settled = new Date(run.now.getTime() - SETTLE_MS).toISOString();
  const due = await listAll<BigEventParticipantRow>(db, PARTICIPANTS, [
    Query.equal("big_event_id", event.$id),
    Query.lessThanEqual("bus_notice_due_at", settled),
    Query.select(["$id", "bus_notice_due_at", "bus_notified_at", "campus_id"]),
  ]);
  if (due.length === 0) {
    return 0;
  }
  const riders = await outBusRiders(db, event.$id, due);
  const people = await unchangedSinceRead(db, due);
  let written = 0;
  for (const group of busGroups(event, people, riders)) {
    for (const batch of batches(group)) {
      if (run.outOfTime()) {
        return written;
      }
      written += await tellBatch(run, event, group, batch);
    }
  }
  return written;
}
