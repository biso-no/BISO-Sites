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

/**
 * Pathnames whose **content** responds to `?campus=`.
 *
 * The switcher rewrites the URL of the page you are on rather than sending you
 * somewhere else, so it has to know which routes will act on the parameter.
 * Anywhere else the choice is written to the cookie only and takes effect on
 * the next campus-scoped page the visitor opens.
 *
 * Exact matches, not prefixes: `/shop` scopes, `/shop/cart` does not, and
 * `/units/oslo/<slug>` is one unit rather than a filtered list.
 *
 * `campus-routing.test.ts` asserts this list against the routes that actually
 * call `resolveRequestCampus`, so a new scoped feed cannot silently drop out of
 * the switcher — or be advertised by it before the page reads the parameter.
 */
export const CAMPUS_SCOPED_PATHS = [
  "/",
  "/documents",
  "/events",
  "/jobs",
  "/news",
  "/shop",
  "/students",
  "/units",
] as const;

export function isCampusScopedPath(pathname: string): boolean {
  return (CAMPUS_SCOPED_PATHS as readonly string[]).includes(pathname);
}

/** `/campus` and `/campus/<slug>` — the campus is the route, not a filter. */
const CAMPUS_LANDING_PATH = /^\/campus(?:\/[^/]+)?\/?$/;

/**
 * Where picking a campus in the switcher should take you.
 *
 * Three cases, and the third is the point of the function:
 *
 * 1. **On a campus landing page** the campus *is* the route, so switching
 *    navigates between landings — `/campus/oslo` → `/campus/bergen`.
 * 2. **On a campus-scoped feed** the switcher is a filter: it stays on the page
 *    and rewrites `?campus=`, preserving every other parameter so switching
 *    campus out of a filtered, searched view does not throw the rest away.
 * 3. **Anywhere else** it returns `null`. There is nothing on the page to
 *    re-scope, so the caller persists the cookie and leaves the URL alone
 *    rather than hanging a parameter on a page that ignores it.
 *
 * "All campuses" is written as an explicit `?campus=all` rather than by
 * dropping the parameter. The URL is then authoritative on its own: it does not
 * depend on the cookie write that accompanies the click having landed first,
 * and it survives being sent to someone whose own cookie holds a campus.
 */
export function campusSwitchHref(
  pathname: string,
  search: string,
  campusId: string | null
): string | null {
  if (CAMPUS_LANDING_PATH.test(pathname)) {
    const slug = campusIdToSlug(campusId);
    return slug ? `/campus/${slug}` : "/campus";
  }
  if (!isCampusScopedPath(pathname)) {
    return null;
  }
  const next = new URLSearchParams(search);
  next.set("campus", campusIdToSlug(campusId) ?? "all");
  return `${pathname}?${next.toString()}`;
}

/** The campus landing page for the active campus, or the index for "all". */
export function campusLandingHref(campusId: string | null): string {
  const slug = campusIdToSlug(campusId);
  return slug ? `/campus/${slug}` : "/campus";
}
