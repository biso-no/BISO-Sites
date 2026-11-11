# Expense Booking on Receipt Dates — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Book each reimbursement receipt in Finago on the receipt's own date, move dates out of closed periods, and record every booking outcome in a new `expense_events` history table.

**Architecture:** Pure date logic and the per-date transaction builder live in the 24SevenOffice connector (`packages/connectors/src/24sevenoffice`), next to two period sources: SOAP `GetFiscalYears` (year locks) and REST `/fiscalperiods` (monthly periods). `apps/api`'s `postApprovedExpense` resolves each receipt's booking date before posting, lets the connector retry month by month on a closed-period rejection, then stores `booked_date` per attachment and writes history events best-effort.

**Tech Stack:** TypeScript, Bun workspaces, `bun:test` (connectors), Vitest (apps/api, packages/api), openapi-fetch (Finago REST), `soap` (Finago SOAP), Appwrite TablesDB via `@repo/api/server`.

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md` (Stage 1, plus the `expense_events` table from Stage 4's "History" section, which the spec moves into Stage 1).

## Global Constraints

- Work only in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never `cd` to the main checkout. Never push. The worktree has no `node_modules` yet: run `bun install` at its root once before Task 1. The `.env.local` files are symlinked from the main checkout.
- Bun only (`bun`, `bun x`), never npm/pnpm.
- Never write to the live Finago company or production Appwrite. Tests use pure functions and mocks. Read-only GETs are allowed for manual checks only.
- `packages/api/types/appwrite.ts` is never hand-edited: regenerate it from the local config with the Appwrite CLI (Task 1 gives the exact commands).
- All dates passed around are `YYYY-MM-DD` strings. Receipt dates are read in the `Europe/Oslo` time zone.
- Comment to place on the SOAP year-lock code, verbatim: `Replace with REST /fiscalperiods once Finago returns a lock flag there.`
- Closed-period retries: at most **12** shifts per posting.
- A history-event write must never change a posting's outcome.
- Before each commit: `bun x ultracite fix <changed files>`. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Type checks are the only compile signal: `bun run check-types --filter=<pkg>` (Next builds ignore type errors).

## Review Focus

- An event write that throws after Finago accepted the transaction: the expense must end `success` with the transaction id stored, never `failed` (a `failed` row invites a manual re-post, which would double-book). → Task 6, `keeps success when the history write fails`.
- Amounts with øre spread over several dates (e.g. 33.33 + 33.33 on one date, 33.34 on another): every date group must balance to exactly zero, or Finago rejects the voucher. → Task 3, `balances every date group to zero with øre amounts`.
- A receipt date stored as Oslo midnight in UTC (`2026-10-09T22:00:00.000Z`) must book on 2026-10-10, not the 9th. → Task 6, `receiptDateInOslo reads the Oslo calendar day`.
- Two receipts whose dates shift into the same period must share one credit line for that date, not produce two 2400 lines with the same date. → Task 4, `merges shifted lines into the next group's date`.
- A Finago rejection that is not about a closed period (e.g. an unknown account) must be tried exactly once and surface unchanged; no retry loop. → Task 4, `does not retry an unrelated error`.

---

### Task 1: `expense_events` table and `booked_date` column

**Files:**
- Modify: `packages/api/appwrite.config.json` (add a table after `expense_approval_issues`; add one column to `expense_attachments`)
- Modify: `packages/api/types/appwrite.ts` (regenerated, not hand-edited)
- Modify: `packages/api/appwrite-config.test.ts`
- Modify: `apps/docs/content/docs/developers/change-it/data-model.mdx:56`

**Interfaces:**
- Produces: table `app.expense_events` with columns `expense_id` (string 64, required), `actor_kind` (enum `student|approver|admin|ai|system`, required), `action` (enum `submitted|ai_classified|ai_account_chosen|edited|approved|rejected|approver_resolved|notified|booked|booking_failed|date_shifted`, required), `actor_email` (string 320), `actor_name` (string 256), `attachment_id` (string 64), `field` (string 64), `before` (string 2000), `after` (string 2000), `note` (string 2000); index `idx_expense_id` (key, `expense_id` ASC); `$permissions: ["read(\"team:sg-app-dept-operationsunit\")"]`, `rowSecurity: false`, `databaseId: "app"`, `name: "Expense Events"`, `enabled: true`.
- Produces: `expense_attachments.booked_date` (datetime, not required, `format: ""`, `default: null`), mirroring the existing `date` column's JSON shape.
- Produces: generated types `ExpenseEvents` and the `booked_date: string | null` field on `ExpenseAttachments`, plus the enums the generator emits for `actor_kind` and `action`.

- [ ] **Step 1: Write the failing config test** in `packages/api/appwrite-config.test.ts`, inside the existing top-level `describe`:

