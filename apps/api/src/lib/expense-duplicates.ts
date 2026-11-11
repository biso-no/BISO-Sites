import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseAttachments, Expenses } from "@repo/api/types/appwrite";
import { osloDayBoundsUtc, receiptDateInOslo } from "./receipt-date";
import { reimbursementNumber } from "./reimbursement-number";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const AMOUNT_TOLERANCE = 0.01;
const CANDIDATE_LIMIT = 10;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const IGNORED_STATUSES = new Set(["draft", "rejected"]);

export interface PossibleDuplicate {
  expenseId: string;
  match: "date_amount" | "file";
  reimbursementNumber: string;
}

export interface DuplicateInput {
  amount: number | null;
  date: string | null;
  excludeExpenseId?: string | null;
  fileHash: string | null;
}

function toOsloDay(date: string): string | null {
  return ISO_DAY.test(date) ? date : receiptDateInOslo(date);
}

async function firstSubmitted(
  db: Db,
  attachments: Pick<ExpenseAttachments, "expense_id">[],
  excludeExpenseId: string | null | undefined,
  match: PossibleDuplicate["match"]
): Promise<PossibleDuplicate | null> {
  const seen = new Set<string>();
  for (const { expense_id: expenseId } of attachments) {
    if (!expenseId || expenseId === excludeExpenseId || seen.has(expenseId)) {
      continue;
    }
    seen.add(expenseId);
    try {
      const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
        Query.select(["$id", "status", "$sequence"]),
      ]);
      if (!IGNORED_STATUSES.has(expense.status)) {
        return {
          expenseId,
          match,
          reimbursementNumber: reimbursementNumber(expense.$sequence),
        };
      }
    } catch {
      // A deleted expense must not hide the other candidates.
    }
  }
  return null;
}

export async function findPossibleDuplicate(
  db: Db,
  input: DuplicateInput
): Promise<PossibleDuplicate | null> {
  try {
    if (input.fileHash) {
      const { rows } = await db.listRows<ExpenseAttachments>(
        "app",
        "expense_attachments",
        [Query.equal("file_hash", input.fileHash), Query.limit(CANDIDATE_LIMIT)]
      );
      const byFile = await firstSubmitted(
        db,
        rows,
        input.excludeExpenseId,
        "file"
      );
      if (byFile) {
        return byFile;
      }
    }

    const day = input.date ? toOsloDay(input.date) : null;
    const bounds = day ? osloDayBoundsUtc(day) : null;
    if (!bounds || input.amount === null || input.amount <= 0) {
      return null;
    }
    const { rows } = await db.listRows<ExpenseAttachments>(
      "app",
      "expense_attachments",
      [
        Query.greaterThanEqual("date", bounds.start),
        Query.lessThan("date", bounds.end),
        Query.between(
          "amount",
          Number((input.amount - AMOUNT_TOLERANCE).toFixed(2)),
          Number((input.amount + AMOUNT_TOLERANCE).toFixed(2))
        ),
        Query.limit(CANDIDATE_LIMIT),
      ]
    );
    return await firstSubmitted(
      db,
      rows,
      input.excludeExpenseId,
      "date_amount"
    );
  } catch (error) {
    console.error("[expense-duplicates] Lookup failed:", error);
    return null;
  }
}
