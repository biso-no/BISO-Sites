import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseTypeExamples } from "@repo/api/types/appwrite";
import { AI_TYPE_CONFIDENCE_THRESHOLD } from "@repo/shared/utils/expense-cost-types";
import { selectExamples } from "./expense-examples";
import { loadActiveCostTypes } from "./expense-types";
import {
  CLASSIFY_TIMEOUT_MS,
  classifyReceipt,
  type ExtractedReceipt,
} from "./receipt-scan";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const DEFAULT_LIMIT = 200;
const DEFAULT_BUDGET_MS = 120_000;
const DEFAULT_CONCURRENCY = 8;
const MAX_MISSES = 50;

export interface RerunMiss {
  confidence: number;
  description: string | null;
  exampleId: string;
  expected: string;
  predicted: string | null;
  vendor: string | null;
}

export interface RerunResult {
  /** Examples classified; the rest ran out of budget. */
  checked: number;
  /** Examples fetched, own-text ones included. */
  considered: number;
  hitRate: number | null;
  hits: number;
  misses: RerunMiss[];
  stoppedEarly: boolean;
}

/** A receipt shaped like the example; everything the example lacks is neutral. */
function receiptFor(row: ExpenseTypeExamples): ExtractedReceipt {
  return {
    address: null,
    amount: row.amount ?? null,
    category: null,
    city: null,
    country: null,
    currency: null,
    date: null,
    description: row.description ?? null,
    documentType: "receipt",
    purchaseContext: null,
    receiptIssues: [],
    vendor: row.vendor_key || null,
  };
}

/**
 * Re-classifies the latest booked examples with today's types and prompt, and
 * counts how often the AI would pick the type that was finally booked. Nothing
 * is stored. Examples that only carry an own text have no type to score.
 */
export async function runRerunCheck(
  db: Db,
  opts: { budgetMs?: number; concurrency?: number; limit?: number } = {}
): Promise<RerunResult> {
  const {
    budgetMs = DEFAULT_BUDGET_MS,
    concurrency = DEFAULT_CONCURRENCY,
    limit = DEFAULT_LIMIT,
  } = opts;
  const startedAt = Date.now();
  const { rows } = await db.listRows<ExpenseTypeExamples>(
    "app",
    "expense_type_examples",
    [Query.orderDesc("$createdAt"), Query.limit(limit)]
  );
  const types = await loadActiveCostTypes(db);
  const scored = rows.filter((row) => row.final_cost_type);

  let next = 0;
  let checked = 0;
  let hits = 0;
  let stoppedEarly = false;
  const misses: RerunMiss[] = [];

  const scoreOne = async (row: ExpenseTypeExamples) => {
    const expected = row.final_cost_type as string;
    let predicted: string | null = null;
    let confidence = 0;
    try {
      const examples = await selectExamples(db, {
        excludeId: row.$id,
        types,
        vendor: row.vendor_key || null,
      });
      const result = await classifyReceipt({
        abortSignal: AbortSignal.timeout(CLASSIFY_TIMEOUT_MS),
        examples,
        receipt: receiptFor(row),
        types,
      });
      predicted = result.costType;
      confidence = result.confidence;
    } catch (error) {
      console.error("[expense-eval] Classification failed", error);
    }
    checked += 1;
    if (predicted === expected && confidence >= AI_TYPE_CONFIDENCE_THRESHOLD) {
      hits += 1;
    } else if (misses.length < MAX_MISSES) {
      misses.push({
        confidence,
        description: row.description ?? null,
        exampleId: row.$id,
        expected,
        predicted,
        vendor: row.vendor_key || null,
      });
    }
  };

  const worker = async () => {
    while (next < scored.length) {
      if (Date.now() - startedAt >= budgetMs) {
        stoppedEarly = true;
        return;
      }
      const row = scored[next];
      next += 1;
      await scoreOne(row);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  );

  return {
    checked,
    considered: rows.length,
    hitRate: checked === 0 ? null : hits / checked,
    hits,
    misses,
    stoppedEarly,
  };
}
