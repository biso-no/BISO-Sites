# Expense Stage 1 — Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every confirmed defect from the 2026-11-17 check of the expense module (spec Part A).

**Architecture:** Targeted fixes in the existing files: approval decisions/resends (`apps/api/src/lib/expense-approval.ts`), submission decisions (`expense-submission.ts`), booking claims and retry (`expense-posting.ts`, `post-pending` route), admin actions/messages, and the student form (`apps/web/src/components/expense-v3/*`). No new tables or columns in this stage.

**Tech Stack:** Bun 1.3 monorepo, Next.js 16, Appwrite (`@repo/api`), vitest (api, web, shared), `bun test` (admin, connectors), next-intl messages in `packages/i18n/messages/{en,no}/*.json`.

**Spec:** `docs/superpowers/specs/2026-11-17-expense-agent-and-projects-design.md` (Part A).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-agent` (branch `feat/expense-agent`). Never switch branches in the main checkout. `bun install` has been run in the worktree.
- Bun only (`bun`, `bun x`), never npm/pnpm.
- No schema change in Stage 1: do not edit `packages/api/appwrite.config.json` or `packages/api/types/appwrite.ts`.
- The submit and draft API response shapes and the `expense.status` values stay unchanged (the Flutter app parses them).
- Every new user-facing string exists in both `en` and `no` message files; Norwegian reads naturally (not word-for-word).
- Admin `"use server"` files export only async functions; after touching one, run `bun run build --filter=admin` (check-types does not catch it).
- Run `bun x ultracite fix` on changed files before each commit; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test commands: api `cd apps/api && NODE_ENV=test bun x vitest run <file>`; web `cd apps/web && bun x vitest run <file>`; admin `cd apps/admin && bun test <file>`.
- Never push, deploy, or write to production data.

## Review Focus

1. **An old Teams card or email link clicked after the expense was rejected** → the approver sees "This reimbursement is no longer waiting for approval." and nothing changes (Task 1 test `refuses a token decision when the expense is no longer pending`).
2. **Retry pressed on a booked-but-unsaved expense** → the status is saved and Finago is never called again (Task 6 test `finishing never posts again`).
3. **A reopened draft with a description it already had** → the saved description is kept, not regenerated (Task 10 test `a reopened draft keeps a saved description`).
4. **A scheduled run where every approved expense is mid-booking** → the run reports them as skipped, answers 200, and does not count them as posted (Task 5 test `reports fresh claims as skipped, not posted`).
5. **A failed scan on a receipt that is a supporting bank statement** → manual entry does not demand a type for it (Task 9 test `a supporting document whose scan fails needs no type`).

---

### Task 1: Decisions and resends only on a pending expense

**Files:**
- Modify: `apps/api/src/lib/expense-approval.ts` (`ApprovalErrorCode` ~650, `decideStep` ~911, `applyDecisionOutcome` ~1012, `resendApprovalNotification` ~1261)
- Modify: `apps/api/src/app/api/expenses/resend-approval/route.ts` (return `code`, 409 for `not_pending`)
- Modify: `apps/admin/src/app/(portal)/expenses/action-result.ts` (map `not_pending`)
- Modify: `packages/i18n/messages/{en,no}/adminPortal.json` (`adminPortal.expenses.errors.not_pending`)
- Test: `apps/api/src/lib/expense-approval.test.ts`

**Interfaces:**
- Produces: `ApprovalErrorCode` gains `"not_pending"`; `resendApprovalNotification(expenseId: string): Promise<{ ok: boolean; error?: string; code?: "not_pending" }>`; private `resolveOpenIssues(db: AdminDb, expenseId: string): Promise<void>`.
- Message constant: `NOT_PENDING_ERROR = "This reimbursement is no longer waiting for approval."`

- [ ] **Step 1: Write the failing tests** in `expense-approval.test.ts`:
  - `refuses a token decision when the expense is no longer pending`: step row pending, expense `status: "rejected"` → `decideApproval({ decision: "approved", … })` resolves `{ ok: false, code: "not_pending" }`; `db.incrementRowColumn` not called.
  - Update the existing `refuses when the expense is not pending` (decideApprovalStep, ~951) to expect `code: "not_pending"`.
  - `resend refuses an expense that is not pending`: `getRow` returns `{ $id: "expense-1", status: "rejected" }` → `resendApprovalNotification("expense-1")` resolves `{ ok: false, code: "not_pending" }`; no `expense_approvals` listRows call and no Teams/email send.
  - `a rejection resolves the expense's open approval issues`: a reject decision → `db.updateRow` called with `("app", "expense_approval_issues", "issue-1", expect.objectContaining({ status: "resolved", resolved_by: "system: expense rejected" }))` for each row returned by a listRows on `expense_approval_issues` filtered by `expense_id` and `status = open`.
