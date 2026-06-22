import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { getTranslations } from "next-intl/server";
import { getUserRolesForClient, requireAdminAccess } from "@/lib/authorization";
import { AdminShell } from "./_components/admin-shell";

type UserRoles = Awaited<ReturnType<typeof getUserRolesForClient>>;
type AuthContext = Awaited<ReturnType<typeof requireAdminAccess>>;

async function getRoleLabel(
  roles: UserRoles,
  ctx: AuthContext
): Promise<string> {
  const t = await getTranslations("admin.roles");
  if (roles.isGlobalAdmin) {
    return t("globalAdmin");
  }
  if (roles.isCampusAdmin) {
    return `${t("campusAdmin")} · ${ctx.managedCampuses[0] ?? ""}`;
  }
  return ctx.departmentNames[0] ?? t("member");
}

export default async function PortalAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAdminAccess();
  const roles = await getUserRolesForClient();
  const aiCopilotEnabled = await isFeatureEnabled("ai_admin_copilot");

  const user = {
    id: ctx.userId,
    name: null as string | null,
    email: null as string | null,
    avatar: null as string | null,
    roleLabel: await getRoleLabel(roles, ctx),
  };

  return (
    <AdminShell aiCopilotEnabled={aiCopilotEnabled} roles={roles} user={user}>
      {children}
    </AdminShell>
  );
}
