import type { GroupKind, GroupLeg } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { participantName } from "../participant-list";
import {
  freeLegs,
  roomBusRemovals,
  roomBusSeatsToAdd,
  unseenSeatLegs,
} from "./plan-buses";
import type {
  ImportOptions,
  ImportPlan,
  ParsedPerson,
  PlacementTarget,
  SkippedRow,
} from "./plan-import";
import { existingGroupKey } from "./plan-import-rooms";

/** What the wizard's "Check and save" step shows. Names only, never contact details. */
export interface ImportPreview {
  /**
   * After the bus lists are published: people whose out or home bus this
   * import changes. Each is marked for a message about their bus (N1, N7).
   */
  busNotices: number;
  created: number;
  /** The first new people, by name. */
  createdNames: string[];
  duplicatesInFile: number;
  /** The kind of group this import creates and fills. */
  groupKind: GroupKind;
  /** People the file would move, left where they were moved by hand (R31). */
  keptPinned: number;
  /** On the list but not in this file. Shown, never removed automatically. */
  missing: number;
  missingNames: string[];
  /** Existing people who change room or group (ruling R8). */
  moved: number;
  newGroups: number;
  /** People from this file without a campus. */
  noCampus: number;
  /** Saving would change nothing: no person, group, place or seat. */
  nothingNew: boolean;
  /** Rows for a campus the caller can't see; left out. */
  outsideYourCampus: number;
  /** Names of rooms with more people than places. */
  overfullRooms: string[];
  placed: number;
  /** Booked rooms whose ticket now says another size. */
  resizedRooms: number;
  /** People who move to their room's bus (spec D5). */
  roomBusMoves: number;
  skipped: number;
  skippedRows: SkippedRow[];
  unchanged: number;
  /** People who end up without a room, when the big event has rooms. */
  unplaced: number;
  unplacedNames: string[];
  updated: number;
}

/** What the plan was made from. */
export interface PlanContext {
  /** The big event's bus lists are published: bus moves owe a notice. */
  busListsPublished: boolean;
  existing: BigEventParticipantRow[];
  /** From `parsePeople`: a group column is mapped. */
  groupColumn: boolean;
  groups: BigEventGroupRow[];
  members: BigEventGroupMemberRow[];
  options: ImportOptions;
  outsideYourCampus: number;
}

const NAME_LIST_LIMIT = 20;
const MISSING_LIST_LIMIT = 100;
const SKIPPED_LIST_LIMIT = 50;

/** Existing group keys to their rows; the first group with a key wins, as in planning. */
export function groupsByKey(
  groups: BigEventGroupRow[]
): Map<string, BigEventGroupRow> {
  const byKey = new Map<string, BigEventGroupRow>();
  for (const group of groups) {
    const key = existingGroupKey(group);
    if (!byKey.has(key)) {
      byKey.set(key, group);
    }
  }
  return byKey;
}

export function isExistingTarget(
  target: PlacementTarget
): target is { participantId: string } {
  return "participantId" in target;
}

/** The kind of each group a placement can point at, new or existing. */
function kindsByKey(plan: ImportPlan, groups: BigEventGroupRow[]) {
  const kinds = new Map<string, GroupKind>();
  for (const [key, group] of groupsByKey(groups)) {
    kinds.set(key, group.kind);
  }
  for (const group of plan.newGroups) {
    kinds.set(group.key, group.kind);
  }
  return kinds;
}

/**
 * Memberships the import replaces (rulings R8, R34): everyone the group
 * column puts in a group leaves every other group of the same kind, on every
 * leg. Driven by the column target, not by new places, so a re-import also
 * clears a stale place a failed save left behind. The new file is the
 * organizers' latest word. Groups are compared by plan key, as planning does:
 * a place in any group with the target's key counts as already there, so a
 * second group with the same key never costs someone their only place. A
 * place someone was moved into by hand (pinned) is never removed (R31).
 */
export function replacedMemberships(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): BigEventGroupMemberRow[] {
  const kinds = kindsByKey(plan, groups);
  const kindById = new Map(groups.map((group) => [group.$id, group.kind]));
  const keyById = new Map(
    groups.map((group) => [group.$id, existingGroupKey(group)])
  );
  const replaced = new Map<string, BigEventGroupMemberRow>();
  for (const { groupKey, participantId } of plan.columnTargets) {
    const kind = kinds.get(groupKey);
    if (!kind) {
      continue;
    }
    for (const membership of members) {
      if (
        membership.participant_id === participantId &&
        membership.pinned !== true &&
        keyById.get(membership.group_id) !== groupKey &&
        kindById.get(membership.group_id) === kind
      ) {
        replaced.set(membership.$id, membership);
      }
    }
  }
  return [...replaced.values()];
}

/** A bus seat the import adds for someone already on that bus. */
export interface MissingLeg {
  groupKey: string;
  leg: GroupLeg;
  participantId: string;
}

/**
 * Bus legs to add (ruling R34): someone already on their target bus for one
 * leg gets the other one too, so a seat half-written by a failed save is
 * completed. Someone not yet on the bus gets both legs from their placement.
 * A leg held on a bus the caller can't see is never doubled (ruling R13).
 */
export function missingBusLegs(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): MissingLeg[] {
  const byKey = groupsByKey(groups);
  const unseen = unseenSeatLegs(groups, members);
  const missing: MissingLeg[] = [];
  for (const { groupKey, participantId } of plan.columnTargets) {
    const bus = byKey.get(groupKey);
    if (bus?.kind !== "bus") {
      continue;
    }
    const legs = new Set(
      members
        .filter(
          (membership) =>
            membership.participant_id === participantId &&
            membership.group_id === bus.$id
        )
        .map((membership) => membership.leg)
    );
    if (legs.size === 0) {
      continue;
    }
    for (const leg of freeLegs(unseen, participantId)) {
      if (!legs.has(leg)) {
        missing.push({ groupKey, leg, participantId });
      }
    }
  }
  return missing;
}