- [ ] **Step 2: Run** `cd apps/api && NODE_ENV=test bun x vitest run src/lib/expense-approval.test.ts` — the new tests FAIL.
- [ ] **Step 3: Implement.** In `decideStep`, right after the "already decided" branch and before `requireCurrentStep`, return `not_pending` when `expense.status !== ExpensesStatus.PENDING`. In `resendApprovalNotification`, read the expense (`Query.select(["$id","status"])`) first and return `not_pending` unless pending. In the reject branch of `applyDecisionOutcome`, call `resolveOpenIssues` (best-effort: catch and `console.error`). Route: include `code` in the JSON and use status 409 for `not_pending`. Admin: add `not_pending` to `ExpenseActionError` and `API_CODES`; messages: en "This reimbursement is no longer waiting for approval.", no "Denne refusjonen venter ikke lenger på godkjenning."
- [ ] **Step 4: Run** the same test file plus `cd apps/admin && bun test src/app/\(portal\)/expenses/expense-messages.test.ts` — PASS.
- [ ] **Step 5: Commit** `fix(expenses): decisions and resends only on a pending reimbursement`.

### Task 2: Admin approve refuses a receipt without an account

**Files:**
- Modify: `apps/api/src/lib/expense-approval.ts` (`decideApprovalStep` ~1153)
- Modify: `apps/admin/src/app/(portal)/expenses/action-result.ts`
- Modify: `packages/i18n/messages/{en,no}/adminPortal.json` (`adminPortal.expenses.errors.account_missing`)
- Test: `apps/api/src/lib/expense-approval.test.ts` (describe `receipts without an account`)

**Interfaces:**
- Consumes: existing `expenseLacksAccount(db, expenseId)` and `ACCOUNT_MISSING_ERROR`.

- [ ] **Step 1: Write the failing test** `admin approve refuses while a receipt has no account`: `decideApprovalStep({ decision: "approved", … })` on a pending step whose expense has a receipt with amount > 0 and `account_number: null` → `{ ok: false, code: "account_missing" }`; `incrementRowColumn` not called. Add `admin reject still works while a receipt has no account` → `ok: true`.
- [ ] **Step 2: Run** the api test file — FAIL.
- [ ] **Step 3: Implement** the same guard as `decideApproval` (approved + step pending + `expenseLacksAccount`) at the top of `decideApprovalStep` after the row is loaded. Admin: add `account_missing` to `ExpenseActionError` and `API_CODES`; messages: en "A receipt has no ledger account. Set the account before approving.", no "En kvittering mangler konto. Velg konto før du godkjenner."
- [ ] **Step 4: Run** api test file and admin `expense-messages.test.ts` — PASS.
- [ ] **Step 5: Commit** `fix(expenses): admin approve refuses a receipt without an account`.

### Task 3: Re-routing a general-manager step leaves the directory alone

**Files:**
- Modify: `apps/api/src/lib/expense-approval.ts` (`changeStepApprover` ~1368)
- Test: `apps/api/src/lib/expense-approval.test.ts`

The general manager is one organisation-wide entry set in Settings → Approvers. A step with `approver_role === "national"` (the general manager itself, or a president/controller fallback) must not rewrite it from one expense.

- [ ] **Step 1: Write the failing tests:**
  - `re-routing a general-manager step does not change the directory`: step `{ approver_role: "national", directory_key: "campus:5:national" }` on a Bergen expense → `changeStepApprover` resolves `{ ok: true, directorySaved: false }`; no `db.createRow`/`db.updateRow` on table `expense_approvers`; the step row's `approver_email` is updated and the new approver notified.
  - Existing department/campus re-route tests keep `directorySaved: true`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement:** skip `setAdminDirectoryApprover` when `row.approver_role === "national"`; return `directorySaved: false`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `fix(expenses): re-routing a general-manager step keeps the directory entry`.

