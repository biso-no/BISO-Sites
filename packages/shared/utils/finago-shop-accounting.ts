/**
 * Webshop → Finago ledger posting: the pure half.
 *
 * Decides what a paid order's Inntektsrapport voucher contains — which
 * clearing account is debited, which revenue accounts are credited with which
 * VAT code and department — from data that has already been loaded. No
 * Appwrite client and no Finago call, so every rule is unit-testable. The
 * loaders live in `finago-shop-accounting-server.ts`.
 */
import { z } from "zod";

export const SHOP_SETTINGS_TABLE = "shop_settings";
export const SHOP_ACCOUNTING_ROW_ID = "accounting";
export const SALES_TYPES_TABLE = "sales_types";
export const LEDGER_ACCOUNTS_TABLE = "ledger_accounts";

const MINOR_UNITS_PER_MAJOR = 100;
const COMMENT_MAX_LENGTH = 75;
const MIN_ACCOUNT_NUMBER = 1000;
const MAX_ACCOUNT_NUMBER = 9999;

const accountNumber = z
  .number()
  .int()
  .min(MIN_ACCOUNT_NUMBER)
  .max(MAX_ACCOUNT_NUMBER);

export const shopAccountingSettingsSchema = z.object({
  clearingAccounts: z.object({ stripe: accountNumber, vipps: accountNumber }),
  transactionTypeNumber: z.number().int().positive(),
});

export type ShopAccountingSettings = z.infer<
  typeof shopAccountingSettingsSchema
>;
export type ClearingProvider = keyof ShopAccountingSettings["clearingAccounts"];

/**
 * What the admin page pre-fills: the clearing accounts the ledger's payout
 * vouchers already clear (1530 Vipps, 1540 Stripe) and the voucher type the
 * WordPress-era monthly booking used (8, Inntektsrapport).
 */
export const DEFAULT_SHOP_ACCOUNTING_SETTINGS: ShopAccountingSettings = {
  clearingAccounts: { stripe: 1540, vipps: 1530 },
  transactionTypeNumber: 8,
};

