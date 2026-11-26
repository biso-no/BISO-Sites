import type { GroupLeg } from "@repo/shared/big-events/tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
} from "@repo/shared/big-events/types";

/** Row builders for the bus planner tests. Campus "1" unless given. */

const ROW_META = {
  $sequence: "1",
  $tableId: "t",
  $databaseId: "app",
  $createdAt: "2026-11-25T00:00:00.000Z",
  $updatedAt: "2026-11-25T00:00:00.000Z",
  $permissions: [] as string[],
};

function group(
  id: string,
  fields: Partial<BigEventGroupRow>
): BigEventGroupRow {
  return {
    ...ROW_META,
    $id: id,
    big_event_id: "ev",
    booking_participant_id: null,
    campus_id: "1",
    capacity: null,
    contact_name: null,
    contact_phone: null,
    contact_user_id: null,
    home_arrival_note: null,
    home_bus_id: null,
    home_departs_at: null,
    home_maps_url: null,
    home_meeting_point: null,
    home_reminder_sent_at: null,
    kind: "room",
    name: id,
    note: null,
    out_bus_id: null,
    out_departs_at: null,
    out_maps_url: null,
    out_meeting_point: null,
    out_reminder_sent_at: null,
    room_number: null,
    source_key: null,
    ...fields,
  };
}

export function bus(
  id: string,
  capacity: number | null,
  campusId = "1"
): BigEventGroupRow {
  return group(id, { campus_id: campusId, capacity, kind: "bus" });
}

export function room(
  id: string,
  capacity: number | null,
  fields: Partial<BigEventGroupRow> = {}
): BigEventGroupRow {
  return group(id, { capacity, kind: "room", ...fields });
}

export function inRoom(
  roomId: string,
  participantId: string
): BigEventGroupMemberRow {
  return {
    ...ROW_META,
    $id: `${roomId}-${participantId}`,
    assigned_at: null,
    big_event_id: "ev",
    group_id: roomId,
    leg: null,
    participant_id: participantId,
    pinned: null,
  };
}

export function onBus(
  busId: string,
  participantId: string,
  leg: GroupLeg,
  pinned = false
): BigEventGroupMemberRow {
  return {
    ...inRoom(busId, participantId),
    $id: `${busId}-${participantId}-${leg}`,
    leg,
    pinned,
  };
}

export function bothWays(
  busId: string,
  participantId: string,
  pinned = false
): BigEventGroupMemberRow[] {
  return [
    onBus(busId, participantId, "out", pinned),
    onBus(busId, participantId, "home", pinned),
  ];
}

export function person(
  id: string,
  campusId: string | null = "1"
): { $id: string; campus_id: string | null } {
  return { $id: id, campus_id: campusId };
}

/** `count` people on one campus: p01, p02, … */
export function people(
  count: number,
  campusId = "1"
): { $id: string; campus_id: string | null }[] {
  return Array.from({ length: count }, (_, index) =>
    person(`p${String(index + 1).padStart(2, "0")}`, campusId)
  );
}
