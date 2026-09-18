/**
 * The verified principal.
 *
 * Mirrors `UserAuthContext` in `apps/admin/src/lib/authorization.ts`, which is
 * the richer of the repo's two derivations (the other is `getAdminScope` in
 * `apps/api/src/lib/admin-auth.ts`). The two disagree in a way worth recording:
 *
 * - admin's `parseTeamMemberships` ignores any team that is not a known campus
 *   or an `SG-App-Dept-*` / `sg-app-dept-*` team, and derives an `hr` role.
 * - api's `normalizeTeamName` classifies *every* unrecognised team name as a
 *   department, so a plain `biso-members` membership becomes a department name.
 *
 * This package follows the admin derivation, because it is the stricter of the
 * two and because the HR role is what actually gates recruitment
 * (`toRecruitmentAdminScope`). The pure helpers are imported from
 * `@repo/shared/utils/team-roles` so the campus/department rules cannot drift
 * from the apps.
 */

import type { Models } from "@repo/api";

export const ROLE_GLOBAL_ADMIN = "globaladmin";
export const ROLE_CAMPUS_ADMIN = "campusadmin";
export const ROLE_HR = "hr";

/** The pseudo-role for "member of at least one department team". */
export const ROLE_DEPARTMENT = "department";

/**
 * Policy profiles.
 *
 * These decide which tool modules are *registered*, and are computed from the
 * principal, the configuration and what the backend actually supports. They are
 * not a claim that a corresponding app integration exists.
 */
export const POLICY_PROFILES = [
  /** No verified identity. Only anonymous-visible, published data. */
  "public",
  /** A signed-in user with no admin team. Own records plus member content. */
  "member",
  /** Campus/department staff. Scoped content operations and approvals. */
  "staff",
  /** Global admin. Adds IT read diagnostics and platform operations. */
  "it-operator",
] as const;

export type PolicyProfile = (typeof POLICY_PROFILES)[number];

export interface Principal {
  /**
   * Always false in this package.
   *
   * `apps/admin` lets a global admin narrow themselves to one campus with the
   * `admin_campus_ctx` cookie. There is no cookie here and no tool argument may
   * set it, because narrowing is indistinguishable from widening at the call
   * site — a tool that accepted `activeCampusId` would be accepting a scope
   * claim. Global admins therefore see all campuses, and every result states so.
   */
  readonly activeCampusId: undefined;
  /** Parsed campus team names, e.g. `["National", "Oslo"]`. */
  campusNames: string[];
  campusTeamIds: string[];
  /** Parsed department team names, e.g. `["Operations Unit"]`. */
  departmentNames: string[];
  departmentTeamIds: string[];
  email: string | null;
  /** Campus names this principal manages (campus admin). */
  managedCampuses: string[];
  /** Numeric campus ids for `managedCampuses`. */
  managedCampusIds: string[];
  name: string | null;
  profile: PolicyProfile;
  /** Numeric campus ids for every campus team held. */
  resolvedCampusIds: string[];
  /** Appwrite `departments` row ids matching `departmentNames`. */
  resolvedDepartmentIds: string[];
  /** Derived roles: `globaladmin`, `campusadmin`, `hr`. */
  roles: string[];
  /** Appwrite user id. Always from `account.get()`, never from an argument. */
  userId: string;
}

/** The principal used when no user credential is configured. */
export const ANONYMOUS_PRINCIPAL: Principal = {
  userId: "",
  email: null,
  name: null,
  roles: [],
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  managedCampuses: [],
  managedCampusIds: [],
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  profile: "public",
  activeCampusId: undefined,
};

export function isAnonymous(principal: Principal): boolean {
  return principal.userId === "";
}

export function isGlobalAdmin(principal: Principal): boolean {
  return principal.roles.includes(ROLE_GLOBAL_ADMIN);
}

export function isCampusAdmin(principal: Principal): boolean {
  return principal.roles.includes(ROLE_CAMPUS_ADMIN);
}

export function isHr(principal: Principal): boolean {
  return principal.roles.includes(ROLE_HR);
}

export function hasDepartmentMembership(principal: Principal): boolean {
  return principal.departmentTeamIds.length > 0;
}

/**
 * A description of the principal that is safe to return to a model.
 *
 * Team ids are included because they are the vocabulary of the permission
 * system and the model needs them to explain a refusal; the email is included
 * because the caller already knows their own address.
 */
export function describePrincipal(
  principal: Principal
): Record<string, unknown> {
  if (isAnonymous(principal)) {
    return {
      authenticated: false,
      profile: "public" satisfies PolicyProfile,
      note: "No user credential is configured. Only published, publicly visible data is available.",
    };
  }
  return {
    authenticated: true,
    userId: principal.userId,
    email: principal.email,
    name: principal.name,
    profile: principal.profile,
    roles: principal.roles,
    campuses: principal.campusNames,
    departments: principal.departmentNames,
    managedCampuses: principal.managedCampuses,
    managedCampusIds: principal.managedCampusIds,
    resolvedCampusIds: principal.resolvedCampusIds,
    resolvedDepartmentIds: principal.resolvedDepartmentIds,
  };
}

/** The minimal shape of an Appwrite team membership this package reads. */
export type TeamLike = Pick<Models.Team<Models.Preferences>, "$id" | "name">;
