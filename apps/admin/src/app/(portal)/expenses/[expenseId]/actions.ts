"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ExpenseApprovals,
  ExpenseAttachments,
  Expenses,
} from "@repo/api/types/appwrite";
import {
  type ExpenseEventInput,
  recordExpenseEvents,
} from "@repo/shared/utils/expense-events";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  type ExpensePermissions,
  type ExpenseViewer,
  expensePermissions,
  maskBankAccount,
} from "@/lib/expense-access";
import { getExpenseViewer } from "@/lib/expense-viewer";
import { todayInOslo } from "@/lib/oslo-day";
import type { ExpenseActionError, ExpenseActionResult } from "../action-result";
import { loadReceiptEditOptions } from "./edit-options";
import { planReceiptEdit, type ReceiptChanges, round2 } from "./receipt-edit";

const MAX_ROWS = 500;
const BANK_ACCOUNT_SEPARATORS = /[\s.]/g;
const BANK_ACCOUNT_FORMAT = /^\d{11}$/;
const NON_DIGITS = /\D/g;

interface Loaded {
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
  expense: Expenses;
  permissions: ExpensePermissions;
  steps: ExpenseApprovals[];
  viewer: ExpenseViewer;
}

function failure(error: unknown): { error: ExpenseActionError } {
  if (isRedirectError(error)) {
    throw error;
  }
  console.error("[expense-edit]", error);
  return isNotFoundError(error) ? { error: "not_found" } : { error: "failed" };
}

function isNotFoundError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 404;
}

async function loadForEdit(expenseId: string): Promise<Loaded | null> {
  const viewer = await getExpenseViewer();
  if (!viewer) {
    return null;
  }
  const { db } = await createAdminClient();
  const [expense, steps] = await Promise.all([
    db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select([
        "$id",
        "campus",
        "status",
        "total",
        "userId",
        "bank_account",
        "submitter_is_financial_manager",
        "submitter_is_controller",
        "expenseAttachments.*",
      ]),
    ]),
    db.listRows<ExpenseApprovals>("app", "expense_approvals", [
      Query.equal("expense_id", expenseId),
      Query.limit(MAX_ROWS),
    ]),
  ]);
  const permissions = expensePermissions(
    viewer,
    {
      campus: expense.campus,
      status: expense.status,
      submitter_is_controller: expense.submitter_is_controller,
      submitter_is_financial_manager: expense.submitter_is_financial_manager,
      userId: expense.userId,
    },
    steps.rows
  );
  return { db, expense, permissions, steps: steps.rows, viewer };
}

function actorOf(loaded: Loaded): {
  actorEmail: string | null;
  actorKind: "approver" | "admin";
  actorName: string | null;
} {
  const { permissions, steps, viewer } = loaded;
  const isApprover = permissions.decideAs === "approver";
  const stepEmail = steps.find(
    (s) => s.$id === permissions.currentStepId
  )?.approver_email;
  return {
    actorEmail:
      (isApprover ? stepEmail : null) ??
      viewer.emails[0] ??
      viewer.accountEmail,
    actorKind: isApprover ? "approver" : "admin",
    actorName: viewer.name,
  };
}

/** Corrects one receipt of an expense. Each change is logged in the history. */
export async function updateExpenseReceipt(input: {
  attachmentId: string;
  changes: ReceiptChanges;
  expenseId: string;
}): Promise<ExpenseActionResult<{ total: number }>> {
  try {
    const loaded = await loadForEdit(input.expenseId);
    if (!loaded?.permissions.canEdit) {
      return { error: "forbidden" };
    }
    const { db, expense } = loaded;
    const attachments: ExpenseAttachments[] = expense.expenseAttachments ?? [];
    const current = attachments.find((a) => a.$id === input.attachmentId);
    if (!current) {
      return { error: "not_found" };
    }

    const options = await loadReceiptEditOptions(db);
    const plan = planReceiptEdit(current, input.changes, {
      accounts: new Map(
        options.accounts.map((a) => [
          a.accountNumber,
          { active: true, taxCode: a.taxCode },
        ])
      ),
      source: loaded.permissions.decideAs === "approver" ? "approver" : "admin",
      today: todayInOslo(),
      types: options.types,
    });
    if ("error" in plan) {
      return plan;
    }
    if (plan.events.length === 0) {
      return { data: { total: expense.total } };
    }

    await db.updateRow("app", "expense_attachments", current.$id, plan.patch);

    const actor = actorOf(loaded);
    const events: ExpenseEventInput[] = plan.events.map((event) => ({
      ...event,
      action: "edited",
      attachmentId: current.$id,
      expenseId: expense.$id,
      ...actor,
    }));

    let total = expense.total;
    if (plan.patch.amount !== undefined) {
      // From the stored rows, not the copy loaded above: another edit may
      // have landed in between.
      const fresh = await db.listRows<ExpenseAttachments>(
        "app",
        "expense_attachments",
        [
          Query.equal("expense_id", expense.$id),
          Query.select(["amount"]),
          Query.limit(MAX_ROWS),
        ]
      );
      total = round2(
        fresh.rows.reduce((sum, row) => sum + Math.max(row.amount ?? 0, 0), 0)
      );
      await db.updateRow("app", "expense", expense.$id, { total });
      events.push({
        action: "edited",
        after: String(total),
        before: String(expense.total),
        expenseId: expense.$id,
        field: "total",
        ...actor,
      });
    }

    await recordExpenseEvents(db, events);
    revalidatePath(`/expenses/${expense.$id}`);
    return { data: { total } };
  } catch (error) {
    return failure(error);
  }
}

/** Corrects the bank account the student is paid to. Logged with masked values. */
export async function updateExpenseBankAccount(input: {
  bankAccount: string;
  expenseId: string;
}): Promise<ExpenseActionResult<null>> {
  try {
    const loaded = await loadForEdit(input.expenseId);
    if (!loaded?.permissions.canEditBankAccount) {
      return { error: "forbidden" };
    }
    const digits = input.bankAccount.replace(BANK_ACCOUNT_SEPARATORS, "");
    if (!BANK_ACCOUNT_FORMAT.test(digits)) {
      return { error: "invalid_bank_account" };
    }
    const { db, expense } = loaded;
    if (digits === (expense.bank_account ?? "").replace(NON_DIGITS, "")) {
      return { data: null };
    }

    await db.updateRow("app", "expense", expense.$id, {
      bank_account: digits,
    });
    await recordExpenseEvents(db, [
      {
        action: "edited",
        after: maskBankAccount(digits),
        before: maskBankAccount(expense.bank_account),
        expenseId: expense.$id,
        field: "bank_account",
        ...actorOf(loaded),
      },
    ]);
    revalidatePath(`/expenses/${expense.$id}`);
    return { data: null };
  } catch (error) {
    return failure(error);
  }
}
