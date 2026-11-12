"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovalIssues,
  ExpenseApprovalIssuesStatus,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { getUserAuthContext } from "@/lib/authorization";
import {
  canActOnApprovalIssue,
  type ExpenseViewer,
  issueCampusScope,
} from "@/lib/expense-access";
import { getExpenseViewer } from "@/lib/expense-viewer";
import { callExpensesApi } from "@/lib/expenses-api";
import { logAuditEvent } from "../_actions/audit-log";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export type ExpenseApprovalIssueRow = ExpenseApprovalIssues & {
  /** Whether the viewer may resolve or re-send this issue. */
  canAct: boolean;
};

const ISSUES_TABLE = "expense_approval_issues";
const LIST_LIMIT = 200;
const FORBIDDEN = "You do not have access to this approval issue.";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/** Lists approval-routing issues the viewer can see, open ones first. */
export async function listExpenseApprovalIssues(): Promise<
  ActionResult<ExpenseApprovalIssueRow[]>
> {
  try {
    const viewer = await getExpenseViewer();
    if (!viewer) {
      return { error: FORBIDDEN };
    }
    const scope = issueCampusScope(viewer);
    if (scope?.length === 0) {
      return { error: FORBIDDEN };
    }
    const { db } = await createAdminClient();
    const result = await db.listRows<ExpenseApprovalIssues>(
      "app",
      ISSUES_TABLE,
      [
        ...(scope ? [Query.equal("campus_id", scope)] : []),
        Query.orderDesc("$createdAt"),
        Query.limit(LIST_LIMIT),
      ]
    );
    // Open issues first, then most recent.
    const rows = result.rows
      .map((row) => ({
        ...row,
        canAct: canActOnApprovalIssue(viewer, row.campus_id),
      }))
      .sort((a, b) => {
        const aOpen = a.status !== ExpenseApprovalIssuesStatus.RESOLVED;
        const bOpen = b.status !== ExpenseApprovalIssuesStatus.RESOLVED;
        if (aOpen !== bOpen) {
          return aOpen ? -1 : 1;
        }
        return b.$createdAt.localeCompare(a.$createdAt);
      });
    return { data: rows };
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}

/** Loads the issue and checks the viewer may act on it. */
async function loadActionableIssue(issueId: string): Promise<{
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
  issue: ExpenseApprovalIssues;
  viewer: ExpenseViewer;
} | null> {
  const viewer = await getExpenseViewer();
  if (!viewer) {
    return null;
  }
  const { db } = await createAdminClient();
  const issue = await db.getRow<ExpenseApprovalIssues>(
    "app",
    ISSUES_TABLE,
    issueId
  );
  return canActOnApprovalIssue(viewer, issue.campus_id)
    ? { db, issue, viewer }
    : null;
}

async function markResolved(
  loaded: NonNullable<Awaited<ReturnType<typeof loadActionableIssue>>>,
  action: string
): Promise<void> {
  const { db, issue, viewer } = loaded;
  await db.updateRow("app", ISSUES_TABLE, issue.$id, {
    status: ExpenseApprovalIssuesStatus.RESOLVED,
    resolved_by: viewer.accountEmail ?? viewer.userId,
    resolved_at: new Date().toISOString(),
  });
  const ctx = await getUserAuthContext();
  if (ctx) {
    await logAuditEvent(ctx, action, {
      resourceId: issue.$id,
      resourceType: "expense_approval_issue",
    });
  }
  revalidatePath("/expenses");
}

/** Marks an issue resolved after the user→department mapping has been fixed. */
export async function resolveExpenseApprovalIssue(
  id: string
): Promise<{ error?: string; success: boolean }> {
  try {
    const loaded = await loadActionableIssue(id);
    if (!loaded) {
      return { error: FORBIDDEN, success: false };
    }
    await markResolved(loaded, "expense.approvalIssue.resolve");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error), success: false };
  }
}

/**
 * Re-sends the approval notification for a stranded chain by calling the API
 * resend route server-to-server (CRON_SECRET), then marks the issue resolved.
 * Used when a next-step notification failed to deliver and left the chain with a
 * pending step whose token was lost. The expense comes from the issue row, so
 * a caller cannot point the resend at another expense.
 */
export async function resendExpenseApprovalNotification(
  issueId: string
): Promise<{ error?: string; success: boolean }> {
  try {
    const loaded = await loadActionableIssue(issueId);
    if (!loaded) {
      return { error: FORBIDDEN, success: false };
    }
    const expenseId = loaded.issue.expense_id;
    if (!expenseId) {
      return { error: "This issue has no expense to resend.", success: false };
    }
    const response = await callExpensesApi("/api/expenses/resend-approval", {
      expenseId,
    });
    if (!response.ok) {
      return { error: response.error, success: false };
    }
    await markResolved(loaded, "expense.approvalIssue.resend");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error), success: false };
  }
}
