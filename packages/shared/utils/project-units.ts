/**
 * The link between BISO's flagship projects and the units that run them.
 *
 * A project such as Fadderullan is not one organisation: each campus has its
 * own unit of that name, with its own board, page and events. The public
 * `/projects/<slug>` route is a hub assembled from those units, and the
 * projects menu lists the units for the visitor's campus. Both sides read
 * this map, so a new flagship is wired up in exactly one place.
 *
 * Keys are the `/projects/<slug>` routes (and the `projectDetail` message
 * keys); values are the `departments.slug` the sync assigns from the unit's
 * name. The match is exact so "karrieredagene-marketing" never stands in for
 * Karrieredagene itself.
 *
 * A hub page only renders when the project has `projectDetail` copy or a
 * `large_event` row. Bergensbaneløpet has neither yet: its key is here so
 * the unit counts as a project in the menu, which links straight to the
 * unit's own page.
 */

import type { UnitCategory } from "./unit-categories";

export const PROJECT_UNIT_SLUGS = {
  bergensbanelopet: "bergensbanelopet",
  fadderullan: "fadderullan",
  karrieredagene: "karrieredagene",
  "winter-games": "wintergames",
} as const;

export type ProjectSlug = keyof typeof PROJECT_UNIT_SLUGS;

const UNIT_SLUG_TO_PROJECT: ReadonlyMap<string, ProjectSlug> = new Map(
  (Object.entries(PROJECT_UNIT_SLUGS) as [ProjectSlug, string][]).map(
    ([project, unitSlug]) => [unitSlug, project]
  )
);

/** The hub a unit belongs to, or null when it runs no flagship project. */
export function projectSlugForUnit(
  unitSlug: string | null | undefined
): ProjectSlug | null {
  if (!unitSlug) {
    return null;
  }
  return UNIT_SLUG_TO_PROJECT.get(unitSlug) ?? null;
}

export function isProjectSlug(value: string): value is ProjectSlug {
  return Object.hasOwn(PROJECT_UNIT_SLUGS, value);
}

const PROJECT_PAGE_PREFIX = "projects/";
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Where a project's editor page is stored: `projects/<project>`. Reserved like
 * `units/` — the public catch-all never serves it; `/projects/<slug>` does.
 */
export function projectPageSlug(project: ProjectSlug): string {
  return `${PROJECT_PAGE_PREFIX}${project}`;
}

/**
 * Whether a slug is anywhere under the reserved `projects/` prefix, known
 * project or not. Shaped like `isUnitPageSlug` (trim, lowercase, prefix): the
 * whole namespace is the admin's, so a page saved at `projects/charity`
 * today cannot be served when `charity` becomes a project tomorrow.
 */
export function isProjectNamespaceSlug(
  slug: string | null | undefined
): boolean {
  if (typeof slug !== "string") {
    return false;
  }
  // Accents fold too: Appwrite's collation matches `projécts/x` to the
  // `projects/x` lookup.
  const folded = slug
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "");
  return folded.startsWith(PROJECT_PAGE_PREFIX);
}

/**
 * The projects that run in several campuses and so have a department-less
 * hub page. The other projects (Winter Games) are national only: their page
 * belongs to their national unit. The one source for both admin and web.
 */
export const HUB_PROJECTS: readonly { name: string; slug: ProjectSlug }[] = [
  { name: "Fadderullan", slug: "fadderullan" },
  { name: "Karrieredagene", slug: "karrieredagene" },
  { name: "Bergensbaneløpet", slug: "bergensbanelopet" },
];

export function isHubProject(project: ProjectSlug): boolean {
  return HUB_PROJECTS.some((entry) => entry.slug === project);
}

/**
 * Whether a stored page slug is exactly `projects/<known project>`.
 *
 * Trims and lowercases, like `isUnitPageSlug`: Appwrite matches slugs
 * case-insensitively and storage trims them, so `Projects/winter-games` and
 * ` projects/winter-games` are served at the reserved address and must be
 * treated as it.
 */
export function isProjectPageSlug(slug: string | null | undefined): boolean {
  if (typeof slug !== "string") {
    return false;
  }
  const normalized = slug.trim().toLowerCase();
  if (!normalized.startsWith(PROJECT_PAGE_PREFIX)) {
    return false;
  }
  return isProjectSlug(normalized.slice(PROJECT_PAGE_PREFIX.length));
}

/**
 * Whether a unit runs a project, by category or by name.
 *
 * `departments.type` is only filled in for some campuses (Oslo and Bergen
 * mark their project units; Trondheim and Stavanger leave the column empty),
 * so the slug map is consulted as well. A unit that a campus categorises as
 * a project but that has no hub — Charity, Rederiet — still counts.
 */
export function isProjectUnit(unit: {
  category: UnitCategory | null;
  slug: string | null;
}): boolean {
  return unit.category === "project" || projectSlugForUnit(unit.slug) !== null;
}

/** Display order of the campuses: the four cities, then National. */
const CAMPUS_ORDER: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
};

const UNKNOWN_CAMPUS_RANK = Number.MAX_SAFE_INTEGER;

/** A stable copy ordered by campus; a campus the map does not know goes last. */
export function sortByCampusOrder<T extends { campusId: string }>(
  units: readonly T[]
): T[] {
  const rank = (campusId: string): number =>
    CAMPUS_ORDER[campusId] ?? UNKNOWN_CAMPUS_RANK;
  return [...units].sort((a, b) => rank(a.campusId) - rank(b.campusId));
}
