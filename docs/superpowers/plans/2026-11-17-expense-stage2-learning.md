# Expense Stage 2 — Learning That Works Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the expense AI learn from what people actually decide, in production too, with a correct learning signal (spec Part B).

**Architecture:** One shared example module (`packages/shared/utils/expense-examples.ts`) owns how a receipt becomes an anonymous example and keeps it in sync: written at submission (unconfirmed), updated on approver/admin edits, confirmed at booking, deleted on rejection. Each receipt points to its example (`expense_attachments.example_id`); the examples table points to nothing. Selection for the classifier ranks confirmed and human-chosen examples first and matches beyond the exact vendor.

**Tech Stack:** Bun monorepo, Appwrite (`@repo/api`), vitest (api, shared, web), `bun test` (admin), AI SDK classify prompt in `apps/api/src/lib/receipt-scan.ts`.

**Spec:** `docs/superpowers/specs/2026-11-17-expense-agent-and-projects-design.md` (Part B; Part A minor 6 carried here).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-agent` (branch `feat/expense-agent`). Never use `git stash`. Never push, deploy, or write to production data.
- Bun only. Ultracite before each commit; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Schema edits go in `packages/api/appwrite.config.json` (mirror existing entries exactly) plus the matching hand-mirror in `packages/api/types/appwrite.ts` in the generator's shape; the owner pushes and regenerates. Update `packages/api/appwrite-config.test.ts`.
- The examples table never stores a submitter, name, email, expense id or attachment id, and never the student's own description text; only the AI-extracted receipt description, normalised vendor, amount, department id, types/text, account, sources and `confirmed`.
- Values only the AI chose and nobody saw (none exist yet in Stage 2; Stage 4 adds agent picks) never reach later prompts until confirmed.
- The submit/draft API response shapes and expense status values stay unchanged (Flutter).
- Test commands: api `cd apps/api && NODE_ENV=test bun x vitest run <file>`; shared `cd packages/shared && bun x vitest run <file>`; web `cd apps/web && bun x vitest run <file>`; admin `cd apps/admin && bun test <file>` (known pre-existing failure: content-translation.test.ts); `bun run build --filter=admin` after editing a "use server" file.

## Review Focus

1. **An expense that fails chain creation and goes back to draft, then is resubmitted** → exactly one example per receipt exists afterwards (examples are written only after a successful submit). Task 3 test `writes examples once after a resubmitted draft`.
2. **An approver changes only the account** → the example's type keeps the student's/AI's type source and is not ranked as a human type correction. Task 4 test `an account-only edit does not mark the type as human-chosen`.
3. **A receipt whose type was a server default ("Other")** → no type example (own text or nothing). Task 2 test `a defaulted receipt teaches no type`.
4. **A rejected expense** → its examples are gone and later prompts never see them. Task 3 test `a rejection deletes the expense's examples`.
5. **A booking finished by Retry after a failed status write** → its examples are confirmed too. Task 5 test `finishing a saved booking confirms its examples`.

Task 0 carries five Stage 1 follow-ups first.

---

### Task 0: Stage 1 follow-ups (pay-twice safety)

Five residual findings from the Stage 1 fix-wave review (`.superpowers/expense-agent-stage1-ledger.md`).

**Files:**
- Modify: `apps/web/src/components/expense-v3/expense-split-view.tsx` (`reconcileBatch` ~890-944, retry link ~964-971), `apps/web/src/components/expense-v3/receipt-notices.tsx` / `packages/i18n/messages/{en,no}/expenses.json` (amount-missing notice), `apps/admin/src/app/(portal)/expenses/[expenseId]/_components/retry-booking-button.tsx` (~36-51), `apps/api/src/lib/expense-approval.ts` (`hasNoApproverIssue` ~1365) and/or `apps/api/src/app/api/expenses/submit/route.ts` (`submitByEmail`), `apps/docs/content/docs/guide/access-and-settings/expenses-admin.mdx` (~87)
- Test: `expense-split-view.test.tsx`, `expense-approval.test.ts`, the admin retry button test if present

