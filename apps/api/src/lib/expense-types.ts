import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type {
  ExpenseCostTypes,
  LedgerAccounts,
} from "@repo/api/types/appwrite";
import {
  type CostTypeOption,
  STARTING_EXPENSE_COST_TYPES,
} from "@repo/shared/utils/expense-cost-types";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const COST_TYPE_LIMIT = 200;
const LEDGER_LIMIT = 1000;
const FIRST_COST_ACCOUNT = 4000;
const END_COST_ACCOUNT = 8000;

export interface CostAccountOption {
  accountNumber: number;
  name: string;
  taxCode: number;
}

function toOption(row: ExpenseCostTypes): CostTypeOption {
  return {
    accountNumber: row.account_number,
    active: row.active,
    askOccasion: row.ask_occasion,
    description: row.description,
    label: row.label,
    labelNo: row.label_no,
    ocrCategory: row.ocr_category,
    slug: row.slug,
    sortOrder: row.sort_order,
    taxCode: row.tax_code,
  };
}

/** Every cost type, inactive included, so old slugs still resolve when booking. */
export async function loadAllCostTypes(db: Db): Promise<CostTypeOption[]> {
  const { rows } = await db.listRows<ExpenseCostTypes>(
    "app",
    "expense_cost_types",
    [Query.limit(COST_TYPE_LIMIT)]
  );
  if (rows.length === 0) {
    return [...STARTING_EXPENSE_COST_TYPES];
  }
  return rows.map(toOption);
}

/** The active types of an already loaded list, in display order. */
export function activeCostTypes(all: CostTypeOption[]): CostTypeOption[] {
  return all
    .filter((type) => type.active !== false)
    .sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        a.label.localeCompare(b.label)
    );
}

/** Active cost types in display order; the starting list when the table is empty. */
export async function loadActiveCostTypes(db: Db): Promise<CostTypeOption[]> {
  return activeCostTypes(await loadAllCostTypes(db));
}

/** Active ledger accounts in the cost range (4000-7999), by number. */
export async function loadCostAccounts(db: Db): Promise<CostAccountOption[]> {
  const { rows } = await db.listRows<LedgerAccounts>("app", "ledger_accounts", [
    Query.equal("active", true),
    Query.limit(LEDGER_LIMIT),
  ]);
  return rows
    .filter(
      (row) =>
        row.active &&
        row.account_number >= FIRST_COST_ACCOUNT &&
        row.account_number < END_COST_ACCOUNT
    )
    .map((row) => ({
      accountNumber: row.account_number,
      name: row.name ?? "",
      taxCode: row.tax_code ?? 0,
    }))
    .sort((a, b) => a.accountNumber - b.accountNumber);
}
