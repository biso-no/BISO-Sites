/**
 * Slot arithmetic for member pass codes. Deliberately free of Node imports:
 * the browser pass component uses it to pick the code to show.
 */

export const MEMBER_PASS_SLOT_SECONDS = 30;
/** Slots either side of "now" a scanner still accepts (clock drift). */
export const MEMBER_PASS_SLOT_TOLERANCE = 1;
/** Codes issued per fetch: ten minutes. */
export const MEMBER_PASS_BATCH_SIZE = 20;
/** The client refetches once fewer codes than this remain. */
export const MEMBER_PASS_REFETCH_BELOW = 4;

const SLOT_MS = MEMBER_PASS_SLOT_SECONDS * 1000;

export interface MemberPassCode {
  code: string;
  slot: number;
}

export function passSlot(nowMs: number): number {
  return Math.floor(nowMs / SLOT_MS);
}

export function slotSecondsLeft(nowMs: number): number {
  const elapsed = nowMs - passSlot(nowMs) * SLOT_MS;
  return Math.ceil((SLOT_MS - elapsed) / 1000);
}

export function selectCurrentCode(
  codes: MemberPassCode[],
  slot: number
): MemberPassCode | null {
  return codes.find((code) => code.slot === slot) ?? null;
}

export function codesRemaining(codes: MemberPassCode[], slot: number): number {
  return codes.filter((code) => code.slot >= slot).length;
}
