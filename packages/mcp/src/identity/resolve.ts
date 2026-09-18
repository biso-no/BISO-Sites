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
  type DepartmentNameMatcher,
  departmentNameMatch,
  departmentNameMatcher,
} from "./department-names";
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
 * Ceiling on the department rows examined while resolving one principal.
 * BISO runs on the order of a hundred units per campus; this leaves ample
 * headroom while keeping identity resolution a single bounded read.
 */
const DEPARTMENT_SCAN_LIMIT = 500;

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
 * Rows a single team-derived name identifies, preferring strict matches.
 *
 * A strict hit reconstructs the stored name exactly, so it always wins over a
 * case-folded one; folded hits apply only when nothing matched strictly.
 */
function hitsFor(
  matcher: DepartmentNameMatcher,
  rows: readonly Departments[]
): Departments[] {
  const strict: Departments[] = [];
  const folded: Departments[] = [];
  for (const row of rows) {
    const strength = departmentNameMatch(matcher, row);
    if (strength === "strict") {
      strict.push(row);
    } else if (strength === "folded") {
      folded.push(row);
    }
  }
  return strict.length > 0 ? strict : folded;
}

/**
 * Reduce hits to at most one row per campus.
 *
 * One unit per campus is expected, and a user in several campuses may match one
 * row in each. Two matches *inside a single campus* mean the comparison keys
 * collided and there is no way to tell which row was meant, so that campus
 * grants nothing.
 */
function uniquePerCampus(hits: readonly Departments[]): {
  ids: string[];
  collided: boolean;
} {
  const byCampus = new Map<string, Departments[]>();
  for (const hit of hits) {
    const key = hit.campus_id ?? "";
    byCampus.set(key, [...(byCampus.get(key) ?? []), hit]);
  }

  const ids: string[] = [];
  let collided = false;
  for (const [, campusHits] of byCampus) {
    if (campusHits.length > 1) {
      collided = true;
    } else {
      ids.push(campusHits[0].$id);
    }
  }
  return { ids, collided };
}

/** Pick the department rows each team-derived name identifies. */
function matchDepartments(
  matchers: ReadonlyArray<{ name: string; matcher: DepartmentNameMatcher }>,
  rows: readonly Departments[]
): { ids: string[]; unmatched: string[]; ambiguous: string[] } {
  const ids = new Set<string>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

  for (const { name, matcher } of matchers) {
    const hits = hitsFor(matcher, rows);
    if (hits.length === 0) {
      unmatched.push(name);
      continue;
    }
    const resolved = uniquePerCampus(hits);
    if (resolved.collided) {
      ambiguous.push(name);
    }
    for (const id of resolved.ids) {
      ids.add(id);
    }
  }

  return { ids: [...ids], unmatched, ambiguous };
}

/**
 * Resolve department names to Appwrite `departments` row ids.
 *
 * Content rows store the row id in `department_id`, not the team-derived name,
 * so without this a department member resolves to no departments and — by the
 * fail-closed rule in `scope.ts` — sees nothing. Returns `[]` on lookup
 * failure, which the scope engine treats the same as no membership: no extra
 * access is ever granted by a failed lookup.
 *
 * The match itself cannot be an equality test on `Name`: the team name is a
 * lossy, whitespace-deleted derivation of it. `department-names.ts` carries the
 * full explanation and the campus-exact matching rule. `apps/admin`'s
 * `resolveDepartmentIds` does use equality and so resolves nothing for
 * campus-prefixed departments — a pre-existing gap recorded in
 * `docs/roadmap.md`; this package does not inherit it.
 *
 * Candidate rows are read campus-first so a scan can never reach a campus the
 * principal does not belong to, and bounded so a large `departments` table
 * cannot turn identity resolution into an unbounded dump.
 */
async function resolveDepartmentIds(
  clients: BackendClients,
  departmentNames: readonly string[],
  campusIds: readonly string[],
  logger: Logger
): Promise<string[]> {
  if (departmentNames.length === 0) {
    return [];
  }

  const matchers = departmentNames.map((name) => ({
    name,
    matcher: departmentNameMatcher(name),
  }));

  try {
    // The `departments` table grants `read("any")`, so the caller's own client
    // is enough; no elevation is needed to map a name to an id.
    const filters = [
      Query.select(["$id", "Name", "campus_id"]),
      Query.limit(DEPARTMENT_SCAN_LIMIT),
    ];
    if (campusIds.length > 0) {
      filters.unshift(Query.equal("campus_id", [...campusIds]));
    }
    const result = await clients.user.db.listRows<Departments>(
      "app",
      "departments",
      filters
    );

    // A full window means the scan stopped short. Comparing against `total`
    // would fire on every campus-filtered read if `total` is the whole table,
    // which `apps/web/src/lib/data/queries.ts` says it now is — see
    // `inboxCounts` in `../services/operations.ts`.
    if (result.rows.length === DEPARTMENT_SCAN_LIMIT) {
      logger.warn(
        "departments table exceeded the resolution scan limit; some department memberships may not resolve",
        { scanned: result.rows.length, ceiling: DEPARTMENT_SCAN_LIMIT }
      );
    }

    const outcome = matchDepartments(matchers, result.rows);
    const { ids, unmatched, ambiguous } = outcome;

    if (unmatched.length > 0) {
      logger.warn(
        "Some department teams matched no department row; those memberships grant no scope",
        { unmatched }
      );
    }
    if (ambiguous.length > 0) {
      logger.warn(
        "Some department teams matched more than one row in the same campus; failing closed for those",
        { ambiguous }
      );
    }
    return ids;
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
    resolvedCampusIds,
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
