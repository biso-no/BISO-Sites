import { rolesFromTeams, type TeamRef } from "@repo/shared/utils/team-roles";
import { ROLES } from "./roles";

export interface TeamParseResult {
  campusNames: string[];
  campusTeamIds: string[];
  departmentNames: string[];
  departmentTeamIds: string[];
  managedCampuses: string[];
  roles: string[];
}

/**
 * Parse team memberships into categorized arrays and derived roles. Everything
 * comes from exact synced team ids (see `rolesFromTeams`); team names are only
 * kept for display and scoping when bound to their id. Teams outside the
 * SG-App id space, such as `biso-members`, are ignored.
 */
export function parseTeamMemberships(
  teams: readonly TeamRef[]
): TeamParseResult {
  const derived = rolesFromTeams(teams);
  const roles: string[] = [];

  if (derived.isHr) {
    roles.push(ROLES.HR);
  }
  if (derived.isGlobalAdmin) {
    roles.push(ROLES.GLOBAL_ADMIN);
  }
  if (derived.isNationalHr) {
    roles.push(ROLES.HR_ADMIN);
  }
  if (derived.managedCampuses.length > 0) {
    roles.push(ROLES.CAMPUS_ADMIN);
  }

  return {
    campusNames: [...derived.campusNames],
    campusTeamIds: derived.campusTeamIds,
    departmentNames: derived.departmentNames,
    departmentTeamIds: derived.departmentTeamIds,
    managedCampuses: [...derived.managedCampuses],
    roles,
  };
}
