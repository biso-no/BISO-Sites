# Membership Purchase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in student who has linked their BI account buy a BISO membership on `apps/web`, pay with Vipps or Stripe, and be registered in Finago as a customer with a membership category and an invoice.

**Architecture:** Pure logic (parsing, plan mapping, invoice payload building, fulfilment orchestration) lives in `packages/shared/utils/` where vitest already runs. `packages/connectors` stays a thin SOAP/Graph transport with no business rules. `apps/web` owns the gate and wizard UI; `apps/api` owns the trusted checkout endpoint. Membership state is never stored — it is read live from Finago and cached ten minutes per student.

**Tech Stack:** Bun 1.3.1, Turborepo, Next.js 16 App Router (RSC), Appwrite via `@repo/api`, 24SevenOffice SOAP via `soap`, Microsoft Graph via `@microsoft/microsoft-graph-client`, Vipps ePayment + Stripe via `@repo/payment`, vitest, Biome/Ultracite.

## Global Constraints

- Package manager is **Bun only**. Never `npm`/`pnpm`. Root scripts go through Turbo.
- Never import `appwrite` or `node-appwrite` in app code — go through `@repo/api`.
- `next build` has `typescript.ignoreBuildErrors: true` in `apps/web`. **`bun run check-types` is the only signal that matters.** Run it before every commit that touches types.
- Run `bun x ultracite fix` before committing; lefthook enforces it.
- Files marked `"use server"` may export **only** async functions. Constants and sync helpers go in a plain module. `check-types` does not catch this; the build does.
- Generated types in `packages/api/types/appwrite.ts` will **not** contain the new columns until the owner pushes the schema and regenerates. Every task that reads or writes a new column MUST use a locally-extended type (the `FinagoOrder` pattern in `packages/shared/utils/finago-order-posting.ts:9-12`). Do not hand-edit the generated file.
- Campus ids are the Appwrite campus row ids `"1"`–`"5"` = Oslo, Bergen, Trondheim, Stavanger, National.
- 24SO `DepartmentId` per campus: `"1"→1, "2"→300, "3"→600, "4"→800, "5"→1000`.
- 24SO invoice rows take **`ProductId`** (54/71/82), never `ProductNo` (1009/2004/3004).
- Commit messages: no `Co-Authored-By` trailer.
- Branch: `feat/membership-purchase`.

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `packages/shared/utils/bi-student.ts` | Parse a BI student email into a student number. Pure. |
| `packages/shared/utils/bi-student.test.ts` | Tests for the above. |
| `packages/shared/utils/membership-plans.ts` | Map a `memberships` row to a `MembershipPlan`; derive duration and accrual. Pure. |
| `packages/shared/utils/membership-plans.test.ts` | Tests for the above. |
| `packages/shared/utils/finago-membership-invoice.ts` | Build the 24SO `InvoiceOrder` payload (department, dimensions, accrual). Pure. |
| `packages/shared/utils/finago-membership-invoice.test.ts` | Tests for the above. |
| `packages/shared/utils/membership-status.ts` | Uncached live Finago membership computation, shared by both apps. |
| `packages/shared/utils/membership-fulfilment.ts` | Claim-locked customer → category → invoice orchestration. |
| `packages/shared/utils/membership-fulfilment.test.ts` | Tests for the above. |
| `packages/connectors/src/azure/bi-directory.ts` | BI-tenant Graph lookup returning `employeeId`. Thin. |
| `apps/web/src/lib/actions/bi-identity.ts` | `syncBiStudentIdentity` server action. |
| `apps/web/src/lib/membership-catalog.ts` | Read purchasable plans from the `memberships` table. |
| `apps/web/src/lib/membership-gate.ts` | Resolve which of the five gate states applies. Pure-ish, testable. |
| `apps/web/src/lib/membership-gate.test.ts` | Tests for the above. |
| `apps/web/src/app/actions/membership-purchase.ts` | `startMembershipCheckout` server action. |
| `apps/web/src/app/(public)/membership/join/page.tsx` | Gate + wizard host. |
| `apps/web/src/app/(public)/membership/join/join-wizard.tsx` | Client wizard: plan → campus → provider. |
| `apps/web/src/app/(public)/membership/join/gate-states.tsx` | The four non-eligible states as components. |
| `apps/web/src/app/(public)/shop/membership/page.tsx` | Permanent redirect to `/membership/join`. |
| `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts` | Trusted membership checkout. |

**Modified**

| File | Change |
|---|---|
| `packages/api/appwrite.config.json` | Five new columns. |
| `turbo.json` | Three new build env vars. |
| `packages/connectors/src/24sevenoffice/categories.ts` | Fix inverted Key/Value; numeric category ids. |
| `packages/connectors/src/24sevenoffice/company.ts` | Send explicit `Id` on create. |
| `packages/connectors/src/24sevenoffice/invoice.ts` | Accept a prebuilt payload; drop the stale department map. |
| `packages/connectors/src/24sevenoffice/membership-sync.ts` | Persist real price; stop clobbering `canPurchase`. |
| `packages/connectors/src/24sevenoffice/index.ts` | Export the new/changed surface. |
| `packages/connectors/src/azure/index.ts` | Export `getBiDirectoryUser`. |
| `packages/connectors/package.json` | Add the `./azure/bi-directory` export. |
| `packages/shared/utils/membership.ts` | Reimplement `checkMembership` on the live path. |
| `packages/shared/utils/finago-order-posting.ts` | Skip membership orders. |
| `apps/web/src/lib/actions/membership.ts` | Delegate to shared core; keep the cache wrapper. |
| `apps/web/src/app/actions/orders.ts` | Replace the `verify_biso_membership` execution. |
| `apps/api/src/app/api/payment/[provider]/checkout/route.ts` | Replace the `verify_biso_membership` execution. |
| `apps/web/src/components/profile/membership-status-card.tsx` | Replace the client-side function execution. |
| `apps/api/src/app/api/payment/[provider]/callback/route.ts` | Trigger membership fulfilment. |
| `apps/web/src/app/api/checkout/return/route.ts` | Trigger membership fulfilment. |
| `apps/web/src/app/api/cron/reconcile-orders/route.ts` | Recover unfulfilled membership orders. |
| `apps/web/src/components/profile/identity-management.tsx` | Call the sync action on return. |
| `packages/i18n/messages/en/membership.json`, `no/membership.json` | `join.*` copy. |

---

## Task 1: Schema columns and environment variables

Nothing else compiles against these until the owner pushes, so this lands first and alone.

**Files:**
- Modify: `packages/api/appwrite.config.json`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: nothing.
- Produces: columns `user.bi_employee_id`, `user.bi_campus_id`, `user.bi_linked_at`, `orders.membership_invoice_id`, `orders.membership_fulfilment_lock`; env `BI_AZURE_TENANT_ID`, `BI_AZURE_CLIENT_ID`, `BI_AZURE_CLIENT_SECRET`.

> `packages/api/appwrite.config.json` is normally off-limits (CLAUDE.md "Do not touch") because the Appwrite CLI regenerates it. The owner explicitly approved editing it here so the change is reviewable in the PR; they will run `appwrite push tables` and regenerate types.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-membership-schema.mjs`:

```js
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("packages/api/appwrite.config.json", "utf8"));
const tables = config.tables ?? config.collections ?? [];

const expected = {
  user: ["bi_employee_id", "bi_campus_id", "bi_linked_at"],
  orders: ["membership_invoice_id", "membership_fulfilment_lock"],
};

const missing = [];
for (const [tableId, keys] of Object.entries(expected)) {
  const table = tables.find((t) => t.$id === tableId);
  if (!table) {
    missing.push(`table ${tableId}`);
    continue;
  }
  const columns = table.columns ?? table.attributes ?? [];
  for (const key of keys) {
    if (!columns.some((c) => c.key === key)) {
      missing.push(`${tableId}.${key}`);
    }
  }
}

if (missing.length > 0) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("Membership schema columns present.");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun scripts/verify-membership-schema.mjs`
Expected: FAIL, `Missing: user.bi_employee_id, user.bi_campus_id, user.bi_linked_at, orders.membership_invoice_id, orders.membership_fulfilment_lock`

- [ ] **Step 3: Add the columns**

In `packages/api/appwrite.config.json`, append to the `user` table's `columns` array:

```json
{
  "key": "bi_employee_id",
  "type": "string",
  "required": false,
  "array": false,
  "size": 32,
  "default": null,
  "encrypt": false
},
{
  "key": "bi_campus_id",
  "type": "string",
  "required": false,
  "array": false,
  "size": 8,
  "default": null,
  "encrypt": false
},
{
  "key": "bi_linked_at",
  "type": "datetime",
  "required": false,
  "array": false,
  "default": null,
  "format": ""
}
```

Append to the `orders` table's `columns` array:

```json
{
  "key": "membership_invoice_id",
  "type": "string",
  "required": false,
  "array": false,
  "size": 64,
  "default": null,
  "encrypt": false
},
{
  "key": "membership_fulfilment_lock",
  "type": "integer",
  "required": false,
  "array": false,
  "min": 0,
  "max": 1000000,
  "default": 0
}
```

- [ ] **Step 4: Add the env vars to the Turbo build allow-list**

In `turbo.json`, add to `tasks.build.env` (keep the array alphabetically sorted where it already is):

```
"BI_AZURE_CLIENT_ID",
"BI_AZURE_CLIENT_SECRET",
"BI_AZURE_TENANT_ID",
```

- [ ] **Step 5: Verify**

Run: `bun scripts/verify-membership-schema.mjs`
Expected: PASS, `Membership schema columns present.`

Run: `node -e "JSON.parse(require('fs').readFileSync('turbo.json','utf8')); console.log('turbo.json valid')"`
Expected: `turbo.json valid`

- [ ] **Step 6: Commit**

```bash
git add packages/api/appwrite.config.json turbo.json scripts/verify-membership-schema.mjs
git commit -m "Add membership purchase schema columns and BI Azure env vars

Adds user.bi_employee_id, user.bi_campus_id, user.bi_linked_at and
orders.membership_invoice_id, orders.membership_fulfilment_lock, plus the
BI_AZURE_* build env allow-list entries. Requires appwrite push tables and
a types regeneration by the owner."
```

---

## Task 2: BI student email parsing

**Files:**
- Create: `packages/shared/utils/bi-student.ts`
- Test: `packages/shared/utils/bi-student.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseBiStudentEmail(email: string | null | undefined): { studentId: string; studentNumber: number } | null`
  - `sanitizeStudentNumber(raw: string | null | undefined): number | null`
  - `BI_STUDENT_EMAIL_DOMAIN = "bi.no"`

`studentId` is the email local part as issued (`s1715738`), stored in `user.student_id`. `studentNumber` is the digits (`1715738`), used for every Finago call.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { parseBiStudentEmail, sanitizeStudentNumber } from "./bi-student";

describe("parseBiStudentEmail", () => {
  it("extracts the local part and numeric id", () => {
    expect(parseBiStudentEmail("s1715738@bi.no")).toEqual({
      studentId: "s1715738",
      studentNumber: 1_715_738,
    });
  });

  it("is case and whitespace insensitive", () => {
    expect(parseBiStudentEmail("  S1715738@BI.NO ")).toEqual({
      studentId: "s1715738",
      studentNumber: 1_715_738,
    });
  });

  it("rejects a non-bi.no domain", () => {
    expect(parseBiStudentEmail("s1715738@gmail.com")).toBeNull();
  });

  it("rejects a lookalike domain", () => {
    expect(parseBiStudentEmail("s1715738@notbi.no")).toBeNull();
  });

  it("rejects a local part with no digits", () => {
    expect(parseBiStudentEmail("firstname.lastname@bi.no")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(parseBiStudentEmail(null)).toBeNull();
    expect(parseBiStudentEmail("")).toBeNull();
  });
});

describe("sanitizeStudentNumber", () => {
  it("strips non-digits", () => {
    expect(sanitizeStudentNumber("s1715738")).toBe(1_715_738);
  });

  it("returns null when no digits remain", () => {
    expect(sanitizeStudentNumber("abc")).toBeNull();
    expect(sanitizeStudentNumber(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/bi-student.test.ts`
Expected: FAIL — `Failed to resolve import "./bi-student"`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Parsing helpers for BI-issued student identifiers.
 *
 * `studentId` is the email local part exactly as BI issues it (`s1715738`) and
 * is what `user.student_id` stores — the member portal renders it and rebuilds
 * the address from it. `studentNumber` is the digits only, which is what every
 * Finago (24SevenOffice) lookup expects.
 */

export const BI_STUDENT_EMAIL_DOMAIN = "bi.no";

const NON_DIGITS_RE = /\D/g;
const HAS_DIGIT_RE = /\d/;

