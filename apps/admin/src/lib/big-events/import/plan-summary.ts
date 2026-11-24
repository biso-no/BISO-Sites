import type { GroupKind } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "@repo/shared/big-events/types";
import { participantName } from "../participant-list";
import type {
  ImportOptions,
  ImportPlan,
  PlacementTarget,
  SkippedRow,
} from "./plan-import";
import { existingGroupKey } from "./plan-import-rooms";

/** What the wizard's "Check and save" step shows. Names only, never contact details. */
export interface ImportPreview {
  created: number;
  /** The first new people, by name. */
  createdNames: string[];
  duplicatesInFile: number;
  /** The kind of group this import creates and fills. */
  groupKind: GroupKind;
  /** On the list but not in this file. Shown, never removed automatically. */
  missing: number;
  missingNames: string[];
  /** Existing people who change room or group (ruling R8). */
  moved: number;
  newGroups: number;
  /** People from this file without a campus. */
  noCampus: number;
  /** Rows for a campus the caller can't see; left out. */
  outsideYourCampus: number;
  /** Names of rooms with more people than places. */
  overfullRooms: string[];
  placed: number;
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
 * Memberships the import replaces (ruling R8): someone placed into a group
 * leaves the other groups of the same kind they were in. The new file is the
 * organizers' latest word.
 */
export function replacedMemberships(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): BigEventGroupMemberRow[] {
  const byKey = groupsByKey(groups);
  const kinds = kindsByKey(plan, groups);
  const kindById = new Map(groups.map((group) => [group.$id, group.kind]));
  const replaced = new Map<string, BigEventGroupMemberRow>();
  for (const placement of plan.placements) {
    const kind = kinds.get(placement.groupKey);
    if (!(kind && isExistingTarget(placement.person))) {
      continue;
    }
    const { participantId } = placement.person;
    const targetId = byKey.get(placement.groupKey)?.$id;
    for (const membership of members) {
      if (
        membership.participant_id === participantId &&
        membership.group_id !== targetId &&
        kindById.get(membership.group_id) === kind
      ) {
        replaced.set(membership.$id, membership);
      }
    }
  }
  return [...replaced.values()];
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

/** Counts and short name lists for the preview. */
export function summarizePlan(
  plan: ImportPlan,
  context: PlanContext
): ImportPreview {
  const { existing, groups, members, options } = context;
  const updated = plan.update.filter(
    (entry) => Object.keys(entry.changes).length > 0
  ).length;
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
  const moved = new Set(
    replacedMemberships(plan, groups, members).map(
      (membership) => membership.participant_id
    )
  ).size;

  return {
    created: plan.create.length,
    createdNames: plan.create.slice(0, NAME_LIST_LIMIT).map(fullName),
    duplicatesInFile: plan.duplicatesInFile,
    groupKind,
    missing: plan.missingFromFile.length,
    missingNames: missingNames.slice(0, MISSING_LIST_LIMIT),
    moved,
    newGroups: plan.newGroups.length,
    noCampus: plan.noCampus,
    outsideYourCampus: context.outsideYourCampus,
    overfullRooms: overfullNames(plan, groups),
    placed: plan.placements.length,
    skipped: plan.skipped.length,
    skippedRows: plan.skipped.slice(0, SKIPPED_LIST_LIMIT),
    unchanged: plan.update.length - updated,
    unplaced: unplaced.length,
    unplacedNames: unplaced.slice(0, NAME_LIST_LIMIT).map(fullName),
    updated,
  };
}