### Task 4: Own-text account time limit; server default is nobody's choice

**Files:**
- Modify: `apps/api/src/lib/expense-submission.ts` (`AttachmentDecision.typeSource` ~83, `defaulted` ~111, `chooseAccountForText` ~375, its call site ~775)
- Modify: `apps/api/src/lib/expense-posting.ts` (`teachesType` ~415)
- Test: `apps/api/src/lib/expense-submission.test.ts`, `apps/api/src/lib/expense-posting.test.ts`

**Interfaces:**
- Produces: `AttachmentDecision.typeSource: "ai" | "student" | "legacy_app" | null` (null = server default); `export const ACCOUNT_CHOICE_TIMEOUT_MS = 8000`; `chooseAccountForText(input: { accounts; receipt; text; types; abortSignal?: AbortSignal })`; `export function teachesType(att: Pick<ExpenseAttachments, "type_source" | "cost_type" | "ai_cost_type" | "ai_confidence">): boolean`.

- [ ] **Step 1: Write the failing tests:**
  - `a server default is not recorded as the student's choice`: `decideAttachment` with amount 100, `chosen: true`, no client type, no text, no scan → `typeSource: null`, `costType: "other"`, hints contain `type_defaulted`.
  - `an old app payload with an unknown slug defaults without the app marker` → `typeSource: null`.
  - `own text stays the student's choice` → `typeSource: "student"`, `costTypeText` set.
  - `the account choice for own text is time-limited`: the mocked `generateObject` receives `abortSignal: expect.any(AbortSignal)` when called through enrichment.
  - In `expense-posting.test.ts`: `teachesType` → true for `type_source` `"ai"` and `"student"`; false for `null`; for `"legacy_app"` true only when `ai_cost_type === cost_type` and `ai_confidence >= 0.8`.
