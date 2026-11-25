import { GROUP_LEGS } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";
import type { AutoFillInput } from "./plan-auto-fill";
import { busOf, type Leg, roomOpenPlaces } from "./seats";

/* Who rides together in an auto-fill, and which seats it leaves alone. */

/** A room, or one person who isn't in a room of this campus. */
export interface Unit {
  /** The room's id, or the person's id. */
  id: string;
  openPlaces: number;
  /** The people to seat: their out leg isn't fixed. */
  people: string[];
  room: BigEventGroupRow | null;
}

export interface Units {
  /** Rooms held to one bus by a fixed member (or their own bus). */
  anchored: { busId: string; unit: Unit }[];
  /** Units to place, largest first. */
  free: Unit[];
  /** Rooms held to two or more buses. */
  split: Unit[];
}

export interface Fill {
  /** Every room of the event, for counting seats. */
  allRooms: BigEventGroupRow[];
  /** This campus's buses by id. */
  buses: BigEventGroupRow[];
  busIds: Set<string>;
  input: AutoFillInput;
  /** Each person's bus memberships (rows with a leg), any bus. */
  seatRows: Map<string, BigEventGroupMemberRow[]>;
}

export function compareIds(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function seatsNeeded(unit: Unit): number {
  return unit.people.length + unit.openPlaces;
}

/** A leg the plan leaves alone: pinned, or (after publishing) has a bus. */
export function isFixed(fill: Fill, personId: string, leg: Leg): boolean {
  return (fill.seatRows.get(personId) ?? []).some(
    (row) => row.leg === leg && (fill.input.onlyUnseated || row.pinned === true)
  );
}

/** Out, and home with it unless the home leg is fixed. */
export function legsToSet(fill: Fill, personId: string): Leg[] {
  return GROUP_LEGS.filter((leg) => !isFixed(fill, personId, leg));
}

/** The buses a room is held to: its members' fixed out seats, and after publishing its own bus. */
function roomAnchors(
  fill: Fill,
  room: BigEventGroupRow,
  named: string[]
): string[] {
  const anchors = new Set<string>();
  for (const id of named) {
    const busId = isFixed(fill, id, "out")
      ? busOf(id, "out", fill.seatRows.get(id) ?? [], fill.busIds)
      : null;
    if (busId) {
      anchors.add(busId);
    }
  }
  const ownBus = room.out_bus_id;
  if (fill.input.onlyUnseated && ownBus && fill.busIds.has(ownBus)) {
    anchors.add(ownBus);
  }
  return [...anchors].sort(compareIds);
}

/** Each campus person's room: the first campus room (by id) they're named in. */
function namedPerRoom(
  fill: Fill,
  campusPeople: string[],
  rooms: BigEventGroupRow[]
): { named: Map<string, string[]>; roomless: string[] } {
  const roomIds = new Set(rooms.map((room) => room.$id));
  const isCampusPerson = new Set(campusPeople);
  const roomOf = new Map<string, string>();
  for (const member of fill.input.members) {
    const current = roomOf.get(member.participant_id);
    const counts =
      roomIds.has(member.group_id) &&
      isCampusPerson.has(member.participant_id) &&
      (current === undefined || member.group_id < current);
    if (counts) {
      roomOf.set(member.participant_id, member.group_id);
    }
  }
  const named = new Map<string, string[]>();
  const roomless: string[] = [];
  for (const id of campusPeople) {
    const roomId = roomOf.get(id);
    if (roomId === undefined) {
      roomless.push(id);
      continue;
    }
    const list = named.get(roomId);
    if (list) {
      list.push(id);
    } else {
      named.set(roomId, [id]);
    }
  }
  return { named, roomless };
}

export function buildUnits(fill: Fill): Units {
  const { input } = fill;
  const campusPeople = input.participants
    .filter((participant) => participant.campus_id === input.campusId)
    .map((participant) => participant.$id)
    .sort(compareIds);
  const rooms = fill.allRooms.filter(
    (room) => room.campus_id === input.campusId
  );
  const { named, roomless } = namedPerRoom(fill, campusPeople, rooms);
  const openPlaces = roomOpenPlaces(rooms, input.members);
  const units: Units = { anchored: [], free: [], split: [] };
  for (const id of roomless) {
    if (!isFixed(fill, id, "out")) {
      units.free.push({ id, openPlaces: 0, people: [id], room: null });
    }
  }
  for (const room of rooms) {
    const inRoom = named.get(room.$id) ?? [];
    const unit: Unit = {
      id: room.$id,
      openPlaces: openPlaces.get(room.$id) ?? 0,
      people: inRoom.filter((id) => !isFixed(fill, id, "out")),
      room,
    };
    const [anchor, ...others] = roomAnchors(fill, room, inRoom);
    if (anchor === undefined) {
      if (seatsNeeded(unit) > 0) {
        units.free.push(unit);
      }
    } else if (others.length > 0) {
      units.split.push(unit);
    } else {
      units.anchored.push({ busId: anchor, unit });
    }
  }
  units.free.sort(
    (a, b) => seatsNeeded(b) - seatsNeeded(a) || compareIds(a.id, b.id)
  );
  return units;
}

function seatRowsByPerson(
  members: BigEventGroupMemberRow[]
): Map<string, BigEventGroupMemberRow[]> {
  const rows = new Map<string, BigEventGroupMemberRow[]>();
  for (const member of members) {
    if (member.leg === null) {
      continue;
    }
    const list = rows.get(member.participant_id);
    if (list) {
      list.push(member);
    } else {
      rows.set(member.participant_id, [member]);
    }
  }
  return rows;
}

/** This campus's buses and every room, sorted by id, and each person's seats. */
export function createFill(input: AutoFillInput): Fill {
  const buses = input.buses
    .filter((bus) => bus.campus_id === input.campusId)
    .sort((a, b) => compareIds(a.$id, b.$id));
  return {
    allRooms: input.rooms
      .filter((room) => room.kind === "room")
      .sort((a, b) => compareIds(a.$id, b.$id)),
    busIds: new Set(buses.map((bus) => bus.$id)),
    buses,
    input,
    seatRows: seatRowsByPerson(input.members),
  };
}
