/**
 * Webshop accounting admin: the pure half.
 *
 * Validates sales-type input, derives a stable row id from a Norwegian
 * label, decides which shop accounting settings to show (saved vs. the
 * ledger's current defaults), and shapes the synced chart of accounts into
 * the options the sales-type form offers. No Appwrite client, so every rule
 * is unit-testable. The Appwrite reads/writes live in `actions.ts`.
 */
import {
  DEFAULT_SHOP_ACCOUNTING_SETTINGS,
  parseShopAccountingSettings,
  type ShopAccountingSettings,
} from "@repo/shared/utils/finago-shop-accounting";
import { z } from "zod";

const REVENUE_ACCOUNT_MIN = 3000;
const REVENUE_ACCOUNT_MAX = 3999;
const LABEL_MAX_LENGTH = 80;
const SORT_ORDER_MAX = 1000;
const ID_MAX_LENGTH = 36;
const VAT_STANDARD = 3;
const VAT_EXEMPT = 5;
const VAT_NONE = 0;

const REVENUE_ACCOUNT_MESSAGE = "Choose a revenue account (3000–3999)";

export const salesTypeInputSchema = z.object({
  account_number: z.coerce
    .number()
    .int()
    .min(REVENUE_ACCOUNT_MIN, REVENUE_ACCOUNT_MESSAGE)
    .max(REVENUE_ACCOUNT_MAX, REVENUE_ACCOUNT_MESSAGE),
  active: z.boolean(),
  label_en: z
    .string()
    .trim()
    .min(1, "English label is required")
    .max(LABEL_MAX_LENGTH),
  label_no: z
    .string()
    .trim()
    .min(1, "Norwegian label is required")
    .max(LABEL_MAX_LENGTH),
  sort_order: z.coerce.number().int().min(0).max(SORT_ORDER_MAX),
});

export type SalesTypeInput = z.infer<typeof salesTypeInputSchema>;

export const SALES_TYPE_ID_RE = /^[a-z0-9-]{1,36}$/;

const DIACRITICS_RE = /[̀-ͯ]/g;
const NON_SLUG_RE = /[^a-z0-9]+/g;
const EDGE_DASHES_RE = /^-+|-+$/g;

/** A readable, stable row id for a new sales type, from its Norwegian label. */
export function salesTypeIdFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFKD")
    .replace(DIACRITICS_RE, "")
    .replace(NON_SLUG_RE, "-")
    .replace(EDGE_DASHES_RE, "")
    .slice(0, ID_MAX_LENGTH);
}

export function settingsOrDefault(general: string | null | undefined): {
  saved: boolean;
  settings: ShopAccountingSettings;
} {
  const parsed = parseShopAccountingSettings(general);
  return parsed
    ? { saved: true, settings: parsed }
    : { saved: false, settings: DEFAULT_SHOP_ACCOUNTING_SETTINGS };
}

export interface LedgerAccountOption {
  accountNumber: number;
  name: string;
  vatCode: number | null;
}

export function revenueAccountOptions(
  rows: ReadonlyArray<{
    account_number: number;
    active: boolean;
    name: string | null;
    vat_code?: number | null;
  }>
): LedgerAccountOption[] {
  return rows
    .filter(
      (row) =>
        row.active &&
        row.account_number >= REVENUE_ACCOUNT_MIN &&
        row.account_number <= REVENUE_ACCOUNT_MAX
    )
    .sort((a, b) => a.account_number - b.account_number)
    .map((row) => ({
      accountNumber: row.account_number,
      name: row.name ?? "",
      vatCode: typeof row.vat_code === "number" ? row.vat_code : null,
    }));
}

export type VatKind = "exempt" | "none" | "other" | "standard" | "unknown";

export function vatKind(vatCode: number | null): VatKind {
  if (vatCode === null) {
    return "unknown";
  }
  if (vatCode === VAT_STANDARD) {
    return "standard";
  }
  if (vatCode === VAT_EXEMPT) {
    return "exempt";
  }
  if (vatCode === VAT_NONE) {
    return "none";
  }
  return "other";
}
