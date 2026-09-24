import "server-only";
import { Query } from "@repo/api";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { AdminScope } from "@repo/shared/types/user-management";
import {
  getManagedCampuses,
  isNationalOperations,
  normalizeTeamName,
} from "@repo/shared/utils/team-roles";
import type { NextRequest } from "next/server";

const UNAUTHORIZED = 401;

// Helper to reduce complexity
function computeManagedCampusNames(
  isGlobal: boolean,
  managed: string[],
  all: string[]
): string[] {
  if (isGlobal) {
    return [];
  }
  if (managed.length > 0) {
    return managed;
  }
  return all;
}

/**
 * Extracts JWT from Authorization header (Bearer token)
 */
export function extractJwtFromRequest(req: NextRequest): string | undefined {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return;
}

/**
 * Get the authorization scope for the current admin user.
 * Implements the three-tier authorization model:
 * 1. National + OperationsUnit => manage ANY campus/department
 * 2. Campus-{X} + Ledelsen{X} => manage within campus X only
 * 3. Campus-{X} + Dept-{Y} => manage within that department only
 *
 * Resolves to `null` only when the caller is not authenticated (no session, or
 * Appwrite answered 401). Any other failure (outage, timeout, 5xx) is rethrown
 * so routes answer 5xx instead of a misleading 401.
 */
export async function getAdminScope(
  req: NextRequest
): Promise<AdminScope | null> {
  try {
    const jwt = extractJwtFromRequest(req);
    const { account, teams } = await createSessionClient(jwt);
    const user = await account.get();
    const teamMemberships = await teams.list([Query.limit(200)]);

    const campusNames: string[] = [];
    const departmentNames: string[] = [];

    // Parse team memberships
    for (const team of teamMemberships.teams) {
      const normalized = normalizeTeamName(team.name);
      if (!normalized) {
        continue;
      }

      if (normalized.kind === "campus") {
        campusNames.push(normalized.value);
      } else {
        departmentNames.push(normalized.value);
      }
    }

    // Check for global admin (National + Operations Unit)
    const isGlobalAdmin = isNationalOperations(campusNames, departmentNames);

    // Check for campus admin (Ledelsen{City} + Campus-{City})
    const managedCampuses = getManagedCampuses(campusNames, departmentNames);

    const isCampusAdmin = managedCampuses.length > 0;

    return {
      userId: user.$id,
      canManageAnyCampus: isGlobalAdmin,
      managedCampusNames: computeManagedCampusNames(
        isGlobalAdmin,
        managedCampuses,
        campusNames
      ),
      managedDepartmentNames:
        isGlobalAdmin || isCampusAdmin ? [] : departmentNames,
      isGlobalAdmin,
      isCampusAdmin,
    };
  } catch (error) {
    if (appwriteErrorStatus(error) === UNAUTHORIZED) {
      return null;
    }
    console.error("Failed to get admin scope:", error);
    throw error;
  }
}

/**
 * Check if the admin scope allows managing a specific campus
 */
export function canManageCampus(
  scope: AdminScope,
  campusName: string
): boolean {
  if (scope.canManageAnyCampus) {
    return true;
  }
  return scope.managedCampusNames.includes(campusName);
}

/**
 * Create an audit log entry for admin actions
 */
export async function createAuditLog(data: {
  actorId: string;
  actorEmail?: string;
  action: string;
  resourceId?: string;
  resourceType?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { db } = await createAdminClient();
    await db.createRow("app", "audit_logs", "unique()", {
      actor_id: data.actorId,
      actor_email: data.actorEmail,
      action: data.action,
      resource_id: data.resourceId,
      resource_type: data.resourceType,
      payload: data.payload ? JSON.stringify(data.payload) : null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
