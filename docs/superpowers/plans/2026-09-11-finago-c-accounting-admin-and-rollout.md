# Finago Plan C — Accounting admin and rollout

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Global and campus admins manage sales types, shop posting settings and the posting switch on a Regnskap page in admin; products pick a sales type instead of typing an account; existing products get their sales types and the stranded order is posted.

**Architecture:** A pure model validates admin input; server actions (global + campus admin, admin client, audited) read and write `sales_types`, the `shop_settings` row `accounting`, and the `shop_ledger_posting` flag. The existing Finago ledger-account sync also stores each account's posting VAT number. The product editor shows a sales-type dropdown and publishing requires one. Two one-off scripts assign sales types and reset the stranded order.

**Tech Stack:** Next.js 16 (App Router, server actions), next-intl, `bun test` (admin), Vitest (`packages/api`), zod, node-appwrite (scripts only), 24SevenOffice SOAP `GetTaxCodeList`.

**Spec:** `docs/superpowers/specs/2026-09-11-finago-shop-ledger-posting-design.md`

**Plan series:** A → B → C (this plan). **C requires A and B merged.**

## Global Constraints

- Package manager is Bun (`bun@1.3.1`). Never use npm or pnpm.
- `bun run check-types` must pass; run `bun x ultracite fix` before each commit.
- A `"use server"` file may export only `async function`s (types are fine). After creating or editing one, run `bun run build --filter=admin`; `check-types` does not catch this rule.
- Accounting settings, sales types and the posting switch are editable by `globaladmin` and `campusadmin` only. Server actions check the role, write through `createAdminClient()`, call `logAuditEvent`, and `revalidatePath`.
- Page location: `/shop/accounting`, nav key `portal.shopAccounting`.
- Sales types store label (NO/EN), revenue account (3000–3999), active, sort order. VAT is never entered; it is the account's synced `vat_code`.
- Never hand-edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`.
- Scripts that write production data are dry-run by default and write only with `--apply` after the owner approves.
- Every commit message ends with exactly these two lines:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv`

---

### Task 1: VAT numbers in the ledger sync, and the accounting role gate

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/client.ts` (`WSDL_URLS`)
- Create: `packages/connectors/src/24sevenoffice/tax-codes.ts`
- Test: `packages/connectors/src/24sevenoffice/tax-codes.test.ts`
- Modify: `packages/connectors/src/24sevenoffice/index.ts`
- Create: `apps/admin/src/lib/finago/ledger-account-row.ts`
- Test: `apps/admin/src/lib/finago/ledger-account-row.test.ts`
- Create: `apps/admin/src/lib/finago/ledger-accounts-sync.ts`
- Modify: `apps/admin/src/app/api/expenses/ledger-accounts/sync/route.ts`
- Modify: `apps/admin/src/lib/roles.ts`
- Test: `apps/admin/src/lib/roles.test.ts`
- Modify: `apps/admin/src/lib/api-auth.ts`

**Interfaces:**
- Produces (`@repo/connectors/24sevenoffice`):
  - `interface TaxCodeListEntry { accountNumber: number | null; name: string; rate: number; taxId: number; taxNumber: number }`
  - `parseTaxCodeList(result: GetTaxCodeListResult | null | undefined): TaxCodeListEntry[]`
  - `taxNumberByTaxId(codes: TaxCodeListEntry[]): Map<number, number>`
  - `getTaxCodes(): Promise<TaxCodeListEntry[]>`
- Produces (admin):
  - `toLedgerAccountRow(account: { name?: string | null; number?: number | null; taxId?: number | null }, vatCodes: Map<number, number>, syncedAt: string): LedgerAccountRow | null`
  - `syncLedgerAccounts(db: AdminDb): Promise<{ failed: number; succeeded: number; syncedAt: string; total: number }>`
  - `canManageAccounting(userRoles: string[]): boolean`; nav key `"portal.shopAccounting"`
  - `requireApiAccountingAdmin(): Promise<ApiAuthResult>`

- [ ] **Step 1: Write the failing connector test**

```ts
// packages/connectors/src/24sevenoffice/tax-codes.test.ts
import { describe, expect, test } from "bun:test";
import { parseTaxCodeList, taxNumberByTaxId } from "./tax-codes";

describe("parseTaxCodeList", () => {
  test("maps the SOAP list to tax id, posting number, rate and account", () => {
    const codes = parseTaxCodeList({
      GetTaxCodeListResult: {
        TaxCodeElement: [
          { AccountNo: 2700, TaxId: 3, TaxName: "Utgående avgift, høy sats", TaxNo: 3, TaxRate: 25 },
          { AccountNo: 0, TaxId: 8, TaxName: "Avgiftsfritt salg innenfor avg.området", TaxNo: 5, TaxRate: 0 },
        ],
      },
    });
    expect(codes).toEqual([
      { accountNumber: 2700, name: "Utgående avgift, høy sats", rate: 25, taxId: 3, taxNumber: 3 },
      { accountNumber: null, name: "Avgiftsfritt salg innenfor avg.området", rate: 0, taxId: 8, taxNumber: 5 },
    ]);
  });

  test("accepts a single element and string numbers", () => {
    const codes = parseTaxCodeList({
      GetTaxCodeListResult: {
        TaxCodeElement: { AccountNo: "0", TaxId: "0", TaxName: "Ingen avgift", TaxNo: "0", TaxRate: "0" },
      },
    });
    expect(codes).toEqual([
      { accountNumber: null, name: "Ingen avgift", rate: 0, taxId: 0, taxNumber: 0 },
    ]);
  });

  test("skips entries without an id or number, and tolerates an empty result", () => {
    expect(
      parseTaxCodeList({
        GetTaxCodeListResult: { TaxCodeElement: [{ TaxName: "Broken" }] },
      })
    ).toEqual([]);
    expect(parseTaxCodeList(null)).toEqual([]);
  });
});

