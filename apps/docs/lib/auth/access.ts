/**
 * Who may see private details in the docs.
 *
 * Access is decided by exact team `$id`s only. Team names are ignored: any
 * signed-in Appwrite user, even an anonymous one, can create a team with any
 * name and a free custom id, and own it. So a name like "SG-App-Campus-National"
 * proves nothing.
 *
 * The ids below are the ones the M365 sync creates. It builds each team id by
 * lowercasing the Microsoft group's display name (`sanitizeTeamId` in
 * apps/admin/src/lib/m365-sync.ts), so "SG-App-Dept-OperationsUnit" becomes
 * "sg-app-dept-operationsunit". Once a team with one of these ids exists,
 * nobody else can create another with the same id.
 *
 * The admin and the API use exact ids too, and count an `sg-app-*` team only
 * when its id is in the user's saved list in the `m365_team_sync` table, which
 * the sync writes at each Microsoft sign-in. Docs doesn't read that table: it
 * trusts a fixed list of ids plus `docs-handover`. The test in access.test.ts
 * pins the sync's id rule.
 */

export type DocsAccess = "globaladmin" | "campusadmin" | "docs-handover" | null;

export const DOCS_HANDOVER_TEAM_ID = "docs-handover";

/** National campus + Operations Unit department. */
export const GLOBAL_ADMIN_TEAM_IDS = {
  campus: "sg-app-campus-national",
  department: "sg-app-dept-operationsunit",
} as const;

/** One pair per city: the campus team + that city's Ledelsen team. */
export const CAMPUS_ADMIN_TEAM_IDS = [
  { campus: "sg-app-campus-oslo", department: "sg-app-dept-ledelsenoslo" },
  { campus: "sg-app-campus-bergen", department: "sg-app-dept-ledelsenbergen" },
  {
    campus: "sg-app-campus-stavanger",
    department: "sg-app-dept-ledelsenstavanger",
  },
  {
    campus: "sg-app-campus-trondheim",
    department: "sg-app-dept-ledelsentrondheim",
  },
] as const;

interface Team {
  $id: string;
  /** Never read. Kept so callers can pass Appwrite teams as they come. */
  name: string;
}

function hasPair(
  ids: ReadonlySet<string>,
  pair: { campus: string; department: string }
): boolean {
  return ids.has(pair.campus) && ids.has(pair.department);
}

export function docsAccessFromTeams(teams: readonly Team[]): DocsAccess {
  const ids = new Set(teams.map((team) => team.$id));

  if (hasPair(ids, GLOBAL_ADMIN_TEAM_IDS)) {
    return "globaladmin";
  }
  if (CAMPUS_ADMIN_TEAM_IDS.some((pair) => hasPair(ids, pair))) {
    return "campusadmin";
  }
  if (ids.has(DOCS_HANDOVER_TEAM_ID)) {
    return "docs-handover";
  }
  return null;
}
