import { getTranslations } from "next-intl/server";
import {
  getCurrentItPermissions,
  requireItPagePermission,
} from "@/lib/it-permissions";
import { searchM365Users } from "../../_actions/it-users";
import { PageHeader } from "../../_components/page-header";
import { ItUsersTabs } from "./_components/it-users-tabs";
import { UsersListClient } from "./_components/users-list-client";

interface ItUsersPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ItUsersPage({ searchParams }: ItUsersPageProps) {
  const ctx = await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it.users");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const [result, permissions] = await Promise.all([
    searchM365Users({ query, limit: query ? 25 : 20 }),
    getCurrentItPermissions(),
  ]);

  // Campus admins see only their own campuses; name them so the shorter list
  // reads as a deliberate filter rather than missing data.
  const scopedCampuses = permissions["it.tenant.audit"]
    ? []
    : ctx.managedCampuses;

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <ItUsersTabs
        labels={{
          audit: t("tabs.audit"),
          dataHealth: t("tabs.dataHealth"),
          expenseApprovals: t("tabs.expenseApprovals"),
          users: t("tabs.users"),
        }}
        showTenantTools={permissions["it.tenant.audit"]}
      />

      {result.error ? (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {result.error}
        </div>
      ) : (
        <UsersListClient
          canCreate={permissions["it.users.create"]}
          initialQuery={query}
          labels={{
            campusScope: t("campusScope"),
            create: t("create"),
            empty: t("empty"),
            emptyDescription: t("emptyDescription"),
            searchPlaceholder: t("searchPlaceholder"),
            statusDisabled: t("status.disabled"),
            statusEnabled: t("status.enabled"),
            statusUnknown: t("status.unknown"),
          }}
          scopedCampuses={scopedCampuses}
          users={result.data ?? []}
        />
      )}
    </div>
  );
}
