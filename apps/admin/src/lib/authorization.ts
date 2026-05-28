"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";

const CAMPUS_CTX_COOKIE = "admin_campus_ctx";

/**
 * User authorization context containing their teams and roles parsed from
 * Azure AD Security Groups (SG-App-Campus-*, SG-App-Dept-*)
 */
export interface UserAuthContext {
  activeCampusId?: string; // Numeric campus_id if global admin has set a campus filter
  campusNames: string[]; // Parsed campus names (e.g., "National", "Oslo")
  campusTeamIds: string[]; // Azure GUIDs for SG-App-Campus-* teams
  departmentNames: string[]; // Parsed department names (e.g., "OperationsUnit", "LedelsenOslo")
  departmentTeamIds: string[]; // Azure GUIDs for SG-App-Dept-* teams
  email: string | null;
  labels: string[]; // Appwrite user labels (legacy, kept for read-only checks)
  managedCampuses: string[]; // Campus names this user manages (for campus admins)
  managedCampusIds: string[]; // Numeric campus_id values for managedCampuses
  name: string | null;
  resolvedCampusIds: string[]; // Numeric campus_id values for ALL campuses user belongs to
  resolvedDepartmentIds: string[]; // Appwrite Departments row $ids matching departmentNames
  roles: string[]; // Computed roles (e.g., "globaladmin", "campusadmin")
  userId: string;
}

/**
 * Determine if a user is a global admin based on their team memberships.
 * National campus + Operations Unit department = Global Admin
 * Department name is now expanded from camelCase: "OperationsUnit" -> "Operations Unit"
 */
function isNationalOperations(
  campusNames: string[],
  departmentNames: string[]
): boolean {
  return (
    campusNames.includes("National") &&
    departmentNames.includes("Operations Unit")
  );
}

/**
 * Determine which campuses a user manages based on their memberships.
 * Being in "Ledelsen {City}" dept + Campus "{City}" = Campus admin for that city.
 * Department name is now expanded from camelCase: "LedelsenOslo" -> "Ledelsen Oslo"
 */
function getManagedCampuses(
  campusNames: string[],
  departmentNames: string[]
): string[] {
  const managedCampuses: string[] = [];
  const cityNames = ["Oslo", "Bergen", "Stavanger", "Trondheim"];

  for (const city of cityNames) {
    const hasCampus = campusNames.includes(city);
    const hasManagement = departmentNames.includes(`Ledelsen ${city}`);

    if (hasCampus && hasManagement) {
      managedCampuses.push(city);
    }
  }

  return managedCampuses;
}

interface TeamParseResult {
  campusNames: string[];
  campusTeamIds: string[];
  departmentNames: string[];
  departmentTeamIds: string[];
  roles: string[];
}

/**
 * Parse team memberships into categorized arrays.
 * Teams now use clean names (e.g. "Oslo", "Operations Unit") rather than the
 * SG-App-* prefixed Azure displayNames. Campus teams are identified by matching
 * the team name against the known campus list (CAMPUS_NAME_TO_ID keys).
 */
function parseTeamMemberships(
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
    if (CAMPUS_NAME_TO_ID[team.name] === undefined) {
      result.departmentTeamIds.push(team.$id);
      result.departmentNames.push(team.name);
    } else {
      result.campusTeamIds.push(team.$id);
      result.campusNames.push(team.name);
    }
  }

  return result;
}

/**
 * Derive additional roles from team memberships.
 * Labels are no longer used for role derivation — only SG-App team membership matters.
 */
function deriveRoles(parsed: TeamParseResult): {
  roles: string[];
  managedCampuses: string[];
} {
  const roles = [...parsed.roles];

  const isNatOps = isNationalOperations(
    parsed.campusNames,
    parsed.departmentNames
  );

  if (isNatOps && !roles.includes("globaladmin")) {
    roles.push("globaladmin");
  }

  const managedCampuses = getManagedCampuses(
    parsed.campusNames,
    parsed.departmentNames
  );
  if (managedCampuses.length > 0 && !roles.includes("campusadmin")) {
    roles.push("campusadmin");
  }

  return { roles, managedCampuses };
}

/**
 * Resolve team-derived department names (e.g. "Operations Unit") to the
 * Appwrite Departments row $ids stored on content rows' `department_id` column.
 *
 * Returns an empty array on lookup failure — callers must treat the absence of
 * a resolved id the same as no department membership (no extra access granted).
 */
