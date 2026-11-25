import type { BigEventGroupMemberRow } from "@repo/shared/big-events/types";
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

/** A place to create: a pinned bus seat (with a leg) or a group place (no leg). */
export interface NewPlace {
  groupId: string;
  leg: Leg | null;
  participantId: string;
}

/** The writes of a batch of hand moves. */
export interface HandChanges {
  /** People whose bus changed on a leg: a change they may be told about. */
  busMoved: Set<string>;
  create: NewPlace[];
  /** People with any change. */
  moved: Set<string>;
  /** Bus seats that stay and get pinned. */
  pin: string[];
  /** Memberships to delete. */
  remove: string[];
}

export function emptyHandChanges(): HandChanges {
  return {
    busMoved: new Set(),
    create: [],
    moved: new Set(),
    pin: [],
    remove: [],
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
 * Puts one person in `groupId`, or in no group of this kind when null: one
 * group per kind per person. `places` are the person's places in groups of
 * this kind.
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
  if (groupId !== null && !keeper) {
    changes.create.push({ groupId, leg: null, participantId });
    changes.moved.add(participantId);
  }
}
