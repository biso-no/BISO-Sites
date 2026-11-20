// The approval issue the backstop records when it gives up on a check, so IT
// sees a reimbursement whose check kept failing instead of only a badge.

import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  type ExpenseApprovalIssues,
  ExpenseApprovalIssuesStatus,
  type Expenses,
} from "@repo/api/types/appwrite";
import {
  checkStuckIssueReason,
  getCampusApprovalPlan,
  isCheckStuckIssue,
} from "@repo/shared/utils/expense-approvers";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const ISSUES_TABLE = "expense_approval_issues";
const OPEN_ISSUE_LIMIT = 25;

/**
 * Records, once, that the backstop gave up on an expense's check after three
 * takeovers: an open issue that says so already is left as it is. The shape
 * follows the issue of a chain that failed after the check: the campus, the
 * department and the step that was to be told first. `cause` is the last
 * error, when it is known. Throws when the issue can't be read or written.
 */
export async function recordCheckStuckIssue(
  db: Db,
  expenseId: string,
  cause?: unknown
): Promise<void> {
  const { rows } = await db.listRows<ExpenseApprovalIssues>(
    "app",
    ISSUES_TABLE,
    [
      Query.equal("expense_id", expenseId),
      Query.equal("status", ExpenseApprovalIssuesStatus.OPEN),
      Query.select(["$id", "reason"]),
      Query.limit(OPEN_ISSUE_LIMIT),
    ]
  );
  if (rows.some((row) => isCheckStuckIssue(row.reason))) {
    return;
  }
  const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select([
      "$id",
      "campus",
      "check_finished_at",
      "department",
      "submitter_is_controller",
      "submitter_is_financial_manager",
      "departmentRel.*",
    ]),
  ]);
  const firstPlanned = getCampusApprovalPlan({
    campusId: expense.campus,
    departmentId: expense.department,
    submitterIsController: expense.submitter_is_controller,
    submitterIsFinancialManager: expense.submitter_is_financial_manager,
  }).at(0);
  await db.createRow("app", ISSUES_TABLE, ID.unique(), {
    expense_id: expenseId,
    campus_id: expense.campus,
    department: expense.departmentRel?.Name ?? "(none)",
    role_sought: firstPlanned?.role ?? "controller",
    reason: checkStuckIssueReason({
      cause: cause instanceof Error ? cause.message : undefined,
      told: Boolean(expense.check_finished_at),
    }),
    status: ExpenseApprovalIssuesStatus.OPEN,
  });
}
