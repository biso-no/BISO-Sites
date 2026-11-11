# Expense Types and AI — Stage 2b (student web UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Students set each receipt's expense type straight from the overview list with a searchable combobox that also accepts their own text, see when the AI picked or needs them to pick, answer the occasion question when a type asks for it, accept a suggested BISO event, see receipt-check and duplicate warnings, and get a general description rewritten with the types — while the server carry-overs from Stage 2a are closed.

**Architecture:** The web page loads the active types server-side (names only, no accounts) and passes them to the client store. The OCR response (Stage 2a) fills each receipt's type state. A new `ExpenseTypeCombobox` (Popover + Command) is used in the overview row and the detail pane. The web becomes the first non-legacy client: it sends `cost_type_chosen: true`, `cost_type`/`cost_type_text`, `occasion`, `event_id`. The summary endpoint also suggests an occasion. Two server fixes from the 2a final review land first.

**Tech Stack:** Next.js 16 App Router (RSC + client components), React 19, zustand store, next-intl, `@repo/ui` Popover/Command (cmdk), Vitest (apps/web, apps/api).

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md` — Stage 2 ("The type combobox in the overview", "General description", "More AI help during submission" items 1–4). Stage 2a rulings and carry-overs: `.superpowers/expense-ai-rulings-stage2a.md` (git-ignored, in the worktree).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never `cd` to the main checkout. Never push. Bun only. Never stage uncommitted `apps/web` changes you didn't make (an outside session's cookie-rename edits may appear: leave them).
- Never call the real Anthropic API or production Appwrite in tests.
- **Students never see account numbers.** The type options sent to the browser carry `slug`, `label`, `labelNo`, `askOccasion` only.
- AI confidence threshold **0.8** (`AI_TYPE_CONFIDENCE_THRESHOLD` from `@repo/shared/utils/expense-cost-types`). Event match window **±7 days**.
- The web always sends `cost_type_chosen: true` on every attachment (a type the AI filled in confidently was shown to the student), `cost_type` (slug or `""`), `cost_type_text` (own text or `null`), and `occasion` / `event_id` (value or `null` to clear).
- `apps/web/CLAUDE.md` design rules: redesign primitives and tokens only (`bg-surface`, `text-ink`, `text-ink-muted`, `border-edge`, `bg-action`, …), no Tailwind palette colours, no gradients/blur, no scroll-triggered motion; `src/app/styles.test.ts` and `motion.test.ts` must pass. Accessible: labelled controls, full keyboard use, visible focus (`focusRingClass`).
- i18n: every string in `packages/i18n/messages/{en,no}/expenses.json`; Norwegian reads naturally ("Dare to be more." stays English if used).
- Feature flag: AI-dependent UI (AI marks, needs-choice from AI, occasion suggestion) only when `ocrEnabled`; with OCR off the student simply picks a type for each receipt.
- Before each commit: `bun x ultracite fix <changed files>`. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Type checks: `bun run check-types --filter=web --filter=api`.

## Review Focus

- A draft saved before this change (attachments with `cost_type` slugs, no `cost_type_text`) reopens with every receipt shown as *chosen* with its old type, and can be submitted without re-picking. → Task 3, `hydrates an old draft's slugs as chosen`.
- A receipt whose AI slug is not among the active types (or confidence < 0.8) is *needs a choice* and blocks submit until picked. → Task 3, `marks an unknown or unsure AI type as needs-choice`.
- Typing text that exactly matches a type's name (either language, any case) selects that type rather than creating own text. → Task 4, `selects the matching type when the typed text equals a name`.
- A bank statement attached to a receipt (amount 0 / `parentId`) never asks for a type. → Task 3, `does not require a type for a linked bank statement`.
- A description the student edited is never overwritten by a later AI rewrite. → Task 6, `keeps a description the student edited`.

---

### Task 1: Server carry-overs (apps/api)