export function parseShopAccountingSettings(
  general: string | null | undefined
): ShopAccountingSettings | null {
  if (!general) {
    return null;
  }
  try {
    const parsed = shopAccountingSettingsSchema.safeParse(JSON.parse(general));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function clearingProvider(
  provider: string | null | undefined
): ClearingProvider | null {
  const normalized = provider?.trim().toLowerCase();
  return normalized === "vipps" || normalized === "stripe" ? normalized : null;
}

export interface SalesTypeSeed {
  $id: string;
  account_number: number;
  label_en: string;
  label_no: string;
  sort_order: number;
}

export const SEED_SALES_TYPES: readonly SalesTypeSeed[] = [
  {
    $id: "egenandel",
    account_number: 3100,
    label_en: "Personal contribution (trips, events)",
    label_no: "Egenandel (turer, hytteturer, arrangementer)",
    sort_order: 10,
  },
  {
    $id: "varesalg",
    account_number: 3000,
    label_en: "Merchandise (25 % VAT)",
    label_no: "Varesalg – klær og merch (25 % mva)",
    sort_order: 20,
  },
  {
    $id: "bokskapleie",
    account_number: 3620,
    label_en: "Locker rental",
    label_no: "Bokskapleie",
    sort_order: 30,
  },
  {
    $id: "annet-avgiftsfritt",
    account_number: 3150,
    label_en: "Other VAT-exempt sales",
    label_no: "Annet avgiftsfritt salg",
    sort_order: 40,
  },
];

/** Where one order line's revenue is booked. */
export interface RevenueTarget {
  accountNumber: number;
  departmentId: string;
  /** Finago posting tax number, e.g. 3 (output VAT 25 %) or 5 (exempt). */
  vatCode: number;
}

export function revenueTargetKey(target: RevenueTarget): string {
  return `${target.accountNumber}|${target.departmentId}|${target.vatCode}`;
}

/** The target copied onto an order line at checkout, when the copy is complete. */
export function snapshotTarget(item: {
  finago_account_number?: unknown;
  finago_department?: unknown;
  finago_vat_code?: unknown;
}): RevenueTarget | null {
  const account = item.finago_account_number;
  const department = item.finago_department;
  const vatCode = item.finago_vat_code;
  if (
    typeof account === "number" &&
    typeof vatCode === "number" &&
    typeof department === "string" &&
    department
  ) {
    return { accountNumber: account, departmentId: department, vatCode };
  }
  return null;
}

export interface ShopPostingItem {
  name: string;
  quantity: number;
  target: RevenueTarget | null;
  unitPrice: number;
}

export interface ShopPostingLine extends RevenueTarget {
  /** Positive NOK, VAT-inclusive. */
  amount: number;
  comment: string;
}

export interface ResolvedShopPosting {
  campusId: string | null;
  clearingAccount: number;
  lines: ShopPostingLine[];
  total: number;
  transactionTypeNumber: number;
}

export type ShopPostingResolution =
  | { ok: true; posting: ResolvedShopPosting }
  | { ok: false; reason: string };

function toMinor(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

/**
 * Turns a paid order into the voucher to post, or explains why it cannot be
 * posted yet. Every refusal is a configuration gap an admin can fix; the
 * caller releases its claim so the sweep retries afterwards.
 */
export function resolveShopPosting(input: {
  campusId: string | null;
  items: ShopPostingItem[];
  provider: string | null;
  settings: ShopAccountingSettings | null;
  total: number;
}): ShopPostingResolution {
  if (!input.settings) {
    return {
      ok: false,
      reason: "Shop accounting settings have not been saved in admin",
    };
  }
  const provider = clearingProvider(input.provider);
  if (!provider) {
    return {
      ok: false,
      reason: `No clearing account for payment provider "${input.provider ?? "none"}"`,
    };
  }

  const groups = new Map<
    string,
    { amountMinor: number; names: string[]; target: RevenueTarget }
  >();
  for (const item of input.items) {
    const lineMinor = toMinor(item.unitPrice) * item.quantity;
    if (lineMinor <= 0) {
      continue;
    }
    if (!item.target) {
      return { ok: false, reason: `"${item.name}" has no sales type` };
    }
    const key = revenueTargetKey(item.target);
    const group = groups.get(key) ?? {
      amountMinor: 0,
      names: [],
      target: item.target,
    };
    group.amountMinor += lineMinor;
    group.names.push(`${item.name} ×${item.quantity}`);
    groups.set(key, group);
  }

  if (groups.size === 0) {
    return { ok: false, reason: "The order has no priced lines" };
  }

  const linesMinor = [...groups.values()].reduce(
    (sum, group) => sum + group.amountMinor,
    0
  );
  const totalMinor = toMinor(input.total);
  if (linesMinor !== totalMinor) {
    return {
      ok: false,
      reason: `Order lines sum to ${linesMinor / MINOR_UNITS_PER_MAJOR} kr but the order total is ${totalMinor / MINOR_UNITS_PER_MAJOR} kr`,
    };
  }

  const lines = [...groups.values()]
    .sort(
      (a, b) =>
        a.target.accountNumber - b.target.accountNumber ||
        a.target.departmentId.localeCompare(b.target.departmentId)
    )
    .map((group) => ({
      ...group.target,
      amount: group.amountMinor / MINOR_UNITS_PER_MAJOR,
      comment: group.names.join(", ").slice(0, COMMENT_MAX_LENGTH),
    }));

  return {
    ok: true,
    posting: {
      campusId: input.campusId,
      clearingAccount: input.settings.clearingAccounts[provider],
      lines,
      total: totalMinor / MINOR_UNITS_PER_MAJOR,
      transactionTypeNumber: input.settings.transactionTypeNumber,
    },
  };
}

/** The voucher date: today's calendar day in Oslo, as `YYYY-MM-DD`. */
export function ledgerDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
    year: "numeric",
  }).format(now);
}
