/**
 * The per-campus half of a `/projects/<slug>` page.
 *
 * `large_event` rows carry a project's own copy and programme; the campus
 * teams, their pages and their upcoming events come from the units that run
 * the project. This folds the two reads into the view model the page renders.
 */

import type { PageEventItem } from "@repo/shared/utils/page-feeds";
import type { ProjectSlug } from "@repo/shared/utils/project-units";
import type { PublicUnit } from "@/lib/data/units";
import { projectHubUnits } from "@/lib/project-unit-links";

/** Enough to show the next few dates without turning the card into a list. */
export const HUB_EVENT_LIMIT = 3;

export interface ProjectHubEventVM {
  date: string;
  title: string;
  where: string;
}

export interface ProjectHubCampusVM {
  /** Null for a campus the URL map does not know; the card then has no eyebrow. */
  campusLabel: string | null;
  events: ProjectHubEventVM[];
  unit: Pick<
    PublicUnit,
    "graphName" | "href" | "id" | "logoUrl" | "name" | "summary"
  >;
}

export type HubUnit = Pick<
  PublicUnit,
  | "campusId"
  | "campusLabel"
  | "graphName"
  | "href"
  | "id"
  | "logoUrl"
  | "name"
  | "slug"
  | "summary"
>;

/**
 * One card per campus team, in campus order, each with its next events.
 *
 * `loadEvents` is called once per unit; a rejection counts as "no events"
 * for that card only, so one campus's feed failing never blanks the page.
 */
export async function buildProjectHub(
  units: readonly HubUnit[],
  project: ProjectSlug,
  loadEvents: (unitId: string) => Promise<PageEventItem[]>
): Promise<ProjectHubCampusVM[]> {
  const teams = projectHubUnits(units, project);
  return await Promise.all(
    teams.map(async (unit) => {
      const events = await loadEvents(unit.id).catch(() => []);
      return {
        campusLabel: unit.campusLabel,
        events: events.slice(0, HUB_EVENT_LIMIT).map((event) => ({
          date: event.date,
          title: event.title,
          where: event.where,
        })),
        unit: {
          graphName: unit.graphName,
          href: unit.href,
          id: unit.id,
          logoUrl: unit.logoUrl,
          name: unit.name,
          summary: unit.summary,
        },
      };
    })
  );
}
