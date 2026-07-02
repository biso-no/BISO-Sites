"use server";

import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import {
  getManagedCampuses,
  isNationalOperations,
} from "@repo/shared/utils/team-roles";
import { cookies } from "next/headers";
import { notFound, redirect, unauthorized } from "next/navigation";
import { cache } from "react";
import {
  parseTeamMemberships,
  type TeamParseResult,
} from "./authorization-team-memberships";
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
  managedCampuses: string[]; // Campus names this user manages (for campus admins)
  managedCampusIds: string[]; // Numeric campus_id values for managedCampuses
  name: string | null;
  resolvedCampusIds: string[]; // Numeric campus_id values for ALL campuses user belongs to
  resolvedDepartmentIds: string[]; // Appwrite Departments row $ids matching departmentNames
  roles: string[]; // Computed roles (e.g., "globaladmin", "campusadmin")
  userId: string;
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
      const teamMemberships = await teams.list([Query.limit(200)]);

      const parsed = parseTeamMemberships(teamMemberships.teams);
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
        managedCampusIds,
        managedCampuses,
        resolvedCampusIds,
        resolvedDepartmentIds,
        roles,
        userId: user.$id,
      };
    } catch (error: any) {
      const isOutage =
        error?.code >= 500 ||
        error?.type === "appwrite_timeout" ||
        error?.code === "ECONNREFUSED" ||
        error?.cause?.code === "ECONNREFUSED" ||
        error?.message?.includes("fetch failed");

      if (isOutage) {
        console.error("[getUserAuthContext] Appwrite outage detected:", error);
        throw error;
      }

      console.error("Failed to get user auth context:", error);
      return null;
    }
  }
);

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
 * Server-action guard: redirects unauthenticated users to login and returns
 * the auth context. Canonical auth check for (portal)/_actions modules.
 */
export async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
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

/**
 * Top-level portal/editor guard. Distinguishes two failure states:
 * - No session at all → redirect to /auth/login
 * - Valid session but no admin team membership → unauthorized() (401 page)
 *
 * This prevents the confusing behaviour where a freshly OAuth'd user with no
 * provisioned SG-App groups silently bounces back to the login screen.
 */
export async function requireAdminAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  const hasTeam =
    ctx.campusTeamIds.length > 0 || ctx.departmentTeamIds.length > 0;
  if (!hasTeam) {
    unauthorized();
  }
  return ctx;
}
