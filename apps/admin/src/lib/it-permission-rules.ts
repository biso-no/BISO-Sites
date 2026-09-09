import type { M365Permission } from "@repo/shared/types/user-management";
import type { UserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";

// Pure IT authorization rules, kept free of runtime imports from
// lib/authorization (a "use server" module that reaches for Appwrite at import
// time) so they can be reasoned about and unit-tested on their own.

export type ItPermissionMap = Record<M365Permission, boolean>;

/**
 * Campus names a user may act on in IT admin, or `null` for unrestricted
 * (global admin). BISO stores the campus on the M365 `officeLocation`
 * attribute, so these values are matched against `officeLocation` — see
 * `isWithinCampusScope` in `lib/it/tenant-guard.ts`.
 */
export type ItCampusScope = string[] | null;

export const IT_PERMISSIONS: M365Permission[] = [
  "it.users.view",
  "it.users.create",
  "it.users.editProfile",
  "it.users.disable",
  "it.users.manageAliases",
  "it.users.transferAlias",
  "it.users.manageManagers",
  "it.users.manageGroups",
  "it.users.manageLicenses",
  "it.users.resetMfa",
  "it.users.revokeSessions",
  "it.users.viewSecurity",
  "it.users.resetPassword",
  "it.users.turnover",
  "it.tenant.audit",
];

/**
 * Read-only per-user permissions a campus admin holds, scoped to the campuses
 * they manage. Every mutating operation and all tenant-wide tooling stays
 * global-admin only.
 */
const CAMPUS_ADMIN_PERMISSIONS = new Set<M365Permission>([
  "it.users.view",
  "it.users.viewSecurity",
]);

function isGlobalAdmin(ctx: UserAuthContext): boolean {
  return ctx.roles.includes(ROLES.GLOBAL_ADMIN);
}

function isScopedCampusAdmin(ctx: UserAuthContext): boolean {
  return (
    ctx.roles.includes(ROLES.CAMPUS_ADMIN) && ctx.managedCampuses.length > 0
  );
}

/**
 * Campuses the context may act on. Global admins are unrestricted (`null`);
 * campus admins are limited to the campuses they manage. Anyone else resolves
 * to an empty list, which matches no account.
 */
export function getItCampusScope(ctx: UserAuthContext): ItCampusScope {
  if (isGlobalAdmin(ctx)) {
    return null;
  }
  return ctx.managedCampuses;
}

export function getItPermissions(ctx: UserAuthContext): ItPermissionMap {
  const globalAdmin = isGlobalAdmin(ctx);
  const campusAdmin = !globalAdmin && isScopedCampusAdmin(ctx);

  return Object.fromEntries(
    IT_PERMISSIONS.map((permission) => [
      permission,
      globalAdmin || (campusAdmin && CAMPUS_ADMIN_PERMISSIONS.has(permission)),
    ])
  ) as ItPermissionMap;
}

export function noItPermissions(): ItPermissionMap {
  return Object.fromEntries(
    IT_PERMISSIONS.map((permission) => [permission, false])
  ) as ItPermissionMap;
}
