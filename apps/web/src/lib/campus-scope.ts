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

/**
 * Resolve the `?campus=` search parameter to a campus id.
 *
 * Campus is an id internally (`"1"`–`"5"`), but an id in a URL is unreadable
 * and unguessable, so the parameter accepts the same slugs the unit routes
 * already use: `?campus=oslo`. Raw ids are still accepted because `/jobs` has
 * supported `?campus=1` for some time and those links may exist.
 *
 * The four outcomes are distinct on purpose. "Absent" must fall through to the
 * cookie, while "all" must override it — collapsing them would make it
 * impossible to link the unfiltered view from a machine that has a campus
 * cookie set. And an unrecognised value is an error, not a silent "show
 * everything": `/events?campus=osloo` should 404 rather than quietly return
 * national content that the URL does not describe.
 */
export type CampusParam =
  | { kind: "absent" }
  | { kind: "all" }
  | { kind: "campus"; id: string }
  | { kind: "invalid" };

/** Slug → id, mirroring `CAMPUS_SEGMENTS` in `@repo/shared/utils/unit-urls`. */
const SLUG_TO_ID: Record<string, string> = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
  national: "5",
};

const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_ID).map(([slug, id]) => [id, slug])
);

export function campusSlugToId(slug: string): string | null {
  return SLUG_TO_ID[slug.toLowerCase()] ?? null;
}

export function campusIdToSlug(id: string | null | undefined): string | null {
  return id ? (ID_TO_SLUG[id] ?? null) : null;
}

/** Every campus slug, in display order. */
export const CAMPUS_SLUGS = Object.keys(SLUG_TO_ID);

export function parseCampusParam(
  raw: string | string[] | undefined
): CampusParam {
  if (raw === undefined) {
    return { kind: "absent" };
  }
  // A repeated parameter is a malformed URL, not a multi-campus filter.
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") {
    return { kind: "absent" };
  }
  if (value === "all") {
    return { kind: "all" };
  }
  const bySlug = campusSlugToId(value);
  if (bySlug) {
    return { kind: "campus", id: bySlug };
  }
  if (ID_TO_SLUG[value]) {
    return { kind: "campus", id: value };
  }
  return { kind: "invalid" };
}

/**
 * The campus a request should be scoped to: **URL > cookie > all**.
 *
 * Returns `undefined` for an unrecognised parameter so the caller can `404`.
 * Everything else returns a campus id, or `null` meaning no filter.
 */
export function resolveRequestCampus(
  raw: string | string[] | undefined,
  cookieCampusId: string | null | undefined
): string | null | undefined {
  const parsed = parseCampusParam(raw);
  switch (parsed.kind) {
    case "invalid":
      return;
    case "all":
      return null;
    case "campus":
      return parsed.id;
    default:
      return cookieCampusId && cookieCampusId !== "all" ? cookieCampusId : null;
  }
}
