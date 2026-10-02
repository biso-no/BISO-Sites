/**
 * Links from project surfaces to the unit that runs the project.
 *
 * A project such as Karrieredagene is organised per campus by a unit of the
 * same name. Those units own their public pages, so project buttons resolve
 * to them by name at render time instead of hard-coding slugs that the
 * department sync is free to change.
 */

import type { PublicUnit } from "@/lib/data/units";
import type { NavProjectLink } from "@/lib/types/nav";

type LinkableUnit = Pick<PublicUnit, "campusId" | "href" | "name">;

const CAREER_DAYS_UNIT_NAME = "Karrieredagene";
const CAREER_DAYS_PROJECT_PATH = "/projects/karrieredagene";

const CAREER_DAYS_CAMPUS_IDS = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
} as const;

export type CareerDaysCampus = keyof typeof CAREER_DAYS_CAMPUS_IDS;

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
 * Projects whose public page is their unit's page rather than a
 * `/projects/<slug>` route. The label is the unit's display name.
 */
const UNIT_RUN_PROJECTS = [
  { id: "bergensbanelopet", label: "Bergensbaneløpet" },
] as const;

/** Projects menu entries for unit-run projects that have a public page. */
export function unitProjectNavLinks(units: LinkableUnit[]): NavProjectLink[] {
  const links: NavProjectLink[] = [];
  for (const project of UNIT_RUN_PROJECTS) {
    const href = findUnitHref(units, project.label);
    if (href) {
      links.push({ href, id: project.id, label: project.label });
    }
  }
  return links;
}

/** Where each campus's career days card leads; never a dead end. */
export function careerDaysHrefs(
  units: LinkableUnit[]
): Record<CareerDaysCampus, string> {
  const href = (campus: CareerDaysCampus): string =>
    findUnitHref(units, CAREER_DAYS_UNIT_NAME, CAREER_DAYS_CAMPUS_IDS[campus]) ??
    CAREER_DAYS_PROJECT_PATH;

  return {
    oslo: href("oslo"),
    bergen: href("bergen"),
    trondheim: href("trondheim"),
    stavanger: href("stavanger"),
  };
}
