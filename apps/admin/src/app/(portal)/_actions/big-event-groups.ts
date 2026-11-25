"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { BIG_EVENT_TABLES, GROUP_KINDS } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import { mapAllSettledWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  type BigEventAccess,
  canEditBigEventSettings,
  canManageGroup,
  manageableGroupCampuses,
  participantCampusFilter,
} from "@/lib/big-events/access";
import {
  type GroupFormValues,
  groupColumns,
  groupFormSchema,
} from "@/lib/big-events/buses/group-form";
import {
  busSeatUse,
  type Leg,
  roomOpenPlaces,
  type SeatUse,
} from "@/lib/big-events/buses/seats";
import { listAllRows } from "@/lib/big-events/list-rows";
import { logAuditEvent } from "./audit-log";
import { getBigEvent } from "./big-events";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type GrantedAccess = Exclude<BigEventAccess, null>;

/** One person's place in a group, as the Groups tab shows it: a name, no contact details. */
export interface GroupMemberView {
  /** The bus leg for a bus seat; null in rooms and other groups. */
  leg: Leg | null;
  name: string;
  participantId: string;
  pinned: boolean;
  /** The name of the person's room, when the caller may see that room. */
  roomName: string | null;
}

export type GroupView = BigEventGroupRow & {
  members: GroupMemberView[];
  /** Rooms with a capacity: places nobody is named in yet. Null otherwise. */
  openPlaces: number | null;
  /** Buses: seats taken per leg, including rooms' open places. Null otherwise. */
  seats: SeatUse | null;
};

export interface GroupsView {
  /** Campuses the caller may manage that have groups or people here. */
  campuses: string[];
  canPublish: boolean;
  groups: GroupView[];
  /** Campuses the caller may create groups on, even with no groups or people yet (R6). */
  manageableCampuses: string[];
  publishedAt: string | null;
  travel: boolean;
}

const DATABASE_ID = "app";
const GROUPS = BIG_EVENT_TABLES.groups;
const MEMBERS = BIG_EVENT_TABLES.groupMembers;
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const WRITE_CONCURRENCY = 8;
const MEMBER_COLUMNS = ["$id", "group_id", "leg", "participant_id", "pinned"];
const NAME_COLUMNS = ["$id", "campus_id", "first_name", "last_name"];
const DATE_COLUMNS = new Set(["home_departs_at", "out_departs_at"]);
const LEG_ORDER: Record<Leg, number> = { home: 1, out: 0 };
const NO_LEG = 2;
const NAME_COLLATOR = new Intl.Collator("nb");

async function requireBigEvent(bigEventId: string) {
  const found = await getBigEvent(bigEventId);
  if (!found) {
    throw new Error("This big event doesn't exist or you can't see it");
  }
  return found;
}

function revalidateBigEvent(bigEventId: string): void {
  revalidatePath("/big-events");
  revalidatePath(`/big-events/${bigEventId}`, "layout");
}

