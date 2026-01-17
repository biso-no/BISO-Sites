/**
 * Role constants and navigation access rules.
 * Single source of truth for authorization across the admin application.
 *
 * Roles are derived from Azure AD Security Groups with naming pattern:
 * - SG-App-Role-GlobalAdmin → "globaladmin"
 * - SG-App-Role-Controller → "controller"
 * - SG-App-Role-Finance → "finance"
 * - SG-App-Role-HR → "hr"
 * - SG-App-Role-PR → "pr"
 *
 * Special pseudo-role:
 * - "department" → User belongs to at least one SG-App-Dept-* group
 */

// Standardized role names (derived from Azure AD SG-App-Role-* or computed from team combinations)
export const ROLES = {
  GLOBAL_ADMIN: "globaladmin",
  CAMPUS_ADMIN: "campusadmin", // Derived from Ledelsen{City} + Campus-{City}
  CONTROLLER: "controller",
  FINANCE: "finance",
  HR: "hr",
  PR: "pr",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// Pseudo-role for department members
export const DEPARTMENT_ROLE = "department" as const;

// All valid role values including pseudo-roles
export type RoleOrDepartment = Role | typeof DEPARTMENT_ROLE;

/**
 * Navigation access rules.
 * Each key maps to an array of roles that can access that navigation section.
 * "department" means any user with department team membership can access.
 */
export const NAV_ACCESS = {
  dashboard: [ROLES.GLOBAL_ADMIN],
  pages: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.PR, DEPARTMENT_ROLE],
  posts: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.PR, DEPARTMENT_ROLE],
  shop: [ROLES.GLOBAL_ADMIN, ROLES.FINANCE, ROLES.CONTROLLER],
  shopOrders: [ROLES.GLOBAL_ADMIN, ROLES.FINANCE],
  shopProducts: [ROLES.GLOBAL_ADMIN, ROLES.FINANCE],
  shopApprovalQueue: [ROLES.GLOBAL_ADMIN, ROLES.CONTROLLER, ROLES.FINANCE],
  shopCustomers: [ROLES.GLOBAL_ADMIN, ROLES.FINANCE],
  shopSettings: [ROLES.GLOBAL_ADMIN],
  expenses: [ROLES.GLOBAL_ADMIN, ROLES.FINANCE],
  jobs: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.HR, ROLES.PR, DEPARTMENT_ROLE],
  jobsApplications: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.HR, ROLES.PR],
  events: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.PR, DEPARTMENT_ROLE],
  eventsNew: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.PR, DEPARTMENT_ROLE],
  units: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.HR, ROLES.FINANCE, ROLES.PR],
  users: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, ROLES.HR, ROLES.FINANCE],
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

/**
 * Legacy role mapping for backwards compatibility during migration.
 * Maps old role names to new standardized names.
 */
export const LEGACY_ROLE_MAP: Record<string, Role> = {
  Admin: ROLES.GLOBAL_ADMIN,
  admin: ROLES.GLOBAL_ADMIN,
  "Control Committee": ROLES.CONTROLLER,
  controller: ROLES.CONTROLLER,
  finance: ROLES.FINANCE,
  Finance: ROLES.FINANCE,
  hr: ROLES.HR,
  HR: ROLES.HR,
  pr: ROLES.PR,
  PR: ROLES.PR,
};

/**
 * Convert legacy role names to standardized roles.
 */
export function normalizeLegacyRole(role: string): string {
  return LEGACY_ROLE_MAP[role] || role.toLowerCase();
}
