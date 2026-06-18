import { expandDepartmentName } from "@repo/shared/utils/team-roles";
import { CAMPUS_NAME_TO_ID } from "./campus-constants";

export interface TeamParseResult {
  campusNames: string[];
  campusTeamIds: string[];
  departmentNames: string[];
  departmentTeamIds: string[];
  roles: string[];
}

/**
 * Parse team memberships into categorized arrays. Non-SG-App teams such as
 * `biso-members` are ignored for admin role derivation; they must not become
 * the broad `department` pseudo-role.
 */
export function parseTeamMemberships(
  teams: Array<{ $id: string; name: string }>
): TeamParseResult {
  const result: TeamParseResult = {
    campusTeamIds: [],
    campusNames: [],
    departmentTeamIds: [],
    departmentNames: [],
    roles: [],
  };

  for (const team of teams) {
    if (CAMPUS_NAME_TO_ID[team.name] !== undefined) {
      result.campusTeamIds.push(team.$id);
      result.campusNames.push(team.name);
    } else if (team.name.startsWith("SG-App-Campus-")) {
      const campusName = team.name.replace("SG-App-Campus-", "").trim();
      if (CAMPUS_NAME_TO_ID[campusName] !== undefined) {
        result.campusTeamIds.push(team.$id);
        result.campusNames.push(campusName);
      }
    } else if (team.$id.startsWith("sg-app-dept-")) {
      result.departmentTeamIds.push(team.$id);
      result.departmentNames.push(team.name);
    } else if (team.name.startsWith("SG-App-Dept-")) {
      result.departmentTeamIds.push(team.$id);
      result.departmentNames.push(
        expandDepartmentName(team.name.replace("SG-App-Dept-", ""))
      );
    }
  }

  return result;
}
