# Expense Stage 4 — Background AI Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Submit answers the student at once; right after, an AI agent with read-only expense tools checks the whole reimbursement (types, own-text accounts, Finago project and year), its validated results are saved, and only then are approvers notified or accounting emailed (spec Part D).

**Architecture:** The submit request keeps only cheap work (draft save, occasion rule, decisions from stored scans, exactly-once claim, status `pending`). `runExpenseCheck(expenseId)` runs in `next/server` `after()`: it claims the expense (`check_claim`), runs the agent (or the old fixed AI steps as fallback), applies validated decisions, then creates/notifies the approval chain or sends the email. A cron backstop re-runs any check left `queued`/`running`. The agent is an AI SDK tool loop on `balancedModel` with five read-only tools and one structured final answer that code validates.

**Tech Stack:** Bun monorepo, Next.js 16 `after()`, Vercel AI SDK v7 + `@ai-sdk/anthropic` (`packages/ai/src/models.ts`), Appwrite (`@repo/api`), vitest (api, shared, web), `bun test` (admin, connectors).

**Spec:** `docs/superpowers/specs/2026-11-17-expense-agent-and-projects-design.md` (Part D; Part B7 and the Stage 2/3 carried items).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-agent`. Never use `git stash`. Never push or deploy. Never write production data. Never call a real model in tests (use the AI SDK's mock language model).
- Bun only. Ultracite before each commit; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Schema edits as in earlier stages (config + hand-mirrored types + config test; the owner pushes).
- **The student is never held:** the submit request makes no model call; its response shape and the expense `status` values are unchanged (Flutter). A student sees `pending` immediately.
- **Approvers are notified exactly once, and only after the check finished or fell back.** A failed or slow check still ends in a notification (fallback + `ai_check_incomplete` flag).
- **The agent only proposes.** Its tools are read-only; code validates every type, account and project; a student's explicit type choice is never changed (flag `ai_check_disagrees` instead); every change and flag is written to `expense_events` (actor kind `ai`) and approver hints.
- **No personal data to the model** beyond today's: receipt contents, occasion text, department/campus. Never name, email, phone, bank account.
- Model: `balancedModel` (Claude Sonnet 5.5) per `packages/ai/src/models.ts`, reasoning `medium`; at most 12 steps, 120 s overall deadline, per-tool timeouts, `view_receipt` at most 3 calls. Log steps and token usage per run.
- Test commands as in Stage 3 (`.superpowers/sdd/2026-11-19-expense-stage3-projects/implementer-instructions.md` lists them).

## Review Focus

1. **Two submits of the same draft race** → one check run, one approval chain, one notification. Task 3 test `a double submit runs one check and notifies once`.
2. **The model returns an inactive type, an account outside 4000–7999, or a project from another department** → dropped and flagged; nothing invalid is stored. Task 5 test `invalid proposals are dropped and flagged`.
3. **The model call throws or times out** → fallback fixed steps run, `ai_check_incomplete` flag, approvers notified. Task 3 test `a failed check falls back and still notifies`.
4. **`after()` never ran (instance killed)** → the backstop picks the expense up after 5 minutes and notifies once. Task 4 test `the backstop finishes a stuck check`.
5. **A receipt whose student chose "Travel" and the agent thinks "Food during meetings"** → type unchanged, `ai_check_disagrees` hint with the agent's type. Task 5 test `a student's explicit choice is never changed`.

---

### Task 1: Schema, hint codes and the runtime probe

**Files:** `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts`, `packages/api/appwrite-config.test.ts`; `packages/shared/utils/expense-hints.ts` (+ test); create `apps/api/src/app/api/internal/after-probe/route.ts` (+ test).

**Interfaces — Produces:**
- `expense`: `check_state` enum `["queued","running","done","fallback"]` nullable, `check_claim` integer default 0, `check_started_at` datetime nullable, `check_finished_at` datetime nullable.
- `APPROVER_HINT_CODES` gains `type_unsure`, `project_unsure`, `project_missing`, `project_not_created`, `ai_check_incomplete`, `ai_check_disagrees` (with English/Norwegian card/admin texts wherever existing codes have them).
- Probe: `POST /api/internal/after-probe` (CRON_SECRET) answers `{ started: true }` at once and in `after()` logs `[after-probe] alive <seconds>` every 15 s for 180 s. Used by the owner once after raising the api site timeout; the docs say how to read the result.

