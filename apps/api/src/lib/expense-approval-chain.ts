import { Query } from "@repo/api";
import { ExpenseApprovalsStatus } from "@repo/api/types/appwrite";

interface ApprovalChainDb {
  listRows: (
    databaseId: string,
    tableId: string,
    queries?: string[]
  ) => Promise<{
    rows: Array<{ status?: string | null; step?: number | null }>;
  }>;
}

function hasContiguousSteps(rows: Array<{ step?: number | null }>): boolean {
  const numericSteps = rows
    .map((row) => row.step)
    .filter((step): step is number => typeof step === "number")
    .sort((a, b) => a - b);

  if (numericSteps.length !== rows.length) {
    return false;
  }

  return numericSteps.every((step, index) => step === index + 1);
}

export async function assertApprovedExpenseChain(
  db: ApprovalChainDb,
  expenseId: string
): Promise<void> {
  const approvals = await db.listRows("app", "expense_approvals", [
    Query.equal("expense_id", expenseId),
    Query.limit(50),
  ]);

  if (approvals.rows.length === 0) {
    throw new Error(`Expense ${expenseId} has no approval chain.`);
  }

  if (!hasContiguousSteps(approvals.rows)) {
    throw new Error(`Expense ${expenseId} approval chain is incomplete.`);
  }

  if (
    approvals.rows.some(
      (approval) => approval.status !== ExpenseApprovalsStatus.APPROVED
    )
  ) {
    throw new Error(`Expense ${expenseId} is not fully approved.`);
  }
}
