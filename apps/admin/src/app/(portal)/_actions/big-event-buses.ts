"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  BIG_EVENT_TABLES,
  type GroupKind,
} from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import { mapAllSettledWithConcurrency } from "@repo/shared/utils/concurrency";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authorization";
import {
  type BigEventAccess,
  canEditBigEventSettings,
  canManageGroup,
  canSeeParticipant,
} from "@/lib/big-events/access";
import type { FillChanges } from "@/lib/big-events/buses/fill-changes";
import {
  type AutoFillPreview,
  busesOf,
  type FillBoard,
  type FillPerson,
  fillCampuses,
  previewOf,
  runFill,
  unplacedCount,
} from "@/lib/big-events/buses/fill-run";
import {
  BUS_LEGS,
  type BusLegs,
  emptyHandChanges,
  type HandChanges,
  handLegs,
  type PlaceRow,
  placeByHand,
  rideWithRoom,
  seatByHand,
} from "@/lib/big-events/buses/hand-moves";
import type { Leg } from "@/lib/big-events/buses/seats";
import { listAllRows, listRowsByIds } from "@/lib/big-events/list-rows";
import { logAuditEvent } from "./audit-log";
import { getBigEvent } from "./big-events";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type GrantedAccess = Exclude<BigEventAccess, null>;

export interface MoveToBusInput {
  /** Null takes the people off every bus on those legs. */
  busId: string | null;
  legs: BusLegs;
  /** After publishing: "Tell {name} about the change" (D5). */
  notify: boolean;
  participantIds: string[];
}

export interface MoveToGroupInput {
  /** Null takes the people out of every group of this kind. */
  groupId: string | null;
  kind: Exclude<GroupKind, "bus">;
  /** After publishing, when a room's bus moves them: tell them. On unless false. */
  notify?: boolean;
  participantIds: string[];
}

const DATABASE_ID = "app";
const EVENTS = BIG_EVENT_TABLES.events;
const GROUPS = BIG_EVENT_TABLES.groups;
const MEMBERS = BIG_EVENT_TABLES.groupMembers;
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
const WRITE_CONCURRENCY = 8;
const MAX_PEOPLE = 1000;
const MEMBER_COLUMNS = ["$id", "group_id", "leg", "participant_id", "pinned"];
const PERSON_COLUMNS = ["$id", "campus_id", "first_name", "last_name"];

const idSchema = z.string().min(1).max(36);
const participantIdsSchema = z.array(idSchema).min(1).max(MAX_PEOPLE);
const moveToBusSchema = z.object({
  busId: idSchema.nullable(),
  legs: z.enum(BUS_LEGS),
  notify: z.boolean(),
  participantIds: participantIdsSchema,
});
const moveToGroupSchema = z.object({
  groupId: idSchema.nullable(),
  kind: z.enum(["room", "buddy", "team", "other"]),
  notify: z.boolean().default(true),
  participantIds: participantIdsSchema,
});
const setPinnedSchema = z.object({
  participantIds: participantIdsSchema,
  pinned: z.boolean(),
});

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

/** Buses exist only while Travel is on (D5). */
function assertTravel(event: BigEventRow): void {
  if (event.travel_enabled !== true) {
    throw new Error("Turn on Travel to use buses");
  }
}

function isPublished(event: BigEventRow): boolean {
  return Boolean(event.bus_lists_published_at);
}

const inEvent = (bigEventId: string) =>
  Query.equal("big_event_id", [bigEventId]);

/* ---------- Writes: phase by phase, counts for the audit log ---------- */

interface PhaseCount {
  failed: number;
  written: number;
}

/** What the writes did; `complete` only when every phase wrote everything. */
interface WriteLog {
  complete: boolean;
  phases: Record<string, PhaseCount>;
}

function newWriteLog(): WriteLog {
  return { complete: false, phases: {} };
}

/**
 * Runs every write of one phase to the end, even when some fail, and logs
 * the counts. Returns the items written, or null when any write failed so
 * the caller stops before the next phase.
 */