/** People whose out or home bus the import changes: new people by their row. */
export interface BusMovers {
  participantIds: Set<string>;
  people: Set<ParsedPerson>;
}

function addMover(movers: BusMovers, person: PlacementTarget): void {
  if (isExistingTarget(person)) {
    movers.participantIds.add(person.participantId);
  } else {
    movers.people.add(person);
  }
}

function moverCount(movers: BusMovers): number {
  return movers.participantIds.size + movers.people.size;
}

/**
 * People who move to their room's bus (spec D5): given a seat on it, or
 * losing another seat on a leg they now ride with their room.
 */
export function roomBusMovers(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): BusMovers {
  const movers: BusMovers = { participantIds: new Set(), people: new Set() };
  for (const seat of roomBusSeatsToAdd(plan, members)) {
    addMover(movers, seat.person);
  }
  for (const membership of roomBusRemovals(plan, groups, members)) {
    movers.participantIds.add(membership.participant_id);
  }
  return movers;
}

/**
 * Everyone given a bus seat or losing one: bus placements with a leg left to
 * write and their missing legs, replaced bus seats, and room bus moves.
 * After publishing each of them owes a notice (N1, N7).
 */
export function busMovers(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): BusMovers {
  const movers = roomBusMovers(plan, groups, members);
  const kinds = kindsByKey(plan, groups);
  const unseen = unseenSeatLegs(groups, members);
  for (const { groupKey, person } of plan.placements) {
    const participantId = isExistingTarget(person)
      ? person.participantId
      : null;
    const writes = freeLegs(unseen, participantId).length > 0;
    if (kinds.get(groupKey) === "bus" && writes) {
      addMover(movers, person);
    }
  }
  const buses = new Set(
    groups.filter((group) => group.kind === "bus").map((group) => group.$id)
  );
  for (const membership of replacedMemberships(plan, groups, members)) {
    if (buses.has(membership.group_id)) {
      movers.participantIds.add(membership.participant_id);
    }
  }
  for (const { participantId } of missingBusLegs(plan, groups, members)) {
    movers.participantIds.add(participantId);
  }
  return movers;
}

function fullName(person: { firstName: string; lastName: string | null }) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function overfullNames(plan: ImportPlan, groups: BigEventGroupRow[]): string[] {
  const byKey = groupsByKey(groups);
  const created = new Map(plan.newGroups.map((group) => [group.key, group]));
  return plan.overfullRooms.flatMap((key) => {
    const name = byKey.get(key)?.name ?? created.get(key)?.name;
    return name ? [name] : [];
  });
}

type ChangeCounts = Pick<
  ImportPreview,
  | "busNotices"
  | "created"
  | "moved"
  | "newGroups"
  | "placed"
  | "resizedRooms"
  | "roomBusMoves"
  | "updated"
>;

/** What saving would write, as counts (a preview can't say "nothing new" while any is above 0). */
function changeCounts(plan: ImportPlan, context: PlanContext): ChangeCounts {
  const { groups, members } = context;
  return {
    busNotices: context.busListsPublished
      ? moverCount(busMovers(plan, groups, members))
      : 0,
    created: plan.create.length,
    moved: new Set(
      replacedMemberships(plan, groups, members).map(
        (membership) => membership.participant_id
      )
    ).size,
    newGroups: plan.newGroups.length,
    placed: plan.placements.length,
    resizedRooms: plan.groupUpdates.length,
    roomBusMoves: moverCount(roomBusMovers(plan, groups, members)),
    updated: plan.update.filter(
      (entry) => Object.keys(entry.changes).length > 0
    ).length,
  };
}

/** Counts and short name lists for the preview. */
export function summarizePlan(
  plan: ImportPlan,
  context: PlanContext
): ImportPreview {
  const { existing, groups, options } = context;
  const counts = changeCounts(plan, context);
  const byId = new Map(existing.map((row) => [row.$id, row]));
  const missingNames = plan.missingFromFile
    .flatMap((id) => {
      const row = byId.get(id);
      return row ? [participantName(row)] : [];
    })
    .sort((a, b) => a.localeCompare(b, "nb"));
  // Ruling R2: a group column without a kind means rooms.
  const groupKind = context.groupColumn
    ? (options.groupKind ?? "room")
    : "room";
  // "Not in a room yet" only means something when there are rooms.
  const roomsInPlay =
    groups.some((group) => group.kind === "room") ||
    plan.newGroups.some((group) => group.kind === "room");
  const unplaced = roomsInPlay ? plan.unplaced : [];

  return {
    ...counts,
    createdNames: plan.create.slice(0, NAME_LIST_LIMIT).map(fullName),
    duplicatesInFile: plan.duplicatesInFile,
    groupKind,
    keptPinned: plan.keptPinned.length,
    missing: plan.missingFromFile.length,
    missingNames: missingNames.slice(0, MISSING_LIST_LIMIT),
    noCampus: plan.noCampus,
    nothingNew: Object.values(counts).every((count) => count === 0),
    outsideYourCampus: context.outsideYourCampus,
    overfullRooms: overfullNames(plan, groups),
    skipped: plan.skipped.length,
    skippedRows: plan.skipped.slice(0, SKIPPED_LIST_LIMIT),
    unchanged: plan.update.length - counts.updated,
    unplaced: unplaced.length,
    unplacedNames: unplaced.slice(0, NAME_LIST_LIMIT).map(fullName),
  };
}
