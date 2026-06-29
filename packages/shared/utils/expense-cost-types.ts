/**
 * Expense cost-type → GL account mapping (pure, framework-agnostic).
 *
 * A "cost type" is a human-friendly label (Travel, Social event, …) that resolves
 * to a 24SevenOffice general-ledger account + tax code. The authoritative list
 * lives in the `expense_cost_types` Appwrite table (editable by accounting); the
 * seed below is the initial data and a safe in-code fallback.
 *
 * Account numbers here are STARTING DEFAULTS confirmed only for the three the
 * owner named (7140 travel, 7310 social, 7315 academic). Accounting can adjust
 * the rest in the table without a code change.
 */

export interface CostTypeOption {
  slug: string;
  label: string;
  /** Default debit GL account number for receipts of this cost type. */
  accountNumber: number;
  /** Tax code number (see GET /taxes); 0 = no tax. */
  taxCode?: number | null;
  /** OCR category this cost type is the default for. */
  ocrCategory?: string | null;
  description?: string | null;
}

export const DEFAULT_EXPENSE_COST_TYPES = [
  {
    slug: "travel",
    label: "Travel",
    accountNumber: 7140,
    taxCode: 0,
    ocrCategory: "travel",
    description: "Flights, train, taxi, mileage and accommodation",
  },
  {
    slug: "social",
    label: "Social event",
    accountNumber: 7310,
    taxCode: 0,
    ocrCategory: "meal",
    description: "Social gatherings, food and drink for events",
  },
  {
    slug: "academic",
    label: "Academic event",
    accountNumber: 7315,
    taxCode: 0,
    ocrCategory: "event-materials",
    description: "Academic events and related materials",
  },
  {
    slug: "other",
    label: "Other",
    accountNumber: 7790,
    taxCode: 0,
    ocrCategory: "other",
    description: "Anything that does not fit the categories above",
  },
] as const satisfies readonly CostTypeOption[];

export const DEFAULT_COST_TYPE_SLUG = "other";

/** Maps every OCR category to a default cost-type slug. */
const OCR_CATEGORY_TO_SLUG: Record<string, string> = {
  travel: "travel",
  accommodation: "travel",
  meal: "social",
  "event-materials": "academic",
  supplies: "other",
  fee: "other",
  other: "other",
};

export function findCostType(
  slug: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): CostTypeOption | undefined {
  if (!slug) {
    return undefined;
  }
  return options.find((option) => option.slug === slug);
}

/**
 * Picks the default cost-type slug for an OCR category, constrained to the cost
 * types that actually exist in `options`. Falls back to "other" (or the first
 * available option) when no mapping resolves.
 */
export function defaultCostTypeSlugForCategory(
  category: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): string {
  const mapped = category ? OCR_CATEGORY_TO_SLUG[category] : undefined;
  if (mapped && options.some((option) => option.slug === mapped)) {
    return mapped;
  }
  if (options.some((option) => option.slug === DEFAULT_COST_TYPE_SLUG)) {
    return DEFAULT_COST_TYPE_SLUG;
  }
  return options[0]?.slug ?? DEFAULT_COST_TYPE_SLUG;
}

export interface ResolvedReceiptAccount {
  accountNumber: number;
  taxCode: number;
}

/**
 * Resolves the GL account + tax code for a chosen cost type. Throws when the
 * slug is unknown so a submission never posts to an unintended account.
 */
export function resolveReceiptAccount(
  slug: string | null | undefined,
  options: readonly CostTypeOption[] = DEFAULT_EXPENSE_COST_TYPES
): ResolvedReceiptAccount {
  const costType = findCostType(slug, options);
  if (!costType) {
    throw new Error(`Unknown expense cost type "${slug}"`);
  }
  return {
    accountNumber: costType.accountNumber,
    taxCode: costType.taxCode ?? 0,
  };
}