async function writePhase<T>(
  log: WriteLog,
  name: string,
  items: T[],
  write: (item: T) => Promise<unknown>
): Promise<T[] | null> {
  if (items.length === 0) {
    return [];
  }
  const results = await mapAllSettledWithConcurrency(
    items,
    WRITE_CONCURRENCY,
    write
  );
  const done = items.filter(
    (_, index) => results[index]?.status === "fulfilled"
  );
  const failed = items.length - done.length;
  log.phases[name] = { failed, written: done.length };
  if (failed === 0) {
    return done;
  }
  const first = results.find((result) => result.status === "rejected");
  console.error(
    `[big-events] ${failed} bus board writes failed; the first:`,
    first?.status === "rejected" ? first.reason : undefined
  );
  return null;
}

function assertComplete(log: WriteLog): void {
  if (!log.complete) {
    throw new Error("Some changes couldn't be saved. Try again.");
  }
}

/** Owed bus notices (N1): one timestamp per person, overwritten, never added up. */
function markNotices(
  db: AdminDb,
  log: WriteLog,
  participantIds: string[],
  now: string
): Promise<string[] | null> {
  return writePhase(log, "notices", participantIds, (id) =>
    db.updateRow<BigEventParticipantRow>(DATABASE_ID, PARTICIPANTS, id, {
      bus_notice_due_at: now,
    })
  );
}

/* ---------- Reads ---------- */

/** Every group, place and person of the big event; people by name only. */
async function loadBoard(db: AdminDb, bigEventId: string): Promise<FillBoard> {
  const [groups, members, people] = await Promise.all([
    listAllRows<BigEventGroupRow>(db, GROUPS, [inEvent(bigEventId)]),
    listAllRows<BigEventGroupMemberRow>(db, MEMBERS, [
      inEvent(bigEventId),
      Query.select(MEMBER_COLUMNS),
    ]),
    listAllRows<BigEventParticipantRow>(db, PARTICIPANTS, [
      inEvent(bigEventId),
      Query.select(PERSON_COLUMNS),
    ]),
  ]);
  return { groups, members, people };
}

function loadBuses(db: AdminDb, bigEventId: string) {
  return listAllRows<BigEventGroupRow>(db, GROUPS, [
    inEvent(bigEventId),
    Query.equal("kind", ["bus"]),
  ]);
}

/**
 * The people being moved, each one checked (D2): every id must be on this big
 * event's list and on a campus the caller may see.
 */
async function loadPeople(
  db: AdminDb,
  bigEventId: string,
  ids: string[],
  access: GrantedAccess
): Promise<FillPerson[]> {
  const unique = [...new Set(ids)];
  const rows = await listRowsByIds<BigEventParticipantRow>(
    db,
    PARTICIPANTS,
    "$id",
    unique,
    [inEvent(bigEventId), Query.select(PERSON_COLUMNS)]
  );
  if (rows.length !== unique.length) {
    throw new Error("Some of these people are no longer on the list");
  }
  if (!rows.every((row) => canSeeParticipant(access, row))) {
    throw new Error("You can only move people from your own campus");
  }
  return rows;
}

/** Each person's places in groups and on buses. */
async function loadPlaces(
  db: AdminDb,
  bigEventId: string,
  people: FillPerson[]
): Promise<Map<string, PlaceRow[]>> {
  const rows = await listRowsByIds<BigEventGroupMemberRow>(
    db,
    MEMBERS,
    "participant_id",
    people.map((person) => person.$id),
    [inEvent(bigEventId), Query.select(MEMBER_COLUMNS)]
  );
  const byPerson = new Map<string, PlaceRow[]>();
  for (const row of rows) {
    const list = byPerson.get(row.participant_id) ?? [];
    list.push(row);
    byPerson.set(row.participant_id, list);
  }
  return byPerson;
}

function seatsOn(places: PlaceRow[], busIds: Set<string>): PlaceRow[] {
  return places.filter(
    (place) => place.leg !== null && busIds.has(place.group_id)
  );
}

/** A bus seats only people of its own campus (refuse otherwise). */
function assertOnBusCampus(people: FillPerson[], bus: BigEventGroupRow): void {
  if (people.some((person) => person.campus_id !== bus.campus_id)) {
    throw new Error("People can only ride buses of their own campus");
  }
}

/* ---------- Auto-fill ---------- */

/**
 * What auto-fill would do for one campus, or "all" (every campus the caller
 * may fill): seats per bus, who is left without a seat and why, and buses
 * missing a seat count (N5). After publishing it only seats people without
 * a bus (N4). Writes nothing.
 */
