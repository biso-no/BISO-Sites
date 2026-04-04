const NATIONAL_CAMPUS_ID = "5";

export function resolveBenefitCampusIds(campusId?: string | null): string[] {
  if (!campusId || campusId === NATIONAL_CAMPUS_ID) {
    return [NATIONAL_CAMPUS_ID];
  }

  return [campusId, NATIONAL_CAMPUS_ID];
}
