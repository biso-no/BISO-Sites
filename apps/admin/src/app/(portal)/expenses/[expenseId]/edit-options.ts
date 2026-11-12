import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  ExpenseCostTypes,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import {
  EXPENSE_ACCOUNT_MAX,
  EXPENSE_ACCOUNT_MIN,
} from "../settings/types-model";
import type { ExpenseTypeOption } from "./receipt-edit";

const MAX_ROWS = 500;

export interface EditAccountOption {
  accountNumber: number;
  name: string;
  taxCode: number | null;
}

/** The active types and expense accounts a receipt can be corrected to. */
export async function loadReceiptEditOptions(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"]
): Promise<{ accounts: EditAccountOption[]; types: ExpenseTypeOption[] }> {
  const [types, accounts] = await Promise.all([
    db.listRows<ExpenseCostTypes>("app", "expense_cost_types", [
      Query.equal("active", true),
      Query.orderAsc("sort_order"),
      Query.limit(MAX_ROWS),
    ]),
    db.listRows<LedgerAccounts>("app", "ledger_accounts", [
      Query.between("account_number", EXPENSE_ACCOUNT_MIN, EXPENSE_ACCOUNT_MAX),
      Query.orderAsc("account_number"),
      Query.limit(MAX_ROWS),
    ]),
  ]);
  return {
    accounts: accounts.rows
      .filter((row) => row.active !== false)
      .map((row) => ({
        accountNumber: row.account_number,
        name: row.name ?? "",
        taxCode: row.tax_code ?? null,
      })),
    types: types.rows.map((row) => ({
      accountNumber: row.account_number,
      label: row.label,
      labelNo: row.label_no ?? null,
      slug: row.slug,
      taxCode: row.tax_code ?? null,
    })),
  };
}
