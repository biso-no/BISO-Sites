import "server-only";

/**
 * Departure reminders (plan M9b, spec D7), step 3 of the messages cron
 * (auto.ts): 2 hours before each bus leg leaves, one message to the people on
 * that bus for that leg, stamped on the bus so it goes out once. A leg
 * nobody rides gets none and stays unstamped, so someone seated later in the
 * 2 hours still gets theirs. A reminder written before its stamp failed is
 * found again and only stamped.
 */

import { Query } from "@repo/api";
import { BIG_EVENT_TABLES, type GroupLeg } from "../tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventMessageRow,
} from "../types";
import type { AutoEvent, AutoRun } from "./auto";
import { listAll } from "./load";

const DB = "app";
const GROUPS = BIG_EVENT_TABLES.groups;
const MEMBERS = BIG_EVENT_TABLES.groupMembers;
const MESSAGES = BIG_EVENT_TABLES.messages;
/** How long before a bus leg leaves its reminder goes out. */
const REMINDER_LEAD_MS = 2 * 60 * 60_000;

type ReminderBus = Pick<
  BigEventGroupRow,
  | "$id"
  | "campus_id"
  | "home_departs_at"
  | "home_reminder_sent_at"
  | "out_departs_at"
  | "out_reminder_sent_at"
>;

const LEGS: readonly GroupLeg[] = ["out", "home"];

function legTimes(bus: ReminderBus, leg: GroupLeg) {
  return leg === "out"
    ? { departsAt: bus.out_departs_at, remindedAt: bus.out_reminder_sent_at }
    : { departsAt: bus.home_departs_at, remindedAt: bus.home_reminder_sent_at };
}

/**
 * Whether `leg` of `bus` is owed its reminder: it leaves within the next 2
 * hours (not before now) and wasn't reminded. A leg without a departure
 * time gets none.
 */
function reminderDue(bus: ReminderBus, leg: GroupLeg, now: Date): boolean {
  const { departsAt, remindedAt } = legTimes(bus, leg);
  if (!departsAt || remindedAt) {
    return false;
  }
  const leaves = Date.parse(departsAt);
  return leaves > now.getTime() && leaves <= now.getTime() + REMINDER_LEAD_MS;
}

/** Whether anyone has a seat on `leg` of the bus. */
async function hasRiders(
  run: AutoRun,
  busId: string,
  leg: GroupLeg
): Promise<boolean> {
  const { rows } = await run.db.listRows<BigEventGroupMemberRow>(DB, MEMBERS, [
    Query.equal("group_id", busId),
    Query.equal("leg", leg),
    Query.select(["$id"]),
    Query.limit(1),
  ]);
  return rows.length > 0;
}

const legKey = (busId: string, leg: GroupLeg) => `${busId}:${leg}`;

function groupIdsOf(audience: string | null): string[] {
  try {
    const parsed: unknown = audience ? JSON.parse(audience) : null;
    const ids = (parsed as { groupIds?: unknown } | null)?.groupIds;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** The bus legs of the big event that already have a reminder message. */
async function remindedLegs(
  run: AutoRun,
  event: AutoEvent
): Promise<Set<string>> {
  const reminders = await listAll<BigEventMessageRow>(run.db, MESSAGES, [
    Query.equal("big_event_id", event.$id),
    Query.equal("kind", "departure_reminder"),
    Query.select(["$id", "audience", "leg"]),
  ]);
  const legs = new Set<string>();
  for (const reminder of reminders) {
    if (reminder.leg) {
      for (const busId of groupIdsOf(reminder.audience)) {
        legs.add(legKey(busId, reminder.leg));
      }
    }
  }
  return legs;
}

/**
 * Writes each due reminder unless one exists already, stamps its bus leg,
 * then sends them (ruling R17's order). Each one stores the leg its
 * audience is for (ruling R13) and the bus's campus. Once the run is out of
 * time the rest stay due (ruling R38). Returns how many it wrote.
 */
export async function sendDueReminders(
  run: AutoRun,
  event: AutoEvent
): Promise<number> {
  const buses = await listAll<BigEventGroupRow>(run.db, GROUPS, [
    Query.equal("big_event_id", event.$id),
    Query.equal("kind", "bus"),
    Query.select([
      "$id",
      "campus_id",
      "home_departs_at",
      "home_reminder_sent_at",
      "out_departs_at",
      "out_reminder_sent_at",
    ]),
  ]);
  const stamp = run.now.toISOString();
  const due = buses.flatMap((bus) =>
    LEGS.filter((leg) => reminderDue(bus, leg, run.now)).map((leg) => ({
      bus,
      leg,
    }))
  );
  const reminded = due.length > 0 ? await remindedLegs(run, event) : null;
  const written: string[] = [];
  for (const { bus, leg } of due) {
    if (run.outOfTime()) {
      break;
    }
    if (!(await hasRiders(run, bus.$id, leg))) {
      continue;
    }
    // Written on an earlier run whose stamp failed: just stamp it now.
    if (!reminded?.has(legKey(bus.$id, leg))) {
      written.push(
        await run.write({
          audience: { groupIds: [bus.$id], leg, type: "groups" },
          campusIds: bus.campus_id ? [bus.campus_id] : [],
          event,
          kind: "departure_reminder",
          leg,
        })
      );
    }
    await run.db.updateRow<BigEventGroupRow>(
      DB,
      GROUPS,
      bus.$id,
      leg === "out"
        ? { out_reminder_sent_at: stamp }
        : { home_reminder_sent_at: stamp }
    );
  }
  for (const id of written) {
    await run.send(id);
  }
  return written.length;
}
