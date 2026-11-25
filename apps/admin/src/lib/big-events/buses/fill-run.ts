import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import {
  type BigEventAccess,
  canManageGroup,
  canSeeParticipant,
  manageableGroupCampuses,
} from "@/lib/big-events/access";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import {
  applyFillPlan,
  type FillChanges,
  type FillState,
  fillChanges,
} from "./fill-changes";
import {
  type AutoFillPlan,
  planAutoFill,
  type UnplacedReason,
} from "./plan-auto-fill";
import { busSeatUse } from "./seats";

/* One auto-fill over one campus or all of them, and what the fill dialog shows. */

/** The scope that fills every campus the caller may fill. */
export const ALL_CAMPUSES = "all";

/** What an auto-fill would do (spec D5), shown before it is applied. */
export interface AutoFillPreview {
  /** Buses in scope without a seat count; auto-fill refuses until they have one (N5). */
  missingCapacity: string[];
  /** Each bus in scope with its seats on the way out once filled. */
  perBus: {
    busId: string;
    campusId: string;
    capacity: number | null;
    name: string;
    out: number;
  }[];
  /** People the fill puts on a bus, also those it keeps on theirs. */
  placed: number;
  /** Who is left without a seat, per reason: how many, and up to ten names. */
  unplaced: { count: number; names: string[]; reason: UnplacedReason }[];
}

/** A person as auto-fill reads them: campus and name, no contact details. */
export type FillPerson = Pick<
  BigEventParticipantRow,
  "$id" | "campus_id" | "first_name" | "last_name"
>;

/** Every group, place and person of a big event. */
export interface FillBoard {
  groups: BigEventGroupRow[];
  members: BigEventGroupMemberRow[];
  people: FillPerson[];
}

export interface FillRun {
  /** The rows once every plan is applied. */
  after: FillState;
  changes: FillChanges;
  /** One plan per campus, in campus order. */
  plans: AutoFillPlan[];
}

type CampusBus = BigEventGroupRow & { campus_id: string };

const NAMES_SHOWN = 10;
const UNPLACED_ORDER: UnplacedReason[] = ["no_seat", "too_big", "split_room"];
const NAME_COLLATOR = new Intl.Collator("nb");

/**
 * The campuses an auto-fill covers: the one named, or every campus the
 * caller may fill with `ALL_CAMPUSES`. Buses never belong to National
 * (ruling R7). Refuses a campus the caller may not manage.
 */
export function fillCampuses(
  access: Exclude<BigEventAccess, null>,
  event: Pick<BigEventRow, "campus_id">,
  scope: string
): string[] {
  const fillable = manageableGroupCampuses(access, event).filter(
    (campusId) =>
      campusId !== NATIONAL_CAMPUS_ID &&
      canManageGroup(access, { campus_id: campusId })
  );
  if (scope === ALL_CAMPUSES) {
    return fillable;
  }
  if (!fillable.includes(scope)) {
    throw new Error("You can only fill buses on your own campus");
  }
  return [scope];
}

/** The buses of these campuses, by campus and name. */
export function busesOf(
  groups: BigEventGroupRow[],
  campuses: string[]
): CampusBus[] {
  return groups
    .filter(
      (group): group is CampusBus =>
        group.kind === "bus" &&
        group.campus_id !== null &&
        campuses.includes(group.campus_id)
    )
    .sort(
      (a, b) =>
        a.campus_id.localeCompare(b.campus_id) ||
        NAME_COLLATOR.compare(a.name, b.name) ||
        a.$id.localeCompare(b.$id)
    );
}

/**
 * Plans one campus at a time (spec D5: "per campus or all campuses"), each
 * on the rows as the campuses before it left them. The writes are the
 * difference between the rows now and once every plan is applied.
 */
export function runFill(
  board: FillBoard,
  campuses: string[],
  options: { bigEventId: string; onlyUnseated: boolean }
): FillRun {
  const buses = board.groups.filter((group) => group.kind === "bus");
  const before: FillState = {
    members: board.members,
    rooms: board.groups.filter((group) => group.kind === "room"),
  };
  let state = before;
  const plans: AutoFillPlan[] = [];
  for (const campusId of campuses) {
    const plan = planAutoFill({
      buses,
      campusId,
      members: state.members,
      onlyUnseated: options.onlyUnseated,
      participants: board.people,
      rooms: state.rooms,
    });
    plans.push(plan);
    state = applyFillPlan(state, plan, options);
  }
  return { after: state, changes: fillChanges(before, state), plans };
}

/** How many people the plans leave without a seat (or, split rooms, where they were). */
export function unplacedCount(run: FillRun): number {
  return run.plans
    .flatMap((plan) => plan.unplaced)
    .reduce((sum, entry) => sum + entry.participantIds.length, 0);
}

/** "Kari N.": first names and the last name's initial, nothing else. */
export function shortName(
  person: Pick<FillPerson, "first_name" | "last_name">
): string {
  const [initial] = [...(person.last_name ?? "").trim()];
  const first = person.first_name.trim();
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

interface UnplacedBucket {
  count: number;
  people: string[];
  rooms: string[];
}

/** Who the plans left without a seat, per reason; a room shows as the room. */
function unplacedSummary(
  board: FillBoard,
  run: FillRun,
  access: Exclude<BigEventAccess, null>,
  roomLabel: (name: string) => string
): AutoFillPreview["unplaced"] {
  const people = new Map(board.people.map((person) => [person.$id, person]));
  const groups = new Map(board.groups.map((group) => [group.$id, group]));
  const buckets = new Map<UnplacedReason, UnplacedBucket>();
  for (const entry of run.plans.flatMap((plan) => plan.unplaced)) {
    const bucket = buckets.get(entry.reason) ?? {
      count: 0,
      people: [],
      rooms: [],
    };
    bucket.count += entry.participantIds.length;
    const room = entry.roomId ? groups.get(entry.roomId) : undefined;
    if (room) {
      bucket.rooms.push(roomLabel(room.name));
    } else {
      for (const id of entry.participantIds) {
        const person = people.get(id);
        if (person && canSeeParticipant(access, person)) {
          bucket.people.push(shortName(person));
        }
      }
    }
    buckets.set(entry.reason, bucket);
  }
  return UNPLACED_ORDER.flatMap((reason) => {
    const bucket = buckets.get(reason);
    if (!bucket) {
      return [];
    }
    const names = [
      ...bucket.rooms,
      ...bucket.people.sort(NAME_COLLATOR.compare),
    ];
    return [
      { count: bucket.count, names: names.slice(0, NAMES_SHOWN), reason },
    ];
  });
}

/**
 * The fill dialog's view of a run: seats per bus once filled, who is left
 * without a seat and why (names only, never contact details), and buses
 * missing a seat count. `roomLabel` shows a room's name as the room.
 */
export function previewOf(
  board: FillBoard,
  run: FillRun,
  campuses: string[],
  access: Exclude<BigEventAccess, null>,
  roomLabel: (name: string) => string
): AutoFillPreview {
  const buses = busesOf(board.groups, campuses);
  const seats = busSeatUse({ buses, ...run.after });
  return {
    missingCapacity: buses
      .filter((bus) => bus.capacity === null)
      .map((bus) => bus.name),
    perBus: buses.map((bus) => ({
      busId: bus.$id,
      campusId: bus.campus_id,
      capacity: bus.capacity,
      name: bus.name,
      out: seats.get(bus.$id)?.out ?? 0,
    })),
    placed: new Set(
      run.plans.flatMap((plan) => plan.moves.map((move) => move.participantId))
    ).size,
    unplaced: unplacedSummary(board, run, access, roomLabel),
  };
}
