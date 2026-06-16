import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { getDepartmentDataHealth } from "../../_actions/it-remediation";
import { PageHeader } from "../../_components/page-header";
import { ItUsersTabs } from "../users/_components/it-users-tabs";
import { DataHealthClient } from "./_components/data-health-client";

export default async function DataHealthPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const result = await getDepartmentDataHealth();

  return (
    <div className="pb-12">
      <PageHeader
        description={t("dataHealth.description")}
        title={t("dataHealth.title")}
      />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          users: t("users.tabs.users"),
        }}
      />

      {result.data ? (
        <DataHealthClient
          entries={result.data}
          labels={{
            columnCampus: t("dataHealth.column.campus"),
            columnIssues: t("dataHealth.column.issues"),
            columnName: t("dataHealth.column.name"),
            empty: t("dataHealth.empty"),
            emptyDescription: t("dataHealth.emptyDescription"),
            issues: {
              activeClosed: t("dataHealth.issues.activeClosed"),
              duplicateName: t("dataHealth.issues.duplicateName"),
              trailingWhitespace: t("dataHealth.issues.trailingWhitespace"),
            },
          }}
        />
      ) : (
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
      )}
    </div>
  );
}
