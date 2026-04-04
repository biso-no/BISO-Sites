/**
 * Permission builder utilities for setting $permissions on Appwrite documents.
 * These are pure, synchronous functions - NOT server actions.
 *
 * Authorization is team-based only (SG-App-Dept-* teams).
 * Campus teams (SG-App-Campus-*) are NEVER included in permissions — they
 * exist only for authorization context, not for Appwrite ACLs.
 *
 * Campus management teams (Ledelsen{City}) are always included when a
 * campusManagementTeamId is provided, replacing the former team:admin override.
 */

import { Permission, Role } from "@repo/api";
import type { PageVisibility } from "@repo/api/types/appwrite";

/**
 * Build status-aware permissions for any content row (events, jobs, news, webshop_products).
 *
 * - published  -> read("any") so the public web app can read without auth
 * - draft/other -> read restricted to the owning dept team and campus mgmt team
 * - update/delete always restricted to dept team and campus mgmt team (when provided)
 */
export function buildContentPermissions(input: {
  status: string;
  departmentTeamId?: string | null;
  campusManagementTeamId?: string | null;
}): string[] {
  const permissions: string[] = [];

  if (input.status === "published") {
    permissions.push(Permission.read(Role.any()));
  } else {
    if (input.departmentTeamId) {
      permissions.push(Permission.read(Role.team(input.departmentTeamId)));
    }
    if (input.campusManagementTeamId) {
      permissions.push(
        Permission.read(Role.team(input.campusManagementTeamId))
      );
    }
  }

  if (input.departmentTeamId) {
    permissions.push(Permission.update(Role.team(input.departmentTeamId)));
    permissions.push(Permission.delete(Role.team(input.departmentTeamId)));
  }
  if (input.campusManagementTeamId) {
    permissions.push(
      Permission.update(Role.team(input.campusManagementTeamId))
    );
    permissions.push(
      Permission.delete(Role.team(input.campusManagementTeamId))
    );
  }

  return permissions;
}

/**
 * Build permissions for a page row.
 * Pages are always publicly readable; write access is scoped to the owning
 * dept team and campus management team.
 */
export function buildPagePermissions(input: {
  departmentTeamId?: string | null;
  campusManagementTeamId?: string | null;
}): string[] {
  const permissions: string[] = [Permission.read(Role.any())];

  if (input.departmentTeamId) {
    permissions.push(Permission.update(Role.team(input.departmentTeamId)));
    permissions.push(Permission.delete(Role.team(input.departmentTeamId)));
  }
  if (input.campusManagementTeamId) {
    permissions.push(
      Permission.update(Role.team(input.campusManagementTeamId))
    );
    permissions.push(
      Permission.delete(Role.team(input.campusManagementTeamId))
    );
  }

  return permissions;
}

/**
 * @deprecated Use buildPagePermissions({ departmentTeamId }) instead.
 * Kept for any callers not yet migrated.
 */
function buildDepartmentPagePermissions(
  departmentTeamId: string,
  campusManagementTeamId?: string | null
): string[] {
  return buildPagePermissions({ departmentTeamId, campusManagementTeamId });
}

/**
 * @deprecated Use buildPagePermissions({ departmentTeamId, campusManagementTeamId }) instead.
 * Campus teams no longer receive Appwrite permissions.
 */
function buildCampusPagePermissions(
  _campusTeamId: string,
  campusManagementTeamId?: string | null
): string[] {
  return buildPagePermissions({ campusManagementTeamId });
}

/**
 * Build permissions for a product pending approval.
 * Dept team gets read + update; campus mgmt team gets read for the approval workflow.
 */
function buildPendingProductPermissions(
  departmentTeamId: string,
  campusManagementTeamId: string
): string[] {
  return [
    Permission.read(Role.team(departmentTeamId)),
    Permission.read(Role.team(campusManagementTeamId)),
    Permission.update(Role.team(departmentTeamId)),
    Permission.update(Role.team(campusManagementTeamId)),
  ];
}

/**
 * Build permissions for a published product
 */
function buildPublishedProductPermissions(): string[] {
  return [Permission.read(Role.any())];
}

function buildEditorialTemplatePermissions(): string[] {
  return [Permission.read(Role.users())];
}

function buildEditorialEntryPermissions(input: {
  visibility: PageVisibility;
  userId?: string | null;
  campusManagementTeamId?: string | null;
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

  if (input.campusManagementTeamId) {
    permissions.push(
      Permission.update(Role.team(input.campusManagementTeamId))
    );
    permissions.push(
      Permission.delete(Role.team(input.campusManagementTeamId))
    );
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
 */
function buildDepartmentRowPermissions(
  departmentTeamId: string
): string[] {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.team(departmentTeamId)),
    Permission.delete(Role.team(departmentTeamId)),
  ];
}

/**
 * Build permissions for a campus benefit row.
 *
 * - published  → read("any") so the web app can fetch benefits publicly
 * - draft/archived → read restricted to campus management team only
 * - update/delete always restricted to campus management team
 *
 * Global admins manage National benefits — pass their team id as
 * campusManagementTeamId (or omit if handled via Appwrite admin API key).
 */
export function buildBenefitPermissions(input: {
  status: string;
  campusManagementTeamId?: string | null;
}): string[] {
  const permissions: string[] = [];

  if (input.status === "published") {
    permissions.push(Permission.read(Role.any()));
  } else if (input.campusManagementTeamId) {
    permissions.push(Permission.read(Role.team(input.campusManagementTeamId)));
  }

  if (input.campusManagementTeamId) {
    permissions.push(
      Permission.update(Role.team(input.campusManagementTeamId))
    );
    permissions.push(
      Permission.delete(Role.team(input.campusManagementTeamId))
    );
  }

  return permissions;
}
