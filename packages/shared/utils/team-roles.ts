/**
 * Pure helpers for deriving admin roles from Appwrite team memberships that
 * are synced from Azure AD security groups.
 *
 * Shared by apps/admin (lib/authorization.ts) and apps/api
 * (lib/admin-auth.ts) so the two services agree on what makes a user a
 * global admin or a campus admin. Keep these functions pure — no Appwrite
 * clients, no request context.
 *
 * Roles come from exact team `$id`s only. Team names can't be trusted: any
 * signed-in Appwrite user, even an anonymous one, can create a team with any
 * name and a free custom id, and own it. The ids below are the ones the M365
 * sync creates; it lowercases the Microsoft group's display name
 * (`sanitizeTeamId` in apps/admin/src/lib/m365-sync.ts), so
 * "SG-App-Dept-OperationsUnit" becomes "sg-app-dept-operationsunit".
 */

export const CAMPUS_CITY_NAMES = [
  "Oslo",
  "Bergen",
  "Stavanger",
  "Trondheim",
] as const;

export type CampusCity = (typeof CAMPUS_CITY_NAMES)[number];
export type CampusName = "National" | CampusCity;

export const CAMPUS_TEAM_IDS: Readonly<Record<CampusName, string>> = {
  National: "sg-app-campus-national",
  Oslo: "sg-app-campus-oslo",
  Bergen: "sg-app-campus-bergen",
  Stavanger: "sg-app-campus-stavanger",
  Trondheim: "sg-app-campus-trondheim",
};

export const OPERATIONS_UNIT_TEAM_ID = "sg-app-dept-operationsunit";

export const HR_TEAM_IDS = ["sg-app-dept-hr", "sg-app-dept-hrunit"] as const;

export const LEDELSEN_TEAM_IDS: Readonly<Record<CampusCity, string>> = {
  Oslo: "sg-app-dept-ledelsenoslo",
  Bergen: "sg-app-dept-ledelsenbergen",
  Stavanger: "sg-app-dept-ledelsenstavanger",
  Trondheim: "sg-app-dept-ledelsentrondheim",
};

export const DEPARTMENT_TEAM_ID_PREFIX = "sg-app-dept-";

export const KNOWN_CAMPUS_NAMES = new Set<string>([
  "National",
  ...CAMPUS_CITY_NAMES,
]);

/** Expand a camelCase team name: "OperationsUnit" -> "Operations Unit". */
export function expandDepartmentName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

/**
 * Classify a raw team name as a campus or department team, stripping legacy
 * SG-App-* prefixes and expanding camelCase department names.
 */
export function normalizeTeamName(name: string): {
  kind: "campus" | "department";
  value: string;
} {
  if (name.startsWith("SG-App-Campus-")) {
    return {
      kind: "campus",
      value: name.replace("SG-App-Campus-", "").trim(),
    };
  }

  if (name.startsWith("SG-App-Dept-")) {
    return {
      kind: "department",
      value: expandDepartmentName(name.replace("SG-App-Dept-", "")),
    };
  }

  if (KNOWN_CAMPUS_NAMES.has(name)) {
    return { kind: "campus", value: name };
  }

  return { kind: "department", value: name.trim() };
}

/**
 * Global admin = member of the National campus team plus the Operations Unit
 * department team. Accepts both the expanded and camelCase department form.
 */
export function isNationalOperations(
  campusNames: readonly string[],
  departmentNames: readonly string[]
): boolean {
  return (
    campusNames.includes("National") &&
    (departmentNames.includes("Operations Unit") ||
      departmentNames.includes("OperationsUnit"))
  );
}

/**
 * National HR = member of the National campus team plus the HR Unit department
 * team. Accepts both the expanded and camelCase department form.
 */
export function isNationalHR(
  campusNames: readonly string[],
  departmentNames: readonly string[]
): boolean {
  return (
    campusNames.includes("National") &&
    (departmentNames.includes("HR") ||
      departmentNames.includes("HRUnit") ||
      departmentNames.includes("HR Unit"))
  );
}

