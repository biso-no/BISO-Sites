import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";
import { busOf, type Leg } from "./seats";

/* What moving people by hand writes, worked out on rows in memory. */

/** Which legs a hand move covers, as the bus board offers them. */
export const BUS_LEGS = ["both", "out", "home"] as const;
export type BusLegs = (typeof BUS_LEGS)[number];

/** The membership fields a hand move reads. */
export type PlaceRow = Pick<
  BigEventGroupMemberRow,
  "$id" | "group_id" | "leg" | "participant_id" | "pinned"
>;

/** A place to create, always pinned: a bus seat (with a leg) or a group place (no leg). */
export interface NewPlace {
  groupId: string;
  leg: Leg | null;
  participantId: string;
}

/** The room fields a room's bus follow reads. */
export type RoomBusRow = Pick<
  BigEventGroupRow,
  "$id" | "campus_id" | "home_bus_id" | "out_bus_id"
>;

/** A room whose buses change. */
export interface RoomBusChange {
  homeBusId: string | null;
  outBusId: string | null;
  roomId: string;
}

/** The writes of a batch of hand moves. */
export interface HandChanges {
  /** People whose bus changed on a leg: a change they may be told about. */
  busMoved: Set<string>;
  create: NewPlace[];
  /** People with any change. */
  moved: Set<string>;
  /** Places that stay and get pinned: bus seats and group places. */
  pin: string[];
  /** Memberships to delete. */
  remove: string[];
  /** Rooms whose buses follow their people (ruling R18). */
  rooms: RoomBusChange[];
}

export function emptyHandChanges(): HandChanges {
  return {
    busMoved: new Set(),
    create: [],
    moved: new Set(),
    pin: [],
    remove: [],
    rooms: [],
  };
}

/**
 * The legs a hand move sets. Home defaults to out (D5, ruling R5): putting
 * someone without a home seat on a bus for the way out gives them a home
 * seat on it too. `seats` are the person's bus seats.
 */
export function handLegs(
  legs: BusLegs,
  busId: string | null,
  seats: readonly PlaceRow[]
): Leg[] {
  if (legs === "both") {
    return ["out", "home"];
  }
  if (legs === "home") {
    return ["home"];
  }
  const hasHome = seats.some((seat) => seat.leg === "home");
  return busId !== null && !hasHome ? ["out", "home"] : ["out"];
}

/** Pinned seats first (moved by hand), then the lowest row id. */
function bestSeat(seats: PlaceRow[]): PlaceRow | null {
  let best: PlaceRow | null = null;
  for (const seat of seats) {
    const pinned = seat.pinned === true;
    const bestPinned = best?.pinned === true;
    if (
      best === null ||
      (pinned && !bestPinned) ||
      (pinned === bestPinned && seat.$id < best.$id)
    ) {
      best = seat;
    }
  }
  return best;
}

/**
 * Puts one person on `busId` for `legs` by hand, or off every bus when
 * `busId` is null. Each leg ends with exactly one seat, pinned (D5: moving
 * by hand pins the person); a seat already on that bus stays and is pinned,
 * every other seat on the leg goes, pinned or not. `seats` are the person's
 * bus seats.
 */
export function seatByHand(
  changes: HandChanges,
  move: {
    busId: string | null;
    legs: readonly Leg[];
    participantId: string;
    seats: readonly PlaceRow[];
  }
): void {
  const { busId, participantId } = move;
  const busIds = new Set(move.seats.map((seat) => seat.group_id));
  for (const leg of move.legs) {
    const onLeg = move.seats.filter((seat) => seat.leg === leg);
    const before = busOf(participantId, leg, onLeg, busIds);
    const keeper = bestSeat(onLeg.filter((seat) => seat.group_id === busId));
    for (const seat of onLeg) {
      if (seat !== keeper) {
        changes.remove.push(seat.$id);
      }
    }
    if (keeper && keeper.pinned !== true) {
      changes.pin.push(keeper.$id);
    }
    if (busId !== null && !keeper) {
      changes.create.push({ groupId: busId, leg, participantId });
    }
    if (before !== busId) {
      changes.busMoved.add(participantId);
      changes.moved.add(participantId);
    }
  }
}

/**
 * Puts one person on their room's buses by hand (D5: a person named into a
 * room takes its bus), leg by leg: a pinned leg stays where it is. With a
 * pinned way out, the way home doesn't take the room's home bus (ruling
 * R10): a way home they have stays as it is, as auto-fill keeps it (rulings
 * R3c, R19); without one they get it on the way-out bus (ruling R5), but
 * only onto a bus `canFollow` allows (one the caller may change, of the
 * person's campus), otherwise on the room's bus. `seats` are the person's
 * bus seats.
 */
