import type { MemberPassResponse } from "@repo/shared/member-pass/types";
import {
  codesRemaining,
  MEMBER_PASS_REFETCH_BELOW,
  type MemberPassCode,
} from "@repo/shared/utils/member-pass-slots";

/** How a `GET /api/member-pass` attempt ended. */
export type PassFetchOutcome =
  | { body: MemberPassResponse; kind: "body" }
  | { kind: "unauthenticated" }
  | { kind: "server_error" }
  | { kind: "network_error" };

export interface PassRefreshState {
  data: MemberPassResponse | null;
  offline: boolean;
}

/** How often a pass that needs fresh codes, or is offline, tries again. */
export const PASS_RETRY_MS = 15_000;

const UNAVAILABLE: MemberPassResponse = { state: "unavailable" };

function hasUsableCode(
  data: MemberPassResponse | null,
  slot: number
): data is MemberPassResponse & { codes: MemberPassCode[] } {
  return data?.state === "active" && codesRemaining(data.codes, slot) > 0;
}

/**
 * The pass state after a refetch. A definitive answer (a 200 body or a 401)
 * always replaces what is shown; a transient failure keeps an active pass
 * that still has codes to show, and only then falls back to "offline" or
 * "unavailable".
 */
export function nextPassState(
  previous: MemberPassResponse | null,
  outcome: PassFetchOutcome,
  slot: number
): PassRefreshState {
  switch (outcome.kind) {
    case "body":
      return { data: outcome.body, offline: false };
    case "unauthenticated":
      return { data: UNAVAILABLE, offline: false };
    case "network_error":
      return { data: previous, offline: true };
    default:
      return hasUsableCode(previous, slot)
        ? { data: previous, offline: true }
        : { data: UNAVAILABLE, offline: false };
  }
}

/**
 * Whether the pass should keep polling on its own. Covers the case where the
 * last refetches failed and the browser never reports going offline or online
 * (patchy venue Wi-Fi), which would otherwise leave the pass stuck.
 */
export function needsRetry(
  data: MemberPassResponse | null,
  offline: boolean,
  slot: number
): boolean {
  if (offline) {
    return true;
  }
  return (
    data?.state === "active" &&
    codesRemaining(data.codes, slot) < MEMBER_PASS_REFETCH_BELOW
  );
}
