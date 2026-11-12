"use server";

import { getUserAuthContext } from "@/lib/authorization";
import { callExpensesApi } from "@/lib/expenses-api";
import { ROLES } from "@/lib/roles";
import { apiErrorCode, type ExpenseActionResult } from "../../action-result";

export interface RerunMiss {
  confidence: number;
  description: string | null;
  exampleId: string;
  /** The slug that was booked. */
  expected: string;
  /** The slug the AI picks today, or null for none. */
  predicted: string | null;
  vendor: string | null;
}

export interface RerunCheckResult {
  checked: number;
  considered: number;
  hitRate: number | null;
  hits: number;
  misses: RerunMiss[];
  stoppedEarly: boolean;
}

/**
 * Re-classifies recent booked receipts with today's types and prompt. Global
 * admins only; nothing is stored.
 */
export async function runRerunCheck(): Promise<
  ExpenseActionResult<RerunCheckResult>
> {
  const ctx = await getUserAuthContext();
  if (!ctx?.roles.includes(ROLES.GLOBAL_ADMIN)) {
    return { error: "forbidden" };
  }
  const result = await callExpensesApi<{ result: RerunCheckResult }>(
    "/api/expenses/admin/eval-rerun",
    {}
  );
  if (!result.ok) {
    console.error("[expense-ai] Re-run check failed:", result.error);
    return { error: apiErrorCode(result.code) };
  }
  return { data: result.data.result };
}