export function rideWithRoom(
  changes: HandChanges,
  move: {
    canFollow: (busId: string) => boolean;
    participantId: string;
    rides: readonly { busId: string; leg: Leg }[];
    seats: readonly PlaceRow[];
  }
): void {
  const { participantId, seats } = move;
  const pinnedOutBus = seats.find(
    (seat) => seat.leg === "out" && seat.pinned === true
  )?.group_id;
  const hasHome = seats.some((seat) => seat.leg === "home");
  const keepsHome = Boolean(pinnedOutBus) && hasHome;
  const pinnedOut =
    pinnedOutBus && !hasHome && move.canFollow(pinnedOutBus)
      ? pinnedOutBus
      : null;
  for (const { busId, leg } of move.rides) {
    const held =
      (leg === "home" && keepsHome) ||
      seats.some((seat) => seat.leg === leg && seat.pinned === true);
    if (!held) {
      seatByHand(changes, {
        busId: leg === "home" && pinnedOut ? pinnedOut : busId,
        legs: [leg],
        participantId,
        seats,
      });
    }
  }
}

/**
 * Puts one person in `groupId`, or in no group of this kind when null: one
 * group per kind per person. A place already in that group stays and is
 * pinned, as a new one would be (rulings R9, R12). `places` are the
 * person's places in groups of this kind.
 */
export function placeByHand(
  changes: HandChanges,
  move: {
    groupId: string | null;
    participantId: string;
    places: readonly PlaceRow[];
  }
): void {
  const { groupId, participantId } = move;
  const keeper = move.places.find((place) => place.group_id === groupId);
  for (const place of move.places) {
    if (place !== keeper) {
      changes.remove.push(place.$id);
      changes.moved.add(participantId);
    }
  }
  if (keeper && keeper.pinned !== true) {
    changes.pin.push(keeper.$id);
  }
  if (groupId !== null && !keeper) {
    changes.create.push({ groupId, leg: null, participantId });
    changes.moved.add(participantId);
  }
}

/** Every place once `changes` are written: removed rows gone, new ones added. */
function placesAfter(
  changes: HandChanges,
  places: readonly PlaceRow[]
): Map<string, PlaceRow[]> {
  const removed = new Set(changes.remove);
  const created = changes.create.map((place, index) => ({
    // Real row ids never contain a colon.
    $id: `new:${index}`,
    group_id: place.groupId,
    leg: place.leg,
    participant_id: place.participantId,
    pinned: true,
  }));
  const byPerson = new Map<string, PlaceRow[]>();
  for (const place of [...places, ...created]) {
    if (!removed.has(place.$id)) {
      const own = byPerson.get(place.participant_id) ?? [];
      own.push(place);
      byPerson.set(place.participant_id, own);
    }
  }
  return byPerson;
}

/**
 * Ruling R18: a room's bus follows its people. Once the hand moves are
 * written, each leg on which every person named in the room rides the same
 * bus takes that bus, so the room's open places are held there and someone
 * named into it later rides with the others. A leg whose people are split,
 * or not all on a bus, keeps its bus, and so does a room nobody is named in.
 * Nobody is owed a notice for it. Adds the rooms that change to
 * `changes.rooms`. `places` are every membership of everyone named in
 * `rooms`, before the moves.
 *
 * Ruling R23: a room only ever takes a bus of its own campus, so nobody is
 * seated on another campus's bus through their room. A room on National or
 * with no campus never follows (the fill never gives those a bus either).
 * `busCampus` maps every bus id to its campus.
 */
export function followRooms(
  changes: HandChanges,
  input: {
    busCampus: ReadonlyMap<string, string | null>;
    busIds: ReadonlySet<string>;
    places: readonly PlaceRow[];
    rooms: readonly RoomBusRow[];
  }
): void {
  const after = placesAfter(changes, input.places);
  const namedIn = new Map<string, string[]>();
  for (const [personId, own] of after) {
    for (const place of own) {
      if (place.leg === null) {
        const named = namedIn.get(place.group_id) ?? [];
        named.push(personId);
        namedIn.set(place.group_id, named);
      }
    }
  }
  for (const room of input.rooms) {
    const named = namedIn.get(room.$id) ?? [];
    const sharedBus = (leg: Leg): string | null => {
      const buses = new Set(
        named.map((id) => busOf(id, leg, after.get(id) ?? [], input.busIds))
      );
      const [only = null] = buses;
      if (buses.size !== 1 || only === null) {
        return null;
      }
      return input.busCampus.get(only) === room.campus_id ? only : null;
    };
    const outBusId = sharedBus("out") ?? room.out_bus_id;
    const homeBusId = sharedBus("home") ?? room.home_bus_id;
    if (outBusId !== room.out_bus_id || homeBusId !== room.home_bus_id) {
      changes.rooms.push({ homeBusId, outBusId, roomId: room.$id });
    }
  }
}
