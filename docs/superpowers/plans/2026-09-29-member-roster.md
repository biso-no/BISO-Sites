# Member Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin `/members` user list with the paid-member roster from 24SevenOffice, synced into an Appwrite table by a new Appwrite Function.

**Architecture:** A workspace Appwrite Function (`functions/member-roster-sync`) imports `@repo/connectors` + `@repo/api`, pulls the customer-category tree, company names/emails and membership invoices (for the campus dimension), and replaces `app.member_roster`. The admin page reads that table with the standard campus scoping, reads run status from the function's own executions, and can trigger an async execution.

**Tech Stack:** Bun, TypeScript, `soap` (24SO SOAP), `node-appwrite` 29 (TablesDB, Functions), Next.js 16 App Router, next-intl, `bun:test`.

**Spec:** `docs/superpowers/specs/2026-09-29-member-roster-design.md`

## Global Constraints

- Bun only (`bun@1.3.1`); never npm/pnpm.
- App code imports Appwrite only via `@repo/api` / `@repo/api/server`, never `appwrite`/`node-appwrite` directly (the function counts as app code).
- Function schedule, execution timeout, and deployment are managed in the Appwrite console. Do **not** add the function to `packages/api/appwrite.config.json`.
- Campus id comes from the invoice `UserDefinedDimension` with `TypeId` 101; its `Value` is the Appwrite campus `$id`. Never use `DepartmentId`.
- Only current members are listed (plan `expiryDate` >= today).
- Pagination uses the admin-wide `parseListParams`/`PaginationBar` (default 25, selectable 25/50/100) rather than the spec's fixed 50, to match every other list.
- Campus admins see only rows with `campus_id` in their managed campuses; global admins see all (incl. `campus_id` null), or their active-campus filter.
- An empty tree result must never wipe the roster.
- Run `bun x ultracite fix` before each commit; `bun run check-types` must pass at the end.
- Do not commit `.vscode/settings.json` (user's unrelated local change) — stage files explicitly, never `git commit -a`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **A customer holding two active categories** (e.g. a full-year plan and a semester plan) → one row, with the plan that expires latest. Test in Task 4.
2. **Invoice with the campus dimension only on the row, not the order**, or dimensions as a single object instead of an array (XML → JSON shape) → campus still found. Test in Task 3.
3. **Campus dimension value not in the `campus` table** (typo, legacy "0") → `campus_id` null, so only global admins see it; never leaks to a campus admin under a bogus id. Test in Task 4.
4. **A customer in the tree that `GetCompanies` doesn't return** (deleted/merged customer) → row still written with an empty name rather than dropped or crashing. Test in Task 4.
5. **"Refresh now" clicked while a run is already waiting/processing** → no second execution is created. Test in Task 7.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/connectors/src/24sevenoffice/categories.ts` (modify) | `getCustomerCategoryTree` gains a per-call timeout option |
| `packages/connectors/src/24sevenoffice/company.ts` (modify) | `getCompaniesByIds` batched via `CompanyIds` |
| `packages/connectors/src/24sevenoffice/types.ts` (modify) | `CompanySearchParams.CompanyIds` shape |
| `packages/connectors/src/24sevenoffice/membership-invoices.ts` (create) | `parseMembershipInvoiceLines` (pure) + `getMembershipInvoices` (batched SOAP) |
| `packages/connectors/src/24sevenoffice/*.test.ts` (create) | tests for the above |
| `packages/connectors/src/24sevenoffice/index.ts` (modify) | exports |
| `packages/api/appwrite.config.json` (modify) | `member_roster` table |
| `packages/api/types/appwrite.ts` (regenerated) | `MemberRoster` row type |
| `functions/member-roster-sync/` (create) | package.json, tsconfig, README, `src/roster.ts` (pure), `src/roster.test.ts`, `src/main.ts` |
| `apps/admin/src/lib/member-roster-status.ts` (create) | pure execution → status summary |
| `apps/admin/src/app/(portal)/_actions/members.ts` (rewrite) | `listRosterMembers`, `getRosterStatus`, `refreshMemberRoster` |
| `apps/admin/src/app/(portal)/members/page.tsx` (modify) | page wiring |
| `apps/admin/src/app/(portal)/members/_components/members-list-client.tsx` (modify) | roster list |
| `apps/admin/src/app/(portal)/members/_components/roster-refresh.tsx` (create) | status line + refresh button |
| `apps/admin/src/app/(portal)/members/[userId]/page.tsx` (delete) | orphaned detail page |
| `packages/i18n/messages/{en,no}/adminPortal.json` (modify) | copy |
| `turbo.json` (modify) | `MEMBER_ROSTER_FUNCTION_ID` in build env |

---

### Task 1: Live probe of the 24SO batch calls (spike, throwaway)

`company.ts:186` claims "the API doesn't support batch lookup well via CompanyIds". Settle how `CompanyIds` and `CustomerIds` must be serialised before anything depends on them. Nothing from this task is committed.

**Files:**
- Create (scratch, not committed): `functions/_probe-24so.ts`

**Interfaces:**
- Produces: the confirmed serialisation for id arrays (expected `{ int: number[] }`), and the confirmed max batch size for `GetInvoices.CustomerIds`. Record both in the Task 2/3 code comments.

- [ ] **Step 1: Write the probe**

```ts
// functions/_probe-24so.ts — throwaway, delete after running
import { getValidSession } from "@repo/connectors/24sevenoffice";
import { createAuthenticatedClient } from "../packages/connectors/src/24sevenoffice/client";

const session = await getValidSession();
const company = await createAuthenticatedClient("company", session);
const ids = [3975, 3976, 3977]; // replace with real ids from Postman's tree output

const [companies] = await company.GetCompaniesAsync({
  searchParams: { CompanyIds: { int: ids } },
  returnProperties: { string: ["Id", "Name", "EmailAddresses"] },
});
console.log("GetCompanies {int:[]}", JSON.stringify(companies, null, 1).slice(0, 1500));

const invoice = await createAuthenticatedClient("invoice", session);
const [invoices] = await invoice.GetInvoicesAsync({
  searchParams: { CustomerIds: { int: ids } },
  invoiceReturnProperties: {
    string: ["CustomerId", "DateInvoiced", "UserDefinedDimensions", "InvoiceRows"],
  },
  rowReturnProperties: { string: ["ProductId"] },
});
console.log("GetInvoices", JSON.stringify(invoices, null, 1).slice(0, 3000));
```

- [ ] **Step 2: Run it with admin env loaded**

Run (from repo root): `bun --env-file=apps/admin/.env.local functions/_probe-24so.ts`
Expected: both calls return records for more than one id. If `{ int: ids }` returns nothing or errors, retry with `CompanyIds: ids` and note which works. Then try `GetInvoices` with 1000 real ids (copy from Postman) to confirm the batch size is accepted; if rejected, halve until it works and record the limit.

- [ ] **Step 3: Delete the probe and record findings**

Run: `rm functions/_probe-24so.ts`
Report to the user: working serialisation, `GetInvoices` batch limit, and whether `UserDefinedDimensions` came back on the order, the rows, or both. If batching does not work at all, stop and ask the user before continuing.

---

### Task 2: Connector — long tree timeout and batched company lookup

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/categories.ts:250-291`
- Modify: `packages/connectors/src/24sevenoffice/company.ts:181-235`
- Modify: `packages/connectors/src/24sevenoffice/types.ts:103`
- Test: `packages/connectors/src/24sevenoffice/company-batch.test.ts`, `packages/connectors/src/24sevenoffice/category-tree.test.ts`

**Interfaces:**
- Produces:
  - `getCustomerCategoryTree(options?: { timeoutMs?: number }): Promise<CustomerCategoryMapping[]>` (`CustomerCategoryMapping = { categoryId: number; companyId: number }`)
  - `getCompaniesByIds(companyIds: number[]): Promise<Company[]>` — throws if any batch fails.
  - `COMPANY_ID_BATCH_SIZE = 1000` (exported from `company.ts`)

- [ ] **Step 1: Write the failing tests**

```ts
// packages/connectors/src/24sevenoffice/company-batch.test.ts
import { beforeEach, expect, mock, test } from "bun:test";

const GetCompaniesAsync = mock();

mock.module("./auth", () => ({ getValidSession: async () => "session-token" }));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({ GetCompaniesAsync }),
}));

const { COMPANY_ID_BATCH_SIZE, getCompaniesByIds } = await import("./company");

beforeEach(() => GetCompaniesAsync.mockReset());

test("looks companies up in batches via CompanyIds", async () => {
  const ids = Array.from({ length: COMPANY_ID_BATCH_SIZE + 5 }, (_, i) => i + 1);
  GetCompaniesAsync.mockImplementation(async (args) => [
    {
      GetCompaniesResult: {
        Company: args.searchParams.CompanyIds.int.map((id: number) => ({ Id: id, Name: `C${id}` })),
      },
    },
  ]);

  const companies = await getCompaniesByIds(ids);

  expect(GetCompaniesAsync).toHaveBeenCalledTimes(2);
  expect(GetCompaniesAsync.mock.calls[0][0].searchParams.CompanyIds.int).toHaveLength(COMPANY_ID_BATCH_SIZE);
  expect(GetCompaniesAsync.mock.calls[1][0].searchParams.CompanyIds.int).toEqual([1001, 1002, 1003, 1004, 1005]);
  expect(companies).toHaveLength(ids.length);
});

test("normalises a single-company response", async () => {
  GetCompaniesAsync.mockResolvedValue([{ GetCompaniesResult: { Company: { Id: 7, Name: "Solo" } } }]);
  expect(await getCompaniesByIds([7])).toEqual([{ Id: 7, Name: "Solo" }]);
});

test("rethrows a failed batch instead of returning partial results", async () => {
  GetCompaniesAsync.mockRejectedValue(new Error("boom"));
  await expect(getCompaniesByIds([1])).rejects.toThrow("boom");
});

test("returns [] without calling 24SO for no ids", async () => {
  expect(await getCompaniesByIds([])).toEqual([]);
  expect(GetCompaniesAsync).not.toHaveBeenCalled();
});
```

```ts
// packages/connectors/src/24sevenoffice/category-tree.test.ts
import { expect, mock, test } from "bun:test";

const GetCustomerCategoryTreeAsync = mock(async () => [
  {
    GetCustomerCategoryTreeResult: {
      KeyValuePair: [
        { Key: "10", Value: "3975" },
        { Key: "x", Value: "1" },
      ],
    },
  },
]);

mock.module("./auth", () => ({ getValidSession: async () => "session-token" }));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({ GetCustomerCategoryTreeAsync }),
}));

const { getCustomerCategoryTree } = await import("./categories");

test("passes a per-call timeout through to the SOAP request", async () => {
  const pairs = await getCustomerCategoryTree({ timeoutMs: 180_000 });
  expect(GetCustomerCategoryTreeAsync).toHaveBeenCalledWith({}, { timeout: 180_000 });
  expect(pairs).toEqual([{ categoryId: 10, companyId: 3975 }]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/connectors && bun test src/24sevenoffice/company-batch.test.ts src/24sevenoffice/category-tree.test.ts`
Expected: FAIL — `COMPANY_ID_BATCH_SIZE` is undefined; tree called with `({})` only.

- [ ] **Step 3: Implement**

In `types.ts`, change line 103 (use the serialisation confirmed in Task 1; `{ int }` shown):

```ts
  // SOAP ArrayOfInt: serialises as <CompanyIds><int>1</int>…</CompanyIds>.
  CompanyIds?: { int: number[] };
```

In `categories.ts`, replace the `getCustomerCategoryTree` signature and call:

```ts
export async function getCustomerCategoryTree(options?: {
  /**
   * Per-request HTTP timeout. The tree is unpaginated and takes ~70s, far
   * past the client's 15s default, so the roster sync passes a longer one.
   * `soap` merges these options into the axios request config.
   */
  timeoutMs?: number;
}): Promise<CustomerCategoryMapping[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCustomerCategoryTreeResult] =
      await client.GetCustomerCategoryTreeAsync(
        {},
        options?.timeoutMs ? { timeout: options.timeoutMs } : undefined
      );