export async function previewAutoFill(
  bigEventId: string,
  campusId: string
): Promise<AutoFillPreview> {
  const scope = idSchema.parse(campusId);
  const { access, event } = await requireBigEvent(bigEventId);
  assertTravel(event);
  const campuses = fillCampuses(access, event, scope);
  const { db } = await createAdminClient();
  const board = await loadBoard(db, bigEventId);
  const run = runFill(board, campuses, {
    bigEventId,
    onlyUnseated: isPublished(event),
  });
  const t = await getTranslations("adminPortal.bigEvents.participants");
  return previewOf(board, run, campuses, access, (name) =>
    t("roomName", { name })
  );
}

/**
 * After publishing, the notices of the people the fill seats first (ruling
 * R11: a retry finds them seated and would owe them nothing, and a notice
 * for a seat that then failed is harmless), then seats, then room buses,
 * then the old seats, each phase only once the one before wrote everything.
 * Returns how many people got a new seat.
 */
async function writeFill(
  db: AdminDb,
  bigEventId: string,
  changes: FillChanges,
  notify: boolean,
  log: WriteLog
): Promise<number> {
  const now = new Date().toISOString();
  // After publishing, the fill only seats people without a bus (N4): each
  // of them is owed a notice, or nobody would tell them (N1).
  const seating = [
    ...new Set(changes.create.map((seat) => seat.participantId)),
  ];
  if (notify && !(await markNotices(db, log, seating, now))) {
    return 0;
  }
  const seated = await writePhase(log, "seats", changes.create, (seat) =>
    db.createRow<BigEventGroupMemberRow>(DATABASE_ID, MEMBERS, ID.unique(), {
      assigned_at: now,
      big_event_id: bigEventId,
      group_id: seat.busId,
      leg: seat.leg,
      participant_id: seat.participantId,
      pinned: false,
    })
  );
  if (!seated) {
    return 0;
  }
  const people = new Set(seated.map((seat) => seat.participantId)).size;
  const rooms = await writePhase(log, "rooms", changes.rooms, (room) =>
    db.updateRow<BigEventGroupRow>(DATABASE_ID, GROUPS, room.roomId, {
      home_bus_id: room.homeBusId,
      out_bus_id: room.outBusId,
    })
  );
  if (!rooms) {
    return people;
  }
  const removed = await writePhase(log, "removed", changes.remove, (row) =>
    db.deleteRow(DATABASE_ID, MEMBERS, row.$id)
  );
  log.complete = removed !== null;
  return people;
}

/**
 * Fills the buses of one campus, or "all", as `previewAutoFill` showed: the
 * plan is made again here, never taken from the browser. Refuses while a
 * bus in scope has no seat count (N5). Every attempt that writes is audited
 * with counts only.
 */
