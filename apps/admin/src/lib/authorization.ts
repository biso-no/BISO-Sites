"use server";

import { createSessionClient } from "@repo/api/server";

/**
 * Campus names for team identification
 */
const CAMPUS_NAMES = [
  "National",
  "Oslo",
  "Bergen",
  "Stavanger",
  "Trondheim",
] as const;
type CampusName = (typeof CAMPUS_NAMES)[number];

/**
 * User authorization context containing their teams and roles parsed from
 * Azure AD Security Groups (SG-App-Campus-*, SG-App-Dept-*, SG-App-Role-*)
 */
export type UserAuthContext = {
  userId: string;
  campusTeamIds: string[]; // Azure GUIDs for SG-App-Campus-* teams
  campusNames: string[]; // Parsed campus names (e.g., "National", "Oslo")
  departmentTeamIds: string[]; // Azure GUIDs for SG-App-Dept-* teams
  departmentNames: string[]; // Parsed department names (e.g., "OperationsUnit", "LedelsenOslo")
  roles: string[]; // Computed roles (e.g., "globaladmin", "campusadmin", "controller")
  labels: string[]; // Appwrite user labels
  managedCampuses: string[]; // Campus names this user manages (for campus admins)
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
    } else if (name.startsWith("SG-App-Role-")) {
      const roleName = name
        .replace("SG-App-Role-", "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      result.roles.push(roleName);
    }
  }

  return result;
}

/**
 * Derive additional roles from team memberships and labels
 */
function deriveRoles(
  parsed: TeamParseResult,
  labels: string[]
): { roles: string[]; managedCampuses: string[] } {
  const roles = [...parsed.roles];

  const hasGlobalAdminLabel =
    labels.includes("admin") || labels.includes("globaladmin");
  const isNatOps = isNationalOperations(
    parsed.campusNames,
    parsed.departmentNames
  );

  if ((hasGlobalAdminLabel || isNatOps) && !roles.includes("globaladmin")) {
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
 * - SG-App-Role-* groups → direct roles (e.g., "finance", "hr")
 * - National + OperationsUnit → "globaladmin" role
 * - Ledelsen{City} + Campus-{City} → "campusadmin" role with managed campus
 * - Appwrite labels "admin" or "globaladmin" → "globaladmin" role
 */
export async function getUserAuthContext(): Promise<UserAuthContext | null> {
  try {
    const { account, teams } = await createSessionClient();
    const user = await account.get();
    const teamMemberships = await teams.list();

    const parsed = parseTeamMemberships(teamMemberships.teams);
    const labels = user.labels || [];
    const { roles, managedCampuses } = deriveRoles(parsed, labels);

    return {
      userId: user.$id,
      campusTeamIds: parsed.campusTeamIds,
      campusNames: parsed.campusNames,
      departmentTeamIds: parsed.departmentTeamIds,
      departmentNames: parsed.departmentNames,
      roles,
      labels,
      managedCampuses,
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
  return (
    ctx.roles.includes(role.toLowerCase()) ||
    ctx.labels.includes(role.toLowerCase())
  );
}

/**
 * Check if user is a global admin
 */
export async function isGlobalAdmin(): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return (
    ctx.roles.includes("globaladmin") ||
    ctx.labels.includes("globaladmin") ||
    ctx.labels.includes("admin")
  );
}

/**
 * Check if user is a controller (campus-level financial controller)
 */
export async function isController(): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  return ctx.roles.includes("controller") || ctx.roles.includes("finance");
}

/**
 * Check if user belongs to a specific campus team
 */
export async function belongsToCampus(campusTeamId: string): Promise<boolean> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return false;
  }
  // Global admins have access to all campuses
  if (ctx.roles.includes("globaladmin") || ctx.labels.includes("globaladmin")) {
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
  // Global admins have access to all departments
  if (ctx.roles.includes("globaladmin") || ctx.labels.includes("globaladmin")) {
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
 * Check if a permission target matches the user's context
 */
function targetMatchesContext(target: string, ctx: UserAuthContext): boolean {
  if (target.startsWith("team:")) {
    const teamId = target.replace("team:", "");
    return (
      ctx.campusTeamIds.includes(teamId) ||
      ctx.departmentTeamIds.includes(teamId)
    );
  }

  if (target.startsWith("label:")) {
    const label = target.replace("label:", "");
    return ctx.labels.includes(label) || ctx.roles.includes(label);
  }

  if (target.startsWith("user:")) {
    const userId = target.replace("user:", "");
    return userId === ctx.userId;
  }

  return target === "any";
}

/**
 * Check if user is a global admin based on context
 */
function isGlobalAdminContext(ctx: UserAuthContext): boolean {
  return (
    ctx.roles.includes("globaladmin") || ctx.labels.includes("globaladmin")
  );
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

    // "users" grants read to all authenticated users
    if (parsed.target === "users") {
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
  campusNames: string[]; // All campuses user belongs to (e.g., ["Oslo"])
  departmentNames: string[]; // All departments user belongs to (e.g., ["Marketing"])
  managedCampuses: string[]; // Campuses user manages (campusadmin only)
  isGlobalAdmin: boolean; // National + OperationsUnit
  isCampusAdmin: boolean; // Ledelsen{City} + Campus-{City}
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

  // Global admins have access to everything
  if (ctx.roles.includes(ROLES.GLOBAL_ADMIN) || ctx.labels.includes("admin")) {
    return true;
  }

  return hasNavAccess(navKey, ctx.roles, ctx.departmentTeamIds.length > 0);
}
