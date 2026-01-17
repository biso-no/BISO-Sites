/**
 * Permission builder utilities for setting $permissions on Appwrite documents.
 * These are pure, synchronous functions - NOT server actions.
 */

import { Permission, Role } from "@repo/api";

/**
 * Build permissions for a department-owned page
 */
export function buildDepartmentPagePermissions(
  departmentTeamId: string
): string[] {
  return [
    Permission.read(Role.any()), // Public can read
    Permission.update(Role.team(departmentTeamId)), // Department can edit
    Permission.delete(Role.team(departmentTeamId)),
    Permission.update(Role.label("globaladmin")), // Global admins can edit
    Permission.delete(Role.label("globaladmin")),
  ];
}

/**
 * Build permissions for a campus-owned page
 */
export function buildCampusPagePermissions(campusTeamId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.team(campusTeamId)),
    Permission.delete(Role.team(campusTeamId)),
    Permission.update(Role.label("globaladmin")),
    Permission.delete(Role.label("globaladmin")),
  ];
}

/**
 * Build permissions for a product pending approval
 */
export function buildPendingProductPermissions(
  departmentTeamId: string,
  campusTeamId: string
): string[] {
  return [
    Permission.read(Role.team(departmentTeamId)), // Department can see their product
    Permission.read(Role.team(campusTeamId)), // Campus controllers can see for approval
    Permission.update(Role.team(departmentTeamId)), // Department can edit
    Permission.update(Role.label("controller")), // Controllers can approve
    Permission.update(Role.label("globaladmin")),
    Permission.delete(Role.label("globaladmin")),
  ];
}

/**
 * Build permissions for a published product
 */
export function buildPublishedProductPermissions(): string[] {
  return [
    Permission.read(Role.any()), // Public can read
    Permission.update(Role.label("admin")),
    Permission.update(Role.label("globaladmin")),
    Permission.delete(Role.label("globaladmin")),
  ];
}
