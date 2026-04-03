/**
 * Role constants and navigation access rules.
 * Single source of truth for authorization across the admin application.
 *
 * Roles are derived entirely from Azure AD Security Group combinations:
 * - SG-App-Campus-National + SG-App-Dept-OperationsUnit → "globaladmin"
 * - SG-App-Campus-{City} + SG-App-Dept-Ledelsen{City}  → "campusadmin"
 *
 * Special pseudo-role:
 * - "department" → User belongs to at least one SG-App-Dept-* group
 *
 * SG-App-Role-* groups (finance, hr, pr, controller) are no longer used.
 * All access is derived from campus + department team membership.
 */

// Roles computed from campus + department team combinations
export const ROLES = {
  GLOBAL_ADMIN: "globaladmin", // National + OperationsUnit
  CAMPUS_ADMIN: "campusadmin", // Ledelsen{City} + Campus-{City}
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Pseudo-role for any user with at least one SG-App-Dept-* membership
export const DEPARTMENT_ROLE = "department" as const;

// All valid role values including pseudo-roles
export type RoleOrDepartment = Role | typeof DEPARTMENT_ROLE;

/**
 * Navigation access rules based on campus + department membership.
 *
 * - globaladmin: full access everywhere
 * - campusadmin: full access within their campus
 * - department: any department member (scoped by applyScopeQueries at data layer)
 */
export const NAV_ACCESS = {
  dashboard: [ROLES.GLOBAL_ADMIN],
  content: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  pages: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  posts: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  shop: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  shopOrders: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  shopProducts: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  shopApprovalQueue: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  shopCustomers: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  shopSettings: [ROLES.GLOBAL_ADMIN],
  expenses: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  jobs: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  jobsApplications: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  events: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  eventsNew: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  units: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  users: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  varsling: [ROLES.GLOBAL_ADMIN],
  settings: [ROLES.GLOBAL_ADMIN],
  settingsProfile: [ROLES.GLOBAL_ADMIN],
  settingsSecurity: [ROLES.GLOBAL_ADMIN],
} as const;

export type NavKey = keyof typeof NAV_ACCESS;

/**
 * Check if a set of user roles/pseudo-roles grants access to a navigation item.
 */
export function hasNavAccess(
  navKey: NavKey,
  userRoles: string[],
  hasDepartmentMembership: boolean
): boolean {
  const requiredRoles = NAV_ACCESS[navKey];

  for (const role of requiredRoles) {
    if (role === DEPARTMENT_ROLE) {
      if (hasDepartmentMembership) {
        return true;
      }
    } else if (userRoles.includes(role)) {
      return true;
    }
  }

  return false;
}
