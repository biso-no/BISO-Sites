/**
 * Expense types admin: the pure half. Input validation, slug generation and
 * the view shape. Appwrite reads/writes live in `actions.ts`.
 */
import { z } from "zod";

export const EXPENSE_ACCOUNT_MIN = 4000;
export const EXPENSE_ACCOUNT_MAX = 7999;
const LABEL_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 500;
/** Appwrite row ids are at most 36 characters; the slug doubles as the id. */
export const SLUG_MAX_LENGTH = 36;
const ACCOUNT_MESSAGE = "Choose an expense account (4000–7999)";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

export const expenseTypeInputSchema = z.object({
  accountNumber: z.coerce
    .number()
    .int()
    .min(EXPENSE_ACCOUNT_MIN, ACCOUNT_MESSAGE)
    .max(EXPENSE_ACCOUNT_MAX, ACCOUNT_MESSAGE),
  active: z.boolean(),
  askOccasion: z.boolean(),
  description: optionalText(DESCRIPTION_MAX_LENGTH),
  label: z.string().trim().min(1, "Name is required").max(LABEL_MAX_LENGTH),
  labelNo: optionalText(LABEL_MAX_LENGTH),
  sortOrder: z.coerce.number().int().min(0),
  taxCode: z.coerce
    .number()
    .int()
    .min(0)
    .nullish()
    .transform((value) => value ?? null),
});

export type ExpenseTypeInput = z.input<typeof expenseTypeInputSchema>;
export type ExpenseTypeData = z.output<typeof expenseTypeInputSchema>;

export interface ExpenseTypeView {
  $id: string;
  accountName: string | null;
  accountNumber: number;
  active: boolean;
  askOccasion: boolean;
  description: string | null;
  label: string;
  labelNo: string | null;
  slug: string;
  sortOrder: number;
  taxCode: number | null;
}

export interface ExpenseAccountOption {
  accountNumber: number;
  name: string;
  taxCode: number;
}

const DIACRITICS_RE = /[̀-ͯ]/g;
const NON_SLUG_RE = /[^a-z0-9]+/g;
const EDGE_DASHES_RE = /^-+|-+$/g;
const FALLBACK_SLUG = "type";

const clean = (text: string, max: number): string =>
  text.slice(0, max).replace(EDGE_DASHES_RE, "");

/** A stable, readable slug (and row id) for a new type, unique among `taken`. */
export function slugFromLabel(label: string, taken: Set<string>): string {
  const base =
    clean(
      label
        .toLowerCase()
        .replaceAll("æ", "ae")
        .replaceAll("ø", "o")
        .replaceAll("å", "a")
        .normalize("NFD")
        .replace(DIACRITICS_RE, "")
        .replace(NON_SLUG_RE, "-"),
      SLUG_MAX_LENGTH
    ) || FALLBACK_SLUG;
  if (!taken.has(base)) {
    return base;
  }
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${clean(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
