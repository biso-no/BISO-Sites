import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { listDepartments } from "../../../_actions/departments";
import { getLatestRemediationSnapshot } from "../../../_actions/it-remediation";
import { PageHeader } from "../../../_components/page-header";
import { ItUsersTabs } from "../_components/it-users-tabs";
import { RemediationClient } from "../_components/remediation-client";

// The analysis pass fans out to the AI for ~1800 users; give the run action room.
export const maxDuration = 300;

export default async function ItUsersAuditPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const [snapshotResult, departments] = await Promise.all([
    getLatestRemediationSnapshot(),
    listDepartments(),
  ]);

  const departmentNames = departments.map((d) => d.Name);
  const departmentToCampus: Record<string, string> = {};
  for (const d of departments) {
    if (d.campus?.name) {
      departmentToCampus[d.Name] = d.campus.name;
    }
  }

  return (
    <div className="pb-12">
      <PageHeader
        description={t("audit.description")}
        title={t("audit.title")}
      />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          users: t("users.tabs.users"),
        }}
      />

      {snapshotResult.error ? (
        <div
          className="rounded-2xl p-5 text-sm"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.20)",
            color: "#fca5a5",
          }}
        >
          {snapshotResult.error}
        </div>
      ) : (
        <RemediationClient
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          snapshot={snapshotResult.data ?? null}
        />
      )}
    </div>
  );
}
