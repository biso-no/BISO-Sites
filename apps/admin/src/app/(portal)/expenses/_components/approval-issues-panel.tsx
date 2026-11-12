"use client";

import { ExpenseApprovalIssuesStatus } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CAMPUS_ID_TO_NAME } from "@/lib/campus-constants";
import {
  type ExpenseApprovalIssueRow,
  resendExpenseApprovalNotification,
  resolveExpenseApprovalIssue,
} from "../issues-actions";

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
  resend: string;
  resendError: string;
  resendSuccess: string;
  resolve: string;
  resolveError: string;
  resolveSuccess: string;
  statusOpen: string;
  statusResolved: string;
  title: string;
}

interface Props {
  issues: ExpenseApprovalIssueRow[];
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

export function ApprovalIssuesPanel({ issues, labels }: Props) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-medium text-sm">{labels.title}</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">
                {labels.columnDepartment}
              </th>
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
    </section>
  );
}

function IssueRow({
  issue,
  labels,
}: {
  issue: ExpenseApprovalIssueRow;
  labels: Labels;
}) {
  const [resolved, setResolved] = useState(
    issue.status === ExpenseApprovalIssuesStatus.RESOLVED
  );
  const [pending, startTransition] = useTransition();
  const canResend =
    issue.canAct &&
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
    startTransition(async () => {
      const result = await resendExpenseApprovalNotification(issue.$id);
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
        {resolved || !issue.canAct ? null : (
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
