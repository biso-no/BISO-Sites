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

function roomBusOn(room: BigEventGroupRow, leg: GroupLeg): string | null {
  return (leg === "out" ? room.out_bus_id : room.home_bus_id) ?? null;
}

/**
 * The legs people ride with their room (spec D5: a person named into a room
 * takes the room's bus): each leg the room has a bus for, unless the person
 * was moved by hand onto another bus on that leg (a pinned seat).
 */
export function roomBusSeats(
  stays: RoomStay[],
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): RoomBusSeat[] {
  const buses = new Set(
    groups.filter((group) => group.kind === "bus").map((group) => group.$id)
  );
  const seats = seatsByPerson(members);
  const wanted: RoomBusSeat[] = [];
  for (const { person, room } of stays) {
    const participantId = participantIdOf(person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    for (const leg of GROUP_LEGS) {
      const busId = roomBusOn(room, leg);
      const movedByHand = own.some(
        (seat) =>
          seat.leg === leg && seat.pinned === true && seat.group_id !== busId
      );
      if (busId && buses.has(busId) && !movedByHand) {
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
 * Other seats on a leg someone rides with their room, on any bus, removed
 * with the old places (ruling R3a). Pinned seats are never removed. Driven
 * by the room, not by new seats, so a re-import repairs a half-saved move
 * (ruling R34).
 */
export function roomBusRemovals(
  plan: ImportPlan,
  members: BigEventGroupMemberRow[]
): BigEventGroupMemberRow[] {
  const seats = seatsByPerson(members);
  const removed = new Map<string, BigEventGroupMemberRow>();
  for (const seat of plan.roomBuses) {
    const participantId = participantIdOf(seat.person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    for (const member of own) {
      if (
        member.leg === seat.leg &&
        member.group_id !== seat.busId &&
        member.pinned !== true
      ) {
        removed.set(member.$id, member);
      }
    }
  }
  return [...removed.values()];
}
