/**
 * Resolving the principal from a verified credential.
 *
 * The one rule this file exists to enforce: **identity comes from the backend,
 * never from an argument.** `account.get()` and `teams.list()` are answered by
 * Appwrite using the configured credential, so the roles below are the ones
 * Appwrite itself would apply. No tool input reaches this code path, and there
 * is no parameter anywhere in the package that can name a user, add a role, or
 * select a campus the credential does not already carry.
 *
 * A service key is explicitly NOT an identity. `createAdminClient`-equivalent
 * access bypasses row security entirely and belongs to no user; deriving a
 * principal from it would mean every call ran as an unbounded superuser. When
 * only a service key is configured the principal stays anonymous and the server
 * registers the `public` profile.
 */

import { Query } from "@repo/api";
import type { Departments } from "@repo/api/types/appwrite";
import {
  expandDepartmentName,
  getManagedCampuses,
  isNationalOperations,
} from "@repo/shared/utils/team-roles";
import type { BackendClients } from "../appwrite/clients";
import { fromAppwriteError } from "../runtime/errors";
import type { Logger } from "../runtime/logger";
import { CAMPUS_NAME_TO_ID } from "./campus";
import {
  ANONYMOUS_PRINCIPAL,
  type PolicyProfile,
  type Principal,
  ROLE_CAMPUS_ADMIN,
  ROLE_GLOBAL_ADMIN,
  ROLE_HR,
  type TeamLike,
} from "./principal";

const HR_DEPARTMENT_KEY = "hr";
const WHITESPACE_REGEX = /\s+/g;
const TEAM_PAGE_LIMIT = 200;

/**
 * HR is the recruitment gatekeeper; detected by normalising the clean team name
 * to `hr`. Mirrors `isHrDepartment` in `apps/admin/src/lib/recruitment.ts`.
 */
export function isHrDepartment(departmentNames: readonly string[]): boolean {
  return departmentNames.some(
    (name) =>
      name.replace(WHITESPACE_REGEX, "").toLowerCase() === HR_DEPARTMENT_KEY
  );
}

export interface TeamParseResult {
  campusNames: string[];
  campusTeamIds: string[];
  departmentNames: string[];
  departmentTeamIds: string[];
  roles: string[];
}

/**
 * Categorise team memberships.
 *
 * Mirrors `parseTeamMemberships` in the admin app, including its most important
 * property: a team that is neither a known campus nor an `SG-App-Dept-*` /
 * `sg-app-dept-*` team is ignored entirely. `biso-members` is such a team, and
 * must never become a department name — `apps/api`'s `normalizeTeamName` does
 * turn it into one, which is the divergence noted on `Principal`.
 */
