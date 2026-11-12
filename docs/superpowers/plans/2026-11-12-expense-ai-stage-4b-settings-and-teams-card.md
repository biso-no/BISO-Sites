# Expenses Settings Tabs and the Teams Card — Stage 4b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Stage 4:
- the approval card and email show approvers what they're approving: receipts with type and account, hints, history, the submitter's declaration, and an Open-in-admin link;
- the card updates when a step is decided elsewhere;
- Settings gains the Approvers directory and the AI eval;
- the server fixes carried from Stages 1–3 land.

**Architecture:**
- **Card and email:** built by pure functions in `packages/connectors/src/teams-bot/cards.ts` from one richer `ApprovalCardData`. `apps/api` loads that data in one place (`loadApprovalCardDetails`) for every notification, and updates a sent card through a new `updateProactiveCard` when admin or the web page decides a step.
- **Settings tabs:** admin pages under `/expenses/settings/*` with a shared tab strip.
- **Eval:**
  - Kept/corrected stats and recurring own texts are computed in admin from `expense_attachments`.
  - The re-run check runs in `apps/api`, where the classification prompt lives, behind a CRON_SECRET route.

**Tech Stack:** TypeScript, Next.js 16 (admin), Vitest (apps/api, packages/connectors and shared use the existing runners, see Global Constraints), `bun test` (apps/admin), botbuilder `CloudAdapter`, AI SDK via the existing `classifyReceipt`, Appwrite via `@repo/api/server`.

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md`, which this plan follows:
- Stage 4 "Teams card and email" and "Navigation and pages" (Settings tabs);
- Stage 2 "Learning loop and eval";
- Stage 3 "Approver directory".

**Earlier rulings:**
- Stage 4a rulings: `.superpowers/sdd/2026-11-12-expense-ai-stage-4a-admin-expenses/progress.md`.
- Earlier stages: `.superpowers/expense-ai-rulings-stage{1,2a,2b,3}.md`. The items carried here are listed in Task 1 and Task 2.

## Global Constraints

- **Where to work:**
  - Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never push. Use Bun only.
  - About 25 unrelated files in the worktree carry uncommitted formatter changes. Never touch, stage or revert them. Run `bun x ultracite fix` and `git add` only with explicit paths.
- **No live services:** never write to production Appwrite, and never call live Graph, Teams, Finago or the model APIs in tests.
- **Emails:** emails written to approval and directory rows are trimmed and lowercased. Email grants in admin come only from Microsoft identity emails (`getExpenseViewer`).
- **Access:**
  - **Approver directory:**
    - Department rows (`finance`, `manager`, `deputy`) can be edited by global admins and by campus admins of the row's campus.
    - Campus rows (`controller`, `president`, `national`) are global-admin only.
    - The campus controller has no extra settings rights.
  - **Types and AI tabs:** global admins only, as today.
- **Card size:** the Teams card stays under **24 000 bytes** of JSON. This leaves headroom under Teams' ~28 KB message limit.
- **Card links:**
  - The card's admin link is `${EXPENSE_ADMIN_URL || "https://admin.biso.no"}/expenses/<expenseId>`. `EXPENSE_ADMIN_URL` is a new optional api runtime variable. Document it next to `EXPENSE_APPROVAL_WEB_URL`, and mirror that variable's `turbo.json` handling, adding it only if `EXPENSE_APPROVAL_WEB_URL` is listed there.
  - The card and email copy stays in English, like today's card. The admin UI copy is en + no in `packages/i18n/messages/{en,no}/adminPortal.json`.
- **Before each commit:** run `bun x ultracite fix <changed files>`. End each message with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Test commands:**
  - Type checks: `bun run check-types --filter=<pkg>`.
  - api: `cd apps/api && bun run test <file>`.
  - admin: `cd apps/admin && bun test <path>`. The known `content-translation.test.ts` failure is allowed; name it.
  - connectors: `cd packages/connectors && bun test <path>`.
  - shared: `cd packages/shared && bun run test <file>`.

## Review Focus

- **A long expense (40 receipts, long descriptions, 30 history events)** produces a card under 24 000 bytes that still has Approve/Reject (or "Set the account in admin") and Open in admin. Task 3 test: `keeps a 40-receipt card under the size limit with its actions`.
- **A receipt without an account**, for example an own-text type the AI couldn't place, must never offer Approve on the card or in the email. Task 3 test: `replaces Approve when a receipt has no account`.
- **A deactivated directory row** must stay deactivated after the next submission for that department. No AI save may reactivate it. Task 2 test: `a deactivated row is never reactivated`.
- **A campus admin** edits a department approver for another campus, or a controller row, by crafting the action call. The server refuses. Task 5 test: `campus admin cannot edit another campus or a campus row`.
- **A Graph or model outage during an approver lookup** is retried on the next submission, not cached as a miss for an hour. Task 2 test: `does not cache a failed lookup as a miss`.

---

### Task 1: Chain creation fixes (apps/api)

**Files:**
- `apps/api/src/lib/expense-approval.ts` (+ test)
- `apps/api/src/lib/expense-payload.ts` (+ test)

**Rules (carried from the Stage 3 roll-up and 4a):**
- **One rollback around everything after the chain claim.** In `createApprovalChain`, every step after the submission claims the chain (step rows, `approver_resolved` events, notification) is undone on failure: step rows deleted, claim released. The submission then fails cleanly and can be resubmitted, never stranded with a 409.
  - Issue writes (`expense_approval_issues`) and history events are best-effort: wrapped, logged, never thrown, so they cannot trigger or block the rollback.
  - `approver_resolved` events written before a rollback get a matching `notified`-less trail. Write them only after the notification succeeded, or record a `note: "rolled back"` system event. Pick one and test it.
- **Self and duplicate guard at routing.**
  - A step whose resolved email equals the submitter's account email (trimmed, lowercased) is treated as "not found" for that role: the existing fallback plus an issue with the reason "Approver is the submitter".
  - When two steps resolve to the same email, drop the earlier step and record an issue noting it. The later step is the stronger role.
- **Kept controller flag** (`mergeLegacyDraft`): a stored `submitter_is_controller` is kept only when the incoming campus **and** department equal the stored draft's. Otherwise it falls back to the payload's value (false when absent).

Steps:
- [ ] **Step 1: Write failing tests:**
  - `rolls back steps and the claim when notification fails`
  - `a failed issue write does not strand the draft`
  - `treats an approver who is the submitter as not found`
  - `drops the earlier of two steps with the same approver`
  - `drops the kept controller flag when the department changes`
  - `keeps it when campus and department match`
- [ ] **Step 2: Run them and see them fail:** `cd apps/api && bun run test src/lib/expense-approval.test.ts src/lib/expense-payload.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then the full api suite, then `bun run check-types --filter=api`.
- [ ] **Step 5: Commit:** `fix(api): approval chains roll back cleanly, never route to the submitter, and keep the controller flag only for the same department`.

