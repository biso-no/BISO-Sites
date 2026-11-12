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
import { callExpensesApi } from "@/lib/expenses-api";
import { todayInOslo } from "@/lib/oslo-day";
import {
  apiErrorCode,
  type ExpenseActionError,
  type ExpenseActionResult,
} from "../action-result";
import { loadReceiptEditOptions } from "./edit-options";
import { planReceiptEdit, type ReceiptChanges, round2 } from "./receipt-edit";

const MAX_ROWS = 500;
const BANK_ACCOUNT_SEPARATORS = /[\s.]/g;
const BANK_ACCOUNT_FORMAT = /^\d{11}$/;
const NON_DIGITS = /\D/g;
const MAX_REASON_CHARS = 1000;
const BISO_EMAIL = /^[^\s@]+@biso\.no$/i;

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

interface ApiActor {
  email: string | null;
  kind: "approver" | "admin";
  name: string;
}

function apiActorOf(loaded: Loaded): ApiActor {
  const { actorEmail, actorKind, actorName } = actorOf(loaded);
  return {
    email: actorEmail,
    kind: actorKind,
    name: actorName ?? actorEmail ?? "BISO admin",
  };
}

/** Maps an api refusal by its stable code; only an unexpected one is logged. */
function apiFailure(
  scope: string,
  failed: { code?: string; error: string }
): { error: ExpenseActionError; message?: string } {
  const code = apiErrorCode(failed.code);
  if (code === "api_failed") {
    console.error(`[${scope}]`, failed.error);
  }
  // Finago's own words are what a person needs after a failed booking.
  return code === "booking_failed"
    ? { error: code, message: failed.error }
    : { error: code };
}

function revalidateExpense(expenseId: string): void {
  revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/expenses");
}

/**
 * Approves or rejects the current step, as its approver or on their behalf.
 * A step that was already decided differently reports `already_decided`.
 */
export async function decideExpenseStep(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  expenseId: string;
  reason?: string;
}): Promise<ExpenseActionResult<{ decision: "approved" | "rejected" }>> {
  try {
    const loaded = await loadForEdit(input.expenseId);
    if (!loaded?.permissions.canDecide) {
      return { error: "forbidden" };
    }
    if (input.approvalId !== loaded.permissions.currentStepId) {
      return { error: "not_current_step" };
    }
    const reason = input.reason?.trim() ?? "";
    if (
      input.decision === "rejected" &&
      (reason === "" || reason.length > MAX_REASON_CHARS)
    ) {
      return { error: "reason_required" };
    }

    const response = await callExpensesApi<{
      result: { ok: true; decision: "approved" | "rejected" };
    }>("/api/expenses/admin/decide", {
      actor: apiActorOf(loaded),
      approvalId: input.approvalId,
      decision: input.decision,
      onBehalf: loaded.permissions.decideAs === "on_behalf",
      ...(input.decision === "rejected" ? { reason } : {}),
    });
    if (!response.ok) {
      return apiFailure("expense-decide", response);
    }
    revalidateExpense(input.expenseId);
    const stored = response.data.result.decision;
    if (stored !== input.decision) {
      return { error: "already_decided" };
    }
    return { data: { decision: stored } };
  } catch (error) {
    return failure(error);
  }
}

/** Sends the current step to another @biso.no approver and remembers the choice. */
export async function changeExpenseApprover(input: {
  approvalId: string;
  email: string;
  expenseId: string;
}): Promise<
  ExpenseActionResult<{ directorySaved: boolean; notified: boolean }>
> {
  try {
    const loaded = await loadForEdit(input.expenseId);
    if (!loaded?.permissions.canChangeApprover) {
      return { error: "forbidden" };
    }
    if (input.approvalId !== loaded.permissions.currentStepId) {
      return { error: "not_current_step" };
    }
    const email = input.email.trim().toLowerCase();
    if (!BISO_EMAIL.test(email)) {
      return { error: "invalid_email" };
    }

    const response = await callExpensesApi<{
      result: { directorySaved: boolean; notified: boolean };
    }>("/api/expenses/admin/change-approver", {
      actor: apiActorOf(loaded),
      approvalId: input.approvalId,
      email,
    });
    if (!response.ok) {
      return apiFailure("expense-change-approver", response);
    }
    revalidateExpense(input.expenseId);
    const { directorySaved, notified } = response.data.result;
    return { data: { directorySaved, notified } };
  } catch (error) {
    return failure(error);
  }
}

/** Retries the ledger booking of a failed expense. */
export async function retryExpenseBooking(input: {
  expenseId: string;
}): Promise<ExpenseActionResult<{ status: string }>> {
  try {
    const loaded = await loadForEdit(input.expenseId);
    if (!loaded?.permissions.canRetryBooking) {
      return { error: "forbidden" };
    }

    const response = await callExpensesApi<{ result: { status: string } }>(
      "/api/expenses/admin/retry-booking",
      { actor: apiActorOf(loaded), expenseId: input.expenseId }
    );
    if (!response.ok) {
      revalidateExpense(input.expenseId);
      return apiFailure("expense-retry-booking", response);
    }
    revalidateExpense(input.expenseId);
    return { data: { status: response.data.result.status } };
  } catch (error) {
    return failure(error);
  }
}
