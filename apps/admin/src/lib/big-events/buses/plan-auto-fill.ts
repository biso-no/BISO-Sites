import type { BigEventGroupRow } from "@repo/shared/big-events/types";
import {
  type AutoFillInput,
  buildUnits,
  createFill,
  type Fill,
  fixedBus,
  isFixed,
  keepsOwnBus,
  legsToSet,
  seatsNeeded,
  type Unit,
  type Units,
} from "./auto-fill-units";
import { busSeatUse, type Leg, type SeatMember, type SeatUse } from "./seats";

export type { AutoFillInput } from "./auto-fill-units";

export type UnplacedReason = "no_seat" | "too_big" | "split_room";

export interface AutoFillMove {
  busId: string;
  /** Never a pinned leg, nor (after publishing) a leg that has a bus. */
  legs: Leg[];
  participantId: string;
}

export interface AutoFillUnplaced {
  /** The people left where they were (split room) or without a seat. */
  participantIds: string[];
  reason: UnplacedReason;
  /** The room, or null for people not in a room (one entry per reason). */
  roomId: string | null;
}

/**
 * What one auto-fill changes. Applying it:
 * 1. each move puts the person on `busId` for the listed legs; their other
 *    unpinned memberships on those legs (any bus) are removed;
 * 2. each room bus sets the room's `out_bus_id` and `home_bus_id` (after
 *    publishing, a room already tied to a bus is never listed);
 * 3. before publishing (`onlyUnseated` false, a repack), the people and rooms
 *    of `no_seat` / `too_big` entries come off the buses: their unpinned bus
 *    memberships are removed and the room's bus ids cleared, since the
 *    repack gave their seats to others.
 * Everything else stays as it is. `seatsAfter` is the seat use once applied.
 */
export interface AutoFillPlan {
  moves: AutoFillMove[];
  roomBuses: { roomId: string; busId: string }[];
  seatsAfter: Map<string, SeatUse>;
  unplaced: AutoFillUnplaced[];
}

/** Out seats taken before placing: the people and rooms being placed are lifted off first. */
function outSeatsBefore(fill: Fill, units: Units): Map<string, number> {
  const placing = [...units.anchored.map(({ unit }) => unit), ...units.free];
  const lifted = new Set(placing.flatMap((unit) => unit.people));
  const liftedRooms = new Set(placing.map((unit) => unit.id));
  const members = fill.input.members.filter(
    (member) =>
      member.leg === null ||
      !lifted.has(member.participant_id) ||
      isFixed(fill, member.participant_id, member.leg)
  );
  const rooms = fill.allRooms.map((room) =>
    fill.input.onlyUnseated || !liftedRooms.has(room.$id)
      ? room
      : { ...room, out_bus_id: null, home_bus_id: null }
  );
  const use = busSeatUse({ buses: fill.buses, rooms, members });
  return new Map([...use].map(([busId, seats]) => [busId, seats.out]));
}

/** The bus with the most free out seats that still fits `seats`. */
function pickBus(
  buses: BigEventGroupRow[],
  outUse: Map<string, number>,
  seats: number
): string | null {
  let best: string | null = null;
  let bestFree = Number.NEGATIVE_INFINITY;
  for (const bus of buses) {
    const free = (bus.capacity ?? 0) - (outUse.get(bus.$id) ?? 0);
    if (free >= seats && free > bestFree) {
      best = bus.$id;
      bestFree = free;
    }
  }
  return best;
}

function whyUnplaced(buses: BigEventGroupRow[], seats: number): UnplacedReason {
  const largest = Math.max(0, ...buses.map((bus) => bus.capacity ?? 0));
  return buses.length > 0 && seats > largest ? "too_big" : "no_seat";
}

function place(
  fill: Fill,
  plan: AutoFillPlan,
  outUse: Map<string, number>,
  { busId, unit }: { busId: string; unit: Unit }
): void {
  for (const id of unit.people) {
    plan.moves.push({ participantId: id, busId, legs: legsToSet(fill, id) });
  }
  if (unit.room && !keepsOwnBus(fill, unit.room)) {
    plan.roomBuses.push({ roomId: unit.id, busId });
  }
  outUse.set(busId, (outUse.get(busId) ?? 0) + seatsNeeded(unit));
}