export function sanitizeStudentNumber(
  raw: string | null | undefined
): number | null {
  if (!raw) {
    return null;
  }
  const digits = raw.replace(NON_DIGITS_RE, "");
  if (!digits) {
    return null;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBiStudentEmail(
  email: string | null | undefined
): { studentId: string; studentNumber: number } | null {
  if (!email) {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }

  const domain = normalized.slice(atIndex + 1);
  if (domain !== BI_STUDENT_EMAIL_DOMAIN) {
    return null;
  }

  const studentId = normalized.slice(0, atIndex);
  if (!HAS_DIGIT_RE.test(studentId)) {
    return null;
  }

  const studentNumber = sanitizeStudentNumber(studentId);
  if (studentNumber === null) {
    return null;
  }

  return { studentId, studentNumber };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/bi-student.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/bi-student.ts packages/shared/utils/bi-student.test.ts
git add packages/shared/utils/bi-student.ts packages/shared/utils/bi-student.test.ts
git commit -m "Add BI student email parsing helpers

Extracts the issued student id and its numeric form, rejecting non-bi.no
domains and local parts with no digits."
```

---

## Task 3: Membership plan mapping

**Files:**
- Create: `packages/shared/utils/membership-plans.ts`
- Test: `packages/shared/utils/membership-plans.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type MembershipDuration = "semester" | "year" | "three_years"`
  - `interface MembershipPlan { id: string; name: string; price: number; productId: number; categoryId: number; duration: MembershipDuration; accrualMonths: 6 | 12 | 36; startDate: string; expiryDate: string }`
  - `interface MembershipRowLike { $id: string; name: string; price?: number | null; membership_id: string; category?: string | null; startDate: string; expiryDate: string; status?: boolean; canPurchase?: boolean }`
  - `toMembershipPlan(row: MembershipRowLike): MembershipPlan | null`
  - `deriveAccrualMonths(startDate: string, expiryDate: string): 6 | 12 | 36`
  - `MEMBERSHIP_DIMENSION_IDS: Record<MembershipDuration, string>` — `{ semester: "100", year: "200", three_years: "300" }`
  - `MEMBERSHIP_DIMENSION_LABELS: Record<MembershipDuration, string>` — `{ semester: "Semester", year: "Year", three_years: "3 Years" }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  deriveAccrualMonths,
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  toMembershipPlan,
} from "./membership-plans";

function row(overrides: Record<string, unknown> = {}) {
  return {
    $id: "54",
    name: "BISO Membership fall 2026",
    price: 350,
    membership_id: "54",
    category: "113176",
    startDate: "2026-08-01",
    expiryDate: "2026-12-31",
    status: true,
    canPurchase: true,
    ...overrides,
  };
}

describe("deriveAccrualMonths", () => {
  it("maps a autumn semester span to 6", () => {
    expect(deriveAccrualMonths("2026-08-01", "2026-12-31")).toBe(6);
  });

  it("maps a spring semester span to 6", () => {
    expect(deriveAccrualMonths("2027-01-01", "2027-06-30")).toBe(6);
  });

  it("maps a full year span to 12", () => {
    expect(deriveAccrualMonths("2026-08-01", "2027-06-30")).toBe(12);
  });

  it("maps a three year span to 36", () => {
    expect(deriveAccrualMonths("2026-08-01", "2029-06-30")).toBe(36);
  });
});

describe("toMembershipPlan", () => {
  it("maps a semester row", () => {
    expect(toMembershipPlan(row())).toEqual({
      id: "54",
      name: "BISO Membership fall 2026",
      price: 350,
      productId: 54,
      categoryId: 113_176,
      duration: "semester",
      accrualMonths: 6,
      startDate: "2026-08-01",
      expiryDate: "2026-12-31",
    });
  });

  it("maps a three year row", () => {
    const plan = toMembershipPlan(
      row({
        $id: "82",
        membership_id: "82",
        category: "113177",
        name: "BISO Membership fall 2026 - spring 2029",
        price: 1350,
        expiryDate: "2029-06-30",
      })
    );
    expect(plan?.duration).toBe("three_years");
    expect(plan?.accrualMonths).toBe(36);
    expect(plan?.productId).toBe(82);
    expect(plan?.categoryId).toBe(113_177);
  });

  it("rejects a row with no category", () => {
    expect(toMembershipPlan(row({ category: null }))).toBeNull();
  });

  it("rejects a row with a non-numeric membership id", () => {
    expect(toMembershipPlan(row({ membership_id: "abc" }))).toBeNull();
  });

  it("rejects a row with a zero or missing price", () => {
    expect(toMembershipPlan(row({ price: 0 }))).toBeNull();
    expect(toMembershipPlan(row({ price: null }))).toBeNull();
  });

  it("exposes the Finago dimension id and label per duration", () => {
    expect(MEMBERSHIP_DIMENSION_IDS.semester).toBe("100");
    expect(MEMBERSHIP_DIMENSION_IDS.year).toBe("200");
    expect(MEMBERSHIP_DIMENSION_IDS.three_years).toBe("300");
    expect(MEMBERSHIP_DIMENSION_LABELS.semester).toBe("Semester");
    expect(MEMBERSHIP_DIMENSION_LABELS.year).toBe("Year");
    expect(MEMBERSHIP_DIMENSION_LABELS.three_years).toBe("3 Years");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/membership-plans.test.ts`
Expected: FAIL — `Failed to resolve import "./membership-plans"`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Maps `memberships` rows (synced from 24SevenOffice by
 * `syncMembershipsFrom24SO`) into the plan shape the purchase flow and the
 * invoice builder consume.
 *
 * `membership_id` holds the 24SO `ProductId` — the value invoice rows require.
 * It is NOT the `ProductNo` (1009/2004/3004) shown in the 24SO UI.
 */

export type MembershipDuration = "semester" | "year" | "three_years";

export interface MembershipPlan {
  accrualMonths: 6 | 12 | 36;
  categoryId: number;
  duration: MembershipDuration;
  expiryDate: string;
  id: string;
  name: string;
  price: number;
  productId: number;
  startDate: string;
}

export interface MembershipRowLike {
  $id: string;
  canPurchase?: boolean;
  category?: string | null;
  expiryDate: string;
  membership_id: string;
  name: string;
  price?: number | null;
  startDate: string;
  status?: boolean;
}

export const MEMBERSHIP_DIMENSION_IDS: Record<MembershipDuration, string> = {
  semester: "100",
  year: "200",
  three_years: "300",
};

export const MEMBERSHIP_DIMENSION_LABELS: Record<MembershipDuration, string> = {
  semester: "Semester",
  year: "Year",
  three_years: "3 Years",
};

const ACCRUAL_OPTIONS = [6, 12, 36] as const;

const DURATION_BY_ACCRUAL: Record<6 | 12 | 36, MembershipDuration> = {
  6: "semester",
  12: "year",
  36: "three_years",
};

/**
 * Snaps the calendar span between the product's parsed start and expiry to the
 * nearest supported accrual length. Product names encode e.g. "fall 2026"
 * (Aug–Dec, 4 calendar months) which must still book as a 6-month accrual.
 */
export function deriveAccrualMonths(
  startDate: string,
  expiryDate: string
): 6 | 12 | 36 {
  const start = new Date(startDate);
  const expiry = new Date(expiryDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(expiry.getTime())) {
    return 12;
  }

  const months =
    (expiry.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (expiry.getUTCMonth() - start.getUTCMonth());

  let closest: 6 | 12 | 36 = ACCRUAL_OPTIONS[0];
  for (const option of ACCRUAL_OPTIONS) {
    if (Math.abs(option - months) < Math.abs(closest - months)) {
      closest = option;
    }
  }
  return closest;
}

export function toMembershipPlan(row: MembershipRowLike): MembershipPlan | null {
  const productId = Number.parseInt(row.membership_id, 10);
  if (!Number.isFinite(productId)) {
    return null;
  }

  const categoryId = row.category ? Number.parseInt(row.category, 10) : Number.NaN;
  if (!Number.isFinite(categoryId)) {
    return null;
  }

  const price = Number(row.price ?? 0);
  if (!(Number.isFinite(price) && price > 0)) {
    return null;
  }

  const accrualMonths = deriveAccrualMonths(row.startDate, row.expiryDate);

  return {
    id: row.$id,
    name: row.name,
    price,
    productId,
    categoryId,
    duration: DURATION_BY_ACCRUAL[accrualMonths],
    accrualMonths,
    startDate: row.startDate,
    expiryDate: row.expiryDate,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/membership-plans.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-plans.ts packages/shared/utils/membership-plans.test.ts
git add packages/shared/utils/membership-plans.ts packages/shared/utils/membership-plans.test.ts
git commit -m "Add membership plan mapping from the memberships table

Derives duration and accrual length from the synced start/expiry dates so the
catalog survives the annual product rollover without a code change."
```

---

## Task 4: Fix inverted Key/Value in customer categories

The write path sends `{ Key: companyId, Value: categoryName }`. funksjon — and this repo's own `getCustomerCategoryTree` parser at `packages/connectors/src/24sevenoffice/categories.ts:256-257` — both say `Key = CategoryId, Value = CompanyId`. The write path is wrong, so category assignment has never worked.

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/categories.ts:24-85`
- Modify: `packages/connectors/src/24sevenoffice/index.ts:13-21`
- Create: `packages/shared/utils/finago-category-pairs.ts`
- Test: `packages/shared/utils/finago-category-pairs.test.ts`

The pair-building moves into `@repo/shared` because `packages/connectors` has no vitest runner (`packages/connectors/package.json` has no `test` script), and this shape must be pinned by a regression test.

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `buildCustomerCategoryPairs(customerId: number, categoryIds: number[]): Array<{ Key: string; Value: string }>`
  - Changed: `saveCustomerCategories(companyId: number, categoryIds: number[]): Promise<void>`
  - Changed: `assignMembershipCategory(companyId: number, categoryId: number): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/utils/finago-category-pairs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCustomerCategoryPairs } from "./finago-category-pairs";

describe("buildCustomerCategoryPairs", () => {
  it("sends Key as the category id and Value as the customer id", () => {
    // Pinned deliberately: the 24SO SaveCustomerCategories contract is
    // Key=CategoryId, Value=CompanyId. The repo previously had these inverted,
    // which silently assigned nothing.
    expect(buildCustomerCategoryPairs(1_715_738, [113_176])).toEqual([
      { Key: "113176", Value: "1715738" },
    ]);
  });

  it("builds one pair per category", () => {
    expect(buildCustomerCategoryPairs(42, [1, 2, 3])).toEqual([
      { Key: "1", Value: "42" },
      { Key: "2", Value: "42" },
      { Key: "3", Value: "42" },
    ]);
  });

  it("drops non-finite category ids", () => {
    expect(buildCustomerCategoryPairs(42, [1, Number.NaN])).toEqual([
      { Key: "1", Value: "42" },
    ]);
  });

  it("returns an empty list for no categories", () => {
    expect(buildCustomerCategoryPairs(42, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/finago-category-pairs.test.ts`
Expected: FAIL — `Failed to resolve import "./finago-category-pairs"`

- [ ] **Step 3: Write the implementation**

Create `packages/shared/utils/finago-category-pairs.ts`:

```ts
/**
 * 24SevenOffice `SaveCustomerCategories` takes KeyValuePairs where the Key is
 * the CATEGORY id and the Value is the COMPANY id — the opposite of what the
 * parameter names suggest. `getCustomerCategoryTree` reads them back with the
 * same orientation.
 */
export function buildCustomerCategoryPairs(
  customerId: number,
  categoryIds: number[]
): Array<{ Key: string; Value: string }> {
  return categoryIds
    .filter((id) => Number.isFinite(id))
    .map((categoryId) => ({
      Key: String(categoryId),
      Value: String(customerId),
    }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/finago-category-pairs.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Rewrite the connector to use it**

In `packages/connectors/src/24sevenoffice/categories.ts`, replace the body of `saveCustomerCategories` and `assignMembershipCategory` (lines 24-85) with:

```ts
export async function saveCustomerCategories(
  companyId: number,
  categoryIds: number[]
): Promise<void> {
  const categoryPairs = buildCustomerCategoryPairs(companyId, categoryIds);
  if (categoryPairs.length === 0) {
    console.log("[24SO Categories] No categories to assign");
    return;
  }

  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [SaveCustomerCategoriesResult] =
      await client.SaveCustomerCategoriesAsync({
        customerCategories: {
          KeyValuePair: categoryPairs,
        },
      });

    const exceptions = result.SaveCustomerCategoriesResult?.APIException;
    if (exceptions) {
      const errorList = Array.isArray(exceptions) ? exceptions : [exceptions];
      const errors = errorList.filter((e) => e.Message);

      if (errors.length > 0) {
        console.error(
          "[24SO Categories] Errors assigning categories:",
          errors.map((e) => e.Message).join(", ")
        );
        throw new Error(
          `Failed to assign categories: ${errors[0]?.Message || "Unknown error"}`
        );
      }
    }

    console.log(
      `[24SO Categories] Assigned categories to customer ${companyId}: ${categoryIds.join(", ")}`
    );
  } catch (error) {
    console.error("[24SO Categories] Failed to save categories:", error);
    throw error;
  }
}

/**
 * Assign a single category to a customer.
 */
export function assignMembershipCategory(
  companyId: number,
  categoryId: number
): Promise<void> {
  return saveCustomerCategories(companyId, [categoryId]);
}
```

Add the import at the top of the file:

```ts
import { buildCustomerCategoryPairs } from "@repo/shared/utils/finago-category-pairs";
```

Remove the now-unused `KeyValuePair` from the `./types` import list if nothing else in the file uses it (`getCustomerCategoryTree` still does — keep it).

- [ ] **Step 6: Add @repo/shared to the connectors package**

`packages/connectors/package.json` does not depend on `@repo/shared`. Add it:

```bash
bun add @repo/shared --filter=@repo/connectors
```

Verify no cycle: `@repo/shared` depends on `@repo/connectors`. A workspace cycle is acceptable to Bun and Turbo here because both are source-only TypeScript with no build step, and `finago-order-posting.ts` already imports across this boundary in the other direction. If `bun run check-types` reports a cycle error, instead **inline** `buildCustomerCategoryPairs` into `categories.ts` and have the shared module re-export the connector's copy — the test must keep passing either way.

- [ ] **Step 7: Fix the one existing caller**

`packages/connectors/src/24sevenoffice/sync.ts:50` calls `assignMembershipCategory(company.Id, membership.category)` with a `string`. That whole function is dead code replaced in Task 17. Delete `syncMembershipTo24SO` and `extractCustomerData` from `sync.ts`, keeping only `hasMembershipProduct`. Remove the `syncMembershipTo24SO` export from `packages/connectors/src/24sevenoffice/index.ts:69`, leaving `hasMembershipProduct`. Also remove the now-unused `MembershipSyncResult` and `CustomerData` exports from `index.ts:71-81` if nothing else imports them (check with `grep -rn "MembershipSyncResult\|CustomerData" --include="*.ts" apps packages | grep -v node_modules`).

- [ ] **Step 8: Verify types**

Run: `bun run check-types --filter=@repo/connectors --filter=@repo/shared`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix packages/shared/utils/finago-category-pairs.ts packages/shared/utils/finago-category-pairs.test.ts packages/connectors/src/24sevenoffice/categories.ts packages/connectors/src/24sevenoffice/sync.ts packages/connectors/src/24sevenoffice/index.ts
git add packages/shared/utils/finago-category-pairs.ts packages/shared/utils/finago-category-pairs.test.ts packages/connectors packages/shared package.json bun.lock
git commit -m "Fix inverted Key/Value in 24SO customer category assignment

SaveCustomerCategories expects Key=CategoryId, Value=CompanyId, which is how
getCustomerCategoryTree already reads them back. The write path had them
swapped, so category assignment silently did nothing. Category ids are now
numeric throughout, and the dead syncMembershipTo24SO is removed."
```

---

## Task 5: Persist real prices in the membership sync

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/membership-sync.ts:111-166`
- Create: `packages/shared/utils/membership-sync-merge.ts`
- Test: `packages/shared/utils/membership-sync-merge.test.ts`

**Interfaces:**
- Consumes: `MembershipProductSyncItem` shape (`productId`, `productName`, `categoryId`, `expiryDate`, `startDate`, `isActive`, plus a new `price`).
- Produces: `mergeMembershipRow(syncItem, existing): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { mergeMembershipRow } from "./membership-sync-merge";

const syncItem = {
  productId: 54,
  productName: "BISO Membership fall 2026",
  categoryId: 113_176,
  expiryDate: "2026-12-31",
  startDate: "2026-08-01",
  isActive: true,
  price: 350,
};

describe("mergeMembershipRow", () => {
  it("seeds price from 24SO when the row is new", () => {
    expect(mergeMembershipRow(syncItem, null)).toMatchObject({
      membership_id: "54",
      name: "BISO Membership fall 2026",
      category: "113176",
      price: 350,
      canPurchase: false,
      status: true,
    });
  });

  it("preserves an administrator-set price on update", () => {
    const merged = mergeMembershipRow(syncItem, { price: 400, canPurchase: true });
    expect(merged.price).toBe(400);
  });

  it("preserves canPurchase on update", () => {
    const merged = mergeMembershipRow(syncItem, { price: 350, canPurchase: true });
    expect(merged.canPurchase).toBe(true);
  });

  it("falls back to the 24SO price when the existing row has none", () => {
    const merged = mergeMembershipRow(syncItem, { price: 0, canPurchase: false });
    expect(merged.price).toBe(350);
  });

  it("still refreshes name, dates and status on update", () => {
    const merged = mergeMembershipRow(
      { ...syncItem, isActive: false, productName: "Renamed" },
      { price: 400, canPurchase: true }
    );
    expect(merged).toMatchObject({ name: "Renamed", status: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/membership-sync-merge.test.ts`
Expected: FAIL — `Failed to resolve import "./membership-sync-merge"`

- [ ] **Step 3: Write the implementation**

Create `packages/shared/utils/membership-sync-merge.ts`:

```ts
/**
 * Builds the `memberships` row written by the 24SevenOffice product sync.
 *
 * Price and `canPurchase` are administrator-owned once a row exists: the sync
 * seeds them on create and then leaves them alone, so marking a plan sellable
 * is not silently reverted on the next run.
 */

export interface MembershipSyncItemLike {
  categoryId: number | null;
  expiryDate: string;
  isActive: boolean;
  price: number;
  productId: number;
  productName: string;
  startDate: string;
}

export interface ExistingMembershipRow {
  canPurchase?: boolean | null;
  price?: number | null;
}

export function mergeMembershipRow(
  item: MembershipSyncItemLike,
  existing: ExistingMembershipRow | null
): Record<string, unknown> {
  const existingPrice = Number(existing?.price ?? 0);
  const price = existingPrice > 0 ? existingPrice : Number(item.price ?? 0);

  return {
    membership_id: String(item.productId),
    name: item.productName,
    category: item.categoryId ? String(item.categoryId) : null,
    expiryDate: item.expiryDate,
    startDate: item.startDate,
    status: item.isActive,
    price,
    canPurchase: existing?.canPurchase ?? false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/membership-sync-merge.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Wire the connector to it**

In `packages/connectors/src/24sevenoffice/membership-sync.ts`:

Add `price: number;` to `MembershipProductSyncItem` in `packages/connectors/src/24sevenoffice/types.ts:204-213`.

In `buildSyncItem` (line 111), add `price: Number(product.Price ?? 0),` to the returned object.

Replace `upsertMembership` (lines 135-166) with:

```ts
async function upsertMembership(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  syncItem: MembershipProductSyncItem
): Promise<"created" | "updated"> {
  const docId = String(syncItem.productId);

  const existing = await db
    .getRow("app", "memberships", docId)
    .catch(() => null);

  const docData = mergeMembershipRow(
    syncItem,
    existing as { canPurchase?: boolean | null; price?: number | null } | null
  );

  if (existing) {
    await db.updateRow("app", "memberships", docId, docData);
    return "updated";
  }

  await db.createRow("app", "memberships", docId, docData);
  return "created";
}
```

Add the import:

```ts
import { mergeMembershipRow } from "@repo/shared/utils/membership-sync-merge";
```

In `previewMembershipSync` (line 284), add `price: Number(product.Price ?? 0),` to the pushed item so the preview type matches.

- [ ] **Step 6: Verify types**

Run: `bun run check-types --filter=@repo/connectors --filter=@repo/shared`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-sync-merge.ts packages/shared/utils/membership-sync-merge.test.ts packages/connectors/src/24sevenoffice/membership-sync.ts packages/connectors/src/24sevenoffice/types.ts
git add packages/shared/utils/membership-sync-merge.ts packages/shared/utils/membership-sync-merge.test.ts packages/connectors
git commit -m "Persist 24SO product prices in the membership sync

The sync fetched product.Price and then wrote price: 0, and re-wrote
canPurchase: false on every update so a plan could never stay sellable. Price
and canPurchase are now seeded on create and left to the administrator after."
```

---

## Task 6: Finago membership invoice payload builder

**Files:**
- Create: `packages/shared/utils/finago-membership-invoice.ts`
- Test: `packages/shared/utils/finago-membership-invoice.test.ts`

**Interfaces:**
- Consumes: `MembershipPlan`, `MEMBERSHIP_DIMENSION_IDS`, `MEMBERSHIP_DIMENSION_LABELS` from Task 3.
- Produces:
  - `CAMPUS_INVOICE_DEPARTMENT_IDS: Record<string, number>`
  - `CAMPUS_INVOICE_NAMES: Record<string, string>`
  - `buildMembershipInvoiceOrder(params: { campusId: string; customerId: number; plan: MembershipPlan; invoicedOn: string }): MembershipInvoiceOrder`
  - `interface MembershipInvoiceOrder` mirroring the 24SO `InvoiceOrder` SOAP shape

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildMembershipInvoiceOrder } from "./finago-membership-invoice";
import type { MembershipPlan } from "./membership-plans";

const yearPlan: MembershipPlan = {
  id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  price: 550,
  productId: 71,
  categoryId: 113_178,
  duration: "year",
  accrualMonths: 12,
  startDate: "2026-08-01",
  expiryDate: "2027-06-30",
};

function build(campusId = "2") {
  return buildMembershipInvoiceOrder({
    campusId,
    customerId: 1_715_738,
    plan: yearPlan,
    invoicedOn: "2026-08-12",
  });
}

describe("buildMembershipInvoiceOrder", () => {
  it("books against the customer as already invoiced", () => {
    const order = build();
    expect(order.CustomerId).toBe(1_715_738);
    expect(order.OrderStatus).toBe("Invoiced");
    expect(order.PaymentTime).toBe(0);
    expect(order.PaymentMethodId).toBe(1);
    expect(order.Distributor).toBe("Manual");
    expect(order.DateInvoiced).toBe("2026-08-12");
    expect(order.PaymentAmount).toBe(550);
  });

  it("maps the campus to its 24SO department at order and row level", () => {
    const order = build("2");
    expect(order.DepartmentId).toBe(300);
    expect(order.InvoiceRows.InvoiceRow.DepartmentId).toBe(300);
  });

  it("uses ProductId on the invoice row, never ProductNo", () => {
    // Regression guard: 1009/2004/3004 are ProductNo; 54/71/82 are ProductId.
    const order = build();
    expect(order.InvoiceRows.InvoiceRow.ProductId).toBe(71);
    expect(order.InvoiceRows.InvoiceRow.Price).toBe(550);
    expect(order.InvoiceRows.InvoiceRow.Quantity).toBe(1);
  });

  it("derives the accrual from the plan rather than hardcoding a date", () => {
    const order = build();
    expect(order.AccrualDate).toBe("2026-08-01");
    expect(order.AccrualLength).toBe(12);
  });

  it("emits both user defined dimensions at order and row level", () => {
    const expected = [
      { Type: "UserDefined", Name: "Bergen", Value: "2", TypeId: "101" },
      { Type: "UserDefined", Name: "200", Value: "Year", TypeId: "102" },
    ];
    const order = build("2");
    expect(order.UserDefinedDimensions.UserDefinedDimension).toEqual(expected);
    expect(
      order.InvoiceRows.InvoiceRow.UserDefinedDimensions.UserDefinedDimension
    ).toEqual(expected);
  });

  it("carries the semester dimension for a semester plan", () => {
    const order = buildMembershipInvoiceOrder({
      campusId: "1",
      customerId: 1,
      plan: { ...yearPlan, duration: "semester", accrualMonths: 6 },
      invoicedOn: "2026-08-12",
    });
    expect(order.DepartmentId).toBe(1);
    expect(order.UserDefinedDimensions.UserDefinedDimension[1]).toEqual({
      Type: "UserDefined",
      Name: "100",
      Value: "Semester",
      TypeId: "102",
    });
  });

  it("sends empty Norwegian addresses", () => {
    const order = build();
    expect(order.Addresses.Invoice.Country).toBe("NO");
    expect(order.Addresses.Delivery.Country).toBe("NO");
  });

  it("throws on an unknown campus rather than defaulting to Oslo", () => {
    expect(() => build("99")).toThrow("Unknown campus id: 99");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/finago-membership-invoice.test.ts`
Expected: FAIL — `Failed to resolve import "./finago-membership-invoice"`

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Builds the 24SevenOffice `InvoiceOrder` payload for a membership purchase.
 *
 * Mirrors the payload the production membership tool (biso-no/funksjon) posts,
 * which is what BI's own student app produces, with two deliberate
 * differences:
 *   - OrderStatus is "Invoiced", not "Draft": the student has already paid by
 *     Vipps or Stripe, so there is nothing left for finance to collect.
 *   - AccrualDate comes from the plan's parsed semester start instead of a
 *     hardcoded date, so it does not rot at the next rollover.
 */

import {
  MEMBERSHIP_DIMENSION_IDS,
  MEMBERSHIP_DIMENSION_LABELS,
  type MembershipPlan,
} from "./membership-plans";

export const CAMPUS_INVOICE_DEPARTMENT_IDS: Record<string, number> = {
  "1": 1, // Oslo
  "2": 300, // Bergen
  "3": 600, // Trondheim
  "4": 800, // Stavanger
  "5": 1000, // National
};

export const CAMPUS_INVOICE_NAMES: Record<string, string> = {
  "1": "Oslo",
  "2": "Bergen",
  "3": "Trondheim",
  "4": "Stavanger",
  "5": "National",
};

export interface UserDefinedDimension {
  Name: string;
  Type: "UserDefined";
  TypeId: string;
  Value: string;
}

export interface MembershipInvoiceRow {
  DepartmentId: number;
  Price: number;
  ProductId: number;
  Quantity: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface MembershipInvoiceOrder {
  AccrualDate: string;
  AccrualLength: number;
  Addresses: {
    Delivery: { Country: string };
    Invoice: { Country: string };
  };
  CustomerId: number;
  DateInvoiced: string;
  DepartmentId: number;
  Distributor: string;
  InvoiceRows: { InvoiceRow: MembershipInvoiceRow };
  OrderStatus: "Invoiced";
  PaymentAmount: number;
  PaymentMethodId: number;
  PaymentTime: number;
  UserDefinedDimensions: { UserDefinedDimension: UserDefinedDimension[] };
}

export interface BuildMembershipInvoiceParams {
  campusId: string;
  customerId: number;
  invoicedOn: string;
  plan: MembershipPlan;
}

function buildDimensions(
  campusId: string,
  plan: MembershipPlan
): UserDefinedDimension[] {
  return [
    {
      Type: "UserDefined",
      Name: CAMPUS_INVOICE_NAMES[campusId] as string,
      Value: campusId,
      TypeId: "101",
    },
    {
      Type: "UserDefined",
      Name: MEMBERSHIP_DIMENSION_IDS[plan.duration],
      Value: MEMBERSHIP_DIMENSION_LABELS[plan.duration],
      TypeId: "102",
    },
  ];
}

export function buildMembershipInvoiceOrder({
  campusId,
  customerId,
  invoicedOn,
  plan,
}: BuildMembershipInvoiceParams): MembershipInvoiceOrder {
  const departmentId = CAMPUS_INVOICE_DEPARTMENT_IDS[campusId];
  if (departmentId === undefined) {
    throw new Error(`Unknown campus id: ${campusId}`);
  }

  const dimensions = buildDimensions(campusId, plan);

  return {
    CustomerId: customerId,
    OrderStatus: "Invoiced",
    PaymentMethodId: 1,
    PaymentTime: 0,
    Distributor: "Manual",
    DateInvoiced: invoicedOn,
    PaymentAmount: plan.price,
    DepartmentId: departmentId,
    Addresses: {
      Delivery: { Country: "NO" },
      Invoice: { Country: "NO" },
    },
    InvoiceRows: {
      InvoiceRow: {
        ProductId: plan.productId,
        Price: plan.price,
        Quantity: 1,
        DepartmentId: departmentId,
        UserDefinedDimensions: { UserDefinedDimension: dimensions },
      },
    },
    AccrualDate: plan.startDate,
    AccrualLength: plan.accrualMonths,
    UserDefinedDimensions: { UserDefinedDimension: dimensions },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/finago-membership-invoice.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/finago-membership-invoice.ts packages/shared/utils/finago-membership-invoice.test.ts
git add packages/shared/utils/finago-membership-invoice.ts packages/shared/utils/finago-membership-invoice.test.ts
git commit -m "Add the Finago membership invoice payload builder

Mirrors the payload the BI student app produces: campus department at order
and row level, both user-defined dimension pairs, accrual derived from the
plan's semester start. Books as Invoiced since payment already settled."
```

---

## Task 7: Connector transport for membership customers and invoices

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/company.ts:104-155, 276-328`
- Modify: `packages/connectors/src/24sevenoffice/invoice.ts` (replace file contents)
- Modify: `packages/connectors/src/24sevenoffice/index.ts`

**Interfaces:**
- Consumes: `MembershipInvoiceOrder` from Task 6.
- Produces:
  - `upsertMembershipCustomer(params: { employeeId: number; studentNumber: number; firstName: string; lastName: string; email?: string }): Promise<number>` — returns the 24SO customer id
  - `postMembershipInvoice(order: MembershipInvoiceOrder): Promise<number>` — returns the created `OrderId`

`upsertMembershipCustomer` searches by `CompanyId` = employeeId, then `ExternalId` = studentNumber, then creates with `Id` explicitly set so the customer number *is* the employee id.

- [ ] **Step 1: Add the customer upsert**

Append to `packages/connectors/src/24sevenoffice/company.ts`:

```ts
export interface UpsertMembershipCustomerParams {
  email?: string;
  employeeId: number;
  firstName: string;
  lastName: string;
  studentNumber: number;
}

/**
 * Resolve the Finago customer for a membership purchase, creating it when
 * absent.
 *
 * The customer number MUST equal the student's Azure employee id, because
 * that is what BI's own app uses — so `Id` is sent explicitly on create rather
 * than letting 24SO allocate one. `ExternalId` carries the sanitized student
 * number from their BI email address.
 */
export async function upsertMembershipCustomer(
  params: UpsertMembershipCustomerParams
): Promise<number> {
  const session = await getValidSession();

  const byCompanyId = await getCompanies(session, {
    CompanyId: params.employeeId,
  });
  if (byCompanyId[0]?.Id) {
    return byCompanyId[0].Id;
  }

  const byExternalId = await getCompanies(session, {
    ExternalId: String(params.studentNumber),
  });
  if (byExternalId[0]?.Id) {
    return byExternalId[0].Id;
  }

  const client = await createAuthenticatedClient("company", session);
  const newCompany: Company = {
    Id: params.employeeId,
    Name: `(Student) ${params.lastName}, ${params.firstName}`,
    FirstName: params.firstName,
    ExternalId: String(params.studentNumber),
    Type: "Consumer",
    Private: true,
    Country: "NO",
    CurrencyId: "NOK",
  };

  if (params.email) {
    newCompany.EmailAddresses = { Primary: { Value: params.email } };
  }

  const [result]: [SaveCompaniesResult] = await client.SaveCompaniesAsync({
    companies: { Company: newCompany },
  });

  const saved = result.SaveCompaniesResult?.Company;
  const company = Array.isArray(saved) ? saved[0] : saved;
  if (!company?.Id) {
    throw new Error(
      "[24SO Company] Failed to create membership customer - no id returned"
    );
  }

  console.log(
    `[24SO Company] Created membership customer ${company.Id} (ExternalId: ${params.studentNumber})`
  );
  return company.Id;
}
```

- [ ] **Step 2: Replace the invoice module**

Replace the entire contents of `packages/connectors/src/24sevenoffice/invoice.ts` with:

```ts
/**
 * 24SevenOffice Invoice Service
 *
 * Thin SOAP transport. The payload is built by
 * `@repo/shared/utils/finago-membership-invoice`, which is where the campus
 * department map, accrual, and user-defined dimensions live and are tested.
 */

import type { MembershipInvoiceOrder } from "@repo/shared/utils/finago-membership-invoice";
import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

interface SaveInvoicesResult {
  SaveInvoicesResult?: {
    APIException?: { Message?: string; Type?: string };
    InvoiceOrder?: { OrderId?: number } | Array<{ OrderId?: number }>;
  };
}

/**
 * Post a prebuilt membership invoice. Returns the created 24SO OrderId.
 */
export async function postMembershipInvoice(
  order: MembershipInvoiceOrder
): Promise<number> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("invoice", session);

  const [result]: [SaveInvoicesResult] = await client.SaveInvoicesAsync({
    invoices: { InvoiceOrder: order },
  });

  const apiMessage = result.SaveInvoicesResult?.APIException?.Message;
  if (apiMessage) {
    throw new Error(`24SO Invoice Error: ${apiMessage}`);
  }

  const saved = result.SaveInvoicesResult?.InvoiceOrder;
  const invoice = Array.isArray(saved) ? saved[0] : saved;
  if (!invoice?.OrderId) {
    throw new Error("Failed to create invoice - no OrderId returned");
  }

  console.log(
    `[24SO Invoice] Created membership invoice ${invoice.OrderId} for customer ${order.CustomerId}`
  );
  return invoice.OrderId;
}
```

- [ ] **Step 3: Update the barrel export**

In `packages/connectors/src/24sevenoffice/index.ts`, replace the invoice block (lines 32-38):

```ts
// Invoice management
export { postMembershipInvoice } from "./invoice";
```

and add `upsertMembershipCustomer` to the customer management export list (lines 23-29).

- [ ] **Step 4: Find and fix broken importers**

Run: `grep -rn "createMembershipInvoice\|CAMPUS_DEPARTMENT_IDS\|CAMPUS_NAMES\|InvoiceOrder\|InvoiceRow" --include="*.ts" --include="*.tsx" apps packages | grep -v node_modules | grep -v "\.worktrees" | grep -v "finago-membership-invoice"`

Update every hit to the new surface. Admin surfaces that used `CAMPUS_NAMES` for display should import `CAMPUS_INVOICE_NAMES` from `@repo/shared/utils/finago-membership-invoice`.

- [ ] **Step 5: Verify types**

Run: `bun run check-types`
Expected: PASS across all packages

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix packages/connectors/src/24sevenoffice
git add packages/connectors
git commit -m "Add membership customer upsert and thin invoice transport

upsertMembershipCustomer resolves by employee id then external id and creates
with Id set explicitly, so the Finago customer number equals the Azure
employee id as BI's app expects. Invoice posting is now pure transport; the
payload lives in @repo/shared where it is tested."
```

---

## Task 8: BI-tenant directory lookup

**Files:**
- Create: `packages/connectors/src/azure/bi-directory.ts`
- Modify: `packages/connectors/package.json` (exports map)
- Modify: `packages/connectors/src/azure/index.ts`

**Interfaces:**
- Consumes: `GraphUserService` from `packages/connectors/src/azure/users.ts`.
- Produces:
  - `interface BiDirectoryUser { campusHint: string | null; displayName: string; employeeId: string | null; givenName: string | null; mail: string | null; surname: string | null }`
  - `getBiDirectoryUser(email: string): Promise<BiDirectoryUser | null>`
  - `isBiDirectoryConfigured(): boolean`

- [ ] **Step 1: Write the implementation**

```ts
/**
 * Lookups against BI's Azure tenant, through BISO's app registration there.
 *
 * Separate from the `AZURE_*` variables, which address BISO's own tenant. The
 * only value this flow needs is `employeeId`, which becomes the Finago
 * customer number. `officeLocation`/`department` are read as a campus hint to
 * prefill the purchase wizard — never as an authority, since BI does not
 * populate them consistently.
 */

import { GraphUserService } from "./users";

export interface BiDirectoryUser {
  campusHint: string | null;
  displayName: string;
  employeeId: string | null;
  givenName: string | null;
  mail: string | null;
  surname: string | null;
}

const CAMPUS_ID_BY_NAME: Record<string, string> = {
  oslo: "1",
  bergen: "2",
  trondheim: "3",
  stavanger: "4",
};

export function isBiDirectoryConfigured(): boolean {
  return Boolean(
    process.env.BI_AZURE_TENANT_ID &&
      process.env.BI_AZURE_CLIENT_ID &&
      process.env.BI_AZURE_CLIENT_SECRET
  );
}

function resolveCampusHint(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    for (const [name, campusId] of Object.entries(CAMPUS_ID_BY_NAME)) {
      if (normalized.includes(name)) {
        return campusId;
      }
    }
  }
  return null;
}

export async function getBiDirectoryUser(
  email: string
): Promise<BiDirectoryUser | null> {
  if (!isBiDirectoryConfigured()) {
    throw new Error("BI_AZURE_* credentials are not configured");
  }

  const service = new GraphUserService(
    process.env.BI_AZURE_TENANT_ID as string,
    process.env.BI_AZURE_CLIENT_ID as string,
    process.env.BI_AZURE_CLIENT_SECRET as string
  );

  const user = await service.getUser(email);
  if (!user) {
    return null;
  }

  return {
    displayName: user.displayName,
    employeeId: user.employeeId ?? null,
    givenName: user.givenName ?? null,
    surname: user.surname ?? null,
    mail: user.mail ?? null,
    campusHint: resolveCampusHint(user.officeLocation, user.department),
  };
}
```

- [ ] **Step 2: Export it**

Append to `packages/connectors/src/azure/index.ts`:

```ts
export {
  type BiDirectoryUser,
  getBiDirectoryUser,
  isBiDirectoryConfigured,
} from "./bi-directory";
```

Add to `packages/connectors/package.json` `exports`:

```json
"./azure/bi-directory": "./src/azure/bi-directory.ts",
```

- [ ] **Step 3: Verify types**

Run: `bun run check-types --filter=@repo/connectors`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix packages/connectors/src/azure
git add packages/connectors
git commit -m "Add BI-tenant Azure directory lookup

Reads employeeId (the Finago customer number) and a best-effort campus hint
for a BI student, through BISO's app registration in BI's tenant."
```

---

## Task 9: BI identity sync action

**Files:**
- Create: `apps/web/src/lib/actions/bi-identity.ts`
- Modify: `apps/web/src/components/profile/identity-management.tsx:69-98`
- Modify: `apps/web/src/app/(protected)/profile/page.tsx`

**Interfaces:**
- Consumes: `parseBiStudentEmail` (Task 2), `getBiDirectoryUser` (Task 8).
- Produces:
  - `type BiIdentitySyncResult = { success: true; studentId: string; hasEmployeeId: boolean; campusHint: string | null } | { success: false; error: "not_authenticated" | "no_bi_identity" | "invalid_bi_email" | "directory_unavailable" }`
  - `syncBiStudentIdentity(): Promise<BiIdentitySyncResult>`

- [ ] **Step 1: Write the implementation**

```ts
"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { getBiDirectoryUser } from "@repo/connectors/azure/bi-directory";
import { parseBiStudentEmail } from "@repo/shared/utils/bi-student";
import { revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
  bi_linked_at?: string | null;
};

export type BiIdentitySyncResult =
  | {
      campusHint: string | null;
      hasEmployeeId: boolean;
      studentId: string;
      success: true;
    }
  | {
      error:
        | "not_authenticated"
        | "no_bi_identity"
        | "invalid_bi_email"
        | "directory_unavailable";
      success: false;
    };

/**
 * Completes a BI student account link.
 *
 * Appwrite only supports identity linking client-side, so the OAuth2 session is
 * started in the browser and this runs on the return leg. It reads the OIDC
 * identity's BI address, derives the student id, and enriches the profile with
 * the Azure employee id that Finago uses as the customer number.
 *
 * Writes go through the admin client: these columns are identity assertions,
 * deliberately outside the self-service PROFILE_WRITABLE_FIELDS allow-list.
 */
export async function syncBiStudentIdentity(): Promise<BiIdentitySyncResult> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { success: false, error: "not_authenticated" };
    }

    const identities = await account.listIdentities().catch(() => null);
    const biIdentity = identities?.identities.find(
      (identity) => identity.provider.toLowerCase() === "oidc"
    );
    if (!biIdentity) {
      return { success: false, error: "no_bi_identity" };
    }

    const parsed =
      parseBiStudentEmail(biIdentity.providerEmail) ??
      parseBiStudentEmail(biIdentity.providerUid);
    if (!parsed) {
      return { success: false, error: "invalid_bi_email" };
    }

    let employeeId: string | null = null;
    let campusHint: string | null = null;
    let directoryFailed = false;

    try {
      const directoryUser = await getBiDirectoryUser(
        `${parsed.studentId}@bi.no`
      );
      employeeId = directoryUser?.employeeId ?? null;
      campusHint = directoryUser?.campusHint ?? null;
    } catch (error) {
      directoryFailed = true;
      console.error("[BI Identity] Directory lookup failed:", error);
    }

    const { db } = await createAdminClient();
    const update: Partial<BiUser> = {
      student_id: parsed.studentId,
      bi_linked_at: new Date().toISOString(),
    };
    if (employeeId) {
      update.bi_employee_id = employeeId;
    }
    if (campusHint) {
      const existing = (await db
        .getRow<BiUser>("app", "user", user.$id)
        .catch(() => null)) as BiUser | null;
      if (!existing?.bi_campus_id) {
        update.bi_campus_id = campusHint;
      }
    }

    await db.updateRow<BiUser>("app", "user", user.$id, update);

    // The live membership check is keyed by the numeric student id; drop the
    // cached "no_student_id" result so status is correct immediately.
    revalidateTag(`membership:${parsed.studentNumber}`, { expire: 0 });

    if (directoryFailed) {
      return { success: false, error: "directory_unavailable" };
    }

    return {
      success: true,
      studentId: parsed.studentId,
      hasEmployeeId: Boolean(employeeId),
      campusHint,
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[BI Identity] Sync failed:", error);
    return { success: false, error: "directory_unavailable" };
  }
}
```

- [ ] **Step 2: Call it on the OAuth return leg**

In `apps/web/src/app/(protected)/profile/page.tsx`, the page already reads `searchParams`. Add, before rendering:

```tsx
const params = await searchParams;
if (params.linked === "1") {
  await syncBiStudentIdentity();
}
```

with `import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";`. If `searchParams` is not currently a prop on this page, add it as `searchParams: Promise<{ linked?: string; error?: string }>`.

- [ ] **Step 3: Do the same for onboarding**

In `apps/web/src/app/(public)/onboarding/page.tsx`, after `const params = await searchParams;` and before the profile redirect check, add:

```tsx
if (params.linked === "1") {
  await syncBiStudentIdentity();
}
```

- [ ] **Step 4: Verify types**

Run: `bun run check-types --filter=web`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix apps/web/src/lib/actions/bi-identity.ts "apps/web/src/app/(protected)/profile/page.tsx" "apps/web/src/app/(public)/onboarding/page.tsx"
git add apps/web
git commit -m "Capture student id and Azure employee id on BI account link

Nothing previously wrote student_id after the OIDC link, so the live Finago
membership check always resolved no_student_id. The return leg now derives the
student id from the BI address and enriches the profile with the employee id
Finago uses as the customer number."
```

---

## Task 10: Move the live membership check into shared

**Files:**
- Create: `packages/shared/utils/membership-status.ts`
- Modify: `apps/web/src/lib/actions/membership.ts`

**Interfaces:**
- Consumes: `sanitizeStudentNumber` (Task 2), `getCustomerCategories` from `@repo/connectors/24sevenoffice`.
- Produces:
  - `interface MembershipInfo { category: string | null; expiryDate: string; id: string; name: string; startDate: string }`
  - `interface MembershipStatus { checkedAt: number; finagoCategoryIds: number[]; isMember: boolean; memberships: MembershipInfo[]; reason?: string }`
  - `class MembershipComputationError extends Error { readonly reason: string }`
  - `emptyMembershipStatus(reason: string): MembershipStatus`
  - `computeMembershipStatus(numericId: number): Promise<MembershipStatus>`
  - `membershipCacheTag(numericId: number): string`

The `unstable_cache` wrapper and the cookie-bound `resolveCurrentStudentId` stay in `apps/web` — `@repo/shared` must not gain a `next` dependency.

- [ ] **Step 1: Create the shared module**

Move lines 12-173 of `apps/web/src/lib/actions/membership.ts` into `packages/shared/utils/membership-status.ts` verbatim, with these changes:

- drop the `"use server"` directive (it is not a server-action module);
- export `MembershipComputationError`, `computeMembershipStatus`, and rename `emptyStatus` to `emptyMembershipStatus` (exported);
- replace the local student-id sanitizing with `sanitizeStudentNumber` from `./bi-student`;
- add:

```ts
export function membershipCacheTag(numericId: number): string {
  return `membership:${numericId}`;
}
```

- keep `MEMBERSHIP_CACHE_TTL_SECONDS` in the web module, not here.

- [ ] **Step 2: Rewrite the web module against it**

`apps/web/src/lib/actions/membership.ts` keeps only: `MEMBERSHIP_CACHE_TTL_SECONDS`, `getCachedMembershipStatus`, `resolveMembershipStatus`, `resolveCurrentStudentId`, `getMembershipStatus`, `refreshMembershipStatus` — all importing types and the compute function from `@repo/shared/utils/membership-status`, and re-exporting `MembershipInfo`/`MembershipStatus` so existing importers do not break.

`resolveCurrentStudentId` uses `sanitizeStudentNumber(userData.profile?.student_id)` instead of its inline regex, returning `{ status: emptyMembershipStatus("invalid_student_id") }` on `null`.

Every `revalidateTag(\`membership:${id}\`)` becomes `revalidateTag(membershipCacheTag(id), { expire: 0 })`.

- [ ] **Step 3: Run the existing web membership tests**

Run: `cd apps/web && bun x vitest run src/lib/actions/membership.test.ts`
Expected: PASS — the public behaviour of `getMembershipStatus` is unchanged. If a mock path broke, update the mock target to `@repo/shared/utils/membership-status`; do not change assertions.

- [ ] **Step 4: Verify types**

Run: `bun run check-types --filter=web --filter=@repo/shared`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-status.ts apps/web/src/lib/actions/membership.ts
git add packages/shared apps/web
git commit -m "Move the live Finago membership computation into @repo/shared

Both apps need it, so the uncached core moves to shared while the Next-specific
cache wrapper and cookie-bound student id resolution stay in apps/web."
```

---

## Task 11: Retire the verify_biso_membership Function

Six call sites depend on a black-box Appwrite Function. All move to the live check.

**Files:**
- Modify: `packages/shared/utils/membership.ts` (replace implementation)
- Modify: `apps/web/src/app/actions/orders.ts:65-101`
- Modify: `apps/api/src/app/api/payment/[provider]/checkout/route.ts:393-434`
- Modify: `apps/web/src/components/profile/membership-status-card.tsx:190-210`

**Interfaces:**
- Consumes: `computeMembershipStatus`, `emptyMembershipStatus` (Task 10), `sanitizeStudentNumber` (Task 2).
- Produces: `checkMembership()` keeps its existing `MembershipCheckResult` signature, so the two profile pages (`apps/web`, `apps/admin`) need no change.

- [ ] **Step 1: Reimplement checkMembership**

Replace the body of `packages/shared/utils/membership.ts` (keeping the exported `MembershipCheckResult` type shape identical):

```ts
import { createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "./bi-student";
import { computeMembershipStatus } from "./membership-status";

type MembershipData = Record<string, unknown>;

export type MembershipCheckResult =
  | {
      ok: true;
      active: boolean;
      membership?: MembershipData;
      studentId?: number;
      categories?: number[];
    }
  | { ok: false; error: string };

/**
 * Verify the current user's BISO membership by reading Finago live.
 *
 * Finago is the sole source of truth: a member added by hand there is a member
 * here. Requires `user.student_id`, which is populated when the BI student
 * account is linked.
 */
export async function checkMembership(): Promise<MembershipCheckResult> {
  try {
    const { account, db } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { ok: true, active: false };
    }

    const profile = await db
      .getRow<Users>("app", "user", user.$id)
      .catch(() => null);
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return { ok: true, active: false };
    }

    const status = await computeMembershipStatus(studentNumber);

    return {
      ok: true,
      active: status.isMember,
      membership: status.memberships[0] as MembershipData | undefined,
      studentId: studentNumber,
      categories: status.finagoCategoryIds,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 2: Replace the discount check in apps/web**

In `apps/web/src/app/actions/orders.ts`, replace `getMemberDiscountIfAny` (lines 65-101) with:

```ts
async function getMemberDiscountIfAny(product: Record<string, unknown>) {
  try {
    if (
      !(product?.member_discount_enabled && product?.member_discount_percent)
    ) {
      return { applied: false, percent: 0 };
    }
    const status = await getMembershipStatus();
    if (!status.isMember) {
      return { applied: false, percent: 0 };
    }
    return {
      applied: true,
      percent: Number(product.member_discount_percent) || 0,
    };
  } catch {
    return { applied: false, percent: 0 };
  }
}
```

with `import { getMembershipStatus } from "@/lib/actions/membership";`. Remove the now-unused `Users` type import if nothing else in the file uses it.

- [ ] **Step 3: Replace the discount check in apps/api**

In `apps/api/src/app/api/payment/[provider]/checkout/route.ts`, replace `getMemberDiscountIfAny` (lines 393-434) with:

```ts
async function getMemberDiscountIfAny(
  product: NormalizedProduct,
  authClient: AuthenticatedClient,
  userId: string
) {
  if (
    !(
      product.metadata_parsed.member_discount_enabled &&
      product.metadata_parsed.member_discount_percent
    )
  ) {
    return { applied: false, percent: 0 };
  }

  try {
    const profile = await authClient.db.getRow<Users>("app", "user", userId);
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return { applied: false, percent: 0 };
    }

    const status = await computeMembershipStatus(studentNumber);
    if (!status.isMember) {
      return { applied: false, percent: 0 };
    }

    return {
      applied: true,
      percent: Number(product.metadata_parsed.member_discount_percent) || 0,
    };
  } catch {
    return { applied: false, percent: 0 };
  }
}
```

with imports `import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";` and `import { computeMembershipStatus } from "@repo/shared/utils/membership-status";`.

- [ ] **Step 4: Replace the client-side function execution**

Open `apps/web/src/components/profile/membership-status-card.tsx` and read the block around line 190-210. It executes `verify_biso_membership` from the browser. Replace that call with a fetch of the existing route handler, which already wraps the live check:

```ts
const response = await fetch("/api/membership?refresh=true", {
  cache: "no-store",
});
const payload = await response.json();
```

Map `payload.isMember` / `payload.memberships` onto whatever local state the component already sets. Read the component first and preserve its existing state shape — do not restructure it. Confirm the route's response shape by reading `apps/web/src/app/api/membership/route.ts`.

- [ ] **Step 5: Confirm nothing references the Function**

Run: `grep -rn "verify_biso_membership" --include="*.ts" --include="*.tsx" apps packages | grep -v node_modules | grep -v "\.worktrees"`
Expected: no output

- [ ] **Step 6: Run affected tests and types**

Run: `cd apps/web && bun x vitest run src/app/actions/member-portal.test.ts src/lib/actions/membership.test.ts`
Expected: PASS

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership.ts apps/web/src/app/actions/orders.ts "apps/api/src/app/api/payment/[provider]/checkout/route.ts" apps/web/src/components/profile/membership-status-card.tsx
git add packages apps
git commit -m "Read membership live from Finago everywhere

Retires the verify_biso_membership Appwrite Function. The member portal, both
profile pages, and the member-discount pricing in both checkout paths now share
the cached live Finago read, so they can no longer disagree."
```

---

## Task 12: Membership catalog reader

**Files:**
- Create: `apps/web/src/lib/membership-catalog.ts`

**Interfaces:**
- Consumes: `toMembershipPlan`, `MembershipPlan` (Task 3).
- Produces:
  - `getPurchasableMembershipPlans(): Promise<MembershipPlan[]>`
  - `getMembershipPlanById(planId: string): Promise<MembershipPlan | null>`

Not a `"use server"` module — it is a plain library imported by server components and server actions, so it may export non-async values.

- [ ] **Step 1: Write the implementation**

```ts
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import {
  type MembershipPlan,
  toMembershipPlan,
} from "@repo/shared/utils/membership-plans";

/**
 * Purchasable membership plans, newest expiry first.
 *
 * Rows come from the `memberships` table, which `syncMembershipsFrom24SO`
 * keeps in step with 24SevenOffice. `canPurchase` is administrator-controlled,
 * so a plan only appears here once someone has priced it and switched it on.
 * Uses the admin client because the table is not readable by anonymous
 * sessions and the catalog is public, non-sensitive data.
 */
export async function getPurchasableMembershipPlans(): Promise<
  MembershipPlan[]
> {
  const { db } = await createAdminClient();
  const response = await db.listRows<Memberships>("app", "memberships", [
    Query.equal("status", true),
    Query.equal("canPurchase", true),
    Query.limit(50),
  ]);

  return response.rows
    .map((row) => toMembershipPlan(row))
    .filter((plan): plan is MembershipPlan => plan !== null)
    .sort((a, b) => a.accrualMonths - b.accrualMonths);
}

export async function getMembershipPlanById(
  planId: string
): Promise<MembershipPlan | null> {
  const plans = await getPurchasableMembershipPlans();
  return plans.find((plan) => plan.id === planId) ?? null;
}
```

- [ ] **Step 2: Verify types**

Run: `bun run check-types --filter=web`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
bun x ultracite fix apps/web/src/lib/membership-catalog.ts
git add apps/web/src/lib/membership-catalog.ts
git commit -m "Add the purchasable membership plan catalog reader"
```

---

## Task 13: Purchase gate resolution

**Files:**
- Create: `apps/web/src/lib/membership-gate.ts`
- Test: `apps/web/src/lib/membership-gate.test.ts`

**Interfaces:**
- Consumes: `MembershipPlan` (Task 3), `MembershipStatus` (Task 10).
- Produces:
  - `type MembershipGateState = "signed_out" | "needs_bi_link" | "needs_directory_record" | "already_member" | "eligible"`
  - `interface MembershipGateInput { isAuthenticated: boolean; studentId: string | null | undefined; employeeId: string | null | undefined; status: { isMember: boolean; memberships: Array<{ expiryDate: string }> } | null; plans: MembershipPlan[] }`
  - `interface MembershipGate { state: MembershipGateState; offeredPlans: MembershipPlan[]; currentExpiry: string | null }`
  - `resolveMembershipGate(input: MembershipGateInput): MembershipGate`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";
import { resolveMembershipGate } from "./membership-gate";

const semester: MembershipPlan = {
  id: "54",
  name: "BISO Membership fall 2026",
  price: 350,
  productId: 54,
  categoryId: 113_176,
  duration: "semester",
  accrualMonths: 6,
  startDate: "2026-08-01",
  expiryDate: "2026-12-31",
};
const threeYears: MembershipPlan = {
  ...semester,
  id: "82",
  productId: 82,
  categoryId: 113_177,
  duration: "three_years",
  accrualMonths: 36,
  price: 1350,
  expiryDate: "2029-06-30",
};
const plans = [semester, threeYears];

function input(overrides: Record<string, unknown> = {}) {
  return {
    isAuthenticated: true,
    studentId: "s1715738",
    employeeId: "9001234",
    status: { isMember: false, memberships: [] },
    plans,
    ...overrides,
  };
}

describe("resolveMembershipGate", () => {
  it("requires sign in first", () => {
    expect(resolveMembershipGate(input({ isAuthenticated: false })).state).toBe(
      "signed_out"
    );
  });

  it("requires a linked BI account", () => {
    expect(resolveMembershipGate(input({ studentId: null })).state).toBe(
      "needs_bi_link"
    );
  });

  it("requires an Azure employee id before taking payment", () => {
    expect(resolveMembershipGate(input({ employeeId: null })).state).toBe(
      "needs_directory_record"
    );
  });

  it("is eligible with everything present", () => {
    const gate = resolveMembershipGate(input());
    expect(gate.state).toBe("eligible");
    expect(gate.offeredPlans).toEqual(plans);
    expect(gate.currentExpiry).toBeNull();
  });

  it("offers only plans that extend an existing membership", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [{ expiryDate: "2026-12-31" }],
        },
      })
    );
    expect(gate.state).toBe("eligible");
    expect(gate.currentExpiry).toBe("2026-12-31");
    expect(gate.offeredPlans).toEqual([threeYears]);
  });

  it("reports already_member when no plan would extend cover", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [{ expiryDate: "2030-01-01" }],
        },
      })
    );
    expect(gate.state).toBe("already_member");
    expect(gate.offeredPlans).toEqual([]);
  });

  it("uses the latest expiry when several memberships match", () => {
    const gate = resolveMembershipGate(
      input({
        status: {
          isMember: true,
          memberships: [
            { expiryDate: "2026-12-31" },
            { expiryDate: "2029-06-30" },
          ],
        },
      })
    );
    expect(gate.currentExpiry).toBe("2029-06-30");
    expect(gate.offeredPlans).toEqual([]);
  });

  it("reports already_member when the catalog is empty", () => {
    const gate = resolveMembershipGate(input({ plans: [] }));
    expect(gate.state).toBe("already_member");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && bun x vitest run src/lib/membership-gate.test.ts`
Expected: FAIL — `Failed to resolve import "./membership-gate"`

- [ ] **Step 3: Write the implementation**

```ts
import type { MembershipPlan } from "@repo/shared/utils/membership-plans";

export type MembershipGateState =
  | "signed_out"
  | "needs_bi_link"
  | "needs_directory_record"
  | "already_member"
  | "eligible";

export interface MembershipGateInput {
  employeeId: string | null | undefined;
  isAuthenticated: boolean;
  plans: MembershipPlan[];
  status: {
    isMember: boolean;
    memberships: Array<{ expiryDate: string }>;
  } | null;
  studentId: string | null | undefined;
}

export interface MembershipGate {
  currentExpiry: string | null;
  offeredPlans: MembershipPlan[];
  state: MembershipGateState;
}

/**
 * Decides which purchase state applies, in strict order: authentication, BI
 * link, directory record, then catalog.
 *
 * The directory record is checked BEFORE payment deliberately — without an
 * Azure employee id there is no Finago customer number, so the purchase could
 * not be fulfilled and the student must not be charged.
 */
export function resolveMembershipGate(
  input: MembershipGateInput
): MembershipGate {
  const empty = { offeredPlans: [], currentExpiry: null };

  if (!input.isAuthenticated) {
    return { state: "signed_out", ...empty };
  }
  if (!input.studentId) {
    return { state: "needs_bi_link", ...empty };
  }
  if (!input.employeeId) {
    return { state: "needs_directory_record", ...empty };
  }

  const expiries = (input.status?.memberships ?? [])
    .map((membership) => membership.expiryDate)
    .filter(Boolean)
    .sort();
  const currentExpiry = input.status?.isMember
    ? (expiries.at(-1) ?? null)
    : null;

  const offeredPlans = currentExpiry
    ? input.plans.filter((plan) => plan.expiryDate > currentExpiry)
    : input.plans;

  if (offeredPlans.length === 0) {
    return { state: "already_member", offeredPlans: [], currentExpiry };
  }

  return { state: "eligible", offeredPlans, currentExpiry };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && bun x vitest run src/lib/membership-gate.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix apps/web/src/lib/membership-gate.ts apps/web/src/lib/membership-gate.test.ts
git add apps/web/src/lib
git commit -m "Add membership purchase gate resolution

Checks authentication, BI link, and Azure directory record in order, and only
offers plans that extend an existing membership."
```

---

## Task 14: Checkout server action

**Files:**
- Create: `apps/web/src/app/actions/membership-purchase.ts`

**Interfaces:**
- Consumes: `getMembershipPlanById` (Task 12), `CAMPUS_INVOICE_NAMES` (Task 6).
- Produces:
  - `interface StartMembershipCheckoutInput { campusId: string; planId: string; provider: "vipps" | "stripe" }`
  - `startMembershipCheckout(input): Promise<{ success: true; paymentUrl: string; orderId: string } | { success: false; error: string }>`

- [ ] **Step 1: Write the implementation**

```ts
"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { getMembershipPlanById } from "@/lib/membership-catalog";

type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
};

export interface StartMembershipCheckoutInput {
  campusId: string;
  planId: string;
  provider: "vipps" | "stripe";
}

export type StartMembershipCheckoutResult =
  | { success: true; paymentUrl: string; orderId: string }
  | { success: false; error: string };

const CHECKOUT_TIMEOUT_MS = 10_000;

/**
 * Starts a membership purchase.
 *
 * Fails closed on every precondition — authentication, BI link, Azure employee
 * id, campus validity, plan availability — so no student can be charged for a
 * membership this system could not then register in Finago. The price is not
 * sent: the API re-reads it from the `memberships` table.
 */
export async function startMembershipCheckout(
  input: StartMembershipCheckoutInput
): Promise<StartMembershipCheckoutResult> {
  try {
    const flags = await getFeatureFlagStates();
    const providerEnabled =
      input.provider === "vipps" ? flags.payments_vipps : flags.payments_stripe;
    if (!providerEnabled) {
      return {
        success: false,
        error: `${input.provider === "vipps" ? "Vipps" : "Card"} payment is currently unavailable.`,
      };
    }

    if (!CAMPUS_INVOICE_NAMES[input.campusId]) {
      return { success: false, error: "Select a valid campus." };
    }

    const { account, db } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { success: false, error: "You must be signed in." };
    }

    const profile = (await db
      .getRow<BiUser>("app", "user", user.$id)
      .catch(() => null)) as BiUser | null;

    if (sanitizeStudentNumber(profile?.student_id) === null) {
      return {
        success: false,
        error: "Link your BI student account before purchasing.",
      };
    }
    if (!profile?.bi_employee_id) {
      return {
        success: false,
        error:
          "We could not verify your BI student record. Please contact us so we can help.",
      };
    }

    const plan = await getMembershipPlanById(input.planId);
    if (!plan) {
      return { success: false, error: "That membership is no longer available." };
    }

    // Remember the campus so it prefills next time and so the profile reflects
    // what the student told us at purchase.
    const { db: adminDb } = await createAdminClient();
    await adminDb
      .updateRow<BiUser>("app", "user", user.$id, {
        bi_campus_id: input.campusId,
      })
      .catch(() => {
        // Non-critical: the campus is carried on the order regardless.
      });

    const jwt = await account.createJWT().catch(() => null);
    if (!jwt?.jwt) {
      return { success: false, error: "A valid session is required." };
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      return { success: false, error: "Checkout is misconfigured." };
    }

    const response = await fetch(
      `${apiBaseUrl}/api/payment/${input.provider}/membership-checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: input.planId,
          campusId: input.campusId,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
      }
    );

    const result = await response.json().catch(() => null);
    if (!(response.ok && result?.checkoutUrl && result?.orderId)) {
      return {
        success: false,
        error: result?.message ?? "Failed to start checkout. Please try again.",
      };
    }

    return {
      success: true,
      paymentUrl: result.checkoutUrl as string,
      orderId: result.orderId as string,
    };
  } catch (error) {
    console.error("[Membership Checkout] Failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
```

- [ ] **Step 2: Verify types**

Run: `bun run check-types --filter=web`
Expected: PASS

- [ ] **Step 3: Verify the "use server" async-only rule**

Run: `grep -nE "^export (const|let|interface|type|class)" apps/web/src/app/actions/membership-purchase.ts`
Expected: only `export interface` / `export type` lines (types are erased and are permitted); no `export const`.

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix apps/web/src/app/actions/membership-purchase.ts
git add apps/web/src/app/actions/membership-purchase.ts
git commit -m "Add the membership checkout server action

Fails closed on authentication, BI link, employee id, campus, and plan
availability before any payment session is created, and never sends a price."
```

---

## Task 15: Trusted membership checkout endpoint

**Files:**
- Create: `apps/api/src/app/api/payment/[provider]/membership-checkout/route.ts`

**Interfaces:**
- Consumes: `toMembershipPlan` (Task 3), `CAMPUS_INVOICE_NAMES` (Task 6), `createOrder`/`updateOrderWithSession` from `@repo/shared/utils/vipps-order-ops`.
- Produces: `POST` returning `{ checkoutUrl: string; orderId: string }`; `OPTIONS` preflight.

The `items_json` line MUST include `product_type: "membership"` — `hasMembershipProduct` looks for exactly that, and Tasks 17-18 route on it.

- [ ] **Step 1: Write the implementation**

```ts
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Memberships, Users } from "@repo/api/types/appwrite";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { createStripeCheckoutSession } from "@repo/payment/stripe";
import { createVippsPayment } from "@repo/payment/vipps";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { toMembershipPlan } from "@repo/shared/utils/membership-plans";
import {
  createOrder,
  updateOrderWithSession,
} from "@repo/shared/utils/vipps-order-ops";
import { Currency } from "@repo/shared/types/vipps";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

type BiUser = Users & { bi_employee_id?: string | null };

function isProvider(value: string): value is "vipps" | "stripe" {
  return value === "vipps" || value === "stripe";
}

function webBaseUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const origin = req.headers.get("origin");
  const { provider } = await ctx.params;
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    if (!isProvider(provider)) {
      return json({ message: "Unknown payment provider" }, 404);
    }

    if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ message: "Authentication required" }, 401);
    }
    const authClient = await createAuthenticatedClient(req);
    const user = await authClient.account.get().catch(() => null);
    if (!user?.$id) {
      return json({ message: "Authentication required" }, 401);
    }

    const flagKey = provider === "vipps" ? "payments_vipps" : "payments_stripe";
    if (!(await isFeatureEnabled(flagKey))) {
      return json(
        { message: `${provider} payment is currently unavailable` },
        403
      );
    }

    const webBase = webBaseUrl();
    if (!webBase) {
      return json({ message: "Payment service is misconfigured" }, 500);
    }

    const body = (await req.json().catch(() => null)) as {
      campusId?: string;
      planId?: string;
    } | null;
    if (!(body?.planId && body?.campusId)) {
      return json({ message: "Invalid membership checkout payload" }, 400);
    }
    if (!CAMPUS_INVOICE_NAMES[body.campusId]) {
      return json({ message: "Invalid campus" }, 400);
    }

    const { db } = await createAdminClient();

    // Identity is re-verified server side; the web action's checks are UX, not
    // authorization. Without an employee id there is no Finago customer
    // number, so the purchase could not be fulfilled — refuse before payment.
    const profile = (await db
      .getRow<BiUser>("app", "user", user.$id)
      .catch(() => null)) as BiUser | null;
    const studentNumber = sanitizeStudentNumber(profile?.student_id);
    if (studentNumber === null) {
      return json({ message: "Link your BI student account first" }, 409);
    }
    if (!profile?.bi_employee_id) {
      return json({ message: "BI student record could not be verified" }, 409);
    }

    // Price and plan come from the database, never from the client.
    const row = await db
      .getRow<Memberships>("app", "memberships", body.planId)
      .catch(() => null);
    if (!(row?.status && row?.canPurchase)) {
      return json({ message: "That membership is no longer available" }, 409);
    }
    const plan = toMembershipPlan(row);
    if (!plan) {
      return json({ message: "That membership is not configured" }, 409);
    }

    const params = {
      userId: user.$id,
      items: [
        {
          name: plan.name,
          title: plan.name,
          price: plan.price,
          unit_price: plan.price,
          productId: plan.id,
          quantity: 1,
          product_type: "membership" as const,
          membership_id: String(plan.productId),
          category_id: String(plan.categoryId),
          duration: plan.duration,
          accrual_months: plan.accrualMonths,
        },
      ],
      subtotal: plan.price,
      total: plan.price,
      reference: `membership-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      currency: Currency.NOK,
      campusId: body.campusId,
      customerInfo: {
        firstName: user.name?.split(" ")[0] || "Student",
        lastName: user.name?.split(" ").slice(1).join(" ") || "",
        email: user.email,
      },
    } as Parameters<typeof createOrder>[0];

    const { orderId } = await createOrder(params, db);
    const returnUrl = `${webBase}/api/checkout/return?orderId=${orderId}`;

    let checkoutUrl: string;
    let sessionId: string;

    if (provider === "vipps") {
      const creds = await resolveVippsCredentials(db);
      if (!creds) {
        return json({ message: "Vipps is not configured" }, 503);
      }
      const payment = await createVippsPayment({ ...params, orderId }, creds, {
        returnUrl,
      });
      checkoutUrl = payment.checkoutUrl;
      sessionId = payment.reference;
    } else {
      const creds = await resolveStripeCredentials(db);
      if (!creds) {
        return json({ message: "Stripe is not configured" }, 503);
      }
      const session = await createStripeCheckoutSession(
        { ...params, orderId },
        creds,
        { successUrl: returnUrl, cancelUrl: `${webBase}/membership/join?cancelled=true` }
      );
      checkoutUrl = session.checkoutUrl;
      sessionId = session.sessionId;
    }

    await updateOrderWithSession(
      orderId,
      { provider, sessionId, checkoutUrl },
      db
    );

    return json({ checkoutUrl, orderId });
  } catch (error) {
    console.error(`[payment/${provider}/membership-checkout] error:`, error);
    return json({ message: "Failed to create checkout session" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
```

If `Query` ends up unused after writing this, remove the import.

- [ ] **Step 2: Confirm the credentials resolver ordering matches the product route**

Read `apps/api/src/app/api/payment/[provider]/checkout/route.ts:590-646`. The product route resolves credentials **before** `createOrder` so a misconfigured provider does not leave an orphan PENDING order. Reorder the code above to match: move each `resolve*Credentials` call and its 503 return above `createOrder`.

- [ ] **Step 3: Verify types**

Run: `bun run check-types --filter=api`
Expected: PASS. If `createOrder`'s `CheckoutSessionParams` rejects the extra item fields, widen the item type in `packages/shared/types/vipps.ts` with the optional membership fields (`product_type?`, `membership_id?`, `category_id?`, `duration?`, `accrual_months?`) rather than casting.

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix "apps/api/src/app/api/payment/[provider]/membership-checkout"
git add apps/api
git commit -m "Add the trusted membership checkout endpoint

Re-reads price, plan, student id and employee id server side, marks the order
line product_type: membership, and refuses before payment when the buyer has
no Finago customer number."
```

---

## Task 16: Purchase page, wizard, and copy

**Files:**
- Create: `apps/web/src/app/(public)/membership/join/page.tsx`
- Create: `apps/web/src/app/(public)/membership/join/join-wizard.tsx`
- Create: `apps/web/src/app/(public)/membership/join/gate-states.tsx`
- Create: `apps/web/src/app/(public)/shop/membership/page.tsx`
- Modify: `packages/i18n/messages/en/membership.json`, `packages/i18n/messages/no/membership.json`

**Interfaces:**
- Consumes: `resolveMembershipGate` (Task 13), `getPurchasableMembershipPlans` (Task 12), `startMembershipCheckout` (Task 14), `getMembershipStatus` (Task 10), `getLoggedInUser` from `@/lib/actions/user`, `CAMPUS_INVOICE_NAMES` (Task 6).
- Produces: the `/membership/join` route.

- [ ] **Step 1: Add the copy**

Add a `join` object to `packages/i18n/messages/en/membership.json`:

```json
"join": {
  "title": "Join BISO",
  "subtitle": "Buy your membership here if the BI Student app isn't working for you.",
  "signedOut": {
    "title": "Sign in to continue",
    "body": "Membership is tied to your student record, so you need a BISO account before you can buy one.",
    "cta": "Sign in"
  },
  "needsBiLink": {
    "title": "Link your BI student account",
    "body": "We verify your membership against your BI student record. Signing in with your student email isn't enough — link the account itself.",
    "cta": "Link BI Student account"
  },
  "needsDirectoryRecord": {
    "title": "We couldn't verify your BI record",
    "body": "Your BI account is linked, but we couldn't read the student number BISO's finance system needs. We haven't charged you anything.",
    "retry": "Try again",
    "contact": "Contact us"
  },
  "alreadyMember": {
    "title": "You're already a member",
    "body": "Your membership runs until {expiry}.",
    "cta": "Go to the member portal"
  },
  "plan": {
    "legend": "Choose how long",
    "semester": "One semester",
    "year": "One year",
    "three_years": "Three years",
    "price": "{price} kr",
    "extends": "Extends your membership to {expiry}"
  },
  "campus": {
    "legend": "Which campus do you study at?",
    "help": "We can't detect this automatically, and your invoice is booked to your campus.",
    "placeholder": "Select campus"
  },
  "pay": {
    "legend": "Pay with",
    "vipps": "Vipps",
    "stripe": "Card",
    "submit": "Pay {price} kr",
    "working": "Starting checkout…"
  },
  "errors": {
    "noPlan": "Choose a membership length.",
    "noCampus": "Choose your campus.",
    "generic": "Something went wrong. Please try again."
  }
}
```

Add the Norwegian equivalent to `packages/i18n/messages/no/membership.json` with the same key structure. Translate naturally — do not leave English strings in the `no` bundle.

- [ ] **Step 2: Write the gate-state components**

`gate-states.tsx` is a client component exporting `SignedOutState`, `NeedsBiLinkState`, `NeedsDirectoryRecordState`, and `AlreadyMemberState`. `NeedsBiLinkState` triggers the OIDC flow exactly as `identity-management.tsx:83-98` does:

```tsx
"use client";

import { clientAccount, OAuthProvider } from "@repo/api/client";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

function StateCard({
  title,
  body,
  children,
}: {
  body: string;
  children?: React.ReactNode;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <h2 className="mb-2 font-bold text-foreground text-xl">{title}</h2>
      <p className="mb-6 text-muted-foreground text-sm">{body}</p>
      <div className="flex flex-wrap justify-center gap-3">{children}</div>
    </Card>
  );
}

export function SignedOutState() {
  const t = useTranslations("membership.join.signedOut");
  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button asChild>
        <Link href="/auth/login?redirectTo=/membership/join">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}

export function NeedsBiLinkState() {
  const t = useTranslations("membership.join.needsBiLink");
  const [isLinking, startLink] = useTransition();

  const link = () => {
    startLink(async () => {
      const base = window.location.origin;
      await clientAccount.createOAuth2Session(
        OAuthProvider.Oidc,
        `${base}/membership/join?linked=1`,
        `${base}/membership/join?oidc_failed=1`,
        ["openid", "email", "profile"]
      );
    });
  };

  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button disabled={isLinking} onClick={link}>
        {t("cta")}
      </Button>
    </StateCard>
  );
}

export function NeedsDirectoryRecordState({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const t = useTranslations("membership.join.needsDirectoryRecord");
  return (
    <StateCard body={t("body")} title={t("title")}>
      <Button onClick={onRetry} variant="outline">
        {t("retry")}
      </Button>
      <Button asChild>
        <Link href="/contact">{t("contact")}</Link>
      </Button>
    </StateCard>
  );
}

export function AlreadyMemberState({ expiry }: { expiry: string | null }) {
  const t = useTranslations("membership.join.alreadyMember");
  return (
    <StateCard body={t("body", { expiry: expiry ?? "—" })} title={t("title")}>
      <Button asChild>
        <Link href="/member">{t("cta")}</Link>
      </Button>
    </StateCard>
  );
}
```

`onRetry` is wired in the page to a server action that re-runs `syncBiStudentIdentity` and refreshes; implement it as a small client wrapper calling `syncBiStudentIdentity()` then `router.refresh()`.

- [ ] **Step 3: Write the wizard**

`join-wizard.tsx` is a client component taking `{ plans: MembershipPlan[]; defaultCampusId: string | null; currentExpiry: string | null; providers: { stripe: boolean; vipps: boolean } }`. It holds `planId`, `campusId`, and `provider` in state, validates that a plan and campus are chosen, calls `startMembershipCheckout`, and on success assigns `window.location.href = result.paymentUrl`. On failure it renders `result.error` in an `role="alert"` region. Campus options come from `CAMPUS_INVOICE_NAMES` excluding `"5"` (National is not a study campus). Use `Card`, `Button`, `Label`, and `RadioGroup` from `@repo/ui`, and `trackEvent("membership_purchase_start", { plan, campus, provider })` from `@repo/shared/utils/analytics` on submit. Every visible string comes from `useTranslations("membership.join")` — no hardcoded copy.

- [ ] **Step 4: Write the page**

```tsx
import type { Metadata } from "next";
import { getPurchasableMembershipPlans } from "@/lib/membership-catalog";
import { resolveMembershipGate } from "@/lib/membership-gate";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { JoinWizard } from "./join-wizard";
import {
  AlreadyMemberState,
  NeedsBiLinkState,
  SignedOutState,
} from "./gate-states";
import { RetryDirectoryState } from "./retry-directory-state";

export const metadata: Metadata = {
  title: "Join BISO | BISO",
  description: "Buy your BISO membership.",
};

export default async function MembershipJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>;
}) {
  const params = await searchParams;
  if (params.linked === "1") {
    await syncBiStudentIdentity();
  }

  const [userData, status, plans, flags] = await Promise.all([
    getLoggedInUser(),
    getMembershipStatus(),
    getPurchasableMembershipPlans(),
    getFeatureFlagStates(),
  ]);

  const profile = userData?.profile as
    | { bi_campus_id?: string | null; bi_employee_id?: string | null }
    | null
    | undefined;

  const gate = resolveMembershipGate({
    isAuthenticated: Boolean(userData?.user),
    studentId: userData?.profile?.student_id,
    employeeId: profile?.bi_employee_id,
    status,
    plans,
  });

  if (gate.state === "signed_out") {
    return <SignedOutState />;
  }
  if (gate.state === "needs_bi_link") {
    return <NeedsBiLinkState />;
  }
  if (gate.state === "needs_directory_record") {
    return <RetryDirectoryState />;
  }
  if (gate.state === "already_member") {
    return <AlreadyMemberState expiry={gate.currentExpiry} />;
  }

  return (
    <JoinWizard
      currentExpiry={gate.currentExpiry}
      defaultCampusId={profile?.bi_campus_id ?? null}
      plans={gate.offeredPlans}
      providers={{ vipps: flags.payments_vipps, stripe: flags.payments_stripe }}
    />
  );
}
```

Create `retry-directory-state.tsx` as the client wrapper that calls `syncBiStudentIdentity()` then `useRouter().refresh()` and renders `NeedsDirectoryRecordState`.

- [ ] **Step 5: Add the redirect so existing CTAs keep working**

`apps/web/src/app/(public)/shop/membership/page.tsx`:

```tsx
import { permanentRedirect } from "next/navigation";

// Every membership CTA on the site points at /shop/membership/. The purchase
// flow lives at /membership/join; keep the old path working.
export default function ShopMembershipRedirect(): never {
  permanentRedirect("/membership/join");
}
```

This route file must win over the `(public)/shop/[slug]` catch-all. Static segments take precedence over dynamic ones in the App Router, so no further change is needed — but verify in Step 6.

- [ ] **Step 6: Verify manually**

Run: `bun run dev --filter=web`

Check each in a browser:
1. `/shop/membership` redirects to `/membership/join`.
2. Signed out → sign-in card.
3. Signed in without a linked BI account → link card, and the button starts the OIDC flow.
4. Signed in and linked but with `bi_employee_id` cleared in Appwrite → the "couldn't verify" card, with a working retry.
5. Eligible → the wizard shows the plans, campus select prefilled, and both payment buttons per the flags.
6. Switch locale to Norwegian and confirm no English strings leak.

- [ ] **Step 7: Verify types and lint**

Run: `bun run check-types --filter=web && bun run lint --filter=web`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix "apps/web/src/app/(public)/membership" "apps/web/src/app/(public)/shop/membership" packages/i18n/messages
git add apps/web packages/i18n
git commit -m "Add the membership purchase page and wizard

Gates on sign-in, BI account link, and Azure directory record before offering
plans, captures campus explicitly, and routes to Vipps or card. /shop/membership
now redirects here so existing CTAs keep working."
```

---

## Task 17: Membership fulfilment

**Files:**
- Create: `packages/shared/utils/membership-fulfilment.ts`
- Test: `packages/shared/utils/membership-fulfilment.test.ts`

**Interfaces:**
- Consumes: `upsertMembershipCustomer`, `assignMembershipCategory`, `postMembershipInvoice` (Tasks 4, 7); `buildMembershipInvoiceOrder` (Task 6); `toMembershipPlan` (Task 3); `parseOrderItems` from `./order-parsing`; `DbClient` from `./vipps-order-ops`.
- Produces:
  - `type MembershipOrder = Orders & { membership_fulfilment_lock?: number | null; membership_invoice_id?: string | null }`
  - `interface MembershipFulfilmentResult { fulfilled: boolean; invoiceId?: number; reason?: "already_fulfilled" | "claimed_elsewhere" | "not_found" | "not_membership" | "not_paid" | "missing_identity" | "plan_unavailable" | "finago_failed" }`
  - `isMembershipOrder(order: { items_json?: string | null }): boolean`
  - `fulfilMembershipOrder(orderId: string, db: DbClient): Promise<MembershipFulfilmentResult>`
  - `releaseStaleMembershipClaim(order: MembershipOrder, db: DbClient, now?: number): Promise<boolean>`

Idempotency exactly mirrors `postFinagoTransactionForOrder` (`packages/shared/utils/finago-order-posting.ts:108-241`): claim, marker before the external call, release only on pre-side-effect failure.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertMembershipCustomer = vi.hoisted(() => vi.fn());
const assignMembershipCategory = vi.hoisted(() => vi.fn());
const postMembershipInvoice = vi.hoisted(() => vi.fn());

vi.mock("@repo/connectors/24sevenoffice", () => ({
  assignMembershipCategory,
  postMembershipInvoice,
  upsertMembershipCustomer,
}));

import { fulfilMembershipOrder, isMembershipOrder } from "./membership-fulfilment";

const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
  incrementRowColumn: vi.fn(),
  decrementRowColumn: vi.fn(),
};

const MEMBERSHIP_ITEMS = JSON.stringify([
  {
    product_id: "71",
    product_type: "membership",
    membership_id: "71",
    quantity: 1,
    unit_price: 550,
  },
]);

function paidMembershipOrder(overrides: Record<string, unknown> = {}) {
  return {
    $id: "order-1",
    $updatedAt: new Date().toISOString(),
    status: "paid",
    total: 550,
    campus_id: "2",
    userId: "user-1",
    buyer_email: "student@example.com",
    buyer_name: "Ola Nordmann",
    items_json: MEMBERSHIP_ITEMS,
    membership_invoice_id: null,
    membership_fulfilment_lock: 0,
    ...overrides,
  };
}

const profile = {
  $id: "user-1",
  student_id: "s1715738",
  bi_employee_id: "9001234",
};

const planRow = {
  $id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  membership_id: "71",
  category: "113178",
  price: 550,
  status: true,
  canPurchase: true,
  startDate: "2026-08-01",
  expiryDate: "2027-06-30",
};

function wireReads(order: Record<string, unknown>) {
  db.getRow.mockImplementation((_dbId: string, table: string, id: string) => {
    if (table === "orders") {
      return Promise.resolve(order);
    }
    if (table === "user") {
      return Promise.resolve(profile);
    }
    if (table === "memberships") {
      return Promise.resolve(planRow);
    }
    return Promise.reject(new Error(`unexpected read ${table}/${id}`));
  });
}

describe("isMembershipOrder", () => {
  it("detects the membership marker", () => {
    expect(isMembershipOrder({ items_json: MEMBERSHIP_ITEMS })).toBe(true);
  });

  it("rejects a normal shop order", () => {
    expect(
      isMembershipOrder({
        items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
      })
    ).toBe(false);
  });

  it("rejects an empty order", () => {
    expect(isMembershipOrder({ items_json: null })).toBe(false);
  });
});

describe("fulfilMembershipOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.incrementRowColumn.mockResolvedValue({ membership_fulfilment_lock: 1 });
    db.updateRow.mockResolvedValue({});
    upsertMembershipCustomer.mockResolvedValue(9_001_234);
    assignMembershipCategory.mockResolvedValue(undefined);
    postMembershipInvoice.mockResolvedValue(556_677);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates the customer, assigns the category, and invoices", async () => {
    wireReads(paidMembershipOrder());

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: true, invoiceId: 556_677 });
    expect(upsertMembershipCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 9_001_234, studentNumber: 1_715_738 })
    );
    expect(assignMembershipCategory).toHaveBeenCalledWith(9_001_234, 113_178);
    expect(postMembershipInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        CustomerId: 9_001_234,
        DepartmentId: 300,
        AccrualLength: 12,
      })
    );
    expect(db.updateRow).toHaveBeenLastCalledWith(
      expect.any(String),
      "orders",
      "order-1",
      { membership_invoice_id: "556677" }
    );
  });

  it("skips an order that is not a membership", async () => {
    wireReads(
      paidMembershipOrder({
        items_json: JSON.stringify([{ product_id: "x", quantity: 1 }]),
      })
    );
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "not_membership" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("skips an unpaid order", async () => {
    wireReads(paidMembershipOrder({ status: "pending" }));
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "not_paid" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("skips an order that already has an invoice", async () => {
    wireReads(paidMembershipOrder({ membership_invoice_id: "556677" }));
    const result = await fulfilMembershipOrder("order-1", db);
    expect(result).toEqual({ fulfilled: false, reason: "already_fulfilled" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
  });

  it("stands down when another caller holds the claim", async () => {
    wireReads(paidMembershipOrder());
    db.incrementRowColumn.mockResolvedValue({ membership_fulfilment_lock: 2 });

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "claimed_elsewhere" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
    expect(db.decrementRowColumn).toHaveBeenCalled();
  });

  it("refuses when the buyer has no employee id", async () => {
    db.getRow.mockImplementation((_dbId: string, table: string) => {
      if (table === "orders") {
        return Promise.resolve(paidMembershipOrder());
      }
      if (table === "user") {
        return Promise.resolve({ ...profile, bi_employee_id: null });
      }
      return Promise.resolve(planRow);
    });

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "missing_identity" });
    expect(postMembershipInvoice).not.toHaveBeenCalled();
    // Claim released: this failed before any Finago side effect.
    expect(db.decrementRowColumn).toHaveBeenCalled();
  });

  it("keeps the marker and does not release when Finago already ran", async () => {
    wireReads(paidMembershipOrder());
    postMembershipInvoice.mockRejectedValue(new Error("timeout"));

    const result = await fulfilMembershipOrder("order-1", db);

    expect(result).toEqual({ fulfilled: false, reason: "finago_failed" });
    // The invoice may exist upstream; never auto-retry.
    expect(db.decrementRowColumn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/membership-fulfilment.test.ts`
Expected: FAIL — `Failed to resolve import "./membership-fulfilment"`

- [ ] **Step 3: Write the implementation**

```ts
import type { Memberships, Orders, Users } from "@repo/api/types/appwrite";
import {
  assignMembershipCategory,
  postMembershipInvoice,
  upsertMembershipCustomer,
} from "@repo/connectors/24sevenoffice";
import { sanitizeStudentNumber } from "./bi-student";
import { buildMembershipInvoiceOrder } from "./finago-membership-invoice";
import { toMembershipPlan } from "./membership-plans";
import { parseOrderItems } from "./order-parsing";
import type { DbClient } from "./vipps-order-ops";

// Pending an `appwrite push tables`; extend locally until the generated types
// are regenerated.
export type MembershipOrder = Orders & {
  membership_fulfilment_lock?: number | null;
  membership_invoice_id?: string | null;
};

type BiUser = Users & { bi_employee_id?: string | null };

export interface MembershipFulfilmentResult {
  fulfilled: boolean;
  invoiceId?: number;
  reason?:
    | "already_fulfilled"
    | "claimed_elsewhere"
    | "not_found"
    | "not_membership"
    | "not_paid"
    | "missing_identity"
    | "plan_unavailable"
    | "finago_failed";
}

const FULFILLABLE_STATUSES = new Set(["authorized", "paid"]);

// Written before the first Finago call and overwritten with the real invoice
// id on success. While set, no automatic path may fulfil this order again — a
// retry after a partial failure could double-invoice a student.
const FULFILMENT_MARKER = "fulfilling";
const WHITESPACE_RE = /\s+/;

function tables() {
  return {
    dbId: process.env.APPWRITE_DATABASE_ID ?? "app",
    ordersId: process.env.APPWRITE_ORDERS_COLLECTION_ID ?? "orders",
  };
}

export function isMembershipOrder(order: {
  items_json?: string | null;
}): boolean {
  return parseOrderItems(order.items_json ?? null).some(
    (item) =>
      (item as { product_type?: string }).product_type === "membership"
  );
}

async function releaseClaim(orderId: string, db: DbClient): Promise<void> {
  const { dbId, ordersId } = tables();
  if (!db.decrementRowColumn) {
    return;
  }
  await db
    .decrementRowColumn({
      databaseId: dbId,
      tableId: ordersId,
      rowId: orderId,
      column: "membership_fulfilment_lock",
      value: 1,
      min: 0,
    })
    .catch(() => {
      // The stale-claim sweep recovers the lock.
    });
}

function splitName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(WHITESPACE_RE).filter(Boolean);
  return {
    firstName: parts[0] ?? "Student",
    lastName: parts.slice(1).join(" ") || "Member",
  };
}

/**
 * Registers a paid membership purchase in Finago exactly once: customer,
 * category, invoice.
 *
 * Called from the payment webhook, the browser return route, and the
 * reconciliation cron — whichever sees the paid order first wins the atomic
 * claim and the others stand down.
 */
export async function fulfilMembershipOrder(
  orderId: string,
  db: DbClient
): Promise<MembershipFulfilmentResult> {
  const { dbId, ordersId } = tables();

  const order = (await db
    .getRow(dbId, ordersId, orderId)
    .catch(() => null)) as MembershipOrder | null;
  if (!order) {
    return { fulfilled: false, reason: "not_found" };
  }
  if (!isMembershipOrder(order)) {
    return { fulfilled: false, reason: "not_membership" };
  }
  if (!FULFILLABLE_STATUSES.has(order.status ?? "")) {
    return { fulfilled: false, reason: "not_paid" };
  }
  if (order.membership_invoice_id) {
    return { fulfilled: false, reason: "already_fulfilled" };
  }

  if (db.incrementRowColumn) {
    try {
      const claimed = await db.incrementRowColumn<Record<string, unknown>>({
        databaseId: dbId,
        tableId: ordersId,
        rowId: orderId,
        column: "membership_fulfilment_lock",
        value: 1,
      });
      const lockValue =
        typeof claimed?.membership_fulfilment_lock === "number"
          ? claimed.membership_fulfilment_lock
          : 0;
      if (lockValue !== 1) {
        await releaseClaim(orderId, db);
        return { fulfilled: false, reason: "claimed_elsewhere" };
      }
    } catch (error) {
      console.warn(
        `[Membership] Atomic claim failed for order ${orderId}; proceeding best-effort:`,
        error
      );
    }
  }

  // Everything below, up to the marker write, happens before any Finago side
  // effect — so a failure here safely releases the claim for a later retry.
  const item = parseOrderItems(order.items_json ?? null).find(
    (candidate) =>
      (candidate as { product_type?: string }).product_type === "membership"
  ) as { product_id?: string } | undefined;

  const profile = (await db
    .getRow(dbId, "user", order.userId ?? "")
    .catch(() => null)) as BiUser | null;
  const studentNumber = sanitizeStudentNumber(profile?.student_id);
  const employeeId = sanitizeStudentNumber(profile?.bi_employee_id);

  if (studentNumber === null || employeeId === null) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Order ${orderId} has no usable BI identity; manual follow-up required.`
    );
    return { fulfilled: false, reason: "missing_identity" };
  }

  const planRow = (await db
    .getRow(dbId, "memberships", item?.product_id ?? "")
    .catch(() => null)) as Memberships | null;
  const plan = planRow ? toMembershipPlan(planRow) : null;
  const campusId = order.campus_id;

  if (!(plan && campusId)) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Order ${orderId} references an unavailable plan or campus.`
    );
    return { fulfilled: false, reason: "plan_unavailable" };
  }

  let invoicePayload: ReturnType<typeof buildMembershipInvoiceOrder>;
  try {
    invoicePayload = buildMembershipInvoiceOrder({
      campusId,
      customerId: employeeId,
      plan,
      invoicedOn: new Date().toISOString().slice(0, 10),
    });
    await db.updateRow(dbId, ordersId, orderId, {
      membership_invoice_id: FULFILMENT_MARKER,
    });
  } catch (error) {
    await releaseClaim(orderId, db);
    console.error(
      `[Membership] Failed to prepare fulfilment for order ${orderId}:`,
      error
    );
    return { fulfilled: false, reason: "finago_failed" };
  }

  // From here the marker stays put whatever happens: a failure may still have
  // created the customer, category, or invoice upstream.
  try {
    const { firstName, lastName } = splitName(order.buyer_name);
    const customerId = await upsertMembershipCustomer({
      employeeId,
      studentNumber,
      firstName,
      lastName,
      email: order.buyer_email ?? undefined,
    });

    await assignMembershipCategory(customerId, plan.categoryId);

    const invoiceId = await postMembershipInvoice({
      ...invoicePayload,
      CustomerId: customerId,
    });

    await db.updateRow(dbId, ordersId, orderId, {
      membership_invoice_id: String(invoiceId),
    });

    console.log(
      `[Membership] Fulfilled order ${orderId} as invoice ${invoiceId} for customer ${customerId}`
    );
    return { fulfilled: true, invoiceId };
  } catch (error) {
    console.error(
      `[Membership] Fulfilment attempted for order ${orderId}; leaving marker for manual recovery:`,
      error
    );
    return { fulfilled: false, reason: "finago_failed" };
  }
}

const STALE_CLAIM_MS = 30 * 60 * 1000;

/**
 * Recovers a claim taken but never completed (process died between claim and
 * marker). Reconciliation sweep only.
 */
export async function releaseStaleMembershipClaim(
  order: MembershipOrder,
  db: DbClient,
  now: number = Date.now()
): Promise<boolean> {
  const lockValue = order.membership_fulfilment_lock ?? 0;
  if (lockValue <= 0 || order.membership_invoice_id) {
    return false;
  }

  const updatedAt = Date.parse(order.$updatedAt);
  if (Number.isNaN(updatedAt) || now - updatedAt < STALE_CLAIM_MS) {
    return false;
  }

  const { dbId, ordersId } = tables();
  console.warn(
    `[Membership] Releasing stale fulfilment claim on order ${order.$id} (lock: ${lockValue})`
  );
  await db.updateRow(dbId, ordersId, order.$id, {
    membership_fulfilment_lock: 0,
  });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/membership-fulfilment.test.ts`
Expected: PASS, 10 tests

- [ ] **Step 5: Verify types**

Run: `bun run check-types --filter=@repo/shared`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
bun x ultracite fix packages/shared/utils/membership-fulfilment.ts packages/shared/utils/membership-fulfilment.test.ts
git add packages/shared
git commit -m "Register paid memberships in Finago exactly once

Claim-locked customer, category, and invoice fulfilment mirroring the ledger
posting pattern: the marker is written before the first Finago call and is
never cleared after it, so a partial failure is surfaced for manual recovery
rather than risking a double invoice."
```

---

## Task 18: Wire fulfilment into the three settlement paths

**Files:**
- Modify: `packages/shared/utils/finago-order-posting.ts:108-127`
- Modify: `apps/api/src/app/api/payment/[provider]/callback/route.ts:36-52`
- Modify: `apps/web/src/app/api/checkout/return/route.ts:120-130`
- Modify: `apps/web/src/app/api/cron/reconcile-orders/route.ts`

**Interfaces:**
- Consumes: `fulfilMembershipOrder`, `isMembershipOrder`, `releaseStaleMembershipClaim` (Task 17).
- Produces: no new exports.

- [ ] **Step 1: Write the failing test for ledger exclusion**

Append to `packages/shared/utils/finago-order-posting.test.ts`:

```ts
it("skips membership orders so revenue is not booked twice", async () => {
  db.getRow.mockResolvedValue(
    paidOrder({
      items_json: JSON.stringify([
        { product_id: "71", product_type: "membership", quantity: 1, unit_price: 550 },
      ]),
    })
  );

  const result = await postFinagoTransactionForOrder("order-1", db);

  expect(result).toEqual({ posted: false, reason: "membership_order" });
  expect(postShopTransaction).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/shared && bun x vitest run utils/finago-order-posting.test.ts`
Expected: FAIL — received `{ posted: true, transactionId: … }`

- [ ] **Step 3: Exclude membership orders from ledger posting**

In `packages/shared/utils/finago-order-posting.ts`, add `"membership_order"` to the `reason` union on `FinagoPostingResult`, import `isMembershipOrder` from `./membership-fulfilment`, and insert directly after the `not_paid` check (line 122):

```ts
  // Memberships are booked as a 24SO invoice by fulfilMembershipOrder, not as a
  // shop ledger transaction. Posting both would record the same revenue twice.
  if (isMembershipOrder(order)) {
    return { posted: false, reason: "membership_order" };
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd packages/shared && bun x vitest run utils/finago-order-posting.test.ts`
Expected: PASS, all tests

- [ ] **Step 5: Trigger fulfilment from the payment webhook**

In `apps/api/src/app/api/payment/[provider]/callback/route.ts`, rename `postFinagoIfPaid` to `settleFinagoIfPaid` and replace its body:

```ts
async function settleFinagoIfPaid(orderId: string, db: CallbackDb) {
  try {
    const order = (await db.getRow("app", "orders", orderId)) as {
      items_json?: string | null;
      status?: string;
    } | null;
    if (!(order?.status === "paid" || order?.status === "authorized")) {
      return;
    }
    if (isMembershipOrder(order)) {
      await fulfilMembershipOrder(orderId, db);
      return;
    }
    await postFinagoTransactionForOrder(orderId, db);
  } catch (error) {
    console.error(
      `[payment/callback] Finago settlement failed for ${orderId}:`,
      error
    );
  }
}
```

with `import { fulfilMembershipOrder, isMembershipOrder } from "@repo/shared/utils/membership-fulfilment";`. Update both call sites (the Vipps handler and the Stripe handler — search the file for `postFinagoIfPaid`).

- [ ] **Step 6: Trigger fulfilment from the return route**

In `apps/web/src/app/api/checkout/return/route.ts`, replace the posting block:

```ts
    if (status === "authorized" || status === "paid") {
      if (isMembershipOrder(updatedOrder ?? order)) {
        await fulfilMembershipOrder(orderId, db);
      } else {
        await postFinagoTransactionForOrder(orderId, db);
      }
    }
```

and redirect membership orders to the member portal rather than the shop confirmation — check what `redirectForStatus` does first and add a membership branch only if its shop-specific paths would be wrong for a membership buyer.

- [ ] **Step 7: Recover unfulfilled membership orders in the cron**

In `apps/web/src/app/api/cron/reconcile-orders/route.ts`, add a second sweep alongside the Finago one, using the same guards:

```ts
async function recoverMembershipFulfilment(db: ReconcileDb) {
  let fulfilled = 0;
  let released = 0;
  let errors = 0;

  const orders = await db.listRows<MembershipOrder>("app", "orders", [
    Query.equal("status", ["paid", "authorized"]),
    Query.isNull("membership_invoice_id"),
    Query.lessThan("$createdAt", cutoffIso()),
    Query.limit(SWEEP_LIMIT),
  ]);

  for (const order of orders.rows) {
    if (!isMembershipOrder(order)) {
      continue;
    }
    try {
      if (await releaseStaleMembershipClaim(order, db)) {
        released += 1;
        continue;
      }
      if ((order.membership_fulfilment_lock ?? 0) > 0) {
        // Live claim held by an active fulfiller. Probing it would refresh
        // $updatedAt every sweep and prevent a crashed claim ever ageing out.
        continue;
      }
      const result = await fulfilMembershipOrder(order.$id, db);
      if (result.fulfilled) {
        fulfilled += 1;
      } else if (result.reason === "finago_failed") {
        errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error(
        `[Reconcile Orders] Membership recovery failed for ${order.$id}:`,
        error
      );
    }
  }

  return { fulfilled, released, errors };
}
```

Call it from the handler and include its counts in the JSON response, matching the existing response shape. Read the file first to match `ReconcileDb`, `cutoffIso`, and `SWEEP_LIMIT` exactly as they are named there.

- [ ] **Step 8: Verify types and full test suite**

Run: `bun run check-types`
Expected: PASS

Run: `bun run test`
Expected: PASS across `@repo/shared`, `web`, `api`

- [ ] **Step 9: Commit**

```bash
bun x ultracite fix packages/shared/utils/finago-order-posting.ts "apps/api/src/app/api/payment/[provider]/callback/route.ts" apps/web/src/app/api/checkout/return/route.ts apps/web/src/app/api/cron/reconcile-orders/route.ts
git add packages apps
git commit -m "Fulfil membership orders from all three settlement paths

Webhook, return route, and reconciliation cron each attempt fulfilment; the
atomic claim keeps it to one. Membership orders are excluded from shop ledger
posting so the same revenue is never recorded twice."
```

---

## Task 19: End-to-end verification and documentation

**Files:**
- Modify: `apps/web/CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-08-12-membership-purchase-design.md` (owner actions checklist only)

- [ ] **Step 1: Confirm every membership CTA resolves**

Run: `grep -rn "shop/membership\|/membership/join" --include="*.tsx" --include="*.ts" apps/web/src | grep -v node_modules`

Every hit must land on either `/shop/membership` (redirects) or `/membership/join`. Fix any that point elsewhere.

- [ ] **Step 2: Full gate**

Run: `bun run check-types`
Expected: PASS

Run: `bun run lint`
Expected: PASS

Run: `bun run test`
Expected: PASS

Run: `bun run build --filter=web --filter=api`
Expected: PASS — this is the only check that catches a `"use server"` module exporting a non-async value.

- [ ] **Step 3: Document the flow**

Add to `apps/web/CLAUDE.md` under "Third-party integrations":

```markdown
- Membership purchase → `/membership/join`. Requires an authenticated user with
  a linked BI Student (OIDC) identity whose profile carries `student_id` and
  `bi_employee_id` (populated by `syncBiStudentIdentity` on the OAuth return
  leg). Plans come from the `memberships` table; the trusted checkout lives in
  `apps/api` at `/api/payment/[provider]/membership-checkout`. Fulfilment
  (Finago customer → category → invoice) is `fulfilMembershipOrder` in
  `@repo/shared/utils/membership-fulfilment`, triggered from the payment
  webhook, `/api/checkout/return`, and the reconcile cron. Membership orders are
  excluded from `postFinagoTransactionForOrder`. Env: `BI_AZURE_*`.
```

- [ ] **Step 4: Commit**

```bash
bun x ultracite fix apps/web/CLAUDE.md
git add apps/web/CLAUDE.md docs/superpowers/specs/2026-08-12-membership-purchase-design.md
git commit -m "Document the membership purchase flow"
```

- [ ] **Step 5: Hand the owner actions back**

Report to the owner, from the spec's "Owner actions" section:

1. Create the BI-tenant app registration credentials; set `BI_AZURE_TENANT_ID`, `BI_AZURE_CLIENT_ID`, `BI_AZURE_CLIENT_SECRET` in `apps/web` and `apps/api`.
2. Grant `User.Read.All` with admin consent in BI's tenant; confirm `employeeId` is populated for students.
3. `appwrite push tables`, then `appwrite types -l ts ./types`. **Until this runs, the five new columns do not exist and the flow will fail at the first write.**
4. Set `price` and `canPurchase` on the three `memberships` rows.
5. Verify against a Finago test customer that the invoice is indistinguishable from one the BI app produces — in particular `ProductId`, `DepartmentId`, both dimension pairs, and the accrual.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: schema → 1; env → 1, 8; identity enrichment → 2, 8, 9; catalog → 3, 5, 12; purchase route → 13, 16; checkout endpoint → 14, 15; fulfilment → 6, 7, 17, 18; consolidation → 10, 11; defects → 4, 7; error handling → distributed across 9, 13, 14, 15, 17; testing → each task's test steps; owner actions → 19.

**Known gaps carried deliberately.** The wizard (Task 16 Step 3) and the `membership-status-card` rewrite (Task 11 Step 4) are specified by behaviour and interface rather than by literal code, because both must be shaped around existing components the implementer has to read first. Both steps name the exact file, the exact props, and the exact constraints. Task 18 Steps 6-7 likewise instruct reading `redirectForStatus` and the cron's local helpers before editing, since their internals are not reproduced here.

**Type consistency.** `MembershipPlan` fields are identical in Tasks 3, 6, 12, 13, 15, 17. `sanitizeStudentNumber` returns `number | null` and every caller null-checks. `assignMembershipCategory(companyId: number, categoryId: number)` is numeric from Task 4 onward, matching Task 17's call. `postMembershipInvoice` returns `number`, stored as `String(invoiceId)`. `isMembershipOrder` takes `{ items_json?: string | null }` in both Task 17 and Task 18.
