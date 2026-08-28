/**
 * Campus scoping for public content feeds.
 *
 * The campus switcher in the top navigation is a site-wide filter: picking
 * Bergen means Oslo's events, news and vacancies are not that visitor's
 * business. The one exception is the National campus — content published
 * there concerns every campus, so it rides along with whichever campus is
 * selected rather than disappearing behind the filter.
 *
 * Pure module (no directives, no I/O) so client components can import the
 * constant and the server data layer can import the query helper.
 */

/**
 * Row `$id` of the National campus. National is not a study campus; it is the
 * organisation-wide bucket, which is why several call sites exclude it from
 * campus pickers while content feeds deliberately include it.
 */
export const NATIONAL_CAMPUS_ID = "5";

/**
 * The `campus_id` values a feed should return for the selected campus.
 *
 * - `null` / `"all"` → `null`, meaning "do not filter at all".
 * - National selected → National only; it is already the widest bucket.
 * - Any study campus → that campus plus National.
 *
 * `campus_id` is a required string column on `events`, `news` and `jobs`, so
 * there is no unassigned-content case to account for.
 */
export function campusScopeIds(
  campusId: string | null | undefined
): string[] | null {
  if (!campusId || campusId === "all") {
    return null;
  }
  if (campusId === NATIONAL_CAMPUS_ID) {
    return [NATIONAL_CAMPUS_ID];
  }
  return [campusId, NATIONAL_CAMPUS_ID];
}
