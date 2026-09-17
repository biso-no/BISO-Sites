import {
  codesRemaining,
  type MemberPassCode,
} from "@repo/shared/utils/member-pass-slots";
import type { MemberPassResponse } from "@/lib/member-pass/types";

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
