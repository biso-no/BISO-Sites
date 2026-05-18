import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getUserAuthContext, getUserRolesForClient } from "@/lib/authorization";
import { AdminShell } from "./_components/admin-shell";

type UserRoles = Awaited<ReturnType<typeof getUserRolesForClient>>;
type AuthContext = NonNullable<Awaited<ReturnType<typeof getUserAuthContext>>>;

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
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }

  const roles = await getUserRolesForClient();

  const user = {
    id: ctx.userId,
    name: null as string | null,
    email: null as string | null,
    avatar: null as string | null,
    roleLabel: await getRoleLabel(roles, ctx),
  };

  return (
    <AdminShell roles={roles} user={user}>
      {children}
    </AdminShell>
  );
}