async function resolveDepartmentIds(
  departmentNames: string[]
): Promise<string[]> {
  if (departmentNames.length === 0) {
    return [];
  }

  try {
    const { db } = await createAdminClient();
    const result = await db.listRows<Departments>("app", "departments", [
      Query.equal("Name", departmentNames),
      Query.limit(departmentNames.length),
    ]);
    return result.rows.map((row) => row.$id);
  } catch (error) {
    console.error("Failed to resolve department IDs:", error);
    return [];
  }
}

/**
 * Get the current user's authorization context by fetching their team memberships.
 * Teams are created during M365 OAuth sync with Azure AD group GUIDs as IDs.
 *
 * Role derivation logic:
 * - National + OperationsUnit → "globaladmin" role
 * - Ledelsen{City} + Campus-{City} → "campusadmin" role with managed campus
 *
 * Authorization is team-based only. Labels are stored but not used for role checks.
 *
 * Wrapped with React.cache so multiple calls within the same RSC render share
 * a single Appwrite round-trip (the dashboard alone has 4+ consumers per
 * render via the various server actions).
 */
export const getUserAuthContext = cache(
  async (): Promise<UserAuthContext | null> => {
    try {
      const { account, teams } = await createSessionClient();
      const user = await account.get();
      const teamMemberships = await teams.list();

      const parsed = parseTeamMemberships(teamMemberships.teams);
      const labels = user.labels || [];
      const { roles, managedCampuses } = deriveRoles(parsed);

      const managedCampusIds = managedCampuses
        .map((n) => CAMPUS_NAME_TO_ID[n])
        .filter((id): id is string => Boolean(id));

      const resolvedCampusIds = parsed.campusNames
        .map((n) => CAMPUS_NAME_TO_ID[n])
        .filter((id): id is string => Boolean(id));

      const resolvedDepartmentIds = await resolveDepartmentIds(
        parsed.departmentNames
      );

      const cookieStore = await cookies();
      const campusCookieName =
        cookieStore.get(CAMPUS_CTX_COOKIE)?.value ?? null;
      const activeCampusId = campusCookieName
        ? CAMPUS_NAME_TO_ID[campusCookieName]
        : undefined;

      return {
        activeCampusId,
        campusNames: parsed.campusNames,
        campusTeamIds: parsed.campusTeamIds,
        departmentNames: parsed.departmentNames,
        departmentTeamIds: parsed.departmentTeamIds,
        email: user.email ?? null,
        name: user.name ?? null,
        labels,
        managedCampusIds,
        managedCampuses,
        resolvedCampusIds,
        resolvedDepartmentIds,
        roles,
        userId: user.$id,
      };
    } catch (error) {
      console.error("Failed to get user auth context:", error);
      return null;
    }
  }
);

/**
 * Check if user has a specific role
 */
async function _hasRole(role: string): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return ctx.roles.includes(role.toLowerCase());
}

/**
 * Check if user is a global admin (National + OperationsUnit team membership)
 */
export async function isGlobalAdmin(): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return ctx.roles.includes("globaladmin");
}

/**
 * Check if user is a campus admin (manages at least one campus).
 */
async function _isCampusAdmin(): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return ctx.managedCampuses.length > 0;
}

/**
 * Check if user belongs to a specific campus team
 */
async function _belongsToCampus(campusTeamId: string): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  if (ctx.roles.includes("globaladmin")) {
    return true;
  }
  return ctx.campusTeamIds.includes(campusTeamId);
}

/**
 * Check if user belongs to a specific department team
 */
async function _belongsToDepartment(
  departmentTeamId: string
): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  if (ctx.roles.includes("globaladmin")) {
    return true;
  }
  return ctx.departmentTeamIds.includes(departmentTeamId);
}

// ============================================================================
// Permission Checking Utilities (for $permissions arrays)
// ============================================================================

const PERMISSION_REGEX = /^(\w+)\("([^"]+)"\)$/;

/**
 * Parse a permission string to extract the type and target
 * Example: 'update("team:abc123")' -> { type: "update", target: "team:abc123" }
 */