/**
 * Campus admin for a city = member of that city's campus team plus its
 * "Ledelsen" (leadership) department team. Accepts both "Ledelsen Oslo" and
 * the legacy "LedelsenOslo" form.
 */
export function getManagedCampuses(
  campusNames: readonly string[],
  departmentNames: readonly string[]
): string[] {
  const managedCampuses: string[] = [];

  for (const city of CAMPUS_CITY_NAMES) {
    const hasCampus = campusNames.includes(city);
    const hasManagement =
      departmentNames.includes(`Ledelsen ${city}`) ||
      departmentNames.includes(`Ledelsen${city}`);

    if (hasCampus && hasManagement) {
      managedCampuses.push(city);
    }
  }

  return managedCampuses;
}

export interface TeamRef {
  $id: string;
  name: string;
}

export interface TeamIdRoles {
  campusNames: CampusName[];
  campusTeamIds: string[];
  departmentNames: string[];
  departmentTeamIds: string[];
  isGlobalAdmin: boolean;
  isHr: boolean;
  isNationalHr: boolean;
  managedCampuses: CampusCity[];
}

const WHITESPACE_RE = /\s+/g;
const LEGACY_DEPARTMENT_PREFIX = "SG-App-Dept-";

const CAMPUS_NAME_BY_TEAM_ID = new Map<string, CampusName>(
  (Object.entries(CAMPUS_TEAM_IDS) as [CampusName, string][]).map(
    ([name, id]) => [id, name]
  )
);

/**
 * A department team's name is only used for display and scoping when it is
 * bound to the team's id. Returns null for a name that doesn't match its id.
 */
function boundDepartmentName(team: TeamRef): string | null {
  if (team.name.startsWith(LEGACY_DEPARTMENT_PREFIX)) {
    return team.name.toLowerCase() === team.$id
      ? expandDepartmentName(team.name.slice(LEGACY_DEPARTMENT_PREFIX.length))
      : null;
  }

  const expectedId = `${DEPARTMENT_TEAM_ID_PREFIX}${team.name
    .replace(WHITESPACE_RE, "")
    .toLowerCase()}`;
  return expectedId === team.$id ? team.name.trim() : null;
}

/** Derive admin roles from exact team ids. Names never grant a role. */
export function rolesFromTeams(teams: readonly TeamRef[]): TeamIdRoles {
  const ids = new Set(teams.map((team) => team.$id));

  const campusNames: CampusName[] = [];
  const campusTeamIds: string[] = [];
  const departmentNames: string[] = [];
  const departmentTeamIds: string[] = [];

  for (const team of teams) {
    const campusName = CAMPUS_NAME_BY_TEAM_ID.get(team.$id);
    if (campusName) {
      if (!campusNames.includes(campusName)) {
        campusNames.push(campusName);
        campusTeamIds.push(team.$id);
      }
      continue;
    }

    if (team.$id.startsWith(DEPARTMENT_TEAM_ID_PREFIX)) {
      if (!departmentTeamIds.includes(team.$id)) {
        departmentTeamIds.push(team.$id);
      }
      const name = boundDepartmentName(team);
      if (name !== null && !departmentNames.includes(name)) {
        departmentNames.push(name);
      }
    }
  }

  const isNational = ids.has(CAMPUS_TEAM_IDS.National);
  const isHr = HR_TEAM_IDS.some((id) => ids.has(id));

  return {
    campusNames,
    campusTeamIds,
    departmentNames,
    departmentTeamIds,
    isGlobalAdmin: isNational && ids.has(OPERATIONS_UNIT_TEAM_ID),
    isHr,
    isNationalHr: isHr && isNational,
    managedCampuses: CAMPUS_CITY_NAMES.filter(
      (city) =>
        ids.has(CAMPUS_TEAM_IDS[city]) && ids.has(LEDELSEN_TEAM_IDS[city])
    ),
  };
}