- [ ] **Step 1: Failing tests:**
  - `a statement linked on retry stays with its receipt when another file finishes later` — `reconcileBatch` skips statements that already have a `parentId` and receipts that already have a `bankStatementId` in the store.
  - `linking a statement on retry keeps an amount the student typed` — a retry link never overrides a non-zero amount.
  - `the amount notice tells a student how to attach a bank statement instead` — the scan-failed amount notice adds: en "If this is a bank statement for another receipt, remove it and attach it to that receipt." / no "Er dette en kontoutskrift for en annen kvittering, fjern den og legg den ved den kvitteringen."
  - `a no-approver issue from an earlier email submission does not allow a rebuild` — rebuild accepts only a no-approver issue created after the expense's latest `submitted` event (or `submitByEmail` resolves older no-approver issues for the expense; pick one and test it).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; also make the `booking_unrecorded` toast persistent (`duration: Infinity` with a close button), and qualify expenses-admin.mdx ~87 ("Retry doesn't book again" only when the booking was recorded here).
- [ ] **Step 4: Run** web, api and admin suites for the touched files, check-types, `bun run build --filter=docs` — PASS.
- [ ] **Step 5: Commit** `fix(expenses): statements stay with their receipt and an old issue never reopens a rebuild`.

### Task 1: Schema for confirmed, linked examples

**Files:**
- Modify: `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts`, `packages/api/appwrite-config.test.ts`
- Modify: `apps/docs/content/docs/developers/change-it/data-model.mdx` (the examples table and attachment columns)

**Interfaces — Produces:**
- `expense_type_examples` new columns: `confirmed` boolean (default false), `department_id` string(40) nullable, `type_source` enum `["ai","student","legacy_app","approver","admin"]` nullable, `account_source` enum `["type","ai_freeform","approver","admin"]` nullable. New indexes: key on `confirmed`; fulltext on `description`.
- `expense_attachments` new column `example_id` string(36) nullable; its `type_source` enum gains `"approver"` and `"admin"`.
- Types: `ExpenseTypeExamples` gains the four fields; new enums `ExpenseTypeExamplesTypeSource`, `ExpenseTypeExamplesAccountSource`; `ExpenseAttachmentsTypeSource` gains `APPROVER`, `ADMIN`; `ExpenseAttachments.example_id?: string | null`.

- [ ] **Step 1: Failing config tests:** extend the existing `expense_type_examples is server-only and indexed by vendor_key` test with the new column keys and indexes; add `expense_attachments has example_id and approver/admin type sources`.
- [ ] **Step 2: Run** `cd packages/api && bun test appwrite-config.test.ts` (or its configured runner) — FAIL.
- [ ] **Step 3: Edit** the config (permissions unchanged: examples stay server-only) and mirror the types.
- [ ] **Step 4: Run** the config test and `bun run check-types` at the repo root — PASS.
- [ ] **Step 5: Commit** `feat(schema): confirmed examples linked from their receipts`.

### Task 2: Shared example module

**Files:**
- Create: `packages/shared/utils/expense-examples.ts`, `packages/shared/utils/expense-examples.test.ts`
- Modify: `apps/api/src/lib/expense-examples.ts` (import `normalizeVendor` from shared; keep selection here), `apps/api/src/lib/expense-posting.ts` (import `typeTeaches` from shared instead of its local `teachesType`; keep the old export name as a re-export only if tests need it)