export async function applyAutoFill(
  bigEventId: string,
  campusId: string
): Promise<{ moved: number; unplaced: number }> {
  const ctx = await requireAuth();
  const scope = idSchema.parse(campusId);
  const { access, event } = await requireBigEvent(bigEventId);
  assertTravel(event);
  const campuses = fillCampuses(access, event, scope);
  const { db } = await createAdminClient();
  const board = await loadBoard(db, bigEventId);
  const missing = busesOf(board.groups, campuses).filter(
    (bus) => bus.capacity === null
  );
  if (missing.length > 0) {
    const names = missing.map((bus) => bus.name).join(", ");
    throw new Error(`Add a seat count to ${names} before filling the buses`);
  }
  const onlyUnseated = isPublished(event);
  const run = runFill(board, campuses, { bigEventId, onlyUnseated });
  const unplaced = unplacedCount(run);
  const log = newWriteLog();
  let moved = 0;
  try {
    moved = await writeFill(db, bigEventId, run.changes, onlyUnseated, log);
  } finally {
    // Ids and counts only: no names in the audit log.
    await logAuditEvent(ctx, "big_event.bus.fill", {
      payload: {
        campuses,
        complete: log.complete,
        moved,
        only_unseated: onlyUnseated,
        phases: log.phases,
        unplaced,
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  assertComplete(log);
  return { moved, unplaced };
}

/* ---------- Moving by hand ---------- */

/**
 * After publishing, when asked, the notices of people whose bus changes
 * first (ruling R11: a retry after a partial failure finds them on the new
 * bus and would owe them nothing; a notice for a move that then failed is
 * harmless, Stage 3 words it from the current bus). Then new places, pins
 * and the old places, each phase only once the one before wrote everything.
 */
async function writeHandChanges(
  db: AdminDb,
  bigEventId: string,
  changes: HandChanges,
  notices: string[],
  log: WriteLog
): Promise<void> {
  const now = new Date().toISOString();
  if (!(await markNotices(db, log, notices, now))) {
    return;
  }
  const created = await writePhase(log, "created", changes.create, (place) =>
    db.createRow<BigEventGroupMemberRow>(DATABASE_ID, MEMBERS, ID.unique(), {
      assigned_at: now,
      big_event_id: bigEventId,
      group_id: place.groupId,
      leg: place.leg,
      participant_id: place.participantId,
      // Moving by hand pins the person (D5): bus seats and group places
      // alike (ruling R9), so an import can't undo it.
      pinned: true,
    })
  );
  if (!created) {
    return;
  }
  const pinned = await writePhase(log, "pinned", changes.pin, (id) =>
    db.updateRow<BigEventGroupMemberRow>(DATABASE_ID, MEMBERS, id, {
      pinned: true,
    })
  );
  if (!pinned) {
    return;
  }
  const removed = await writePhase(log, "removed", changes.remove, (id) =>
    db.deleteRow(DATABASE_ID, MEMBERS, id)
  );
  log.complete = removed !== null;
}

/** Writes hand moves and audits the attempt (counts only), then revalidates. */
async function saveHandChanges(
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  bigEventId: string,
  action: string,
  changes: HandChanges,
  notices: string[],
  details: Record<string, unknown>
): Promise<void> {
  const { db } = await createAdminClient();
  const log = newWriteLog();
  try {
    await writeHandChanges(db, bigEventId, changes, notices, log);
  } finally {
    await logAuditEvent(ctx, action, {
      payload: {
        ...details,
        complete: log.complete,
        moved: changes.moved.size,
        notices: notices.length,
        phases: log.phases,
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  assertComplete(log);
}

/**
 * Moves people onto a bus, or off every bus with `busId` null, for both legs
 * or one. Moving by hand pins the legs moved (D5); someone put on a bus for
 * the way out who has no way home also gets the same bus home (ruling R5).
 * Each person must be visible to the caller and on the bus's campus, and the
 * bus the caller's (refused otherwise). After publishing, people whose bus
 * changed are owed a notice when `notify` is on (N1).
 */
export async function moveToBus(
  bigEventId: string,
  input: MoveToBusInput
): Promise<{ moved: number }> {
  const ctx = await requireAuth();
  const data = moveToBusSchema.parse(input);
  const { access, event } = await requireBigEvent(bigEventId);
  assertTravel(event);
  const { db } = await createAdminClient();
  const buses = await loadBuses(db, bigEventId);
  const bus = buses.find((row) => row.$id === data.busId) ?? null;
  if (data.busId !== null && !bus) {
    throw new Error("This bus no longer exists");
  }
  if (bus && !canManageGroup(access, bus)) {
    throw new Error("You can only move people onto buses on your own campus");
  }
  const people = await loadPeople(db, bigEventId, data.participantIds, access);
  if (bus) {
    assertOnBusCampus(people, bus);
  }
  const places = await loadPlaces(db, bigEventId, people);
  const busIds = new Set(buses.map((row) => row.$id));
  const changes = emptyHandChanges();
  for (const person of people) {
    const seats = seatsOn(places.get(person.$id) ?? [], busIds);
    seatByHand(changes, {
      busId: data.busId,
      legs: handLegs(data.legs, data.busId, seats),
      participantId: person.$id,
      seats,
    });
  }
  const notices =
    data.notify && isPublished(event) ? [...changes.busMoved] : [];
  await saveHandChanges(
    ctx,
    bigEventId,
    "big_event.bus.move",
    changes,
    notices,
    {
      legs: data.legs,
      notify: data.notify,
      off_the_bus: data.busId === null,
      people: people.length,
    }
  );
  return { moved: changes.moved.size };
}

/**
 * Ruling R12: one group per kind means leaving the others, so every place a
 * group move would remove must be in a group the caller may manage. Checked
 * before any write.
 */
function assertMayLeave(
  places: PlaceRow[],
  targetId: string | null,
  groupOf: (groupId: string) => BigEventGroupRow | undefined,
  access: GrantedAccess
): void {
  const blocked = places.some((place) => {
    if (place.group_id === targetId) {
      return false;
    }
    const group = groupOf(place.group_id);
    return !(group && canManageGroup(access, group));
  });
  if (blocked) {
    throw new Error("Someone here is in a group you can't change.");
  }
}

/** The room's bus per leg, while Travel is on; home follows out when unset. */
function roomRides(
  group: BigEventGroupRow | null,
  buses: BigEventGroupRow[],
  event: BigEventRow
): { bus: BigEventGroupRow; leg: Leg }[] {
  if (group?.kind !== "room" || event.travel_enabled !== true) {
    return [];
  }
  // A room with only a bus out rides it home too (ruling R12, R5).
  const legs: [Leg, string | null][] = [
    ["out", group.out_bus_id],
    ["home", group.home_bus_id ?? group.out_bus_id],
  ];
  return legs.flatMap(([leg, busId]) => {
    const bus = buses.find((row) => row.$id === busId);
    return bus ? [{ bus, leg }] : [];
  });
}

/**
 * Puts people in a room, buddy group, team or other group, or takes them out
 * of every group of that kind with `groupId` null: one group per kind per
 * person. A new place is pinned (ruling R9), so an import can't undo it. A
 * room with a bus also puts them on that bus by hand (pinned) on
 * each leg they aren't pinned on (D5: a person named into a room takes its
 * bus), except that a pinned way out keeps the way home on that bus (ruling
 * R10), with the same campus checks as `moveToBus`. After publishing, people
 * whose bus changed are owed a notice unless `notify` is false (N1).
 */
export async function moveToGroup(
  bigEventId: string,
  input: MoveToGroupInput
): Promise<{ moved: number }> {
  const ctx = await requireAuth();
  const data = moveToGroupSchema.parse(input);
  const { access, event } = await requireBigEvent(bigEventId);
  const { db } = await createAdminClient();
  const groups = await listAllRows<BigEventGroupRow>(db, GROUPS, [
    inEvent(bigEventId),
  ]);
  const group =
    groups.find((row) => row.$id === data.groupId && row.kind === data.kind) ??
    null;
  if (data.groupId !== null && !group) {
    throw new Error("This group no longer exists");
  }
  if (group && !canManageGroup(access, group)) {
    throw new Error("You can only move people into groups on your own campus");
  }
  const people = await loadPeople(db, bigEventId, data.participantIds, access);
  const buses = groups.filter((row) => row.kind === "bus");
  const rides = roomRides(group, buses, event);
  for (const { bus } of rides) {
    if (!canManageGroup(access, bus)) {
      throw new Error("You can only move people onto buses on your own campus");
    }
    assertOnBusCampus(people, bus);
  }
  const places = await loadPlaces(db, bigEventId, people);
  const ofKind = new Map(
    groups.filter((row) => row.kind === data.kind).map((row) => [row.$id, row])
  );
  const placesOfKind = (person: FillPerson) =>
    (places.get(person.$id) ?? []).filter((place) =>
      ofKind.has(place.group_id)
    );
  assertMayLeave(
    people.flatMap(placesOfKind),
    data.groupId,
    (groupId) => ofKind.get(groupId),
    access
  );
  const busIds = new Set(buses.map((row) => row.$id));
  const changes = emptyHandChanges();
  for (const person of people) {
    const own = places.get(person.$id) ?? [];
    placeByHand(changes, {
      groupId: data.groupId,
      participantId: person.$id,
      places: placesOfKind(person),
    });
    rideWithRoom(changes, {
      // R10 follows a pinned way out only onto a bus the caller may change,
      // of the person's campus (as the import follows only known buses).
      canFollow: (busId) => {
        const bus = buses.find((row) => row.$id === busId);
        return Boolean(
          bus &&
            canManageGroup(access, bus) &&
            bus.campus_id === person.campus_id
        );
      },
      participantId: person.$id,
      rides: rides.map(({ bus, leg }) => ({ busId: bus.$id, leg })),
      seats: seatsOn(own, busIds),
    });
  }
  const notices =
    data.notify && isPublished(event) ? [...changes.busMoved] : [];
  await saveHandChanges(
    ctx,
    bigEventId,
    "big_event.group.move",
    changes,
    notices,
    {
      bus_moved: changes.busMoved.size,
      kind: data.kind,
      notify: data.notify,
      people: people.length,
    }
  );
  return { moved: changes.moved.size };
}

/**
 * Pins or unpins every bus seat of these people on the caller's buses. A
 * pinned seat is never moved by auto-fill or an import.
 */
export async function setPinned(
  bigEventId: string,
  input: { participantIds: string[]; pinned: boolean }
): Promise<void> {
  const ctx = await requireAuth();
  const data = setPinnedSchema.parse(input);
  const { access, event } = await requireBigEvent(bigEventId);
  assertTravel(event);
  const { db } = await createAdminClient();
  const buses = await loadBuses(db, bigEventId);
  const people = await loadPeople(db, bigEventId, data.participantIds, access);
  const places = await loadPlaces(db, bigEventId, people);
  const ownBuses = new Set(
    buses.filter((bus) => canManageGroup(access, bus)).map((bus) => bus.$id)
  );
  const seats = [...places.values()]
    .flatMap((list) => seatsOn(list, ownBuses))
    .filter((seat) => (seat.pinned === true) !== data.pinned);
  const log = newWriteLog();
  try {
    const written = await writePhase(log, "pins", seats, (seat) =>
      db.updateRow<BigEventGroupMemberRow>(DATABASE_ID, MEMBERS, seat.$id, {
        pinned: data.pinned,
      })
    );
    log.complete = written !== null;
  } finally {
    await logAuditEvent(ctx, "big_event.bus.pin", {
      payload: {
        complete: log.complete,
        people: people.length,
        phases: log.phases,
        pinned: data.pinned,
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  assertComplete(log);
}

/* ---------- Publishing ---------- */

/** Everyone with a seat on the way out: the people a bus list names. */
async function outRiders(db: AdminDb, bigEventId: string): Promise<string[]> {
  const [buses, members] = await Promise.all([
    loadBuses(db, bigEventId),
    listAllRows<BigEventGroupMemberRow>(db, MEMBERS, [
      inEvent(bigEventId),
      Query.select(MEMBER_COLUMNS),
    ]),
  ]);
  const busIds = new Set(buses.map((bus) => bus.$id));
  return [
    ...new Set(
      seatsOn(members, busIds)
        .filter((seat) => seat.leg === "out")
        .map((seat) => seat.participant_id)
    ),
  ];
}

/**
 * Publishes the bus lists of the whole big event (N3, needs settings
 * access): participants see their bus from now on, and everyone with a bus
 * out is owed the "You're on Bus 2" notice (N1). There is no unpublish, so
 * once it has published it refuses to run again; a failed run hasn't
 * published and can be run again.
 */
export async function publishBusLists(
  bigEventId: string
): Promise<{ notices: number }> {
  const ctx = await requireAuth();
  const { access, event } = await requireBigEvent(bigEventId);
  if (!canEditBigEventSettings(access)) {
    throw new Error(
      "Publishing bus lists needs access to the big event's settings"
    );
  }
  assertTravel(event);
  if (isPublished(event)) {
    throw new Error("The bus lists are already published");
  }
  const { db } = await createAdminClient();
  const riders = await outRiders(db, bigEventId);
  const now = new Date().toISOString();
  const log = newWriteLog();
  try {
    // Notices first, the stamp last (ruling R11): a failed publish isn't
    // published yet, so it can run again and mark everyone. Stage 3 sends
    // bus notices only once the lists are published.
    const marked = await markNotices(db, log, riders, now);
    const published =
      marked &&
      (await writePhase(log, "published", [bigEventId], (id) =>
        db.updateRow<BigEventRow>(DATABASE_ID, EVENTS, id, {
          bus_lists_published_at: now,
          bus_lists_published_by: ctx.userId,
        })
      ));
    log.complete = Boolean(published);
  } finally {
    await logAuditEvent(ctx, "big_event.bus.publish", {
      payload: {
        complete: log.complete,
        notices: log.phases.notices?.written ?? 0,
        phases: log.phases,
      },
      resourceId: bigEventId,
      resourceType: "big_event",
    });
    revalidateBigEvent(bigEventId);
  }
  assertComplete(log);
  return { notices: riders.length };
}
