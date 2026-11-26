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
import type { Audience } from "./audience";
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

/** People audiences, each short enough for the `audience` column. */
function peopleAudiences(participantIds: string[]): Audience[] {
  const empty = JSON.stringify({ participantIds: [], type: "people" }).length;
  const audiences: Audience[] = [];
  let ids: string[] = [];
  let size = empty;
  for (const id of participantIds) {
    const cost = JSON.stringify(id).length + 1;
    if (ids.length > 0 && size + cost > AUDIENCE_MAX_CHARS) {
      audiences.push({ participantIds: ids, type: "people" });
      ids = [];
      size = empty;
    }
    ids.push(id);
    size += cost;
  }
  if (ids.length > 0) {
    audiences.push({ participantIds: ids, type: "people" });
  }
  return audiences;
}

/**
 * Who gets which message: people grouped by kind and campus, leaving out
 * anyone whose kind is switched off. "No bus" follows the moved switch for
 * someone told before, else the assigned switch (ruling R16). A switch that
 * is not set counts as on.
 */
function busMessagePlan(
  event: AutoEvent,
  people: DueParticipant[],
  riders: Set<string>
): { campusId: string | null; ids: string[]; kind: BusKind }[] {
  const groups = new Map<
    string,
    { campusId: string | null; ids: string[]; kind: BusKind }
  >();
  for (const person of people) {
    const toldBefore = Boolean(person.bus_notified_at);
    const on =
      (toldBefore ? event.auto_bus_moved : event.auto_bus_assigned) !== false;
    if (!on) {
      continue;
    }
    let kind: BusKind = "bus_none";
    if (riders.has(person.$id)) {
      kind = toldBefore ? "bus_moved" : "bus_assigned";
    }
    const key = JSON.stringify([kind, person.campus_id]);
    const group = groups.get(key) ?? {
      campusId: person.campus_id,
      ids: [],
      kind,
    };
    group.ids.push(person.$id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Marks people as told; a failed write is logged and they are told again. */
async function markTold(db: TablesDB, ids: string[], now: Date): Promise<void> {
  const at = now.toISOString();
  const results = await mapAllSettledWithConcurrency(
    ids,
    WRITE_CONCURRENCY,
    (id) =>
      db.updateRow<BigEventParticipantRow>(DB, PARTICIPANTS, id, {
        bus_notice_due_at: null,
        bus_notified_at: at,
      })
  );
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    console.error(
      `${LOG_TAG} ${failed.length} bus notices could not be marked as sent`
    );
  }
}

/**
 * Step 2 for one big event (ruling R17): read who is due, re-read to keep
 * only people not moved again meanwhile, write the messages, mark the people,
 * then send. Returns how many messages it wrote.
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
  const created: string[] = [];
  for (const group of busMessagePlan(event, people, riders)) {
    for (const audience of peopleAudiences(group.ids.sort())) {
      created.push(
        await run.write({
          audience,
          campusIds: group.campusId ? [group.campusId] : [],
          event,
          kind: group.kind,
          leg: "out",
        })
      );
    }
  }
  await markTold(
    db,
    people.map((person) => person.$id),
    run.now
  );
  for (const id of created) {
    await run.send(id);
  }
  return created.length;
}
