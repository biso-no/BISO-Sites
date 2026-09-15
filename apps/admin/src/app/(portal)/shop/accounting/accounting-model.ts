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

export const REVENUE_ACCOUNT_MIN = 3000;
export const REVENUE_ACCOUNT_MAX = 3999;
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

/**
 * Why a synced ledger account cannot back a sales type, or null when it can.
 * Posting resolves no revenue target for an account without a synced VAT
 * code, so saving one would silently stop every sale under it from booking.
 */
export function ledgerAccountProblem(
  accountNumber: number,
  row: { active?: boolean | null; vat_code?: number | null } | null
): string | null {
  if (!row) {
    return `Account ${accountNumber} is not in the synced chart of accounts. Sync from Finago first.`;
  }
  if (row.active === false) {
    return `Account ${accountNumber} is inactive in Finago. Choose an active account.`;
  }
  if (typeof row.vat_code !== "number") {
    return `Account ${accountNumber} has no VAT code yet — sync accounts from Finago first.`;
  }
  return null;
}

type SyncedAccount = {
  active?: boolean | null;
  vat_code?: number | null;
} | null;

/** Short reason an account cannot be posted to, for a list of problems. */
function accountShortfall(
  row: SyncedAccount | undefined,
  needsVatCode: boolean
): string | null {
  if (!row) {
    return "is not in the synced chart of accounts";
  }
  if (row.active === false) {
    return "is inactive in Finago";
  }
  if (needsVatCode && typeof row.vat_code !== "number") {
    return "has no VAT code";
  }
  return null;
}

const CLEARING_PROVIDER_LABELS = { stripe: "Stripe", vipps: "Vipps" } as const;

/**
 * Why webshop posting cannot be switched on yet, or null when it can.
 *
 * Every active sales type's revenue account must pass the same check as
 * saving a sales type (`ledgerAccountProblem`: synced, active, with a VAT
 * code), since seeded sales types skip that check. Both clearing accounts
 * must be synced and active too — a mistyped one passes every check before
 * the Finago call and would strand orders at the "posting" marker. Clearing
 * accounts need no VAT code. `accounts` holds the synced `ledger_accounts`
 * rows by account number; a missing entry means "not synced".
 */
export function enablePostingRefusal({
  accounts,
  salesTypes,
  salesTypesTotal = salesTypes.length,
  settings,
}: {
  accounts: ReadonlyMap<number, SyncedAccount>;
  salesTypes: ReadonlyArray<{ account_number: number; label_no: string }>;
  /** Active sales types in the table; more than `salesTypes` means unchecked ones. */
  salesTypesTotal?: number;
  settings: Pick<ShopAccountingSettings, "clearingAccounts">;
}): string | null {
  if (salesTypes.length === 0) {
    return "Save the posting settings and add at least one active sales type before switching posting on";
  }
  if (salesTypesTotal > salesTypes.length) {
    return `There are ${salesTypesTotal} active sales types, more than can be checked at once (${salesTypes.length}). Deactivate unused sales types before switching posting on.`;
  }

  const problems: string[] = [];
  for (const salesType of salesTypes) {
    const row = accounts.get(salesType.account_number) ?? null;
    if (ledgerAccountProblem(salesType.account_number, row) === null) {
      continue;
    }
    const shortfall = accountShortfall(row, true);
    problems.push(
      `${salesType.label_no} (${salesType.account_number}) ${shortfall}`
    );
  }
  problems.push(...clearingAccountProblems(accounts, settings));

  return syncFirstMessage(problems);
}

function clearingAccountProblems(
  accounts: ReadonlyMap<number, SyncedAccount>,
  settings: Pick<ShopAccountingSettings, "clearingAccounts">
): string[] {
  const problems: string[] = [];
  for (const provider of ["vipps", "stripe"] as const) {
    const accountNumber = settings.clearingAccounts[provider];
    const shortfall = accountShortfall(accounts.get(accountNumber), false);
    if (shortfall) {
      problems.push(
        `${CLEARING_PROVIDER_LABELS[provider]} clearing account ${accountNumber} ${shortfall}`
      );
    }
  }
  return problems;
}

function syncFirstMessage(problems: string[]): string | null {
  return problems.length > 0
    ? `Sync accounts from Finago first: ${problems.join("; ")}.`
    : null;
}

/**
 * Why these clearing accounts cannot be saved while posting is on, or null.
 * Same rule as the enable guard: each must be synced and active (no VAT code
 * needed), or every order would fail at the Finago call and strand at the
 * "posting" marker.
 */
export function clearingAccountsRefusal({
  accounts,
  settings,
}: {
  accounts: ReadonlyMap<number, SyncedAccount>;
  settings: Pick<ShopAccountingSettings, "clearingAccounts">;
}): string | null {
  return syncFirstMessage(clearingAccountProblems(accounts, settings));
}

/**
 * Refusal for deactivating a sales type that live (published or pending
 * approval) products still book to, or null when none do. Posting skips an
 * inactive sales type, so those products would stop being booked.
 */
export function deactivationBlockedMessage(
  liveProducts: number
): string | null {
  if (liveProducts <= 0) {
    return null;
  }
  if (liveProducts === 1) {
    return "1 live product uses this sales type — move it to another sales type before deactivating it.";
  }
  return `${liveProducts} live products use this sales type — move them to another sales type before deactivating it.`;
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