async function findGroup(
  db: AdminDb,
  id: string
): Promise<BigEventGroupRow | null> {
  const response = await db.listRows<BigEventGroupRow>(DATABASE_ID, GROUPS, [
    Query.equal("$id", [id]),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

/** Buses exist only while Travel is on (D5). */
function assertKindAllowed(
  kind: GroupFormValues["kind"],
  event: BigEventRow
): void {
  if (kind === "bus" && event.travel_enabled !== true) {
    throw new Error("Turn on Travel to add buses");
  }
}

/** Groups (rooms) that ride this bus on either leg. */
function ridesBusQueries(bus: BigEventGroupRow): string[] {
  return [
    Query.equal("big_event_id", [bus.big_event_id]),
    Query.or([
      Query.equal("out_bus_id", [bus.$id]),
      Query.equal("home_bus_id", [bus.$id]),
    ]),
  ];
}

/** Whether anyone is in the group, or (for a bus) a room rides it. */
async function isInUse(db: AdminDb, group: BigEventGroupRow): Promise<boolean> {
  const members = await db.listRows(DATABASE_ID, MEMBERS, [
    Query.equal("group_id", [group.$id]),
    Query.limit(1),
  ]);
  if (members.rows.length > 0) {
    return true;
  }
  if (group.kind !== "bus") {
    return false;
  }
  const rooms = await db.listRows(DATABASE_ID, GROUPS, [
    ...ridesBusQueries(group),
    Query.limit(1),
  ]);
  return rooms.rows.length > 0;
}

function changedColumns(
  before: BigEventGroupRow,
  after: Record<string, unknown>
): string[] {
  return Object.entries(after)
    .filter(([key, value]) => {
      const old = before[key as keyof BigEventGroupRow];
      if (
        DATE_COLUMNS.has(key) &&
        typeof old === "string" &&
        typeof value === "string"
      ) {
        return Date.parse(old) !== Date.parse(value);
      }
      return old !== value;
    })
    .map(([key]) => key);
}

function personName(
  row: Pick<BigEventParticipantRow, "first_name" | "last_name">
): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ");
}

function byMemberOrder(a: GroupMemberView, b: GroupMemberView): number {
  return (
    NAME_COLLATOR.compare(a.name, b.name) ||
    a.participantId.localeCompare(b.participantId) ||
    (a.leg ? LEG_ORDER[a.leg] : NO_LEG) - (b.leg ? LEG_ORDER[b.leg] : NO_LEG)
  );
}

/** Bus, room, buddy, team, other; then campus (none last); then name. */
function byGroupOrder(a: BigEventGroupRow, b: BigEventGroupRow): number {
  const campus = (row: BigEventGroupRow) => row.campus_id ?? "~";
  return (
    GROUP_KINDS.indexOf(a.kind) - GROUP_KINDS.indexOf(b.kind) ||
    campus(a).localeCompare(campus(b)) ||
    NAME_COLLATOR.compare(a.name, b.name) ||
    a.$id.localeCompare(b.$id)
  );
}

/** Each visible person's room name, from the rooms the caller may see. */
function roomNamesByPerson(
  rooms: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): Map<string, string> {
  const names = new Map(rooms.map((room) => [room.$id, room.name]));
  const byPerson = new Map<string, string>();
  for (const member of members) {
    const name = names.get(member.group_id);
    if (name !== undefined && !byPerson.has(member.participant_id)) {
      byPerson.set(member.participant_id, name);
    }
  }
  return byPerson;
}

/** Visible people per group, by name; people the caller can't see are left out. */
function membersByGroup(
  members: BigEventGroupMemberRow[],
  names: Map<string, string>,
  rooms: Map<string, string>
): Map<string, GroupMemberView[]> {
  const byGroup = new Map<string, GroupMemberView[]>();
  for (const member of members) {
    const name = names.get(member.participant_id);
    if (name === undefined) {
      continue;
    }
    const list = byGroup.get(member.group_id) ?? [];
    list.push({
      leg: member.leg,
      name,
      participantId: member.participant_id,
      pinned: member.pinned === true,
      roomName: rooms.get(member.participant_id) ?? null,
    });
    byGroup.set(member.group_id, list);
  }
  for (const list of byGroup.values()) {
    list.sort(byMemberOrder);
  }
  return byGroup;
}

function buildGroupsView(
  event: BigEventRow,
  access: GrantedAccess,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[],
  participants: BigEventParticipantRow[]
): GroupsView {
  // Seats and open places count everyone, also people the caller can't see.
  const buses = groups.filter((group) => group.kind === "bus");
  const rooms = groups.filter((group) => group.kind === "room");
  const seats = busSeatUse({ buses, members, rooms });
  const openPlaces = roomOpenPlaces(rooms, members);

  const visible = groups.filter((group) => canManageGroup(access, group));
  const names = new Map(participants.map((row) => [row.$id, personName(row)]));
  const roomNames = roomNamesByPerson(
    visible.filter((group) => group.kind === "room"),
    members
  );
  const people = membersByGroup(members, names, roomNames);

  const appearing = new Set<string>();
  for (const row of [...groups, ...participants]) {
    if (row.campus_id !== null) {
      appearing.add(row.campus_id);
    }
  }

  return {
    campuses: [...appearing]
      .filter((campusId) => canManageGroup(access, { campus_id: campusId }))
      .sort(),
    canPublish:
      canEditBigEventSettings(access) &&
      event.travel_enabled === true &&
      !event.bus_lists_published_at,
    groups: visible.sort(byGroupOrder).map(
      (group): GroupView => ({
        ...group,
        members: people.get(group.$id) ?? [],
        openPlaces:
          group.kind === "room" && group.capacity !== null
            ? (openPlaces.get(group.$id) ?? 0)
            : null,
        seats: group.kind === "bus" ? (seats.get(group.$id) ?? null) : null,
      })
    ),
    manageableCampuses: manageableGroupCampuses(access, event),
    publishedAt: event.bus_lists_published_at,
    travel: event.travel_enabled === true,
  };
}

/**
 * The big event's groups the caller may manage (N8), each with the people in
 * it the caller may see, by name only, plus bus seats and room open places.
 */
export async function listGroups(bigEventId: string): Promise<GroupsView> {
  const { access, event } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const inEvent = Query.equal("big_event_id", [bigEventId]);
  const [groups, members, participants] = await Promise.all([
    listAllRows<BigEventGroupRow>(db, GROUPS, [inEvent]),
    listAllRows<BigEventGroupMemberRow>(db, MEMBERS, [
      inEvent,
      Query.select(MEMBER_COLUMNS),
    ]),
    listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, [
      inEvent,
      ...participantCampusFilter(access),
      Query.select(NAME_COLUMNS),
    ]),
  ]);
  return buildGroupsView(event, access, groups, members, participants);
}

export async function createGroup(
  bigEventId: string,
  values: GroupFormValues
): Promise<{ id: string }> {
  const ctx = await requireAuth();
  const data = groupFormSchema.parse(values);
  const { access, event } = await requireBigEvent(bigEventId);
  assertKindAllowed(data.kind, event);
  if (!canManageGroup(access, data)) {
    throw new Error("You can only add groups on your own campus");
  }
  const { db } = await createAdminClient();
  const row = await db.createRow(DATABASE_ID, GROUPS, ID.unique(), {
    big_event_id: bigEventId,
    ...groupColumns(data),
  });
  await logAuditEvent(ctx, "big_event.group.create", {
    payload: { big_event_id: bigEventId, kind: data.kind },
    resourceId: row.$id,
    resourceType: "big_event_group",
  });
  revalidateBigEvent(bigEventId);
  return { id: row.$id };
}

/**
 * Saves the dialog. A group with people in it (or a bus a room rides) keeps
 * its campus and kind; a group that changes either leaves the bus it rode.
 */
export async function updateGroup(
  groupId: string,
  values: GroupFormValues
): Promise<void> {
  const ctx = await requireAuth();
  const data = groupFormSchema.parse(values);
  const { db } = await createAdminClient();
  const group = await findGroup(db, groupId);
  if (!group) {
    throw new Error("This group no longer exists");
  }
  const { access, event } = await requireBigEvent(group.big_event_id);
  // Both the group as it is and as it would be must be the caller's.
  if (!(canManageGroup(access, group) && canManageGroup(access, data))) {
    throw new Error("You can only change groups on your own campus");
  }
  assertKindAllowed(data.kind, event);
  const campusChanged = data.campus_id !== group.campus_id;
  const kindChanged = data.kind !== group.kind;
  if ((campusChanged || kindChanged) && (await isInUse(db, group))) {
    throw new Error(
      campusChanged
        ? "Move everyone out of this group before changing its campus"
        : "Move everyone out of this group before changing its kind"
    );
  }
  const columns = {
    ...groupColumns(data),
    ...(campusChanged || kindChanged
      ? { home_bus_id: null, out_bus_id: null }
      : {}),
  };
  await db.updateRow(DATABASE_ID, GROUPS, groupId, columns);
  await logAuditEvent(ctx, "big_event.group.update", {
    payload: {
      big_event_id: group.big_event_id,
      changed: changedColumns(group, columns),
    },
    resourceId: groupId,
    resourceType: "big_event_group",
  });
  revalidateBigEvent(group.big_event_id);
}

/** What one write phase did. Counts only: they go into the audit log. */
interface PhaseCount {
  failed: number;
  written: number;
}

/** Runs every write to the end, even when some fail, and counts them. */
async function settleWrites<T>(
  items: T[],
  write: (item: T) => Promise<unknown>
): Promise<PhaseCount> {
  const results = await mapAllSettledWithConcurrency(
    items,
    WRITE_CONCURRENCY,
    write
  );
  const errors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );
  if (errors.length > 0) {
    console.error(
      `[big-events] ${errors.length} group delete writes failed; the first:`,
      errors[0]
    );
  }
  return { failed: errors.length, written: results.length - errors.length };
}

