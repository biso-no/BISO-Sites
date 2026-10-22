import { NATIONAL_CAMPUS_ID } from "./benefit-catalog";

export function resolveBenefitCampusIds(campusId?: string | null): string[] {
  if (!campusId || campusId === NATIONAL_CAMPUS_ID) {
    return [NATIONAL_CAMPUS_ID];
  }

  return [campusId, NATIONAL_CAMPUS_ID];
}
