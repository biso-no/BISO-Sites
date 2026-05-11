import { getTranslations } from "next-intl/server";
import { searchM365Users } from "../../_actions/it-users";
import { PageHeader } from "../../_components/page-header";
import { UsersListClient } from "./_components/users-list-client";

interface ItUsersPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function ItUsersPage({ searchParams }: ItUsersPageProps) {
  const t = await getTranslations("adminPortal.it.users");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const result = await searchM365Users({ query, limit: query ? 25 : 20 });

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />

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
          initialQuery={query}
          labels={{
            create: t("create"),
            empty: t("empty"),
            emptyDescription: t("emptyDescription"),
            searchPlaceholder: t("searchPlaceholder"),
            statusDisabled: t("status.disabled"),
            statusEnabled: t("status.enabled"),
            statusUnknown: t("status.unknown"),
          }}
          users={result.data ?? []}
        />
      )}
    </div>
  );
}
