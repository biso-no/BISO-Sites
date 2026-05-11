import type { M365Permission } from "@repo/shared/types/user-management";
import { notFound, redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";

export type ItPermissionMap = Record<M365Permission, boolean>;

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
];

function isGlobalAdmin(ctx: UserAuthContext): boolean {
  return ctx.roles.includes("globaladmin");
}

export function getItPermissions(ctx: UserAuthContext): ItPermissionMap {
  const canUseIt = isGlobalAdmin(ctx);

  return {
    "it.users.view": canUseIt,
    "it.users.create": canUseIt,
    "it.users.editProfile": canUseIt,
    "it.users.disable": canUseIt,
    "it.users.manageAliases": canUseIt,
    "it.users.transferAlias": canUseIt,
    "it.users.manageManagers": canUseIt,
    "it.users.manageGroups": canUseIt,
    "it.users.manageLicenses": canUseIt,
    "it.users.resetMfa": canUseIt,
    "it.users.revokeSessions": canUseIt,
    "it.users.viewSecurity": canUseIt,
    "it.users.resetPassword": canUseIt,
  };
}

export async function getCurrentItPermissions(): Promise<ItPermissionMap> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return Object.fromEntries(
      IT_PERMISSIONS.map((permission) => [permission, false])
    ) as ItPermissionMap;
  }

  return getItPermissions(ctx);
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
