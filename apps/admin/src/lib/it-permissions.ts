import type { M365Permission } from "@repo/shared/types/user-management";
import { notFound, redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  getItCampusScope,
  getItPermissions,
  type ItCampusScope,
  noItPermissions,
} from "@/lib/it-permission-rules";

// The rules themselves live in lib/it-permission-rules.ts; this module binds
// them to the request's auth context.
export {
  getItCampusScope,
  getItPermissions,
  IT_PERMISSIONS,
  type ItCampusScope,
  type ItPermissionMap,
} from "@/lib/it-permission-rules";

export async function getCurrentItPermissions() {
  const ctx = await getUserAuthContext();
  return ctx ? getItPermissions(ctx) : noItPermissions();
}

export async function requireItPermission(
  permission: M365Permission
): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }

  const permissions = getItPermissions(ctx);
  if (!permissions[permission]) {
    throw new Error("Forbidden");
  }

  return ctx;
}

/**
 * Server-action guard for anything that touches a specific M365 user: returns
 * the campus scope alongside the context so callers can pass it into
 * `getAllowedTenantUser` and refuse users outside the caller's campuses.
 */
export async function requireItScopedPermission(
  permission: M365Permission
): Promise<{ campusScope: ItCampusScope; ctx: UserAuthContext }> {
  const ctx = await requireItPermission(permission);
  return { campusScope: getItCampusScope(ctx), ctx };
}

export async function requireItPagePermission(
  permission: M365Permission
): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }

  const permissions = getItPermissions(ctx);
  if (!permissions[permission]) {
    notFound();
  }

  return ctx;
}
