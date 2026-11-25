import { GROUP_LEGS, type GroupLeg } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";
import type { ImportPlan, PlacementTarget } from "./plan-import";

/** A bus seat someone takes from their room's bus (spec D5, N2). */
export interface RoomBusSeat {
  busId: string;
  leg: GroupLeg;
  person: PlacementTarget;
}

/** Someone in a room once the import is saved, from the list or from the plan. */
export interface RoomStay {
  person: PlacementTarget;
  room: BigEventGroupRow;
}

function participantIdOf(person: PlacementTarget): string | null {
  return "participantId" in person ? person.participantId : null;
}

/** The buses the caller can see: the only ones an import writes to. */
function seenBuses(groups: BigEventGroupRow[]): Set<string> {
  return new Set(
    groups.filter((group) => group.kind === "bus").map((group) => group.$id)
  );
}

function seatsByPerson(
  members: BigEventGroupMemberRow[]
): Map<string, BigEventGroupMemberRow[]> {
  const seats = new Map<string, BigEventGroupMemberRow[]>();
  for (const member of members) {
    // A bus seat has a leg; a place in any other group doesn't.
    if (member.leg !== null) {
      const own = seats.get(member.participant_id) ?? [];
      own.push(member);
      seats.set(member.participant_id, own);
    }
  }
  return seats;
}

/**
 * The legs each person has a seat on a bus the caller can't see (another
 * campus's, ruling R4). The import never adds a second seat on such a leg
 * and never removes that seat (ruling R13).
 */
export function unseenSeatLegs(
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): Map<string, Set<GroupLeg>> {
  const buses = seenBuses(groups);
  const legs = new Map<string, Set<GroupLeg>>();
  for (const member of members) {
    if (member.leg !== null && !buses.has(member.group_id)) {
      const own = legs.get(member.participant_id) ?? new Set();
      own.add(member.leg);
      legs.set(member.participant_id, own);
    }
  }
  return legs;
}

/** The legs a bus placement still writes: those not held on an unseen bus. */
export function freeLegs(
  unseen: Map<string, Set<GroupLeg>>,
  participantId: string | null
): GroupLeg[] {
  const held = participantId ? unseen.get(participantId) : undefined;
  return GROUP_LEGS.filter((leg) => !held?.has(leg));
}

/** A room's bus on a leg; home defaults to the out bus (spec D5, ruling R12). */
function roomBusOn(room: BigEventGroupRow, leg: GroupLeg): string | null {
  return (
    (leg === "out" ? room.out_bus_id : (room.home_bus_id ?? room.out_bus_id)) ??
    null
  );
}

/**
 * The bus someone rides on a leg with their room. A way out moved by hand
 * (a pinned out seat) takes the way home with it, as in the auto-fill
 * planner (ruling R5): home follows out, not the room's home bus.
 */
function busFor(
  room: BigEventGroupRow,
  leg: GroupLeg,
  pinnedOut: string | null
): string | null {
  const roomBus = roomBusOn(room, leg);
  return leg === "home" && roomBus && pinnedOut ? pinnedOut : roomBus;
}

/**
 * The legs people ride with their room (spec D5: a person named into a room
 * takes the room's bus): each leg the room has a bus for, unless the person
 * is held on that leg: moved by hand onto another bus (a pinned seat), or
 * seated on a bus the caller can't see (ruling R13). Home follows a
 * hand-moved way out (ruling R5).
 */
export function roomBusSeats(
  stays: RoomStay[],
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): RoomBusSeat[] {
  const buses = seenBuses(groups);
  const seats = seatsByPerson(members);
  const wanted: RoomBusSeat[] = [];
  for (const { person, room } of stays) {
    const participantId = participantIdOf(person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    const pinnedOut =
      own.find((seat) => seat.leg === "out" && seat.pinned === true)
        ?.group_id ?? null;
    for (const leg of GROUP_LEGS) {
      const busId = busFor(room, leg, pinnedOut);
      const held = own.some(
        (seat) =>
          seat.leg === leg &&
          ((seat.pinned === true && seat.group_id !== busId) ||
            !buses.has(seat.group_id))
      );
      if (busId && buses.has(busId) && !held) {
        wanted.push({ busId, leg, person });
      }
    }
  }
  return wanted;
}

/** Room bus seats someone doesn't have yet: written with the new places. */
export function roomBusSeatsToAdd(
  plan: ImportPlan,
  members: BigEventGroupMemberRow[]
): RoomBusSeat[] {
  const seats = seatsByPerson(members);
  return plan.roomBuses.filter((seat) => {
    const participantId = participantIdOf(seat.person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    return !own.some(
      (member) => member.leg === seat.leg && member.group_id === seat.busId
    );
  });
}

/**
 * Other seats on a leg someone rides with their room, on any bus the caller
 * can see, removed with the old places (ruling R3a). Pinned seats are never
 * removed. Driven by the room, not by new seats, so a re-import repairs a
 * half-saved move (ruling R34).
 */
export function roomBusRemovals(
  plan: ImportPlan,
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): BigEventGroupMemberRow[] {
  const buses = seenBuses(groups);
  const seats = seatsByPerson(members);
  const removed = new Map<string, BigEventGroupMemberRow>();
  for (const seat of plan.roomBuses) {
    const participantId = participantIdOf(seat.person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    for (const member of own) {
      if (
        member.leg === seat.leg &&
        member.group_id !== seat.busId &&
        member.pinned !== true &&
        buses.has(member.group_id)
      ) {
        removed.set(member.$id, member);
      }
    }
  }
  return [...removed.values()];
}
