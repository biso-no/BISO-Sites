"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import { requireAuth } from "@/lib/authorization";
import { applyScopeQueries } from "@/lib/utils/authorization";

export interface InboxCounts {
  approvals: number;
  submissions: number;
  total: number;
}

export async function getInboxCounts(): Promise<InboxCounts> {
  const ctx = await requireAuth();
  const isApprover =
    ctx.roles.includes("globaladmin") || ctx.roles.includes("campusadmin");
  if (!isApprover) {
    return { approvals: 0, submissions: 0, total: 0 };
  }

  const { db } = await createSessionClient();

  // Approvals rely on Appwrite row permissions (approver team); mirror the
  // campus-switcher filter used by listPendingApprovals.
  const approvalQueries = [Query.equal("status", "pending"), Query.limit(1)];
  if (ctx.activeCampusId) {
    approvalQueries.push(Query.equal("campus_id", [ctx.activeCampusId]));
  }

  const submissionQueries = [
    Query.equal("status", "new"),
    Query.limit(1),
    // form_submissions is campus-scoped only (no department column)
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];

  const [approvals, submissions] = await Promise.allSettled([
    db.listRows("app", "approval_requests", approvalQueries),
    db.listRows("app", "form_submissions", submissionQueries),
  ]);

  const approvalCount =
    approvals.status === "fulfilled" ? approvals.value.total : 0;
  const submissionCount =
    submissions.status === "fulfilled" ? submissions.value.total : 0;
  return {
    approvals: approvalCount,
    submissions: submissionCount,
    total: approvalCount + submissionCount,
  };
}
