import type { ExpenseTypeOption } from "./types";

const COMBINING_MARKS = /\p{M}/gu;
const O_STROKE = /ø/g;
const AE_LIGATURE = /æ/g;

/** Lower-cases, strips diacritics and trims, so "Café" matches "cafe". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(O_STROKE, "o")
    .replace(AE_LIGATURE, "ae")
    .trim();
}

function names(option: ExpenseTypeOption): string[] {
  return [option.label, option.labelNo ?? ""].filter(Boolean).map(normalize);
}

/**
 * Filters the expense types for the combobox search box.
 *
 * Matches both languages whatever the UI locale, so a student can type either
 * "Reise" or "Travel". `exact` is the type whose name the trimmed query equals;
 * `offerOwnText` says whether to show "Use “…”" (any non-blank query that is
 * not already a type's name).
 */
export function filterTypeOptions(
  query: string,
  options: ExpenseTypeOption[],
  _locale: string
): {
  matches: ExpenseTypeOption[];
  exact: ExpenseTypeOption | null;
  offerOwnText: boolean;
} {
  const needle = normalize(query);
  if (!needle) {
    return { matches: options, exact: null, offerOwnText: false };
  }
  const matches = options.filter((option) =>
    names(option).some((name) => name.includes(needle))
  );
  const exact =
    options.find((option) => names(option).includes(needle)) ?? null;
  return { matches, exact, offerOwnText: exact === null };
}
