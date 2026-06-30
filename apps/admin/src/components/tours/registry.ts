import type { TourDefinition } from "@repo/tours/types";
import { buildRecruitmentHrTour } from "./recruitment-hr";

export interface TourTrigger {
  /** Matches the current pathname to decide whether to auto-offer a tour. */
  match: (pathname: string) => boolean;
  /**
   * Optional team gate (e.g. `sg-app-dept-hr`). Left unset for the recruitment
   * pilot: the route is already role-gated server-side, so route presence is a
   * sufficient signal. Kept here so other tours can target a narrower audience.
   */
  requiredTeamId?: string;
  tourId: string;
}

export interface RecruitmentTourContext {
  vacancyId: string | null;
}

/** Routes that auto-offer a tour. Pilot: the recruitment front door. */
export const TOUR_TRIGGERS: TourTrigger[] = [
  { tourId: "recruitment-hr", match: (pathname) => pathname === "/jobs" },
];

/**
 * Builds the registry of recruitment tours, baking runtime context (the sample
 * vacancy id) into multi-page step routes.
 */
export function buildRecruitmentRegistry(
  context: RecruitmentTourContext
): Record<string, TourDefinition> {
  const tour = buildRecruitmentHrTour(context);
  return { [tour.id]: tour };
}
