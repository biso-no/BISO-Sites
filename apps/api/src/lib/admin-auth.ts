import "server-only";
import { type Models, Query } from "@repo/api";
import { appwriteErrorStatus, orNullIfNotFound } from "@repo/api/errors";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { AdminScope } from "@repo/shared/types/user-management";
import {
  keepSyncedTeams,
  M365_TEAM_SYNC_TABLE_ID,
  rolesFromTeams,
} from "@repo/shared/utils/team-roles";
import type { NextRequest } from "next/server";

const UNAUTHORIZED = 401;

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

/** A `m365_team_sync` row, written by the admin's M365 sign-in sync. */
type M365TeamSyncRow = Models.Row & {
  synced_at?: string | null;
  team_ids?: string[] | null;
};

/**
 * The team ids the M365 sync recorded for this user, read with the service
 * key (the table has no permissions). No record means no synced teams: an
 * empty set. Any other failure propagates.
 */
async function loadSyncedTeamIds(userId: string): Promise<Set<string>> {
  const { db } = await createAdminClient();
  const record = await orNullIfNotFound(
    db.getRow<M365TeamSyncRow>("app", M365_TEAM_SYNC_TABLE_ID, userId)
  );
  return new Set(record?.team_ids ?? []);
}

/**
 * Get the authorization scope for the current admin user.
 * Implements the three-tier authorization model:
 * 1. Teams `sg-app-campus-national` + `sg-app-dept-operationsunit` => manage
 *    ANY campus/department
 * 2. Teams `sg-app-campus-{x}` + `sg-app-dept-ledelsen{x}` => manage within
 *    campus x only
 * 3. Any other `sg-app-dept-*` team => manage within that department only
 *
 * Roles come from exact team ids, never team names. An `sg-app-*` team only
 * counts when its id is in the caller's `m365_team_sync` record; without a
 * record the caller has none. Campus membership alone grants no scope.
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
    const [teamMemberships, syncedTeamIds] = await Promise.all([
      teams.list([Query.limit(200)]),
      loadSyncedTeamIds(user.$id),
    ]);

    const roles = rolesFromTeams(
      keepSyncedTeams(teamMemberships.teams, syncedTeamIds)
    );
    const { isGlobalAdmin } = roles;
    const managedCampuses = roles.managedCampuses;
    const isCampusAdmin = managedCampuses.length > 0;

    return {
      userId: user.$id,
      canManageAnyCampus: isGlobalAdmin,
      managedCampusNames: isGlobalAdmin ? [] : managedCampuses,
      managedDepartmentNames:
        isGlobalAdmin || isCampusAdmin ? [] : roles.departmentNames,
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
