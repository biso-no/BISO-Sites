"use server";

import { createSessionClient } from "@repo/api/server";
import { CAMPUS_NAME_TO_ID } from "./campus-constants";

/**
 * User authorization context containing their teams and roles parsed from
 * Azure AD Security Groups (SG-App-Campus-*, SG-App-Dept-*)
 */
export type UserAuthContext = {
  userId: string;
  campusTeamIds: string[]; // Azure GUIDs for SG-App-Campus-* teams
  campusNames: string[]; // Parsed campus names (e.g., "National", "Oslo")
  departmentTeamIds: string[]; // Azure GUIDs for SG-App-Dept-* teams
  departmentNames: string[]; // Parsed department names (e.g., "OperationsUnit", "LedelsenOslo")
  roles: string[]; // Computed roles (e.g., "globaladmin", "campusadmin")
  labels: string[]; // Appwrite user labels (legacy, kept for read-only checks)
  managedCampuses: string[]; // Campus names this user manages (for campus admins)
  managedCampusIds: string[]; // Numeric campus_id values for managedCampuses
  resolvedCampusIds: string[]; // Numeric campus_id values for ALL campuses user belongs to
};

/**
 * Determine if a user is a global admin based on their team memberships.
 * National campus + OperationsUnit department = Global Admin
 */
function isNationalOperations(
  campusNames: string[],
  departmentNames: string[]
): boolean {
  return (
    campusNames.includes("National") &&
    departmentNames.includes("OperationsUnit")
  );
}

/**
 * Determine which campuses a user manages based on their memberships.
 * Being in Ledelsen{City} + Campus-{City} = Campus admin for that city
 */
function getManagedCampuses(
  campusNames: string[],
  departmentNames: string[]
): string[] {
  const managedCampuses: string[] = [];
  const cityNames = ["Oslo", "Bergen", "Stavanger", "Trondheim"];

  for (const city of cityNames) {
    const hasCampus = campusNames.includes(city);
    const hasManagement = departmentNames.includes(`Ledelsen${city}`);

    if (hasCampus && hasManagement) {
      managedCampuses.push(city);
    }
  }

  return managedCampuses;
}

type TeamParseResult = {
  campusTeamIds: string[];
  campusNames: string[];
  departmentTeamIds: string[];
  departmentNames: string[];
  roles: string[];
};

/**
 * Parse team memberships into categorized arrays
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
    const name = team.name;

    if (name.startsWith("SG-App-Campus-")) {
      result.campusTeamIds.push(team.$id);
      result.campusNames.push(name.replace("SG-App-Campus-", ""));
    } else if (name.startsWith("SG-App-Dept-")) {
      result.departmentTeamIds.push(team.$id);
      result.departmentNames.push(name.replace("SG-App-Dept-", ""));
    }
  }

  return result;
}

/**
 * Derive additional roles from team memberships.
 * Labels are no longer used for role derivation — only SG-App team membership matters.
 */
function deriveRoles(
  parsed: TeamParseResult
): { roles: string[]; managedCampuses: string[] } {
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
 * Get the current user's authorization context by fetching their team memberships.
 * Teams are created during M365 OAuth sync with Azure AD group GUIDs as IDs.
 *
 * Role derivation logic:
 * - National + OperationsUnit → "globaladmin" role
 * - Ledelsen{City} + Campus-{City} → "campusadmin" role with managed campus
 *
 * Authorization is team-based only. Labels are stored but not used for role checks.
 */
export async function getUserAuthContext(): Promise<UserAuthContext | null> {
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

    return {
      userId: user.$id,
      campusTeamIds: parsed.campusTeamIds,
      campusNames: parsed.campusNames,
      departmentTeamIds: parsed.departmentTeamIds,
      departmentNames: parsed.departmentNames,
      roles,
      labels,
      managedCampuses,
      managedCampusIds,
      resolvedCampusIds,
    };
  } catch (error) {
    console.error("Failed to get user auth context:", error);
    return null;
  }
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
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
export async function isCampusAdmin(): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return ctx.managedCampuses.length > 0;
}

/**
 * Check if user belongs to a specific campus team
 */
export async function belongsToCampus(campusTeamId: string): Promise<boolean> {
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
export async function belongsToDepartment(
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
export async function canReadDocument(permissions: string[]): Promise<boolean> {
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
export type UserRolesForClient = {
  roles: string[];
  hasDepartmentMembership: boolean;
  campusNames: string[];
  departmentNames: string[];
  managedCampuses: string[];
  isGlobalAdmin: boolean;
  isCampusAdmin: boolean;
};

/**
 * Get user roles formatted for client-side navigation and data filtering.
 * Returns full context needed for campus/department-scoped access control.
 */
export async function getUserRolesForClient(): Promise<UserRolesForClient> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return {
      roles: [],
      hasDepartmentMembership: false,
      campusNames: [],
      departmentNames: [],
      managedCampuses: [],
      isGlobalAdmin: false,
      isCampusAdmin: false,
    };
  }

  return {
    roles: ctx.roles,
    hasDepartmentMembership: ctx.departmentTeamIds.length > 0,
    campusNames: ctx.campusNames,
    departmentNames: ctx.departmentNames,
    managedCampuses: ctx.managedCampuses,
    isGlobalAdmin: ctx.roles.includes("globaladmin"),
    isCampusAdmin: ctx.roles.includes("campusadmin"),
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
