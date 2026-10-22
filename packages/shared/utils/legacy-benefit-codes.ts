export interface LegacyCodeRow {
  $id: string;
  redemption_value?: string | null;
}

export interface LegacyCodeClearPlan {
  /** Benefit ids whose inline code must first be copied into benefit_codes. */
  clear: string[];
  copy: string[];
}

export interface LegacyCodeClearResult {
  cleared: number;
  copied: number;
}

const hasValue = (row: LegacyCodeRow): boolean =>
  Boolean(row.redemption_value?.trim());

/**
 * Plans the clear of the legacy public `redemption_value` column. A code is
 * copied only when `benefit_codes` has no row for the benefit (an existing
 * private row wins); every row that holds a value is then cleared.
 */
export function planLegacyCodeClear(
  rows: LegacyCodeRow[],
  existingCodeIds: ReadonlySet<string>
): LegacyCodeClearPlan {
  const withValue = rows.filter(hasValue);
  return {
    clear: withValue.map((row) => row.$id),
    copy: withValue
      .filter((row) => !existingCodeIds.has(row.$id))
      .map((row) => row.$id),
  };
}

/** Counts only: the output must never carry a code value. */
export function formatLegacyCodeClearPlan(
  plan: LegacyCodeClearPlan,
  rowsRead: number
): string[] {
  return [
    "Mode: dry-run",
    `Read ${rowsRead} campus_benefits rows`,
    `copy: ${plan.copy.length}`,
    `clear: ${plan.clear.length}`,
  ];
}

export function formatLegacyCodeClearResult(
  result: LegacyCodeClearResult
): string[] {
  return [
    "Mode: APPLY",
    `copied: ${result.copied}`,
    `cleared: ${result.cleared}`,
  ];
}
