import "server-only";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { ExpenseCostTypes } from "@repo/api/types/appwrite";
import { STARTING_EXPENSE_COST_TYPES } from "@repo/shared/utils/expense-cost-types";
import type { ExpenseTypeOption } from "@/components/expense-v3/types";

const TYPE_LIMIT = 200;

/**
 * Name-only starting list. Used when the table is empty and, by the page, when
 * the read fails.
 */
export function startingExpenseTypeOptions(): ExpenseTypeOption[] {
  return STARTING_EXPENSE_COST_TYPES.map((type) => ({
    slug: type.slug,
    label: type.label,
    labelNo: type.labelNo ?? null,
    askOccasion: type.askOccasion ?? false,
  }));
}

/**
 * Active expense types for the student form. Only the four display fields leave
 * the server: account numbers and tax codes stay with finance. Throws on
 * Appwrite errors; the call site falls back to the starting list.
 */
export async function getExpenseTypeOptions(): Promise<ExpenseTypeOption[]> {
  const { db } = await createAdminClient();
  const { rows } = await db.listRows<ExpenseCostTypes>(
    "app",
    "expense_cost_types",
    [Query.limit(TYPE_LIMIT)]
  );

  if (rows.length === 0) {
    return startingExpenseTypeOptions();
  }

  return (
    rows
      // As the api reads it: only an explicit false takes a type off the list.
      .filter((row) => row.active !== false)
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
          a.label.localeCompare(b.label)
      )
      .map((row) => ({
        slug: row.slug,
        label: row.label,
        labelNo: row.label_no ?? null,
        askOccasion: row.ask_occasion ?? false,
      }))
  );
}
