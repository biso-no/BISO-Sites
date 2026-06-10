import "server-only";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { AdminScope } from "@repo/shared/types/user-management";
import type { NextRequest } from "next/server";

const KNOWN_CAMPUSES = new Set([
  "National",
  "Oslo",
  "Bergen",
  "Stavanger",
  "Trondheim",
]);

function expandDepartmentName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
}

function normalizeTeamName(name: string): {
  kind: "campus" | "department";
  value: string;
} | null {
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

  if (KNOWN_CAMPUSES.has(name)) {
    return { kind: "campus", value: name };
  }

  return { kind: "department", value: name.trim() };
}

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

// Helper to compute managed campuses based on city membership
function computeManagedCampuses(
  campusNames: string[],
  departmentNames: string[]
): string[] {
  const cityNames = ["Oslo", "Bergen", "Stavanger", "Trondheim"];
  const managedCampuses: string[] = [];

  for (const city of cityNames) {
    const hasCampus = campusNames.includes(city);
    const hasManagement =
      departmentNames.includes(`Ledelsen${city}`) ||
      departmentNames.includes(`Ledelsen ${city}`);
    if (hasCampus && hasManagement) {
      managedCampuses.push(city);
    }
  }

  return managedCampuses;
}

/**
 * Extracts JWT from Authorization header (Bearer token)
 */
function extractJwtFromRequest(req: NextRequest): string | undefined {
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
 */
export async function getAdminScope(
  req: NextRequest
): Promise<AdminScope | null> {
  try {
    const jwt = extractJwtFromRequest(req);
    const { account, teams } = await createSessionClient(jwt);
    const user = await account.get();
    const teamMemberships = await teams.list();

    const campusNames: string[] = [];
    const departmentNames: string[] = [];
    const labels = user.labels || [];

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

    // Check for global admin (National + OperationsUnit OR admin label)
    const hasNational = campusNames.includes("National");
    const hasOperationsUnit =
      departmentNames.includes("OperationsUnit") ||
      departmentNames.includes("Operations Unit");
    const hasAdminLabel =
      labels.includes("admin") || labels.includes("globaladmin");
    const isGlobalAdmin = (hasNational && hasOperationsUnit) || hasAdminLabel;

    // Check for campus admin (Ledelsen{City} + Campus-{City})
    const managedCampuses = computeManagedCampuses(
      campusNames,
      departmentNames
    );

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
    console.error("Failed to get admin scope:", error);
    return null;
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
