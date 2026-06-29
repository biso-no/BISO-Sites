"use client";

import type { ExpenseApprovalIssues } from "@repo/api/types/appwrite";
import { ExpenseApprovalIssuesStatus } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import {
  resendExpenseApprovalNotification,
  resolveExpenseApprovalIssue,
} from "../../../_actions/expense-approval-issues";
import { EmptyState } from "../../../_components/empty-state";

// Issues recorded when an approver couldn't be notified can be recovered by
// resending; they are tagged with this reason prefix (see expense-approval.ts).
const NOTIFICATION_FAILURE_PREFIX = "Could not notify";

interface Labels {
  columnCampus: string;
  columnCreated: string;
  columnDepartment: string;
  columnReason: string;
  columnRole: string;
  columnStatus: string;
  empty: string;
  emptyDescription: string;
  resend: string;
  resendError: string;
  resendSuccess: string;
  resolve: string;
  resolveError: string;
  resolveSuccess: string;
  statusOpen: string;
  statusResolved: string;
}

interface Props {
  issues: ExpenseApprovalIssues[];
  labels: Labels;
}

function campusName(campusId: string | null): string {
  if (!campusId) {
    return "—";
  }
  return CAMPUS_ID_TO_NAME[campusId] ?? campusId;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ExpenseApprovalIssuesClient({ issues, labels }: Props) {
  if (issues.length === 0) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<CheckCircle2 size={28} />}
        title={labels.empty}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">{labels.columnDepartment}</th>
            <th className="px-4 py-3 font-medium">{labels.columnCampus}</th>
            <th className="px-4 py-3 font-medium">{labels.columnRole}</th>
            <th className="px-4 py-3 font-medium">{labels.columnReason}</th>
            <th className="px-4 py-3 font-medium">{labels.columnCreated}</th>
            <th className="px-4 py-3 font-medium">{labels.columnStatus}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <IssueRow issue={issue} key={issue.$id} labels={labels} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IssueRow({
  issue,
  labels,
}: {
  issue: ExpenseApprovalIssues;
  labels: Labels;
}) {
  const [resolved, setResolved] = useState(
    issue.status === ExpenseApprovalIssuesStatus.RESOLVED
  );
  const [pending, startTransition] = useTransition();
  const canResend =
    Boolean(issue.expense_id) &&
    Boolean(issue.reason?.startsWith(NOTIFICATION_FAILURE_PREFIX));

  const onResolve = () => {
    startTransition(async () => {
      const result = await resolveExpenseApprovalIssue(issue.$id);
      if (result.success) {
        setResolved(true);
        toast.success(labels.resolveSuccess);
      } else {
        toast.error(result.error ?? labels.resolveError);
      }
    });
  };

  const onResend = () => {
    if (!issue.expense_id) {
      return;
    }
    startTransition(async () => {
      const result = await resendExpenseApprovalNotification(
        issue.$id,
        issue.expense_id as string
      );
      if (result.success) {
        setResolved(true);
        toast.success(labels.resendSuccess);
      } else {
        toast.error(result.error ?? labels.resendError);
      }
    });
  };

  return (
    <tr className="border-border border-t">
      <td className="px-4 py-3 font-medium">{issue.department ?? "—"}</td>
      <td className="px-4 py-3">{campusName(issue.campus_id)}</td>
      <td className="px-4 py-3">{issue.role_sought ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{issue.reason ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {formatDate(issue.$createdAt)}
      </td>
      <td className="px-4 py-3">
        {resolved ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
            <CheckCircle2 size={14} /> {labels.statusResolved}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
            <ShieldAlert size={14} /> {labels.statusOpen}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {resolved ? null : (
          <div className="flex justify-end gap-2">
            {canResend && (
              <Button
                disabled={pending}
                onClick={onResend}
                size="sm"
                variant="outline"
              >
                <RefreshCw size={14} /> {labels.resend}
              </Button>
            )}
            <Button
              disabled={pending}
              onClick={onResolve}
              size="sm"
              variant="outline"
            >
              {labels.resolve}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