- [ ] Failing tests → implement → green → commit `feat(expenses): check state, new approver hints and an after() probe`.

### Task 2: Split submission into a fast request and a background check

**Files:** `apps/api/src/lib/expense-submission.ts` (split `enrichSubmission`), create `apps/api/src/lib/expense-check/run.ts` (+ test), modify `apps/api/src/app/api/expenses/submit/route.ts` (+ test), `apps/api/src/lib/expense-approval.ts` (`createApprovalChain` background mode).

**Interfaces — Produces:**
- `prepareSubmission(admin, expense, payload): Promise<void>` — the request part: decisions from stored scans and client choices with NO model call (unscanned receipts stay undecided), the occasion rule (`OccasionRequiredError` as today), attachment columns and the cheap hints (amount differs, old receipt, receipt issues, legacy app); sets `check_state: "queued"`.
- `runExpenseCheck(expenseId: string, deps?: { now?; agent? }): Promise<"done" | "fallback" | "skipped">` — takes the claim (`incrementRowColumn` on `check_claim` must observe 1; otherwise `"skipped"`), sets `running`/`check_started_at`, runs the agent (Task 5; until then a stub that returns "no answer"), falls back to the old fixed AI steps for anything unsettled (scan unscanned receipts, classify untyped, own-text account, duplicates), writes decisions/hints/events, sets `done` or `fallback` + `check_finished_at`, then — exactly once — creates and notifies the approval chain (ledger posting on) or sends the email (off), then syncs examples (the Stage 2 `after()` sync moves here).
- The submit route: draft save → claim-free `prepareSubmission` → status `pending` (and today's double-submit guard) → response → `after(() => runExpenseCheck(id))`.
- `createApprovalChain(…, { keepPendingOnFailure: true, recordIssue: true })` in background mode: a failure rolls back steps, keeps `pending`, records an `expense_approval_issues` row the IT queue can act on (Resend/Rebuild — extend Rebuild's evidence to this issue kind).

- [ ] **Step 1: Failing tests:** `the submit answer makes no model call`; `submit schedules one check`; `a double submit runs one check and notifies once`; `a failed check falls back and still notifies`; `the email goes out after the check`; `a chain failure in the background keeps the expense pending and records an issue`; `occasion is still required at submit`; `the Flutter submit response is unchanged`.
- [ ] Implement → green (api suite, check-types) → commit `feat(expenses): answer the student first and check the reimbursement after`.

### Task 3: The backstop

**Files:** create `apps/api/src/app/api/cron/expense-check-backstop/route.ts` (+ test); `functions/scheduled-dispatch` (target env `EXPENSE_CHECK_BACKSTOP_URL`, like `FINAGO_PROJECTS_SYNC_URL`); `apps/docs/content/docs/developers/keep-it-running/scheduled-jobs.mdx`.

Every tick: list expenses with `check_state` `queued` or `running` whose `check_started_at` (or `$updatedAt` when queued) is older than 5 minutes, oldest first, limit 5; for each, reset the claim only if it is stale (atomic: a second increment from the stale value) and call `runExpenseCheck`. A check that is stale twice runs fallback-only.

- [ ] Tests: `the backstop finishes a stuck check`; `a fresh running check is left alone`; `a check stale twice runs without the agent` → implement → commit `feat(expenses): a backstop finishes checks the background run lost`.

### Task 4: The agent's tools (read-only)

**Files:** create `apps/api/src/lib/expense-check/tools.ts` (+ test).

**Interfaces — Produces:** AI SDK tools (zod input schemas, each with a timeout and a result cap):
- `search_past_bookings({ text?, vendor?, departmentId?, typeSlug? })` → up to 15 examples incl. own-text rows with their account (spec B7 — do NOT reuse `selectExamples`' "has a type" filter), each with type/text, account, project, `confirmed`, who chose the type. Uses `exampleTeaches`-style skipping of unseen unconfirmed picks.
- `list_projects({ departmentId, receiptDates })` → `departmentCandidates` + per series `editionTiming` for each distinct receipt date (with website event dates from published, non-cancelled `events` of that department whose title contains the series), the department's `shareClass`, and `missing`/`inactiveNext` notes.
- `find_events({ departmentId?, from, to, text? })` → website events (name, date, department) via the shared event helper.
- `search_accounts({ text })` → active cost accounts 4000–7999 (number, name), max 20.
- `view_receipt({ receiptId })` → the receipt file for the model (`fitFileForModel`), only for receipts of THIS expense, max 3 calls per run.
All tool text is untrusted: one line, capped, quotes stripped.

- [ ] Tests per tool (mocked db/storage) incl. `view_receipt refuses another expense's receipt` and `search returns own-text examples with their account` → implement → commit `feat(expenses): read-only tools for the background check`.

### Task 5: The agent loop and applying its answer

**Files:** create `apps/api/src/lib/expense-check/agent.ts`, `apply.ts` (+ tests); wire into `run.ts`.

**Interfaces — Produces:** `checkWithAgent(input: CheckInput, deps: { model; tools; deadlineMs }): Promise<CheckAnswer | null>` — system prompt with the rules (year rule incl. "just after an event → the edition that just finished", never last year's project, flags instead of guesses), up-front context (spec "What the agent sees up front"), tool loop (AI SDK `generateText` with `tools` and a step limit, as the admin assistant does), final structured answer via a `finish_check` tool or output schema: per receipt `{ receiptId, type?, accountNumber?, projectId? | "none", confidence: { type?, account?, project? }, reason }` + `flags[]`. `applyCheck(db, expense, answer, ctx): Promise<{ changes; hints }>` enforces the Global Constraints rules (validation, student choice kept, confidence < 0.8 → `*_unsure`, project expected + none → `project_missing`, `missing` → `project_not_created` with the series) and writes attachments (`project_source: "ai_check"`, `project_confidence`), events and hints.

- [ ] Tests (mock model scripted to call tools then finish): `invalid proposals are dropped and flagged`; `a student's explicit choice is never changed`; `an AI-picked type can be corrected and is logged`; `own text gets the agent's account as ai_freeform`; `a project the department expects but none fits is flagged`; `a missing next year's project is flagged, never last year's`; `step limit and deadline end the run with no answer`; `the prompt carries no name, email or bank account` → implement → commit `feat(expenses): the background check proposes, code decides`.

### Task 6: What approvers and accounting get

**Files:** `apps/api/src/app/api/expenses/submit/route.ts` (`submitByEmail` — now called from `run.ts`), `apps/api/src/lib/pdf/expense-pdf.tsx`, `apps/api/src/lib/expense-card-details.ts` + `packages/connectors/src/teams-bot/cards.ts` (new hint texts, agent reasons per receipt).

The accounting email and PDF cover list per receipt: date, description, amount, type name or own text, account, project; plus occasion, event and the flags in plain words. The Teams card and approval email show the new hints and, per receipt, the check's one-line reason when it changed or flagged something.

- [ ] Tests → implement → commit `feat(expenses): approvers and accounting see what the check found`.

### Task 7: Admin — checking state, check notes, AI tab

**Files:** admin expenses list/detail (`expenses-data.ts`, `expense-status-badge.tsx`, `expense-receipts.tsx`), AI settings tab (`settings/ai/*`), i18n.

- "Checking" badge while `check_state` is `queued`/`running`; the detail shows the check's reasons and flags per receipt.
- AI tab (carried from Stage 2): fix the labels that are now wrong ("Would pick the booked type", "Booked type", "The rest only have the student's own text"), show the re-run check's confirmed/unconfirmed scores, and add the project kept-rate (how often the check's project was kept by approvers, from `project_source` and the history).

- [ ] Tests → implement → admin build → commit `feat(admin): see the background check and how often its projects are kept`.

### Task 8: Docs and verification

Guide pages (expenses-admin, expense-types/projects, the student page: "your reimbursement is checked right after you submit; approvers get it a minute later"), developer pages (ai.mdx: the agent, tools, limits, fallback; accounting.mdx; scheduled-jobs.mdx: backstop; deploying/secrets: the probe and the timeout). Run every suite, root check-types, admin and docs builds → commit `docs(expenses): the background check`.
