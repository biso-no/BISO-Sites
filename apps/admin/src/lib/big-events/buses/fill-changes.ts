import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";
import type { AutoFillPlan } from "./plan-auto-fill";
import type { Leg } from "./seats";

/* What applying auto-fill plans writes, worked out on rows in memory. */

/** The rows an auto-fill reads and changes: every membership and every room. */
export interface FillState {
  members: BigEventGroupMemberRow[];
  rooms: BigEventGroupRow[];
}

/** A bus seat to create. */
export interface NewSeat {
  busId: string;
  leg: Leg;
  participantId: string;
}

/** The writes that turn one fill state into another. */
export interface FillChanges {
  /** Seats to create (never pinned). */
  create: NewSeat[];
  /** Memberships to delete. */
  remove: BigEventGroupMemberRow[];
  /** Rooms whose buses change. */
  rooms: {
    homeBusId: string | null;
    outBusId: string | null;
    roomId: string;
  }[];
}

/** Row ids of seats a plan adds; real row ids never contain a colon. */
const PLANNED = "planned:";

const seatKey = (participantId: string, leg: Leg) => `${participantId}|${leg}`;

function plannedSeat(
  bigEventId: string,
  seat: NewSeat
): BigEventGroupMemberRow {
  return {
    $createdAt: "",
    $databaseId: "",
    $id: `${PLANNED}${seat.participantId}:${seat.leg}`,
    $permissions: [],
    $sequence: "",
    $tableId: "",
    $updatedAt: "",
    assigned_at: null,
    big_event_id: bigEventId,
    group_id: seat.busId,
    leg: seat.leg,
    participant_id: seat.participantId,
    pinned: false,
  };
}

/** "person|leg|bus" for every seat. */
function seatKeys(members: BigEventGroupMemberRow[]): Set<string> {
  const keys = new Set<string>();
  for (const member of members) {
    if (member.leg !== null) {
      keys.add(
        `${seatKey(member.participant_id, member.leg)}|${member.group_id}`
      );
    }
  }
  return keys;
}

/** People and rooms a repack leaves without a seat: their seats went to others. */
function liftedOff(plan: AutoFillPlan): Set<string> {
  const ids = new Set<string>();
  for (const entry of plan.unplaced) {
    if (entry.reason === "split_room") {
      continue;
    }
    for (const id of entry.participantIds) {
      ids.add(id);
    }
    if (entry.roomId) {
      ids.add(entry.roomId);
    }
  }
  return ids;
}

/**
 * The state once `plan` is applied, following the rules on `AutoFillPlan`
 * (ruling R3): a move puts the person on its bus for the listed legs and
 * drops their other unpinned seats on those legs (a seat already on that bus
 * stays as it is); before publishing, people and rooms reported `no_seat` or
 * `too_big` lose their unpinned seats and room buses; room buses are set.
 * Nothing else changes.
 */
export function applyFillPlan(
  state: FillState,
  plan: AutoFillPlan,
  options: { bigEventId: string; onlyUnseated: boolean }
): FillState {
  const lifted = options.onlyUnseated ? new Set<string>() : liftedOff(plan);
  const target = new Map<string, string>();
  for (const move of plan.moves) {
    for (const leg of move.legs) {
      target.set(seatKey(move.participantId, leg), move.busId);
    }
  }
  const members = state.members.filter((member) => {
    if (member.leg === null || member.pinned === true) {
      return true;
    }
    if (lifted.has(member.participant_id)) {
      return false;
    }
    const busId = target.get(seatKey(member.participant_id, member.leg));
    return busId === undefined || busId === member.group_id;
  });
  const seated = seatKeys(members);
  for (const move of plan.moves) {
    for (const leg of move.legs) {
      const key = `${seatKey(move.participantId, leg)}|${move.busId}`;
      if (!seated.has(key)) {
        seated.add(key);
        members.push(
          plannedSeat(options.bigEventId, {
            busId: move.busId,
            leg,
            participantId: move.participantId,
          })
        );
      }
    }
  }
  const roomBus = new Map(plan.roomBuses.map((r) => [r.roomId, r.busId]));
  const rooms = state.rooms.map((room) => {
    const busId = roomBus.get(room.$id);
    if (busId !== undefined) {
      return { ...room, home_bus_id: busId, out_bus_id: busId };
    }
    return lifted.has(room.$id)
      ? { ...room, home_bus_id: null, out_bus_id: null }
      : room;
  });
  return { members, rooms };
}

/** The writes from `before` to `after` (an `applyFillPlan` result). */
export function fillChanges(before: FillState, after: FillState): FillChanges {
  const kept = new Set(after.members.map((member) => member.$id));
  const roomsBefore = new Map(before.rooms.map((room) => [room.$id, room]));
  return {
    create: after.members.flatMap((member) =>
      member.$id.startsWith(PLANNED) && member.leg !== null
        ? [
            {
              busId: member.group_id,
              leg: member.leg,
              participantId: member.participant_id,
            },
          ]
        : []
    ),
    remove: before.members.filter((member) => !kept.has(member.$id)),
    rooms: after.rooms.flatMap((room) => {
      const old = roomsBefore.get(room.$id);
      const changed =
        old?.out_bus_id !== room.out_bus_id ||
        old?.home_bus_id !== room.home_bus_id;
      return changed
        ? [
            {
              homeBusId: room.home_bus_id,
              outBusId: room.out_bus_id,
              roomId: room.$id,
            },
          ]
        : [];
    }),
  };
}