**Files:** `apps/api/src/lib/expense-submission.ts` (+ test), `apps/api/src/lib/expense-summary.ts` (+ test), `apps/api/src/app/api/expenses/summary/route.ts` (+ test), `apps/api/src/app/api/expenses/ocr/route.ts` (+ test)

**Interfaces — produces:**
- `enrichSubmission`: for a **non-legacy** payload, when the `occasion` / `event_id` key is absent, use the stored expense's value (it already reads the saved draft) instead of clearing it; an explicit `null` clears. The occasion requirement checks that effective value.
- One overall enrichment deadline: `ENRICHMENT_BUDGET_MS = 14000`, measured from the start of `enrichSubmission`. Fresh scans and `chooseAccountForText` calls that have not **started** by the deadline are skipped (their receipts get today's "no scan" / `account_missing` handling); calls in flight keep their own caps. Downloads count towards the budget.
- Summary: `SummarySchema` gains `occasionSuggestion: z.string().nullable()` described as "the occasion and who it was for, only when the receipts make it evident; otherwise null". The route responds `{ success, summary, occasionSuggestion }` (old clients ignore the extra field). The prompt adds the rule. Student-entered values interpolated into the prompt (`occasion`, `eventName`, each `costType`) are trimmed, newlines collapsed, and capped (occasion 1000, event 100, type 120).
- OCR reuse: when a stored classification's slug is not among the active types, return `costType: null, costTypeConfidence: 0` (load the active types for the reuse path too).

- [ ] **Step 1: Failing tests** — `keeps the stored occasion when a new client leaves it out`, `clears the occasion when a new client sends null`, `requires the stored occasion's presence for a type that asks`, `skips fresh scans that would start after the budget` (fake timers / injected clock: give `enrichSubmission` an optional `now: () => number` for tests), `summary returns an occasion suggestion`, `summary collapses newlines in student text`, `ocr reuse drops an inactive stored type`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-submission.test.ts src/lib/expense-summary.test.ts src/app/api/expenses/summary src/app/api/expenses/ocr`.
- [ ] **Step 3: Implement.** **Step 4: Run** the apps/api suite → PASS; `bun run check-types --filter=api`.
- [ ] **Step 5: Commit** — `fix(api): stored occasion for new clients, submit time budget, occasion suggestion`.

---

### Task 2: Type options for the web page

**Files:** Create `apps/web/src/lib/data/expense-types.ts` (+ `expense-types.test.ts`); modify `apps/web/src/app/(protected)/fs/new/page.tsx`, `apps/web/src/components/expense-v3/expense-split-view.tsx` (props), `apps/web/src/components/expense-v3/store.ts`

**Interfaces — produces:**
- `export interface ExpenseTypeOption { slug: string; label: string; labelNo: string | null; askOccasion: boolean }` (in `store.ts` or a small `types.ts` beside it, importable by client components).
- `getExpenseTypeOptions(): Promise<ExpenseTypeOption[]>` (server-only, `import "server-only"`): admin client `listRows("app","expense_cost_types",[Query.limit(200)])`, active rows sorted by `sort_order` then label, mapped to the four fields only; empty table → `STARTING_EXPENSE_COST_TYPES` mapped the same way. Throws on Appwrite errors (the page's call site falls back to the starting list and logs).
- `ExpenseSplitView` gains a required prop `typeOptions: ExpenseTypeOption[]`; the store gains `typeOptions` + `setTypeOptions`, set during the existing init effect.

- [ ] **Step 1: Failing tests** — `maps active rows to name-only options sorted by order`, `never includes account numbers` (assert no key other than the four), `falls back to the starting list when empty`.
- [ ] **Step 2: Run, see fail** — `cd apps/web && bun run test src/lib/data/expense-types.test.ts`.
- [ ] **Step 3: Implement**, wire the page (`.catch` → starting list at the call site).
- [ ] **Step 4: Run** → PASS; `bun run check-types --filter=web`.
- [ ] **Step 5: Commit** — `feat(web): load expense type names for the receipt form`.

---

### Task 3: Receipt type state, OCR mapping, drafts, payload and submit gating

**Files:** `apps/web/src/components/expense-v3/store.ts`, `apps/web/src/components/expense-v3/receipt-types.ts` (create: pure helpers) + `receipt-types.test.ts`, `apps/web/src/components/expense-v3/expense-split-view.tsx`

**Interfaces — produces (`receipt-types.ts`, pure):**
- `type TypeState = "ai" | "needs_choice" | "chosen"`.
- `Receipt` gains `costTypeText?: string`, `typeState?: TypeState`, `aiCostType?: string | null`, `aiConfidence?: number`, `receiptIssues?: ReceiptIssueCode[]`, `possibleDuplicate?: boolean`.
- `typeFromOcr(data: { costType?: string | null; costTypeConfidence?: number; documentType?: string }, options: ExpenseTypeOption[], ocrEnabled: boolean): Pick<Receipt, "costType" | "typeState" | "aiCostType" | "aiConfidence">` — bank statement → `{ typeState: undefined }` (no type needed); confident (≥ 0.8) and slug among options → `costType` = slug, `typeState: "ai"`; otherwise `costType: undefined`, `typeState: "needs_choice"`.
- `typeFromAttachment(att: { cost_type?: string | null; cost_type_text?: string | null }, options): Pick<Receipt, "costType" | "costTypeText" | "typeState">` — own text → chosen text; a known slug → chosen slug; an unknown non-empty slug (deactivated type) → chosen slug kept (server resolves inactive slugs) ; nothing → `needs_choice`.
- `needsType(receipt: Receipt): boolean` — `amount > 0 && !receipt.parentId && receipt.documentType !== "bank-statement"`.
- `missingTypes(receipts: Receipt[]): Receipt[]` — receipts that need a type but have neither `costType` nor `costTypeText`.
- `occasionRequired(receipts: Receipt[], options: ExpenseTypeOption[]): boolean` — any receipt whose `costType` option has `askOccasion`.
- `attachmentTypeFields(receipt: Receipt): { cost_type: string; cost_type_text: string | null; cost_type_chosen: true }`.
- Store: `occasion: string`, `occasionTouched: boolean`, `eventId: string | null`, `eventName: string` + setters; `isReadyToSubmit` also requires `missingTypes(...).length === 0` and, when `occasionRequired`, a non-blank `occasion`.
- `buildReceiptFromOcr` merges `typeFromOcr(...)`, `receiptIssues`, `possibleDuplicate`; draft hydration uses `typeFromAttachment` and loads `occasion` / `event_id` / `eventName` from the draft (`InitialExpenseDraft` picks gain them); `buildExpensePayload` sends `attachmentTypeFields`, `occasion` (trimmed or `null`), `event_id`, `eventName`. Remove the `defaultCostTypeSlugForCategory` fallback. With OCR off every new receipt starts `needs_choice`.
- Submit: when the API answers 400 with `field: "occasion"`, show the occasion error (Task 5's field) instead of the generic toast.

- [ ] **Step 1: Failing tests** (pure, Vitest) — `marks a confident known AI type as ai`, `marks an unknown or unsure AI type as needs-choice`, `hydrates an old draft's slugs as chosen`, `hydrates own text as chosen`, `does not require a type for a linked bank statement`, `requires an occasion only for a type that asks`, `sends cost_type_chosen with slug or own text`.
- [ ] **Step 2: Run, see fail** — `cd apps/web && bun run test src/components/expense-v3/receipt-types.test.ts`.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS; `bun run check-types --filter=web`.
- [ ] **Step 5: Commit** — `feat(web): receipt type state, chosen-type payload and submit gating`.

---

### Task 4: `ExpenseTypeCombobox`

**Files:** Create `apps/web/src/components/expense-v3/expense-type-combobox.tsx` (+ `expense-type-combobox.test.tsx` if the web test setup renders React; otherwise test the pure matcher), `apps/web/src/components/expense-v3/type-search.ts` (+ test); strings in `expenses.json` (en/no)

**Interfaces — produces:**
- `filterTypeOptions(query: string, options: ExpenseTypeOption[], locale: string): { matches: ExpenseTypeOption[]; exact: ExpenseTypeOption | null; offerOwnText: boolean }` — case/diacritic-insensitive substring match on `label` and `labelNo`; `exact` when the trimmed query equals a name in either language; `offerOwnText` when the trimmed query is non-empty and there is no `exact`.
- `<ExpenseTypeCombobox value={{ costType?: string; costTypeText?: string }} state={TypeState | undefined} options locale disabled? onChange={(next: { costType: string } | { costTypeText: string }) => void} id? ariaLabel? compact?: boolean />`
  - Built from `@repo/ui` `Popover` + `Command` with `shouldFilter={false}` (filtering via `filterTypeOptions`).
  - Trigger shows the chosen label (via `costTypeLabel`) or the own text in quotes, an "AI" mark when `state === "ai"`, and a warning style + "Choose a type" (`Velg type`) when `state === "needs_choice"`.
  - The list ends with a separator and a visually distinct item (plus icon, italic) **Use “{text}”** (`Bruk «{text}»`) when `offerOwnText`.
  - **Enter** with no highlighted option picks own text; when `exact` exists, Enter picks the exact type.
  - Keyboard: trigger is a `button` with `aria-haspopup="listbox"`, `aria-expanded`; the search input has a label; Escape closes and returns focus to the trigger.
  - `compact` renders a smaller trigger for the overview row.

- [ ] **Step 1: Failing tests** — `filterTypeOptions matches Norwegian and English names ignoring case and diacritics`, `selects the matching type when the typed text equals a name`, `offers own text only when nothing matches exactly`, `ignores a blank query`.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement.** **Step 4: Run** → PASS; check-types.
- [ ] **Step 5: Commit** — `feat(web): searchable expense type combobox with own text`.

---

### Task 5: Overview row, detail pane, occasion, event match and warnings

**Files:** `apps/web/src/components/expense-v3/expense-report.tsx`, `apps/web/src/components/expense-v3/generative-receipt-preview.tsx`, `apps/web/src/components/expense-v3/expense-split-view.tsx`; create `apps/web/src/lib/actions/expense-events-match.ts` (+ test); strings en/no

**Interfaces:**
- Overview: `ReceiptRow` gets the combobox (`compact`) in a new "Type" column between Item and Date on `md+`, and under the vendor line on mobile. The row's click-to-select must not fire when interacting with the combobox (stop propagation). Rows needing a type show the warning state; a short line under the vendor shows receipt-issue notices (`receiptIssueLabel(code)`) and "Looks like a receipt already submitted" (`Ser ut som en kvittering som allerede er sendt inn`) when `possibleDuplicate`.
- Detail pane: `CostTypeField` is replaced by the combobox (full size); the same notices appear above the fields.
- Occasion: when `occasionRequired`, a labelled textarea **"What was the occasion, and who was it for?"** (`Hva var anledningen, og hvem var det for?`) under the description, required (submit disabled with a hint while blank). Prefilled from Task 6's `occasionSuggestion` only while `occasionTouched` is false; editing sets `occasionTouched`.
- Event match: `findNearbyDepartmentEvents(input: { departmentId: string; dates: string[] }): Promise<{ success: boolean; data?: { id: string; title: string; startDate: string }[]; error?: string }>` (server action, session or admin client read; published, not cancelled events of that department whose `start_date` is within ±7 days of any receipt date; title from the event's translation in the current locale, as `listEvents` does; at most 3, nearest first). The report shows one chip **"Was this for {event}?"** (`Var dette til {event}?`) with **Yes**/**No**; Yes sets `eventId`/`eventName`, No hides the suggestion for this session; a chosen event shows as a removable tag. Called when receipt dates or the department change (debounced).
- Submit gating message: when types are missing, the submit button's hint says "Choose a type for every receipt" (`Velg type for alle kvitteringene`) and the first such row scrolls into view on submit attempt.

- [ ] **Step 1: Failing tests** — `findNearbyDepartmentEvents returns at most three published events within seven days, nearest first`, `findNearbyDepartmentEvents returns success false on error` (mock `@repo/api/server`), plus pure helper tests for any date-window function you extract.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement** the UI per the rules above.
- [ ] **Step 4: Run** `cd apps/web && bun run test` (incl. `styles.test.ts`, `motion.test.ts`) → PASS; check-types.
- [ ] **Step 5: Commit** — `feat(web): types in the receipt list, occasion question, event match and warnings`.

---

### Task 6: Description regeneration with types

**Files:** `apps/web/src/components/expense-v3/expense-split-view.tsx`, `apps/web/src/components/expense-v3/store.ts`, create `apps/web/src/components/expense-v3/summary-rules.ts` (+ test)

**Interfaces — produces (`summary-rules.ts`, pure):**
- `summaryKey(input: { receipts: Receipt[]; options: ExpenseTypeOption[]; locale: string; occasion: string; eventName: string; assignment: {...} }): string` — includes each receipt's type label or own text, the occasion and the event.
- `shouldRegenerate(input: { allReady: boolean; missingTypes: number; key: string; lastKey: string; descriptionEditedByStudent: boolean }): boolean` — false while any receipt lacks a type, false when the student edited the description since the last AI text, else `key !== lastKey`.
- Store: `lastAiDescription: string`; `setDescription` from the textarea marks it student-edited when the text differs from `lastAiDescription`; AI writes set both.
- The summary request sends each receipt's `costType` (display label or own text), `occasion`, `eventName`; on success sets the description and, if `!occasionTouched` and the response has `occasionSuggestion`, prefills `occasion`.
- Drafts: a reopened draft's description counts as student-edited (never overwritten automatically).

- [ ] **Step 1: Failing tests** — `waits until every receipt has a type`, `keeps a description the student edited`, `regenerates when a type changes`, `includes occasion and event in the key`.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement.** **Step 4: Run** → PASS; check-types.
- [ ] **Step 5: Commit** — `feat(web): rewrite the description with receipt types, never over student edits`.

---

### Task 7: Docs

**Files:** `apps/docs/content/docs/guide/access-and-settings/expense-types.mdx` ("What the student sees", occasion note), `apps/docs/content/docs/developers/reference/accounting.mdx` ("Types and AI": the web is a new client sending `cost_type_chosen`; occasion stored-value rule; 14 s budget; occasion suggestion); `covers` += the new web files (`apps/web/src/components/expense-v3/**` if not already covered elsewhere, `apps/web/src/lib/data/expense-types.ts`, `apps/web/src/lib/actions/expense-events-match.ts`).

- [ ] **Step 1: Update both pages** against the code (every claim checked; the Flutter app is still an older client until Stage 5).
- [ ] **Step 2:** `cd apps/docs && bun test` → PASS; `bun run check-types --filter=docs`.
- [ ] **Step 3: Commit** — `docs: the receipt type picker, occasion question and event match`.

## Rulings made in this plan

- **R1** — The web sends `cost_type_chosen: true` for every attachment, including AI-filled types, because the student saw and kept them.
- **R2** — The occasion suggestion comes from the existing summary call (one model call, not two).
- **R3** — An old draft's slug is shown as chosen even if its type is now inactive; the server still books inactive slugs.
- **R4** — Event match is a web server action reading `events` directly (public data), not an apps/api endpoint.
