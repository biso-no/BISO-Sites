import type { GroupLeg } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";

/** A bus trip: "out" to the event, "home" back. */
export type Leg = GroupLeg;

/** Seats taken on one bus, per leg. */
export interface SeatUse {
  home: number;
  out: number;
}

/** The membership fields seat counting reads. */
export type SeatMember = Pick<
  BigEventGroupMemberRow,
  "group_id" | "leg" | "participant_id"
>;

/** The room fields seat counting reads. */
export type SeatRoom = Pick<
  BigEventGroupRow,
  "$id" | "capacity" | "home_bus_id" | "out_bus_id"
>;

/**
 * Open places per room: its capacity minus the people named in it, never
 * below zero. A room without a capacity has no open places.
 */
export function roomOpenPlaces(
  rooms: readonly SeatRoom[],
  members: readonly SeatMember[]
): Map<string, number> {
  const named = new Map<string, Set<string>>();
  for (const room of rooms) {
    named.set(room.$id, new Set());
  }
  for (const member of members) {
    named.get(member.group_id)?.add(member.participant_id);
  }
  const places = new Map<string, number>();
  for (const room of rooms) {
    const count = named.get(room.$id)?.size ?? 0;
    places.set(room.$id, Math.max((room.capacity ?? 0) - count, 0));
  }
  return places;
}

function addSeats(
  use: Map<string, SeatUse>,
  busId: string | null,
  leg: Leg,
  seats: number
): void {
  const bus = busId ? use.get(busId) : undefined;
  if (bus) {
    bus[leg] += seats;
  }
}

/**
 * Seats taken on each bus per leg: the people on it (each person once per
 * leg) plus the open places of rooms whose `out_bus_id` / `home_bus_id` is
 * that bus, so a room's open places are held for the people not named yet.
 */
export function busSeatUse(input: {
  buses: readonly Pick<BigEventGroupRow, "$id">[];
  rooms: readonly SeatRoom[];
  members: readonly SeatMember[];
}): Map<string, SeatUse> {
  const use = new Map<string, SeatUse>();
  for (const bus of input.buses) {
    use.set(bus.$id, { out: 0, home: 0 });
  }
  const counted = new Set<string>();
  for (const member of input.members) {
    const key = `${member.group_id}|${member.leg}|${member.participant_id}`;
    if (member.leg === null || counted.has(key)) {
      continue;
    }
    counted.add(key);
    addSeats(use, member.group_id, member.leg, 1);
  }
  const places = roomOpenPlaces(input.rooms, input.members);
  for (const room of input.rooms) {
    const open = places.get(room.$id) ?? 0;
    addSeats(use, room.out_bus_id, "out", open);
    addSeats(use, room.home_bus_id, "home", open);
  }
  return use;
}

type LegMember = Pick<
  BigEventGroupMemberRow,
  "$id" | "group_id" | "leg" | "participant_id" | "pinned"
>;

/** Pinned seats first (moved by hand), then the lowest row id. */
function ranksBefore(a: LegMember, b: LegMember): boolean {
  const aPinned = a.pinned === true;
  if (aPinned !== (b.pinned === true)) {
    return aPinned;
  }
  return a.$id < b.$id;
}

/**
 * The bus a person rides on one leg, among `buses`, or null. Should a person
 * have two seats on a leg, the pinned one wins, then the lowest row id.
 */
export function busOf(
  personId: string,
  leg: Leg,
  members: readonly LegMember[],
  buses: ReadonlySet<string>
): string | null {
  let best: LegMember | null = null;
  for (const member of members) {
    const onLeg =
      member.participant_id === personId &&
      member.leg === leg &&
      buses.has(member.group_id);
    if (onLeg && (best === null || ranksBefore(member, best))) {
      best = member;
    }
  }
  return best?.group_id ?? null;
}
