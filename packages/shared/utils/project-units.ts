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
