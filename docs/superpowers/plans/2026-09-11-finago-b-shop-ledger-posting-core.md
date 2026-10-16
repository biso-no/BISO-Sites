# Finago Plan B — Shop ledger posting core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A paid webshop order posts one Finago *Inntektsrapport* voucher — the provider's clearing account debited by the gross total, each sales type's revenue account credited with that account's VAT code and department/campus dimensions — configured from Appwrite rows instead of env vars, with refunds mirroring it exactly.

**Architecture:** A pure module (`finago-shop-accounting.ts`) decides the voucher from loaded data; a small server module loads settings, sales types and VAT codes from Appwrite; the connector builds and posts the Finago payload and reads no env or settings. Checkout copies account, VAT code and department onto each `order_items` row. The posting flow validates everything before its "posting" marker, so a configuration gap releases the claim and retries instead of stranding the order.

**Tech Stack:** TypeScript, Vitest (`@repo/shared`, `apps/api`), `bun test` (`@repo/connectors`), zod, Appwrite CLI 27.x, Finago REST `POST /transactions`.

**Spec:** `docs/superpowers/specs/2026-09-11-finago-shop-ledger-posting-design.md`

**Plan series:** A (`2026-09-11-finago-a-api-owned-payment-triggers.md`) → B (this plan) → C (`2026-09-11-finago-c-accounting-admin-and-rollout.md`). **B requires A merged** (Task 9 edits the API cron route A creates).

## Global Constraints

- Package manager is Bun (`bun@1.3.1`). Never use npm or pnpm.
- `bun run check-types` must pass; run `bun x ultracite fix` before each commit.
- Never hand-edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`; change the schema in Appwrite and regenerate.
- The API app owns every Finago call; the web app has none.
- Voucher type number **8** (Inntektsrapport). Clearing accounts **1530** (Vipps) and **1540** (Stripe). No fee lines.
- Dimension types: Department = **2**, Campus = **101** (code constants).
- VAT codes are Finago tax **numbers** (3 = output VAT 25 %, 5 = VAT-exempt sale), never tax ids.
- `order_items` copies `finago_account_number`, `finago_vat_code`, `finago_department` at checkout; posting and refunds prefer the copy and fall back to the product's current sales type.
- Tests never call Finago, Vipps or Stripe.
- Every commit message ends with exactly these two lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv`

---

### Task 1: Schema — sales types and ledger snapshot columns (owner-gated)

> **STOP before Step 2.** Steps 2–4 write to the production Appwrite project (`biso` at `https://appwrite.biso.no/v1`). They are additive (one new table, four new optional columns) but still require the owner's explicit go-ahead in the conversation.

**Files:**
- Regenerate: `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts`

**Interfaces:**
- Produces tables/columns later tasks rely on:
  - `sales_types`: `label_no` string(80) required, `label_en` string(80) required, `account_number` integer required (1000–9999), `active` boolean default true, `sort_order` integer default 0. Permissions: Operations Unit create/read/update/delete. Row security off.
  - `webshop_products.sales_type` string(36), optional.
  - `order_items.finago_vat_code` integer, optional; `order_items.finago_department` string(10), optional.
  - `ledger_accounts.vat_code` integer, optional.
- Produces generated types `SalesTypes`, and `sales_type` / `finago_vat_code` / `finago_department` / `vat_code` fields on `WebshopProducts`, `OrderItems`, `LedgerAccounts`.

- [ ] **Step 1: Confirm the CLI targets the right project**

Run: `cd packages/api && appwrite tables-db list-columns --database-id app --table-id ledger_accounts --json | head -20`
Expected: JSON listing `account_number`, `name`, `tax_code`, `active`, `synced_at`. If it reports an auth error, ask the owner to run `! appwrite login` and retry.

- [ ] **Step 2: Create the `sales_types` table**

```bash
cd packages/api
appwrite tables-db create-table --database-id app --table-id sales_types --name "Sales types" --enabled \
  --permissions 'create("team:sg-app-dept-operationsunit")' \
  --permissions 'read("team:sg-app-dept-operationsunit")' \
  --permissions 'update("team:sg-app-dept-operationsunit")' \
  --permissions 'delete("team:sg-app-dept-operationsunit")'
appwrite tables-db create-string-column --database-id app --table-id sales_types --key label_no --size 80 --required
appwrite tables-db create-string-column --database-id app --table-id sales_types --key label_en --size 80 --required
appwrite tables-db create-integer-column --database-id app --table-id sales_types --key account_number --required --min 1000 --max 9999
appwrite tables-db create-boolean-column --database-id app --table-id sales_types --key active --xdefault
appwrite tables-db create-integer-column --database-id app --table-id sales_types --key sort_order --xdefault 0
```

- [ ] **Step 3: Add the snapshot and reference columns**

```bash
cd packages/api
appwrite tables-db create-string-column --database-id app --table-id webshop_products --key sales_type --size 36
appwrite tables-db create-integer-column --database-id app --table-id order_items --key finago_vat_code
appwrite tables-db create-string-column --database-id app --table-id order_items --key finago_department --size 10
appwrite tables-db create-integer-column --database-id app --table-id ledger_accounts --key vat_code
```

- [ ] **Step 4: Wait until every new column is available**

Run each and check every new key reports `"status": "available"`:

```bash
cd packages/api
appwrite tables-db list-columns --database-id app --table-id sales_types --json
appwrite tables-db list-columns --database-id app --table-id webshop_products --json | grep -A3 '"sales_type"'
appwrite tables-db list-columns --database-id app --table-id order_items --json | grep -A3 'finago_'
appwrite tables-db list-columns --database-id app --table-id ledger_accounts --json | grep -A3 '"vat_code"'
```

- [ ] **Step 5: Regenerate the config and types**

```bash
cd packages/api
appwrite pull table
appwrite types -l ts ./types
```

When `appwrite pull table` prompts, select all tables in database `app`.

Run: `grep -n "sales_type\|finago_vat_code\|finago_department\|vat_code\|export type SalesTypes" packages/api/types/appwrite.ts`
Expected: `export type SalesTypes = Models.Row & {`, `sales_type: string | null;`, `finago_vat_code: number | null;`, `finago_department: string | null;`, `vat_code: number | null;`

Run: `git diff --stat packages/api`
Expected: only `appwrite.config.json` and `types/appwrite.ts`. If the diff contains unrelated tables, keep them (they are the live schema) but list them for the owner in the task report.

- [ ] **Step 6: Run the config tests and type check**

Run: `cd packages/api && bun run test`
Expected: PASS

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/api/appwrite.config.json packages/api/types/appwrite.ts
git commit -F - <<'EOF'
Add sales types and ledger snapshot columns to the schema

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 2: `shop_ledger_posting` kill switch

**Files:**
- Modify: `packages/shared/utils/feature-flags.ts`
- Test: `packages/shared/utils/feature-flags.test.ts`

**Interfaces:**
- Produces: `FeatureFlagKey` includes `"shop_ledger_posting"` (default **off**, group `payments`).

- [ ] **Step 1: Write the failing test**

Append inside the `describe("FEATURE_FLAGS catalog", …)` block in `packages/shared/utils/feature-flags.test.ts`:

```ts
  it("keeps shop ledger posting off until it is switched on", () => {
    const flag = FEATURE_FLAGS.find((f) => f.key === "shop_ledger_posting");
    expect(flag?.group).toBe("payments");
    expect(flag?.defaultEnabled).toBe(false);
    expect(mergeFlagStates([]).shop_ledger_posting).toBe(false);
  });
```

If `mergeFlagStates` is not yet imported at the top of that file, add it to the existing import from `./feature-flags`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test utils/feature-flags.test.ts`
Expected: FAIL — `expected undefined to be 'payments'`

- [ ] **Step 3: Add the flag**

In `packages/shared/utils/feature-flags.ts`, insert after the `payments_stripe` entry:

```ts
  {
    key: "shop_ledger_posting",
    group: "payments",
    title: "Webshop → Finago ledger posting",
    description:
      "Post every paid webshop order to Finago as an Inntektsrapport voucher " +
      "(clearing account against the sales type's revenue account). Off by " +
      "default; turn on once sales types and shop accounting settings are " +
      "saved. When off, paid orders wait and are posted after it is turned on.",
    defaultEnabled: false,
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test utils/feature-flags.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/feature-flags.ts packages/shared/utils/feature-flags.test.ts
git commit -F - <<'EOF'
Add the shop ledger posting kill switch

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 3: Pure shop accounting module

**Files:**
- Create: `packages/shared/utils/finago-shop-accounting.ts`
- Test: `packages/shared/utils/finago-shop-accounting.test.ts`

**Interfaces:**
- Produces (all exported from `@repo/shared/utils/finago-shop-accounting`):
  - Constants: `SHOP_SETTINGS_TABLE = "shop_settings"`, `SHOP_ACCOUNTING_ROW_ID = "accounting"`, `SALES_TYPES_TABLE = "sales_types"`, `LEDGER_ACCOUNTS_TABLE = "ledger_accounts"`.
  - `shopAccountingSettingsSchema` (zod), `type ShopAccountingSettings = { clearingAccounts: { stripe: number; vipps: number }; transactionTypeNumber: number }`, `type ClearingProvider = "stripe" | "vipps"`.
  - `DEFAULT_SHOP_ACCOUNTING_SETTINGS: ShopAccountingSettings` (`{ clearingAccounts: { stripe: 1540, vipps: 1530 }, transactionTypeNumber: 8 }`).
  - `parseShopAccountingSettings(general: string | null | undefined): ShopAccountingSettings | null`
  - `clearingProvider(provider: string | null | undefined): ClearingProvider | null`
  - `interface SalesTypeSeed { $id: string; account_number: number; label_en: string; label_no: string; sort_order: number }`, `SEED_SALES_TYPES: readonly SalesTypeSeed[]`
  - `interface RevenueTarget { accountNumber: number; departmentId: string; vatCode: number }`
  - `revenueTargetKey(target: RevenueTarget): string`
  - `snapshotTarget(item: { finago_account_number?: unknown; finago_department?: unknown; finago_vat_code?: unknown }): RevenueTarget | null`
  - `interface ShopPostingItem { name: string; quantity: number; target: RevenueTarget | null; unitPrice: number }`
  - `interface ShopPostingLine extends RevenueTarget { amount: number; comment: string }`
  - `interface ResolvedShopPosting { campusId: string | null; clearingAccount: number; lines: ShopPostingLine[]; total: number; transactionTypeNumber: number }`
  - `type ShopPostingResolution = { ok: true; posting: ResolvedShopPosting } | { ok: false; reason: string }`
  - `resolveShopPosting(input: { campusId: string | null; items: ShopPostingItem[]; provider: string | null; settings: ShopAccountingSettings | null; total: number }): ShopPostingResolution`
  - `ledgerDate(now?: Date): string` — `YYYY-MM-DD` in Europe/Oslo.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/utils/finago-shop-accounting.test.ts
import { describe, expect, it } from "vitest";
import {
  clearingProvider,
  DEFAULT_SHOP_ACCOUNTING_SETTINGS,
  ledgerDate,
  parseShopAccountingSettings,
  type RevenueTarget,
  resolveShopPosting,
  revenueTargetKey,
  SEED_SALES_TYPES,
  snapshotTarget,
} from "./finago-shop-accounting";

const SWEATER: RevenueTarget = {
  accountNumber: 3000,
  departmentId: "44",
  vatCode: 3,
};
const TRIP: RevenueTarget = {
  accountNumber: 3100,
  departmentId: "21",
  vatCode: 5,
};

describe("parseShopAccountingSettings", () => {
  it("reads saved settings", () => {
    expect(
      parseShopAccountingSettings(
        JSON.stringify(DEFAULT_SHOP_ACCOUNTING_SETTINGS)
      )
    ).toEqual({
      clearingAccounts: { stripe: 1540, vipps: 1530 },
      transactionTypeNumber: 8,
    });
  });

  it("rejects missing, malformed and out-of-range settings", () => {
    expect(parseShopAccountingSettings(null)).toBeNull();
    expect(parseShopAccountingSettings("{not json")).toBeNull();
    expect(
      parseShopAccountingSettings(
        JSON.stringify({
          clearingAccounts: { stripe: 1540, vipps: 99 },
          transactionTypeNumber: 8,
        })
      )
    ).toBeNull();
  });
});

describe("clearingProvider", () => {
  it("normalises the providers that have a clearing account", () => {
    expect(clearingProvider("Vipps")).toBe("vipps");
    expect(clearingProvider("stripe")).toBe("stripe");
  });

  it("returns null for anything else", () => {
    expect(clearingProvider("Nets Easy")).toBeNull();
    expect(clearingProvider(null)).toBeNull();
  });
});

describe("snapshotTarget", () => {
  it("reads a complete copy from an order line", () => {
    expect(
      snapshotTarget({
        finago_account_number: 3000,
        finago_department: "44",
        finago_vat_code: 3,
      })
    ).toEqual(SWEATER);
  });

  it("ignores an incomplete copy", () => {
    expect(
      snapshotTarget({ finago_account_number: 3000, finago_department: "44" })
    ).toBeNull();
    expect(
      snapshotTarget({
        finago_account_number: 3000,
        finago_department: "",
        finago_vat_code: 3,
      })
    ).toBeNull();
  });
});

describe("resolveShopPosting", () => {
  const base = {
    campusId: "1",
    provider: "vipps",
    settings: DEFAULT_SHOP_ACCOUNTING_SETTINGS,
  };

  it("debits the Vipps clearing account and credits the sales type's account", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        {
          name: "Gensere til børsgruppen",
          quantity: 1,
          target: SWEATER,
          unitPrice: 490,
        },
      ],
      total: 490,
    });

    expect(result).toEqual({
      ok: true,
      posting: {
        campusId: "1",
        clearingAccount: 1530,
        lines: [
          {
            ...SWEATER,
            amount: 490,
            comment: "Gensere til børsgruppen ×1",
          },
        ],
        total: 490,
        transactionTypeNumber: 8,
      },
    });
  });

  it("groups lines that share a target and keeps other targets apart", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        { name: "Genser S", quantity: 2, target: SWEATER, unitPrice: 299 },
        { name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 },
        { name: "Genser M", quantity: 1, target: SWEATER, unitPrice: 299 },
      ],
      total: 1397,
    });

    expect(result.ok && result.posting.lines).toEqual([
      { ...SWEATER, amount: 897, comment: "Genser S ×2, Genser M ×1" },
      { ...TRIP, amount: 500, comment: "Hyttetur ×1" },
    ]);
  });

  it("uses the Stripe clearing account for a Stripe order", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      provider: "stripe",
      total: 500,
    });
    expect(result.ok && result.posting.clearingAccount).toBe(1540);
  });

  it("ignores free lines", () => {
    const result = resolveShopPosting({
      ...base,
      items: [
        { name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 },
        { name: "Gratis genser", quantity: 1, target: null, unitPrice: 0 },
      ],
      total: 500,
    });
    expect(result.ok && result.posting.lines).toHaveLength(1);
  });

  it("refuses without saved settings", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      settings: null,
      total: 500,
    });
    expect(result).toEqual({
      ok: false,
      reason: "Shop accounting settings have not been saved in admin",
    });
  });

  it("refuses a provider with no clearing account", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      provider: "Nets Easy",
      total: 500,
    });
    expect(result).toEqual({
      ok: false,
      reason: 'No clearing account for payment provider "Nets Easy"',
    });
  });

  it("refuses a priced line without a sales type", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hoodie", quantity: 1, target: null, unitPrice: 400 }],
      total: 400,
    });
    expect(result).toEqual({ ok: false, reason: '"Hoodie" has no sales type' });
  });

  it("refuses an order with no priced lines", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Gratis", quantity: 1, target: TRIP, unitPrice: 0 }],
      total: 0,
    });
    expect(result).toEqual({
      ok: false,
      reason: "The order has no priced lines",
    });
  });

  it("refuses lines that do not add up to the order total", () => {
    const result = resolveShopPosting({
      ...base,
      items: [{ name: "Hyttetur", quantity: 1, target: TRIP, unitPrice: 500 }],
      total: 450,
    });
    expect(result).toEqual({
      ok: false,
      reason: "Order lines sum to 500 kr but the order total is 450 kr",
    });
  });
});