```ts
test("expense_events is server-written and readable only by the Operations Unit", () => {
  const table = loadConfig().tables.find((t) => t.$id === "expense_events");
  expect(table).toBeDefined();
  expect(table?.$permissions).toEqual([
    'read("team:sg-app-dept-operationsunit")',
  ]);
  expect(table?.columns?.map((c) => c.key)).toEqual(
    expect.arrayContaining(["expense_id", "actor_kind", "action", "note"])
  );
  expect(table?.indexes?.some((i) => i.columns?.[0] === "expense_id")).toBe(true);
});

test("expense_attachments records the date each line was booked on", () => {
  const table = loadConfig().tables.find((t) => t.$id === "expense_attachments");
  const column = table?.columns?.find((c) => c.key === "booked_date");
  expect(column?.type).toBe("datetime");
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd packages/api && bun run test appwrite-config.test.ts`
Expected: FAIL on both new tests (`expected undefined to be defined`).

- [ ] **Step 3: Add the table and the column** to `packages/api/appwrite.config.json` with the shapes in the Interfaces block. Copy each column's JSON shape from existing columns: plain strings from `expense_approval_issues.reason` (`"encrypt": false`, `"default": null`, `"array": false`), enums from `expense_approvals.status` (`"format": "enum"`, `"elements": [...]`, `"default": null` since both are required), the index from `expense_approval_issues.idx_status`.

- [ ] **Step 4: Run the test again**

