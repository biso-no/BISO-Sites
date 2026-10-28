/**
 * Who may see private details in the docs.
 *
 * Mirrors the admin's role derivation (apps/admin/src/lib/roles.ts,
 * authorization-team-memberships.ts and packages/shared/utils/team-roles.ts):
 * - National campus + Operations Unit department -> globaladmin
 * - {City} campus + Ledelsen {City} department   -> campusadmin
 *
 * apps/docs cannot import from apps/admin, so the rules are copied here and
 * pinned by the drift test in access.test.ts. Update both when admin changes.
 */

export type DocsAccess = "globaladmin" | "campusadmin" | "docs-handover" | null;

export const DOCS_HANDOVER_TEAM_ID = "docs-handover";

const CAMPUS_CITIES = ["Oslo", "Bergen", "Stavanger", "Trondheim"] as const;
const KNOWN_CAMPUSES = new Set<string>(["National", ...CAMPUS_CITIES]);

const CAMPUS_PREFIX = "SG-App-Campus-";
const DEPT_PREFIX = "SG-App-Dept-";
const DEPT_ID_PREFIX = "sg-app-dept-";
const CAMEL_BOUNDARY = /([a-z])([A-Z])/g;

interface Team {
  $id: string;
  name: string;
}

const expandDepartmentName = (name: string): string =>
  name.replace(CAMEL_BOUNDARY, "$1 $2").trim();

function parseTeams(teams: readonly Team[]): {
  campuses: string[];
  departments: string[];
} {
  const campuses: string[] = [];
  const departments: string[] = [];

  for (const team of teams) {
    if (KNOWN_CAMPUSES.has(team.name)) {
      campuses.push(team.name);
    } else if (team.name.startsWith(CAMPUS_PREFIX)) {
      const campus = team.name.replace(CAMPUS_PREFIX, "").trim();
      if (KNOWN_CAMPUSES.has(campus)) {
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

function isGlobalAdmin(campuses: string[], departments: string[]): boolean {
  return (
    campuses.includes("National") &&
    (departments.includes("Operations Unit") ||
      departments.includes("OperationsUnit"))
  );
}

function isCampusAdmin(campuses: string[], departments: string[]): boolean {
  return CAMPUS_CITIES.some(
    (city) =>
      campuses.includes(city) &&
      (departments.includes(`Ledelsen ${city}`) ||
        departments.includes(`Ledelsen${city}`))
  );
}

export function docsAccessFromTeams(teams: readonly Team[]): DocsAccess {
  const { campuses, departments } = parseTeams(teams);

  if (isGlobalAdmin(campuses, departments)) {
    return "globaladmin";
  }
  if (isCampusAdmin(campuses, departments)) {
    return "campusadmin";
  }
  if (teams.some((team) => team.$id === DOCS_HANDOVER_TEAM_ID)) {
    return "docs-handover";
  }
  return null;
}
