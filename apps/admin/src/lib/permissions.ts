/**
 * Permission builder utilities for setting $permissions on Appwrite documents.
 * These are pure, synchronous functions - NOT server actions.
 *
 * Authorization is team-based only (SG-App-Campus-* and SG-App-Dept-* teams).
 * Admin override is handled by table-level update/delete("team:admin") — no
 * Role.label() entries are needed on individual rows.
 */

import { Permission, Role } from "@repo/api";
import type { PageVisibility } from "@repo/api/types/appwrite";

/**
 * Build status-aware permissions for any content document (events, jobs, news, webshop_products).
 *
 * - published → read("any") so the public web app can read without auth
 * - draft/other → read restricted to the owning team(s)
 * - Write (update/delete) always restricted to the owning team(s)
 *   Admin override is handled by table-level team:admin permissions.
 */
export function buildContentPermissions(input: {
  status: string;
  departmentTeamId?: string | null;
  campusTeamId?: string | null;
}): string[] {
  const permissions: string[] = [];

  if (input.status === "published") {
    permissions.push(Permission.read(Role.any()));
  } else {
    if (input.departmentTeamId) {
      permissions.push(Permission.read(Role.team(input.departmentTeamId)));
    }
    if (input.campusTeamId) {
      permissions.push(Permission.read(Role.team(input.campusTeamId)));
    }
  }

  if (input.departmentTeamId) {
    permissions.push(Permission.update(Role.team(input.departmentTeamId)));
    permissions.push(Permission.delete(Role.team(input.departmentTeamId)));
  }
  if (input.campusTeamId) {
    permissions.push(Permission.update(Role.team(input.campusTeamId)));
    permissions.push(Permission.delete(Role.team(input.campusTeamId)));
  }

  return permissions;
}

/**
 * Build permissions for a department-owned page
 */
export function buildDepartmentPagePermissions(
  departmentTeamId: string
): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.team(departmentTeamId)),
    Permission.delete(Role.team(departmentTeamId)),
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
  ];
}

/**
 * Build permissions for a product pending approval.
 * Campus team gets read (for approval workflow) and department gets read+update.
 */
export function buildPendingProductPermissions(
  departmentTeamId: string,
  campusTeamId: string
): string[] {
  return [
    Permission.read(Role.team(departmentTeamId)),
    Permission.read(Role.team(campusTeamId)),
    Permission.update(Role.team(departmentTeamId)),
    Permission.update(Role.team(campusTeamId)),
  ];
}

/**
 * Build permissions for a published product
 */
export function buildPublishedProductPermissions(): string[] {
  return [
    Permission.read(Role.any()),
  ];
}

export function buildEditorialTemplatePermissions(): string[] {
  return [
    Permission.read(Role.users()),
  ];
}

export function buildEditorialEntryPermissions(input: {
  visibility: PageVisibility;
  userId?: string | null;
  campusTeamId?: string | null;
  departmentTeamId?: string | null;
}): string[] {
  const permissions: string[] = [
    input.visibility === "authenticated"
      ? Permission.read(Role.users())
      : Permission.read(Role.any()),
  ];

  if (input.departmentTeamId) {
    permissions.push(Permission.update(Role.team(input.departmentTeamId)));
    permissions.push(Permission.delete(Role.team(input.departmentTeamId)));
  }

  if (input.campusTeamId) {
    permissions.push(Permission.update(Role.team(input.campusTeamId)));
    permissions.push(Permission.delete(Role.team(input.campusTeamId)));
  }

  if (input.userId) {
    permissions.push(Permission.update(Role.user(input.userId)));
    permissions.push(Permission.delete(Role.user(input.userId)));
  }

  return permissions;
}

/**
 * Build permissions for a department row in the departments table.
 * Table-level read("any") already grants public read; row-level permissions
 * only need to cover write access for the matching SG-App-Dept team.
 * Admin override comes from table-level update/delete("team:admin").
 */
export function buildDepartmentRowPermissions(departmentTeamId: string): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.team(departmentTeamId)),
    Permission.delete(Role.team(departmentTeamId)),
  ];
}
