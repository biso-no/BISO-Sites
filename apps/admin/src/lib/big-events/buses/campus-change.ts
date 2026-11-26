import type { BigEventGroupMemberRow } from "@repo/shared/big-events/types";

/**
 * The bus seats a person can't keep on `campusId`: seats on buses of
 * another campus (Stage 2 ruling R19, plan M12). Places in rooms and other
 * groups, and seats on buses that no longer exist, are left alone.
 */
export function seatsOffCampus(
  seats: Pick<BigEventGroupMemberRow, "$id" | "group_id" | "leg">[],
  busCampus: ReadonlyMap<string, string | null>,
  campusId: string | null
): string[] {
  return seats
    .filter(
      (seat) =>
        seat.leg !== null &&
        busCampus.has(seat.group_id) &&
        busCampus.get(seat.group_id) !== campusId
    )
    .map((seat) => seat.$id);
}