---

### Task 2: Directory and scan fixes (apps/api)

**Files:**
- `apps/api/src/lib/expense-approver-directory.ts`
- `expense-approver-resolution.ts`
- `expense-approver-lookup.ts`
- `apps/api/src/app/api/expenses/ocr/route.ts`, or wherever OCR reuses a stored scan
- tests next to each

**Rules:**
- **Miss cache:**
  - The lookup helpers report `"found" | "empty" | "failed" | "timeout"`. Today a failure counts as a miss.
  - Only `empty` and `timeout` go into the 1-hour miss cache. `failed` (a Graph or model error) is never cached.
- **Confirmation keeps provenance:** `confirmDirectoryApprover` sets `confirmed_at` on any matching row. It sets `source: "confirmed"` only when the row's source is `ai` or `seed`. An `admin` row stays `admin`.
- **Deactivation sticks:**
  - When the key has an **inactive** row, resolution skips the AI lookup for that key and uses the existing not-found fallback, with an issue whose reason is "Approver is deactivated in the directory".
  - `saveDirectoryApprover` never updates an inactive row: treat `active === false` like the protected sources.
- **OCR reuse:** a stored scan's classification is used only when its type slug is among the currently active types. Otherwise the type is treated as unclassified. This is the Stage 2a parked item.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `does not cache a failed lookup as a miss`
  - `caches an empty result and a timeout`
  - `confirm keeps an admin row's source and sets confirmed_at`
  - `confirm turns an ai row into confirmed`
  - `a deactivated row is never reactivated`
  - `resolution skips the lookup for a deactivated key and records an issue`
  - `OCR ignores a stored type that is no longer active`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then the full api suite, then `bun run check-types --filter=api`.
- [ ] **Step 5: Commit:** `fix(api): directory keeps deactivations and admin provenance, retries failed lookups, OCR drops retired types`.

