/**
 * AI tab statistics: how often the AI's cost type was kept, and the own texts
 * people keep typing instead. Pure; the Appwrite read lives in `ai-data.ts`.
 */

export interface EvalRow {
  aiConfidence: number | null;
  aiCostType: string | null;
  costType: string | null;
  costTypeText: string | null;
  createdAt: string;
}

/** `correctedTo` key for a receipt where the submitter typed their own text. */
export const OWN_TEXT_KEY = "own text";
/** The AI tab reads receipts from this many days back. */
export const AI_EVAL_WINDOW_DAYS = 90;
/** An own text is shown once it was written this many times in the window. */
export const RECURRING_MIN_COUNT = 3;
const CORRECTED_TO_LIMIT = 3;
const RECURRING_LIMIT = 20;
const MS_PER_DAY = 86_400_000;
const WHITESPACE = /\s+/g;

export interface KeptTypeStats {
  correctedTo: { count: number; to: string }[];
  kept: number;
  slug: string;
  total: number;
}

export interface KeptStats {
  kept: number;
  keptRate: number | null;
  perType: KeptTypeStats[];
  total: number;
}

const isKept = (row: EvalRow): boolean =>
  row.costType === row.aiCostType && !row.costTypeText;

export function keptStats(
  rows: EvalRow[],
  now: Date,
  days: 30 | 90
): KeptStats {
  const since = now.getTime() - days * MS_PER_DAY;
  const byType = new Map<
    string,
    { corrections: Map<string, number>; kept: number; total: number }
  >();
  let total = 0;
  let kept = 0;

  for (const row of rows) {
    if (!row.aiCostType || Date.parse(row.createdAt) < since) {
      continue;
    }
    const entry = byType.get(row.aiCostType) ?? {
      corrections: new Map<string, number>(),
      kept: 0,
      total: 0,
    };
    entry.total += 1;
    total += 1;
    if (isKept(row)) {
      entry.kept += 1;
      kept += 1;
    } else {
      const to = row.costTypeText ? OWN_TEXT_KEY : (row.costType ?? "");
      if (to) {
        entry.corrections.set(to, (entry.corrections.get(to) ?? 0) + 1);
      }
    }
    byType.set(row.aiCostType, entry);
  }

  const perType = [...byType.entries()]
    .map(([slug, entry]) => ({
      correctedTo: [...entry.corrections.entries()]
        .map(([to, count]) => ({ count, to }))
        .sort((a, b) => b.count - a.count)
        .slice(0, CORRECTED_TO_LIMIT),
      kept: entry.kept,
      slug,
      total: entry.total,
    }))
    .sort((a, b) => b.total - a.total);

  return { kept, keptRate: total === 0 ? null : kept / total, perType, total };
}

export function normalizeOwnText(text: string): string {
  return text.trim().toLowerCase().replace(WHITESPACE, " ");
}

/** Own texts written at least `minCount` times, most first. */
export function recurringOwnTexts(
  rows: readonly Pick<EvalRow, "costTypeText">[],
  minCount = RECURRING_MIN_COUNT
): { count: number; example: string; text: string }[] {
  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const original = row.costTypeText?.trim();
    if (!original) {
      continue;
    }
    const key = normalizeOwnText(original);
    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(original, (spellings.get(original) ?? 0) + 1);
    groups.set(key, spellings);
  }

  const result: { count: number; example: string; text: string }[] = [];
  for (const [text, spellings] of groups) {
    let count = 0;
    let example = "";
    let exampleCount = 0;
    for (const [spelling, n] of spellings) {
      count += n;
      if (n > exampleCount) {
        example = spelling;
        exampleCount = n;
      }
    }
    if (count >= minCount) {
      result.push({ count, example, text });
    }
  }
  return result.sort((a, b) => b.count - a.count).slice(0, RECURRING_LIMIT);
}
