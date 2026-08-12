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
  HR: "hr", // Membership in the HR department (normalized team name "hr")
} as const;

// Pseudo-role for any user with at least one SG-App-Dept-* membership
export const DEPARTMENT_ROLE = "department" as const;

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
  // Recruitment is HR-exclusive with global-admin break-glass access; campus
  // management and non-HR departments get no jobs/applicant surface.
  jobs: [ROLES.GLOBAL_ADMIN, ROLES.HR],
  jobsApplications: [ROLES.GLOBAL_ADMIN, ROLES.HR],
  events: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  eventsNew: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  units: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  users: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  varsling: [ROLES.GLOBAL_ADMIN],
  settings: [ROLES.GLOBAL_ADMIN],
  settingsProfile: [ROLES.GLOBAL_ADMIN],
  settingsSecurity: [ROLES.GLOBAL_ADMIN],
  // Membership & Benefits
  membership: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  benefits: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  benefitsPartners: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  benefitsAnalytics: [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  // New admin portal (/admin/*) nav keys.
  // General publishing surfaces (pages, news, events, shop products, benefits,
  // communications, documents) are open to department members; the data layer
  // scopes them to their own campus + department via ownership relationships.
  "portal.dashboard": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  "portal.pages": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.departments": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  // Recruitment stays HR-only with global break-glass — the broad department
  // pseudo-role must never open jobs or applicant data.
  "portal.jobs": [ROLES.GLOBAL_ADMIN, ROLES.HR],
  "portal.events": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.shop": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.benefits": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.benefitsPartners": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  "portal.news": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.communications": [
    ROLES.GLOBAL_ADMIN,
    ROLES.CAMPUS_ADMIN,
    DEPARTMENT_ROLE,
  ],
  "portal.activity": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  "portal.drafts": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
  "portal.settings": [ROLES.GLOBAL_ADMIN],
  "portal.documents": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN, DEPARTMENT_ROLE],
  "portal.it": [ROLES.GLOBAL_ADMIN],
  "portal.analytics": [ROLES.GLOBAL_ADMIN],
  "portal.inbox": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
} as const;

export type NavKey = keyof typeof NAV_ACCESS;

/**
 * Order/customer operations are commerce surfaces, not publishing surfaces:
 * department product authors may manage their catalog but never see orders.
 */
export function canViewShopOperations(userRoles: string[]): boolean {
  return (
    userRoles.includes(ROLES.GLOBAL_ADMIN) ||
    userRoles.includes(ROLES.CAMPUS_ADMIN)
  );
}

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
