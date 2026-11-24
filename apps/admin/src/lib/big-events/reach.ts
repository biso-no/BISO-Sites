/**
 * How a participant is reached (spec D4 "Reach lists", ruling R20): a push
 * (connected account with a push target), email to the connected account, or
 * email to the ticket address (not connected yet). Whether a connected person
 * has the app can't be known, so the piles never claim it.
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