---

### Task 3: Card and email builders (packages/connectors)

**Files:**
- `packages/connectors/src/teams-bot/cards.ts` (+ `cards.test.ts`)

**Interfaces:**
- `ApprovalCardData` gains these fields:
  - `adminUrl: string`
  - `receipts: ApprovalCardReceipt[]`
  - `hints: string[]` (already human-readable lines)
  - `history: ApprovalCardHistoryLine[]` (newest first, already human-readable)
  - `declaration: string | null`, e.g. "Submitter says they are the campus controller"
  - `fallbackNote: string | null`, e.g. "The campus president could not be found; the national approver decides instead"
  - `missingAccount: boolean`
- `export interface ApprovalCardReceipt { date: string; text: string; type: string; account: string | null; amount: number }`. `text` is the vendor or description. `account` reads `"7140 Reise"`, or null.
- `export interface ApprovalCardHistoryLine { at: string; text: string }`
- `buildApprovalCard(data)` and `buildApprovalEmailHtml(data & { approveUrl; rejectUrl })` keep their names.
- `export const CARD_MAX_BYTES = 24_000`

**Card content, in order:**
1. Step label.
2. The FactSet (as today).
3. The declaration and fallback lines, when present, in attention colour.
4. Hint lines, in warning colour.
5. A receipts table built from ColumnSets: date, text, type, account, amount. Show at most 15 rows, then an "and N more" line.
6. The description.
7. A "Recent history" block with the latest 6 lines.
8. Actions:
   - `Action.Execute` Approve, unless `missingAccount`. In that case it becomes an `Action.OpenUrl` "Set the account in admin" pointing to `adminUrl`.
   - `Action.Execute` Reject, as today.
   - `Action.OpenUrl` "Open in admin".
   - `Action.OpenUrl` "View receipts" (`viewUrl`).

**Size guard:** if `JSON.stringify(card)` exceeds `CARD_MAX_BYTES`, shrink the card in this order until it fits:
1. drop history lines down to 3, then 0;
2. drop receipt rows down to 5, adding the "and N more" line;
3. cut the description to 500 characters;
4. cut hint lines to 5.

The actions are never removed.

**Email:**
- The same blocks as HTML, all escaped.
- Approve is a link only when `!missingAccount`; otherwise it reads "Set the account in admin" and links to `adminUrl`.
- Reject is unchanged.
- An "Open in admin" link is added.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `renders the receipts table with type and account`
  - `adds "and N more" after 15 receipts`
  - `replaces Approve when a receipt has no account` (card and email)
  - `shows declaration, fallback and hints`
  - `keeps a 40-receipt card under the size limit with its actions` (40 receipts with 300-character texts, 30 history lines, a 3000-character description)
  - `escapes every interpolated value in the email`
  - `history shows at most 6 lines`
- [ ] **Step 2: Run them and see them fail:** `cd packages/connectors && bun test src/teams-bot/cards.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=@repo/connectors`.
- [ ] **Step 5: Commit:** `feat(connectors): approval card and email show receipts, hints, history and an admin link`.

---

### Task 4: Card data, the admin link, and updating a sent card (apps/api + connectors bot)

**Files:**
- `apps/api/src/lib/expense-card-details.ts` (new, + test)
- `apps/api/src/lib/expense-approval.ts` (`cardDataFor`, `notifyStep`, `decideStep`; + test)
- `packages/connectors/src/teams-bot/bot.ts` (`updateProactiveCard`)
- `apps/api/src/app/api/teams/bot/route.ts`
- `apps/docs/content/docs/developers/keep-it-running/secrets-and-environment.mdx`
- `apps/docs/content/docs/developers/reference/microsoft.mdx`

**Interfaces:**
- `export async function loadApprovalCardDetails(db: Db, expenseId: string): Promise<Pick<ApprovalCardData, "receipts" | "hints" | "history" | "declaration" | "fallbackNote" | "missingAccount">>`
  - **Receipts:** attachments ordered by `sort_order`. Supporting rows (`amount <= 0`) are left out.
    - The type is the type label (English `label`), or the student's own text in quotes.
    - The account is `"<number> <ledger name>"` from `ledger_accounts`, or null.
  - **`missingAccount`:** true when any receipt with a positive amount has no `account_number`.
  - **Hints:** from `parseApproverHints(expense.approver_hints)`. Map the hint codes to the same English sentences the admin `hintsText.*` en strings use. Copy them into one api constant map and note the duplication in a comment.
  - **History:** the latest 6 `expense_events`, newest first, rendered as one English line each. Examples:
    - "12 Nov 14:03 · Ada Admin changed the account on Taxi from 6555 to 7140"
    - "… approved (on behalf of the financial manager)"
  - **Declaration:** from `submitter_is_financial_manager` and `submitter_is_controller`.
  - **Fallback note:** set when a step has the role `national` and the campus is not `5`.
  - Every lookup is best-effort. A failure gives empty arrays or nulls, and the card still sends.
