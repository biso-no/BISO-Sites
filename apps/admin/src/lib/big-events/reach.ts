/**
 * How a participant can be reached (spec D4 "Reach lists"): a push in the app,
 * the app without notifications, or email only (not connected to an account).
 */
export const REACH_PILES = ["push", "app_no_push", "email"] as const;
export type ReachPile = (typeof REACH_PILES)[number];

export function reachPile(
  participant: { user_id: string | null },
  push: Set<string>
): ReachPile {
  if (participant.user_id === null) {
    return "email";
  }
  return push.has(participant.user_id) ? "push" : "app_no_push";
}