describe("revenueTargetKey", () => {
  it("distinguishes the same account in different departments", () => {
    expect(revenueTargetKey(SWEATER)).not.toBe(
      revenueTargetKey({ ...SWEATER, departmentId: "16" })
    );
  });
});

describe("ledgerDate", () => {
  it("uses the Oslo calendar day", () => {
    expect(ledgerDate(new Date("2026-09-10T22:30:00Z"))).toBe("2026-09-11");
    expect(ledgerDate(new Date("2026-01-15T12:00:00Z"))).toBe("2026-01-15");
  });
});

describe("SEED_SALES_TYPES", () => {
  it("seeds the four approved sales types with unique ids", () => {
    expect(SEED_SALES_TYPES.map((type) => type.account_number)).toEqual([
      3100, 3000, 3620, 3150,
    ]);
    expect(new Set(SEED_SALES_TYPES.map((type) => type.$id)).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test utils/finago-shop-accounting.test.ts`
Expected: FAIL — `Failed to resolve import "./finago-shop-accounting"`

- [ ] **Step 3: Write the module**

```ts
// packages/shared/utils/finago-shop-accounting.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test utils/finago-shop-accounting.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/finago-shop-accounting.ts packages/shared/utils/finago-shop-accounting.test.ts
git commit -F - <<'EOF'
Decide webshop voucher lines from sales types and settings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 4: Connector voucher builders and transport

Adds the new builders next to the old shop functions. The old ones are removed in Task 8, once nothing calls them.

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/rest/departments.ts`
- Modify: `packages/connectors/src/24sevenoffice/rest/transactions.ts`
- Modify: `packages/connectors/src/24sevenoffice/rest/index.ts`
- Modify: `packages/connectors/src/24sevenoffice/index.ts`
- Test: `packages/connectors/src/24sevenoffice/rest/transactions.test.ts`

**Interfaces:**
- Produces (exported from `@repo/connectors/24sevenoffice`):
  - `CAMPUS_DIMENSION_TYPE = 101`
  - `interface ShopLedgerLine { accountNumber: number; amount: number; comment?: string; departmentId: string; vatCode: number }`
  - `interface BuildShopTransactionParams { campusId?: string | null; clearingAccount: number; comment: string; date: string; lines: ShopLedgerLine[]; total: number; transactionTypeNumber: number }`
  - `buildShopTransactionInput(params: BuildShopTransactionParams): TransactionInput` — clearing line first (`+total`, tax 0, Campus dimension), then revenue lines (`-amount`, `tax.number = vatCode`, Department + Campus dimensions).
  - `buildShopReversalTransactionInput(params: BuildShopTransactionParams): TransactionInput` — same lines, every amount negated.
  - `type ShopTransactionInput` (the Finago `TransactionInput` schema type)
  - `postLedgerTransaction(input: ShopTransactionInput): Promise<string>` — returns the Finago transaction id.

- [ ] **Step 1: Write the failing tests**

In `packages/connectors/src/24sevenoffice/rest/transactions.test.ts`, change the import to:

```ts
import {
  buildExpenseTransactionInput,
  buildShopRefundTransactionInput,
  buildShopReversalTransactionInput,
  buildShopTransactionInput,
} from "./transactions";
```

Add below the existing regex constants:

```ts
const UNBALANCED_VOUCHER_ERROR = /unbalanced voucher/i;
const EMPTY_VOUCHER_ERROR = /at least one revenue line/i;
```

Append at the end of the file:

```ts
describe("buildShopTransactionInput", () => {
  const base = {
    campusId: "1",
    clearingAccount: 1530,
    comment: "Nettbutikk order-1",
    date: "2026-09-11",
    lines: [
      {
        accountNumber: 3000,
        amount: 490,
        comment: "Gensere til børsgruppen ×1",
        departmentId: "44",
        vatCode: 3,
      },
      { accountNumber: 3100, amount: 250, departmentId: "21", vatCode: 5 },
    ],
    total: 740,
    transactionTypeNumber: 8,
  };

  test("debits the clearing account by the gross total", () => {
    const input = buildShopTransactionInput(base);
    expect(input.transactionTypeNumber).toBe(8);
    expect(input.date).toBe("2026-09-11");
    expect(input.lines[0]).toEqual({
      accountNumber: 1530,
      amount: 740,
      comment: "Nettbutikk order-1",
      dimensions: [{ dimensionType: 101, value: "1" }],
      tax: { number: 0 },
    });
  });

  test("credits each revenue line with its VAT code, department and campus", () => {
    const input = buildShopTransactionInput(base);
    expect(input.lines[1]).toEqual({
      accountNumber: 3000,
      amount: -490,
      comment: "Gensere til børsgruppen ×1",
      dimensions: [
        { dimensionType: 2, value: "44" },
        { dimensionType: 101, value: "1" },
      ],
      tax: { number: 3 },
    });
    expect(input.lines[2]?.tax).toEqual({ number: 5 });
  });

  test("balances to zero", () => {
    const input = buildShopTransactionInput(base);
    const sum = input.lines.reduce((acc, line) => acc + line.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(0);
  });

  test("omits the campus dimension when the order has no campus", () => {
    const input = buildShopTransactionInput({ ...base, campusId: null });
    expect(input.lines[0]?.dimensions).toBeUndefined();
    expect(input.lines[1]?.dimensions).toEqual([
      { dimensionType: 2, value: "44" },
    ]);
  });

  test("refuses lines that do not cover the total", () => {
    expect(() => buildShopTransactionInput({ ...base, total: 999 })).toThrow(
      UNBALANCED_VOUCHER_ERROR
    );
  });

  test("refuses an empty voucher", () => {
    expect(() =>
      buildShopTransactionInput({ ...base, lines: [], total: 0 })
    ).toThrow(EMPTY_VOUCHER_ERROR);
  });
});

describe("buildShopReversalTransactionInput", () => {
  const base = {
    campusId: "1",
    clearingAccount: 1540,
    comment: "Refusjon nettbutikk order-1",
    date: "2026-09-12",
    lines: [
      { accountNumber: 3000, amount: 299, departmentId: "16", vatCode: 3 },
    ],
    total: 299,
    transactionTypeNumber: 8,
  };

  test("mirrors the sale with every sign flipped", () => {
    const sale = buildShopTransactionInput(base);
    const reversal = buildShopReversalTransactionInput(base);
    expect(reversal.lines.map((line) => line.amount)).toEqual(
      sale.lines.map((line) => -line.amount)
    );
  });

  test("keeps VAT codes and dimensions", () => {
    const reversal = buildShopReversalTransactionInput(base);
    expect(reversal.lines[1]).toEqual(
      expect.objectContaining({
        accountNumber: 3000,
        dimensions: [
          { dimensionType: 2, value: "16" },
          { dimensionType: 101, value: "1" },
        ],
        tax: { number: 3 },
      })
    );
  });

  test("refuses a reversal whose lines do not cover the refund", () => {
    expect(() =>
      buildShopReversalTransactionInput({ ...base, total: 300 })
    ).toThrow(UNBALANCED_VOUCHER_ERROR);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/transactions.test.ts`
Expected: FAIL — `buildShopTransactionInput` is not exported

- [ ] **Step 3: Add the campus dimension constant**

In `packages/connectors/src/24sevenoffice/rest/departments.ts`, directly below `export const DEPARTMENT_DIMENSION_TYPE = 2;` add:

```ts
/** Campus dimension type; element values are the app's campus ids "1".."5". */
export const CAMPUS_DIMENSION_TYPE = 101;
```

- [ ] **Step 4: Add the builders and transport**

In `packages/connectors/src/24sevenoffice/rest/transactions.ts`, change the departments import to:

```ts
import { CAMPUS_DIMENSION_TYPE, DEPARTMENT_DIMENSION_TYPE } from "./departments";
```

Append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// Webshop vouchers (Inntektsrapport)
// ---------------------------------------------------------------------------

export type ShopTransactionInput = TransactionInputT;

/** One revenue line of a webshop voucher. */
export interface ShopLedgerLine {
  accountNumber: number;
  /** Positive NOK, VAT-inclusive. */
  amount: number;
  comment?: string;
  /** The Finago department dimension value (`departments.Id`). */
  departmentId: string;
  /** Finago posting tax number, e.g. 3 (output VAT 25 %) or 5 (exempt). */
  vatCode: number;
}

export interface BuildShopTransactionParams {
  campusId?: string | null;
  /** The payment provider's clearing account, e.g. 1530 (Vipps). */
  clearingAccount: number;
  comment: string;
  date: string;
  lines: ShopLedgerLine[];
  /** Positive NOK the revenue lines must add up to exactly. */
  total: number;
  transactionTypeNumber: number;
}

function shopDimensions(
  departmentId: string | null,
  campusId: string | null | undefined
): DimensionT[] | undefined {
  const dimensions: DimensionT[] = [];
  if (departmentId) {
    dimensions.push({
      dimensionType: DEPARTMENT_DIMENSION_TYPE,
      value: departmentId,
    });
  }
  if (campusId) {
    dimensions.push({
      dimensionType: CAMPUS_DIMENSION_TYPE,
      value: String(campusId),
    });
  }
  return dimensions.length > 0 ? dimensions : undefined;
}

function assertShopLinesCoverTotal(params: BuildShopTransactionParams): void {
  if (params.lines.length === 0) {
    throw new Error(
      "[Finago] A shop voucher needs at least one revenue line"
    );
  }
  const linesMinor = params.lines.reduce(
    (sum, line) => sum + Math.round(line.amount * CENTS),
    0
  );
  const totalMinor = Math.round(params.total * CENTS);
  if (linesMinor !== totalMinor) {
    throw new Error(
      `[Finago] Shop lines cover ${linesMinor} of ${totalMinor} øre — refusing to post an unbalanced voucher`
    );
  }
}

function shopLines(
  params: BuildShopTransactionParams,
  sign: 1 | -1
): TransactionLineT[] {
  assertShopLinesCoverTotal(params);
  const clearingLine: TransactionLineT = {
    accountNumber: params.clearingAccount,
    amount: sign * round2(params.total),
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    dimensions: shopDimensions(null, params.campusId),
    tax: { number: 0 },
  };
  const revenueLines: TransactionLineT[] = params.lines.map((line) => ({
    accountNumber: line.accountNumber,
    amount: -sign * round2(line.amount),
    comment: line.comment?.slice(0, COMMENT_MAX_LENGTH),
    dimensions: shopDimensions(line.departmentId, params.campusId),
    tax: { number: line.vatCode },
  }));
  return [clearingLine, ...revenueLines];
}

/**
 * A webshop sale: debit the provider's clearing account by the gross total,
 * credit each revenue line with its own VAT code. Finago books the VAT part of
 * a VAT-coded line to 2700. The payout voucher later credits the clearing
 * account by the gross amount and books the fee, so no fee line belongs here.
 */
export function buildShopTransactionInput(
  params: BuildShopTransactionParams
): ShopTransactionInput {
  return {
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    date: params.date,
    lines: shopLines(params, 1),
    transactionTypeNumber: params.transactionTypeNumber,
  };
}

/** A webshop refund: the exact mirror of `buildShopTransactionInput`. */
export function buildShopReversalTransactionInput(
  params: BuildShopTransactionParams
): ShopTransactionInput {
  return {
    comment: params.comment.slice(0, COMMENT_MAX_LENGTH),
    date: params.date,
    lines: shopLines(params, -1),
    transactionTypeNumber: params.transactionTypeNumber,
  };
}

/** Posts a prebuilt voucher to the general ledger and returns its id. */
export async function postLedgerTransaction(
  input: ShopTransactionInput
): Promise<string> {
  const { data, error } = await finago.POST("/transactions", {
    body: input,
    params: { header: { Authorization: "" } },
  });
  if (error || !data) {
    throw new Error(
      `[Finago] POST /transactions failed: ${JSON.stringify(error)}`
    );
  }
  return data.transactionId;
}
```

- [ ] **Step 5: Export the new API**

In `packages/connectors/src/24sevenoffice/rest/index.ts`, replace the departments and transactions export blocks with:

```ts
export {
  CAMPUS_DIMENSION_TYPE,
  DEPARTMENT_DIMENSION_TYPE,
  type DimensionElement,
  getDepartments,
} from "./departments";
export {
  type UploadDocumentResult,
  uploadDocument,
} from "./files";
export {
  type BuildExpenseTransactionParams,
  type BuildShopTransactionParams,
  buildExpenseTransactionInput,
  buildShopRefundTransactionInput,
  buildShopReversalTransactionInput,
  buildShopTransactionInput,
  type ExpenseReceiptLine,
  type PostExpenseTransactionParams,
  postExpenseTransaction,
  postLedgerTransaction,
  postShopRefundTransaction,
  postShopTransaction,
  type ShopLedgerLine,
  type ShopRefundTransactionParams,
  type ShopTransactionInput,
  type ShopTransactionParams,
} from "./transactions";
```

(Keep the existing `./accounts` export block above them unchanged.)

In `packages/connectors/src/24sevenoffice/index.ts`, replace the `// Finago REST API` export block with:

```ts
// Finago REST API
export {
  type BuildExpenseTransactionParams,
  type BuildShopTransactionParams,
  buildExpenseTransactionInput,
  buildShopRefundTransactionInput,
  buildShopReversalTransactionInput,
  buildShopTransactionInput,
  CAMPUS_DIMENSION_TYPE,
  DEPARTMENT_DIMENSION_TYPE,
  type DimensionElement,
  type ExpenseReceiptLine,
  getDepartments,
  type LedgerAccount,
  listAccounts,
  listTaxes,
  type PostExpenseTransactionParams,
  postExpenseTransaction,
  postLedgerTransaction,
  postShopRefundTransaction,
  postShopTransaction,
  type ShopLedgerLine,
  type ShopRefundTransactionParams,
  type ShopTransactionInput,
  type ShopTransactionParams,
  type TaxCode,
  type UploadDocumentResult,
  uploadDocument,
} from "./rest";
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/transactions.test.ts`
Expected: PASS (all expense, old refund and new shop suites)

Run: `cd packages/connectors && bun run check-types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/connectors/src/24sevenoffice
git commit -F - <<'EOF'
Build webshop vouchers with VAT codes and campus dimensions

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 5: Server loaders and the order-line snapshot fields

**Files:**
- Modify: `packages/shared/utils/order-parsing.ts`
- Create: `packages/shared/utils/finago-shop-accounting-server.ts`
- Test: `packages/shared/utils/finago-shop-accounting-server.test.ts`

**Interfaces:**
- Consumes: Task 3 exports; `DbClient` from `./vipps-order-ops`; generated `WebshopProducts` (Task 1).
- Produces (exported from `@repo/shared/utils/finago-shop-accounting-server`):
  - `interface SalesTypeRow { $id: string; account_number: number; active?: boolean | null; label_en: string; label_no: string; sort_order?: number | null }`
  - `loadShopAccountingSettings(db: DbClient): Promise<ShopAccountingSettings | null>`
  - `loadVatCodeForAccount(db: DbClient, accountNumber: number): Promise<number | null>`
  - `resolveRevenueTarget(db: DbClient, product: Pick<WebshopProducts, "departmentId" | "sales_type">): Promise<RevenueTarget | null>` — never throws.
  - `resolveRevenueTargetForProduct(db: DbClient, productId: string): Promise<RevenueTarget | null>` — never throws.
  - `resolveItemTargets(db: DbClient, items: ParsedOrderItem[]): Promise<Array<RevenueTarget | null>>` — snapshot first, product fallback, one product read per product id.
  - `hasFinagoRestCredentials(): boolean`
- Produces: `ParsedOrderItem` gains `finago_account_number?`, `finago_department?`, `finago_vat_code?`, copied from relational `order_items` rows.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/utils/finago-shop-accounting-server.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SHOP_ACCOUNTING_SETTINGS } from "./finago-shop-accounting";
import {
  hasFinagoRestCredentials,
  loadShopAccountingSettings,
  resolveItemTargets,
  resolveRevenueTargetForProduct,
} from "./finago-shop-accounting-server";
import { getOrderItems } from "./order-parsing";

const ROWS: Record<string, Record<string, unknown>> = {
  "shop_settings/accounting": {
    general: JSON.stringify(DEFAULT_SHOP_ACCOUNTING_SETTINGS),
  },
  "webshop_products/p-sweater": { departmentId: "44", sales_type: "varesalg" },
  "webshop_products/p-trip": { departmentId: "21", sales_type: "egenandel" },
  "webshop_products/p-untyped": { departmentId: "21", sales_type: null },
  "webshop_products/p-locker": { departmentId: "1", sales_type: "bokskapleie" },
  "sales_types/varesalg": { account_number: 3000, active: true },
  "sales_types/egenandel": { account_number: 3100, active: false },
  "sales_types/bokskapleie": { account_number: 3620, active: true },
  "ledger_accounts/3000": { vat_code: 3 },
  "ledger_accounts/3100": { vat_code: 5 },
};

function fakeDb(rows: Record<string, Record<string, unknown>> = ROWS) {
  return {
    createRow: vi.fn(),
    deleteRow: vi.fn(),
    getRow: vi.fn((_db: string, table: string, id: string) => {
      const row = rows[`${table}/${id}`];
      return row
        ? Promise.resolve(row)
        : Promise.reject(Object.assign(new Error("row_not_found"), { code: 404 }));
    }),
    listRows: vi.fn(),
    updateRow: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadShopAccountingSettings", () => {
  it("reads the saved settings row", async () => {
    expect(await loadShopAccountingSettings(fakeDb())).toEqual(
      DEFAULT_SHOP_ACCOUNTING_SETTINGS
    );
  });

  it("returns null when nothing has been saved", async () => {
    expect(await loadShopAccountingSettings(fakeDb({}))).toBeNull();
  });
});

describe("resolveRevenueTargetForProduct", () => {
  it("resolves account, VAT code and department from the sales type", async () => {
    expect(await resolveRevenueTargetForProduct(fakeDb(), "p-sweater")).toEqual({
      accountNumber: 3000,
      departmentId: "44",
      vatCode: 3,
    });
  });

  it("returns null for an inactive or missing sales type", async () => {
    const db = fakeDb();
    expect(await resolveRevenueTargetForProduct(db, "p-trip")).toBeNull();
    expect(await resolveRevenueTargetForProduct(db, "p-untyped")).toBeNull();
    expect(await resolveRevenueTargetForProduct(db, "unknown")).toBeNull();
  });

  it("returns null when the account has no synced VAT code", async () => {
    expect(await resolveRevenueTargetForProduct(fakeDb(), "p-locker")).toBeNull();
  });
});

describe("resolveItemTargets", () => {
  it("prefers the checkout copy over the product's current sales type", async () => {
    const targets = await resolveItemTargets(fakeDb(), [
      {
        finago_account_number: 3100,
        finago_department: "1",
        finago_vat_code: 5,
        product_id: "p-sweater",
      },
    ]);
    expect(targets).toEqual([
      { accountNumber: 3100, departmentId: "1", vatCode: 5 },
    ]);
  });

  it("reads each product once when several lines share it", async () => {
    const db = fakeDb();
    const targets = await resolveItemTargets(db, [
      { product_id: "p-sweater" },
      { product_id: "p-sweater" },
      { product_id: null },
    ]);
    expect(targets).toEqual([
      { accountNumber: 3000, departmentId: "44", vatCode: 3 },
      { accountNumber: 3000, departmentId: "44", vatCode: 3 },
      null,
    ]);
    const productReads = db.getRow.mock.calls.filter(
      (call) => call[1] === "webshop_products"
    );
    expect(productReads).toHaveLength(1);
  });
});

describe("getOrderItems snapshot fields", () => {
  it("carries the ledger copy from relational order lines", () => {
    const [item] = getOrderItems({
      order_items: [
        {
          $id: "line-1",
          finago_account_number: 3000,
          finago_department: "44",
          finago_vat_code: 3,
          name: "Genser",
          quantity: 1,
          unit_price: 490,
        },
      ],
    });
    expect(item).toEqual(
      expect.objectContaining({
        finago_account_number: 3000,
        finago_department: "44",
        finago_vat_code: 3,
      })
    );
  });
});

describe("hasFinagoRestCredentials", () => {
  it("is true only when all three REST credentials are set", () => {
    vi.stubEnv("TFSO_REST_CLIENT_ID", "id");
    vi.stubEnv("TFSO_REST_CLIENT_SECRET", "secret");
    vi.stubEnv("TFSO_REST_ORG_ID", "org");
    expect(hasFinagoRestCredentials()).toBe(true);
    vi.stubEnv("TFSO_REST_ORG_ID", "");
    expect(hasFinagoRestCredentials()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test utils/finago-shop-accounting-server.test.ts`
Expected: FAIL — `Failed to resolve import "./finago-shop-accounting-server"`

- [ ] **Step 3: Carry the snapshot fields through order parsing**

In `packages/shared/utils/order-parsing.ts`:

In `interface ParsedOrderItem`, add after `custom_fields?`:

```ts
  /** Ledger copy made at checkout; see `snapshotTarget`. */
  finago_account_number?: number | null;
  finago_department?: string | null;
  finago_vat_code?: number | null;
```

In `interface RelationalOrderItem`, add after `field_answers?`:

```ts
  finago_account_number?: number | null;
  finago_department?: string | null;
  finago_vat_code?: number | null;
```

In `normalizeRelationalOrderItem`, add to the returned object after `duration: item.duration,`:

```ts
    finago_account_number: item.finago_account_number,
    finago_department: item.finago_department,
    finago_vat_code: item.finago_vat_code,
```

- [ ] **Step 4: Write the server module**

```ts
// packages/shared/utils/finago-shop-accounting-server.ts
/**
 * Webshop → Finago ledger posting: the loaders.
 *
 * Reads shop accounting settings, sales types and synced VAT codes from
 * Appwrite through whichever client the caller holds. Every loader answers
 * `null` rather than throwing: a missing row or a transient read failure both
 * mean "not configured yet", which makes the poster release its claim and the
 * reconcile sweep retry — never a stranded order.
 */
import type { WebshopProducts } from "@repo/api/types/appwrite";
import {
  LEDGER_ACCOUNTS_TABLE,
  parseShopAccountingSettings,
  type RevenueTarget,
  SALES_TYPES_TABLE,
  SHOP_ACCOUNTING_ROW_ID,
  SHOP_SETTINGS_TABLE,
  type ShopAccountingSettings,
  snapshotTarget,
} from "./finago-shop-accounting";
import type { ParsedOrderItem } from "./order-parsing";
import type { DbClient } from "./vipps-order-ops";

const DB_ID = "app";
const PRODUCTS_TABLE = "webshop_products";

export interface SalesTypeRow {
  $id: string;
  account_number: number;
  active?: boolean | null;
  label_en: string;
  label_no: string;
  sort_order?: number | null;
}

async function readRow<T>(
  db: DbClient,
  table: string,
  id: string
): Promise<T | null> {
  try {
    return ((await db.getRow(DB_ID, table, id)) as T | null) ?? null;
  } catch {
    return null;
  }
}

export async function loadShopAccountingSettings(
  db: DbClient
): Promise<ShopAccountingSettings | null> {
  const row = await readRow<{ general?: string | null }>(
    db,
    SHOP_SETTINGS_TABLE,
    SHOP_ACCOUNTING_ROW_ID
  );
  return parseShopAccountingSettings(row?.general);
}

/** The posting tax number synced from Finago for a ledger account. */
export async function loadVatCodeForAccount(
  db: DbClient,
  accountNumber: number
): Promise<number | null> {
  const row = await readRow<{ vat_code?: number | null }>(
    db,
    LEDGER_ACCOUNTS_TABLE,
    String(accountNumber)
  );
  return typeof row?.vat_code === "number" ? row.vat_code : null;
}

/** Where a product's revenue is booked today, from its active sales type. */
export async function resolveRevenueTarget(
  db: DbClient,
  product: Pick<WebshopProducts, "departmentId" | "sales_type">
): Promise<RevenueTarget | null> {
  if (!(product.sales_type && product.departmentId)) {
    return null;
  }
  const salesType = await readRow<SalesTypeRow>(
    db,
    SALES_TYPES_TABLE,
    product.sales_type
  );
  if (
    !salesType ||
    salesType.active === false ||
    typeof salesType.account_number !== "number"
  ) {
    return null;
  }
  const vatCode = await loadVatCodeForAccount(db, salesType.account_number);
  if (vatCode === null) {
    return null;
  }
  return {
    accountNumber: salesType.account_number,
    departmentId: String(product.departmentId),
    vatCode,
  };
}

export async function resolveRevenueTargetForProduct(
  db: DbClient,
  productId: string
): Promise<RevenueTarget | null> {
  const product = await readRow<
    Pick<WebshopProducts, "departmentId" | "sales_type">
  >(db, PRODUCTS_TABLE, productId);
  if (!product) {
    return null;
  }
  return await resolveRevenueTarget(db, {
    departmentId: product.departmentId ?? null,
    sales_type: product.sales_type ?? null,
  });
}

/**
 * One target per order line: the checkout copy when the line has a complete
 * one, else the product's current sales type (orders placed before the copy
 * existed). Each product is read at most once.
 */
export async function resolveItemTargets(
  db: DbClient,
  items: ParsedOrderItem[]
): Promise<Array<RevenueTarget | null>> {
  const byProduct = new Map<string, RevenueTarget | null>();
  const targets: Array<RevenueTarget | null> = [];
  for (const item of items) {
    const snapshot = snapshotTarget(item);
    if (snapshot) {
      targets.push(snapshot);
      continue;
    }
    const productId = item.product_id;
    if (!productId) {
      targets.push(null);
      continue;
    }
    if (!byProduct.has(productId)) {
      byProduct.set(
        productId,
        await resolveRevenueTargetForProduct(db, productId)
      );
    }
    targets.push(byProduct.get(productId) ?? null);
  }
  return targets;
}

/** Whether this process can authenticate against the Finago REST API. */
export function hasFinagoRestCredentials(): boolean {
  return Boolean(
    process.env.TFSO_REST_CLIENT_ID &&
      process.env.TFSO_REST_CLIENT_SECRET &&
      process.env.TFSO_REST_ORG_ID
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared && bun run test utils/finago-shop-accounting-server.test.ts`
Expected: PASS

Run: `cd packages/shared && bun run test`
Expected: PASS (order parsing change does not break other suites)

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/order-parsing.ts packages/shared/utils/finago-shop-accounting-server.ts packages/shared/utils/finago-shop-accounting-server.test.ts
git commit -F - <<'EOF'
Load sales types, settings and VAT codes for shop posting

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 6: Copy the revenue target onto order lines at checkout

**Files:**
- Modify: `packages/shared/types/vipps.ts`
- Modify: `packages/shared/utils/vipps-order-ops.ts` (`buildStoredOrderItems`)
- Test: `packages/shared/utils/vipps-order-ops.test.ts`
- Modify: `apps/api/src/lib/checkout-pricing.ts` (`buildTrustedCheckoutParams`)

**Interfaces:**
- Consumes: `resolveRevenueTarget(db, product)` (Task 5).
- Produces: `CheckoutSessionParams["items"][number]` gains `finago_vat_code?: number | null` and `finago_department?: string | null`; stored `order_items` rows carry `finago_account_number`, `finago_vat_code`, `finago_department`.

- [ ] **Step 1: Write the failing test**

In `packages/shared/utils/vipps-order-ops.test.ts`, append inside `describe("createOrder", …)`:

```ts
  it("stores the ledger copy on each order line", async () => {
    await createOrder(
      {
        ...checkoutParams,
        items: [
          {
            finago_account_number: 3000,
            finago_department: "44",
            finago_vat_code: 3,
            name: "Gensere til børsgruppen",
            price: 490,
            productId: "product-1",
            product_type: "webshop_product",
            quantity: 1,
            title: "Gensere til børsgruppen",
            unit_price: 490,
          },
        ],
        subtotal: 490,
        total: 490,
      },
      db
    );

    const storedItem = db.createRow.mock.calls[1]?.[3] as Record<
      string,
      unknown
    >;
    expect(storedItem).toEqual(
      expect.objectContaining({
        finago_account_number: 3000,
        finago_department: "44",
        finago_vat_code: 3,
      })
    );
  });

  it("stores an empty ledger copy when checkout could not resolve one", async () => {
    await createOrder(checkoutParams, db);

    const storedItem = db.createRow.mock.calls[1]?.[3] as Record<
      string,
      unknown
    >;
    expect(storedItem).toEqual(
      expect.objectContaining({
        finago_account_number: null,
        finago_department: null,
        finago_vat_code: null,
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test utils/vipps-order-ops.test.ts`
Expected: FAIL — TypeScript/assertion: `finago_department` missing on the stored item

- [ ] **Step 3: Extend the checkout item type**

In `packages/shared/types/vipps.ts`, replace:

```ts
    /** Ledger revenue account, snapshotted at sale time. */
    finago_account_number?: number | null;
```

with:

```ts
    /**
     * Ledger copy made at sale time: the revenue account, its Finago posting
     * tax number, and the department dimension value. Posting and refunds use
     * it so editing a product or its sales type never rewrites a past sale.
     */
    finago_account_number?: number | null;
    finago_department?: string | null;
    finago_vat_code?: number | null;
```

- [ ] **Step 4: Store the copy**

In `packages/shared/utils/vipps-order-ops.ts`, inside `buildStoredOrderItems`, replace:

```ts
      finago_account_number: rest.finago_account_number ?? null,
```

with:

```ts
      finago_account_number: rest.finago_account_number ?? null,
      finago_department: rest.finago_department ?? null,
      finago_vat_code: rest.finago_vat_code ?? null,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared && bun run test utils/vipps-order-ops.test.ts`
Expected: PASS

- [ ] **Step 6: Resolve the target in the trusted checkout**

In `apps/api/src/lib/checkout-pricing.ts`:

Add to the imports:

```ts
import type { RevenueTarget } from "@repo/shared/utils/finago-shop-accounting";
import { resolveRevenueTarget } from "@repo/shared/utils/finago-shop-accounting-server";
```

Add this helper directly above `buildTrustedCheckoutParams`:

```ts
/**
 * The revenue target a product sells under right now, cached per product for
 * the checkout. An unresolvable target is not a checkout error: the order is
 * still taken, and ledger posting resolves it (or waits) later.
 */
async function revenueTargetFor(
  product: NormalizedProduct,
  db: CheckoutDb,
  cache: Map<string, RevenueTarget | null>
): Promise<RevenueTarget | null> {
  if (!cache.has(product.$id)) {
    cache.set(product.$id, await resolveRevenueTarget(db, product));
  }
  return cache.get(product.$id) ?? null;
}
```

Inside `buildTrustedCheckoutParams`, below `const campusIds = new Set<string>();` add:

```ts
  const targetCache = new Map<string, RevenueTarget | null>();
```

Directly above `trustedItems.push({` add:

```ts
    const revenueTarget = await revenueTargetFor(product, db, targetCache);
```

Inside the pushed object, replace:

```ts
      // Snapshotted so a later refund reverses the account this sale actually
      // credited, even if the product's account is edited in between.
      finago_account_number: product.finago_account_number ?? null,
```

with:

```ts
      // Snapshotted so ledger posting and any later refund use the account,
      // VAT code and department this sale was made under, even if the product
      // or its sales type is edited in between.
      finago_account_number: revenueTarget?.accountNumber ?? null,
      finago_department: revenueTarget?.departmentId ?? null,
      finago_vat_code: revenueTarget?.vatCode ?? null,
```

- [ ] **Step 7: Verify the API checkout suites still pass**

Run: `cd apps/api && bun run test src/app/api/payment && bun run check-types`
Expected: PASS. (`resolveRevenueTarget` never throws, so mocked `db` objects without sales-type rows resolve to `null` targets.)

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add packages/shared/types/vipps.ts packages/shared/utils/vipps-order-ops.ts packages/shared/utils/vipps-order-ops.test.ts apps/api/src/lib/checkout-pricing.ts
git commit -F - <<'EOF'
Copy account, VAT code and department onto order lines at checkout

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 7: Rewrite order posting around settings and sales types

**Files:**
- Modify (replace contents): `packages/shared/utils/finago-order-posting.ts`
- Test (replace contents): `packages/shared/utils/finago-order-posting.test.ts`

**Interfaces:**
- Consumes: `buildShopTransactionInput`, `postLedgerTransaction` (Task 4); `ledgerDate`, `resolveShopPosting` (Task 3); `hasFinagoRestCredentials`, `loadShopAccountingSettings`, `resolveItemTargets` (Task 5); `isFeatureEnabled("shop_ledger_posting")` (Task 2).
- Produces:
  - `type FinagoOrder = Orders`
  - `interface FinagoPostingResult { detail?: string; posted: boolean; reason?: "already_posted" | "claimed_elsewhere" | "disabled" | "membership_order" | "not_configured" | "not_found" | "not_paid" | "post_failed" | "zero_total"; transactionId?: string }`
  - `postFinagoTransactionForOrder(orderId: string, db: DbClient): Promise<FinagoPostingResult>`
  - `releaseStaleFinagoClaim(order: FinagoOrder, db: DbClient, now?: number): Promise<boolean>` (unchanged)
  - Sentinels written to `orders.finago_transaction_id`: `"posting"`, `"membership"`, `"zero-total"`.

- [ ] **Step 1: Write the failing test**

Replace the full contents of `packages/shared/utils/finago-order-posting.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildShopTransactionInput: vi.fn(),
  isFeatureEnabled: vi.fn(),
  postLedgerTransaction: vi.fn(),
}));

vi.mock("@repo/connectors/24sevenoffice", () => ({
  buildShopTransactionInput: mocks.buildShopTransactionInput,
  postLedgerTransaction: mocks.postLedgerTransaction,
}));
vi.mock("./feature-flags-server", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));

import {
  postFinagoTransactionForOrder,
  releaseStaleFinagoClaim,
} from "./finago-order-posting";

const db = {
  createRow: vi.fn(),
  decrementRowColumn: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const SETTINGS_ROW = {
  general: JSON.stringify({
    clearingAccounts: { stripe: 1540, vipps: 1530 },
    transactionTypeNumber: 8,
  }),
};

const snapshotLine = {
  $id: "line-1",
  finago_account_number: 3000,
  finago_department: "44",
  finago_vat_code: 3,
  name: "Gensere til børsgruppen",
  product: { $id: "product-1" },
  quantity: 2,
  unit_price: 499,
};

const lineWithoutCopy = {
  $id: "line-1",
  name: "Gensere til børsgruppen",
  product: { $id: "product-1" },
  quantity: 2,
  unit_price: 499,
};

function paidOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    campus_id: "1",
    finago_posting_lock: 0,
    finago_transaction_id: null,
    order_items: [snapshotLine],
    payment_provider: "vipps",
    status: "paid",
    total: 998,
    ...overrides,
  };
}

function wireRows(
  order: Record<string, unknown>,
  rows: Record<string, Record<string, unknown>> = {
    "ledger_accounts/3000": { vat_code: 3 },
    "sales_types/varesalg": { account_number: 3000, active: true },
    "shop_settings/accounting": SETTINGS_ROW,
    "webshop_products/product-1": {
      departmentId: "44",
      sales_type: "varesalg",
    },
  }
) {
  db.getRow.mockImplementation((_db: string, table: string, id: string) => {
    if (table === "orders") {
      return Promise.resolve(order);
    }
    const row = rows[`${table}/${id}`];
    return row
      ? Promise.resolve(row)
      : Promise.reject(Object.assign(new Error("row_not_found"), { code: 404 }));
  });
}

const CLAIM_RELEASE = {
  column: "finago_posting_lock",
  databaseId: "app",
  min: 0,
  rowId: "order-1",
  tableId: "orders",
  value: 1,
};

describe("postFinagoTransactionForOrder", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    vi.stubEnv("TFSO_REST_CLIENT_ID", "client");
    vi.stubEnv("TFSO_REST_CLIENT_SECRET", "secret");
    vi.stubEnv("TFSO_REST_ORG_ID", "org");

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
    for (const fn of Object.values(mocks)) {
      fn.mockReset();
    }

    wireRows(paidOrder());
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 1 });
    db.decrementRowColumn.mockResolvedValue({ finago_posting_lock: 0 });
    db.updateRow.mockResolvedValue({});
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.buildShopTransactionInput.mockReturnValue({ built: true });
    mocks.postLedgerTransaction.mockResolvedValue("finago-tx-1");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("claims, builds the voucher from the line copy, posts it, and records the id", async () => {
    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: true, transactionId: "finago-tx-1" });
    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith("shop_ledger_posting");
    expect(db.incrementRowColumn).toHaveBeenCalledWith({
      column: "finago_posting_lock",
      databaseId: "app",
      rowId: "order-1",
      tableId: "orders",
      value: 1,
    });
    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: "1",
        clearingAccount: 1530,
        comment: "Nettbutikk order-1",
        lines: [
          {
            accountNumber: 3000,
            amount: 998,
            comment: "Gensere til børsgruppen ×2",
            departmentId: "44",
            vatCode: 3,
          },
        ],
        total: 998,
        transactionTypeNumber: 8,
      })
    );
    expect(mocks.postLedgerTransaction).toHaveBeenCalledWith({ built: true });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "posting",
    });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "finago-tx-1",
    });
  });

  it("falls back to the product's sales type for a line without a copy", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }));

    await postFinagoTransactionForOrder("order-1", db);

    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [expect.objectContaining({ accountNumber: 3000, vatCode: 3 })],
      })
    );
  });

  it("uses the Stripe clearing account for a Stripe order", async () => {
    wireRows(paidOrder({ payment_provider: "stripe" }));

    await postFinagoTransactionForOrder("order-1", db);

    expect(mocks.buildShopTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({ clearingAccount: 1540 })
    );
  });

  it("does nothing while shop ledger posting is switched off", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "disabled" });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("releases the claim and writes no marker when a line has no sales type", async () => {
    wireRows(paidOrder({ order_items: [lineWithoutCopy] }), {
      "shop_settings/accounting": SETTINGS_ROW,
    });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: '"Gensere til børsgruppen" has no sales type',
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("releases the claim when shop accounting settings are missing", async () => {
    wireRows(paidOrder(), {});

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "Shop accounting settings have not been saved in admin",
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });

  it("releases the claim when Finago credentials are missing", async () => {
    vi.stubEnv("TFSO_REST_CLIENT_ID", "");

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "Finago REST credentials are not set on this app",
      posted: false,
      reason: "not_configured",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("releases the claim when the builder refuses the voucher", async () => {
    mocks.buildShopTransactionInput.mockImplementation(() => {
      throw new Error("[Finago] unbalanced voucher");
    });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({
      detail: "[Finago] unbalanced voucher",
      posted: false,
      reason: "not_configured",
    });
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("stamps a zero-total order so it leaves the sweep for good", async () => {
    wireRows(paidOrder({ total: 0 }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "zero_total" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "zero-total",
    });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("skips without posting and undoes its increment when another caller holds the claim", async () => {
    db.incrementRowColumn.mockResolvedValue({ finago_posting_lock: 2 });

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "claimed_elsewhere" });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });

  it("skips orders that already carry a transaction id or sentinel", async () => {
    wireRows(paidOrder({ finago_transaction_id: "finago-tx-0" }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "already_posted" });
    expect(db.incrementRowColumn).not.toHaveBeenCalled();
  });

  it("skips orders that are not paid or authorized", async () => {
    wireRows(paidOrder({ status: "pending" }));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "not_paid" });
  });

  it("stamps membership orders out instead of posting them", async () => {
    wireRows(
      paidOrder({
        order_items: [{ ...snapshotLine, product_type: "membership" }],
      })
    );

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "membership_order" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "membership",
    });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("keeps the marker and does not release the claim when the Finago post fails", async () => {
    mocks.postLedgerTransaction.mockRejectedValue(new Error("Finago down"));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_transaction_id: "posting",
    });
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });

  it("releases the claim when the marker write fails before posting", async () => {
    db.updateRow.mockRejectedValueOnce(new Error("appwrite timeout"));

    const result = await postFinagoTransactionForOrder("order-1", db);

    expect(result).toEqual({ posted: false, reason: "post_failed" });
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalledWith(CLAIM_RELEASE);
  });
});

describe("releaseStaleFinagoClaim", () => {
  beforeEach(() => {
    process.env.APPWRITE_DATABASE_ID = "app";
    process.env.APPWRITE_ORDERS_COLLECTION_ID = "orders";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    db.updateRow.mockReset();
    db.updateRow.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets a lock that was claimed long ago without a transaction id", async () => {
    const staleOrder = paidOrder({
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finago_posting_lock: 1,
    });

    expect(
      await releaseStaleFinagoClaim(staleOrder as never, db, Date.now())
    ).toBe(true);
    expect(db.updateRow).toHaveBeenCalledWith("app", "orders", "order-1", {
      finago_posting_lock: 0,
    });
  });

  it("leaves fresh claims and posted orders alone", async () => {
    const freshClaim = paidOrder({ finago_posting_lock: 1 });
    const posted = paidOrder({
      $updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      finago_posting_lock: 1,
      finago_transaction_id: "finago-tx-1",
    });

    expect(await releaseStaleFinagoClaim(freshClaim as never, db)).toBe(false);
    expect(await releaseStaleFinagoClaim(posted as never, db)).toBe(false);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun run test utils/finago-order-posting.test.ts`
Expected: FAIL — `isFeatureEnabled` never called / `buildShopTransactionInput` not called (old implementation)

- [ ] **Step 3: Replace the posting module**

Replace the full contents of `packages/shared/utils/finago-order-posting.ts` with:

```ts
import type { Orders } from "@repo/api/types/appwrite";
import {
  buildShopTransactionInput,
  postLedgerTransaction,
  type ShopTransactionInput,
} from "@repo/connectors/24sevenoffice";
import { isFeatureEnabled } from "./feature-flags-server";
import { ledgerDate, resolveShopPosting } from "./finago-shop-accounting";
import {
  hasFinagoRestCredentials,
  loadShopAccountingSettings,
  resolveItemTargets,
} from "./finago-shop-accounting-server";
import { isMembershipOrder } from "./membership-fulfilment";
import { getOrderItems } from "./order-parsing";
import { ORDER_ITEMS_SELECT } from "./order-queries";
import type { DbClient } from "./vipps-order-ops";

export type FinagoOrder = Orders;

export interface FinagoPostingResult {
  /** Why the order cannot be posted yet; set with `not_configured`. */
  detail?: string;
  posted: boolean;
  reason?:
    | "already_posted"
    | "claimed_elsewhere"
    | "disabled"
    | "membership_order"
    | "not_configured"
    | "not_found"
    | "not_paid"
    | "post_failed"
    | "zero_total";
  transactionId?: string;
}

const POSTABLE_STATUSES = new Set(["authorized", "paid"]);
const MINOR_UNITS_PER_MAJOR = 100;

// Written to `finago_transaction_id` right before the Finago post and
// overwritten with the real id on success. While it is set the order is
// excluded from the reconcile query (`finago_transaction_id IS NULL`) and from
// releaseStaleFinagoClaim, so no automatic path can post a second voucher
// after a crash or failure mid-post. Such an order is left for manual recovery.
const FINAGO_POSTING_MARKER = "posting";

// Stamped for a membership order: memberships are booked as a 24SO invoice by
// fulfilMembershipOrder, so without a value here the order would match the
// reconcile sweep's `IS NULL` query forever.
const MEMBERSHIP_LEDGER_EXCLUSION = "membership";

// Stamped for a paid order with nothing to book (a free product), for the same
// reason as the membership sentinel.
const ZERO_TOTAL_EXCLUSION = "zero-total";

function ordersTable() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    collId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

async function releaseClaim(orderId: string, db: DbClient): Promise<void> {
  const { dbId, collId } = ordersTable();
  if (db.decrementRowColumn) {
    await db
      .decrementRowColumn({
        databaseId: dbId,
        tableId: collId,
        rowId: orderId,
        column: "finago_posting_lock",
        value: 1,
        min: 0,
      })
      .catch(() => {
        // Already in trouble — the stale-claim sweep will recover the lock.
      });
  }
}

/** Best-effort: a failed stamp only means a later sweep stamps it again. */
async function stampExclusion(
  orderId: string,
  db: DbClient,
  sentinel: string
): Promise<void> {
  const { dbId, collId } = ordersTable();
  await db
    .updateRow(dbId, collId, orderId, { finago_transaction_id: sentinel })
    .catch((error) => {
      console.error(
        `[Finago] Failed to stamp "${sentinel}" on order ${orderId}:`,
        error
      );
    });
}

type PreparedTransaction =
  | { input: ShopTransactionInput; ok: true }
  | { ok: false; reason: string };

/**
 * Everything that can be checked without touching Finago: credentials,
 * settings, a sales type for every priced line, and a balanced voucher. A
 * refusal here is a configuration gap, never a possible side effect.
 */
async function prepareTransaction(
  order: FinagoOrder,
  db: DbClient
): Promise<PreparedTransaction> {
  if (!hasFinagoRestCredentials()) {
    return {
      ok: false,
      reason: "Finago REST credentials are not set on this app",
    };
  }

  const settings = await loadShopAccountingSettings(db);
  const items = getOrderItems(order);
  const targets = await resolveItemTargets(db, items);

  const resolution = resolveShopPosting({
    campusId: order.campus_id ?? null,
    items: items.map((item, index) => ({
      name: item.name ?? item.title ?? "Vare",
      quantity: Number(item.quantity ?? 0),
      target: targets[index] ?? null,
      unitPrice: Number(item.unit_price ?? item.price ?? 0),
    })),
    provider: order.payment_provider ?? null,
    settings,
    total: order.total ?? 0,
  });
  if (!resolution.ok) {
    return resolution;
  }

  const { posting } = resolution;
  try {
    return {
      input: buildShopTransactionInput({
        campusId: posting.campusId,
        clearingAccount: posting.clearingAccount,
        comment: `Nettbutikk ${order.$id}`,
        date: ledgerDate(),
        lines: posting.lines,
        total: posting.total,
        transactionTypeNumber: posting.transactionTypeNumber,
      }),
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Posts a paid/authorized shop order to Finago exactly once.
 *
 * Idempotency: an atomic `finago_posting_lock` claim guarantees only one
 * concurrent caller — webhook, return route, or reconcile cron — posts. All
 * validation runs before the "posting" marker, so a configuration gap
 * releases the claim and the sweep retries once it is fixed. Only a failure
 * of the Finago call itself leaves the marker for manual recovery.
 */
export async function postFinagoTransactionForOrder(
  orderId: string,
  db: DbClient
): Promise<FinagoPostingResult> {
  const { dbId, collId } = ordersTable();

  const order = (await db
    .getRow(dbId, collId, orderId, [ORDER_ITEMS_SELECT])
    .catch(() => null)) as FinagoOrder | null;
  if (!order) {
    return { posted: false, reason: "not_found" };
  }
  if (!POSTABLE_STATUSES.has(order.status ?? "")) {
    return { posted: false, reason: "not_paid" };
  }
  if (order.finago_transaction_id) {
    return { posted: false, reason: "already_posted" };
  }
  if (isMembershipOrder(order)) {
    await stampExclusion(orderId, db, MEMBERSHIP_LEDGER_EXCLUSION);
    return { posted: false, reason: "membership_order" };
  }
  if (Math.round((order.total ?? 0) * MINOR_UNITS_PER_MAJOR) <= 0) {
    await stampExclusion(orderId, db, ZERO_TOTAL_EXCLUSION);
    return { posted: false, reason: "zero_total" };
  }
  if (!(await isFeatureEnabled("shop_ledger_posting"))) {
    return { posted: false, reason: "disabled" };
  }

  if (db.incrementRowColumn) {
    try {
      const claimed = await db.incrementRowColumn<Record<string, unknown>>({
        databaseId: dbId,
        tableId: collId,
        rowId: orderId,
        column: "finago_posting_lock",
        value: 1,
      });
      const lockValue =
        typeof claimed?.finago_posting_lock === "number"
          ? claimed.finago_posting_lock
          : 0;
      if (lockValue !== 1) {
        // Lost the race. Undo our own increment so the lock reflects only the
        // in-flight winner and a crashed claim can still age out.
        await releaseClaim(orderId, db);
        return { posted: false, reason: "claimed_elsewhere" };
      }
    } catch (error) {
      console.warn(
        `[Finago] Atomic claim failed for order ${orderId}; proceeding with best-effort guard:`,
        error
      );
    }
  }

  let input: ShopTransactionInput;
  try {
    const prepared = await prepareTransaction(order, db);
    if (!prepared.ok) {
      await releaseClaim(orderId, db);
      console.warn(
        `[Finago] Order ${orderId} not posted yet: ${prepared.reason}`
      );
      return {
        detail: prepared.reason,
        posted: false,
        reason: "not_configured",
      };
    }
    input = prepared.input;
    await db.updateRow(dbId, collId, orderId, {
      finago_transaction_id: FINAGO_POSTING_MARKER,
    });
  } catch (error) {
    await releaseClaim(orderId, db);
    console.error(
      `[Finago] Failed to prepare posting for order ${orderId}:`,
      error
    );
    return { posted: false, reason: "post_failed" };
  }

  try {
    const transactionId = await postLedgerTransaction(input);
    await db.updateRow(dbId, collId, orderId, {
      finago_transaction_id: transactionId,
    });
    console.log(
      `[Finago] Posted order ${orderId} as transaction ${transactionId}`
    );
    return { posted: true, transactionId };
  } catch (error) {
    // The Finago post has been attempted and may have landed. Keep the marker
    // and the claim so no automatic path posts a second voucher.
    console.error(
      `[Finago] Post attempted for order ${orderId}; leaving marker for manual recovery:`,
      error
    );
    return { posted: false, reason: "post_failed" };
  }
}

const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Recovers a posting claim that was taken but never completed (process died
 * between claim and post). Only call from the reconciliation sweep: if the
 * lock is held, no transaction id was written, and the order row hasn't been
 * touched for STALE_CLAIM_MS, reset the lock so the next sweep can retry.
 *
 * @returns true when a stale claim was released.
 */
export async function releaseStaleFinagoClaim(
  order: FinagoOrder,
  db: DbClient,
  now: number = Date.now()
): Promise<boolean> {
  const lockValue = order.finago_posting_lock ?? 0;
  if (lockValue <= 0 || order.finago_transaction_id) {
    return false;
  }

  const updatedAt = Date.parse(order.$updatedAt);
  if (Number.isNaN(updatedAt) || now - updatedAt < STALE_CLAIM_MS) {
    return false;
  }

  const { dbId, collId } = ordersTable();
  console.warn(
    `[Finago] Releasing stale posting claim on order ${order.$id} (lock: ${lockValue})`
  );
  await db.updateRow(dbId, collId, order.$id, { finago_posting_lock: 0 });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun run test utils/finago-order-posting.test.ts`
Expected: PASS (17 tests)

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/finago-order-posting.ts packages/shared/utils/finago-order-posting.test.ts
git commit -F - <<'EOF'
Post shop orders from sales types and never strand them on a config gap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 8: Refunds mirror the sale (account, VAT code, department)

**Files:**
- Modify: `packages/shared/utils/order-refunds-pure.ts`
- Test: `packages/shared/utils/order-refunds-pure.test.ts`
- Modify: `packages/shared/utils/order-refunds.ts`
- Test: `packages/shared/utils/order-refunds.test.ts`
- Modify (replace contents): `packages/shared/utils/finago-refund-reverser.ts`
- Modify: `packages/connectors/src/24sevenoffice/rest/transactions.ts`, `packages/connectors/src/24sevenoffice/rest/index.ts`, `packages/connectors/src/24sevenoffice/index.ts`
- Test: `packages/connectors/src/24sevenoffice/rest/transactions.test.ts`

**Interfaces:**
- Consumes: `RevenueTarget`, `revenueTargetKey`, `snapshotTarget`, `clearingProvider`, `ledgerDate` (Task 3); `loadShopAccountingSettings`, `resolveRevenueTargetForProduct` (Task 5); `buildShopReversalTransactionInput`, `postLedgerTransaction` (Task 4).
- Produces:
  - `RefundableOrderItem` gains `finagoDepartment?: string | null` and `finagoVatCode?: number | null`.
  - `interface RevenueAllocationEntry extends RevenueTarget { amountMinor: number }`
  - `interface RevenueAllocationInput { alreadyReversedByTarget?: Record<string, number>; amountMinor: number; items: RefundableOrderItem[]; lines: BuiltRefundLine[]; targetByItemId: Record<string, RevenueTarget | null | undefined> }`
  - `allocateAmountAcrossTargets(input: RevenueAllocationInput): RevenueAllocationEntry[]` (replaces `allocateAmountAcrossAccounts`)
  - `reversedByTarget(order: RefundableOrder): Record<string, number>` (replaces `reversedByAccount`)
  - `LedgerReverser.reverse(input: { allocation: RevenueAllocationEntry[]; amount: number; campusId?: string | null; db: DbClient; orderId: string; provider?: string | null }): Promise<string | null>`
  - Connectors no longer export `postShopTransaction`, `postShopRefundTransaction`, `buildShopRefundTransactionInput`, `ShopTransactionParams`, `ShopRefundTransactionParams`.

- [ ] **Step 1: Rewrite the pure allocation tests**

In `packages/shared/utils/order-refunds-pure.test.ts`:

Replace the import block with:

```ts
import { describe, expect, it } from "vitest";
import {
  type RevenueTarget,
  revenueTargetKey,
} from "./finago-shop-accounting";
import {
  allocateAmountAcrossTargets,
  buildRefundLines,
  computeRefundable,
  isPartiallyRefunded,
  type RecordedRefund,
  type RefundableOrderItem,
  statusAfterRefund,
  validateRefundRequest,
} from "./order-refunds-pure";
```

Delete these four `describe` blocks entirely: `"allocateAmountAcrossAccounts"`, `"allocateAmountAcrossAccounts — remaining balance"`, `"allocateAmountAcrossAccounts — order independence"`, `"allocateAmountAcrossAccounts — unmapped lines"`.

Append at the end of the file:

```ts
const HOODIE: RevenueTarget = {
  accountNumber: 3000,
  departmentId: "44",
  vatCode: 3,
};
const CAP: RevenueTarget = { accountNumber: 3010, departmentId: "44", vatCode: 3 };

describe("allocateAmountAcrossTargets", () => {
  const targetByItemId = { "line-a": HOODIE, "line-b": CAP };

  it("maps line refunds straight onto their targets", () => {
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 49_900,
      items,
      lines: buildRefundLines([{ orderItemId: "line-a", quantity: 1 }], items),
      targetByItemId,
    });
    expect(allocation).toEqual([{ ...HOODIE, amountMinor: 49_900 }]);
  });

  it("splits a free-amount refund proportionally and sums back exactly", () => {
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 10_000,
      items,
      lines: [],
      targetByItemId,
    });
    expect(allocation).toEqual([
      { ...HOODIE, amountMinor: 8338 },
      { ...CAP, amountMinor: 1662 },
    ]);
  });

  it("keeps the same account apart per department", () => {
    const twoDepartments: RefundableOrderItem[] = [
      { id: "line-a", name: "A", quantity: 1, unitPrice: 50 },
      { id: "line-b", name: "B", quantity: 1, unitPrice: 50 },
    ];
    const allocation = allocateAmountAcrossTargets({
      amountMinor: 10_000,
      items: twoDepartments,
      lines: [],
      targetByItemId: {
        "line-a": HOODIE,
        "line-b": { ...HOODIE, departmentId: "16" },
      },
    });
    expect(allocation).toEqual([
      { ...HOODIE, departmentId: "16", amountMinor: 5000 },
      { ...HOODIE, amountMinor: 5000 },
    ]);
  });

  it("returns nothing when no line has a target", () => {
    expect(
      allocateAmountAcrossTargets({
        amountMinor: 10_000,
        items,
        lines: [],
        targetByItemId: {},
      })
    ).toEqual([]);
  });
});

describe("allocateAmountAcrossTargets — remaining balance", () => {
  const evenItems: RefundableOrderItem[] = [
    { id: "line-a", name: "A", quantity: 1, unitPrice: 50 },
    { id: "line-b", name: "B", quantity: 1, unitPrice: 50 },
  ];
  const targetByItemId = { "line-a": HOODIE, "line-b": CAP };

  it("sends a free-amount refund to the targets not yet reversed", () => {
    const allocation = allocateAmountAcrossTargets({
      alreadyReversedByTarget: { [revenueTargetKey(HOODIE)]: 5000 },
      amountMinor: 5000,
      items: evenItems,
      lines: [],
      targetByItemId,
    });
    expect(allocation).toEqual([{ ...CAP, amountMinor: 5000 }]);
  });

  it("free refund first, then a line refund, never over-reverses a target", () => {
    const free = allocateAmountAcrossTargets({
      amountMinor: 5000,
      items: evenItems,
      lines: [],
      targetByItemId,
    });
    expect(free).toEqual([
      { ...HOODIE, amountMinor: 2500 },
      { ...CAP, amountMinor: 2500 },
    ]);

    const then = allocateAmountAcrossTargets({
      alreadyReversedByTarget: {
        [revenueTargetKey(HOODIE)]: 2500,
        [revenueTargetKey(CAP)]: 2500,
      },
      amountMinor: 5000,
      items: evenItems,
      lines: buildRefundLines(
        [{ orderItemId: "line-a", quantity: 1 }],
        evenItems
      ),
      targetByItemId,
    });
    const forHoodie =
      then.find((entry) => entry.accountNumber === 3000)?.amountMinor ?? 0;
    expect(forHoodie).toBe(2500);
    expect(then.reduce((sum, entry) => sum + entry.amountMinor, 0)).toBe(5000);
  });

  it("never reverses more than a target was credited", () => {
    expect(
      allocateAmountAcrossTargets({
        alreadyReversedByTarget: {
          [revenueTargetKey(HOODIE)]: 5000,
          [revenueTargetKey(CAP)]: 5000,
        },
        amountMinor: 5000,
        items: evenItems,
        lines: [],
        targetByItemId,
      })
    ).toEqual([]);
  });

  it("never charges another line's target for a line with none", () => {
    expect(
      allocateAmountAcrossTargets({
        amountMinor: 5000,
        items: evenItems,
        lines: buildRefundLines(
          [{ orderItemId: "line-b", quantity: 1 }],
          evenItems
        ),
        targetByItemId: { "line-a": HOODIE, "line-b": null },
      })
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the pure tests to verify they fail**

Run: `cd packages/shared && bun run test utils/order-refunds-pure.test.ts`
Expected: FAIL — `allocateAmountAcrossTargets` is not exported

- [ ] **Step 3: Allocate by revenue target**

In `packages/shared/utils/order-refunds-pure.ts`:

Add at the top, below the file header comment:

```ts
import { type RevenueTarget, revenueTargetKey } from "./finago-shop-accounting";
```

In `interface RefundableOrderItem`, add below `finagoAccountNumber?`:

```ts
  /** Department dimension value snapshotted at sale time. */
  finagoDepartment?: string | null;
  /** Finago posting tax number snapshotted at sale time. */
  finagoVatCode?: number | null;
```

Replace the whole `RevenueAllocationInput` interface, the `originalCreditByAccount` function, the `allocateAmountAcrossAccounts` function and the `toSortedEntries` function with:

```ts
/** One slice of a refund, booked back against the target that was credited. */
export interface RevenueAllocationEntry extends RevenueTarget {
  amountMinor: number;
}

export interface RevenueAllocationInput {
  /**
   * Minor units already reversed per target (`revenueTargetKey`) by this
   * order's earlier refunds. Recorded per target rather than derived from line
   * quantities because a free-amount refund reverses targets without naming a
   * line.
   */
  alreadyReversedByTarget?: Record<string, number>;
  amountMinor: number;
  items: RefundableOrderItem[];
  /** Empty for a free-amount refund. */
  lines: BuiltRefundLine[];
  /** The target each order line credited, by `order_items.$id`. */
  targetByItemId: Record<string, RevenueTarget | null | undefined>;
}

/** Each target's original credit on this order, in minor units. */
function originalCreditByTarget(
  items: RefundableOrderItem[],
  targetByItemId: RevenueAllocationInput["targetByItemId"]
): { credits: Map<string, number>; targets: Map<string, RevenueTarget> } {
  const credits = new Map<string, number>();
  const targets = new Map<string, RevenueTarget>();
  for (const item of items) {
    const target = targetByItemId[item.id];
    if (!target) {
      continue;
    }
    const credit = toMinor(item.unitPrice) * item.quantity;
    if (credit > 0) {
      const key = revenueTargetKey(target);
      credits.set(key, (credits.get(key) ?? 0) + credit);
      targets.set(key, target);
    }
  }
  return { credits, targets };
}

/**
 * Splits a refund across the revenue targets it should be debited from, in
 * minor units.
 *
 * A line-item refund maps exactly: each line's amount goes to its target. A
 * free-amount refund names no line, so it is allocated in proportion to each
 * target's remaining room — with the rounding remainder walked onto the
 * targets with the most room so the parts always sum back to `amountMinor`.
 */
export function allocateAmountAcrossTargets(
  input: RevenueAllocationInput
): RevenueAllocationEntry[] {
  const { credits, targets } = originalCreditByTarget(
    input.items,
    input.targetByItemId
  );

  // What each target can still give back. Every allocation is capped by this,
  // so no sequence of refunds can reverse more than the sale credited.
  const remaining = new Map<string, number>();
  for (const [key, credit] of credits) {
    const already = input.alreadyReversedByTarget?.[key] ?? 0;
    remaining.set(key, Math.max(0, credit - already));
  }

  const byTarget = new Map<string, number>();
  const take = (key: string, wanted: number): number => {
    const left = remaining.get(key) ?? 0;
    const taken = Math.min(wanted, left);
    if (taken <= 0) {
      return 0;
    }
    remaining.set(key, left - taken);
    byTarget.set(key, (byTarget.get(key) ?? 0) + taken);
    return taken;
  };

  let unallocated = input.amountMinor;

  for (const line of input.lines) {
    const target = input.targetByItemId[line.orderItemId];
    if (!target) {
      // The line credited no target, so nothing can be reversed for it. Drop
      // its share rather than spill it onto another product's revenue; the
      // connector refuses the short reversal and the refund is flagged.
      unallocated -= toMinor(line.amount);
      continue;
    }
    unallocated -= take(revenueTargetKey(target), toMinor(line.amount));
  }

  if (unallocated > 0) {
    const openTargets = [...remaining.entries()].filter(([, left]) => left > 0);
    const totalRoom = openTargets.reduce((sum, [, left]) => sum + left, 0);

    if (totalRoom > 0) {
      const share = Math.min(unallocated, totalRoom);
      let placed = 0;
      for (const [key, left] of openTargets) {
        placed += take(key, Math.floor((share * left) / totalRoom));
      }
      let shortfall = share - placed;
      const byRoomDesc = [...remaining.entries()]
        .filter(([, left]) => left > 0)
        .sort((a, b) => b[1] - a[1]);
      for (const [key] of byRoomDesc) {
        if (shortfall <= 0) {
          break;
        }
        shortfall -= take(key, shortfall);
      }
    }
  }

  const entries: RevenueAllocationEntry[] = [];
  for (const [key, amountMinor] of byTarget) {
    const target = targets.get(key);
    if (target && amountMinor > 0) {
      entries.push({ ...target, amountMinor });
    }
  }
  return entries.sort(
    (a, b) =>
      a.accountNumber - b.accountNumber ||
      a.departmentId.localeCompare(b.departmentId) ||
      a.vatCode - b.vatCode
  );
}
```

Run: `cd packages/shared && bun run test utils/order-refunds-pure.test.ts`
Expected: PASS

- [ ] **Step 4: Update the orchestration tests**

In `packages/shared/utils/order-refunds.test.ts`, replace the whole `orderRowFor` function with:

```ts
function orderRowFor(order: Record<string, unknown>) {
  // Returns a promise rather than being declared `async`: the code under test
  // chains `.catch()` onto `getRow`, so the mock must be thenable.
  return (_dbId: string, tableId: string, rowId: string): Promise<unknown> => {
    if (tableId === "orders" && rowId === ORDER_ID) {
      return Promise.resolve(order);
    }
    if (tableId === "webshop_products") {
      return Promise.resolve({
        $id: rowId,
        departmentId: "44",
        sales_type: "varesalg",
        stock: 5,
      });
    }
    if (tableId === "sales_types") {
      return Promise.resolve({ $id: rowId, account_number: 3000, active: true });
    }
    if (tableId === "ledger_accounts") {
      return Promise.resolve({ $id: rowId, vat_code: 3 });
    }
    return Promise.resolve(null);
  };
}
```

In the test `"posts a ledger reversal for the refunded revenue accounts"`, replace its `expect(ledger.reverse).toHaveBeenCalledWith(…)` with:

```ts
    expect(ledger.reverse).toHaveBeenCalledWith(
      expect.objectContaining({
        allocation: [
          { accountNumber: 3000, amountMinor: 49_900, departmentId: "44", vatCode: 3 },
        ],
        amount: 499,
        db,
        provider: "stripe",
      })
    );
```

Append inside the same `describe` that contains `"skips the ledger reversal for a membership order"`:

```ts
  it("skips the ledger reversal for an order imported from WordPress", async () => {
    db.getRow.mockImplementation(
      orderRowFor(buildOrder({ finago_transaction_id: "wordpress-import" }))
    );
    const ledger: LedgerReverser = { reverse: vi.fn() };

    await refundOrder({
      db,
      executor: executorReturning(49_900),
      ledger,
      orderId: ORDER_ID,
      amount: 499,
    });

    expect(ledger.reverse).not.toHaveBeenCalled();
  });
```

Run: `cd packages/shared && bun run test utils/order-refunds.test.ts`
Expected: FAIL — allocation entries lack `departmentId`/`vatCode`, and the WordPress order is reversed

- [ ] **Step 5: Wire targets through the orchestration**

In `packages/shared/utils/order-refunds.ts`:

Replace the `./order-refunds-pure` import's `allocateAmountAcrossAccounts,` with `allocateAmountAcrossTargets,` and add `type RevenueAllocationEntry,` to the same import. Add:

```ts
import {
  type RevenueTarget,
  revenueTargetKey,
  snapshotTarget,
} from "./finago-shop-accounting";
import { resolveRevenueTargetForProduct } from "./finago-shop-accounting-server";
```

In `interface OrderRefundRow`, replace the `ledger_allocation` doc comment with:

```ts
  /** JSON `[{accountNumber, departmentId, vatCode, amountMinor}]` reversed by this refund. */
```

In `toRefundableItems`, add below the `finagoAccountNumber:` property:

```ts
      finagoDepartment:
        typeof item.finago_department === "string"
          ? item.finago_department
          : null,
      finagoVatCode:
        typeof item.finago_vat_code === "number" ? item.finago_vat_code : null,
```

Replace the whole `reversedByAccount` function with:

```ts
export function reversedByTarget(
  order: RefundableOrder
): Record<string, number> {
  const byTarget: Record<string, number> = {};
  for (const refund of order.refunds ?? []) {
    if (refund.status === "failed" || !refund.ledger_allocation) {
      continue;
    }
    try {
      const parsed = JSON.parse(refund.ledger_allocation) as Array<
        Partial<RevenueAllocationEntry>
      >;
      for (const entry of parsed) {
        // Entries recorded before reversals carried a VAT code and department
        // cannot be matched to a target; skip them (the cap still applies).
        if (
          typeof entry.accountNumber !== "number" ||
          typeof entry.amountMinor !== "number" ||
          typeof entry.vatCode !== "number" ||
          !entry.departmentId
        ) {
          continue;
        }
        const key = revenueTargetKey({
          accountNumber: entry.accountNumber,
          departmentId: entry.departmentId,
          vatCode: entry.vatCode,
        });
        byTarget[key] = (byTarget[key] ?? 0) + entry.amountMinor;
      }
    } catch {
      // A malformed record must not break the next refund.
    }
  }
  return byTarget;
}
```

Replace the whole `LedgerReverser` interface with:

```ts
export interface LedgerReverser {
  /**
   * Posts the compensating ledger transaction. Returns the transaction id, or
   * `null` when there is nothing to reverse (no revenue targets resolved).
   */
  reverse: (input: {
    allocation: RevenueAllocationEntry[];
    amount: number;
    /** Campus dimension for the reversal, taken from the order. */
    campusId?: string | null;
    db: DbClient;
    orderId: string;
    /** Payment provider of the original sale; picks the clearing account. */
    provider?: string | null;
  }) => Promise<string | null>;
}
```

In `reverseLedger`:

Replace `const { dbId, productsId } = tableIds();` with `const { dbId } = tableIds();`.

Replace the "never posted" guard:

```ts
  if (
    !order.finago_transaction_id ||
    order.finago_transaction_id === "membership" ||
    order.finago_transaction_id === "posting"
  ) {
    return;
  }
```

with:

```ts
  if (
    !order.finago_transaction_id ||
    NOT_POSTED_BY_AUTOMATION.has(order.finago_transaction_id)
  ) {
    return;
  }
```

and add this constant next to `REFUNDS_TABLE`:

```ts
/**
 * `finago_transaction_id` values that are not a voucher this system posted:
 * memberships (booked as invoices), an in-flight marker, free orders, and
 * orders imported from WordPress (booked by hand in the old monthly report).
 * A refund against one of these has no automatic reversal.
 */
const NOT_POSTED_BY_AUTOMATION = new Set([
  "membership",
  "posting",
  "wordpress-import",
  "zero-total",
]);
```

Replace the body of the `try` block that starts with `const accountByItemId = await resolveRevenueAccounts(` down to and including the `ledger.reverse({ … })` call with:

```ts
    const targetByItemId = await resolveRevenueTargets(items, db);
    const allocation = allocateAmountAcrossTargets({
      alreadyReversedByTarget: reversedByTarget(order),
      amountMinor: toMinor(amount),
      items,
      lines,
      targetByItemId,
    });
    const transactionId = await ledger.reverse({
      allocation,
      amount,
      campusId: order.campus_id ?? null,
      db,
      orderId,
      provider: order.payment_provider ?? null,
    });
```

Replace the whole `resolveRevenueAccounts` function (and its doc comment) with:

```ts
/**
 * The revenue target to reverse per line: the copy made at checkout when the
 * line has one, else the product's current sales type (orders placed before
 * the copy existed). Each product is read at most once.
 */
async function resolveRevenueTargets(
  items: RefundableOrderItem[],
  db: DbClient
): Promise<Record<string, RevenueTarget | null>> {
  const targetByItemId: Record<string, RevenueTarget | null> = {};
  const byProduct = new Map<string, RevenueTarget | null>();

  for (const item of items) {
    const snapshot = snapshotTarget({
      finago_account_number: item.finagoAccountNumber,
      finago_department: item.finagoDepartment,
      finago_vat_code: item.finagoVatCode,
    });
    if (snapshot) {
      targetByItemId[item.id] = snapshot;
      continue;
    }
    if (!item.productId) {
      targetByItemId[item.id] = null;
      continue;
    }
    if (!byProduct.has(item.productId)) {
      byProduct.set(
        item.productId,
        await resolveRevenueTargetForProduct(db, item.productId)
      );
    }
    targetByItemId[item.id] = byProduct.get(item.productId) ?? null;
  }

  return targetByItemId;
}
```

Run: `cd packages/shared && bun run test utils/order-refunds.test.ts utils/order-refunds-pure.test.ts`
Expected: PASS

- [ ] **Step 6: Post reversals with settings and the clearing account**

Replace the full contents of `packages/shared/utils/finago-refund-reverser.ts` with:

```ts
import {
  buildShopReversalTransactionInput,
  postLedgerTransaction,
} from "@repo/connectors/24sevenoffice";
import { clearingProvider, ledgerDate } from "./finago-shop-accounting";
import { loadShopAccountingSettings } from "./finago-shop-accounting-server";
import type { LedgerReverser } from "./order-refunds";

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * The ledger reverser every refund path should use.
 *
 * Mirrors the original voucher: credits the provider's clearing account and
 * debits each revenue target with its own VAT code and department. The payout
 * voucher's refund line then clears the clearing account. A missing setting
 * throws, which records the failure on the refund row for manual posting; the
 * refund itself still stands.
 */
export const finagoRefundReverser: LedgerReverser = {
  reverse: async ({ allocation, amount, campusId, db, orderId, provider }) => {
    if (allocation.length === 0) {
      return null;
    }
    const settings = await loadShopAccountingSettings(db);
    if (!settings) {
      throw new Error("Shop accounting settings have not been saved in admin");
    }
    const clearing = clearingProvider(provider);
    if (!clearing) {
      throw new Error(
        `No clearing account for payment provider "${provider ?? "none"}"`
      );
    }

    return await postLedgerTransaction(
      buildShopReversalTransactionInput({
        campusId: campusId ?? null,
        clearingAccount: settings.clearingAccounts[clearing],
        comment: `Refusjon nettbutikk ${orderId}`,
        date: ledgerDate(),
        lines: allocation.map((entry) => ({
          accountNumber: entry.accountNumber,
          amount: entry.amountMinor / MINOR_UNITS_PER_MAJOR,
          departmentId: entry.departmentId,
          vatCode: entry.vatCode,
        })),
        total: amount,
        transactionTypeNumber: settings.transactionTypeNumber,
      })
    );
  },
};
```

- [ ] **Step 7: Remove the old shop functions from the connector**

In `packages/connectors/src/24sevenoffice/rest/transactions.ts`, delete:
- the `import { getAccessToken } from "./auth";` line and the `const BASE_URL = …;` line
- `SHOP_CAMPUS_DEPARTMENT_IDS` and its doc comment
- `interface TransactionLine`, `interface PostTransactionRequest`, `interface PostTransactionResponse`
- `export interface ShopTransactionParams`
- `async function postTransaction`
- `export async function postShopTransaction`
- `export interface ShopRefundTransactionParams`
- both doc comments above and the whole `export function buildShopRefundTransactionInput`
- `export async function postShopRefundTransaction`

Update the file header comment to:

```ts
/**
 * Finago REST API — General Ledger Transactions
 *
 * Pure voucher builders (expense reimbursements, webshop sales and refunds)
 * plus `POST /transactions` transport through the typed client.
 */
```

In `packages/connectors/src/24sevenoffice/rest/index.ts` and `packages/connectors/src/24sevenoffice/index.ts`, remove `buildShopRefundTransactionInput`, `postShopRefundTransaction`, `postShopTransaction`, `type ShopRefundTransactionParams` and `type ShopTransactionParams` from the export lists.

In `packages/connectors/src/24sevenoffice/rest/transactions.test.ts`:
- remove `buildShopRefundTransactionInput` from the import
- delete the `NO_REVENUE_ACCOUNTS_ERROR` and `PARTIAL_REVERSAL_ERROR` constants
- delete the `describe("buildShopRefundTransactionInput", …)` and `describe("buildShopRefundTransactionInput allocation coverage", …)` blocks

- [ ] **Step 8: Verify nothing references the removed API**

Run: `grep -rn "postShopTransaction\|postShopRefundTransaction\|buildShopRefundTransactionInput\|allocateAmountAcrossAccounts\|reversedByAccount\|TFSO_VIPPS_RECEIVABLE_ACCOUNT\|TFSO_SHOP_TRANSACTION_TYPE_NUMBER" apps packages --include='*.ts' --include='*.tsx' | grep -v node_modules`
Expected: no matches

Run: `cd packages/connectors && bun test src && cd ../shared && bun run test`
Expected: PASS

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix
git add packages/shared/utils/order-refunds-pure.ts packages/shared/utils/order-refunds-pure.test.ts packages/shared/utils/order-refunds.ts packages/shared/utils/order-refunds.test.ts packages/shared/utils/finago-refund-reverser.ts packages/connectors/src/24sevenoffice
git commit -F - <<'EOF'
Reverse refunds against the same account, VAT code and department

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 9: API cron honours the kill switch and reports configuration gaps

**Files:**
- Modify: `apps/api/src/app/api/cron/reconcile-orders/route.ts` (created in Plan A Task 4)
- Test: `apps/api/src/app/api/cron/reconcile-orders/route.test.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Consumes: `isFeatureEnabled` (`@repo/shared/utils/feature-flags-server`); `FinagoPostingResult.reason === "not_configured"` (Task 7).
- Produces: cron JSON gains `finagoNotConfigured: number` and `finagoSkipped: boolean`; the Finago pass reads oldest orders first and does not run while `shop_ledger_posting` is off.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/app/api/cron/reconcile-orders/route.test.ts`:

Add `isFeatureEnabled: vi.fn(),` to the `mocks` object, and below the other `vi.mock` calls add:

```ts
vi.mock("@repo/shared/utils/feature-flags-server", () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}));
```

In `resetMocks()`, add:

```ts
  mocks.isFeatureEnabled.mockResolvedValue(true);
```

Append at the end of the file:

```ts
describe("reconcile-orders cron: Finago pass", () => {
  beforeEach(resetMocks);

  function wireFinagoRows(rows: unknown[]) {
    db.listRows.mockImplementation(
      (_dbId: string, _tableId: string, queries: string[]) => {
        const isFinagoSweep = queries.some((q) =>
          q.includes("finago_transaction_id")
        );
        return Promise.resolve({ rows: isFinagoSweep ? rows : [] });
      }
    );
  }

  it("skips the pass entirely while shop ledger posting is off", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    wireFinagoRows([shopOrder("shop-1")]);

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(mocks.isFeatureEnabled).toHaveBeenCalledWith("shop_ledger_posting");
    expect(mocks.postFinagoTransactionForOrder).not.toHaveBeenCalled();
    expect(body.finagoSkipped).toBe(true);
    expect(body.finagoPosted).toBe(0);
  });

  it("reads the oldest unposted orders first", async () => {
    wireFinagoRows([]);

    await GET(cronRequest());

    const finagoQueries = db.listRows.mock.calls
      .map((call) => call[2] as string[])
      .find((queries) => queries.some((q) => q.includes("finago_transaction_id")));
    expect(finagoQueries?.some((q) => q.includes('"orderAsc"'))).toBe(true);
  });

  it("counts orders that cannot be posted yet without calling them errors", async () => {
    wireFinagoRows([shopOrder("shop-1"), shopOrder("shop-2")]);
    mocks.postFinagoTransactionForOrder
      .mockResolvedValueOnce({ posted: true, transactionId: "tx-1" })
      .mockResolvedValueOnce({
        detail: '"Hoodie" has no sales type',
        posted: false,
        reason: "not_configured",
      });

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body.finagoSkipped).toBe(false);
    expect(body.finagoPosted).toBe(1);
    expect(body.finagoNotConfigured).toBe(1);
    expect(body.errors).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && bun run test src/app/api/cron/reconcile-orders/route.test.ts`
Expected: FAIL in `Finago pass` — `finagoSkipped` is undefined

- [ ] **Step 3: Update the route**

In `apps/api/src/app/api/cron/reconcile-orders/route.ts`:

Add to the imports:

```ts
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
```

Replace the whole `sweepMissingFinagoPostings` function with:

```ts
async function sweepMissingFinagoPostings(db: AdminDb): Promise<{
  errors: number;
  notConfigured: number;
  posted: number;
  released: number;
}> {
  let posted = 0;
  let released = 0;
  let notConfigured = 0;
  let errors = 0;

  const orders = await db.listRows<FinagoOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("finago_transaction_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    // Oldest first, so a backlog drains in order once a gap is fixed.
    Query.orderAsc("$createdAt"),
    ORDER_ITEMS_SELECT,
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    try {
      if (await releaseStaleFinagoClaim(order, db)) {
        released += 1;
        continue;
      }
      if ((order.finago_posting_lock ?? 0) > 0) {
        continue;
      }
      const result = await postFinagoTransactionForOrder(order.$id, db);
      if (result.posted) {
        posted += 1;
      } else if (result.reason === "not_configured") {
        notConfigured += 1;
      } else if (result.reason === "post_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Finago recovery failed for order ${order.$id}:`,
        error
      );
    }
  }

  return { errors, notConfigured, posted, released };
}
```

In `handle`, replace:

```ts
    const finago = await sweepMissingFinagoPostings(db);
```

with:

```ts
    // While posting is switched off, paid orders simply wait; reading them
    // every run would only spend the sweep's row budget.
    const finago = (await isFeatureEnabled("shop_ledger_posting"))
      ? await sweepMissingFinagoPostings(db)
      : null;
```

and replace the three Finago-related response fields and `errors` with:

```ts
        finagoPosted: finago?.posted ?? 0,
        finagoNotConfigured: finago?.notConfigured ?? 0,
        finagoSkipped: finago === null,
        staleClaimsReleased: finago?.released ?? 0,
```

```ts
        errors: reconcile.errors + (finago?.errors ?? 0) + membership.errors,
```

- [ ] **Step 4: Remove the retired env vars from the API example**

In `apps/api/.env.example`, delete these four lines:

```
# Shop revenue posting (payment webhook callback → Finago). Same number-series
# and receivable account as the web app's checkout return route.
TFSO_SHOP_TRANSACTION_TYPE_NUMBER=""
TFSO_VIPPS_RECEIVABLE_ACCOUNT=""
```

Directly above `TFSO_REST_CLIENT_ID=""`, replace the comment with:

```
# 24SevenOffice Finago REST API (OAuth2 client-credentials). Used for
# reimbursement postings and webshop ledger posting. Shop voucher settings
# (voucher type, clearing accounts, sales types) live in admin → Regnskap.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && bun run test src/app/api/cron/reconcile-orders/route.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add apps/api/src/app/api/cron/reconcile-orders apps/api/.env.example
git commit -F - <<'EOF'
Skip the Finago sweep while posting is off and report config gaps

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 10: Verify Plan B end to end

**Files:** none changed.

- [ ] **Step 1: Types and lint across the repo**

Run: `bun run check-types`
Expected: every package and app passes

Run: `bun run lint`
Expected: no errors

- [ ] **Step 2: Every affected test suite**

Run: `cd packages/connectors && bun test src`
Expected: PASS

Run: `cd packages/shared && bun run test`
Expected: PASS

Run: `cd apps/api && bun run test`
Expected: PASS

Run: `cd apps/admin && bun run test`
Expected: PASS (admin passes `finagoRefundReverser` unchanged)

- [ ] **Step 3: No env-driven shop posting remains**

Run: `grep -rn "TFSO_SHOP_TRANSACTION_TYPE_NUMBER\|TFSO_VIPPS_RECEIVABLE_ACCOUNT\|SHOP_CAMPUS_DEPARTMENT_IDS" apps packages functions --include='*.ts' --include='*.tsx' --include='*.example' | grep -v node_modules`
Expected: no matches

- [ ] **Step 4: Report**

Post the command outputs in the task report. Posting stays switched off in production (`shop_ledger_posting` defaults to false) until Plan C's rollout.