- `cardDataFor` adds `adminUrl` and spreads in the details. `notifyStep` loads the details for every notification: the first step, the next step after a decision, and resends. The next approver therefore sees the changes made at earlier steps.
- `export async function updateProactiveCard(params: { chatId: string; tenantId: string; activityId: string; card: Record<string, unknown> }): Promise<void>` in bot.ts uses `context.updateActivity({ id, type: "message", attachments: [adaptiveCard] })` inside `continueConversationAsync`.
- **Updating a sent card:** `decideApproval` gains an optional `source?: "teams" | "web"`, and the Teams bot route passes `"teams"`.
  - After a recorded decision that did not come from Teams (web, or admin via `decideApprovalStep`) on a row with `teams_conversation_id` and `teams_activity_id`, update that card to `buildDecisionResultCard`. Best-effort and logged.
  - A Teams decision keeps today's invoke response.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `loads receipts with type labels and account names`
  - `flags a missing account`
  - `renders history lines newest first`
  - `a failed lookup still returns a sendable card`
  - `notifyStep sends the admin link and the details`
  - `an admin decision updates the sent Teams card`
  - `a Teams decision does not call updateProactiveCard`
  - `a failed card update does not fail the decision`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then the full api suite and `cd packages/connectors && bun test src/teams-bot`, then `bun run check-types --filter=api --filter=@repo/connectors`.
- [ ] **Step 5: Docs:** add `EXPENSE_ADMIN_URL` to secrets-and-environment, and the card contents plus the card update to microsoft.mdx. Keep the `covers` front-matter matching the files.
- [ ] **Step 6: Commit:** `feat(api): approval cards carry receipts, hints, history and an admin link, and update when decided elsewhere`.

---

### Task 5: Settings tabs and the Approvers tab (apps/admin)

**Files:**
- `apps/admin/src/app/(portal)/expenses/settings/_components/expenses-settings-tabs.tsx` (new; mirror `it/users/_components/it-users-tabs.tsx`)
- `settings/page.tsx` (Types): use the tabs. Campus admins are redirected to `/expenses/settings/approvers`.
- `settings/approvers/page.tsx`, `approvers-actions.ts`, `approvers-model.ts` (pure, + test), `_components/approvers-client.tsx` (all new)
- `apps/admin/src/lib/roles.ts`: `portal.expensesSettings` becomes `[GLOBAL_ADMIN, CAMPUS_ADMIN]`. The Types and AI pages keep their global-only guards (`requireExpensesAdmin`).
- i18n.

**Interfaces:**
- `export function canEditApproverRow(viewer: { isGlobalAdmin: boolean; isCampusAdmin: boolean; managedCampusIds: string[] }, row: { scope: string; campus_id: string }): boolean` (pure):
  - a global admin may edit any row;
  - a campus admin may edit a `department`-scope row of a campus in `managedCampusIds`;
  - everyone else may edit nothing.
- `listApprovers(filters: { campusId: string | null; role: string | null; q: string })`:
  - Global admins see all rows; campus admins see their campuses' rows.
  - Rows include `display_name`, `email`, `role`, `scope`, the department name (joined from `departments`), `source`, `confidence`, `confirmed_at`, `last_used_at` and `active`.
- Actions, all re-checking `canEditApproverRow` on the stored row and logging an audit event the way other admin actions do:
  - `saveApprover({ id?, scope, campusId, departmentId?, role, email, displayName? })`:
    - The email must be `@biso.no`. It is lowercased.
    - `key` comes from `directoryKey` (`@repo/shared/utils/expense-approvers`).
    - `source: "admin"`, `active: true`, `confirmed_at` cleared when the email changes.
    - Creating a row whose key already exists updates that row instead.
  - `setApproverActive({ id, active })`.
