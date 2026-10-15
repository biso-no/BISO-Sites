/**
 * Links from project surfaces to the units that run the projects.
 *
 * A project such as Karrieredagene is organised per campus by a unit of the
 * same name. Those units own their public pages, so project buttons resolve
 * to them at render time instead of hard-coding paths that the department
 * sync is free to change. Which unit runs which project is the shared map in
 * `@repo/shared/utils/project-units`.
 */

import {
  isProjectUnit,
  PROJECT_UNIT_SLUGS,
  type ProjectSlug,
  projectSlugForUnit,
  sortByCampusOrder,
} from "@repo/shared/utils/project-units";
import type { PublicUnit } from "@/lib/data/units";
import type { NavProjectLink } from "@/lib/types/nav";

type LinkableUnit = Pick<PublicUnit, "campusId" | "href" | "name">;

type MenuUnit = Pick<
  PublicUnit,
  "campusId" | "campusLabel" | "category" | "href" | "id" | "name" | "slug"
>;

const CAREER_DAYS_UNIT_NAME = "Karrieredagene";
const CAREER_DAYS_PROJECT_PATH = "/projects/karrieredagene";

const CAREER_DAYS_CAMPUS_IDS = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
} as const;

export type CareerDaysCampus = keyof typeof CAREER_DAYS_CAMPUS_IDS;

/** `departments.campus_id` of the national units. */
export const NATIONAL_CAMPUS_ID = "5";

/**
 * Path of the unit with exactly this display name, optionally on one campus.
 *
 * Exact on purpose: a prefix match would hand "Karrieredagene Marketing" the
 * traffic meant for Karrieredagene itself.
 */
export function findUnitHref(
  units: LinkableUnit[],
  name: string,
  campusId?: string
): string | null {
  const wanted = name.trim().toLowerCase();
  const match = units.find(
    (unit) =>
      unit.name.trim().toLowerCase() === wanted &&
      (campusId === undefined || unit.campusId === campusId)
  );
  return match?.href ?? null;
}

/**
 * The units that run one project, one per campus, in campus order.
 *
 * Matched on the unit's slug so a sub-unit ("karrieredagene-marketing") and
 * a namesake on another campus are never confused with the unit itself.
 */
export function projectHubUnits<
  T extends Pick<PublicUnit, "campusId" | "slug">,
>(units: readonly T[], project: ProjectSlug): T[] {
  const wanted = PROJECT_UNIT_SLUGS[project];
  return sortByCampusOrder(units.filter((unit) => unit.slug === wanted));
}

/**
 * Every project unit with a public page, as a projects-menu entry.
 *
 * The full list crosses to the client once; `visibleProjectLinks` then picks
 * the entries for the campus the visitor has selected, so switching campus
 * never needs a round trip.
 */
export function campusProjectNavLinks(units: MenuUnit[]): NavProjectLink[] {
  const projectUnits = units.filter((unit) => isProjectUnit(unit));
  const byName = [...projectUnits].sort((a, b) =>
    a.name.localeCompare(b.name, "nb")
  );
  return sortByCampusOrder(byName).map((unit) => ({
    campusId: unit.campusId,
    campusLabel: unit.campusLabel,
    hasHub: projectSlugForUnit(unit.slug) !== null,
    href: unit.href,
    id: unit.id,
    label: unit.name,
  }));
}

/**
 * The menu entries for the visitor's campus.
 *
 * With a campus selected: that campus's project units plus the national
 * ones. With none: everything except a hub project that runs on several
 * campuses — Fadderullan is reached through its hub in the flagship list, so
 * the menu never shows four entries named Fadderullan. A project without a
 * hub (Charity) is listed per campus, since the menu is its only entry.
 */
export function visibleProjectLinks(
  links: NavProjectLink[],
  activeCampusId: string | null
): NavProjectLink[] {
  if (activeCampusId) {
    return links.filter(
      (link) =>
        link.campusId === activeCampusId || link.campusId === NATIONAL_CAMPUS_ID
    );
  }

  const campusesByName = new Map<string, Set<string>>();
  for (const link of links) {
    const key = link.label.trim().toLowerCase();
    const campuses = campusesByName.get(key) ?? new Set<string>();
    campuses.add(link.campusId);
    campusesByName.set(key, campuses);
  }

  return links.filter(
    (link) =>
      link.campusId === NATIONAL_CAMPUS_ID ||
      !link.hasHub ||
      campusesByName.get(link.label.trim().toLowerCase())?.size === 1
  );
}

/**
 * The text for a menu entry. Only when no campus is selected does the entry
 * say which campus the unit belongs to; inside a campus that is implied.
 */
export function projectLinkLabel(
  link: NavProjectLink,
  activeCampusId: string | null
): string {
  const showCampus =
    !activeCampusId &&
    link.campusId !== NATIONAL_CAMPUS_ID &&
    Boolean(link.campusLabel);
  return showCampus ? `${link.label} · ${link.campusLabel}` : link.label;
}

/** Where each campus's career days card leads; never a dead end. */
export function careerDaysHrefs(
  units: LinkableUnit[]
): Record<CareerDaysCampus, string> {
  const href = (campus: CareerDaysCampus): string =>
    findUnitHref(
      units,
      CAREER_DAYS_UNIT_NAME,
      CAREER_DAYS_CAMPUS_IDS[campus]
    ) ?? CAREER_DAYS_PROJECT_PATH;

  return {
    oslo: href("oslo"),
    bergen: href("bergen"),
    trondheim: href("trondheim"),
    stavanger: href("stavanger"),
  };
}