Run: `cd packages/api && bun run test appwrite-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Regenerate the types from the local config**

```bash
cd packages/api
TMP=$(mktemp -d)
appwrite types -l ts "$TMP" < /dev/null
cp "$TMP/appwrite.d.ts" types/appwrite.ts
sed -i '' "s#appwrite types -l ts $TMP#appwrite types -l ts ./types#" types/appwrite.ts
cd ../.. && bun x ultracite fix packages/api/types/appwrite.ts
git diff --stat packages/api/types/appwrite.ts
```

Expected: the diff touches only the new `ExpenseEvents` type, its two enums, and `booked_date` on `ExpenseAttachments` (formatting noise means the generator's style differs from the file's; if more than ~60 lines change, inspect and revert unrelated hunks).

- [ ] **Step 6: Type-check the packages that import the types**

Run: `bun run check-types --filter=@repo/api --filter=api`
Expected: no errors.

- [ ] **Step 7: Add `expense_events` to the Expenses row** of the table at `apps/docs/content/docs/developers/change-it/data-model.mdx:56`.

- [ ] **Step 8: Commit**

```bash
git add packages/api/appwrite.config.json packages/api/types/appwrite.ts packages/api/appwrite-config.test.ts apps/docs/content/docs/developers/change-it/data-model.mdx
git commit -m "feat(api): expense_events history table and booked_date on attachments"
```

---

### Task 2: Period sources — SOAP year locks and REST monthly periods

**Files:**
- Create: `packages/connectors/src/24sevenoffice/fiscal-years.ts`
- Create: `packages/connectors/src/24sevenoffice/fiscal-years.test.ts`
- Create: `packages/connectors/src/24sevenoffice/rest/fiscal-periods.ts`
- Create: `packages/connectors/src/24sevenoffice/rest/fiscal-periods.test.ts`
- Modify: `packages/connectors/src/24sevenoffice/client.ts` (`WSDL_URLS`)
- Modify: `packages/connectors/src/24sevenoffice/rest/index.ts`, `packages/connectors/src/24sevenoffice/index.ts` (exports)

**Interfaces:**
- Produces (`fiscal-years.ts`):
  - `interface FiscalYearLock { startingDate: string; isLocked: boolean }`
  - `interface GetFiscalYearsResult { GetFiscalYearsResult?: { FiscalYear?: RawFiscalYear | RawFiscalYear[] | null } | null }` where `RawFiscalYear = { StartingDate?: Date | string | null; EndingDate?: Date | string | null; IsLocked?: boolean | string | null }`
  - `parseFiscalYears(result: GetFiscalYearsResult | null | undefined): FiscalYearLock[]` — sorted ascending by `startingDate`; rows without a start date dropped; `IsLocked` `true` or `"true"` → `true`.
  - `getFiscalYearLocks(): Promise<FiscalYearLock[]>` — `getValidSession()` + `createAuthenticatedClient("transaction", session)` + `GetFiscalYearsAsync({})`.
- Produces (`rest/fiscal-periods.ts`):
  - `interface FiscalPeriod { startingDate: string; endingDate: string }`
  - `toFiscalPeriods(rows: components["schemas"]["AccountingPeriod"][]): FiscalPeriod[]` — keeps `type === "Period"` rows with both dates, sorted ascending by `startingDate`.
  - `listFiscalPeriods(): Promise<FiscalPeriod[]>` — `finago.GET("/fiscalperiods", { params: { query: { type: "Period" }, header: { Authorization: "" } } })`; throws `[Finago] list fiscal periods failed: …` on error.
- `WSDL_URLS.transaction = "https://api.24sevenoffice.com/Economy/Accounting/V001/TransactionService.asmx?wsdl"`

- [ ] **Step 1: Write the failing tests**

`fiscal-years.test.ts`:
```ts
test("parses Date and string start dates, sorted, with lock flags", () => {
  expect(
    parseFiscalYears({
      GetFiscalYearsResult: {
        FiscalYear: [
          { StartingDate: "2026-01-01T00:00:00", IsLocked: false },
          { StartingDate: new Date("2025-01-01T00:00:00.000Z"), IsLocked: true },
          { StartingDate: null, IsLocked: true },
        ],
      },
    })
  ).toEqual([
    { startingDate: "2025-01-01", isLocked: true },
    { startingDate: "2026-01-01", isLocked: false },
  ]);
});
test("accepts a single FiscalYear object and an empty result", () => {
  expect(parseFiscalYears({ GetFiscalYearsResult: { FiscalYear: { StartingDate: "2026-01-01", IsLocked: "true" } } }))
    .toEqual([{ startingDate: "2026-01-01", isLocked: true }]);
  expect(parseFiscalYears(null)).toEqual([]);
});
```

`rest/fiscal-periods.test.ts`:
```ts
test("keeps monthly periods only, sorted", () => {
  expect(
    toFiscalPeriods([
      { type: "Period", startingDate: "2026-11-01", endingDate: "2026-11-30" },
      { type: "Year", startingDate: "2026-01-01", endingDate: "2026-12-31" },
      { type: "Period", startingDate: "2026-10-01", endingDate: "2026-10-31" },
      { type: "Period", startingDate: "2026-12-01" },
    ])
  ).toEqual([
    { startingDate: "2026-10-01", endingDate: "2026-10-31" },
    { startingDate: "2026-11-01", endingDate: "2026-11-30" },
  ]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd packages/connectors && bun test src/24sevenoffice/fiscal-years.test.ts src/24sevenoffice/rest/fiscal-periods.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement both modules** per the Interfaces block, following the shape of `tax-codes.ts` (raw types, parser, thin fetcher). A `Date` start becomes `toISOString().slice(0, 10)`; a string start becomes its first 10 characters. Put the verbatim Global Constraints comment above `getFiscalYearLocks`. Add the `transaction` WSDL and the exports.

- [ ] **Step 4: Run the tests again**

Run: `cd packages/connectors && bun test src/24sevenoffice/fiscal-years.test.ts src/24sevenoffice/rest/fiscal-periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Check both against the live API (read-only)**

```bash
cd packages/connectors
cat > ./periods-check.ts <<'EOF'
import { getFiscalYearLocks } from "./src/24sevenoffice/fiscal-years";
import { listFiscalPeriods } from "./src/24sevenoffice/rest/fiscal-periods";
console.log((await getFiscalYearLocks()).slice(-4));
console.log((await listFiscalPeriods()).slice(0, 2));
EOF
bun --env-file=../../apps/api/.env.local ./periods-check.ts; rm ./periods-check.ts
```

Expected: years include `{ startingDate: "2025-01-01", isLocked: true }` and `{ startingDate: "2026-01-01", isLocked: false }`; periods are monthly `{ startingDate, endingDate }` pairs.

- [ ] **Step 6: Type-check and commit**

Run: `bun run check-types --filter=@repo/connectors` → no errors.

```bash
git add packages/connectors/src/24sevenoffice
git commit -m "feat(connectors): Finago fiscal year locks (SOAP) and monthly periods (REST)"
```

---

### Task 3: Per-date expense transaction builder

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/rest/transactions.ts` (`ExpenseReceiptLine`, `buildExpenseTransactionInput`)
- Test: `packages/connectors/src/24sevenoffice/rest/transactions.test.ts`

**Interfaces:**
- Produces: `ExpenseReceiptLine` gains `date?: string` (YYYY-MM-DD; falls back to the params `date`) and `ref?: string` (our attachment id; never sent to Finago).
- Produces: `buildExpenseTransactionInput(params): TransactionInputT` now emits one debit line per receipt with `date`, then **one supplier-debt credit line per distinct date**, in ascending date order, each with that `date`, the same `invoice` (bank account, due date, number) and `dimensions`. Top-level `date` = the latest line date.

- [ ] **Step 1: Write the failing tests** (add to the existing `describe("buildExpenseTransactionInput")`; the existing tests keep passing because undated receipts all fall back to `base.date`):

```ts
test("dates each debit line with its receipt date and credits 2400 once per date", () => {
  const input = buildExpenseTransactionInput({
    ...base,
    receipts: [
      { accountNumber: 7140, amount: 100, date: "2026-08-14" },
      { accountNumber: 7140, amount: 200, date: "2026-10-02" },
      { accountNumber: 7140, amount: 50, date: "2026-08-14" },
    ],
  });
  const credits = input.lines.filter((l) => l.amount < 0);
  expect(credits.map((l) => [l.date, l.amount])).toEqual([
    ["2026-08-14", -150],
    ["2026-10-02", -200],
  ]);
  expect(credits.every((l) => l.invoice?.bankAccount === "1234.56.78901")).toBe(true);
  expect(input.lines.filter((l) => l.amount > 0).map((l) => l.date)).toEqual([
    "2026-08-14", "2026-10-02", "2026-08-14",
  ]);
  expect(input.date).toBe("2026-10-02");
});

test("balances every date group to zero with øre amounts", () => {
  const input = buildExpenseTransactionInput({
    ...base,
    receipts: [
      { accountNumber: 7360, amount: 33.33, date: "2026-09-01" },
      { accountNumber: 7360, amount: 33.33, date: "2026-09-01" },
      { accountNumber: 7360, amount: 33.34, date: "2026-09-15" },
    ],
  });
  const byDate = new Map<string, number>();
  for (const line of input.lines) {
    const key = line.date ?? input.date;
    byDate.set(key, Math.round(((byDate.get(key) ?? 0) + line.amount) * 100));
  }
  for (const cents of byDate.values()) expect(cents).toBe(0);
});

test("never sends the internal ref to Finago", () => {
  const input = buildExpenseTransactionInput({
    ...base,
    receipts: [{ accountNumber: 7140, amount: 10, ref: "att-1" }],
  });
  expect(JSON.stringify(input)).not.toContain("att-1");
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/transactions.test.ts`
Expected: the three new tests FAIL; existing tests PASS.

- [ ] **Step 3: Implement the grouping in `buildExpenseTransactionInput`.** Sum each date group in integer øre (`Math.round(amount * 100)`) from the already-rounded debit amounts, and credit `-(sum / 100)`, so each group balances exactly.

- [ ] **Step 4: Run the tests again**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/transactions.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/connectors/src/24sevenoffice/rest/transactions.ts packages/connectors/src/24sevenoffice/rest/transactions.test.ts
git commit -m "feat(connectors): book reimbursement lines on their receipt dates"
```

---

### Task 4: Booking-date rules and closed-period retry

**Files:**
- Create: `packages/connectors/src/24sevenoffice/rest/booking-dates.ts`
- Create: `packages/connectors/src/24sevenoffice/rest/booking-dates.test.ts`
- Modify: `packages/connectors/src/24sevenoffice/rest/transactions.ts` (`postExpenseTransaction`, new `postWithClosedPeriodFallback`)
- Modify: `packages/connectors/src/24sevenoffice/rest/index.ts`, `packages/connectors/src/24sevenoffice/index.ts` (exports)

**Interfaces:**
- Consumes: `FiscalYearLock` (Task 2), `FiscalPeriod` (Task 2), `ExpenseReceiptLine` with `date`/`ref` (Task 3).
- Produces (`booking-dates.ts`):
  - `type BookingDateReason = "missing_date" | "future_date" | "locked_year" | "closed_period"`
  - `interface ResolvedBookingDate { date: string; reason: BookingDateReason | null }`
  - `resolveBookingDate(input: { receiptDate: string | null; today: string; locks: FiscalYearLock[]; periods: FiscalPeriod[] }): ResolvedBookingDate` — rules, in order: no date → `today` (`missing_date`); date after `today` → `today` (`future_date`); then if the fiscal year containing the date (the lock with the greatest `startingDate` ≤ date) is locked → the first period start (from `periods`) on or after the `startingDate` of the first **unlocked** year after it, or that year's `startingDate` when no period matches (`locked_year`, which replaces an earlier reason). No unlocked year after → throw `Error("No open fiscal year after <date>")`. Empty `locks` → no lock check.
  - `nextPeriodStart(date: string, periods: FiscalPeriod[]): string` — first `startingDate` strictly after `date`; with none, the first day of the calendar month after `date`.
  - `isClosedPeriodError(message: string): boolean` — true only when the message matches `/period|periode/i` **and** `/lock|låst|closed|stengt|sperret|no open|not open|ikke åpen/i`.
  - `periodContaining(date: string, periods: FiscalPeriod[]): FiscalPeriod` — the period with `startingDate ≤ date ≤ endingDate`; with none, that date's calendar month.
  - `interface DateShift { ref: string | null; from: string; to: string; reason: BookingDateReason; finagoMessage?: string }` — one entry per moved line.
- Produces (`transactions.ts`):
  - `interface PostedExpenseTransaction { transactionId: string; shifts: DateShift[] }`
  - `postWithClosedPeriodFallback(input: { receipts: ExpenseReceiptLine[]; periods: FiscalPeriod[]; post: (receipts: ExpenseReceiptLine[]) => Promise<string>; maxShifts?: number }): Promise<PostedExpenseTransaction>` — calls `post`; on an error whose message `isClosedPeriodError`, takes the earliest line date, moves **every line dated inside that date's period** (`periodContaining`) to `nextPeriodStart(earliest, periods)`, records one `closed_period` `DateShift` per moved line (with Finago's message), and calls `post` again. Each retry counts as one shift toward `maxShifts` (default `12`); past it, rethrows the last error. Any other error is rethrown at once. Receipts keep their input order.
  - `postExpenseTransaction(params: PostExpenseTransactionParams & { periods?: FiscalPeriod[] }): Promise<PostedExpenseTransaction>` — builds and POSTs through `postWithClosedPeriodFallback` (`periods` defaults to `[]`). Return type changes from `Promise<string>`; in this task, change the one caller in `apps/api/src/lib/expense-posting.ts` to `const { transactionId } = await postExpenseTransaction({...})` so everything still compiles. Task 6 does the real wiring.

- [ ] **Step 1: Write the failing tests** in `booking-dates.test.ts` (dates from the spec's verified 2026-11-11 state: 2025 locked, 2026 open):

```ts
const locks = [
  { startingDate: "2024-01-01", isLocked: true },
  { startingDate: "2025-01-01", isLocked: true },
  { startingDate: "2026-01-01", isLocked: false },
];
const periods = [
  { startingDate: "2026-01-01", endingDate: "2026-01-31" },
  { startingDate: "2026-02-01", endingDate: "2026-02-28" },
  { startingDate: "2026-10-01", endingDate: "2026-10-31" },
  { startingDate: "2026-11-01", endingDate: "2026-11-30" },
];
const today = "2026-11-11";

test("keeps a date in an open year", () => {
  expect(resolveBookingDate({ receiptDate: "2026-10-10", today, locks, periods }))
    .toEqual({ date: "2026-10-10", reason: null });
});
test("moves a date in a locked year to the first period of the next open year", () => {
  expect(resolveBookingDate({ receiptDate: "2025-12-18", today, locks, periods }))
    .toEqual({ date: "2026-01-01", reason: "locked_year" });
});
test("skips several locked years", () => {
  expect(resolveBookingDate({ receiptDate: "2024-06-01", today, locks, periods }).date).toBe("2026-01-01");
});
test("uses today for a missing or future date", () => {
  expect(resolveBookingDate({ receiptDate: null, today, locks, periods }))
    .toEqual({ date: today, reason: "missing_date" });
  expect(resolveBookingDate({ receiptDate: "2027-03-01", today, locks, periods }))
    .toEqual({ date: today, reason: "future_date" });
});
test("throws when no open year follows", () => {
  expect(() => resolveBookingDate({
    receiptDate: "2025-05-01", today, periods,
    locks: [{ startingDate: "2025-01-01", isLocked: true }],
  })).toThrow("No open fiscal year after 2025-05-01");
});
test("nextPeriodStart uses the period list, then the next calendar month", () => {
  expect(nextPeriodStart("2026-10-10", periods)).toBe("2026-11-01");
  expect(nextPeriodStart("2026-11-20", periods)).toBe("2026-12-01");
});
test("recognises closed-period errors conservatively", () => {
  expect(isClosedPeriodError('{"message":"No open financial period for date 2025-10-10"}')).toBe(true);
  expect(isClosedPeriodError("Perioden er låst")).toBe(true);
  expect(isClosedPeriodError('{"message":"Account 9999 does not exist"}')).toBe(false);
  expect(isClosedPeriodError("Request closed by peer")).toBe(false);
});
```

And in `transactions.test.ts`:

```ts
describe("postWithClosedPeriodFallback", () => {
  const closed = new Error('[Finago] post expense transaction failed: {"message":"Period is locked"}');
  const periods = [
    { startingDate: "2026-09-01", endingDate: "2026-09-30" },
    { startingDate: "2026-10-01", endingDate: "2026-10-31" },
  ];

  test("merges shifted lines into the next group's date", async () => {
    const seen: string[][] = [];
    let calls = 0;
    const result = await postWithClosedPeriodFallback({
      receipts: [
        { accountNumber: 7140, amount: 10, date: "2026-09-12", ref: "a" },
        { accountNumber: 7140, amount: 15, date: "2026-09-20", ref: "c" },
        { accountNumber: 7140, amount: 20, date: "2026-10-01", ref: "b" },
      ],
      periods,
      post: async (receipts) => {
        seen.push(receipts.map((r) => r.date ?? ""));
        calls += 1;
        if (calls === 1) throw closed;
        return "tx-1";
      },
    });
    // The whole closed September moves in one retry and lands on b's date,
    // so the builder (Task 3) gives the three lines a single 2400 line.
    expect(seen).toEqual([
      ["2026-09-12", "2026-09-20", "2026-10-01"],
      ["2026-10-01", "2026-10-01", "2026-10-01"],
    ]);
    expect(result).toEqual({
      transactionId: "tx-1",
      shifts: [
        { ref: "a", from: "2026-09-12", to: "2026-10-01", reason: "closed_period", finagoMessage: closed.message },
        { ref: "c", from: "2026-09-20", to: "2026-10-01", reason: "closed_period", finagoMessage: closed.message },
      ],
    });
  });

  test("does not retry an unrelated error", async () => {
    let calls = 0;
    const failure = new Error('[Finago] post expense transaction failed: {"message":"Account 9999 does not exist"}');
    await expect(postWithClosedPeriodFallback({
      receipts: [{ accountNumber: 9999, amount: 10, date: "2026-10-03" }],
      periods,
      post: () => { calls += 1; return Promise.reject(failure); },
    })).rejects.toBe(failure);
    expect(calls).toBe(1);
  });

  test("gives up after maxShifts", async () => {
    let calls = 0;
    await expect(postWithClosedPeriodFallback({
      receipts: [{ accountNumber: 7140, amount: 10, date: "2026-01-05" }],
      periods: [],
      maxShifts: 3,
      post: () => { calls += 1; return Promise.reject(closed); },
    })).rejects.toBe(closed);
    expect(calls).toBe(4);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/`
Expected: the new tests FAIL (missing exports); earlier tests PASS.

- [ ] **Step 3: Implement `booking-dates.ts`, `postWithClosedPeriodFallback` and the new `postExpenseTransaction`** per the Interfaces block. Note in a comment on `isClosedPeriodError` that Finago's real closed-period message has not been observed yet, so the match is deliberately narrow and `postWithClosedPeriodFallback` must `console.warn` the raw message each time it retries.

- [ ] **Step 4: Run the tests again**

Run: `cd packages/connectors && bun test src/24sevenoffice/rest/`
Expected: all PASS.

- [ ] **Step 5: Type-check** — `bun run check-types --filter=@repo/connectors --filter=api` passes (the caller now destructures `transactionId`).

- [ ] **Step 6: Commit**

```bash
git add packages/connectors/src/24sevenoffice apps/api/src/lib/expense-posting.ts
git commit -m "feat(connectors): booking-date rules and closed-period retry for reimbursements"
```

---

### Task 5: History event writer

**Files:**
- Create: `apps/api/src/lib/expense-events.ts`
- Create: `apps/api/src/lib/expense-events.test.ts`

**Interfaces:**
- Consumes: table `expense_events` (Task 1).
- Produces:
  - `type ExpenseEventActorKind = "student" | "approver" | "admin" | "ai" | "system"`
  - `type ExpenseEventAction = "submitted" | "ai_classified" | "ai_account_chosen" | "edited" | "approved" | "rejected" | "approver_resolved" | "notified" | "booked" | "booking_failed" | "date_shifted"`
  - `interface ExpenseEventInput { expenseId: string; actorKind: ExpenseEventActorKind; action: ExpenseEventAction; actorEmail?: string | null; actorName?: string | null; attachmentId?: string | null; field?: string | null; before?: string | null; after?: string | null; note?: string | null }`
  - `interface ExpenseEventsDb { createRow: (databaseId: string, tableId: string, rowId: string, data: Record<string, unknown>) => Promise<unknown> }`
  - `recordExpenseEvents(db: ExpenseEventsDb, events: ExpenseEventInput[]): Promise<void>` — one `createRow("app", "expense_events", ID.unique(), {...snake_case columns})` per event, in order; text fields truncated to their column sizes (`before`/`after`/`note` 2000, `field` 64, `actor_name` 256, `actor_email` 320) with a trailing `...` when cut; **never throws** — each failed write is `console.error`ed and the rest continue.

- [ ] **Step 1: Write the failing tests** (Vitest):

```ts
it("writes each event with snake_case columns", async () => {
  const db = { createRow: vi.fn().mockResolvedValue({}) };
  await recordExpenseEvents(db, [{ expenseId: "e1", actorKind: "system", action: "booked", note: "tx-1" }]);
  expect(db.createRow).toHaveBeenCalledWith("app", "expense_events", expect.any(String),
    expect.objectContaining({ expense_id: "e1", actor_kind: "system", action: "booked", note: "tx-1" }));
});
it("truncates long notes to 2000 characters", async () => {
  const db = { createRow: vi.fn().mockResolvedValue({}) };
  await recordExpenseEvents(db, [{ expenseId: "e1", actorKind: "system", action: "booking_failed", note: "x".repeat(5000) }]);
  expect(db.createRow.mock.calls[0][3].note).toHaveLength(2000);
});
it("never throws and keeps writing after a failure", async () => {
  const db = { createRow: vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({}) };
  await expect(recordExpenseEvents(db, [
    { expenseId: "e1", actorKind: "system", action: "date_shifted" },
    { expenseId: "e1", actorKind: "system", action: "booked" },
  ])).resolves.toBeUndefined();
  expect(db.createRow).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `cd apps/api && bun run test src/lib/expense-events.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `recordExpenseEvents`** per the Interfaces block (`ID` from `@repo/api`).

- [ ] **Step 4: Run the tests again** — same command, expected PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/expense-events.ts apps/api/src/lib/expense-events.test.ts
git commit -m "feat(api): best-effort expense history writer"
```

---

### Task 6: Wire receipt dates into `postApprovedExpense`

**Files:**
- Create: `apps/api/src/lib/receipt-date.ts`
- Create: `apps/api/src/lib/receipt-date.test.ts`
- Modify: `apps/api/src/lib/expense-posting.ts` (`buildReceiptLines`, `postApprovedExpense`)
- Create: `apps/api/src/lib/expense-posting-dates.test.ts`
- Modify: `apps/docs/content/docs/developers/reference/accounting.mdx` (Reimbursements section, `covers`)

**Interfaces:**
- Consumes: `getFiscalYearLocks`, `listFiscalPeriods`, `resolveBookingDate`, `postExpenseTransaction` (returns `PostedExpenseTransaction`), `DateShift` from `@repo/connectors/24sevenoffice` (Tasks 2–4); `recordExpenseEvents` (Task 5).
- Produces (`receipt-date.ts`):
  - `receiptDateInOslo(value: string | null | undefined): string | null` — the `Europe/Oslo` calendar day of an Appwrite datetime string (`Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo" })`); `null` for empty or unparseable input.
  - `todayInOslo(now?: Date): string`.
- Behaviour of `postApprovedExpense` after this task:
  1. Load year locks and periods once, in parallel. If `getFiscalYearLocks` fails, `console.warn` and continue with `[]` (the closed-period retry still protects). If `listFiscalPeriods` fails, continue with `[]` (`nextPeriodStart` falls back to calendar months). *(Ruling R1.)*
  2. `buildReceiptLines` sets `ref = att.$id` and `date = resolveBookingDate({ receiptDate: receiptDateInOslo(att.date), today: todayInOslo(), locks, periods }).date`, and collects a `DateShift` (`ref: att.$id`, `from` = the Oslo receipt date or `""`, `to`, `reason`) for every line whose `reason` is not `null`. Return type becomes `{ lines: ExpenseReceiptLine[]; shifts: DateShift[] }`.
  3. Call `postExpenseTransaction({ …existing fields…, date: todayInOslo(), periods })`.
  4. On success: update the expense to `success` + transaction id **first** (as today), then `updateRow("app", "expense_attachments", ref, { booked_date: <final date> })` for each posted line, then `recordExpenseEvents` with one `date_shifted` event per shift (pre-post and retry shifts; `attachment_id` = the ref, `before` = from, `after` = to, `note` = reason plus Finago's message when present) and one `booked` event (`note` = transaction id). Wrap the `booked_date` updates in a try/catch that only logs. *(Ruling R2: nothing after the success write may flip the status.)*
  5. On failure: keep today's behaviour (status `failed`, claim kept, rethrow) and also `recordExpenseEvents` a `booking_failed` event with the error message as `note`.
  6. All events use `actorKind: "system"`.

- [ ] **Step 1: Write the failing date tests** in `receipt-date.test.ts`:

```ts
it("receiptDateInOslo reads the Oslo calendar day", () => {
  expect(receiptDateInOslo("2026-10-10T00:00:00.000+00:00")).toBe("2026-10-10");
  expect(receiptDateInOslo("2026-10-09T22:00:00.000Z")).toBe("2026-10-10");
  expect(receiptDateInOslo("")).toBeNull();
  expect(receiptDateInOslo("not a date")).toBeNull();
});
it("todayInOslo uses Oslo time near midnight", () => {
  expect(todayInOslo(new Date("2026-11-11T23:30:00.000Z"))).toBe("2026-11-12");
});
```

- [ ] **Step 2: Run them and see them fail** — `cd apps/api && bun run test src/lib/receipt-date.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `receipt-date.ts`**, rerun → PASS.

- [ ] **Step 4: Write the failing posting tests** in `expense-posting-dates.test.ts`. Mock with `vi.mock`, following `apps/api/src/app/api/expenses/submit/route.test.ts`: `@repo/api/server` (`createAdminClient` → `{ db, storage }` with `getRow`, `listRows`, `updateRow`, `incrementRowColumn` (returns `{ posting_lock: 1 }`), `createRow`, and `storage.getFileDownload`), `@repo/connectors/24sevenoffice` (`uploadDocument` → `{ documentId: 1 }`, `postExpenseTransaction`, `getFiscalYearLocks`, `listFiscalPeriods`; keep the real `resolveBookingDate` via `vi.importActual`), `./pdf/expense-pdf` (`generateExpensePdf` → a one-page PDF from `PDFDocument.create()`), `./expense-approval-chain` (`assertApprovedExpenseChain` resolves). Fixture: `db.getRow` returns, by table, the expense (`$id: "exp-1"`, `$sequence: 7`, `ledger_transaction_id: null`, `bank_account: "1234.56.78901"`, `campus: "1"`, `department: "101"`, `total: 300`, `userId: "u1"`, `departmentRel: { Id: "101", Name: "OSL AI Club" }`, `campusRel: { name: "Oslo" }`) or a profile (`{ name: "Test Student", email: "t@example.test" }`) for table `user`; `db.listRows` returns `{ rows: [] }`. The expense has two attachments without files (`url: ""`, `type: "application/pdf"`), `att-1` dated `2025-12-18T00:00:00.000+00:00` (locked year, amount 100) and `att-2` dated `2026-10-10T00:00:00.000+00:00` (amount 200), both with `account_number: 7140`, `tax_code: 0`.

```ts
it("posts each line on its booking date and records the shift", async () => {
  getFiscalYearLocks.mockResolvedValue([
    { startingDate: "2025-01-01", isLocked: true },
    { startingDate: "2026-01-01", isLocked: false },
  ]);
  listFiscalPeriods.mockResolvedValue([{ startingDate: "2026-01-01", endingDate: "2026-01-31" }]);
  postExpenseTransaction.mockResolvedValue({ transactionId: "tx-9", shifts: [] });

  await postApprovedExpense("exp-1");

  const receipts = postExpenseTransaction.mock.calls[0][0].receipts;
  expect(receipts.map((r) => [r.ref, r.date])).toEqual([["att-1", "2026-01-01"], ["att-2", "2026-10-10"]]);
  expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", expect.objectContaining({ status: "success", ledger_transaction_id: "tx-9" }));
  expect(db.updateRow).toHaveBeenCalledWith("app", "expense_attachments", "att-1", { booked_date: "2026-01-01" });
  const actions = db.createRow.mock.calls.filter((c) => c[1] === "expense_events").map((c) => c[3].action);
  expect(actions).toEqual(["date_shifted", "booked"]);
});

it("keeps success when the history write fails", async () => {
  getFiscalYearLocks.mockResolvedValue([]);
  listFiscalPeriods.mockResolvedValue([]);
  postExpenseTransaction.mockResolvedValue({ transactionId: "tx-9", shifts: [] });
  db.createRow.mockRejectedValue(new Error("appwrite down"));

  await expect(postApprovedExpense("exp-1")).resolves.toBeUndefined();
  expect(db.updateRow).not.toHaveBeenCalledWith("app", "expense", "exp-1", expect.objectContaining({ status: "failed" }));
});

it("still posts when the year-lock lookup fails", async () => {
  getFiscalYearLocks.mockRejectedValue(new Error("soap down"));
  listFiscalPeriods.mockResolvedValue([]);
  postExpenseTransaction.mockResolvedValue({ transactionId: "tx-9", shifts: [] });

  await postApprovedExpense("exp-1");
  expect(postExpenseTransaction).toHaveBeenCalledTimes(1);
});

it("records booking_failed and marks the expense failed", async () => {
  getFiscalYearLocks.mockResolvedValue([]);
  listFiscalPeriods.mockResolvedValue([]);
  postExpenseTransaction.mockRejectedValue(new Error("Account 9999 does not exist"));

  await expect(postApprovedExpense("exp-1")).rejects.toThrow("Account 9999");
  expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "exp-1", { status: "failed" });
  const failed = db.createRow.mock.calls.find((c) => c[1] === "expense_events" && c[3].action === "booking_failed");
  expect(failed?.[3].note).toContain("Account 9999");
});
```

- [ ] **Step 5: Run them and see them fail** — `cd apps/api && bun run test src/lib/expense-posting-dates.test.ts` → FAIL.

- [ ] **Step 6: Implement the behaviour** in `expense-posting.ts` per the Interfaces block. The existing `Query.select` keeps `"expenseAttachments.*"`, which already returns each attachment's `$id`.

- [ ] **Step 7: Run the api tests and type checks**

Run: `cd apps/api && bun run test` → all PASS.
Run: `bun run check-types --filter=api --filter=@repo/connectors --filter=@repo/api` → no errors.

- [ ] **Step 8: Update the docs.** In `apps/docs/content/docs/developers/reference/accounting.mdx` → Reimbursements, add a short "Dates" paragraph: each receipt is booked on its own date (Oslo calendar day), one supplier-debt line per date with the same reference and bank account; a receipt in a year 24SevenOffice has locked moves to the first period of the next open year (SOAP `GetFiscalYears`, because REST `/fiscalperiods` has no lock flag); if 24SevenOffice still rejects a closed month, the posting moves the earliest date to the next period and retries, up to 12 times; every move, the booking and any failure are written to `expense_events`; a missing or future receipt date books on the posting day. Add `apps/api/src/lib/expense-events.ts` and `apps/api/src/lib/receipt-date.ts` to its `covers`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lib apps/docs/content/docs/developers/reference/accounting.mdx
git commit -m "feat(api): book reimbursements on receipt dates with closed-period fallback"
```

---

## Rulings made in this plan

- **R1** — If the SOAP year-lock or REST period lookup fails, posting continues without it; the closed-period retry still guards the books. Rationale: a lookup outage shouldn't block every reimbursement, and Finago itself refuses closed dates.
- **R2** — `booked_date` updates and history events run after the `success` write and can only log on failure.
- **R3** — On a closed-period rejection the retry moves every line in the **earliest** line's period, since Finago's error may not name the date and earlier months are the ones finance closes first. Moving the whole month at once means one retry per closed month.