export function parseTeamMemberships(
  teams: readonly TeamLike[]
): TeamParseResult {
  const result: TeamParseResult = {
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
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

  if (isHrDepartment(result.departmentNames)) {
    result.roles.push(ROLE_HR);
  }

  return result;
}

/** Derive `globaladmin` / `campusadmin` from parsed memberships. */
export function deriveRoles(parsed: TeamParseResult): {
  roles: string[];
  managedCampuses: string[];
} {
  const roles = [...parsed.roles];

  if (
    isNationalOperations(parsed.campusNames, parsed.departmentNames) &&
    !roles.includes(ROLE_GLOBAL_ADMIN)
  ) {
    roles.push(ROLE_GLOBAL_ADMIN);
  }

  const managedCampuses = getManagedCampuses(
    parsed.campusNames,
    parsed.departmentNames
  );
  if (managedCampuses.length > 0 && !roles.includes(ROLE_CAMPUS_ADMIN)) {
    roles.push(ROLE_CAMPUS_ADMIN);
  }

  return { roles, managedCampuses };
}

/**
 * Which policy profile a principal gets.
 *
 * `it-operator` requires global admin because every IT capability in the repo
 * (`it-users.ts`, `it-remediation.ts`) is either global-admin-only or
 * campus-scoped read-only, and this release exposes only the read half.
 */
export function resolveProfile(input: {
  roles: readonly string[];
  departmentTeamIds: readonly string[];
}): PolicyProfile {
  if (input.roles.includes(ROLE_GLOBAL_ADMIN)) {
    return "it-operator";
  }
  if (
    input.roles.includes(ROLE_CAMPUS_ADMIN) ||
    input.departmentTeamIds.length > 0
  ) {
    return "staff";
  }
  return "member";
}

/**
 * Resolve department names to Appwrite `departments` row ids.
 *
 * Content rows store the row id in `department_id`, not the team-derived name,
 * so without this a department member resolves to no departments and — by the
 * fail-closed rule in `scope.ts` — sees nothing. Returns `[]` on lookup
 * failure, which the scope engine treats the same as no membership: no extra
 * access is ever granted by a failed lookup.
 */
async function resolveDepartmentIds(
  clients: BackendClients,
  departmentNames: readonly string[],
  logger: Logger
): Promise<string[]> {
  if (departmentNames.length === 0) {
    return [];
  }
  try {
    // The `departments` table grants `read("any")`, so the caller's own client
    // is enough; no elevation is needed to map a name to an id.
    const result = await clients.user.db.listRows<Departments>(
      "app",
      "departments",
      [
        Query.equal("Name", [...departmentNames]),
        Query.limit(departmentNames.length),
      ]
    );
    return result.rows.map((row) => row.$id);
  } catch (error) {
    logger.warn("Failed to resolve department ids; failing closed", {
      departmentNames,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Resolve the principal for this server instance.
 *
 * Returns the anonymous principal when no user credential is configured. Any
 * other failure (an expired JWT, an unreachable backend) is surfaced, because
 * silently degrading an authenticated session to anonymous would make a
 * permission problem look like an empty database.
 */
export async function resolvePrincipal(
  clients: BackendClients,
  logger: Logger
): Promise<Principal> {
  if (!clients.hasUserCredential) {
    logger.info(
      "No user credential configured; running with the public profile"
    );
    return ANONYMOUS_PRINCIPAL;
  }

  let user: { $id: string; email?: string; name?: string };
  let teams: readonly TeamLike[];
  try {
    const account = await clients.user.account.get();
    user = account;
    const membership = await clients.user.teams.list([
      Query.limit(TEAM_PAGE_LIMIT),
    ]);
    teams = membership.teams;
  } catch (error) {
    throw fromAppwriteError(error, { operation: "resolve principal" });
  }

  const parsed = parseTeamMemberships(teams);
  const { roles, managedCampuses } = deriveRoles(parsed);

  const managedCampusIds = managedCampuses
    .map((name) => CAMPUS_NAME_TO_ID[name])
    .filter((id): id is string => Boolean(id));
  const resolvedCampusIds = parsed.campusNames
    .map((name) => CAMPUS_NAME_TO_ID[name])
    .filter((id): id is string => Boolean(id));

  const resolvedDepartmentIds = await resolveDepartmentIds(
    clients,
    parsed.departmentNames,
    logger
  );

  const principal: Principal = {
    userId: user.$id,
    email: user.email ?? null,
    name: user.name ?? null,
    roles,
    campusNames: parsed.campusNames,
    campusTeamIds: parsed.campusTeamIds,
    departmentNames: parsed.departmentNames,
    departmentTeamIds: parsed.departmentTeamIds,
    managedCampuses,
    managedCampusIds,
    resolvedCampusIds,
    resolvedDepartmentIds,
    profile: resolveProfile({
      roles,
      departmentTeamIds: parsed.departmentTeamIds,
    }),
    activeCampusId: undefined,
  };

  logger.info("Principal resolved", {
    userId: principal.userId,
    profile: principal.profile,
    roles: principal.roles,
    campuses: principal.campusNames,
    departments: principal.departmentNames,
  });

  return principal;
}