- **Page:**
  - Filters: campus, role, search.
  - Table columns: department or campus, role, name, email, source badge (seed / AI / admin / confirmed), confidence for AI rows, last confirmed, last used, active switch, Edit.
  - "Add approver" dialog: scope, campus, department picker for department roles, role, email, name.
  - Campus admins see only department roles in the dialog.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `canEditApproverRow` cases, including `campus admin cannot edit another campus or a campus row`
  - action tests:
    - `saveApprover refuses a crafted controller row from a campus admin`
    - `saveApprover lowercases and keys the row`
    - `setApproverActive refuses another campus`
    - `a non-biso email is refused`
  - nav test: a campus admin sees the Expenses settings leaf
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=admin`, then `cd apps/admin && bun run build`.
- [ ] **Step 5: Commit:** `feat(admin): Expenses settings tabs and the approver directory`.

---

### Task 6: AI tab: how often the AI's pick was kept, and recurring own texts (apps/admin)

**Files:**
- `apps/admin/src/app/(portal)/expenses/settings/ai/page.tsx`, `ai-data.ts` (server-only), `ai-model.ts` (pure, + test), `_components/ai-eval-client.tsx` (all new)
- `settings/_components/expense-types-client.tsx`: "Make this a type" opens the Types form prefilled.
- i18n.

**Interfaces:**
- `export interface EvalRow { aiCostType: string | null; aiConfidence: number | null; costType: string | null; costTypeText: string | null; createdAt: string }`
- `export function keptStats(rows: EvalRow[], now: Date, days: 30 | 90): { total: number; kept: number; keptRate: number | null; perType: { slug: string; total: number; kept: number; correctedTo: { to: string; count: number }[] }[] }`
  - A row counts when `aiCostType` is set and `createdAt` falls within `days` of `now`.
  - "Kept" means `costType === aiCostType && !costTypeText`.
  - `correctedTo` is keyed by the final slug, or by `"own text"` for own texts. It is sorted by count descending, with the top 3 per type.
  - `keptRate` is null when `total` is 0.
- `export function normalizeOwnText(text: string): string` (trim, lowercase, collapse whitespace).
- `export function recurringOwnTexts(rows: EvalRow[], minCount = 3): { text: string; count: number; example: string }[]`
  - Groups by `normalizeOwnText`. `example` is the most common original spelling.
  - Sorted by count descending, capped at 20 entries.
- `ai-data.ts` loads `expense_attachments` with `ai_cost_type`, `ai_confidence`, `cost_type`, `cost_type_text` and `$createdAt`, created in the last 90 days, whose expense is not a draft.
  - Page through in batches of 500, capped at 5000 rows. Show "based on the latest 5000 receipts" when the cap is hit.
  - Global admins only (`requireExpensesAdmin`).
- **Page:**
  - A 30/90-day toggle and the overall kept % (with its count).
  - A per-type table: type label, AI picks, kept %, "most often changed to".
  - The recurring own texts list, each row with a **Make this a type** button that links to `/expenses/settings?newType=<example>`.
  - The Types page opens its create form with the label prefilled when `newType` is present.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `keptStats` cases:
    - kept versus changed versus own text;
    - outside the window excluded;
    - no AI pick excluded;
    - `keptRate` null on empty;
    - `correctedTo` order.
  - `normalizeOwnText`.
  - `recurringOwnTexts`:
    - groups case and spacing variants;
    - honours `minCount`;
    - caps at 20.
  - a Types-page test that `newType` opens the prefilled form, if the client has tests. Otherwise test the pure prefill helper.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=admin`.
- [ ] **Step 5: Commit:** `feat(admin): AI eval shows how often the AI's type is kept and suggests new types from recurring own texts`.

---

### Task 7: AI tab: re-run check (apps/api + apps/admin)

**Files:**
- `apps/api/src/lib/expense-eval.ts` (new, + test)
- `apps/api/src/app/api/expenses/admin/eval-rerun/route.ts` (new, + test)
- `apps/api/src/lib/expense-examples.ts`: `selectExamples` gains `excludeId?: string`.
- admin: `settings/ai/actions.ts` (`runRerunCheck`) and the UI in `ai-eval-client.tsx`.
- i18n.