```

(The rest of the function body is unchanged. Note the existing test expects the second argument to be exactly `{ timeout: 180_000 }`.)

In `company.ts`, replace the whole `getCompaniesByIds` function (doc comment included) with:

```ts
/** `GetCompanies` accepts up to 1000 ids per `CompanyIds` search. */
export const COMPANY_ID_BATCH_SIZE = 1000;

/**
 * Get companies by id, 1000 per request. A failed batch throws rather than
 * being skipped: the roster sync would otherwise silently lose names.
 */
export async function getCompaniesByIds(
  companyIds: number[]
): Promise<Company[]> {
  if (companyIds.length === 0) {
    return [];
  }

  const session = await getValidSession();
  const allCompanies: Company[] = [];

  for (let i = 0; i < companyIds.length; i += COMPANY_ID_BATCH_SIZE) {
    const batch = companyIds.slice(i, i + COMPANY_ID_BATCH_SIZE);
    const companies = await getCompanies(
      session,
      { CompanyIds: { int: batch } },
      { throwOnError: true }
    );
    allCompanies.push(...companies);
  }

  return allCompanies;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/connectors && bun test src/24sevenoffice`
Expected: PASS (new tests and the existing `company.test.ts`, `tax-codes.test.ts`).

- [ ] **Step 5: Type-check and commit**

```bash
cd packages/connectors && bun run check-types && cd ../..
bun x ultracite fix packages/connectors/src/24sevenoffice
git add packages/connectors/src/24sevenoffice/{categories,company,types}.ts packages/connectors/src/24sevenoffice/{company-batch,category-tree}.test.ts
git commit -m "feat(24so): batched company lookup and long tree timeout

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Connector — membership invoice lines with campus

**Files:**
- Create: `packages/connectors/src/24sevenoffice/membership-invoices.ts`
- Modify: `packages/connectors/src/24sevenoffice/index.ts`
- Test: `packages/connectors/src/24sevenoffice/membership-invoices.test.ts`

**Interfaces:**
- Produces:
  - `interface MembershipInvoiceLine { campusId: string | null; customerId: number; invoicedAt: string | null; productId: number }`
  - `parseMembershipInvoiceLines(result: GetInvoicesResponse, productIds: ReadonlySet<number>): MembershipInvoiceLine[]` (pure)
  - `getMembershipInvoices(customerIds: number[], productIds: ReadonlySet<number>, options?: { timeoutMs?: number }): Promise<MembershipInvoiceLine[]>`
  - `CUSTOMER_ID_BATCH_SIZE` (value confirmed in Task 1; default 500)

- [ ] **Step 1: Write the failing test**

```ts
// packages/connectors/src/24sevenoffice/membership-invoices.test.ts
import { expect, test } from "bun:test";
import { parseMembershipInvoiceLines } from "./membership-invoices";

const products = new Set([113]);

test("reads campus from the order-level dimension 101 and keeps membership rows only", () => {
  const lines = parseMembershipInvoiceLines(
    {
      GetInvoicesResult: {
        InvoiceOrder: {
          CustomerId: 3975,
          DateInvoiced: "2025-11-27T14:00:00Z",
          DepartmentId: 22,
          InvoiceRows: {
            InvoiceRow: [{ ProductId: -1 }, { ProductId: 113 }, { ProductId: 39 }],
          },
          UserDefinedDimensions: {
            UserDefinedDimension: [
              { TypeId: 101, Name: "Oslo", Value: "1" },
              { TypeId: 102, Name: "Semester", Value: "x" },
            ],
          },
        },
      },
    },
    products
  );
  expect(lines).toEqual([
    { campusId: "1", customerId: 3975, invoicedAt: "2025-11-27T14:00:00Z", productId: 113 },
  ]);
});

test("falls back to the row-level dimension and handles single-object shapes", () => {
  const lines = parseMembershipInvoiceLines(
    {
      GetInvoicesResult: {
        InvoiceOrder: [
          {
            CustomerId: 1,
            InvoiceRows: {
              InvoiceRow: {
                ProductId: 113,
                UserDefinedDimensions: { UserDefinedDimension: { TypeId: "101", Value: "2" } },
              },
            },
          },
        ],
      },
    },
    products
  );
  expect(lines).toEqual([{ campusId: "2", customerId: 1, invoicedAt: null, productId: 113 }]);
});

test("campus is null when no dimension 101 exists", () => {
  const lines = parseMembershipInvoiceLines(
    { GetInvoicesResult: { InvoiceOrder: { CustomerId: 1, InvoiceRows: { InvoiceRow: { ProductId: 113 } } } } },
    products
  );
  expect(lines[0]?.campusId).toBeNull();
});

test("empty result yields no lines", () => {
  expect(parseMembershipInvoiceLines({}, products)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/connectors && bun test src/24sevenoffice/membership-invoices.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/connectors/src/24sevenoffice/membership-invoices.ts
/**
 * 24SevenOffice membership invoices (read side).
 *
 * The roster sync needs each member's campus, which 24SO only records on the
 * membership invoice: the UserDefinedDimension with TypeId 101 whose Value is
 * the app's campus id (see `buildDimensions` in
 * `@repo/shared/utils/finago-membership-invoice`). DepartmentId is the
 * department, not the campus, and is deliberately ignored.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";

/** Mirrors `CAMPUS_DIMENSION_TYPE` in ./rest/departments (not imported: that module pulls in the REST client). */
const CAMPUS_DIMENSION_TYPE_ID = "101";

/** Customers per `GetInvoices` request (confirmed against the live API in the roster plan's probe). */
export const CUSTOMER_ID_BATCH_SIZE = 500;

type OneOrMany<T> = T | T[] | undefined;

interface Dimension {
  Name?: string;
  TypeId?: number | string;
  Value?: string;
}

interface InvoiceRow {
  ProductId?: number | string;
  UserDefinedDimensions?: { UserDefinedDimension?: OneOrMany<Dimension> };
}

interface InvoiceOrder {
  CustomerId?: number | string;
  DateInvoiced?: string;
  InvoiceRows?: { InvoiceRow?: OneOrMany<InvoiceRow> };
  UserDefinedDimensions?: { UserDefinedDimension?: OneOrMany<Dimension> };
}

export interface GetInvoicesResponse {
  GetInvoicesResult?: { InvoiceOrder?: OneOrMany<InvoiceOrder> };
}

export interface MembershipInvoiceLine {
  campusId: string | null;
  customerId: number;
  invoicedAt: string | null;
  productId: number;
}

function toArray<T>(value: OneOrMany<T>): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function campusFrom(dimensions: OneOrMany<Dimension>): string | null {
  const campus = toArray(dimensions).find(
    (d) => String(d.TypeId) === CAMPUS_DIMENSION_TYPE_ID
  );
  const value = campus?.Value?.trim();
  return value ? value : null;
}

/** One line per invoice row whose product is a membership product. */
export function parseMembershipInvoiceLines(
  result: GetInvoicesResponse,
  productIds: ReadonlySet<number>
): MembershipInvoiceLine[] {
  const lines: MembershipInvoiceLine[] = [];

  for (const order of toArray(result.GetInvoicesResult?.InvoiceOrder)) {
    const customerId = Number(order.CustomerId);
    if (!Number.isFinite(customerId)) {
      continue;
    }
    const orderCampus = campusFrom(
      order.UserDefinedDimensions?.UserDefinedDimension
    );

    for (const row of toArray(order.InvoiceRows?.InvoiceRow)) {
      const productId = Number(row.ProductId);
      if (!productIds.has(productId)) {
        continue;
      }
      lines.push({
        campusId:
          orderCampus ??
          campusFrom(row.UserDefinedDimensions?.UserDefinedDimension),
        customerId,
        invoicedAt: order.DateInvoiced ?? null,
        productId,
      });
    }
  }

  return lines;
}

/** Membership invoice lines for the given customers, batched. Throws on any failed batch. */
export async function getMembershipInvoices(
  customerIds: number[],
  productIds: ReadonlySet<number>,
  options?: { timeoutMs?: number }
): Promise<MembershipInvoiceLine[]> {
  if (customerIds.length === 0 || productIds.size === 0) {
    return [];
  }

  const session = await getValidSession();
  const client = await createAuthenticatedClient("invoice", session);
  const lines: MembershipInvoiceLine[] = [];

  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_BATCH_SIZE) {
    const batch = customerIds.slice(i, i + CUSTOMER_ID_BATCH_SIZE);
    const [result]: [GetInvoicesResponse] = await client.GetInvoicesAsync(
      {
        searchParams: { CustomerIds: { int: batch } },
        invoiceReturnProperties: {
          string: [
            "CustomerId",
            "DateInvoiced",
            "UserDefinedDimensions",
            "InvoiceRows",
          ],
        },
        rowReturnProperties: { string: ["ProductId", "UserDefinedDimensions"] },
      },
      options?.timeoutMs ? { timeout: options.timeoutMs } : undefined
    );
    lines.push(...parseMembershipInvoiceLines(result, productIds));
  }

  return lines;
}
```

Set `CUSTOMER_ID_BATCH_SIZE` and the `CustomerIds` shape to what Task 1 confirmed.

In `index.ts`, after the `// Invoice management` export add:

```ts
// Membership invoices (read side — campus per member)
export {
  CUSTOMER_ID_BATCH_SIZE,
  type GetInvoicesResponse,
  getMembershipInvoices,
  type MembershipInvoiceLine,
  parseMembershipInvoiceLines,
} from "./membership-invoices";
```

Also add `COMPANY_ID_BATCH_SIZE` to the `./company` export block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/connectors && bun test src/24sevenoffice && bun run check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun x ultracite fix packages/connectors/src/24sevenoffice
git add packages/connectors/src/24sevenoffice/membership-invoices.ts packages/connectors/src/24sevenoffice/membership-invoices.test.ts packages/connectors/src/24sevenoffice/index.ts
git commit -m "feat(24so): read membership invoice lines with campus dimension

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `member_roster` table and pure roster logic

**Files:**
- Modify: `packages/api/appwrite.config.json` (append to `tables`)
- Regenerate: `packages/api/types/appwrite.ts`
- Create: `functions/member-roster-sync/package.json`, `functions/member-roster-sync/tsconfig.json`, `functions/member-roster-sync/src/roster.ts`
- Test: `functions/member-roster-sync/src/roster.test.ts`

**Interfaces:**
- Consumes: `CustomerCategoryMapping` (Task 2), `MembershipInvoiceLine` (Task 3), `Company` type from `@repo/connectors/24sevenoffice`.
- Produces (from `functions/member-roster-sync/src/roster.ts`):
  - `interface ActivePlan { categoryId: number; expiryDate: string; name: string; productId: number }`
  - `interface PlanRow { category: string | null; expiryDate: string; membership_id: string; name: string }`
  - `selectActivePlans(rows: PlanRow[], today: string): Map<number, ActivePlan>` (key: category id)
  - `foldMembers(pairs: CustomerCategoryMapping[], plans: Map<number, ActivePlan>): Map<number, ActivePlan>` (key: company id)
  - `interface RosterRow { $id: string; campus_id: string | null; company_id: number; email: string | null; expiry_date: string; invoiced_at: string | null; membership_id: string; membership_name: string; name: string; sync_run_id: string }`
  - `buildRosterRows(input: { companies: Company[]; invoiceLines: MembershipInvoiceLine[]; members: Map<number, ActivePlan>; runId: string; validCampusIds: ReadonlySet<string> }): RosterRow[]`

- [ ] **Step 1: Add the table to `appwrite.config.json`**

Append this object to the `tables` array (after `auth_tokens` is fine):

```json
{
    "$id": "member_roster",
    "$permissions": [],
    "databaseId": "app",
    "name": "Member Roster",
    "enabled": true,
    "rowSecurity": false,
    "columns": [
        { "key": "company_id", "type": "integer", "required": true, "array": false, "min": 0, "max": 9223372036854775807, "default": null },
        { "key": "name", "type": "string", "required": true, "array": false, "size": 255, "default": null, "encrypt": false },
        { "key": "email", "type": "string", "required": false, "array": false, "size": 320, "default": null, "encrypt": false },
        { "key": "campus_id", "type": "string", "required": false, "array": false, "size": 36, "default": null, "encrypt": false },
        { "key": "membership_id", "type": "string", "required": true, "array": false, "size": 36, "default": null, "encrypt": false },
        { "key": "membership_name", "type": "string", "required": true, "array": false, "size": 255, "default": null, "encrypt": false },
        { "key": "expiry_date", "type": "string", "required": true, "array": false, "size": 32, "default": null, "encrypt": false },
        { "key": "invoiced_at", "type": "datetime", "required": false, "array": false, "default": null, "format": "" },
        { "key": "sync_run_id", "type": "string", "required": true, "array": false, "size": 36, "default": null, "encrypt": false }
    ],
    "indexes": [
        { "key": "name_fulltext", "type": "fulltext", "status": "available", "columns": ["name"], "orders": [] },
        { "key": "email_fulltext", "type": "fulltext", "status": "available", "columns": ["email"], "orders": [] },
        { "key": "name_idx", "type": "key", "status": "available", "columns": ["name"], "orders": ["ASC"] },
        { "key": "campus_idx", "type": "key", "status": "available", "columns": ["campus_id"], "orders": [] },
        { "key": "sync_run_idx", "type": "key", "status": "available", "columns": ["sync_run_id"], "orders": [] }
    ]
}
```

Run: `cd packages/api && bun test appwrite-config` — Expected: PASS (existing config/permission tests still accept the file). If a permissions test requires every table to be listed somewhere, add `member_roster` there following that test's message.

- [ ] **Step 2: Regenerate types**

Run: `cd packages/api && appwrite types -l ts ./types`
Expected: `types/appwrite.ts` now contains `export type MemberRoster = Models.Row & { company_id: number; name: string; email: string | null; campus_id: string | null; … }`. If the CLI can't run offline, stop and ask the user to push the table and regenerate; do not hand-edit the generated file.

- [ ] **Step 3: Scaffold the function package**

```json
// functions/member-roster-sync/package.json
{
  "name": "member-roster-sync",
  "version": "1.0.0",
  "private": true,
  "description": "Appwrite Function (Bun runtime) that syncs the 24SevenOffice paid-member roster into app.member_roster.",
  "type": "module",
  "main": "src/main.ts",
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "bun test ./src"
  },
  "dependencies": {
    "@repo/api": "workspace:*",
    "@repo/connectors": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "catalog:",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

(If `@types/bun` is not in the root `catalog`, use the version `apps/admin/package.json` uses.)

```json
// functions/member-roster-sync/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node", "bun"]
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install` (repo root). Expected: lockfile updated, workspace links created.

- [ ] **Step 4: Write the failing tests**

```ts
// functions/member-roster-sync/src/roster.test.ts
import { expect, test } from "bun:test";
import { buildRosterRows, foldMembers, selectActivePlans } from "./roster";

const TODAY = "2026-09-29";
const planRows = [
  { category: "10", expiryDate: "2026-12-31", membership_id: "113", name: "BISO Membership fall 2026" },
  { category: "11", expiryDate: "2027-06-30", membership_id: "114", name: "BISO Membership fall 2026 and spring 2027" },
  { category: "12", expiryDate: "2026-06-30", membership_id: "112", name: "BISO Membership spring 2026" },
  { category: null, expiryDate: "2027-12-31", membership_id: "115", name: "No category" },
];

test("selectActivePlans keeps unexpired plans with a category", () => {
  const plans = selectActivePlans(planRows, TODAY);
  expect([...plans.keys()].sort()).toEqual([10, 11]);
  expect(plans.get(10)).toEqual({ categoryId: 10, expiryDate: "2026-12-31", name: "BISO Membership fall 2026", productId: 113 });
});

test("selectActivePlans treats a plan expiring today as active", () => {
  expect(selectActivePlans([{ ...planRows[0], expiryDate: TODAY }], TODAY).size).toBe(1);
});

test("foldMembers keeps one plan per customer, the one that expires latest", () => {
  const plans = selectActivePlans(planRows, TODAY);
  const members = foldMembers(
    [
      { categoryId: 10, companyId: 1 },
      { categoryId: 11, companyId: 1 },
      { categoryId: 12, companyId: 2 }, // expired plan → not a member
      { categoryId: 99, companyId: 3 }, // non-membership category
      { categoryId: 10, companyId: 4 },
    ],
    plans
  );
  expect([...members.keys()].sort()).toEqual([1, 4]);
  expect(members.get(1)?.productId).toBe(114);
});

test("buildRosterRows joins names, emails and the latest invoice campus", () => {
  const plans = selectActivePlans(planRows, TODAY);
  const members = foldMembers([{ categoryId: 10, companyId: 1 }], plans);
  const rows = buildRosterRows({
    companies: [{ EmailAddresses: { Primary: { Value: "a@b.no" } }, Id: 1, Name: "Ada" }],
    invoiceLines: [
      { campusId: "2", customerId: 1, invoicedAt: "2025-08-01T00:00:00Z", productId: 113 },
      { campusId: "1", customerId: 1, invoicedAt: "2026-08-15T00:00:00Z", productId: 113 },
    ],
    members,
    runId: "run1",
    validCampusIds: new Set(["1", "2"]),
  });
  expect(rows).toEqual([
    {
      $id: "1",
      campus_id: "1",
      company_id: 1,
      email: "a@b.no",
      expiry_date: "2026-12-31",
      invoiced_at: "2026-08-15T00:00:00Z",
      membership_id: "113",
      membership_name: "BISO Membership fall 2026",
      name: "Ada",
      sync_run_id: "run1",
    },
  ]);
});

test("buildRosterRows nulls a campus id that is not in the campus table", () => {
  const members = foldMembers([{ categoryId: 10, companyId: 1 }], selectActivePlans(planRows, TODAY));
  const [row] = buildRosterRows({
    companies: [{ Id: 1, Name: "Ada" }],
    invoiceLines: [{ campusId: "0", customerId: 1, invoicedAt: null, productId: 113 }],
    members,
    runId: "r",
    validCampusIds: new Set(["1"]),
  });
  expect(row?.campus_id).toBeNull();
});

test("buildRosterRows keeps a member 24SO returned no company for", () => {
  const members = foldMembers([{ categoryId: 10, companyId: 1 }], selectActivePlans(planRows, TODAY));
  const [row] = buildRosterRows({ companies: [], invoiceLines: [], members, runId: "r", validCampusIds: new Set() });
  expect(row).toMatchObject({ campus_id: null, email: null, name: "", company_id: 1 });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd functions/member-roster-sync && bun test`
Expected: FAIL — cannot find module `./roster`.

- [ ] **Step 6: Implement `roster.ts`**

```ts
// functions/member-roster-sync/src/roster.ts
/**
 * Pure roster assembly: which customers are current members, which plan to
 * show, and which campus they belong to. No I/O — `main.ts` feeds it.
 */

import type {
  Company,
  CustomerCategoryMapping,
  MembershipInvoiceLine,
} from "@repo/connectors/24sevenoffice";

export interface ActivePlan {
  categoryId: number;
  expiryDate: string;
  name: string;
  productId: number;
}

/** The `memberships` columns this module reads. */
export interface PlanRow {
  category: string | null;
  expiryDate: string;
  membership_id: string;
  name: string;
}

export interface RosterRow {
  $id: string;
  campus_id: string | null;
  company_id: number;
  email: string | null;
  expiry_date: string;
  invoiced_at: string | null;
  membership_id: string;
  membership_name: string;
  name: string;
  sync_run_id: string;
}

/** Unexpired plans keyed by their 24SO category id. `today` is `YYYY-MM-DD`. */
export function selectActivePlans(
  rows: PlanRow[],
  today: string
): Map<number, ActivePlan> {
  const plans = new Map<number, ActivePlan>();
  for (const row of rows) {
    const categoryId = Number.parseInt(row.category ?? "", 10);
    const productId = Number.parseInt(row.membership_id, 10);
    const expiryDate = row.expiryDate.slice(0, 10);
    if (
      Number.isFinite(categoryId) &&
      Number.isFinite(productId) &&
      expiryDate >= today
    ) {
      plans.set(categoryId, { categoryId, expiryDate, name: row.name, productId });
    }
  }
  return plans;
}

/** One plan per member company: the active plan that expires latest. */
export function foldMembers(
  pairs: CustomerCategoryMapping[],
  plans: Map<number, ActivePlan>
): Map<number, ActivePlan> {
  const members = new Map<number, ActivePlan>();
  for (const { categoryId, companyId } of pairs) {
    const plan = plans.get(categoryId);
    if (!plan) {
      continue;
    }
    const current = members.get(companyId);
    if (!current || plan.expiryDate > current.expiryDate) {
      members.set(companyId, plan);
    }
  }
  return members;
}

function latestLineByCustomer(
  lines: MembershipInvoiceLine[]
): Map<number, MembershipInvoiceLine> {
  const latest = new Map<number, MembershipInvoiceLine>();
  for (const line of lines) {
    const current = latest.get(line.customerId);
    if (!current || (line.invoicedAt ?? "") > (current.invoicedAt ?? "")) {
      latest.set(line.customerId, line);
    }
  }
  return latest;
}

export function buildRosterRows(input: {
  companies: Company[];
  invoiceLines: MembershipInvoiceLine[];
  members: Map<number, ActivePlan>;
  runId: string;
  validCampusIds: ReadonlySet<string>;
}): RosterRow[] {
  const companies = new Map(
    input.companies
      .filter((c): c is Company & { Id: number } => typeof c.Id === "number")
      .map((c) => [c.Id, c])
  );
  const invoices = latestLineByCustomer(input.invoiceLines);
  const rows: RosterRow[] = [];

  for (const [companyId, plan] of input.members) {
    const company = companies.get(companyId);
    const invoice = invoices.get(companyId);
    const campusId = invoice?.campusId ?? null;

    rows.push({
      $id: String(companyId),
      campus_id: campusId && input.validCampusIds.has(campusId) ? campusId : null,
      company_id: companyId,
      email: company?.EmailAddresses?.Primary?.Value ?? null,
      expiry_date: plan.expiryDate,
      invoiced_at: invoice?.invoicedAt ?? null,
      membership_id: String(plan.productId),
      membership_name: plan.name,
      name: company?.Name?.trim() ?? "",
      sync_run_id: input.runId,
    });
  }

  return rows;
}
```

Note: `invoiceLines` passed in must already be filtered to each member's own plan products; `main.ts` passes the product ids of all active plans, which is sufficient because only active-plan invoices matter.

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd functions/member-roster-sync && bun test && bun run check-types`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
bun x ultracite fix functions/member-roster-sync packages/api/appwrite.config.json
git add packages/api/appwrite.config.json packages/api/types/appwrite.ts functions/member-roster-sync/package.json functions/member-roster-sync/tsconfig.json functions/member-roster-sync/src/roster.ts functions/member-roster-sync/src/roster.test.ts bun.lock
git commit -m "feat(member-roster): roster table and pure roster assembly

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Function entrypoint

**Files:**
- Create: `functions/member-roster-sync/src/main.ts`, `functions/member-roster-sync/README.md`
- Test: `functions/member-roster-sync/src/run.test.ts`

**Interfaces:**
- Consumes: Task 2–4 exports; `createAdminClient` from `@repo/api/server` (exposes `db: TablesDB`, `functions: Functions`); `Query` from `@repo/api`.
- Produces: default export `async (context) => Response`; response body `{ ok: true, members: number, unknownCampus: number, removed: number, durationMs: number }` or `{ ok: false, error: string }` (HTTP 500), or `{ ok: true, skipped: "already-running" }`. The admin page reads only execution `status` and `responseStatusCode`.

Design for testability: `main.ts` exports `runSync(deps)` taking injected I/O, and the default export wires real deps. Tests cover the guards.

- [ ] **Step 1: Write the failing tests**

```ts
// functions/member-roster-sync/src/run.test.ts
import { expect, mock, test } from "bun:test";
import { runSync, type SyncDeps } from "./run";

function deps(overrides: Partial<SyncDeps> = {}): SyncDeps {
  return {
    countRunningExecutions: async () => 1,
    deleteStaleRows: mock(async () => 0),
    fetchCompanies: async () => [{ Id: 1, Name: "Ada" }],
    fetchInvoiceLines: async () => [],
    fetchTree: async () => [{ categoryId: 10, companyId: 1 }],
    listCampusIds: async () => new Set(["1"]),
    listPlanRows: async () => [
      { category: "10", expiryDate: "2099-12-31", membership_id: "113", name: "Plan" },
    ],
    log: () => undefined,
    newRunId: () => "run1",
    today: () => "2026-09-29",
    upsertRows: mock(async () => undefined),
    ...overrides,
  };
}

test("skips when another execution is already processing", async () => {
  const d = deps({ countRunningExecutions: async () => 2 });
  expect(await runSync(d)).toEqual({ ok: true, skipped: "already-running" });
  expect(d.upsertRows).not.toHaveBeenCalled();
});

test("throws and writes nothing when the tree yields zero members", async () => {
  const d = deps({ fetchTree: async () => [] });
  await expect(runSync(d)).rejects.toThrow("zero current members");
  expect(d.upsertRows).not.toHaveBeenCalled();
  expect(d.deleteStaleRows).not.toHaveBeenCalled();
});

test("upserts before deleting stale rows, with the run id", async () => {
  const order: string[] = [];
  const d = deps({
    deleteStaleRows: mock(async (runId: string) => {
      order.push(`delete:${runId}`);
      return 3;
    }),
    upsertRows: mock(async () => {
      order.push("upsert");
    }),
  });
  const result = await runSync(d);
  expect(order).toEqual(["upsert", "delete:run1"]);
  expect(result).toMatchObject({ ok: true, members: 1, removed: 3, unknownCampus: 1 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd functions/member-roster-sync && bun test src/run.test.ts`
Expected: FAIL — cannot find module `./run`.

- [ ] **Step 3: Implement `run.ts` (orchestration with injected I/O)**

```ts
// functions/member-roster-sync/src/run.ts
import type {
  Company,
  CustomerCategoryMapping,
  MembershipInvoiceLine,
} from "@repo/connectors/24sevenoffice";
import {
  buildRosterRows,
  foldMembers,
  type PlanRow,
  type RosterRow,
  selectActivePlans,
} from "./roster";

export interface SyncDeps {
  countRunningExecutions: () => Promise<number>;
  deleteStaleRows: (runId: string) => Promise<number>;
  fetchCompanies: (companyIds: number[]) => Promise<Company[]>;
  fetchInvoiceLines: (
    companyIds: number[],
    productIds: ReadonlySet<number>
  ) => Promise<MembershipInvoiceLine[]>;
  fetchTree: () => Promise<CustomerCategoryMapping[]>;
  listCampusIds: () => Promise<ReadonlySet<string>>;
  listPlanRows: () => Promise<PlanRow[]>;
  log: (message: string) => void;
  newRunId: () => string;
  today: () => string;
  upsertRows: (rows: RosterRow[]) => Promise<void>;
}

export type SyncResult =
  | { ok: true; skipped: "already-running" }
  | {
      durationMs: number;
      members: number;
      ok: true;
      removed: number;
      unknownCampus: number;
    };

export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  const startedAt = Date.now();

  // This execution is itself "processing", so more than one means overlap.
  if ((await deps.countRunningExecutions()) > 1) {
    deps.log("Another roster sync is already running; skipping.");
    return { ok: true, skipped: "already-running" };
  }

  const runId = deps.newRunId();
  const plans = selectActivePlans(await deps.listPlanRows(), deps.today());
  deps.log(`Active plans: ${plans.size}`);

  const tree = await deps.fetchTree();
  const members = foldMembers(tree, plans);
  deps.log(`Tree pairs: ${tree.length}; current members: ${members.size}`);

  // Never let an empty/failed 24SO response wipe the roster.
  if (members.size === 0) {
    throw new Error("24SO returned zero current members; keeping previous roster");
  }

  const companyIds = [...members.keys()];
  const productIds = new Set([...plans.values()].map((p) => p.productId));
  const [companies, invoiceLines, validCampusIds] = await Promise.all([
    deps.fetchCompanies(companyIds),
    deps.fetchInvoiceLines(companyIds, productIds),
    deps.listCampusIds(),
  ]);
  deps.log(`Companies: ${companies.length}; invoice lines: ${invoiceLines.length}`);

  const rows = buildRosterRows({ companies, invoiceLines, members, runId, validCampusIds });
  await deps.upsertRows(rows);
  const removed = await deps.deleteStaleRows(runId);

  const unknownCampus = rows.filter((r) => r.campus_id === null).length;
  deps.log(`Upserted ${rows.length}; removed ${removed}; unknown campus ${unknownCampus}`);

  return {
    durationMs: Date.now() - startedAt,
    members: rows.length,
    ok: true,
    removed,
    unknownCampus,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions/member-roster-sync && bun test`
Expected: PASS.

- [ ] **Step 5: Implement `main.ts` (real I/O wiring)**

```ts
// functions/member-roster-sync/src/main.ts
/**
 * member-roster-sync Appwrite Function.
 *
 * Rebuilds app.member_roster from 24SevenOffice: the customer-category tree
 * (who holds an active membership category), company names/emails, and each
 * member's membership invoice (campus dimension). Schedule, timeout and
 * deployment are configured in the Appwrite console, not here.
 *
 * Run status is read by the admin page from this function's executions, so
 * failures must surface as a 500 response (and in the logs via context.error).
 */

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  getCompaniesByIds,
  getCustomerCategoryTree,
  getMembershipInvoices,
} from "@repo/connectors/24sevenoffice";
import type { RosterRow } from "./roster";
import { runSync } from "./run";

const DB = "app";
const ROSTER_TABLE = "member_roster";
const TREE_TIMEOUT_MS = 180_000;
const INVOICE_TIMEOUT_MS = 120_000;
const WRITE_BATCH = 100;
const LOG_TAG = "[member-roster-sync]";

type LogFn = (...messages: unknown[]) => void;
interface AppwriteContext {
  error: LogFn;
  log: LogFn;
  res: { json: (data: unknown, statusCode?: number) => unknown };
}

export default async function main(context: AppwriteContext) {
  const { db, functions } = await createAdminClient();
  const functionId = process.env.APPWRITE_FUNCTION_ID ?? "";

  try {
    const result = await runSync({
      countRunningExecutions: async () => {
        const list = await functions.listExecutions({
          functionId,
          queries: [Query.equal("status", ["processing"]), Query.limit(1)],
        });
        return list.total;
      },
      deleteStaleRows: async (runId) => {
        let removed = 0;
        // Bulk delete is capped per call; repeat until nothing stale remains.
        for (;;) {
          const deleted = await db.deleteRows({
            databaseId: DB,
            tableId: ROSTER_TABLE,
            queries: [Query.notEqual("sync_run_id", runId), Query.limit(WRITE_BATCH)],
          });
          removed += deleted.total;
          if (deleted.total < WRITE_BATCH) {
            return removed;
          }
        }
      },
      fetchCompanies: (ids) => getCompaniesByIds(ids),
      fetchInvoiceLines: (ids, productIds) =>
        getMembershipInvoices(ids, productIds, { timeoutMs: INVOICE_TIMEOUT_MS }),
      fetchTree: () => getCustomerCategoryTree({ timeoutMs: TREE_TIMEOUT_MS }),
      listCampusIds: async () => {
        const campuses = await db.listRows(DB, "campus", [
          Query.select(["$id"]),
          Query.limit(100),
        ]);
        return new Set(campuses.rows.map((row) => row.$id));
      },
      listPlanRows: async () => {
        const plans = await db.listRows(DB, "memberships", [
          Query.select(["membership_id", "name", "category", "expiryDate"]),
          Query.limit(500),
        ]);
        return plans.rows.map((row) => ({
          category: (row.category as string | null) ?? null,
          expiryDate: String(row.expiryDate),
          membership_id: String(row.membership_id),
          name: String(row.name),
        }));
      },
      log: (message) => context.log(`${LOG_TAG} ${message}`),
      newRunId: () => ID.unique(),
      today: () => new Date().toISOString().slice(0, 10),
      upsertRows: async (rows: RosterRow[]) => {
        for (let i = 0; i < rows.length; i += WRITE_BATCH) {
          await db.upsertRows({
            databaseId: DB,
            tableId: ROSTER_TABLE,
            rows: rows.slice(i, i + WRITE_BATCH),
          });
        }
      },
    });
    return context.res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.error(`${LOG_TAG} Sync failed: ${message}`);
    if (error instanceof Error && error.stack) {
      context.error(error.stack);
    }
    return context.res.json({ error: message, ok: false }, 500);
  }
}
```

Check `Query.notEqual` exists in the node-appwrite version (`grep -n "notEqual" node_modules/node-appwrite/dist/query.d.ts`); it does in v29. If `listRows` on `memberships` would exceed 500 rows, raise the limit — it holds one row per product, currently a few dozen.

- [ ] **Step 6: README**

```markdown
<!-- functions/member-roster-sync/README.md -->
# member-roster-sync (Appwrite Function)

Rebuilds `app.member_roster` — the paid-member register shown on the admin
`/members` page — from 24SevenOffice. Display only: live membership checks do
not read this table.

## How it works
1. Active plans = `memberships` rows whose `expiryDate` is today or later.
2. `CompanyService.GetCustomerCategoryTree` (~70s, unpaginated) → customers
   holding an active plan's category; latest-expiring plan wins.
3. `GetCompanies` (1000 ids/call) → name and primary email.
4. `InvoiceService.GetInvoices` by customer → campus from the invoice's
   UserDefinedDimension `TypeId` 101 (value = campus `$id`). Unknown → null,
   visible to global admins only.
5. Upsert all rows with a new run id, then delete rows from older runs.
   Zero members from 24SO aborts the run before any write.

Overlapping runs exit immediately. Failures return HTTP 500 and are logged.

## Console setup (not in code)
- Runtime: Bun. Root directory: repository root. Entrypoint:
  `functions/member-roster-sync/src/main.ts`. Build command: `bun install`.
- Schedule: nightly (e.g. `0 3 * * *`). Timeout: at least 600s.
- Execute access: none (admin triggers it with the server API key).
- Variables: `APPWRITE_API_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`,
  `TFSO_APP_ID`, `TFSO_USERNAME`, `TFSO_PASSWORD`.
- Set the admin app's `MEMBER_ROSTER_FUNCTION_ID` to this function's id.
```

- [ ] **Step 7: Type-check, test, commit**

```bash
cd functions/member-roster-sync && bun test && bun run check-types && cd ../..
bun x ultracite fix functions/member-roster-sync
git add functions/member-roster-sync/src/run.ts functions/member-roster-sync/src/run.test.ts functions/member-roster-sync/src/main.ts functions/member-roster-sync/README.md
git commit -m "feat(member-roster): sync function entrypoint

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Admin — roster status helper and server actions

**Files:**
- Create: `apps/admin/src/lib/member-roster-status.ts`
- Test: `apps/admin/src/lib/member-roster-status.test.ts`
- Rewrite: `apps/admin/src/app/(portal)/_actions/members.ts`
- Modify: `turbo.json` (`tasks.build.env`: add `"MEMBER_ROSTER_FUNCTION_ID"`, alphabetically)

**Interfaces:**
- Consumes: `MemberRoster` type (Task 4), `parseListParams`/`ListParams`/`PaginatedResult` (`@/lib/list-params`), `paginationQueries` (`@/lib/list-queries`), `applyScopeQueries` (`@/lib/utils/authorization`), `requireNavAccess` (`@/lib/authorization`).
- Produces:
  - `interface ExecutionLike { $updatedAt: string; responseStatusCode: number; status: string }`
  - `interface RosterStatus { lastFailedAt: string | null; lastRefreshedAt: string | null; running: boolean }`
  - `summarizeRosterExecutions(executions: ExecutionLike[]): RosterStatus` (executions newest first)
  - actions: `listRosterMembers(params: ListParams): Promise<PaginatedResult<RosterMemberItem>>`, `getRosterStatus(): Promise<RosterStatus & { canRefresh: boolean }>`, `refreshMemberRoster(): Promise<{ ok: boolean; reason?: "forbidden" | "already-running" | "not-configured" }>`
  - `interface RosterMemberItem { campusId: string | null; campusName: string | null; email: string | null; expiryDate: string; id: string; name: string; planName: string }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/src/lib/member-roster-status.test.ts
import { expect, test } from "bun:test";
import { summarizeRosterExecutions } from "./member-roster-status";

const ok = (at: string) => ({ $updatedAt: at, responseStatusCode: 200, status: "completed" });

test("last refreshed is the newest successful execution", () => {
  expect(summarizeRosterExecutions([ok("2026-09-29T03:01:00Z"), ok("2026-09-28T03:01:00Z")])).toEqual({
    lastFailedAt: null,
    lastRefreshedAt: "2026-09-29T03:01:00Z",
    running: false,
  });
});

test("a completed execution that returned 500 counts as failed", () => {
  const status = summarizeRosterExecutions([
    { $updatedAt: "2026-09-29T03:01:00Z", responseStatusCode: 500, status: "completed" },
    ok("2026-09-28T03:01:00Z"),
  ]);
  expect(status).toEqual({
    lastFailedAt: "2026-09-29T03:01:00Z",
    lastRefreshedAt: "2026-09-28T03:01:00Z",
    running: false,
  });
});

test("an older failure is not reported once a newer run succeeded", () => {
  const status = summarizeRosterExecutions([
    ok("2026-09-29T03:01:00Z"),
    { $updatedAt: "2026-09-28T03:01:00Z", responseStatusCode: 0, status: "failed" },
  ]);
  expect(status.lastFailedAt).toBeNull();
});

test("waiting or processing means running", () => {
  expect(summarizeRosterExecutions([{ $updatedAt: "x", responseStatusCode: 0, status: "waiting" }]).running).toBe(true);
  expect(summarizeRosterExecutions([{ $updatedAt: "x", responseStatusCode: 0, status: "processing" }]).running).toBe(true);
});

test("no executions at all", () => {
  expect(summarizeRosterExecutions([])).toEqual({ lastFailedAt: null, lastRefreshedAt: null, running: false });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/admin && bun test src/lib/member-roster-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// apps/admin/src/lib/member-roster-status.ts
/**
 * Derives the roster page's status line from the sync function's own
 * execution records (Appwrite keeps them; there is no separate state table).
 * A run "succeeded" only when it completed with a non-error response — the
 * function returns 500 on failure, which Appwrite still records as completed.
 */

export interface ExecutionLike {
  $updatedAt: string;
  responseStatusCode: number;
  status: string;
}

export interface RosterStatus {
  lastFailedAt: string | null;
  lastRefreshedAt: string | null;
  running: boolean;
}

const RUNNING_STATUSES = new Set(["waiting", "processing"]);
const HTTP_ERROR_THRESHOLD = 400;

function succeeded(execution: ExecutionLike): boolean {
  return (
    execution.status === "completed" &&
    execution.responseStatusCode < HTTP_ERROR_THRESHOLD
  );
}

/** `executions` must be ordered newest first. */
export function summarizeRosterExecutions(
  executions: ExecutionLike[]
): RosterStatus {
  const running = executions.some((e) => RUNNING_STATUSES.has(e.status));
  const finished = executions.filter((e) => !RUNNING_STATUSES.has(e.status));
  const lastSuccessIndex = finished.findIndex(succeeded);
  const lastSuccess = finished[lastSuccessIndex];
  // Only failures newer than the last success are worth showing.
  const newerFinished =
    lastSuccessIndex === -1 ? finished : finished.slice(0, lastSuccessIndex);
  const lastFailure = newerFinished[0];

  return {
    lastFailedAt: lastFailure?.$updatedAt ?? null,
    lastRefreshedAt: lastSuccess?.$updatedAt ?? null,
    running,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/admin && bun test src/lib/member-roster-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite `_actions/members.ts`**

Replace the whole file. `getMemberDetail`, `MemberDetail`, `MembershipHistoryEntry`, `MemberListItem` go away (Task 7 deletes their only consumer); first confirm no other importer: `grep -rn "_actions/members" apps/admin/src` should list only `members/page.tsx`, `members/[userId]/page.tsx`, and `members-list-client.tsx`.

```ts
"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Campus, MemberRoster } from "@repo/api/types/appwrite";
import { requireNavAccess } from "@/lib/authorization";
import type { ListParams, PaginatedResult } from "@/lib/list-params";
import { paginationQueries } from "@/lib/list-queries";
import {
  type RosterStatus,
  summarizeRosterExecutions,
} from "@/lib/member-roster-status";
import { applyScopeQueries } from "@/lib/utils/authorization";

const ROSTER_TABLE = "member_roster";
/** Enough history to find the last success behind a run of failures. */
const STATUS_EXECUTION_WINDOW = 20;

export interface RosterMemberItem {
  campusId: string | null;
  campusName: string | null;
  email: string | null;
  expiryDate: string;
  id: string;
  name: string;
  planName: string;
}

/**
 * Paid members synced from 24SevenOffice (see functions/member-roster-sync).
 * Campus admins see their campuses only; rows with an unknown campus
 * (`campus_id` null) are therefore visible to global admins only, which
 * `applyScopeQueries`' `Query.equal("campus_id", …)` gives for free.
 */
export async function listRosterMembers(
  params: ListParams
): Promise<PaginatedResult<RosterMemberItem>> {
  const ctx = await requireNavAccess("portal.members");
  const { db } = await createAdminClient();

  const queries: string[] = [
    Query.orderAsc("name"),
    ...paginationQueries(params),
    ...applyScopeQueries(ctx, { departmentField: null }),
  ];
  if (params.q) {
    queries.push(
      Query.or([Query.search("name", params.q), Query.search("email", params.q)])
    );
  }

  const [result, campuses] = await Promise.all([
    db.listRows<MemberRoster>("app", ROSTER_TABLE, queries),
    db.listRows<Campus>("app", "campus", [
      Query.select(["$id", "name"]),
      Query.limit(100),
    ]),
  ]);
  const campusNames = new Map(campuses.rows.map((c) => [c.$id, c.name]));

  return {
    page: params.page,
    rows: result.rows.map((row) => ({
      campusId: row.campus_id,
      campusName: row.campus_id ? (campusNames.get(row.campus_id) ?? null) : null,
      email: row.email,
      expiryDate: row.expiry_date,
      id: row.$id,
      name: row.name,
      planName: row.membership_name,
    })),
    size: params.size,
    total: result.total,
  };
}

function rosterFunctionId(): string | null {
  return process.env.MEMBER_ROSTER_FUNCTION_ID || null;
}

async function readRosterStatus(functionId: string): Promise<RosterStatus> {
  const { functions } = await createAdminClient();
  const list = await functions.listExecutions({
    functionId,
    queries: [Query.orderDesc("$createdAt"), Query.limit(STATUS_EXECUTION_WINDOW)],
  });
  return summarizeRosterExecutions(list.executions);
}

export async function getRosterStatus(): Promise<
  RosterStatus & { canRefresh: boolean }
> {
  const ctx = await requireNavAccess("portal.members");
  const canRefresh = ctx.roles.includes("globaladmin");
  const functionId = rosterFunctionId();
  if (!functionId) {
    return { canRefresh: false, lastFailedAt: null, lastRefreshedAt: null, running: false };
  }
  return { ...(await readRosterStatus(functionId)), canRefresh };
}

/** Global admins only. Starts an async execution unless one is already queued or running. */
export async function refreshMemberRoster(): Promise<{
  ok: boolean;
  reason?: "forbidden" | "already-running" | "not-configured";
}> {
  const ctx = await requireNavAccess("portal.members");
  if (!ctx.roles.includes("globaladmin")) {
    return { ok: false, reason: "forbidden" };
  }
  const functionId = rosterFunctionId();
  if (!functionId) {
    return { ok: false, reason: "not-configured" };
  }
  if ((await readRosterStatus(functionId)).running) {
    return { ok: false, reason: "already-running" };
  }

  const { functions } = await createAdminClient();
  await functions.createExecution({ functionId, async: true });
  return { ok: true };
}
```

If `Campus` is not the generated type name for the `campus` table, use the name found in `packages/api/types/appwrite.ts` (`grep -n "campus" packages/api/types/appwrite.ts | head`). If `Query.search` on the fulltext indexes misbehaves with `Query.or`, fall back to `Query.contains` exactly as the old `listMembers` did.

- [ ] **Step 6: Add the env var to Turbo**

In `turbo.json` `tasks.build.env`, insert `"MEMBER_ROSTER_FUNCTION_ID",` directly after `"MEMBER_PASS_SECRET",` (alphabetical order).

- [ ] **Step 7: Commit** (page compile errors are fixed in Task 7; do not run app type-check yet)

```bash
bun x ultracite fix apps/admin/src/lib/member-roster-status.ts apps/admin/src/lib/member-roster-status.test.ts "apps/admin/src/app/(portal)/_actions/members.ts"
git add apps/admin/src/lib/member-roster-status.ts apps/admin/src/lib/member-roster-status.test.ts "apps/admin/src/app/(portal)/_actions/members.ts" turbo.json
git commit -m "feat(admin): member roster actions and run status

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin — `/members` page

**Files:**
- Modify: `apps/admin/src/app/(portal)/members/page.tsx`
- Modify: `apps/admin/src/app/(portal)/members/_components/members-list-client.tsx`
- Create: `apps/admin/src/app/(portal)/members/_components/roster-refresh.tsx`
- Delete: `apps/admin/src/app/(portal)/members/[userId]/page.tsx`
- Modify: `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json` (`adminPortal.members`)

**Interfaces:**
- Consumes: Task 6 actions and `RosterMemberItem`; `PaginationBar` (`../_components/pagination-bar`), `parseListParams` (`@/lib/list-params`).

- [ ] **Step 1: Replace i18n keys**

In `packages/i18n/messages/en/adminPortal.json`, replace the `members` object with:

```json
"members": {
  "title": "Members",
  "description": "Paid BISO members from 24SevenOffice, across the campuses you can see.",
  "searchPlaceholder": "Search by name or email…",
  "empty": "No members found",
  "emptyDescription": "Try a different search, or refresh the roster.",
  "unnamed": "Unnamed",
  "unknownCampus": "Unknown campus",
  "roster": {
    "lastRefreshed": "Last refreshed {date}",
    "neverRefreshed": "Not synced yet",
    "lastFailed": "Last refresh failed {date}",
    "refreshing": "Refreshing…",
    "refresh": "Refresh now",
    "queued": "Refresh started. It takes a couple of minutes.",
    "alreadyRunning": "A refresh is already running.",
    "notConfigured": "Roster sync is not configured."
  }
}
```

In `packages/i18n/messages/no/adminPortal.json`, replace `members` with the same keys:

```json
"members": {
  "title": "Medlemmer",
  "description": "Betalende BISO-medlemmer fra 24SevenOffice, på campusene du har tilgang til.",
  "searchPlaceholder": "Søk etter navn eller e-post…",
  "empty": "Ingen medlemmer funnet",
  "emptyDescription": "Prøv et annet søk, eller oppdater medlemslisten.",
  "unnamed": "Uten navn",
  "unknownCampus": "Ukjent campus",
  "roster": {
    "lastRefreshed": "Sist oppdatert {date}",
    "neverRefreshed": "Ikke synkronisert ennå",
    "lastFailed": "Siste oppdatering feilet {date}",
    "refreshing": "Oppdaterer…",
    "refresh": "Oppdater nå",
    "queued": "Oppdatering startet. Det tar et par minutter.",
    "alreadyRunning": "En oppdatering kjører allerede.",
    "notConfigured": "Synkronisering av medlemslisten er ikke satt opp."
  }
}
```

Before replacing, check the `no` file's existing `members` keys (`detail`, etc.) are not used elsewhere: `grep -rn "members.detail\|adminPortal.members" apps/admin/src`. Only the files in this task should match.

- [ ] **Step 2: Delete the orphaned detail page**

Run: `git rm "apps/admin/src/app/(portal)/members/[userId]/page.tsx"`

- [ ] **Step 3: Refresh control**

```tsx
// apps/admin/src/app/(portal)/members/_components/roster-refresh.tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshMemberRoster } from "../../_actions/members";
import { STUDIO } from "../../_components/studio";

interface RosterRefreshProps {
  canRefresh: boolean;
  labels: {
    alreadyRunning: string;
    notConfigured: string;
    queued: string;
    refresh: string;
    refreshing: string;
  };
  running: boolean;
  statusText: string;
}

export function RosterRefresh({ canRefresh, labels, running, statusText }: RosterRefreshProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const busy = running || pending;

  function onRefresh() {
    startTransition(async () => {
      const result = await refreshMemberRoster();
      if (result.ok) {
        setMessage(labels.queued);
      } else if (result.reason === "already-running") {
        setMessage(labels.alreadyRunning);
      } else if (result.reason === "not-configured") {
        setMessage(labels.notConfigured);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs" style={{ color: STUDIO.ink3 }} aria-live="polite">
        {message ?? (running ? labels.refreshing : statusText)}
      </p>
      {canRefresh ? (
        <Button disabled={busy} onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? labels.refreshing : labels.refresh}
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: List client**

Replace `members-list-client.tsx` with a non-linking roster list (no status filter; search only):

```tsx
"use client";

import { Users as UsersIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RosterMemberItem } from "../../_actions/members";
import { EmptyState } from "../../_components/empty-state";
import { SearchToolbar } from "../../_components/search-toolbar";
import { STUDIO, StudioCrest } from "../../_components/studio";

interface MembersListClientProps {
  initialQuery: string;
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    unknownCampus: string;
    unnamed: string;
  };
  members: RosterMemberItem[];
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export function MembersListClient({ initialQuery, labels, members }: MembersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onSearch(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    params.delete("page");
    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  return (
    <>
      <SearchToolbar
        defaultSearch={initialQuery}
        onSearch={onSearch}
        placeholder={labels.searchPlaceholder}
      />

      {members.length === 0 ? (
        <EmptyState
          description={labels.emptyDescription}
          icon={<UsersIcon size={28} />}
          title={labels.empty}
        />
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 rounded-2xl px-5 py-4"
              key={member.id}
              style={{ background: "rgba(255,255,255,0.46)", border: `0.5px solid ${STUDIO.rule}` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <StudioCrest icon={UsersIcon} label={member.name} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm" style={{ color: STUDIO.ink }}>
                    {member.name || labels.unnamed}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: STUDIO.ink4 }}>
                    {member.email ?? "—"}
                  </p>
                </div>
              </div>
              <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
                {member.campusName ?? labels.unknownCampus}
              </p>
              <div className="min-w-0">
                <p className="truncate text-xs" style={{ color: STUDIO.ink3 }}>
                  {member.planName}
                </p>
                <p className="mt-1 truncate text-xs" style={{ color: STUDIO.ink4 }}>
                  {formatDate(member.expiryDate)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
```

Check `SearchToolbar`'s props: if `filters`/`activeFilter`/`onFilterChange` are required, pass `filters={[]}`, `activeFilter=""`, `onFilterChange={() => undefined}` (look at its interface in `../../_components/search-toolbar.tsx`). If `StudioCrest`'s `label` is used for initials, an empty name is fine.

- [ ] **Step 5: Page**

Replace `members/page.tsx`:

```tsx
import { Button } from "@repo/ui/components/ui/button";
import { ScanLine } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireNavAccess } from "@/lib/authorization";
import { parseListParams } from "@/lib/list-params";
import { getRosterStatus, listRosterMembers } from "../_actions/members";
import { PageHeader } from "../_components/page-header";
import { PaginationBar } from "../_components/pagination-bar";
import { MembersListClient } from "./_components/members-list-client";
import { RosterRefresh } from "./_components/roster-refresh";

interface MembersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  await requireNavAccess("portal.members");
  const t = await getTranslations("adminPortal.members");
  const tPass = await getTranslations("adminPortal.memberPass");
  const format = await getFormatter();
  const params = parseListParams(await searchParams);

  const [{ rows: members, total }, status] = await Promise.all([
    listRosterMembers(params),
    getRosterStatus(),
  ]);

  const formatAt = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  let statusText = status.lastRefreshedAt
    ? t("roster.lastRefreshed", { date: formatAt(status.lastRefreshedAt) })
    : t("roster.neverRefreshed");
  if (status.lastFailedAt) {
    statusText = `${statusText} · ${t("roster.lastFailed", { date: formatAt(status.lastFailedAt) })}`;
  }

  return (
    <div className="pb-12">
      <PageHeader description={t("description")} title={t("title")}>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/members/scan/links">{tPass("manageLinks")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/members/scan/access">{tPass("manageAccess")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/members/scan">
              <ScanLine className="mr-2 h-4 w-4" />
              {tPass("openScanner")}
            </Link>
          </Button>
        </div>
      </PageHeader>
      <div className="mb-4">
        <RosterRefresh
          canRefresh={status.canRefresh}
          labels={{
            alreadyRunning: t("roster.alreadyRunning"),
            notConfigured: t("roster.notConfigured"),
            queued: t("roster.queued"),
            refresh: t("roster.refresh"),
            refreshing: t("roster.refreshing"),
          }}
          running={status.running}
          statusText={statusText}
        />
      </div>
      <MembersListClient
        initialQuery={params.q}
        labels={{
          empty: t("empty"),
          emptyDescription: t("emptyDescription"),
          searchPlaceholder: t("searchPlaceholder"),
          unknownCampus: t("unknownCampus"),
          unnamed: t("unnamed"),
        }}
        members={members}
      />
      <PaginationBar page={params.page} size={params.size} sizeSelectable total={total} />
    </div>
  );
}
```

- [ ] **Step 6: Type-check, lint, test**

Run: `bun run check-types --filter=admin && cd apps/admin && bun test src/lib && cd ../.. && bun x ultracite check apps/admin/src/app/\(portal\)/members`
Expected: all pass. Fix any `SearchToolbar` prop errors per Step 4's note.

- [ ] **Step 7: Commit**

```bash
bun x ultracite fix "apps/admin/src/app/(portal)/members" packages/i18n/messages
git add "apps/admin/src/app/(portal)/members" packages/i18n/messages/en/adminPortal.json packages/i18n/messages/no/adminPortal.json
git commit -m "feat(admin): members page shows the 24SevenOffice roster

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Whole-repo verification and handoff

- [ ] **Step 1: Repo-wide checks**

Run: `bun run check-types && bun run lint && (cd packages/connectors && bun test) && (cd functions/member-roster-sync && bun test) && (cd apps/admin && bun test)`
Expected: all green. Paste any failure output verbatim to the user rather than summarising.

- [ ] **Step 2: Local end-to-end run of the sync against real 24SO (only with user approval — it writes to the production `member_roster` table)**

Ask the user first. If approved, run from repo root:

```bash
bun --env-file=apps/admin/.env.local -e '
const { default: main } = await import("./functions/member-roster-sync/src/main.ts");
await main({ log: console.log, error: console.error, res: { json: (d, s) => console.log(s ?? 200, d) } });
'
```

Expected: logs with plan/member/company/invoice counts and a final `200 { ok: true, members: N, … }`. `APPWRITE_FUNCTION_ID` is unset locally, so the overlap guard lists nothing; that's fine for a manual run. Compare `members` with the Postman tree count for active categories.

- [ ] **Step 3: Handoff notes for the user**

Report: push the `member_roster` table (`appwrite push tables`), create the function in the console per `functions/member-roster-sync/README.md`, set `MEMBER_ROSTER_FUNCTION_ID` on the admin site, then pull the function config.
