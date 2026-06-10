/**
 * Pure helpers for deriving admin roles from Appwrite team memberships that
 * are synced from Azure AD security groups.
 *
 * Shared by apps/admin (lib/authorization.ts) and apps/api
 * (lib/admin-auth.ts) so the two services agree on what makes a user a
 * global admin or a campus admin. Keep these functions pure — no Appwrite
 * clients, no request context.
 *
 * Naming background: teams were originally named with SG-App-Campus-* /
 * SG-App-Dept-* prefixes and camelCase department names ("LedelsenOslo").
 * Newer teams use clean, expanded names ("Ledelsen Oslo"). All helpers
 * accept both forms.
 */

export const CAMPUS_CITY_NAMES = [
  "Oslo",
  "Bergen",
  "Stavanger",
  "Trondheim",
] as const;

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
