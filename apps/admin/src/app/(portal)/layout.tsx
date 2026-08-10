import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { getTranslations } from "next-intl/server";
import { getUserRolesForClient, requireAdminAccess } from "@/lib/authorization";
import { getInboxCounts } from "./_actions/inbox";
import { AdminShell } from "./_components/admin-shell";
import { InboxRealtimeProvider } from "./_components/inbox-realtime-provider";

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
  // Badge counts are best-effort — never block the layout on them.
  const inboxCounts = await getInboxCounts().catch(() => ({
    approvals: 0,
    submissions: 0,
    total: 0,
  }));

  const user = {
    id: ctx.userId,
    name: null as string | null,
    email: null as string | null,
    avatar: null as string | null,
    roleLabel: await getRoleLabel(roles, ctx),
  };

  return (
    <InboxRealtimeProvider
      activeCampusId={ctx.activeCampusId ?? null}
      initialCounts={inboxCounts}
      isApprover={roles.isGlobalAdmin || roles.isCampusAdmin}
    >
      <AdminShell
        aiCopilotEnabled={aiCopilotEnabled}
        inboxCount={inboxCounts.total}
        roles={roles}
        user={user}
      >
        {children}
      </AdminShell>
    </InboxRealtimeProvider>
  );
}
