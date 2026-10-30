"use server";

import { type Models, Query } from "@repo/api";
import { orNullIfRowNotFound } from "@repo/api/errors";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import {
  keepSyncedTeams,
  M365_TEAM_SYNC_TABLE_ID,
} from "@repo/shared/utils/team-roles";
import { cookies } from "next/headers";
import { notFound, redirect, unauthorized } from "next/navigation";
import { cache } from "react";
import { parseTeamMemberships } from "./authorization-team-memberships";
import {
  hasVerifiedBenefitEditorIdentity,
  isBenefitEditorEmail,
} from "./benefit-access";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "./campus-constants";
import { matchDepartmentIdsByKey } from "./department-name-match";

const CAMPUS_CTX_COOKIE = "admin_campus_ctx";

/**
 * User authorization context containing their teams and roles derived from
 * the synced SG-App team ids (sg-app-campus-*, sg-app-dept-*)
 */
export interface UserAuthContext {
  activeCampusId?: string; // Numeric campus_id if global admin has set a campus filter
  campusNames: string[]; // Parsed campus names (e.g., "National", "Oslo")
  campusTeamIds: string[]; // Ids of synced sg-app-campus-* teams
  departmentNames: string[]; // Department names bound to their team id (e.g., "Operations Unit")
  departmentTeamIds: string[]; // Ids of synced sg-app-dept-* teams
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
 * Fail-closed check that the session's account has a Microsoft identity with
 * a configured benefits-editor email.
 */
async function hasMicrosoftEditorIdentity(account: {
  listIdentities: () => Promise<{
    identities: { provider: string; providerEmail?: string | null }[];
  }>;
}): Promise<boolean> {
  try {
    const { identities } = await account.listIdentities();
    return hasVerifiedBenefitEditorIdentity(identities);
  } catch {
    return false;
  }
}

/** A `m365_team_sync` row, written by `syncM365Permissions`. */
type M365TeamSyncRow = Models.Row & {
  synced_at?: string | null;
  team_ids?: string[] | null;
};

/**
 * The team ids the M365 sync recorded for this user, read with the service
 * key (the table has no permissions). No record means no synced teams: an
 * empty set. Any other failure propagates like the other Appwrite reads.
 */
async function loadSyncedTeamIds(userId: string): Promise<Set<string>> {
  const { db } = await createAdminClient();
  const record = await orNullIfRowNotFound(
    db.getRow<M365TeamSyncRow>("app", M365_TEAM_SYNC_TABLE_ID, userId)
  );
  return new Set(record?.team_ids ?? []);
}

/** Upper bound on the departments read when a team name has no exact match. */
const DEPARTMENT_SCAN_LIMIT = 1000;

/**
 * Department ids for names with no exact match, by name key. Empty when the
 * scan fails or doesn't read every department: a key that looks unique in a
 * partial read may not be.
 */
async function looseDepartmentIds(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  names: string[]
): Promise<string[]> {
  try {
    const all = await db.listRows<Departments>("app", "departments", [
      Query.select(["$id", "Name"]),
      Query.limit(DEPARTMENT_SCAN_LIMIT),
    ]);
    if (all.total > all.rows.length) {
      console.error(
        `resolveDepartmentIds: ${all.total} departments exceed the scan limit; name-key matches skipped`
      );
      return [];
    }
    return matchDepartmentIdsByKey(names, all.rows);
  } catch (error) {
    console.error("Failed to scan departments for name-key matches:", error);
    return [];
  }
}

/**
 * Resolve team-derived department names (e.g. "Operations Unit") to the
 * Appwrite Departments row $ids stored on content rows' `department_id` column.
 *
 * A name with no exact match is matched by name key instead: Microsoft group
 * names hold no spaces or punctuation, so the team "OSLFadderullan" never
 * equals its department's Name, "OSL Fadderullan" (see department-name-match).
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
    const ids = result.rows.map((row) => row.$id);
    const exactNames = new Set(result.rows.map((row) => row.Name));
    const unmatched = departmentNames.filter((name) => !exactNames.has(name));
    if (unmatched.length > 0) {
      ids.push(...(await looseDepartmentIds(db, unmatched)));
    }
    // Two teams can name one department; callers count the ids.
    return [...new Set(ids)];
  } catch (error) {
    console.error("Failed to resolve department IDs:", error);
    return [];
  }
}

/**
 * Get the current user's authorization context by fetching their team memberships.
 * Teams are created during M365 OAuth sync with the lowercased group display
 * name as id (e.g. "sg-app-campus-oslo"). Roles come from those ids only; team
 * names never grant a role. An sg-app-* team only counts when its id is in the
 * user's m365_team_sync record, which the sync writes from their Microsoft
 * groups; without a record the user has no sg-app-* teams.
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
      const [teamMemberships, syncedTeamIds] = await Promise.all([
        teams.list([Query.limit(200)]),
        loadSyncedTeamIds(user.$id),
      ]);

      const parsed = parseTeamMemberships(
        keepSyncedTeams(teamMemberships.teams, syncedTeamIds)
      );
      const { managedCampuses } = parsed;
      const roles = [...parsed.roles];
      if (
        isBenefitEditorEmail(user.email) &&
        !roles.includes(ROLES.BENEFITS_EDITOR) &&
        (await hasMicrosoftEditorIdentity(account))
      ) {
        roles.push(ROLES.BENEFITS_EDITOR);
      }

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
    } catch (error) {
      const err = error as {
        cause?: { code?: unknown };
        code?: unknown;
        message?: unknown;
        type?: unknown;
      };
      const isOutage =
        (typeof err?.code === "number" && err.code >= 500) ||
        err?.type === "appwrite_timeout" ||
        // A missing table or database is a backend/config failure, never "no record".
        err?.type === "table_not_found" ||
        err?.type === "database_not_found" ||
        err?.code === "ECONNREFUSED" ||
        err?.cause?.code === "ECONNREFUSED" ||
        (typeof err?.message === "string" &&
          err.message.includes("fetch failed"));

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
    ctx.campusTeamIds.length > 0 ||
    ctx.departmentTeamIds.length > 0 ||
    ctx.roles.includes(ROLES.BENEFITS_EDITOR);
  if (!hasTeam) {
    unauthorized();
  }
  return ctx;
}
