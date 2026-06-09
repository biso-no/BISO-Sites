import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { listDepartments } from "../../../_actions/departments";
import { getDepartmentRemediationPlan } from "../../../_actions/it-remediation";
import { PageHeader } from "../../../_components/page-header";
import { ItUsersTabs } from "../_components/it-users-tabs";
import { RemediationClient } from "../_components/remediation-client";

export default async function ItUsersAuditPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const [result, departments] = await Promise.all([
    getDepartmentRemediationPlan(),
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

      {result.data ? (
        <RemediationClient
          departmentNames={departmentNames}
          departmentToCampus={departmentToCampus}
          labels={{
            affectedUsers: t("audit.affectedUsers"),
            allClear: t("audit.allClear"),
            allClearDescription: t("audit.allClearDescription"),
            applied: t("audit.applied"),
            applyAllSafe: t("audit.applyAllSafe"),
            applyGroup: t("audit.applyGroup"),
            blankDepartment: t("audit.blankDepartment"),
            closed: t("audit.segments.closed"),
            closedDescription: t("audit.closedDescription"),
            noSuggestion: t("audit.noSuggestion"),
            review: t("audit.segments.review"),
            reviewDescription: t("audit.reviewDescription"),
            safe: t("audit.segments.safe"),
            safeDescription: t("audit.safeDescription"),
            selectDepartment: t("audit.selectDepartment"),
            suggestion: t("audit.suggestion"),
            summary: t("audit.summary", {
              compliant: result.data.compliantCount,
              flagged:
                result.data.safe.length +
                result.data.review.length +
                result.data.closed.length,
              total: result.data.totalScanned,
            }),
            writesWithOffice: t("audit.writesWithOffice"),
          }}
          plan={result.data}
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
