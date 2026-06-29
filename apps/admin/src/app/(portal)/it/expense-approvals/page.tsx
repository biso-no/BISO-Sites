import { getTranslations } from "next-intl/server";
import { requireItPagePermission } from "@/lib/it-permissions";
import { listExpenseApprovalIssues } from "../../_actions/expense-approval-issues";
import { PageHeader } from "../../_components/page-header";
import { ItUsersTabs } from "../users/_components/it-users-tabs";
import { ExpenseApprovalIssuesClient } from "./_components/expense-approval-issues-client";

export default async function ExpenseApprovalIssuesPage() {
  await requireItPagePermission("it.users.view");
  const t = await getTranslations("adminPortal.it");
  const result = await listExpenseApprovalIssues();

  return (
    <div className="pb-12">
      <PageHeader
        description={t("expenseApprovals.description")}
        title={t("expenseApprovals.title")}
      />
      <ItUsersTabs
        labels={{
          audit: t("users.tabs.audit"),
          dataHealth: t("users.tabs.dataHealth"),
          expenseApprovals: t("users.tabs.expenseApprovals"),
          users: t("users.tabs.users"),
        }}
      />

      {result.data ? (
        <ExpenseApprovalIssuesClient
          issues={result.data}
          labels={{
            columnCampus: t("expenseApprovals.column.campus"),
            columnCreated: t("expenseApprovals.column.created"),
            columnDepartment: t("expenseApprovals.column.department"),
            columnReason: t("expenseApprovals.column.reason"),
            columnRole: t("expenseApprovals.column.role"),
            columnStatus: t("expenseApprovals.column.status"),
            empty: t("expenseApprovals.empty"),
            emptyDescription: t("expenseApprovals.emptyDescription"),
            resolve: t("expenseApprovals.resolve"),
            resolveError: t("expenseApprovals.resolveError"),
            resolveSuccess: t("expenseApprovals.resolveSuccess"),
            resend: t("expenseApprovals.resend"),
            resendError: t("expenseApprovals.resendError"),
            resendSuccess: t("expenseApprovals.resendSuccess"),
            statusOpen: t("expenseApprovals.status.open"),
            statusResolved: t("expenseApprovals.status.resolved"),
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