- [ ] **Step 2: Run** both files — FAIL.
- [ ] **Step 3: Implement:** `defaulted()` sets `typeSource: null` (the `base` decision keeps `"student"` so own text stays the student's); widen the type; pass `abortSignal` to `generateObject`; the call site passes `AbortSignal.timeout(ACCOUNT_CHOICE_TIMEOUT_MS)`; export `teachesType` with the rule above.
- [ ] **Step 4: Run** both files and `cd apps/api && bun run check-types` — PASS.
- [ ] **Step 5: Commit** `fix(expenses): time-limit the own-text account and never teach a server default`.

### Task 5: Booking claims, the scheduled run, and the department dimension

**Files:**
- Modify: `apps/api/src/lib/expense-posting.ts` (`postApprovedExpense` ~689, `buildAndPostLedgerTransaction` department value ~631)
- Modify: `apps/api/src/lib/expense-book-on-approval.ts` (ignore the new return value)
- Modify: `apps/api/src/app/api/expenses/post-pending/route.ts`
- Modify: `apps/api/.env.example` (uncomment `TFSO_CAMPUS_DIMENSION_TYPE="101"` with a comment that expense bookings skip the campus without it)
- Test: `apps/api/src/lib/expense-posting-retry.test.ts` (claims), new `apps/api/src/app/api/expenses/post-pending/route.test.ts`, `apps/api/src/lib/expense-posting-dates.test.ts` (department)

**Interfaces:**
- Produces: `postApprovedExpense(expenseId: string, options?: { sleep?: Sleep }): Promise<"posted" | "skipped">`.

- [ ] **Step 1: Write the failing tests:**
  - `skips a fresh claim that has no marker without taking another lock`: expense `{ status: "approved", posting_lock: 1, ledger_transaction_id: null, $updatedAt: now }` → resolves `"skipped"`; `incrementRowColumn` not called.
  - `marks a stale claim without a marker failed`: same with `$updatedAt` 20 min ago → `updateRow(... { status: "failed" })`, a `booking_failed` event, and the call rejects.
  - `returns posted after a booking` on the happy path.
  - Route test `lists the oldest approved expenses first`: `listRows` receives `Query.equal("status","approved")`, `Query.orderAsc("$updatedAt")`, `Query.limit(10)`.
  - Route test `reports fresh claims as skipped, not posted`: mocked `postApprovedExpense` returns `"skipped"` twice and `"posted"` once → JSON `{ success: true, considered: 3, posted: 1, skipped: 2, failed: 0 }`, status 200.
  - `books the department from the plain column when the relation is missing`: `departmentRel: null`, `department: "25"` → `postExpenseTransaction` receives `departmentDimensionValue: "25"`.
- [ ] **Step 2: Run** the three files — FAIL.
- [ ] **Step 3: Implement:** before the claim increment, when `posting_lock > 0` and `ledger_transaction_id` is empty, treat it like a marker claim (fresh → `"skipped"`, older than `STALE_POSTING_LEASE_MS` → mark failed + failure event + throw; the marker was never written, so Finago was never called). Return `"skipped"` on every early return and on a lost race, `"posted"` at the end. Route: order by `$updatedAt` ascending, `BATCH_SIZE = 10`, count `skipped`. Department: `expense.departmentRel?.Id ?? expense.department ?? null`.
- [ ] **Step 4: Run** the three files and `bun run check-types` in `apps/api` — PASS.
- [ ] **Step 5: Commit** `fix(expenses): booking claims never strand an expense and skips are reported`.

### Task 6: Retry finishes a booking Finago already has

**Files:**
- Modify: `apps/api/src/lib/expense-posting.ts` (`retryExpenseBooking` ~786, `bookedTransactionId` ~760)
- Modify: `packages/i18n/messages/{en,no}/adminPortal.json` (`errors.status_write_failed`)
- Test: `apps/api/src/lib/expense-posting-retry.test.ts`

**Interfaces:**
- Produces: `bookedTransactionId(db, expenseId): Promise<string | null>` returns only a parsable id (null otherwise); private `finishBookedExpense(db: AdminDb, expenseId: string, transactionId: string, actor: ApprovalActor): Promise<void>`.

- [ ] **Step 1: Write the failing tests:**
  - `finishes a failed expense whose booking is in Finago`: status `failed`, `ledger_transaction_id: "posting"`, a `booked` event with note `"tx-123 (status write failed: …)"` → resolves `{ ok: true, status: "success" }`; `updateRow` with `{ status: "success", ledger_transaction_id: "tx-123" }`; an `edited` event with `field: "status"`, `before: "failed"`, `after: "success"`.
  - `finishing never posts again`: same setup → `postExpenseTransaction` and `uploadDocument` not called; `posting_lock` not incremented.
  - `still refuses a booked event without a readable id` → `{ ok: false, code: "already_booked" }`.
  - A stored real `ledger_transaction_id` on a failed expense is finished the same way.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the finish path before the chain assert and the claim. Booked dates and examples are not written on this path (Stage 2 handles examples). Messages for `status_write_failed`: en "Finago has the booking, but saving the status failed. Press Retry to finish saving it; nothing is booked twice.", no "Finago har bokføringen, men lagring av status feilet. Trykk Prøv igjen for å fullføre lagringen; ingenting bokføres to ganger."
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `fix(expenses): retry finishes saving a booking Finago already has`.

### Task 7: Admin amount edit totals every receipt

**Files:**
- Modify: `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.ts` (~170)
- Test: `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.test.ts`

- [ ] **Step 1: Write the failing test** `recomputes the total from every receipt of the expense`: the expense row read with `Query.select(["$id","expenseAttachments.$id","expenseAttachments.amount"])` returns three receipts (one has no `expense_id`) with amounts 100, 50.5, 0 → `updateRow("app","expense",id,{ total: 150.5 })`.
- [ ] **Step 2: Run** `cd apps/admin && bun test "src/app/(portal)/expenses/[expenseId]/actions.test.ts"` — FAIL.
- [ ] **Step 3: Implement:** read the amounts through the expense relation instead of `Query.equal("expense_id", …)`.
- [ ] **Step 4: Run** the test and `bun run build --filter=admin` — PASS.
- [ ] **Step 5: Commit** `fix(admin): amount edits total every receipt of the expense`.

### Task 8: Rebuild an approval chain that has no steps

**Files:**
- Modify: `apps/api/src/lib/expense-approval.ts` (new export next to `resendApprovalNotification`)
- Create: `apps/api/src/app/api/expenses/admin/rebuild-chain/route.ts` (mirror `admin/change-approver/route.ts`: `isInternalRequest`, zod body)
- Modify: `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.ts` (new action), `.../_components/expense-steps.tsx` (button), `apps/admin/src/lib/expenses-api.ts` if it wraps api calls
- Modify: `packages/i18n/messages/{en,no}/adminPortal.json`
- Test: `apps/api/src/lib/expense-approval.test.ts`, `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.test.ts`

**Interfaces:**
- Produces: `rebuildApprovalChain(params: { expenseId: string; actor: ApprovalActor }): Promise<{ ok: true; stepsCreated: number } | { ok: false; code: "not_pending" | "has_steps" | "not_found"; error: string }>`; route `POST /api/expenses/admin/rebuild-chain` body `{ expenseId, actor }`; admin action `rebuildExpenseChain(expenseId: string): Promise<ExpenseActionResult<{ stepsCreated: number }>>` (global admins only; `forbidden` otherwise).
- The context is `buildContextFromExpense` plus the expense's `submitter_is_controller` / `submitter_is_financial_manager` and the submitter's profile name (fallback "BISO member").

- [ ] **Step 1: Write the failing tests:** api `rebuilds the chain of a pending expense with no steps` (calls `createApprovalChain` with the expense's flags; resolves `{ ok: true, stepsCreated: n }`), `refuses when steps exist` (`has_steps`), `refuses a rejected expense` (`not_pending`); admin `only global admins can rebuild a chain` (`{ error: "forbidden" }` for a campus admin).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the function, route, action and a "Rebuild approval chain" button shown in `expense-steps.tsx` only when the expense is pending, has no steps, and the viewer is a global admin. Messages: button en "Rebuild approval chain" / no "Bygg godkjenningsflyten på nytt"; error `has_steps` en "This reimbursement already has approval steps." / no "Denne refusjonen har allerede godkjenningstrinn."
- [ ] **Step 4: Run** tests and `bun run build --filter=admin` — PASS.
- [ ] **Step 5: Commit** `feat(expenses): global admins can rebuild an approval chain with no steps`.

### Task 9: A failed scan never blocks the receipt

**Files:**
- Modify: `apps/web/src/components/expense-v3/expense-split-view.tsx` (`processFile` ~651), `types.ts` (`Receipt.scanFailed?: boolean`), `receipt-notices.tsx` (notice + "Try again")
- Modify: `packages/i18n/messages/{en,no}/expenses.json`
- Test: `apps/web/src/components/expense-v3/expense-split-view.test.tsx`

**Interfaces:**
- Produces: `Receipt.scanFailed?: boolean`; in the split view a `filesRef = useRef(new Map<string, File>())` and `retryScan(receiptId: string): Promise<void>`, passed to the notices.

- [ ] **Step 1: Write the failing tests:**
  - `a receipt whose scan fails becomes ready for manual entry`: upload resolves, `apiClient.fetchFormData` rejects → the receipt has `status: "ready"`, `scanFailed: true`, empty type (student must choose).
  - `a failed upload stays an error`: upload resolves `{ success: false }` → `status: "error"`.
  - `a supporting document whose scan fails needs no type`: a failed-scan receipt with a parent and amount 0 does not count in `missingTypes`.
  - `try again reads the receipt and keeps what the student typed`: after a failed scan the student sets amount 120; retry succeeds with OCR amount 99 and date "2026-11-01" → amount stays 120, date becomes "2026-11-01", `scanFailed` false.
- [ ] **Step 2: Run** `cd apps/web && bun x vitest run src/components/expense-v3/expense-split-view.test.tsx` — FAIL.
- [ ] **Step 3: Implement:** split the OCR part of `processFile` into `scanReceipt(id, file)`; in the catch, a receipt with a `fileId` becomes ready with `scanFailed: true` and `...typeFromOcr({}, typeOptions, false)`; one without stays `error`. Keep each `File` in `filesRef`; the notice shows "Try again" only when the file is in the map (not for reopened drafts). Retry fills only empty fields (amount 0, date "", description ""). Messages: notice en "We couldn't read this receipt. Fill in the details yourself, or try again." / no "Vi klarte ikke å lese kvitteringen. Fyll inn selv, eller prøv igjen."; button en "Try again" / no "Prøv igjen"; toast en "Couldn't read the receipt — fill in the details yourself." / no "Klarte ikke å lese kvitteringen — fyll inn selv."
- [ ] **Step 4: Run** the test file, `store.test.ts`, and `cd apps/web && bun run check-types` — PASS.
- [ ] **Step 5: Commit** `fix(fs): a receipt that can't be read is filled in by hand instead of blocking`.

### Task 10: Description after reopening, event on department change, description length

**Files:**
- Modify: `apps/web/src/components/expense-v3/expense-split-view.tsx` (`skipNextSummaryRef` ~483 and ~599), `store.ts` (`setAssignment` ~241), the description textarea in `expense-report.tsx` (`maxLength={800}`)
- Modify: `apps/api/src/lib/expense-payload.ts` (expense `description` ~52: `.transform` to at most 800 chars), `apps/api/src/lib/expense-summary.ts` (cap the generated description at 800)
- Test: `expense-split-view.test.tsx`, `store.test.ts`, `apps/api/src/lib/expense-payload.test.ts`, `apps/api/src/lib/expense-summary.test.ts`

**Interfaces:**
- Produces: `export const EXPENSE_DESCRIPTION_MAX = 800` in `packages/shared/utils/expense-cost-types.ts` (shared by web and api).

- [ ] **Step 1: Write the failing tests:**
  - `a reopened draft with an empty description gets one once every receipt has a type` → the summary request is sent after the last type is picked.
  - `a reopened draft keeps a saved description` → no summary request on load.
  - `changing the department clears the accepted event` (store) → `eventId` null, `eventName` "".
  - `keeps the event when the same department is picked again`.
  - `a description longer than 800 characters is cut to 800` (payload) and `the generated description is at most 800 characters` (summary).
- [ ] **Step 2: Run** the four files — FAIL.
- [ ] **Step 3: Implement:** `skipNextSummaryRef.current = Boolean(initialDraft?.description?.trim())` in both places; `setAssignment` clears the event when the department changes; the cap uses `EXPENSE_DESCRIPTION_MAX`.
- [ ] **Step 4: Run** the files plus `bun run check-types` in `apps/web` and `apps/api` — PASS.
- [ ] **Step 5: Commit** `fix(fs): reopened drafts get a description, events follow the department, descriptions fit`.

### Task 11: Docs and full verification

**Files:**
- Modify: `apps/docs/content/docs/guide/access-and-settings/expenses-admin.mdx` (approve needs an account; Retry finishes a saved booking; Rebuild approval chain; re-routing the general manager's step does not change Settings → Approvers)
- Modify: `apps/docs/content/docs/guide/access-and-settings/expense-approvals.mdx` (resend refused once decided; a rejection closes its open issues)
- Modify: the guide page that covers `apps/web/src/components/expense-v3/**` for students (find by `covers`; add one line if none: a receipt that can't be read is filled in by hand, with Try again)
- Modify: `apps/docs/content/docs/developers/keep-it-running/secrets-and-environment.mdx` (`TFSO_CAMPUS_DIMENSION_TYPE=101` needed on the api)

- [ ] **Step 1: Update the pages** in the docs' existing voice (`apps/docs/CLAUDE.md` rules).
- [ ] **Step 2: Run the full suites:** `cd apps/api && NODE_ENV=test bun x vitest run` (expect all pass, 971 + new), `cd apps/web && bun x vitest run`, `cd apps/admin && bun test ./src` (note the known pre-existing `content-translation.test.ts` failure if it appears, and nothing else), `bun run check-types`, `bun run build --filter=admin`, `bun run build --filter=docs`.
- [ ] **Step 3: Commit** `docs(expenses): stage 1 fixes in the guide and developer pages`.