interface DeleteOutcome {
  complete: boolean;
  failed: number;
  memberships_removed: number;
  rooms_cleared: number;
}

/**
 * Takes everyone out of the group, then the group off every room riding it
 * (a bus), then deletes it. Stops before the next step when a write failed.
 */
async function removeGroup(
  db: AdminDb,
  group: BigEventGroupRow,
  memberships: Pick<BigEventGroupMemberRow, "$id">[],
  riders: Pick<BigEventGroupRow, "$id" | "home_bus_id" | "out_bus_id">[],
  outcome: DeleteOutcome
): Promise<void> {
  const removed = await settleWrites(memberships, (membership) =>
    db.deleteRow(DATABASE_ID, MEMBERS, membership.$id)
  );
  outcome.memberships_removed = removed.written;
  outcome.failed = removed.failed;
  if (removed.failed > 0) {
    return;
  }
  const cleared = await settleWrites(riders, (room) =>
    db.updateRow(DATABASE_ID, GROUPS, room.$id, {
      ...(room.out_bus_id === group.$id ? { out_bus_id: null } : {}),
      ...(room.home_bus_id === group.$id ? { home_bus_id: null } : {}),
    })
  );
  outcome.rooms_cleared = cleared.written;
  outcome.failed = cleared.failed;
  if (cleared.failed > 0) {
    return;
  }
  const deleted = await settleWrites([group], (row) =>
    db.deleteRow(DATABASE_ID, GROUPS, row.$id)
  );
  outcome.failed = deleted.failed;
  outcome.complete = deleted.failed === 0;
}

