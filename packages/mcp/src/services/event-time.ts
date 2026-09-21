/**
 * How this server reads and reports BISO times.
 *
 * `@repo/shared/utils/oslo-time` is the repo's single statement of the rule:
 * BISO's events are entered and shown as Europe/Oslo wall-clock time whatever
 * zone the process runs in, and stored as UTC ISO instants. Both apps render
 * every event date through it.
 *
 * This server renders nothing — it returns the stored instant unchanged, which
 * is exact and self-describing. Two places the rule still reaches it:
 *
 * - **Date filters.** Someone asking for "events from 22 September" means the
 *   Oslo day. Compared as written, a bare `2026-09-22` is UTC midnight, which
 *   is 02:00 in Oslo, so an event starting earlier that Oslo morning drops out
 *   of its own day. {@link resolveDateFilter} resolves a bare date against
 *   Oslo; a full timestamp already names an instant and is left alone.
 * - **Descriptions.** An instant rendered without its zone reads as an event
 *   one or two hours before the one BISO scheduled, so the tools whose answer
 *   is a time say which zone to render it in.
 */

import {
  OSLO_TIME_ZONE,
  osloWallClockToIso,
} from "@repo/shared/utils/oslo-time";

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Rendering instruction for the tools whose answer is an event time. */
export const OSLO_TIME_NOTE = `Times come back as stored UTC instants; BISO schedules in ${OSLO_TIME_ZONE} wall-clock time, so render them in that zone.`;

/** Argument-level statement of how a bare date is resolved. */
export const DATE_FILTER_NOTE = `A bare \`YYYY-MM-DD\` is read as the start of that day in ${OSLO_TIME_ZONE}; pass a full ISO timestamp to name an exact instant.`;

/**
 * A bare `YYYY-MM-DD` becomes the instant that day starts in Oslo. Anything
 * else — a full timestamp, an empty or malformed value — is returned as given:
 * only the bare date is ambiguous, and rewriting the rest would be guessing at
 * what the caller meant.
 */
export function resolveDateFilter(value: string): string {
  if (!DATE_ONLY_REGEX.test(value)) {
    return value;
  }
  return osloWallClockToIso(`${value}T00:00`) ?? value;
}