/**
 * Home defaults to out (D5): someone whose out seat stays on one of this
 * campus's buses and who has no home seat at all gets one on the same bus.
 * People the plan moves already got their home leg with the move.
 */
function homeFollowsKeptOut(fill: Fill, plan: AutoFillPlan): void {
  for (const id of fill.campusPeople) {
    const hasHome = (fill.seatRows.get(id) ?? []).some(
      (row) => row.leg === "home"
    );
    const busId = hasHome ? null : fixedBus(fill, id, "out");
    if (busId) {
      plan.moves.push({ participantId: id, busId, legs: ["home"] });
    }
  }
}

/** Seat use once the plan is applied (see `AutoFillPlan`). */
function seatsAfter(fill: Fill, plan: AutoFillPlan): Map<string, SeatUse> {
  const movedLegs = new Map(
    plan.moves.map((move) => [move.participantId, new Set(move.legs)])
  );
  const cleared = new Set<string>();
  if (!fill.input.onlyUnseated) {
    for (const entry of plan.unplaced) {
      if (entry.reason === "split_room") {
        continue;
      }
      for (const id of entry.participantIds) {
        cleared.add(id);
      }
      if (entry.roomId) {
        cleared.add(entry.roomId);
      }
    }
  }
  const members: SeatMember[] = fill.input.members.filter(
    (member) =>
      member.leg === null ||
      member.pinned === true ||
      !(
        cleared.has(member.participant_id) ||
        movedLegs.get(member.participant_id)?.has(member.leg)
      )
  );
  for (const { busId, legs, participantId } of plan.moves) {
    for (const leg of legs) {
      members.push({ group_id: busId, leg, participant_id: participantId });
    }
  }
  const roomBus = new Map(plan.roomBuses.map((r) => [r.roomId, r.busId]));
  const rooms = fill.allRooms.map((room) => {
    const busId = roomBus.get(room.$id);
    if (busId !== undefined) {
      return { ...room, out_bus_id: busId, home_bus_id: busId };
    }
    return cleared.has(room.$id)
      ? { ...room, out_bus_id: null, home_bus_id: null }
      : room;
  });
  return busSeatUse({ buses: fill.buses, rooms, members });
}

/**
 * Plans filling one campus's buses (spec D5): the campus's people spread
 * evenly, everyone in a room of this campus on the room's bus (its open
 * places count as seats), pinned legs never touched and their seats counted
 * first. A room held to one bus by a pinned member goes there even when it
 * overfills; a room held to two is reported as split. The rest go largest
 * first to the bus with the most free out seats that fits them. The home leg
 * follows the out leg unless it's pinned, and anyone keeping an out seat
 * without a home seat gets one on the same bus. With `onlyUnseated` (after
 * publishing, N4) anyone with a bus keeps it, a room keeps both its buses, and
 * only people without a bus are seated. Ties break on ids, so the same rows
 * give the same plan.
 */
export function planAutoFill(input: AutoFillInput): AutoFillPlan {
  const fill = createFill(input);
  const { buses } = fill;
  const units = buildUnits(fill);
  const plan: AutoFillPlan = {
    moves: [],
    roomBuses: [],
    seatsAfter: new Map(),
    unplaced: units.split.map((unit) => ({
      participantIds: unit.people,
      reason: "split_room",
      roomId: unit.id,
    })),
  };
  const outUse = outSeatsBefore(fill, units);
  for (const anchored of units.anchored) {
    place(fill, plan, outUse, anchored);
  }
  const roomless = new Map<UnplacedReason, string[]>();
  for (const unit of units.free) {
    const busId = pickBus(buses, outUse, seatsNeeded(unit));
    if (busId) {
      place(fill, plan, outUse, { busId, unit });
      continue;
    }
    const reason = whyUnplaced(buses, seatsNeeded(unit));
    if (unit.room) {
      plan.unplaced.push({
        participantIds: unit.people,
        reason,
        roomId: unit.id,
      });
    } else {
      const ids = roomless.get(reason) ?? [];
      ids.push(unit.id);
      roomless.set(reason, ids);
    }
  }
  for (const [reason, participantIds] of roomless) {
    plan.unplaced.push({ participantIds, reason, roomId: null });
  }
  homeFollowsKeptOut(fill, plan);
  plan.seatsAfter = seatsAfter(fill, plan);
  return plan;
}
