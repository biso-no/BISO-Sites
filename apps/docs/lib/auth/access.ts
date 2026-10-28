/**
 * Who may see private details in the docs.
 *
 * The role rules (National + Operations Unit -> globaladmin, {City} campus +
 * Ledelsen {City} -> campusadmin) come from the shared helpers the admin also
 * uses. Only the team parser is mirrored here, because the admin's copy lives
 * in apps/admin/src/lib/authorization-team-memberships.ts and imports
 * admin-only modules. The drift test in access.test.ts pins that parser.
 */
import {
  expandDepartmentName,
  getManagedCampuses,
  isNationalOperations,
  KNOWN_CAMPUS_NAMES,
} from "@repo/shared/utils/team-roles";

export type DocsAccess = "globaladmin" | "campusadmin" | "docs-handover" | null;

export const DOCS_HANDOVER_TEAM_ID = "docs-handover";

const CAMPUS_PREFIX = "SG-App-Campus-";
const DEPT_PREFIX = "SG-App-Dept-";
const DEPT_ID_PREFIX = "sg-app-dept-";

interface Team {
  $id: string;
  name: string;
}

function parseTeams(teams: readonly Team[]): {
  campuses: string[];
  departments: string[];
} {
  const campuses: string[] = [];
  const departments: string[] = [];

  for (const team of teams) {
    if (KNOWN_CAMPUS_NAMES.has(team.name)) {
      campuses.push(team.name);
    } else if (team.name.startsWith(CAMPUS_PREFIX)) {
      const campus = team.name.replace(CAMPUS_PREFIX, "").trim();
      if (KNOWN_CAMPUS_NAMES.has(campus)) {
        campuses.push(campus);
      }
    } else if (team.$id.startsWith(DEPT_ID_PREFIX)) {
      departments.push(team.name);
    } else if (team.name.startsWith(DEPT_PREFIX)) {
      departments.push(
        expandDepartmentName(team.name.replace(DEPT_PREFIX, ""))
      );
    }
  }

  return { campuses, departments };
}

export function docsAccessFromTeams(teams: readonly Team[]): DocsAccess {
  const { campuses, departments } = parseTeams(teams);

  if (isNationalOperations(campuses, departments)) {
    return "globaladmin";
  }
  if (getManagedCampuses(campuses, departments).length > 0) {
    return "campusadmin";
  }
  if (teams.some((team) => team.$id === DOCS_HANDOVER_TEAM_ID)) {
    return "docs-handover";
  }
  return null;
}