**Interfaces — Produces:**
- `normalizeVendor(vendor: string | null | undefined): string` (moved unchanged).
- `typeTeaches(att: Pick<ExpenseAttachments, "type_source" | "cost_type" | "ai_cost_type" | "ai_confidence">): boolean` — true for `ai`, `student`, `approver`, `admin`; `legacy_app` only when AI agreed with ≥ `AI_TYPE_CONFIDENCE_THRESHOLD`; false for null.
- `exampleFields(input: { attachment: ExpenseAttachments; scan: { vendor: string | null; description: string | null } | null; departmentId: string | null; accountNumber?: number | null; confirmed: boolean }): ExampleRow | null` — pure. Null when the receipt is a supporting document (amount ≤ 0 or has a parent), or when neither the type teaches nor an own text exists. `final_cost_type` only when `typeTeaches`; `final_text` = own text; `account_number` = `accountNumber ?? attachment.account_number`; `type_source`/`account_source` copied; `source` = `approver`/`admin` when the type or account source is one of those (type first), else `student`; `description` = scan description cut to 255; `vendor_key` = `normalizeVendor(scan.vendor)`.
- `syncExample(db, input: same as exampleFields): Promise<string | null>` — creates the example when `attachment.example_id` is empty and writes the new id back to the attachment; updates it otherwise; deletes it (and clears `example_id`) when `exampleFields` returns null. Errors are logged and swallowed (never break a submit, edit or booking).
- `syncExamplesForExpense(db, expenseId: string, opts: { confirmed: boolean; accountByAttachment?: Map<string, number> }): Promise<void>` — reads the expense's department and attachments (through the `expenseAttachments` relation), each attachment's scan from `expense_receipt_scans` by `file_hash`, and calls `syncExample`.
- `deleteExamplesForExpense(db, expenseId: string): Promise<void>`.

- [ ] **Step 1: Failing tests** in `expense-examples.test.ts`: `a defaulted receipt teaches no type` (type_source null, no text → null); `own text becomes an example without a type`; `a supporting document gives no example`; `an approver type change is a human source`; `sync creates once and links the receipt` (createRow then updateRow on the attachment with `example_id`); `sync updates a linked example`; `sync deletes an example that no longer teaches`; `the example stores no submitter, expense or attachment id` (assert the createRow data keys are exactly the allowed set); `typeTeaches` cases (moved from api).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; move `normalizeVendor` and `typeTeaches`; update api imports.
- [ ] **Step 4: Run** shared tests, api `expense-examples.test.ts` and `expense-posting.test.ts`, `bun run check-types` — PASS.
- [ ] **Step 5: Commit** `feat(expenses): one shared module turns receipts into examples`.

### Task 3: Examples at submission, gone on rejection

**Files:**
- Modify: `apps/api/src/app/api/expenses/submit/route.ts` (after `submitForApproval` / `submitByEmail` succeed), `apps/api/src/lib/expense-approval.ts` (reject branch of `applyDecisionOutcome`)
- Test: `apps/api/src/app/api/expenses/submit/route.test.ts` (create if absent; mock like the post-pending route test) or the existing submission tests; `apps/api/src/lib/expense-approval.test.ts`

**Interfaces — Consumes:** `syncExamplesForExpense(db, expenseId, { confirmed: false })`, `deleteExamplesForExpense(db, expenseId)`.

- [ ] **Step 1: Failing tests:** `writes unconfirmed examples after a successful submit` (both flag paths); `writes no examples when the approval chain fails` (createApprovalChain throws → no sync call); `writes examples once after a resubmitted draft` (second submit of the same receipts updates the linked examples, no second create); `a rejection deletes the expense's examples`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** (best-effort: a failed example write never fails the submit or the decision).
- [ ] **Step 4: Run** the touched test files and the full api suite — PASS.
- [ ] **Step 5: Commit** `feat(expenses): learn from receipts at submission and forget rejected ones`.

### Task 4: Approver and admin edits teach the right thing

**Files:**
- Modify: `apps/admin/src/app/(portal)/expenses/[expenseId]/receipt-edit.ts` (`applyCostType` sets `type_source` to `approver`/`admin`; `applyAccount` leaves `type_source` alone), `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.ts` (after a receipt edit is saved, `syncExample` for that receipt with `confirmed` kept as stored)
- Test: `receipt-edit.test.ts`, `actions.test.ts`

- [ ] **Step 1: Failing tests:** `a type change records the approver as the type's source`; `a type change by an admin records admin`; `an account-only edit does not mark the type as human-chosen` (type_source unchanged, account_source approver); `a legacy app receipt corrected by an approver teaches` (type_source becomes approver); `saving an edit updates the receipt's example` (syncExample called with the saved attachment).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** admin tests, check-types, `bun run build --filter=admin` — PASS.
- [ ] **Step 5: Commit** `fix(admin): approver corrections teach the AI and account-only edits don't claim the type`.