/**
 * Deletes a group and everyone's place in it; a bus also comes off the rooms
 * riding it. After the bus lists are published, a bus with people on it
 * can't be deleted (N6). Every attempt that writes is audited.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();
  const group = await findGroup(db, groupId);
  if (!group) {
    throw new Error("This group no longer exists");
  }
  const { access, event } = await requireBigEvent(group.big_event_id);
  if (!canManageGroup(access, group)) {
    throw new Error("You can only delete groups on your own campus");
  }
  const isBus = group.kind === "bus";
  const memberships = await listAllRows<BigEventGroupMemberRow>(db, MEMBERS, [
    Query.equal("group_id", [groupId]),
    Query.select(["$id"]),
  ]);
  if (isBus && event.bus_lists_published_at && memberships.length > 0) {
    throw new Error("Move the people off this bus first.");
  }
  const riders = isBus
    ? await listAllRows<BigEventGroupRow>(db, GROUPS, [
        ...ridesBusQueries(group),
        Query.select(["$id", "home_bus_id", "out_bus_id"]),
      ])
    : [];

  const outcome: DeleteOutcome = {
    complete: false,
    failed: 0,
    memberships_removed: 0,
    rooms_cleared: 0,
  };
  try {
    await removeGroup(db, group, memberships, riders, outcome);
  } finally {
    // Ids and counts only.
    await logAuditEvent(ctx, "big_event.group.delete", {
      payload: {
        big_event_id: group.big_event_id,
        kind: group.kind,
        ...outcome,
      },
      resourceId: groupId,
      resourceType: "big_event_group",
    });
    revalidateBigEvent(group.big_event_id);
  }
  if (!outcome.complete) {
    throw new Error("The group couldn't be fully deleted. Try again.");
  }
}
