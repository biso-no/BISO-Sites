import { redirect } from "next/navigation";
import {
  getUserAuthContext,
  getUserRolesForClient,
} from "@/lib/authorization";
import { AdminShell } from "./_components/admin-shell";

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
    roleLabel: roles.isGlobalAdmin
      ? "Global Admin"
      : roles.isCampusAdmin
        ? `Campus Admin · ${ctx.managedCampuses[0] ?? ""}`
        : ctx.departmentNames[0] ?? "Member",
  };

  return (
    <AdminShell user={user} roles={roles}>
      {children}
    </AdminShell>
  );
}
