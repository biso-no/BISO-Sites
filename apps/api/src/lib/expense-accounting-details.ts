// What accounting gets besides the receipts: per receipt its type, account and
// project, plus the occasion, the event and the flags the background check
// raised, in plain words. Used by the cover sheet (Norwegian) and the email
// body (English). Personal data stays where it already was: nothing is added.

import type { createAdminClient } from "@repo/api/server";
import type { ExpenseAttachments, Expenses } from "@repo/api/types/appwrite";
import { parseApproverHints } from "@repo/shared/utils/expense-hints";
import {
  accountLabel,
  loadAccountNames,
  loadTypeLabels,
} from "./expense-card-details";
import { type HintLocale, hintSentence } from "./expense-hint-text";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface AccountingLookups {
  accountNames: Map<number, string>;
  typeLabels: Map<string, string>;
}

export type AccountingExpense = Pick<
  Expenses,
  "approver_hints" | "eventName" | "occasion"
> & {
  expenseAttachments: Pick<
    ExpenseAttachments,
    | "$id"
    | "account_number"
    | "cost_type"
    | "cost_type_text"
    | "description"
    | "project_name"
  >[];
};

export interface AccountingDetails {
  /** The event's name, or "" when the expense has none. */
  event: string;
  /** Plain-words flags, newest hints as stored; empty when nothing was found. */
  flags: string[];
  /** The occasion, or "" when missing. */
  occasion: string;
  /** One entry per attachment, in the expense's order; "" when not set. */
  receipts: { account: string; project: string; type: string }[];
}

const NO_LOOKUPS: AccountingLookups = {
  accountNames: new Map(),
  typeLabels: new Map(),
};

/** Type and account names for the labels; a failed lookup falls back to raw ids. */
export async function loadAccountingLookups(
  db: Db,
  expense: Pick<AccountingExpense, "expenseAttachments">
): Promise<AccountingLookups> {
  try {
    const numbers = expense.expenseAttachments.flatMap((row) =>
      row.account_number == null ? [] : [row.account_number]
    );
    const [typeLabels, accountNames] = await Promise.all([
      loadTypeLabels(db),
      loadAccountNames(db, numbers).catch(() => new Map<number, string>()),
    ]);
    return { accountNames, typeLabels };
  } catch (error) {
    console.error("[expense-accounting] lookups failed:", error);
    return NO_LOOKUPS;
  }
}

function receiptType(
  row: AccountingExpense["expenseAttachments"][number],
  labels: Map<string, string>
): string {
  if (row.cost_type) {
    return labels.get(row.cost_type) ?? row.cost_type;
  }
  return row.cost_type_text?.trim() ?? "";
}

export function buildAccountingDetails(
  expense: AccountingExpense,
  lookups: AccountingLookups,
  locale: HintLocale
): AccountingDetails {
  const rows = expense.expenseAttachments;
  const nameById = new Map(
    rows.map((row) => [
      row.$id,
      row.description?.trim() || receiptType(row, lookups.typeLabels),
    ])
  );
  const flags = parseApproverHints(expense.approver_hints).flatMap((hint) => {
    const sentence = hintSentence(hint, lookups.typeLabels, locale);
    if (!sentence) {
      return [];
    }
    const name = hint.attachmentId ? nameById.get(hint.attachmentId) : "";
    return [name ? `${name}: ${sentence}` : sentence];
  });
  return {
    event: expense.eventName?.trim() ?? "",
    flags,
    occasion: expense.occasion?.trim() ?? "",
    receipts: rows.map((row) => ({
      account:
        accountLabel(row.account_number ?? null, lookups.accountNames) ?? "",
      project: row.project_name?.trim() ?? "",
      type: receiptType(row, lookups.typeLabels),
    })),
  };
}
