import { redirect } from "next/navigation";
import { getUserAuthContext, getUserRolesForClient } from "@/lib/authorization";
import { AdminShell } from "./_components/admin-shell";

type UserRoles = Awaited<ReturnType<typeof getUserRolesForClient>>;
type AuthContext = NonNullable<Awaited<ReturnType<typeof getUserAuthContext>>>;

function getRoleLabel(roles: UserRoles, ctx: AuthContext): string {
  if (roles.isGlobalAdmin) {
    return "Global Admin";
  }
  if (roles.isCampusAdmin) {
    return `Campus Admin · ${ctx.managedCampuses[0] ?? ""}`;
  }
  return ctx.departmentNames[0] ?? "Member";
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
    roleLabel: getRoleLabel(roles, ctx),
  };

  return (
    <AdminShell roles={roles} user={user}>
      {children}
    </AdminShell>
  );
}
