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

  // Check each campus (excluding National, which grants globaladmin via OperationsUnit)
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

    // Get all teams the user is a member of
    const teamMemberships = await teams.list();

    const campusTeamIds: string[] = [];
    const campusNames: string[] = [];
    const departmentTeamIds: string[] = [];
    const departmentNames: string[] = [];
    const roles: string[] = [];

    for (const team of teamMemberships.teams) {
      const name = team.name;

      if (name.startsWith("SG-App-Campus-")) {
        campusTeamIds.push(team.$id);
        // Extract campus name: "SG-App-Campus-Oslo" -> "Oslo"
        const campusName = name.replace("SG-App-Campus-", "");
        campusNames.push(campusName);
      } else if (name.startsWith("SG-App-Dept-")) {
        departmentTeamIds.push(team.$id);
        // Extract department name: "SG-App-Dept-OperationsUnit" -> "OperationsUnit"
        const deptName = name.replace("SG-App-Dept-", "");
        departmentNames.push(deptName);
      } else if (name.startsWith("SG-App-Role-")) {
        // Extract role name: "SG-App-Role-globaladmin" -> "globaladmin"
        const roleName = name
          .replace("SG-App-Role-", "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        roles.push(roleName);
      }
    }

    const labels = user.labels || [];

    // Derive globaladmin from Appwrite labels
    if (
      (labels.includes("admin") || labels.includes("globaladmin")) &&
      !roles.includes("globaladmin")
    ) {
      roles.push("globaladmin");
    }

    // Derive globaladmin from National + OperationsUnit combination
    if (
      isNationalOperations(campusNames, departmentNames) &&
      !roles.includes("globaladmin")
    ) {
      roles.push("globaladmin");
    }

    // Derive campusadmin from Ledelsen{City} + Campus-{City} combination
    const managedCampuses = getManagedCampuses(campusNames, departmentNames);
    if (managedCampuses.length > 0 && !roles.includes("campusadmin")) {
      roles.push("campusadmin");
    }

    return {
      userId: user.$id,
      campusTeamIds,
      campusNames,
      departmentTeamIds,
      departmentNames,
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

/**
 * Parse a permission string to extract the type and target
 * Example: 'update("team:abc123")' -> { type: "update", target: "team:abc123" }
 */
function parsePermission(
  perm: string
): { type: string; target: string } | null {
  const match = perm.match(/^(\w+)\("([^"]+)"\)$/);
  if (!match) {
    return null;
  }
  return { type: match[1], target: match[2] };
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

  // Global admins always have write access
  if (ctx.roles.includes("globaladmin") || ctx.labels.includes("globaladmin")) {
    return true;
  }

  for (const perm of permissions) {
    const parsed = parsePermission(perm);
    if (!parsed) {
      continue;
    }

    // Check for update or write permissions
    if (parsed.type !== "update" && parsed.type !== "write") {
      continue;
    }

    const target = parsed.target;

    // Check if permission matches user's teams
    if (target.startsWith("team:")) {
      const teamId = target.replace("team:", "");
      if (
        ctx.campusTeamIds.includes(teamId) ||
        ctx.departmentTeamIds.includes(teamId)
      ) {
        return true;
      }
    }

    // Check if permission matches user's labels
    if (target.startsWith("label:")) {
      const label = target.replace("label:", "");
      if (ctx.labels.includes(label) || ctx.roles.includes(label)) {
        return true;
      }
    }

    // Check for user-specific permission
    if (target.startsWith("user:")) {
      const userId = target.replace("user:", "");
      if (userId === ctx.userId) {
        return true;
      }
    }

    // "any" permission grants access to everyone
    if (target === "any") {
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

  // Global admins always have read access
  if (ctx.roles.includes("globaladmin") || ctx.labels.includes("globaladmin")) {
    return true;
  }

  for (const perm of permissions) {
    const parsed = parsePermission(perm);
    if (!parsed) {
      continue;
    }

    // Check for read permissions
    if (parsed.type !== "read") {
      continue;
    }

    const target = parsed.target;

    // Check if permission matches user's teams
    if (target.startsWith("team:")) {
      const teamId = target.replace("team:", "");
      if (
        ctx.campusTeamIds.includes(teamId) ||
        ctx.departmentTeamIds.includes(teamId)
      ) {
        return true;
      }
    }

    // Check if permission matches user's labels
    if (target.startsWith("label:")) {
      const label = target.replace("label:", "");
      if (ctx.labels.includes(label) || ctx.roles.includes(label)) {
        return true;
      }
    }

    // Check for user-specific permission
    if (target.startsWith("user:")) {
      const userId = target.replace("user:", "");
      if (userId === ctx.userId) {
        return true;
      }
    }

    // "any" grants read to everyone
    if (target === "any") {
      return true;
    }

    // "users" grants read to all authenticated users
    if (target === "users") {
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
 * Simplified user role info for client-side navigation rendering.
 * This is passed to client components to determine which nav items to show.
 */
export type UserRolesForClient = {
  roles: string[];
  hasDepartmentMembership: boolean;
};

/**
 * Get user roles formatted for client-side navigation.
 * Returns roles array and department membership flag.
 */
export async function getUserRolesForClient(): Promise<UserRolesForClient> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return { roles: [], hasDepartmentMembership: false };
  }

  return {
    roles: ctx.roles,
    hasDepartmentMembership: ctx.departmentTeamIds.length > 0,
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