**Interfaces:**
- `export async function runRerunCheck(db: Db, opts?: { limit?: number; budgetMs?: number; concurrency?: number }): Promise<{ checked: number; considered: number; hits: number; hitRate: number | null; misses: { exampleId: string; vendor: string | null; description: string | null; expected: string; predicted: string | null; confidence: number }[]; stoppedEarly: boolean }>`
  - Defaults: `limit` 200, `budgetMs` 120 000, `concurrency` 8.
  - Takes the latest `limit` `expense_type_examples` that have a `final_cost_type`. Rows with only own text are not scored. `considered` is the number fetched.
  - Classifies each one with `classifyReceipt`, using the current active types and `selectExamples(db, { vendor, types, excludeId: row.$id })`. The receipt is built from the example's `vendor_key`, `description` and `amount`. Each call gets `AbortSignal.timeout(CLASSIFY_TIMEOUT_MS)`.
  - A hit means `predicted === final_cost_type` and confidence ≥ `AI_TYPE_CONFIDENCE_THRESHOLD` (0.8, `@repo/shared/utils/expense-cost-types`).
  - When the budget runs out, stop starting new calls, finish the ones running, and set `stoppedEarly`.
  - `misses` is capped at 50.
- Route `POST /api/expenses/admin/eval-rerun`:
  - `isInternalRequest`.
  - Responds 409 with `code: "ai_disabled"` when the AI flag that gates classification today is off. Use the same flag check as the OCR route.
  - `maxDuration = 300`. Returns 200 with `{ result }`.
- Admin `runRerunCheck()`:
  - Global admins only.
  - Calls the route via `callExpensesApi`.
  - The UI has a "Run check" button with a pending state ("This can take up to two minutes"). It shows the result: the hit rate, "checked N of M", a note when it stopped early, and the misses table (vendor, description, expected type, AI's pick, confidence).
  - Results are not stored.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `scores a hit only at or above the threshold`
  - `excludes the example itself from its examples`
  - `skips own-text examples`
  - `stops starting new calls when the budget is spent`
  - `caps misses at 50`
  - route 401/409/200
  - admin action refuses non-global admins
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then the full api suite, then `bun run check-types --filter=api --filter=admin`.
- [ ] **Step 5: Commit:** `feat: AI eval re-run check classifies recent booked receipts with today's types`.

---

### Task 8: Docs

**Files:**
- `apps/docs/content/docs/guide/access-and-settings/expense-types.mdx`: the AI tab and Make this a type.
- `expense-approvals.mdx`: the Approvers tab (who can edit what, deactivate, sources, confirmation).
- `expenses-admin.mdx`: the richer card and email, "Set the account in admin", and card updates.
- `developers/reference/accounting.mdx`: the eval re-run route.
- `developers/change-it/data-model.mdx`, if any column meaning changed (provenance on confirm, inactive rows).
- Keep each page's `covers` matching the new files.

Steps:
- [ ] **Step 1:** Write the pages following `apps/docs/CLAUDE.md`.
- [ ] **Step 2:** Run the page-coverage CLI the 4a docs task used, and `cd apps/docs && bun test`.
- [ ] **Step 3: Commit:** `docs: approver directory, AI eval and the approval card`.

---

## Rulings made in this plan

- Ruling: the card stays English, like today's card. Approvers include role mailboxes read by staff of either language, and a bilingual card would double its size. Cost if wrong: the owner asks for Norwegian later; the text is in one builder.
- Ruling: hint sentences are copied into one api constant map rather than shared from admin i18n. The api has no next-intl, and the map is small. Cost if wrong: two places to edit when a hint's wording changes.
- Ruling: a deactivated directory row means "don't use this key": no AI lookup, the not-found fallback, and an issue. Otherwise the AI would find the same person again. Cost if wrong: department steps for that key are skipped (the controller still approves) until an admin adds the right person.
- Ruling: "keep provenance on confirm" means an admin row keeps source `admin` and gains `confirmed_at`. Only `ai`/`seed` rows become `confirmed`. Cost if wrong: none; the confirmed time shows either way.
- Ruling: the duplicate-approver guard drops the earlier of two steps with the same email, and a step resolving to the submitter becomes not-found. This extends no-self-approval to routing. Cost if wrong: one fewer step on rare expenses, with an issue recorded.
- Ruling: campus admins reach Settings only for the Approvers tab. Types and AI stay global-only (Stage 2a rule). Cost if wrong: none.
- Ruling: re-run results are not stored. It's an on-demand check, and storing them adds a table for a page nobody revisits. Cost if wrong: the owner re-runs to see results again.