describe("taxNumberByTaxId", () => {
  test("looks up the posting number for an account's tax id", () => {
    const map = taxNumberByTaxId([
      { accountNumber: 2700, name: "Høy", rate: 25, taxId: 3, taxNumber: 3 },
      { accountNumber: null, name: "Fritt", rate: 0, taxId: 8, taxNumber: 5 },
    ]);
    expect(map.get(8)).toBe(5);
    expect(map.get(3)).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/connectors && bun test src/24sevenoffice/tax-codes.test.ts`
Expected: FAIL — `Cannot find module './tax-codes'`

- [ ] **Step 3: Add the SOAP account service and tax code reader**

In `packages/connectors/src/24sevenoffice/client.ts`, add to `WSDL_URLS`:

```ts
  account:
    "https://api.24sevenoffice.com/Economy/Account/V004/Accountservice.asmx?wsdl",
```

```ts
// packages/connectors/src/24sevenoffice/tax-codes.ts
/**
 * 24SevenOffice tax codes (SOAP `GetTaxCodeList`).
 *
 * Accounts carry a tax *id*; ledger postings need the tax *number*
 * (e.g. id 8 → number 5, "Avgiftsfritt salg"). The REST `/taxes` endpoint is
 * not granted to our client, so the list comes from the SOAP account service.
 */
import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

export interface TaxCodeListEntry {
  /** VAT ledger account, or null when the code books no VAT. */
  accountNumber: number | null;
  name: string;
  rate: number;
  taxId: number;
  /** The number to send as `tax.number` on a transaction line. */
  taxNumber: number;
}

interface RawTaxCode {
  AccountNo?: number | string | null;
  TaxId?: number | string | null;
  TaxName?: string | null;
  TaxNo?: number | string | null;
  TaxRate?: number | string | null;
}

export interface GetTaxCodeListResult {
  GetTaxCodeListResult?: {
    TaxCodeElement?: RawTaxCode | RawTaxCode[] | null;
  } | null;
}

function toNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseTaxCodeList(
  result: GetTaxCodeListResult | null | undefined
): TaxCodeListEntry[] {
  const raw = result?.GetTaxCodeListResult?.TaxCodeElement;
  let list: RawTaxCode[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw) {
    list = [raw];
  }

  const entries: TaxCodeListEntry[] = [];
  for (const code of list) {
    const taxId = toNumber(code.TaxId);
    const taxNumber = toNumber(code.TaxNo);
    if (taxId === null || taxNumber === null) {
      continue;
    }
    const account = toNumber(code.AccountNo);
    entries.push({
      accountNumber: account && account > 0 ? account : null,
      name: code.TaxName ?? "",
      rate: toNumber(code.TaxRate) ?? 0,
      taxId,
      taxNumber,
    });
  }
  return entries;
}

export function taxNumberByTaxId(
  codes: TaxCodeListEntry[]
): Map<number, number> {
  return new Map(codes.map((code) => [code.taxId, code.taxNumber]));
}

export async function getTaxCodes(): Promise<TaxCodeListEntry[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("account", session);
  const [result] = (await client.GetTaxCodeListAsync({})) as [
    GetTaxCodeListResult,
  ];
  return parseTaxCodeList(result);
}
```

In `packages/connectors/src/24sevenoffice/index.ts`, add below the `// Products management` export:

```ts
// Tax codes (SOAP — tax id → posting tax number)
export {
  type GetTaxCodeListResult,
  getTaxCodes,
  parseTaxCodeList,
  type TaxCodeListEntry,
  taxNumberByTaxId,
} from "./tax-codes";
```

Run: `cd packages/connectors && bun test src/24sevenoffice/tax-codes.test.ts`
Expected: PASS

- [ ] **Step 4: Write the failing admin row-mapper and role tests**

```ts
// apps/admin/src/lib/finago/ledger-account-row.test.ts
import { describe, expect, test } from "bun:test";
import { toLedgerAccountRow } from "./ledger-account-row";

const VAT_CODES = new Map([
  [3, 3],
  [8, 5],
]);

describe("toLedgerAccountRow", () => {
  test("stores the Finago tax id and the posting VAT number", () => {
    expect(
      toLedgerAccountRow(
        { name: "Salgsinntekt - egenandeler, avgiftsfritt", number: 3100, taxId: 8 },
        VAT_CODES,
        "2026-09-11T10:00:00.000Z"
      )
    ).toEqual({
      $id: "3100",
      account_number: 3100,
      active: true,
      name: "Salgsinntekt - egenandeler, avgiftsfritt",
      synced_at: "2026-09-11T10:00:00.000Z",
      tax_code: 8,
      vat_code: 5,
    });
  });

  test("leaves the VAT number empty when the tax id is unknown", () => {
    expect(
      toLedgerAccountRow({ name: "X", number: 3999, taxId: 42 }, VAT_CODES, "t")
        ?.vat_code
    ).toBeNull();
  });

  test("skips an account without a number", () => {
    expect(toLedgerAccountRow({ name: "X" }, VAT_CODES, "t")).toBeNull();
  });
});
```

In `apps/admin/src/lib/roles.test.ts`, add `canManageAccounting` to the existing import from `./roles`, then append:

```ts
describe("canManageAccounting", () => {
  test("allows global and campus admins", () => {
    expect(canManageAccounting([ROLES.GLOBAL_ADMIN])).toBe(true);
    expect(canManageAccounting([ROLES.CAMPUS_ADMIN])).toBe(true);
  });

  test("denies department members", () => {
    expect(canManageAccounting(["department"])).toBe(false);
    expect(hasNavAccess("portal.shopAccounting", ["department"], true)).toBe(
      false
    );
  });

  test("opens the accounting page to campus admins", () => {
    expect(
      hasNavAccess("portal.shopAccounting", [ROLES.CAMPUS_ADMIN], false)
    ).toBe(true);
  });
});
```

(If `ROLES` or `hasNavAccess` are not yet imported in `roles.test.ts`, add them to the same import.)

Run: `cd apps/admin && bun test src/lib/finago/ledger-account-row.test.ts src/lib/roles.test.ts`
Expected: FAIL — `Cannot find module './ledger-account-row'` and `canManageAccounting` is not exported

- [ ] **Step 5: Implement the mapper, sync service, role gate and API auth**

```ts
// apps/admin/src/lib/finago/ledger-account-row.ts
export interface LedgerAccountRow {
  $id: string;
  account_number: number;
  active: boolean;
  name: string | null;
  synced_at: string;
  /** Finago tax id from the account (not usable as a posting tax number). */
  tax_code: number | null;
  /** Finago posting tax number, resolved from `tax_code`. */
  vat_code: number | null;
}

export function toLedgerAccountRow(
  account: { name?: string | null; number?: number | null; taxId?: number | null },
  vatCodes: Map<number, number>,
  syncedAt: string
): LedgerAccountRow | null {
  if (typeof account.number !== "number") {
    return null;
  }
  const taxId = typeof account.taxId === "number" ? account.taxId : null;
  return {
    $id: String(account.number),
    account_number: account.number,
    active: true,
    name: account.name ?? null,
    synced_at: syncedAt,
    tax_code: taxId,
    vat_code: taxId === null ? null : (vatCodes.get(taxId) ?? null),
  };
}
```

```ts
// apps/admin/src/lib/finago/ledger-accounts-sync.ts
import type { Models } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  getTaxCodes,
  listAccounts,
  taxNumberByTaxId,
} from "@repo/connectors/24sevenoffice";
import { type LedgerAccountRow, toLedgerAccountRow } from "./ledger-account-row";

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

export interface LedgerSyncResult {
  failed: number;
  succeeded: number;
  syncedAt: string;
  total: number;
}

/**
 * Upserts `ledger_accounts` from the Finago chart of accounts, with each
 * account's posting VAT number. Used by the Regnskap page and the expense
 * admin's sync route.
 */
export async function syncLedgerAccounts(db: AdminDb): Promise<LedgerSyncResult> {
  const syncedAt = new Date().toISOString();
  const [accounts, taxCodes] = await Promise.all([
    listAccounts(),
    getTaxCodes(),
  ]);
  const vatCodes = taxNumberByTaxId(taxCodes);

  const rows = accounts
    .map((account) => toLedgerAccountRow(account, vatCodes, syncedAt))
    .filter((row): row is LedgerAccountRow => row !== null);

  const results = await Promise.allSettled(
    rows.map((row) =>
      db.upsertRow<Models.DefaultRow>("app", "ledger_accounts", row.$id, row)
    )
  );
  const succeeded = results.filter((r) => r.status === "fulfilled").length;

  return {
    failed: results.length - succeeded,
    succeeded,
    syncedAt,
    total: accounts.length,
  };
}
```

Replace the full contents of `apps/admin/src/app/api/expenses/ledger-accounts/sync/route.ts` with:

```ts
import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiAccountingAdmin } from "@/lib/api-auth";
import { syncLedgerAccounts } from "@/lib/finago/ledger-accounts-sync";

// POST (not GET): upserts ledger_accounts rows from the 24SevenOffice chart of
// accounts. A mutation must not be triggerable by prefetch/crawlers.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiAccountingAdmin();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { db } = await createAdminClient();
    const result = await syncLedgerAccounts(db);
    return NextResponse.json({ success: result.failed === 0, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

In `apps/admin/src/lib/roles.ts`, add to `NAV_ACCESS` below `"portal.shop"`:

```ts
  // Webshop accounting (sales types, clearing accounts, posting switch) is an
  // organisation-wide finance surface: global and campus admins only.
  "portal.shopAccounting": [ROLES.GLOBAL_ADMIN, ROLES.CAMPUS_ADMIN],
```

and add below `canViewShopOperations`:

```ts
/** Who may edit sales types, shop posting settings and the posting switch. */
export function canManageAccounting(userRoles: string[]): boolean {
  return (
    userRoles.includes(ROLES.GLOBAL_ADMIN) ||
    userRoles.includes(ROLES.CAMPUS_ADMIN)
  );
}
```

In `apps/admin/src/lib/api-auth.ts`, add `import { canManageAccounting } from "@/lib/roles";` and append:

```ts
export async function requireApiAccountingAdmin(): Promise<ApiAuthResult> {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth;
  }
  if (!canManageAccounting(auth.ctx.roles)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/admin && bun test src/lib/finago/ledger-account-row.test.ts src/lib/roles.test.ts`
Expected: PASS

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/connectors/src/24sevenoffice/client.ts packages/connectors/src/24sevenoffice/tax-codes.ts packages/connectors/src/24sevenoffice/tax-codes.test.ts packages/connectors/src/24sevenoffice/index.ts apps/admin/src/lib/finago apps/admin/src/app/api/expenses/ledger-accounts/sync/route.ts apps/admin/src/lib/roles.ts apps/admin/src/lib/roles.test.ts apps/admin/src/lib/api-auth.ts
git commit -F - <<'EOF'
Sync posting VAT numbers with the chart of accounts

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 2: Accounting model and server actions

**Files:**
- Create: `apps/admin/src/app/(portal)/shop/accounting/accounting-model.ts`
- Test: `apps/admin/src/app/(portal)/shop/accounting/accounting-model.test.ts`
- Create: `apps/admin/src/app/(portal)/shop/accounting/actions.ts`

**Interfaces:**
- Consumes: `SALES_TYPES_TABLE`, `SEED_SALES_TYPES`, `SHOP_ACCOUNTING_ROW_ID`, `SHOP_SETTINGS_TABLE`, `DEFAULT_SHOP_ACCOUNTING_SETTINGS`, `parseShopAccountingSettings`, `shopAccountingSettingsSchema`, `ShopAccountingSettings` (Plan B Task 3); `getFlagDef`, `mergeFlagStates` (`@repo/shared/utils/feature-flags`); `syncLedgerAccounts` and `canManageAccounting` (Task 1); generated `SalesTypes`, `LedgerAccounts`, `ShopSettings`, `FeatureFlags`.
- Produces (model, plain module):
  - `salesTypeInputSchema`, `type SalesTypeInput = { account_number: number; active: boolean; label_en: string; label_no: string; sort_order: number }`
  - `SALES_TYPE_ID_RE = /^[a-z0-9-]{1,36}$/`, `salesTypeIdFromLabel(label: string): string`
  - `settingsOrDefault(general: string | null | undefined): { saved: boolean; settings: ShopAccountingSettings }`
  - `interface LedgerAccountOption { accountNumber: number; name: string; vatCode: number | null }`, `revenueAccountOptions(rows): LedgerAccountOption[]`
  - `type VatKind = "exempt" | "none" | "other" | "standard" | "unknown"`, `vatKind(vatCode: number | null): VatKind`
- Produces (actions, `"use server"`):
  - `interface SalesTypeView { $id: string; accountNumber: number; active: boolean; labelEn: string; labelNo: string; sortOrder: number }`
  - `interface AccountingView { accounts: LedgerAccountOption[]; lastSyncedAt: string | null; postingEnabled: boolean; salesTypes: SalesTypeView[]; settings: ShopAccountingSettings; settingsSaved: boolean }`
  - `getAccountingView(): Promise<AccountingView>`
  - `saveSalesType(id: string | null, input: SalesTypeInput): Promise<ActionResult<SalesTypeView>>`
  - `seedDefaultSalesTypes(): Promise<ActionResult<{ created: number }>>`
  - `saveShopAccountingSettings(input: ShopAccountingSettings): Promise<ActionResult<ShopAccountingSettings>>`
  - `setShopLedgerPosting(enabled: boolean): Promise<ActionResult<{ enabled: boolean }>>`
  - `syncLedgerAccountsFromFinago(): Promise<ActionResult<{ failed: number; succeeded: number; syncedAt: string }>>`
  - `type ActionResult<T> = { data: T } | { error: string }`

- [ ] **Step 1: Write the failing model test**

```ts
// apps/admin/src/app/(portal)/shop/accounting/accounting-model.test.ts
import { describe, expect, test } from "bun:test";
import {
  revenueAccountOptions,
  SALES_TYPE_ID_RE,
  salesTypeIdFromLabel,
  salesTypeInputSchema,
  settingsOrDefault,
  vatKind,
} from "./accounting-model";

describe("salesTypeInputSchema", () => {
  test("accepts a revenue account with both labels", () => {
    const parsed = salesTypeInputSchema.safeParse({
      account_number: "3100",
      active: true,
      label_en: " Personal contribution ",
      label_no: "Egenandel",
      sort_order: "10",
    });
    expect(parsed.success && parsed.data).toEqual({
      account_number: 3100,
      active: true,
      label_en: "Personal contribution",
      label_no: "Egenandel",
      sort_order: 10,
    });
  });

  test("rejects a non-revenue account and empty labels", () => {
    expect(
      salesTypeInputSchema.safeParse({
        account_number: 7310,
        active: true,
        label_en: "Social event",
        label_no: "Sosialt",
        sort_order: 0,
      }).success
    ).toBe(false);
    expect(
      salesTypeInputSchema.safeParse({
        account_number: 3100,
        active: true,
        label_en: "",
        label_no: "Egenandel",
        sort_order: 0,
      }).success
    ).toBe(false);
  });
});

describe("salesTypeIdFromLabel", () => {
  test("turns a Norwegian label into a stable row id", () => {
    const id = salesTypeIdFromLabel("Varesalg – klær og merch (25 % mva)");
    expect(id).toBe("varesalg-klaer-og-merch-25-mva");
    expect(SALES_TYPE_ID_RE.test(id)).toBe(true);
    expect(salesTypeIdFromLabel("Bøter på tur")).toBe("boter-pa-tur");
  });
});

describe("settingsOrDefault", () => {
  test("marks saved settings as saved", () => {
    const general = JSON.stringify({
      clearingAccounts: { stripe: 1540, vipps: 1530 },
      transactionTypeNumber: 8,
    });
    expect(settingsOrDefault(general).saved).toBe(true);
  });

  test("pre-fills the ledger's current accounts when nothing is saved", () => {
    expect(settingsOrDefault(null)).toEqual({
      saved: false,
      settings: {
        clearingAccounts: { stripe: 1540, vipps: 1530 },
        transactionTypeNumber: 8,
      },
    });
  });
});

describe("revenueAccountOptions", () => {
  test("keeps active 3xxx accounts, sorted, with their VAT number", () => {
    expect(
      revenueAccountOptions([
        { account_number: 3100, active: true, name: "Egenandeler", vat_code: 5 },
        { account_number: 1530, active: true, name: "Vipps", vat_code: 0 },
        { account_number: 3000, active: true, name: "Salg", vat_code: 3 },
        { account_number: 3040, active: false, name: "Øl", vat_code: 3 },
      ])
    ).toEqual([
      { accountNumber: 3000, name: "Salg", vatCode: 3 },
      { accountNumber: 3100, name: "Egenandeler", vatCode: 5 },
    ]);
  });
});

describe("vatKind", () => {
  test("names the VAT numbers the webshop uses", () => {
    expect(vatKind(3)).toBe("standard");
    expect(vatKind(5)).toBe("exempt");
    expect(vatKind(0)).toBe("none");
    expect(vatKind(31)).toBe("other");
    expect(vatKind(null)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/admin && bun test "src/app/(portal)/shop/accounting/accounting-model.test.ts"`
Expected: FAIL — `Cannot find module './accounting-model'`

- [ ] **Step 3: Write the model**

```ts
// apps/admin/src/app/(portal)/shop/accounting/accounting-model.ts
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

const DIACRITICS_RE = /[\u0300-\u036f]/g;
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
```

Run: `cd apps/admin && bun test "src/app/(portal)/shop/accounting/accounting-model.test.ts"`
Expected: PASS

- [ ] **Step 4: Write the server actions**

```ts
// apps/admin/src/app/(portal)/shop/accounting/actions.ts
"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  FeatureFlags,
  LedgerAccounts,
  SalesTypes,
  ShopSettings,
} from "@repo/api/types/appwrite";
import { getFlagDef, mergeFlagStates } from "@repo/shared/utils/feature-flags";
import {
  SALES_TYPES_TABLE,
  SEED_SALES_TYPES,
  SHOP_ACCOUNTING_ROW_ID,
  SHOP_SETTINGS_TABLE,
  type ShopAccountingSettings,
  shopAccountingSettingsSchema,
} from "@repo/shared/utils/finago-shop-accounting";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import { syncLedgerAccounts } from "@/lib/finago/ledger-accounts-sync";
import { canManageAccounting } from "@/lib/roles";
import { logAuditEvent } from "../../_actions/audit-log";
import {
  type LedgerAccountOption,
  revenueAccountOptions,
  SALES_TYPE_ID_RE,
  type SalesTypeInput,
  salesTypeIdFromLabel,
  salesTypeInputSchema,
  settingsOrDefault,
} from "./accounting-model";

const PAGE_PATH = "/shop/accounting";
const FEATURE_FLAGS_TABLE = "feature_flags";
const LEDGER_ACCOUNTS_TABLE = "ledger_accounts";
const POSTING_FLAG_KEY = "shop_ledger_posting";

type ActionResult<T> = { data: T } | { error: string };

export interface SalesTypeView {
  $id: string;
  accountNumber: number;
  active: boolean;
  labelEn: string;
  labelNo: string;
  sortOrder: number;
}

export interface AccountingView {
  accounts: LedgerAccountOption[];
  lastSyncedAt: string | null;
  postingEnabled: boolean;
  salesTypes: SalesTypeView[];
  settings: ShopAccountingSettings;
  settingsSaved: boolean;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireAccountingAccess(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!canManageAccounting(ctx.roles)) {
    throw new Error(
      "Forbidden: only global and campus admins can manage accounting settings"
    );
  }
  return ctx;
}

function toSalesTypeView(row: SalesTypes): SalesTypeView {
  return {
    $id: row.$id,
    accountNumber: row.account_number,
    active: row.active !== false,
    labelEn: row.label_en,
    labelNo: row.label_no,
    sortOrder: row.sort_order ?? 0,
  };
}

function failure(error: unknown, fallback: string): { error: string } {
  if (isRedirectError(error)) {
    throw error;
  }
  return { error: error instanceof Error ? error.message : fallback };
}

async function readPostingEnabled(db: AdminDb): Promise<boolean> {
  const result = await db.listRows<FeatureFlags>("app", FEATURE_FLAGS_TABLE, [
    Query.equal("key", POSTING_FLAG_KEY),
    Query.limit(1),
  ]);
  return mergeFlagStates(
    result.rows.map((row) => ({ enabled: row.enabled, key: row.key }))
  ).shop_ledger_posting;
}

async function readSettingsRow(db: AdminDb): Promise<ShopSettings | null> {
  return await db
    .getRow<ShopSettings>("app", SHOP_SETTINGS_TABLE, SHOP_ACCOUNTING_ROW_ID)
    .catch(() => null);
}

export async function getAccountingView(): Promise<AccountingView> {
  await requireAccountingAccess();
  const { db } = await createAdminClient();

  const [salesTypes, accounts, settingsRow, postingEnabled] = await Promise.all(
    [
      db.listRows<SalesTypes>("app", SALES_TYPES_TABLE, [
        Query.orderAsc("sort_order"),
        Query.limit(100),
      ]),
      db.listRows<LedgerAccounts>("app", LEDGER_ACCOUNTS_TABLE, [
        Query.orderAsc("account_number"),
        Query.limit(500),
      ]),
      readSettingsRow(db),
      readPostingEnabled(db),
    ]
  );

  const { saved, settings } = settingsOrDefault(settingsRow?.general);
  const lastSyncedAt =
    accounts.rows
      .map((row) => row.synced_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    accounts: revenueAccountOptions(accounts.rows),
    lastSyncedAt,
    postingEnabled,
    salesTypes: salesTypes.rows.map(toSalesTypeView),
    settings,
    settingsSaved: saved,
  };
}

/** Creates (`id` null) or updates a sales type. Audited. */
export async function saveSalesType(
  id: string | null,
  input: SalesTypeInput
): Promise<ActionResult<SalesTypeView>> {
  try {
    const ctx = await requireAccountingAccess();
    const parsed = salesTypeInputSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sales type" };
    }

    const { db } = await createAdminClient();
    const account = await db
      .getRow<LedgerAccounts>(
        "app",
        LEDGER_ACCOUNTS_TABLE,
        String(parsed.data.account_number)
      )
      .catch(() => null);
    if (!account) {
      return {
        error: `Account ${parsed.data.account_number} is not in the synced chart of accounts. Sync from Finago first.`,
      };
    }

    const rowId = id ?? salesTypeIdFromLabel(parsed.data.label_no);
    if (!SALES_TYPE_ID_RE.test(rowId)) {
      return { error: "Could not derive an id from the Norwegian label" };
    }
    if (!id) {
      const existing = await db
        .getRow<SalesTypes>("app", SALES_TYPES_TABLE, rowId)
        .catch(() => null);
      if (existing) {
        return { error: "A sales type with this Norwegian label already exists" };
      }
    }

    const row = await db.upsertRow<SalesTypes>(
      "app",
      SALES_TYPES_TABLE,
      rowId,
      parsed.data
    );

    await logAuditEvent(ctx, id ? "sales_type.update" : "sales_type.create", {
      payload: parsed.data,
      resourceId: rowId,
      resourceType: SALES_TYPES_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: toSalesTypeView(row) };
  } catch (error) {
    return failure(error, "Failed to save sales type");
  }
}

/** Creates the four approved sales types that do not exist yet. Audited. */
export async function seedDefaultSalesTypes(): Promise<
  ActionResult<{ created: number }>
> {
  try {
    const ctx = await requireAccountingAccess();
    const { db } = await createAdminClient();

    let created = 0;
    for (const seed of SEED_SALES_TYPES) {
      const existing = await db
        .getRow<SalesTypes>("app", SALES_TYPES_TABLE, seed.$id)
        .catch(() => null);
      if (existing) {
        continue;
      }
      await db.createRow("app", SALES_TYPES_TABLE, seed.$id, {
        account_number: seed.account_number,
        active: true,
        label_en: seed.label_en,
        label_no: seed.label_no,
        sort_order: seed.sort_order,
      });
      created += 1;
    }

    await logAuditEvent(ctx, "sales_type.seed", {
      payload: { created },
      resourceType: SALES_TYPES_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: { created } };
  } catch (error) {
    return failure(error, "Failed to create default sales types");
  }
}

/** Saves the voucher type and clearing accounts. Audited. */
export async function saveShopAccountingSettings(
  input: ShopAccountingSettings
): Promise<ActionResult<ShopAccountingSettings>> {
  try {
    const ctx = await requireAccountingAccess();
    const parsed = shopAccountingSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        error:
          "Clearing accounts must be 4-digit account numbers and the voucher type a positive number",
      };
    }

    const { db } = await createAdminClient();
    await db.upsertRow<ShopSettings>(
      "app",
      SHOP_SETTINGS_TABLE,
      SHOP_ACCOUNTING_ROW_ID,
      { general: JSON.stringify(parsed.data) }
    );

    await logAuditEvent(ctx, "shop_accounting.update", {
      payload: parsed.data,
      resourceId: SHOP_ACCOUNTING_ROW_ID,
      resourceType: SHOP_SETTINGS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return { data: parsed.data };
  } catch (error) {
    return failure(error, "Failed to save shop accounting settings");
  }
}

/**
 * Switches webshop ledger posting on or off. Switching on requires saved
 * settings and at least one active sales type, so the first sweep cannot
 * fail every order. Audited like the feature flags page.
 */
export async function setShopLedgerPosting(
  enabled: boolean
): Promise<ActionResult<{ enabled: boolean }>> {
  try {
    const ctx = await requireAccountingAccess();
    const { db } = await createAdminClient();

    if (enabled) {
      const [settingsRow, activeTypes] = await Promise.all([
        readSettingsRow(db),
        db.listRows<SalesTypes>("app", SALES_TYPES_TABLE, [
          Query.equal("active", true),
          Query.limit(1),
        ]),
      ]);
      if (
        !settingsOrDefault(settingsRow?.general).saved ||
        activeTypes.rows.length === 0
      ) {
        return {
          error:
            "Save the posting settings and add at least one active sales type before switching posting on",
        };
      }
    }

    const existing = await db.listRows<FeatureFlags>(
      "app",
      FEATURE_FLAGS_TABLE,
      [Query.equal("key", POSTING_FLAG_KEY), Query.limit(1)]
    );
    const existingRow = existing.rows[0];
    const row = existingRow
      ? await db.updateRow<FeatureFlags>(
          "app",
          FEATURE_FLAGS_TABLE,
          existingRow.$id,
          { enabled }
        )
      : await db.createRow<FeatureFlags>(
          "app",
          FEATURE_FLAGS_TABLE,
          ID.unique(),
          {
            description: null,
            enabled,
            key: POSTING_FLAG_KEY,
            title: getFlagDef(POSTING_FLAG_KEY)?.title ?? POSTING_FLAG_KEY,
          }
        );

    await logAuditEvent(ctx, "feature_flag.toggle", {
      payload: { enabled, key: POSTING_FLAG_KEY },
      resourceId: row.$id,
      resourceType: FEATURE_FLAGS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    revalidatePath("/settings/feature-flags");
    return { data: { enabled: row.enabled } };
  } catch (error) {
    return failure(error, "Failed to switch ledger posting");
  }
}

/** Re-syncs the chart of accounts and VAT numbers from Finago. Audited. */
export async function syncLedgerAccountsFromFinago(): Promise<
  ActionResult<{ failed: number; succeeded: number; syncedAt: string }>
> {
  try {
    const ctx = await requireAccountingAccess();
    const { db } = await createAdminClient();
    const result = await syncLedgerAccounts(db);

    await logAuditEvent(ctx, "ledger_accounts.sync", {
      payload: { failed: result.failed, succeeded: result.succeeded },
      resourceType: LEDGER_ACCOUNTS_TABLE,
    });
    revalidatePath(PAGE_PATH);
    return {
      data: {
        failed: result.failed,
        succeeded: result.succeeded,
        syncedAt: result.syncedAt,
      },
    };
  } catch (error) {
    return failure(error, "Failed to sync accounts from Finago");
  }
}
```

- [ ] **Step 5: Verify types and the "use server" export rule**

Run: `bun run check-types`
Expected: PASS

Run: `bun run build --filter=admin`
Expected: `✓ Compiled` with no "Server Actions must be async functions" error

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/shop/accounting"
git commit -F - <<'EOF'
Add accounting actions for sales types, posting settings and the switch

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 3: Regnskap page, navigation and translations

**Files:**
- Create: `apps/admin/src/app/(portal)/shop/accounting/page.tsx`
- Create: `apps/admin/src/app/(portal)/shop/accounting/_components/accounting-client.tsx`
- Modify: `apps/admin/src/lib/nav-tree.ts`
- Test: `apps/admin/src/lib/nav-tree.test.ts`
- Modify: `packages/i18n/messages/no/adminPortal.json`, `packages/i18n/messages/en/adminPortal.json`

**Interfaces:**
- Consumes: every action and type from Task 2; `vatKind`, `LedgerAccountOption` from the model; `STUDIO`, `studioSurface` from `(portal)/_components/studio`; `PageHeader`.
- Produces: route `/shop/accounting`; nav leaf `shopAccounting`; i18n namespace `adminPortal.shopAccounting`.

- [ ] **Step 1: Write the failing navigation test**

Append to `apps/admin/src/lib/nav-tree.test.ts` (add `filterNavTree`, `findActivePath`, `flattenNavTree` to its import from `./nav-tree` if not already imported):

```ts
describe("shop accounting navigation", () => {
  test("highlights the accounting page rather than the shop", () => {
    expect(findActivePath("/shop/accounting")).toBe("/shop/accounting");
    expect(findActivePath("/shop/abc123")).toBe("/shop");
  });

  test("shows the page to campus admins and hides it from department members", () => {
    const campusPaths = flattenNavTree(
      filterNavTree({ hasDepartmentMembership: false, roles: ["campusadmin"] })
    ).map((leaf) => leaf.path);
    const departmentPaths = flattenNavTree(
      filterNavTree({ hasDepartmentMembership: true, roles: [] })
    ).map((leaf) => leaf.path);

    expect(campusPaths).toContain("/shop/accounting");
    expect(departmentPaths).not.toContain("/shop/accounting");
  });
});
```

Run: `cd apps/admin && bun test src/lib/nav-tree.test.ts`
Expected: FAIL — `findActivePath("/shop/accounting")` returns `"/shop"`

- [ ] **Step 2: Add the nav leaf**

In `apps/admin/src/lib/nav-tree.ts`, add `Calculator,` to the `lucide-react` import (alphabetically after `Calendar,`), and directly below `leaf("shop", "portal.shop", "/shop", ShoppingCart),` add:

```ts
  leaf(
    "shopAccounting",
    "portal.shopAccounting",
    "/shop/accounting",
    Calculator
  ),
```

Run: `cd apps/admin && bun test src/lib/nav-tree.test.ts`
Expected: PASS. If an existing test asserts the exact list of top-level leaves, add `"/shop/accounting"` directly after `"/shop"` in that expectation.

- [ ] **Step 3: Add the translations**

In `packages/i18n/messages/no/adminPortal.json`, add to `"nav"` after `"shop": "Produkter",`:

```json
    "shopAccounting": "Regnskap",
```

and add this top-level block directly after the closing `},` of `"paymentSettings"`:

```json
  "shopAccounting": {
    "title": "Regnskap for nettbutikken",
    "description": "Salgstyper, avregningskontoer og automatisk bokføring av nettbutikksalg i Finago. Endringer logges.",
    "postingTitle": "Automatisk bokføring",
    "postingOn": "På — betalte ordre bokføres i Finago",
    "postingOff": "Av — betalte ordre venter og bokføres når dette slås på",
    "postingHint": "Slå på når innstillingene er lagret og produktene har salgstype.",
    "switchOn": "Slå på bokføring",
    "switchOff": "Slå av bokføring",
    "settingsTitle": "Bilag",
    "settingsHint": "Avregningskontoen debiteres med brutto beløp. Utbetalingsbilaget fra Vipps/Stripe krediterer den og fører gebyret.",
    "voucherType": "Bilagsart (nummer)",
    "vippsClearing": "Avregningskonto Vipps",
    "stripeClearing": "Avregningskonto Stripe",
    "notSaved": "Ikke lagret ennå — verdiene under er forslag",
    "save": "Lagre",
    "saved": "Lagret",
    "saveError": "Kunne ikke lagre",
    "salesTypesTitle": "Salgstyper",
    "salesTypesHint": "Produktansvarlige velger en salgstype. Mva følger kontoen i Finago.",
    "labelNo": "Navn (norsk)",
    "labelEn": "Navn (engelsk)",
    "account": "Inntektskonto",
    "chooseAccount": "Velg konto",
    "vat": "Mva",
    "active": "Aktiv",
    "sortOrder": "Rekkefølge",
    "addSalesType": "Legg til salgstype",
    "createDefaults": "Opprett standard salgstyper",
    "noSalesTypes": "Ingen salgstyper ennå.",
    "vatStandard": "25 % mva (kode 3)",
    "vatExempt": "Avgiftsfritt (kode 5)",
    "vatNone": "Ingen mva (kode 0)",
    "vatOther": "Mva-kode {code}",
    "vatUnknown": "Ukjent — synk kontoer",
    "syncTitle": "Kontoplan",
    "syncButton": "Synk kontoer fra Finago",
    "lastSynced": "Sist synket {time}",
    "neverSynced": "Aldri synket",
    "syncDone": "Kontoplan synket"
  },
```

In `packages/i18n/messages/en/adminPortal.json`, add to `"nav"` after `"shop": "Products",`:

```json
    "shopAccounting": "Accounting",
```

and after the closing `},` of `"paymentSettings"`:

```json
  "shopAccounting": {
    "title": "Webshop accounting",
    "description": "Sales types, clearing accounts and automatic posting of webshop sales to Finago. Changes are audited.",
    "postingTitle": "Automatic posting",
    "postingOn": "On — paid orders are posted to Finago",
    "postingOff": "Off — paid orders wait and are posted once this is switched on",
    "postingHint": "Switch on once the settings are saved and products have a sales type.",
    "switchOn": "Switch posting on",
    "switchOff": "Switch posting off",
    "settingsTitle": "Voucher",
    "settingsHint": "The clearing account is debited with the gross amount. The Vipps/Stripe payout voucher credits it and books the fee.",
    "voucherType": "Voucher type (number)",
    "vippsClearing": "Vipps clearing account",
    "stripeClearing": "Stripe clearing account",
    "notSaved": "Not saved yet — the values below are suggestions",
    "save": "Save",
    "saved": "Saved",
    "saveError": "Could not save",
    "salesTypesTitle": "Sales types",
    "salesTypesHint": "Product authors pick a sales type. VAT follows the account in Finago.",
    "labelNo": "Name (Norwegian)",
    "labelEn": "Name (English)",
    "account": "Revenue account",
    "chooseAccount": "Choose account",
    "vat": "VAT",
    "active": "Active",
    "sortOrder": "Order",
    "addSalesType": "Add sales type",
    "createDefaults": "Create default sales types",
    "noSalesTypes": "No sales types yet.",
    "vatStandard": "25 % VAT (code 3)",
    "vatExempt": "VAT-exempt (code 5)",
    "vatNone": "No VAT (code 0)",
    "vatOther": "VAT code {code}",
    "vatUnknown": "Unknown — sync accounts",
    "syncTitle": "Chart of accounts",
    "syncButton": "Sync accounts from Finago",
    "lastSynced": "Last synced {time}",
    "neverSynced": "Never synced",
    "syncDone": "Chart of accounts synced"
  },
```

- [ ] **Step 4: Write the page**

```tsx
// apps/admin/src/app/(portal)/shop/accounting/page.tsx
import { getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { PageHeader } from "../../_components/page-header";
import { AccountingClient } from "./_components/accounting-client";
import { getAccountingView } from "./actions";

export default async function ShopAccountingPage() {
  // Global and campus admins only; the helper 404s for everyone else.
  await requireNavAccess("portal.shopAccounting");
  const t = await getTranslations("adminPortal.shopAccounting");
  const view = await getAccountingView();

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")} />
      <AccountingClient
        initialView={view}
        labels={{
          account: t("account"),
          active: t("active"),
          addSalesType: t("addSalesType"),
          chooseAccount: t("chooseAccount"),
          createDefaults: t("createDefaults"),
          labelEn: t("labelEn"),
          labelNo: t("labelNo"),
          neverSynced: t("neverSynced"),
          noSalesTypes: t("noSalesTypes"),
          notSaved: t("notSaved"),
          postingHint: t("postingHint"),
          postingOff: t("postingOff"),
          postingOn: t("postingOn"),
          postingTitle: t("postingTitle"),
          salesTypesHint: t("salesTypesHint"),
          salesTypesTitle: t("salesTypesTitle"),
          save: t("save"),
          saved: t("saved"),
          saveError: t("saveError"),
          settingsHint: t("settingsHint"),
          settingsTitle: t("settingsTitle"),
          sortOrder: t("sortOrder"),
          stripeClearing: t("stripeClearing"),
          switchOff: t("switchOff"),
          switchOn: t("switchOn"),
          syncButton: t("syncButton"),
          syncDone: t("syncDone"),
          syncTitle: t("syncTitle"),
          vat: t("vat"),
          vatExempt: t("vatExempt"),
          vatNone: t("vatNone"),
          vatOther: t.raw("vatOther") as string,
          vatStandard: t("vatStandard"),
          vatUnknown: t("vatUnknown"),
          vippsClearing: t("vippsClearing"),
          voucherType: t("voucherType"),
          lastSynced: t.raw("lastSynced") as string,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Write the client component**

```tsx
// apps/admin/src/app/(portal)/shop/accounting/_components/accounting-client.tsx
"use client";

import {
  type CSSProperties,
  type ReactNode,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../_components/studio";
import { type LedgerAccountOption, vatKind } from "../accounting-model";
import {
  type AccountingView,
  getAccountingView,
  type SalesTypeView,
  saveSalesType,
  saveShopAccountingSettings,
  seedDefaultSalesTypes,
  setShopLedgerPosting,
  syncLedgerAccountsFromFinago,
} from "../actions";

export interface AccountingLabels {
  account: string;
  active: string;
  addSalesType: string;
  chooseAccount: string;
  createDefaults: string;
  labelEn: string;
  labelNo: string;
  /** Contains `{time}`. */
  lastSynced: string;
  neverSynced: string;
  noSalesTypes: string;
  notSaved: string;
  postingHint: string;
  postingOff: string;
  postingOn: string;
  postingTitle: string;
  salesTypesHint: string;
  salesTypesTitle: string;
  save: string;
  saved: string;
  saveError: string;
  settingsHint: string;
  settingsTitle: string;
  sortOrder: string;
  stripeClearing: string;
  switchOff: string;
  switchOn: string;
  syncButton: string;
  syncDone: string;
  syncTitle: string;
  vat: string;
  vatExempt: string;
  vatNone: string;
  /** Contains `{code}`. */
  vatOther: string;
  vatStandard: string;
  vatUnknown: string;
  vippsClearing: string;
  voucherType: string;
}

const inputStyle: CSSProperties = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: STUDIO.ink,
  fontSize: 13,
  padding: "6px 10px",
};

const buttonStyleFor = (primary: boolean): CSSProperties => ({
  background: primary ? STUDIO.ink : STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: primary ? STUDIO.white : STUDIO.ink,
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 14px",
});

function vatLabel(vatCode: number | null, labels: AccountingLabels): string {
  switch (vatKind(vatCode)) {
    case "standard":
      return labels.vatStandard;
    case "exempt":
      return labels.vatExempt;
    case "none":
      return labels.vatNone;
    case "other":
      return labels.vatOther.replace("{code}", String(vatCode));
    default:
      return labels.vatUnknown;
  }
}

function Panel({
  children,
  hint,
  title,
}: {
  children: ReactNode;
  hint?: string;
  title: string;
}) {
  return (
    <section className="mb-6 rounded-2xl p-5" style={studioSurface}>
      <h2 className="font-medium text-[15px]" style={{ color: STUDIO.ink }}>
        {title}
      </h2>
      {hint && (
        <p className="mt-1 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {hint}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PostingPanel({
  enabled,
  labels,
  onToggle,
  pending,
}: {
  enabled: boolean;
  labels: AccountingLabels;
  onToggle: (enabled: boolean) => void;
  pending: boolean;
}) {
  return (
    <Panel hint={labels.postingHint} title={labels.postingTitle}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 text-sm"
          style={{ color: enabled ? STUDIO.leaf : STUDIO.ink4 }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: enabled ? STUDIO.leaf : STUDIO.ink4 }}
          />
          {enabled ? labels.postingOn : labels.postingOff}
        </span>
        <button
          disabled={pending}
          onClick={() => onToggle(!enabled)}
          style={buttonStyleFor(!enabled)}
          type="button"
        >
          {enabled ? labels.switchOff : labels.switchOn}
        </button>
      </div>
    </Panel>
  );
}

function SettingsPanel({
  labels,
  onSave,
  pending,
  saved,
  settings,
}: {
  labels: AccountingLabels;
  onSave: (values: {
    stripe: string;
    transactionType: string;
    vipps: string;
  }) => void;
  pending: boolean;
  saved: boolean;
  settings: AccountingView["settings"];
}) {
  const [transactionType, setTransactionType] = useState(
    String(settings.transactionTypeNumber)
  );
  const [vipps, setVipps] = useState(String(settings.clearingAccounts.vipps));
  const [stripe, setStripe] = useState(
    String(settings.clearingAccounts.stripe)
  );

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <label className="flex flex-col gap-1 text-[13px]" htmlFor={id}>
      <span style={{ color: STUDIO.ink2 }}>{label}</span>
      <input
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
        value={value}
      />
    </label>
  );

  return (
    <Panel hint={labels.settingsHint} title={labels.settingsTitle}>
      {!saved && (
        <p className="mb-3 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {labels.notSaved}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {field("voucher-type", labels.voucherType, transactionType, setTransactionType)}
        {field("vipps-clearing", labels.vippsClearing, vipps, setVipps)}
        {field("stripe-clearing", labels.stripeClearing, stripe, setStripe)}
      </div>
      <div className="mt-4">
        <button
          disabled={pending}
          onClick={() => onSave({ stripe, transactionType, vipps })}
          style={buttonStyleFor(true)}
          type="button"
        >
          {labels.save}
        </button>
      </div>
    </Panel>
  );
}

interface SalesTypeDraft {
  accountNumber: string;
  active: boolean;
  labelEn: string;
  labelNo: string;
  sortOrder: string;
}

function toDraft(type: SalesTypeView | null, nextSort: number): SalesTypeDraft {
  return {
    accountNumber: type ? String(type.accountNumber) : "",
    active: type?.active ?? true,
    labelEn: type?.labelEn ?? "",
    labelNo: type?.labelNo ?? "",
    sortOrder: String(type?.sortOrder ?? nextSort),
  };
}

function SalesTypeRow({
  accounts,
  labels,
  nextSort,
  onSave,
  pending,
  type,
}: {
  accounts: LedgerAccountOption[];
  labels: AccountingLabels;
  nextSort: number;
  onSave: (id: string | null, draft: SalesTypeDraft) => Promise<boolean>;
  pending: boolean;
  type: SalesTypeView | null;
}) {
  const [draft, setDraft] = useState(() => toDraft(type, nextSort));
  const account = accounts.find(
    (option) => String(option.accountNumber) === draft.accountNumber
  );
  const rowId = type?.$id ?? "new";

  return (
    <tr style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}>
      <td className="py-2 pr-2">
        <input
          aria-label={labels.labelNo}
          onChange={(event) => setDraft({ ...draft, labelNo: event.target.value })}
          style={{ ...inputStyle, width: "100%" }}
          value={draft.labelNo}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={labels.labelEn}
          onChange={(event) => setDraft({ ...draft, labelEn: event.target.value })}
          style={{ ...inputStyle, width: "100%" }}
          value={draft.labelEn}
        />
      </td>
      <td className="py-2 pr-2">
        <select
          aria-label={labels.account}
          onChange={(event) =>
            setDraft({ ...draft, accountNumber: event.target.value })
          }
          style={{ ...inputStyle, width: "100%" }}
          value={draft.accountNumber}
        >
          <option value="">{labels.chooseAccount}</option>
          {accounts.map((option) => (
            <option key={option.accountNumber} value={option.accountNumber}>
              {option.accountNumber} {option.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2 text-[13px]" style={{ color: STUDIO.ink2 }}>
        {vatLabel(account?.vatCode ?? null, labels)}
      </td>
      <td className="py-2 pr-2 text-center">
        <input
          aria-label={labels.active}
          checked={draft.active}
          id={`active-${rowId}`}
          onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
          type="checkbox"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={labels.sortOrder}
          inputMode="numeric"
          onChange={(event) =>
            setDraft({ ...draft, sortOrder: event.target.value })
          }
          style={{ ...inputStyle, width: 64 }}
          value={draft.sortOrder}
        />
      </td>
      <td className="py-2 text-right">
        <button
          disabled={pending}
          onClick={async () => {
            const ok = await onSave(type?.$id ?? null, draft);
            if (ok && !type) {
              setDraft(toDraft(null, nextSort + 10));
            }
          }}
          style={buttonStyleFor(!type)}
          type="button"
        >
          {type ? labels.save : labels.addSalesType}
        </button>
      </td>
    </tr>
  );
}

export function AccountingClient({
  initialView,
  labels,
}: {
  initialView: AccountingView;
  labels: AccountingLabels;
}) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();

  const reload = async () => {
    setView(await getAccountingView());
  };

  const run = (work: () => Promise<void>) => {
    startTransition(async () => {
      await work();
    });
  };

  const nextSort =
    (view.salesTypes.at(-1)?.sortOrder ?? 0) + 10;

  const handleSaveSalesType = async (
    id: string | null,
    draft: SalesTypeDraft
  ): Promise<boolean> => {
    const result = await saveSalesType(id, {
      account_number: Number(draft.accountNumber),
      active: draft.active,
      label_en: draft.labelEn,
      label_no: draft.labelNo,
      sort_order: Number(draft.sortOrder),
    });
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(labels.saved);
    await reload();
    return true;
  };

  return (
    <div className="mt-6">
      <PostingPanel
        enabled={view.postingEnabled}
        labels={labels}
        onToggle={(enabled) =>
          run(async () => {
            const result = await setShopLedgerPosting(enabled);
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success(labels.saved);
            await reload();
          })
        }
        pending={pending}
      />

      <SettingsPanel
        labels={labels}
        onSave={(values) =>
          run(async () => {
            const result = await saveShopAccountingSettings({
              clearingAccounts: {
                stripe: Number(values.stripe),
                vipps: Number(values.vipps),
              },
              transactionTypeNumber: Number(values.transactionType),
            });
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success(labels.saved);
            await reload();
          })
        }
        pending={pending}
        saved={view.settingsSaved}
        settings={view.settings}
      />

      <Panel hint={labels.salesTypesHint} title={labels.salesTypesTitle}>
        {view.salesTypes.length === 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
              {labels.noSalesTypes}
            </span>
            <button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await seedDefaultSalesTypes();
                  if ("error" in result) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(labels.saved);
                  await reload();
                })
              }
              style={buttonStyleFor(true)}
              type="button"
            >
              {labels.createDefaults}
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px]" style={{ color: STUDIO.ink4 }}>
                <th className="pb-2 font-normal">{labels.labelNo}</th>
                <th className="pb-2 font-normal">{labels.labelEn}</th>
                <th className="pb-2 font-normal">{labels.account}</th>
                <th className="pb-2 font-normal">{labels.vat}</th>
                <th className="pb-2 font-normal">{labels.active}</th>
                <th className="pb-2 font-normal">{labels.sortOrder}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {view.salesTypes.map((type) => (
                <SalesTypeRow
                  accounts={view.accounts}
                  key={`${type.$id}-${type.accountNumber}-${type.sortOrder}`}
                  labels={labels}
                  nextSort={nextSort}
                  onSave={handleSaveSalesType}
                  pending={pending}
                  type={type}
                />
              ))}
              <SalesTypeRow
                accounts={view.accounts}
                key={`new-${view.salesTypes.length}`}
                labels={labels}
                nextSort={nextSort}
                onSave={handleSaveSalesType}
                pending={pending}
                type={null}
              />
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={labels.syncTitle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
            {view.lastSyncedAt
              ? labels.lastSynced.replace(
                  "{time}",
                  new Date(view.lastSyncedAt).toLocaleString("nb-NO")
                )
              : labels.neverSynced}
          </span>
          <button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await syncLedgerAccountsFromFinago();
                if ("error" in result) {
                  toast.error(result.error);
                  return;
                }
                toast.success(labels.syncDone);
                await reload();
              })
            }
            style={buttonStyleFor(false)}
            type="button"
          >
            {labels.syncButton}
          </button>
        </div>
      </Panel>
    </div>
  );
}
```

- [ ] **Step 6: Verify the page builds and renders**

Run: `bun run check-types && bun run build --filter=admin`
Expected: PASS, `✓ Compiled`

Run: `bun run dev --filter=admin`, sign in as a global admin, open `http://localhost:3001/shop/accounting`.
Expected: the four panels render; "Regnskap" appears in the sidebar under Produkter. Do not press any save/sync/switch buttons against production data during this check.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/shop/accounting" apps/admin/src/lib/nav-tree.ts apps/admin/src/lib/nav-tree.test.ts packages/i18n/messages/no/adminPortal.json packages/i18n/messages/en/adminPortal.json
git commit -F - <<'EOF'
Add the Regnskap page for webshop accounting

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 4: Products pick a sales type, and publishing requires one

**Files:**
- Modify: `apps/admin/src/app/(portal)/_actions/schemas.ts` (`productSchema`)
- Test: `apps/admin/src/app/(portal)/_actions/product-sales-type.test.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/lookups.ts`
- Modify: `apps/admin/src/app/(portal)/_actions/shop.ts` (`buildProductFields`, `createProduct`, `updateProduct`)
- Modify: `apps/admin/src/app/(portal)/_actions/shop-translation.cases.ts:61`, `apps/admin/src/app/(portal)/_actions/shop-relationships.test.ts:62`, `apps/admin/src/app/(portal)/_actions/content-scoping.test.ts:169`
- Modify: `apps/admin/src/app/(portal)/shop/[id]/page.tsx`
- Modify: `apps/admin/src/app/(portal)/shop/[id]/_components/shop-studio-editor.tsx`

**Interfaces:**
- Consumes: `sales_types` rows (Plan B Task 1), generated `SalesTypes`.
- Produces:
  - `ProductFormValues.sales_type?: string | null` (replaces `finago_account_number`)
  - `interface SalesTypeOption { accountNumber: number; id: string; labelEn: string; labelNo: string }`, `listSalesTypeOptions(): Promise<SalesTypeOption[]>` (active types, sorted)
  - `ShopStudioEditorProps.salesTypes: SalesTypeOption[]`

- [ ] **Step 1: Write the failing schema test**

```ts
// apps/admin/src/app/(portal)/_actions/product-sales-type.test.ts
import { describe, expect, test } from "bun:test";
import { productSchema } from "./schemas";

const base = {
  campus_id: "1",
  name: "Sivøk genser (M)",
  regular_price: 299,
  slug: "sivok-genser-m",
  status: "draft" as const,
};

function salesTypeIssue(values: Record<string, unknown>) {
  const parsed = productSchema.safeParse(values);
  return parsed.success
    ? undefined
    : parsed.error.issues.find((issue) => issue.path[0] === "sales_type");
}

describe("product sales type", () => {
  test("a draft can be saved without a sales type", () => {
    expect(productSchema.safeParse(base).success).toBe(true);
  });

  test("publishing requires a sales type", () => {
    expect(salesTypeIssue({ ...base, status: "published" })?.message).toBe(
      "Choose a sales type before publishing"
    );
  });

  test("sending for approval requires a sales type", () => {
    expect(
      salesTypeIssue({ ...base, status: "pending_approval" })
    ).toBeDefined();
  });

  test("a product with a sales type can be published", () => {
    expect(
      productSchema.safeParse({
        ...base,
        sales_type: "varesalg",
        status: "published",
      }).success
    ).toBe(true);
  });

  test("a name is still required", () => {
    const parsed = productSchema.safeParse({ ...base, name: "" });
    expect(parsed.success).toBe(false);
  });
});
```

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/product-sales-type.test.ts"`
Expected: FAIL — "publishing requires a sales type" gets `undefined`

- [ ] **Step 2: Change the product schema**

In `apps/admin/src/app/(portal)/_actions/schemas.ts`, inside `productSchema`, replace:

```ts
    finago_account_number: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .nullable(),
  })
  .superRefine((values, context) => {
    if (values.name.trim() || values.name_en?.trim()) {
      return;
    }
    context.addIssue({
      code: "custom",
      message: "A Norwegian or English name is required",
      path: ["name"],
    });
  });
```

with:

```ts
    // `sales_types` row id. Decides the Finago revenue account and VAT code a
    // sale of this product is booked under.
    sales_type: z.string().max(36).optional().nullable(),
  })
  .superRefine((values, context) => {
    if (!(values.name.trim() || values.name_en?.trim())) {
      context.addIssue({
        code: "custom",
        message: "A Norwegian or English name is required",
        path: ["name"],
      });
    }
    const goesLive =
      values.status === "published" || values.status === "pending_approval";
    if (goesLive && !values.sales_type) {
      context.addIssue({
        code: "custom",
        message: "Choose a sales type before publishing",
        path: ["sales_type"],
      });
    }
  });
```

In `shop-translation.cases.ts` (line 61), `shop-relationships.test.ts` (line 62) and `content-scoping.test.ts` (line 169), replace `finago_account_number: null,` with `sales_type: null,`.

Run: `cd apps/admin && bun test "src/app/(portal)/_actions/product-sales-type.test.ts"`
Expected: PASS

- [ ] **Step 3: List active sales types for the editor**

In `apps/admin/src/app/(portal)/_actions/lookups.ts`, change the types import to:

```ts
import type {
  Campus,
  Departments,
  SalesTypes,
} from "@repo/api/types/appwrite";
```

and append:

```ts
export interface SalesTypeOption {
  accountNumber: number;
  id: string;
  labelEn: string;
  labelNo: string;
}

/** Active sales types for the product editor, in the order finance set. */
export async function listSalesTypeOptions(): Promise<SalesTypeOption[]> {
  await requireAuth();
  const { db } = await createAdminClient();
  const response = await db.listRows<SalesTypes>("app", "sales_types", [
    Query.equal("active", true),
    Query.orderAsc("sort_order"),
    Query.limit(100),
  ]);
  return response.rows.map((row) => ({
    accountNumber: row.account_number,
    id: row.$id,
    labelEn: row.label_en,
    labelNo: row.label_no,
  }));
}
```

- [ ] **Step 4: Save the reference and re-check it on publish**

In `apps/admin/src/app/(portal)/_actions/shop.ts`:

Add `SalesTypes` to the existing `import type { … } from "@repo/api/types/appwrite";`.

In `buildProductFields`, replace `finago_account_number: data.finago_account_number ?? null,` with:

```ts
    sales_type: data.sales_type ?? null,
```

Add this private helper directly below `buildProductFields` (not exported — this is a `"use server"` file):

```ts
/**
 * The schema already requires a sales type to publish; this also refuses one
 * that has since been deactivated or deleted, so a live product always books
 * to a sales type finance still stands behind.
 */
async function assertSalesTypeUsable(
  db: AdminDb,
  data: ProductFormValues
): Promise<void> {
  if (!(data.status === "published" || data.status === "pending_approval")) {
    return;
  }
  const salesType = data.sales_type
    ? await db
        .getRow<SalesTypes>("app", "sales_types", data.sales_type)
        .catch(() => null)
    : null;
  if (!salesType || salesType.active === false) {
    throw new Error("Choose an active sales type before publishing");
  }
}
```

In `createProduct`, directly after the `await assertContentOwnership(db, ctx, { … });` call, add:

```ts
    await assertSalesTypeUsable(db, validated.data);
```

In `updateProduct`, directly after its `await assertContentOwnership(db, ctx, { … });` call, add the same line.

- [ ] **Step 5: Pass the options into the editor page**

In `apps/admin/src/app/(portal)/shop/[id]/page.tsx`, change the lookups import to:

```ts
import {
  listCampuses,
  listDepartmentsForCampus,
  listSalesTypeOptions,
} from "../../_actions/lookups";
```

Replace:

```ts
  const [product, campuses] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
  ]);
```

with:

```ts
  const [product, campuses, salesTypes] = await Promise.all([
    isNew ? null : getProduct(id),
    listCampuses(),
    listSalesTypeOptions(),
  ]);
```

and add `salesTypes={salesTypes}` to the `<ShopStudioEditor … />` props (after `product={product}`).

- [ ] **Step 6: Replace the account field with a sales-type dropdown**

In `apps/admin/src/app/(portal)/shop/[id]/_components/shop-studio-editor.tsx`:

1. Add the import:

```ts
import type { SalesTypeOption } from "../../../_actions/lookups";
```

2. In `type ProductWithTranslations`, delete `finago_account_number?: number | null;`.

3. In `interface ShopStudioEditorProps`, add `salesTypes: SalesTypeOption[];`, and add `salesTypes` to the destructured props of `ShopStudioEditor`.

4. Replace the state declaration:

```ts
  const [finagoAccountNumber, setFinagoAccountNumber] = useState<number | null>(
    product?.finago_account_number ?? null
  );
```

with:

```ts
  const [salesType, setSalesType] = useState<string | null>(
    product?.sales_type ?? null
  );
```

5. In `buildPayload`, replace `finago_account_number: finagoAccountNumber,` with `sales_type: salesType,`.

6. In `EssentialsStep`'s destructured parameters replace `finagoAccountNumber,` with `salesType,` and `setFinagoAccountNumber,` with `setSalesType,`, and add `salesTypes,`. In its prop type replace `finagoAccountNumber: number | null;` with `salesType: string | null;` and `setFinagoAccountNumber: (v: number | null) => void;` with `setSalesType: (v: string | null) => void;`, and add `salesTypes: SalesTypeOption[];`.

7. Replace the whole `{/* Finago account number */}` block (the `<div>` with the number input and the "GL revenue account" hint) with:

```tsx
          {/* Sales type — decides the Finago revenue account and VAT */}
          <div>
            <FieldLabel>Sales type</FieldLabel>
            <select
              onChange={(e) => setSalesType(e.target.value || null)}
              style={fieldInputStyle()}
              value={salesType ?? ""}
            >
              <option value="">Choose a sales type</option>
              {salesTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.labelNo} ({type.accountNumber})
                </option>
              ))}
              {salesType && !salesTypes.some((type) => type.id === salesType) && (
                <option value={salesType}>{salesType} (inactive)</option>
              )}
            </select>
            <div
              style={{
                color: BRAND.ink,
                fontSize: 11,
                marginTop: 4,
                opacity: 0.5,
              }}
            >
              Required to publish. Decides the Finago revenue account and VAT.
            </div>
          </div>
```

8. Where `<EssentialsStep … />` is rendered, replace `finagoAccountNumber={finagoAccountNumber}` with `salesType={salesType}`, `setFinagoAccountNumber={setFinagoAccountNumber}` with `setSalesType={setSalesType}`, and add `salesTypes={salesTypes}`.

9. In `handleSubmit`, replace:

```ts
      if ("error" in result) {
        toast.error("Failed to save product");
```

with:

```ts
      if ("error" in result) {
        const message =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error ?? {}).flat()[0];
        toast.error(message ?? "Failed to save product");
```

- [ ] **Step 7: Verify**

Run: `grep -rn "finago_account_number\|finagoAccountNumber" apps/admin/src --include='*.ts' --include='*.tsx'`
Expected: no matches

Run: `cd apps/admin && bun test src && cd ../.. && bun run check-types && bun run build --filter=admin`
Expected: PASS, `✓ Compiled`

Run the admin dev server, open a draft product, and confirm the "Sales type" dropdown lists the active sales types and that choosing **Publish** without one shows "Choose a sales type before publishing". Use a draft you create for the check and delete it afterwards.

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix
git add "apps/admin/src/app/(portal)/_actions" "apps/admin/src/app/(portal)/shop/[id]"
git commit -F - <<'EOF'
Pick a sales type per product and require one to publish

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 5: One-off scripts — assign sales types and reset the stranded order

**Files:**
- Create: `packages/api/scripts/product-sales-type-map.ts`
- Test: `packages/api/scripts/product-sales-type-map.test.ts`
- Create: `packages/api/scripts/assign-product-sales-types.ts`
- Create: `packages/api/scripts/reset-stranded-finago-posting.ts`
- Modify: `packages/api/package.json` (`scripts`)

**Interfaces:**
- Consumes: `node-appwrite` `Client`, `TablesDB` (object-parameter API, as in `scripts/cutover-content-permissions.ts`), `Query`; env from `apps/admin/.env.local` (`NEXT_PUBLIC_APPWRITE_ENDPOINT`, `NEXT_PUBLIC_APPWRITE_PROJECT`, `APPWRITE_API_KEY`, `TFSO_REST_CLIENT_ID`, `TFSO_REST_CLIENT_SECRET`, `TFSO_REST_ORG_ID`).
- Produces:
  - `PRODUCT_SALES_TYPES: Readonly<Record<string, readonly string[]>>` (sales type id → product ids), `PRODUCTS_TO_ARCHIVE: readonly string[]`
  - `planProductUpdates(products: ReadonlyArray<{ $id: string; sales_type?: string | null; status: string }>): { archive: string[]; assign: Array<{ from: string | null; id: string; to: string }>; unmapped: string[] }`
  - `bun run finago:assign-sales-types [-- --apply]`, `bun run finago:reset-stranded-posting -- <orderId> [--apply]` (from `packages/api`)

- [ ] **Step 1: Write the failing mapping test**

```ts
// packages/api/scripts/product-sales-type-map.test.ts
import { describe, expect, it } from "vitest";
import {
  PRODUCT_SALES_TYPES,
  PRODUCTS_TO_ARCHIVE,
  planProductUpdates,
} from "./product-sales-type-map";

const allMapped = Object.values(PRODUCT_SALES_TYPES).flat();

describe("product sales type map", () => {
  it("covers all 58 products exactly once", () => {
    const every = [...allMapped, ...PRODUCTS_TO_ARCHIVE];
    expect(every).toHaveLength(58);
    expect(new Set(every).size).toBe(58);
  });

  it("uses only the seeded sales types", () => {
    expect(Object.keys(PRODUCT_SALES_TYPES).sort()).toEqual([
      "annet-avgiftsfritt",
      "bokskapleie",
      "egenandel",
      "varesalg",
    ]);
  });

  it("puts the stranded order's sweater under Varesalg pending the accountant", () => {
    expect(PRODUCT_SALES_TYPES.varesalg).toContain("wpprod65924");
  });
});

describe("planProductUpdates", () => {
  it("assigns missing sales types, skips correct ones, archives, and reports unmapped", () => {
    const plan = planProductUpdates([
      { $id: "wpprod65924", sales_type: null, status: "published" },
      { $id: "wpprod65811", sales_type: "annet-avgiftsfritt", status: "published" },
      { $id: "wpprod32094", sales_type: null, status: "draft" },
      { $id: "brand-new", sales_type: null, status: "published" },
    ]);

    expect(plan.assign).toEqual([
      { from: null, id: "wpprod65924", to: "varesalg" },
    ]);
    expect(plan.archive).toEqual(["wpprod32094"]);
    expect(plan.unmapped).toEqual(["brand-new"]);
  });

  it("does not archive a product that is already archived", () => {
    expect(
      planProductUpdates([
        { $id: "wpprod32094", sales_type: null, status: "archived" },
      ]).archive
    ).toEqual([]);
  });
});
```

Run: `cd packages/api && bun run test scripts/product-sales-type-map.test.ts`
Expected: FAIL — `Failed to resolve import "./product-sales-type-map"`

- [ ] **Step 2: Write the mapping**

```ts
// packages/api/scripts/product-sales-type-map.ts
/**
 * Sales type per existing webshop product, as agreed on 2026-09-11 (see the
 * Finago shop ledger posting spec). Edit the Varesalg bucket before applying if
 * the accountant books sweaters, vests or the camera sale differently.
 */
export const PRODUCT_SALES_TYPES: Readonly<Record<string, readonly string[]>> = {
  egenandel: [
    "wpprod65895", // Avslutningsfest 23. mai
    "wpprod65721", // Blåtur (Bergensbaneløpet hyttetur)
    "wpprod65640", // Blåtur NU
    "wpprod63922", // Børsgruppen — egenandel reise
    "wpprod65436", // Delbetaling 2 ØKAD linjetur
    "wpprod65435", // Styret ØKAD linjetur
    "wpprod65894", // egenadel hyttetur fadderullan
    "wpprod65571", // Egenandel hyttetur Karrieredagene
    "wpprod65722", // KD hyttetur egenandel
    "wpprod64919", // NU hyttetur Trysil
    "wpprod64111", // Hyttetur Makroøkonomisk utvalg – Hemsedal
    "wpprod65946", // overlapstur
    "wpprod65890", // Egenandel Overlapps tur Stavanger
    "wpprod63914", // Egenandel – Investment
    "wpprod65918", // Ownshare debate
    "wpprod65025", // Linjetur forretningsjus
    "wpprod65744", // innbetaling forretningsjus
    "wpprod65346", // Utenlandstur HR delbetaling 1
    "wpprod65504", // Finans & HR linjetur Milano 2026 delbetaling 2
    "wpprod65558", // HR linjetur Milano 2026
    "wpprod63535", // Payment 1 – ownshare – HR to Paris
    "wpprod63959", // Payment 2 – ownshare – HR to Paris
    "wpprod66774", // EMS Linjetur Styret (draft)
    "wpprod66775", // EMS Linjetur Styret 2 (draft)
    "wpprod7000", // Extra fee for individual hotel room (draft)
    "wpprod65891", // Oliver Wolt — personal deductible
    // Bergensbaneløpet personal deductibles
    "wpprod65835",
    "wpprod65824",
    "wpprod65820",
    "wpprod65830",
    "wpprod65823",
    "wpprod65833",
    "wpprod65826",
    "wpprod65819",
    "wpprod65822",
    "wpprod65825",
    "wpprod65829",
    "wpprod65831",
    "wpprod65832",
    "wpprod65821",
    "wpprod65827",
    "wpprod65828",
  ],
  varesalg: [
    "wpprod65924", // Gensere til børsgruppen
    "wpprod61903", // Sivøk genser (S)
    "wpprod61904", // Sivøk genser (M)
    "wpprod61905", // Sivøk genser (L)
    "wpprod61906", // Sivøk genser (XL)
    "wpprod61050", // Egenandel – BISO genser Trondheim 2025
    "wpprod64373", // Egenandel – BISO vester Trondheim 2025
    "wpprod65803", // Egenandel Vest Stavanger
    "wpprod64522", // Egenandel – Regnskaps-halvglidelås
    "wpprod65812", // salg av kamera – biso media
  ],
  bokskapleie: [
    "wpprod6833", // Bokskap – Campus Trondheim
    "wpprod37313", // Booklocker – Campus Oslo (Se beskrivelse)
    "wpprod6814", // Booklocker – Campus Oslo (Les beskrivelse)
  ],
  "annet-avgiftsfritt": [
    "wpprod65811", // Bot etter tur
  ],
};

export const PRODUCTS_TO_ARCHIVE: readonly string[] = [
  "wpprod32094", // BISO Membership — legacy WordPress draft
  "6aa124c50025dd3bf154", // test
];

export function planProductUpdates(
  products: ReadonlyArray<{
    $id: string;
    sales_type?: string | null;
    status: string;
  }>
): {
  archive: string[];
  assign: Array<{ from: string | null; id: string; to: string }>;
  unmapped: string[];
} {
  const targetById = new Map<string, string>();
  for (const [salesType, ids] of Object.entries(PRODUCT_SALES_TYPES)) {
    for (const id of ids) {
      targetById.set(id, salesType);
    }
  }
  const archiveIds = new Set(PRODUCTS_TO_ARCHIVE);

  const plan = {
    archive: [] as string[],
    assign: [] as Array<{ from: string | null; id: string; to: string }>,
    unmapped: [] as string[],
  };

  for (const product of products) {
    if (archiveIds.has(product.$id)) {
      if (product.status !== "archived") {
        plan.archive.push(product.$id);
      }
      continue;
    }
    const target = targetById.get(product.$id);
    if (!target) {
      plan.unmapped.push(product.$id);
      continue;
    }
    if (product.sales_type !== target) {
      plan.assign.push({
        from: product.sales_type ?? null,
        id: product.$id,
        to: target,
      });
    }
  }
  return plan;
}
```

Run: `cd packages/api && bun run test scripts/product-sales-type-map.test.ts`
Expected: PASS

- [ ] **Step 3: Write the assignment script**

```ts
// packages/api/scripts/assign-product-sales-types.ts
/**
 * Assigns a sales type to every existing webshop product and archives the two
 * legacy products. Dry-run by default; pass --apply to write.
 *
 * Run AFTER the sales types exist (admin → Regnskap → "Opprett standard
 * salgstyper") and AFTER the accountant has confirmed the Varesalg bucket.
 *
 * Usage (from packages/api):
 *   bun run finago:assign-sales-types
 *   bun run finago:assign-sales-types -- --apply
 */
import { Client, Query, TablesDB } from "node-appwrite";
import {
  PRODUCT_SALES_TYPES,
  planProductUpdates,
} from "./product-sales-type-map";

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!(endpoint && project && apiKey)) {
  console.error(
    "Missing Appwrite configuration: need NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT, and APPWRITE_API_KEY."
  );
  process.exit(2);
}

const apply = process.argv.includes("--apply");
const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);

for (const salesTypeId of Object.keys(PRODUCT_SALES_TYPES)) {
  const row = await db
    .getRow({ databaseId: "app", rowId: salesTypeId, tableId: "sales_types" })
    .catch(() => null);
  if (!row || (row as { active?: boolean }).active === false) {
    console.error(
      `Sales type "${salesTypeId}" is missing or inactive. Create the default sales types in admin first.`
    );
    process.exit(1);
  }
}

const products = await db.listRows({
  databaseId: "app",
  queries: [Query.select(["$id", "sales_type", "status"]), Query.limit(500)],
  tableId: "webshop_products",
});
const plan = planProductUpdates(
  products.rows as unknown as Array<{
    $id: string;
    sales_type: string | null;
    status: string;
  }>
);

console.log(`Mode: ${apply ? "APPLY" : "dry-run"}`);
console.log(`${apply ? "Assigning" : "Would assign"}: ${plan.assign.length}`);
for (const change of plan.assign) {
  console.log(`  ${change.id}: ${change.from ?? "—"} → ${change.to}`);
}
console.log(`${apply ? "Archiving" : "Would archive"}: ${plan.archive.length}`);
for (const id of plan.archive) {
  console.log(`  ${id}`);
}
if (plan.unmapped.length > 0) {
  console.log(`Not in the map (left untouched): ${plan.unmapped.length}`);
  for (const id of plan.unmapped) {
    console.log(`  ${id}`);
  }
}

if (apply) {
  for (const change of plan.assign) {
    await db.updateRow({
      data: { sales_type: change.to },
      databaseId: "app",
      rowId: change.id,
      tableId: "webshop_products",
    });
  }
  for (const id of plan.archive) {
    await db.updateRow({
      data: { status: "archived" },
      databaseId: "app",
      rowId: id,
      tableId: "webshop_products",
    });
  }
  console.log("Done.");
}
```

- [ ] **Step 4: Write the stranded-order reset script**

```ts
// packages/api/scripts/reset-stranded-finago-posting.ts
/**
 * Clears the "posting" marker on an order whose Finago post was attempted but
 * never recorded, so the reconcile sweep can post it again. Refuses unless the
 * order carries the marker AND Finago has no transaction line mentioning the
 * order id around its date. Dry-run by default; pass --apply to write.
 *
 * Usage (from packages/api):
 *   bun run finago:reset-stranded-posting -- 6aa19747003c79019977
 *   bun run finago:reset-stranded-posting -- 6aa19747003c79019977 --apply
 */
import { Client, TablesDB } from "node-appwrite";

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 1;
const LOOKAHEAD_DAYS = 5;

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
const project =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT ?? process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const clientId = process.env.TFSO_REST_CLIENT_ID;
const clientSecret = process.env.TFSO_REST_CLIENT_SECRET;
const orgId = process.env.TFSO_REST_ORG_ID;

const orderId = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const apply = process.argv.includes("--apply");

if (!(endpoint && project && apiKey && clientId && clientSecret && orgId)) {
  console.error("Missing Appwrite or TFSO_REST_* configuration.");
  process.exit(2);
}
if (!orderId) {
  console.error("Pass the order id as the first argument.");
  process.exit(2);
}

const db = new TablesDB(
  new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
);
const order = (await db.getRow({
  databaseId: "app",
  rowId: orderId,
  tableId: "orders",
})) as unknown as {
  $createdAt: string;
  finago_posting_lock?: number | null;
  finago_transaction_id?: string | null;
  status?: string | null;
  total?: number | null;
};

console.log(
  `Order ${orderId}: status=${order.status} total=${order.total} finago_transaction_id=${order.finago_transaction_id} lock=${order.finago_posting_lock}`
);
if (order.finago_transaction_id !== "posting") {
  console.error('Refusing: the order does not carry the "posting" marker.');
  process.exit(1);
}

const tokenResponse = await fetch("https://login.24sevenoffice.com/oauth/token", {
  body: new URLSearchParams({
    audience: "https://api.24sevenoffice.com",
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    login_organization: orgId,
  }),
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  method: "POST",
});
const { access_token: token } = (await tokenResponse.json()) as {
  access_token?: string;
};
if (!token) {
  console.error("Could not get a Finago token.");
  process.exit(1);
}

const created = Date.parse(order.$createdAt);
const dateFrom = new Date(created - LOOKBACK_DAYS * DAY_MS)
  .toISOString()
  .slice(0, 10);
const dateTo = new Date(created + LOOKAHEAD_DAYS * DAY_MS)
  .toISOString()
  .slice(0, 10);
const linesResponse = await fetch(
  `https://rest.api.24sevenoffice.com/v1/transactionlines?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
if (!linesResponse.ok) {
  console.error(
    `Refusing: could not read Finago transaction lines (${linesResponse.status}).`
  );
  process.exit(1);
}
const lines = (await linesResponse.json()) as unknown[];
const mentions = lines.filter((line) => JSON.stringify(line).includes(orderId));

console.log(
  `Finago lines ${dateFrom}..${dateTo}: ${lines.length}; mentioning the order: ${mentions.length}`
);
if (mentions.length > 0) {
  console.error(
    "Refusing: Finago already has lines for this order. Record that transaction id on the order by hand instead."
  );
  process.exit(1);
}

if (!apply) {
  console.log("Dry-run: would clear finago_transaction_id and the posting lock.");
  process.exit(0);
}

await db.updateRow({
  data: { finago_posting_lock: 0, finago_transaction_id: null },
  databaseId: "app",
  rowId: orderId,
  tableId: "orders",
});
console.log("Cleared. The next reconcile sweep will post the order.");
```

- [ ] **Step 5: Register the scripts**

In `packages/api/package.json` `scripts`, add after `"repair:content-relationships"`:

```json
    "finago:assign-sales-types": "bun --env-file=../../apps/admin/.env.local scripts/assign-product-sales-types.ts",
    "finago:reset-stranded-posting": "bun --env-file=../../apps/admin/.env.local scripts/reset-stranded-finago-posting.ts",
```

- [ ] **Step 6: Verify without writing**

Run: `cd packages/api && bun run test && bun run check-types`
Expected: PASS

Do **not** run either script here; they run in Task 6 with the owner.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix
git add packages/api/scripts/product-sales-type-map.ts packages/api/scripts/product-sales-type-map.test.ts packages/api/scripts/assign-product-sales-types.ts packages/api/scripts/reset-stranded-finago-posting.ts packages/api/package.json
git commit -F - <<'EOF'
Add scripts to assign product sales types and reset a stranded posting

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Ann28kMfep8ri2hHWPF1Fv
EOF
```

---

### Task 6: Rollout (owner)

No code. Production changes in order; each step needs the owner's go-ahead. Plans A and B must be deployed first (Plan A Task 6 done; Plan B Task 1 schema live).

- [ ] **Step 1: Accountant confirmations.** Get written answers to: VAT on sweaters/vests/camera (Varesalg bucket); fees booked only on payout vouchers from now on; fines on 3150 or 3900. If anything differs, edit `packages/api/scripts/product-sales-type-map.ts` (and the seeded sales type in admin) and commit before Step 5.
- [ ] **Step 2: Env.** On the **api** site: remove `TFSO_SHOP_TRANSACTION_TYPE_NUMBER` and `TFSO_VIPPS_RECEIVABLE_ACCOUNT`; confirm `TFSO_REST_CLIENT_ID`, `TFSO_REST_CLIENT_SECRET`, `TFSO_REST_ORG_ID` are set. On the **web** site: remove `TFSO_REST_*`, `TFSO_SHOP_TRANSACTION_TYPE_NUMBER`, `TFSO_VIPPS_RECEIVABLE_ACCOUNT` (keep `TFSO_APP_ID`/`TFSO_USERNAME`/`TFSO_PASSWORD` for membership sync). On **admin**: confirm `TFSO_*` SOAP and REST credentials are set (needed for the sync).
- [ ] **Step 3: Deploy** api, web and admin from the merged branch.
- [ ] **Step 4: Admin setup** (as a global or campus admin, `/shop/accounting`):
  1. "Synk kontoer fra Finago" → toast "Kontoplan synket". Accounts 3000 shows "25 % mva (kode 3)" and 3100 "Avgiftsfritt (kode 5)" in the sales type rows.
  2. "Opprett standard salgstyper" → four rows appear.
  3. Save the posting settings (8 / 1530 / 1540) → "Ikke lagret ennå" disappears.
  4. Leave posting **off**.
- [ ] **Step 5: Assign sales types.** `cd packages/api && bun run finago:assign-sales-types` → review: 56 assignments, 2 archives, 0 unmapped (plus any products created since 2026-09-11, listed as unmapped — set those in the product editor). Then `bun run finago:assign-sales-types -- --apply`.
- [ ] **Step 6: Reset the stranded order.** `bun run finago:reset-stranded-posting -- 6aa19747003c79019977` → expect "mentioning the order: 0" and the dry-run line. Then add `--apply`.
- [ ] **Step 7: Switch posting on** at `/shop/accounting`. Within one reconcile run (≤15 min) the order gets a real `finago_transaction_id`. Check the cron log shows `finagoPosted: 1`.
- [ ] **Step 8: Verify the voucher in Finago** (read-only): voucher type Inntektsrapport dated the posting day; 1530 +490,00; revenue line on the sales type's account with Department 44 and Campus 1; if Varesalg, 392,00 on 3000 and 98,00 on 2700.
- [ ] **Step 9: Watch** the next Vipps payout voucher: the 1530 balance for the period returns to ≈0. For the first Stripe order, confirm the voucher uses 1540 and the Stripe payout clears it.
- [ ] **Step 10: Clean-up follow-ups** (separate work): delete the web return shim one week after Plan A's rollout; move expense posting env vars to the Regnskap page; move remaining web third-party calls (SharePoint, varsling SMTP, BI identity, membership SOAP) behind the API app.