### Task 5: Confirm at booking, including a finished retry

**Files:**
- Modify: `apps/api/src/lib/expense-posting.ts` (replace `writeBookedExamples`/`writeBookedExamplesSafely` with `syncExamplesForExpense(db, expenseId, { confirmed: true, accountByAttachment })` built from the posted receipt lines; call the same from the retry finish path `finishBookedExpense`, using the stored accounts)
- Test: `expense-posting-dates.test.ts` (booked-example fixture), `expense-posting-retry.test.ts`

- [ ] **Step 1: Failing tests:** `booking confirms the expense's examples with the booked accounts`; `finishing a saved booking confirms its examples`; `a receipt booked on an account an approver changed keeps the account as the approver's` (account_source approver on the example).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; delete the now-unused local example code.
- [ ] **Step 4: Run** the posting test files and the full api suite — PASS.
- [ ] **Step 5: Commit** `feat(expenses): booking confirms what the AI learned`.

### Task 6: Better example selection

**Files:**
- Modify: `apps/api/src/lib/expense-examples.ts` (`selectExamples`), `apps/api/src/lib/receipt-scan.ts` (`TypeExample` gains `confirmed: boolean` and `sameDepartment: boolean`; the prompt line marks them), `apps/api/src/app/api/expenses/ocr/route.ts` (optional `departmentId` form field), `apps/api/src/lib/expense-submission.ts` and `apps/api/src/lib/expense-eval.ts` (pass department and description through), `apps/web/src/components/expense-v3/expense-split-view.tsx` (send the selected `departmentId` with the OCR request)
- Test: `apps/api/src/lib/expense-examples.test.ts`, `receipt-scan` prompt test, `ocr` route test if present, `expense-split-view.test.tsx`

**Interfaces — Produces:** `selectExamples(db, input: { excludeId?: string; vendor: string | null; description?: string | null; departmentId?: string | null; types: CostTypeOption[] }): Promise<TypeExample[]>`.

Order of candidates (up to `MAX_EXAMPLES = 10`, `MAX_VENDOR_EXAMPLES = 6` from vendor matches):
1. exact `vendor_key` matches; 2. `vendor_key` starting with the vendor's first two words (`Query.startsWith`); 3. `Query.search("description", keywords)` on the receipt description's words (≥ 3 letters, max 5); then the existing one-per-type recent filler. Within each group rank: confirmed first, then `type_source` approver/admin, then same department, then newest. Only rows with `final_cost_type` of an active type.

- [ ] **Step 1: Failing tests:** `a prefix vendor match is used when no exact match exists` (`rema 1000` example for `rema 1000 majorstuen`); `confirmed examples come before unconfirmed ones`; `approver corrections come before student choices`; `same-department examples come first within a group`; `keyword matches fill in when no vendor matches`; prompt test `marks unconfirmed and same-department examples`; web test `the scan request carries the selected department`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.** The ocr route reads `departmentId` as an optional string ≤ 64 chars; the Flutter app does not send it and keeps working.
- [ ] **Step 4: Run** the touched files, full api and web suites, check-types — PASS.
- [ ] **Step 5: Commit** `feat(expenses): find past bookings beyond the exact shop name`.

### Task 7: Docs and verification

**Files:**
- Modify: `apps/docs/content/docs/guide/access-and-settings/expense-types.mdx` (how the AI learns: examples at submit, confirmed at booking, approver corrections count most, rejected ones forgotten), `apps/docs/content/docs/developers/reference/ai.mdx` (example lifecycle and selection order), and any page whose `covers` matches the changed files.

- [ ] **Step 1: Update the pages** in the existing voice.
- [ ] **Step 2: Run** all suites (api, web, shared, admin), `bun run check-types`, `bun run build --filter=admin`, `bun run build --filter=docs`.
- [ ] **Step 3: Commit** `docs(expenses): how the AI learns from reimbursements`.