function parsePermission(
  perm: string
): { type: string; target: string } | null {
  const match = perm.match(PERMISSION_REGEX);
  if (!match) {
    return null;
  }
  return { type: match[1], target: match[2] };
}

/**
 * Check if a permission target matches the user's context.
 * Only team-based and user-based targets are checked — label targets are ignored.
 */
function targetMatchesContext(target: string, ctx: UserAuthContext): boolean {
  if (target.startsWith("team:")) {
    const teamId = target.replace("team:", "");
    return (
      ctx.campusTeamIds.includes(teamId) ||
      ctx.departmentTeamIds.includes(teamId)
    );
  }

  if (target.startsWith("user:")) {
    const userId = target.replace("user:", "");
    return userId === ctx.userId;
  }

  return target === "any";
}

/**
 * Check if user is a global admin based on context (team membership only)
 */
function isGlobalAdminContext(ctx: UserAuthContext): boolean {
  return ctx.roles.includes("globaladmin");
}

/**
 * Check if user has write (update) access based on $permissions array
 */
export async function canWriteDocument(
  permissions: string[]
): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }

  if (isGlobalAdminContext(ctx)) {
    return true;
  }

  for (const perm of permissions) {
    const parsed = parsePermission(perm);
    if (!parsed) {
      continue;
    }

    const isWriteType = parsed.type === "update" || parsed.type === "write";
    if (isWriteType && targetMatchesContext(parsed.target, ctx)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has read access based on $permissions array
 */
async function _canReadDocument(permissions: string[]): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }

  if (isGlobalAdminContext(ctx)) {
    return true;
  }

  for (const perm of permissions) {
    const parsed = parsePermission(perm);
    if (!parsed) {
      continue;
    }

    if (parsed.type !== "read") {
      continue;
    }

    if (parsed.target === "users" || parsed.target === "any") {
      return true;
    }

    if (targetMatchesContext(parsed.target, ctx)) {
      return true;
    }
  }

  return false;
}

// ============================================================================
// Client-Side Authorization Helpers
// ============================================================================

import { hasNavAccess, type NavKey, ROLES } from "./roles";

/**
 * User role info for client-side navigation rendering and data scoping.
 * Includes campus and department context for proper access control.
 */
export interface UserRolesForClient {
  activeCampus: string | null; // Active campus name filter (global admins only, null = all)
  campusNames: string[];
  departmentNames: string[];
  hasDepartmentMembership: boolean;
  isCampusAdmin: boolean;
  isGlobalAdmin: boolean;
  managedCampuses: string[];
  roles: string[];
}

/**
 * Get user roles formatted for client-side navigation and data filtering.
 * Returns full context needed for campus/department-scoped access control.
 */
export async function getUserRolesForClient(): Promise<UserRolesForClient> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return {
      activeCampus: null,
      campusNames: [],
      departmentNames: [],
      hasDepartmentMembership: false,
      isCampusAdmin: false,
      isGlobalAdmin: false,
      managedCampuses: [],
      roles: [],
    };
  }

  const activeCampus = ctx.activeCampusId
    ? (CAMPUS_ID_TO_NAME[ctx.activeCampusId] ?? null)
    : null;

  return {
    activeCampus,
    campusNames: ctx.campusNames,
    departmentNames: ctx.departmentNames,
    hasDepartmentMembership: ctx.departmentTeamIds.length > 0,
    isCampusAdmin: ctx.roles.includes("campusadmin"),
    isGlobalAdmin: ctx.roles.includes("globaladmin"),
    managedCampuses: ctx.managedCampuses,
    roles: ctx.roles,
  };
}

/**
 * Check if user has access to a specific navigation item.
 * Server-side helper for route protection.
 */
export async function checkNavAccess(navKey: NavKey): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }

  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return true;
  }

  return hasNavAccess(navKey, ctx.roles, ctx.departmentTeamIds.length > 0);
}

/**
 * Page-level guard: redirects unauthenticated users to login and
 * notFound()s authenticated users who lack access to the given nav key.
 * Returns the auth context so callers can reuse it without a second
 * getUserAuthContext() round-trip.
 */
export async function requireNavAccess(
  navKey: NavKey
): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return ctx;
  }
  if (!hasNavAccess(navKey, ctx.roles, ctx.departmentTeamIds.length > 0)) {
    notFound();
  }
  return ctx;
}
