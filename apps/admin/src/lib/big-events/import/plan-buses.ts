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
  /** Their campus once the import is saved. */
  campusId: string | null;
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
 * What a way out moved by hand (a pinned out seat) does to the way home:
 * never the room's home bus (ruling R10). A way home they have stays as it
 * is, as auto-fill keeps it (`keep`, rulings R3c, R19); without one it
 * follows the way out when `canRide` allows that bus (`follow`, ruling R5),
 * otherwise it takes the room's bus.
 */
function homeWithPinnedOut(
  own: BigEventGroupMemberRow[],
  canRide: (busId: string | null) => busId is string
): { follow: string | null; keep: boolean } {
  const pinnedOut =
    own.find((seat) => seat.leg === "out" && seat.pinned === true)?.group_id ??
    null;
  const hasHome = own.some((seat) => seat.leg === "home");
  return {
    follow: !hasHome && canRide(pinnedOut) ? pinnedOut : null,
    keep: pinnedOut !== null && hasHome,
  };
}

/**
 * The legs people ride with their room (spec D5: a person named into a room
 * takes the room's bus): each leg the room has a bus for, when that bus is
 * one the caller can see on the person's campus (ruling R19), unless the
 * person is held on that leg: moved by hand onto another bus (a pinned
 * seat), or seated on a bus the caller can't see (ruling R13). A way out
 * moved by hand decides the way home (`homeWithPinnedOut`).
 */
export function roomBusSeats(
  stays: RoomStay[],
  groups: BigEventGroupRow[],
  members: BigEventGroupMemberRow[]
): RoomBusSeat[] {
  const busCampus = new Map(
    groups
      .filter((group) => group.kind === "bus")
      .map((group) => [group.$id, group.campus_id])
  );
  const seats = seatsByPerson(members);
  const wanted: RoomBusSeat[] = [];
  for (const { campusId, person, room } of stays) {
    const canRide = (busId: string | null): busId is string =>
      busId !== null &&
      busCampus.has(busId) &&
      busCampus.get(busId) === campusId;
    const participantId = participantIdOf(person);
    const own = participantId ? (seats.get(participantId) ?? []) : [];
    const home = homeWithPinnedOut(own, canRide);
    for (const leg of GROUP_LEGS) {
      const roomBus = roomBusOn(room, leg);
      if (!canRide(roomBus) || (leg === "home" && home.keep)) {
        continue;
      }
      const busId = leg === "home" && home.follow ? home.follow : roomBus;
      const held = own.some(
        (seat) =>
          seat.leg === leg &&
          ((seat.pinned === true && seat.group_id !== busId) ||
            !busCampus.has(seat.group_id))
      );
      if (!held) {
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
 * removed, nor seats of someone the room's bus doesn't take (another
 * campus, ruling R19: `roomBusSeats` leaves them out). Driven by the room,
 * not by new seats, so a re-import repairs a half-saved move (ruling R34).
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
