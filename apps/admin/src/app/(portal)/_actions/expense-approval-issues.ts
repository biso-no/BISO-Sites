"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { ExpenseApprovalIssues } from "@repo/api/types/appwrite";
import { ExpenseApprovalIssuesStatus } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import { requireItPermission } from "@/lib/it-permissions";
import { logAuditEvent } from "./audit-log";

type ActionResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

const ISSUES_TABLE = "expense_approval_issues";
const LIST_LIMIT = 200;
const TRAILING_SLASH = /\/+$/;

/** Lists approval-routing issues, open ones first. */
export async function listExpenseApprovalIssues(): Promise<
  ActionResult<ExpenseApprovalIssues[]>
> {
  try {
    await requireItPermission("it.users.view");
    const { db } = await createAdminClient();
    const result = await db.listRows<ExpenseApprovalIssues>(
      "app",
      ISSUES_TABLE,
      [Query.orderDesc("$createdAt"), Query.limit(LIST_LIMIT)]
    );
    // Open issues first, then most recent.
    const rows = [...result.rows].sort((a, b) => {
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

/** Marks an issue resolved after the user→department mapping has been fixed. */
export async function resolveExpenseApprovalIssue(
  id: string
): Promise<{ error?: string; success: boolean }> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const { db } = await createAdminClient();
    await db.updateRow("app", ISSUES_TABLE, id, {
      status: ExpenseApprovalIssuesStatus.RESOLVED,
      resolved_by: ctx.email ?? ctx.userId,
      resolved_at: new Date().toISOString(),
    });
    await logAuditEvent(ctx, "expense.approvalIssue.resolve", {
      resourceId: id,
      resourceType: "expense_approval_issue",
    });
    revalidatePath("/it/expense-approvals");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error), success: false };
  }
}

/**
 * Re-sends the approval notification for a stranded chain by calling the API
 * resend route server-to-server (CRON_SECRET), then marks the issue resolved.
 * Used when a next-step notification failed to deliver and left the chain with a
 * pending step whose token was lost.
 */
export async function resendExpenseApprovalNotification(
  issueId: string,
  expenseId: string
): Promise<{ error?: string; success: boolean }> {
  try {
    const ctx = await requireItPermission("it.users.editProfile");
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const cronSecret = process.env.CRON_SECRET;
    if (!apiBase) {
      return {
        error: "NEXT_PUBLIC_API_BASE_URL is not configured",
        success: false,
      };
    }
    if (!cronSecret) {
      return { error: "CRON_SECRET is not configured", success: false };
    }

    const url = `${apiBase.replace(TRAILING_SLASH, "")}/api/expenses/resend-approval`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expenseId }),
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as
      | { success: true }
      | { error: string }
      | null;
    if (!(response.ok && result) || "error" in result) {
      const message =
        (result && "error" in result && result.error) ||
        "Failed to resend approval notification";
      return { error: message, success: false };
    }

    const { db } = await createAdminClient();
    await db.updateRow("app", ISSUES_TABLE, issueId, {
      status: ExpenseApprovalIssuesStatus.RESOLVED,
      resolved_by: ctx.email ?? ctx.userId,
      resolved_at: new Date().toISOString(),
    });
    await logAuditEvent(ctx, "expense.approvalIssue.resend", {
      resourceId: issueId,
      resourceType: "expense_approval_issue",
    });
    revalidatePath("/it/expense-approvals");
    return { success: true };
  } catch (error) {
    return { error: getErrorMessage(error), success: false };
  }
}
