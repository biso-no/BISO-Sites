/**
 * Pure push-notification copy helpers for the event studio editor.
 *
 * Kept out of `event-studio-editor.tsx` so it can be unit tested directly:
 * that file is a "use client" component whose import graph reaches a
 * `server-only`-guarded module (through the event server actions), which
 * throws the moment anything imports it outside of Next's client/server
 * boundary handling — including a plain test runner. This module has no such
 * dependencies.
 */

/**
 * What the push toggle promises.
 *
 * An unavailable count says so rather than guessing. The number this replaced
 * was a hardcoded literal, and a wrong count is worse than an absent one when
 * the whole point is telling an admin how many devices they are about to
 * reach. It is a count of push targets, not students — one student with a
 * phone and a tablet is two subscribers — and de-duplicating by user would
 * mean paginating every subscriber for an advisory figure on a page render,
 * so it is labelled for what it actually counts instead.
 */
export function describePushAudience(count: number | null): string {
  if (count === null) {
    return "Notify devices subscribed to events at this campus. Subscriber count unavailable. Sends once when published.";
  }
  if (count === 0) {
    return "No devices are subscribed to event notifications at this campus yet. Sends once when published.";
  }
  const devices = count === 1 ? "device" : "devices";
  return `Notify ${count.toLocaleString("en-GB")} ${devices} subscribed to events at this campus. Sends once when published.`;
}
