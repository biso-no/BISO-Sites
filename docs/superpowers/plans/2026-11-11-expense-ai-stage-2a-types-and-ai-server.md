# Expense Types and AI — Stage 2a (server and admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed expense types, an AI that picks a type (with confidence) for every receipt and remembers each scan server-side, account snapshots and AI accounts for the student's own text at submission, approver hints, and anonymous booked examples that feed later classifications.

**Architecture:** Receipt scanning moves out of the OCR route into `apps/api/src/lib/receipt-scan.ts` as two calls: extraction (existing prompt, balanced model, now also returns receipt issues) and classification (fast model, text-only, given the live type list and past examples). The OCR route stores every scan in `expense_receipt_scans` keyed by the file's SHA-256. At submission, `apps/api/src/lib/expense-submission.ts` hashes each stored file, reuses (or makes) its scan, resolves each receipt's type and account, computes approver hints and writes history events. Booking writes anonymous rows to `expense_type_examples`. Admin gets an Expenses → Settings → Types page backed by `expense_cost_types` and `ledger_accounts`. The web UI is Stage 2b.

**Tech Stack:** TypeScript, Bun workspaces, Next.js 16 (admin), Vitest (apps/api, packages/shared, packages/api), `bun:test` (apps/admin), AI SDK `generateObject` with `@repo/ai/models` (`balancedModel`, `fastModel`), Appwrite TablesDB via `@repo/api/server`.

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md` — Stage 2 (except the web UI parts, which are Stage 2b) and the Stage 5 note that legacy app payloads lack `cost_type_chosen`.

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never `cd` to the main checkout. Never push. Dependencies are installed.
- Bun only. Never write to production Appwrite or live Finago, and never call the real Anthropic API in tests (mock `ai`'s `generateObject`).
- `packages/api/types/appwrite.ts` is regenerated, never hand-edited: `appwrite types -l ts "$TMP/out"` into a **new** directory, copy `appwrite.d.ts` over `types/appwrite.ts`, fix the header line to `./types`, `bun x ultracite fix`, then keep only this task's hunks (the generator also emits unrelated drift and one invalid hunk for the 24SevenOffice auth-tokens table; revert those).
- The Flutter app uses `/api/expenses/ocr`, `/summary`, `/draft`, `/submit`, `/attachments`: every existing request and response field keeps working. New fields are additive and optional.
- AI confidence threshold: **0.8** (`AI_TYPE_CONFIDENCE_THRESHOLD`). Old-receipt hint: **90** days. Amount-differs hint: more than **1** NOK apart.
- Students never see account numbers. Examples never store a submitter, a name or an expense id.
- AI features are gated like OCR today: `expenses_module && expenses_ocr`. With the flag off, nothing calls a model: no classification, no AI account; missing types fall back to `other` with an approver hint.
- Admin pages use `requireNavAccess`, server actions return `ActionResult<T> = { data: T } | { error: string }`, validate with zod, `logAuditEvent`, `revalidatePath` (pattern: `apps/admin/src/app/(portal)/shop/accounting/`). Admin strings are i18n'd in `packages/i18n/messages/{en,no}/adminPortal.json`; Norwegian copy must read naturally (no literal translations).
- Docs follow `apps/docs/CLAUDE.md`.
- Before each commit: `bun x ultracite fix <changed files>`. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Type checks: `bun run check-types --filter=<pkg>` (`api`, `admin`, `@repo/shared`, `@repo/api`, `web`).

## Review Focus

- A Flutter 2.2.15/2.2.16 submission (no `cost_type_chosen`, a default slug on every receipt, no occasion) must still submit: no 400 for a missing occasion, its slug used as a suggestion, and a hint when the AI disagrees confidently. → Task 7, `treats a legacy app payload's type as a suggestion` and Task 8, `accepts a legacy app submission without occasion`.
- The AI returning a type slug that is not in the live list (or an inactive one) must never reach the database as the receipt's type. → Task 4, `drops an unknown slug to null with confidence 0`.
- The table being empty (owner hasn't seeded) must not break uploads or submission: the starting list is used. → Task 3, `falls back to the starting list when the table is empty`.
- A scan-store or example write failing must never fail an upload, a submission or a booking. → Task 6 `still answers when the scan cannot be stored`, Task 9 `keeps success when example writes fail`.
- A client sending its own `ai_cost_type`, `ai_confidence`, `ocr_amount` or `receipt_issues` must not have them stored. → Task 8, `ignores AI fields sent by the client`.

---

### Task 1: Schema for types, scans, examples and submission fields

**Files:**
- Modify: `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts` (regenerated), `packages/api/appwrite-config.test.ts`, `apps/docs/content/docs/developers/change-it/data-model.mdx`

**Interfaces — produces:**
- `expense_cost_types`: + `label_no` (string 120, optional), `ask_occasion` (boolean, optional, default `false`).
- `expense_attachments`: + `expense_id` (string 64), `cost_type_text` (string 120), `type_source` (enum `ai|student|legacy_app`), `ai_cost_type` (string 40), `ai_confidence` (double), `account_source` (enum `type|ai_freeform|approver|admin`), `ocr_amount` (double), `file_hash` (string 64), `receipt_issues` (string 500, JSON array of codes); all optional, default null. Indexes `idx_file_hash` (key, `file_hash`), `idx_expense_id` (key, `expense_id`), `idx_date_amount` (key, `date` + `amount`).
- `expense`: + `occasion` (string 1000), `event_id` (string 64), `approver_hints` (string 4000, JSON); optional.
- New table `expense_receipt_scans` ("Expense Receipt Scans"): `file_hash` (string 64, required), `result` (string 8000, required, JSON), `model` (string 64); unique index `idx_file_hash`. `$permissions: ["read(\"team:sg-app-dept-operationsunit\")"]`, `rowSecurity: false`, `databaseId: "app"`.
- New table `expense_type_examples` ("Expense Type Examples"): `vendor_key` (string 120), `description` (string 255), `amount` (double), `ai_cost_type` (string 40), `ai_confidence` (double), `final_cost_type` (string 40), `final_text` (string 120), `account_number` (integer), `source` (enum `student|approver|admin`, required); index `idx_vendor_key` (key). Same permission shape.
- Regenerated types for all of the above.

- [ ] **Step 1: Write failing config tests** in `packages/api/appwrite-config.test.ts` (one `describe("expense AI schema")`): each new table exists with exactly `['read("team:sg-app-dept-operationsunit")']`; `expense_receipt_scans` has a `unique` index whose first column is `file_hash`; `expense_attachments` has columns `file_hash`, `expense_id`, `ai_cost_type`, `type_source`, `account_source`, `receipt_issues` and an index on `file_hash`; `expense` has `occasion`, `event_id`, `approver_hints`; `expense_cost_types` has `label_no` and `ask_occasion`.
- [ ] **Step 2: Run and see them fail** — `cd packages/api && bun run test appwrite-config.test.ts` → the new tests FAIL.
- [ ] **Step 3: Add the columns, indexes and tables**, copying the JSON shapes of existing columns (string: `expense_approval_issues.reason`; enum: `expense_approvals.status`; double/integer/boolean/datetime: existing columns of those types in `expense_attachments`/`expense_cost_types`; index: `expense_approvals.idx_token_hash` for unique, `idx_status` for key).
- [ ] **Step 4: Run the tests again** → PASS.
- [ ] **Step 5: Regenerate the types** (Global Constraints procedure); `git diff --stat packages/api/types/appwrite.ts` touches only this task's tables/columns/enums.
- [ ] **Step 6: Type-check** — `bun run check-types --filter=@repo/api --filter=api --filter=web --filter=admin` → clean.
- [ ] **Step 7: Add the two tables to the Expenses row** in `data-model.mdx`.
- [ ] **Step 8: Commit** — `feat(api): schema for expense types, receipt scans, examples and submission AI fields`.

---

### Task 2: Shared type list, threshold and hint vocabulary

**Files:**
- Modify: `packages/shared/utils/expense-cost-types.ts`, `packages/shared/utils/expense-cost-types.test.ts`
- Create: `packages/shared/utils/expense-hints.ts`, `packages/shared/utils/expense-hints.test.ts`

**Interfaces — produces (`expense-cost-types.ts`):**
- `CostTypeOption` gains optional `labelNo?: string | null`, `askOccasion?: boolean`, `active?: boolean`, `sortOrder?: number`.
- `export const AI_TYPE_CONFIDENCE_THRESHOLD = 0.8;`
- `export const STARTING_EXPENSE_COST_TYPES: readonly CostTypeOption[]` — exactly these 22, in this order (slug · label · Norwegian label · account · askOccasion · AI note):

| slug | label | labelNo | acct | ask | description (note for the AI) |
|---|---|---|---|---|---|
| travel | Travel | Reise | 7140 | – | Flights, train, bus, hotel and taxi |
| travel-food | Food while travelling | Mat på reise | 7160 | – | Meals bought while travelling for BISO |
| car-transport | Car rental, fuel and parking | Leiebil, drivstoff og parkering | 6430 | – | Hired cars or vans, fuel, tolls and parking |
| meeting-food | Food during meetings | Møtemat | 7360 | ✓ | Food or drinks for a meeting; not social events |
| board-event | Board or internal event | Styre- eller internarrangement | 7300 | ✓ | Food and activities for a board or committee's own members |
| social | Social event | Sosialt arrangement | 7310 | ✓ | Parties and social events for students |
| academic | Academic event | Faglig arrangement | 7305 | – | Talks, seminars, case competitions and other academic events |
| open-day | Open day, stands and recruitment | Stand, åpen dag og rekruttering | 7315 | – | Stands, open days and recruitment days |
| general-assembly | General assembly | Generalforsamling | 7316 | – | Food and costs for general assemblies |
| venue-rental | Venue rental | Leie av lokale | 6310 | – | Renting a room or venue |
| equipment | Equipment and inventory | Utstyr og inventar | 6540 | – | Equipment, adapters, microphones and other inventory |
| office-supplies | Office supplies | Kontorrekvisita | 6800 | – | Office supplies and small items for the office |
| digital-services | Digital services and software | Digitale tjenester og programvare | 6810 | – | Software, subscriptions and online services |
| marketing | Marketing and print | Markedsføring og trykk | 7320 | – | Posters, banners, ads and printing |
| merch | Merch and clothing | Merch og klær | 7325 | – | Sweaters, T-shirts and other branded clothing |
| prizes | Prizes | Premier | 7330 | – | Prizes for competitions |
| gifts-external | Gifts to external people | Gaver til eksterne | 7420 | – | Flowers and gifts for speakers, partners and guests |
| gifts-volunteers | Gifts to volunteers and board | Gaver til frivillige og styret | 5900 | ✓ | Gifts for BISO volunteers and board members |
| shipping | Shipping and postage | Frakt og porto | 6100 | – | Sending parcels and freight |
| cabin-rental | Cabin rental | Hytteleie | 6490 | – | Renting a cabin |
| courses | Courses and training | Kurs og opplæring | 6860 | – | Courses, training and first aid |
| other | Other | Annet | 6555 | – | Anything that does not fit the types above |

  Every entry has `taxCode: 0`, `active: true`, `sortOrder` = its index.
- `DEFAULT_EXPENSE_COST_TYPES` stays exported (web compiles until Stage 2b) and becomes the four entries of `STARTING_EXPENSE_COST_TYPES` with slugs `travel`, `social`, `academic`, `other`, in that order. *(Ruling R1: `academic` → 7305 and `other` → 6555 everywhere, per the spec's mapping.)*
- `findCostType`, `defaultCostTypeSlugForCategory`, `resolveReceiptAccount` keep their signatures.
- `export function costTypeLabel(option: CostTypeOption, locale: string): string` — `labelNo` when `locale === "no"` and set, else `label`.

**Interfaces — produces (`expense-hints.ts`):**
- `export const RECEIPT_ISSUE_CODES = ["not_a_receipt", "no_items", "unreadable", "missing_seller", "missing_date", "missing_total"] as const; export type ReceiptIssueCode = (typeof RECEIPT_ISSUE_CODES)[number];`
- `export type ApproverHintCode = "amount_differs" | "old_receipt" | "possible_duplicate" | "receipt_issue" | "ai_account_unsure" | "account_missing" | "app_type_replaced" | "type_defaulted" | "occasion_missing";`
- `export interface ApproverHint { code: ApproverHintCode; attachmentId?: string; data?: Record<string, string | number> }`
- `parseReceiptIssues(value: string | null | undefined): ReceiptIssueCode[]` and `parseApproverHints(value: string | null | undefined): ApproverHint[]` — tolerant JSON parsers; unknown codes dropped; invalid JSON → `[]`.

- [ ] **Step 1: Write failing tests** — `STARTING_EXPENSE_COST_TYPES` has 22 unique slugs, includes `travel`/`social`/`academic`/`other` with accounts 7140/7310/7305/6555; `DEFAULT_EXPENSE_COST_TYPES.map(s => s.slug)` equals `["travel","social","academic","other"]`; `costTypeLabel` returns `"Møtemat"` for `meeting-food` in `"no"` and `"Food during meetings"` in `"en"`; `parseReceiptIssues('["no_items","bogus"]')` → `["no_items"]`; `parseApproverHints("{")` → `[]`. Update existing tests that pinned 7315/7790.
- [ ] **Step 2: Run and see them fail** — `cd packages/shared && bun run test utils/expense-cost-types.test.ts utils/expense-hints.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run again** → PASS. `bun run check-types --filter=@repo/shared --filter=web --filter=api --filter=admin` → clean.
- [ ] **Step 5: Commit** — `feat(shared): starting expense types, AI threshold and approver hint vocabulary`.

---

### Task 3: Loading the live types and the cost accounts in apps/api

**Files:**
- Create: `apps/api/src/lib/expense-types.ts`, `apps/api/src/lib/expense-types.test.ts`
- Modify: `apps/api/src/lib/expense-posting.ts` (reuse `loadActiveCostTypes` instead of its private `loadCostTypeOptions`)

**Interfaces — produces:**
- `loadActiveCostTypes(db): Promise<CostTypeOption[]>` — all `expense_cost_types` rows (`Query.limit(200)`), mapped to `CostTypeOption` (`label_no`→`labelNo`, `ask_occasion`→`askOccasion`, `sort_order`→`sortOrder`); returns **active** rows sorted by `sort_order`, then label. Empty table → `STARTING_EXPENSE_COST_TYPES`.
- `loadAllCostTypes(db): Promise<CostTypeOption[]>` — same mapping including inactive rows (posting must resolve old slugs); empty table → `STARTING_EXPENSE_COST_TYPES`.
- `interface CostAccountOption { accountNumber: number; name: string; taxCode: number }`
- `loadCostAccounts(db): Promise<CostAccountOption[]>` — `ledger_accounts` with `active = true` and `4000 ≤ account_number < 8000`, sorted by number; `taxCode = tax_code ?? 0`.
- Posting resolves slugs with `loadAllCostTypes` (inactive types still book).

- [ ] **Step 1: Failing tests** (mock db `listRows` by table): `returns active types sorted by sort_order`, `falls back to the starting list when the table is empty`, `loadAllCostTypes keeps inactive rows`, `loadCostAccounts keeps only active 4000–7999 accounts`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-types.test.ts`.
- [ ] **Step 3: Implement**; swap posting's loader; existing posting tests still pass.
- [ ] **Step 4: Run** `bun run test src/lib/` → PASS.
- [ ] **Step 5: Commit** — `feat(api): load live expense types and cost accounts`.

---

### Task 4: Receipt scanning library (extract + classify + scan store)

**Files:**
- Create: `apps/api/src/lib/receipt-scan.ts`, `apps/api/src/lib/receipt-scan.test.ts`
- Modify: `apps/api/src/app/api/expenses/ocr/route.ts` (move extraction code out; behaviour unchanged in this task)

**Interfaces — produces:**
- `type ScanPurpose = "receipt" | "bank-statement" | "auto"`
- `interface ExtractedReceipt` — the existing `ExpenseDataSchema` fields (`address, category, city, country, documentType, description, amount, currency, date, purchaseContext, vendor`) plus `receiptIssues: ReceiptIssueCode[]`.
- `extractReceipt(input: { buffer: Buffer; mimeType: string; purpose: ScanPurpose }): Promise<ExtractedReceipt>` — the existing prompts and `balancedModel` call, with `receiptIssues` added to the schema (`z.array(z.enum(RECEIPT_ISSUE_CODES))`, described: list only problems that are clearly visible; empty when the document is a proper receipt or a bank statement) and one line added to each prompt saying so.
- `interface TypeExample { vendorKey: string; description: string; finalType: string; source: "student" | "approver" | "admin" }`
- `interface Classification { costType: string | null; confidence: number; reason: string | null }`
- `buildClassificationPrompt(input: { receipt: ExtractedReceipt; types: CostTypeOption[]; examples: TypeExample[] }): string` — pure. Lists each type as `slug — label: description`, then up to 10 examples as `"<vendor/description>" → <slug> (<source>)` under "Past receipts like these were booked as:", then the receipt's vendor, description, purchase context, amount, currency, city, country. Instructs: answer with one slug from the list, a confidence between 0 and 1 (below 0.8 when two types fit or the purpose is unclear), and a one-sentence reason.
- `classifyReceipt(input: { receipt: ExtractedReceipt; types: CostTypeOption[]; examples: TypeExample[] }): Promise<Classification>` — `generateObject({ model: fastModel, reasoning: "low", schema: z.object({ costType: z.string(), confidence: z.number(), reason: z.string() }), prompt })`. Post-validation: a slug not among `types` → `{ costType: null, confidence: 0, reason }`; confidence clamped to [0, 1].
- `sha256Hex(bytes: Uint8Array | Buffer): string`
- `interface StoredScan { receipt: ExtractedReceipt; classification: Classification | null; amountInNok: number | null; exchangeRate: number | null }`
- `findScan(db, fileHash: string): Promise<StoredScan | null>` — `listRows("app","expense_receipt_scans",[Query.equal("file_hash", fileHash), Query.limit(1)])`, parse `result`; any error or bad JSON → `null`.
- `saveScan(db, fileHash: string, scan: StoredScan, model: string): Promise<void>` — `createRow` with `ID.unique()`; a unique-index conflict (409 / `row_already_exists`) is ignored; any other error is `console.error`ed and swallowed (never throws).
- The OCR route's currency conversion (`convertAmountToNok`, `getHistoricalRate`) moves into this file as `convertAmountToNok(receipt): Promise<{ amountInNok: number | null; exchangeRate: number | null }>` unchanged.

- [ ] **Step 1: Failing tests** (mock `ai`'s `generateObject`, `@repo/ai/models` as `{ balancedModel: "b", fastModel: "f" }`):
  - `buildClassificationPrompt lists every type and the examples` (asserts `meeting-food — Food during meetings` and the example line appear).
  - `classifyReceipt returns the model's slug and confidence` (mock → `{costType:"meeting-food",confidence:0.92,reason:"…"}`).
  - `drops an unknown slug to null with confidence 0` (mock → `costType:"pizza"`).
  - `clamps confidence into 0..1` (mock → 1.7 → 1).
  - `sha256Hex is stable` (`sha256Hex(Buffer.from("abc"))` → `"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"`).
  - `findScan returns null on bad JSON`; `saveScan swallows a conflict and any other error` (console.error spied and silenced).
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/receipt-scan.test.ts`.
- [ ] **Step 3: Implement**; the OCR route now imports `extractReceipt` and `convertAmountToNok` with identical responses (its existing tests pass unchanged).
- [ ] **Step 4: Run** `bun run test src/lib/receipt-scan.test.ts src/app/api/expenses/ocr` → PASS.
- [ ] **Step 5: Commit** — `feat(api): receipt scanning library with type classification and scan store`.

---

### Task 5: Examples — selection and normalisation

**Files:**
- Create: `apps/api/src/lib/expense-examples.ts`, `apps/api/src/lib/expense-examples.test.ts`

**Interfaces — produces:**
- `normalizeVendor(vendor: string | null | undefined): string` — lowercase, strip diacritics except `æøå`, remove punctuation, collapse whitespace, drop trailing legal suffixes (`as`, `asa`, `ab`, `ltd`, `inc`), trim, max 120 chars; empty input → `""`.
- `selectExamples(db, input: { vendor: string | null; types: CostTypeOption[] }): Promise<TypeExample[]>` — at most **10**. First up to **6** rows with `vendor_key` equal to the normalised vendor (skip when it is `""`), newest first, `approver`/`admin` sources before `student`. Then fill with the newest example of each type not yet represented (one query `Query.orderDesc("$createdAt"), Query.limit(100)`, first row per `final_cost_type` among the active types), until 10. Examples whose `final_cost_type` is not an active type are skipped. Any db error → `[]`.
- `interface BookedExampleInput { vendor: string | null; description: string; amount: number; aiCostType: string | null; aiConfidence: number | null; finalCostType: string | null; finalText: string | null; accountNumber: number; source: "student" | "approver" | "admin" }`
- `writeExamples(db, rows: BookedExampleInput[]): Promise<void>` — one `createRow("app","expense_type_examples", ID.unique(), …)` per row (`vendor_key` = `normalizeVendor(vendor)`, `description` truncated to 255); never throws.

- [ ] **Step 1: Failing tests** — `normalizeVendor("Peppes Pizza AS")` → `"peppes pizza"`, `normalizeVendor("REMA 1000, Majorstuen")` → `"rema 1000 majorstuen"`, `normalizeVendor(null)` → `""`; `selectExamples` puts approver vendor matches first, caps vendor matches at 6 and total at 10, skips inactive types, returns `[]` on db error; `writeExamples never throws`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-examples.test.ts`.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): anonymous booked examples for expense type classification`.

---

### Task 6: OCR route — classify, store the scan, flag duplicates

**Files:**
- Modify: `apps/api/src/app/api/expenses/ocr/route.ts`, `apps/api/src/app/api/expenses/ocr/route.test.ts`
- Create: `apps/api/src/lib/expense-duplicates.ts`, `apps/api/src/lib/expense-duplicates.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces (`expense-duplicates.ts`): `findPossibleDuplicate(db, input: { fileHash: string | null; date: string | null; amount: number | null; excludeExpenseId?: string | null }): Promise<{ expenseId: string; reimbursementNumber: string; match: "file" | "date_amount" } | null>` — 1) attachments with `file_hash` equal (when given); 2) else attachments with `date` on the same Oslo day (`Query.between` that day's UTC bounds) and `amount` within ±0.01 (when both given). For each candidate with an `expense_id` other than `excludeExpenseId`, `getRow("app","expense",id,[Query.select(["$id","status","$sequence"])])`; first whose status is not `draft`/`rejected` wins; `reimbursementNumber = String(10000 + $sequence).padStart(5,"0")`. Any error → `null`.
- Route behaviour after this task, for a **receipt** (purpose `receipt` or `auto` resolving to `documentType: "receipt"`):
  1. `extractReceipt` → `convertAmountToNok`.
  2. `fileHash = sha256Hex(buffer)`.
  3. With an admin client: `types = loadActiveCostTypes(db)`, `examples = selectExamples(db, { vendor, types })`, `classification = classifyReceipt(...)`; a classification error leaves `classification = null` (logged).
  4. `saveScan(db, fileHash, { receipt, classification, amountInNok, exchangeRate }, model ids)` — awaited, never throws.
  5. `duplicate = findPossibleDuplicate(db, { fileHash, date, amount: amountInNok ?? amount })`.
  6. Response `data` = every existing field **plus** `costType` (`string | null`), `costTypeConfidence` (`number`, 0 when none), `receiptIssues` (`ReceiptIssueCode[]`), `ocrAmount` (`amountInNok ?? amount`), `possibleDuplicate` (`boolean`). `category` stays.
  For a bank statement: no classification and no duplicate check; `costType: null`, `costTypeConfidence: 0`, `possibleDuplicate: false`; the scan is still stored.

- [ ] **Step 1: Failing tests** in `route.test.ts` (flags on; mock `@repo/api/server` admin client, `@/lib/receipt-scan` functions, `@/lib/expense-types`, `@/lib/expense-examples`, `@/lib/expense-duplicates`): `answers costType, confidence, receiptIssues, ocrAmount and possibleDuplicate`, `keeps the legacy category field`, `still answers when the scan cannot be stored` (saveScan resolves even though db rejects — assert 200), `answers costType null when classification throws`, `skips classification for a bank statement`. In `expense-duplicates.test.ts`: `matches the same file in a submitted expense`, `ignores drafts, rejected and the excluded expense`, `falls back to same day and amount`, `returns null on db error`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/app/api/expenses/ocr src/lib/expense-duplicates.test.ts`.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): OCR classifies the expense type, stores the scan and flags duplicates`.

---

### Task 7: Submission decisions (pure) and the AI account for the student's own text

**Files:**
- Create: `apps/api/src/lib/expense-submission.ts`, `apps/api/src/lib/expense-submission.test.ts`

**Interfaces — produces:**
- `interface AttachmentDecisionInput { attachmentId: string; amount: number; date: string | null; clientCostType: string | null; clientText: string | null; chosen: boolean; scan: StoredScan | null; isSupportingDoc: boolean }` — `chosen` is the payload's `cost_type_chosen`; `false` means a legacy app payload.
- `interface AttachmentDecision { attachmentId: string; costType: string | null; costTypeText: string | null; typeSource: "ai" | "student" | "legacy_app"; aiCostType: string | null; aiConfidence: number | null; accountNumber: number | null; taxCode: number | null; accountSource: "type" | "ai_freeform" | null; needsAiAccount: boolean; hints: ApproverHint[] }`
- `decideAttachment(input: AttachmentDecisionInput, types: CostTypeOption[], aiEnabled: boolean): AttachmentDecision` — pure:
  - Supporting doc (`amount <= 0` or `isSupportingDoc`): everything null, `typeSource: "student"`, no hints.
  - `ai = scan?.classification`; `aiConfident = ai?.costType && ai.confidence >= AI_TYPE_CONFIDENCE_THRESHOLD`.
  - `chosen === true`: student's `clientCostType` if it is a known slug → `typeSource = slug === ai?.costType ? "ai" : "student"`; else `clientText` (trimmed, non-empty) → `costType: null`, `costTypeText: text`, `needsAiAccount: aiEnabled`, `accountSource: "ai_freeform"` once chosen; else (nothing chosen) → AI's slug when confident, otherwise `other` with hint `type_defaulted`.
  - `chosen === false` (legacy app): if `aiConfident` and `ai.costType !== clientCostType` → AI's slug, `typeSource: "legacy_app"`, hint `app_type_replaced` `{ appType, aiType }`; else the client slug if known, else `other` + `type_defaulted`; `typeSource: "legacy_app"`.
  - A listed slug → `accountNumber`/`taxCode` from that type, `accountSource: "type"`.
  - Free text with `aiEnabled === false` → `accountNumber: null`, hint `account_missing`.
- `computeApproverHints(input: { decisions: AttachmentDecision[]; attachments: { attachmentId: string; amount: number; date: string | null; scan: StoredScan | null; duplicate: { reimbursementNumber: string } | null }[]; today: string }): ApproverHint[]` — pure; per attachment with an amount: `amount_differs` when `|amount − (scan.amountInNok ?? scan.receipt.amount)| > 1` (`data: { entered, read }`); `old_receipt` when the date is more than 90 days before `today` (`data: { days }`); `possible_duplicate` (`data: { reimbursementNumber }`); one `receipt_issue` per issue code (`data: { issue }`); plus each decision's own hints.
- `chooseAccountForText(input: { text: string; receipt: ExtractedReceipt | null; types: CostTypeOption[]; accounts: CostAccountOption[] }): Promise<{ accountNumber: number; confidence: number; reason: string } | null>` — `generateObject({ model: fastModel, reasoning: "low", … })` with a prompt listing the types (label → account) and every account (`number name`), the student's text and the receipt's vendor/description; post-validation: the number must be in `accounts`, else `null`; any error → `null`.

- [ ] **Step 1: Failing tests** — `uses the student's slug and marks it ai when it matches the AI`, `keeps the student's own text and asks for an AI account`, `treats a legacy app payload's type as a suggestion` (client `social`, AI `meeting-food` 0.9 → `meeting-food`, `legacy_app`, hint `app_type_replaced`), `keeps the legacy slug when the AI is unsure` (0.5), `defaults to other with a hint when nothing was chosen and the AI is unsure`, `snapshots account and tax code from the type`, `skips supporting documents`, `computeApproverHints flags amount differs, old receipt, duplicate and receipt issues` (today `2026-11-11`, date `2026-07-01` → `old_receipt` days 133), `chooseAccountForText rejects an account not in the list`, `chooseAccountForText returns null when the model fails`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-submission.test.ts`.
- [ ] **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): submission type, account and hint decisions`.

---

### Task 8: Payload, draft and submit wiring

**Files:**
- Modify: `apps/api/src/lib/expense-payload.ts` (+ test), `apps/api/src/app/api/expenses/draft/route.ts` (+ `route.test.ts`), `apps/api/src/app/api/expenses/submit/route.ts` (+ `route.test.ts`)

**Interfaces:**
- Consumes: Tasks 3–7, `recordExpenseEvents` (Stage 1).
- `ExpenseAttachmentInputSchema` gains optional `cost_type_text` (string, trimmed, max 120) and `cost_type_chosen` (boolean). `cost_type` keeps its transform to `other` **only when `cost_type_chosen` is absent** (legacy); when `cost_type_chosen` is present an empty `cost_type` stays `""`. Unknown keys (e.g. `ai_cost_type`) are stripped as today.
- `ExpensePayloadSchema` gains optional `occasion` (string, max 1000) and `event_id` (string, max 64); `buildExpenseRowInput` writes `occasion` and `event_id` (null when absent) and each attachment's `cost_type_text` (null when absent). `cost_type_chosen` is not stored.
- Draft route: when updating a draft, for each incoming attachment **without** `cost_type_chosen` whose `url` matches an existing attachment of that draft, keep the existing row's `cost_type` and `cost_type_text` (so a web draft re-saved from an old app keeps the student's choice). Implement as a pure `mergeLegacyAttachmentTypes(incoming, existing)` in `expense-payload.ts`.
- Submit route, after the draft save and before `submitForApproval`/`submitByEmail` — new `enrichSubmission(admin, expense, payload, profileName)` in `apps/api/src/lib/expense-submission.ts` that:
  1. `aiEnabled = flags.expenses_module && flags.expenses_ocr`; `types = loadActiveCostTypes`; `allTypes = loadAllCostTypes`; `accounts = loadCostAccounts` (only when some attachment has free text).
  2. Per attachment with a `url`: download bytes (`storage.getFileDownload("expenses", fileId)` via `receiptFileId`), `fileHash = sha256Hex`, `scan = findScan(db, fileHash)`; if none and `aiEnabled` and the attachment has an amount → `extractReceipt` + `convertAmountToNok` + `classifyReceipt` (with `selectExamples`) + `saveScan`. Download or AI failures leave `scan = null` (logged).
  3. `decideAttachment(...)` per attachment; for `needsAiAccount` → `chooseAccountForText`; `null` → hint `account_missing`; confidence < 0.8 → hint `ai_account_unsure`.
  4. `duplicate = findPossibleDuplicate(db, { fileHash, date, amount, excludeExpenseId: expense.$id })`.
  5. Occasion: if any decided slug's type has `askOccasion` and `payload.occasion` is blank → for a non-legacy payload throw `OccasionRequiredError` (exported from `expense-submission.ts`; the route maps it to `SubmitRejection(400, "Occasion is required", { field: "occasion" })`); for a legacy payload add hint `occasion_missing`.
  6. Write each attachment: `updateRow("app","expense_attachments", id, { expense_id, file_hash, cost_type, cost_type_text, type_source, ai_cost_type, ai_confidence, account_number, tax_code, account_source, ocr_amount, receipt_issues: JSON.stringify(codes) })`.
  7. Write the expense: `approver_hints: JSON.stringify(computeApproverHints(...))`, `occasion`.
  8. `recordExpenseEvents`: `submitted` (actorKind `student`, `actor_name` = profile name), one `ai_classified` per AI-typed receipt (`after` = slug, `note` = confidence + reason), one `ai_account_chosen` per free-text account (`attachment_id`, `before` = text, `after` = account number, `note` = reason).
  Step 5's rejection happens before any write in steps 6–8 (the draft is already saved, as today).
- The submit route re-reads the expense (`SUBMITTED_EXPENSE_COLUMNS`) after enrichment so the approval/email flow sees the stored values.

- [ ] **Step 1: Failing tests** — payload: `keeps an empty cost_type when cost_type_chosen is sent`, `defaults cost_type to other for a legacy payload`, `ignores AI fields sent by the client`, `mergeLegacyAttachmentTypes keeps the stored choice for a legacy re-save`. Submit route (mock `@/lib/expense-submission`'s `enrichSubmission` at the route level, and test `enrichSubmission` itself in `expense-submission.test.ts` with a mocked admin client): `enrichSubmission reuses a stored scan by file hash`, `scans a file with no stored scan when AI is on`, `writes no AI fields when AI is off`, `rejects a missing occasion for a type that asks for one`, `accepts a legacy app submission without occasion`, `writes approver hints and history events`; route: `calls enrichSubmission before the approval chain`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-payload.test.ts src/lib/expense-submission.test.ts src/app/api/expenses/submit src/app/api/expenses/draft`.
- [ ] **Step 3: Implement.** **Step 4: Run** the whole apps/api suite → PASS; `bun run check-types --filter=api` → clean.
- [ ] **Step 5: Commit** — `feat(api): resolve types, accounts and hints at submission`.

---

### Task 9: Summary request carries types, occasion and event; booking writes examples

**Files:**
- Modify: `apps/api/src/lib/expense-summary.ts` (+ test), `apps/api/src/lib/expense-posting.ts`, `apps/api/src/lib/expense-posting-dates.test.ts`

**Interfaces:**
- `SummaryReceiptSchema` gains optional `costType: z.string().nullable()` (the type's display name or the student's own text). `StructuredSummaryRequestSchema` gains optional `occasion` and `eventName` (strings, nullable). `formatReceipt` adds `type=<costType>`; the prompt adds `- Occasion: …` and `- Event: …` lines when present, and the rule "Use each receipt's type as the main hint about its purpose."
- Booking: after `recordBooking` succeeds (inside the same best-effort block), build `BookedExampleInput` per posted attachment: `vendor`/`description` from `findScan(db, att.file_hash)` (`receipt.vendor`, `receipt.description ?? att.description`), `amount`, `aiCostType`/`aiConfidence` from the attachment, `finalCostType = att.cost_type || null`, `finalText = att.cost_type_text`, `accountNumber` = the posted line's account, `source = att.account_source === "approver" ? "approver" : att.account_source === "admin" ? "admin" : "student"`; then `writeExamples`. Attachments without `file_hash` are skipped.

- [ ] **Step 1: Failing tests** — summary: `includes each receipt's type and the occasion in the prompt`, legacy body still parses. Posting: `writes one example per posted receipt`, `keeps success when example writes fail`.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement.** **Step 4: Run** `cd apps/api && bun run test` → PASS.
- [ ] **Step 5: Commit** — `feat(api): types in the AI description and examples from booked receipts`.

---

### Task 10: Admin — Expenses → Settings → Types

**Files:**
- Create: `apps/admin/src/app/(portal)/expenses/settings/page.tsx`, `apps/admin/src/app/(portal)/expenses/settings/actions.ts`, `apps/admin/src/app/(portal)/expenses/settings/types-model.ts`, `apps/admin/src/app/(portal)/expenses/settings/types-model.test.ts`, `apps/admin/src/app/(portal)/expenses/settings/actions.test.ts`, `apps/admin/src/app/(portal)/expenses/settings/_components/expense-types-client.tsx`
- Modify: `apps/admin/src/lib/roles.ts` (`NAV_ACCESS`), `apps/admin/src/lib/nav-tree.ts` (+ `nav-tree.test.ts`), `packages/i18n/messages/en/adminPortal.json`, `packages/i18n/messages/no/adminPortal.json`
- Delete: `apps/admin/src/app/api/expenses/cost-types/seed/route.ts` (replaced by the seed action)

**Interfaces:**
- `NAV_ACCESS["portal.expensesSettings"] = [ROLES.GLOBAL_ADMIN]`. Nav: a group `{ id: "expenses", labelKey: "expenses", icon: Receipt, kind: "group", children: [leaf("expensesSettings", "portal.expensesSettings", "/expenses/settings", Settings2)] }` placed after the shop/accounting entries. (Stage 4 adds the list leaf to the same group.)
- `types-model.ts`: `expenseTypeInputSchema` (zod): `label` (trim, 1–120), `labelNo` (trim, ≤120, optional → null), `description` (trim, ≤500, optional → null), `accountNumber` (int, 4000–7999), `taxCode` (int ≥ 0, optional → null), `askOccasion` (boolean), `active` (boolean), `sortOrder` (int ≥ 0). `slugFromLabel(label: string, taken: Set<string>): string` (lowercase, æ→ae, ø→o, å→a, non-alphanumerics → `-`, trimmed, max 40, suffix `-2`, `-3`… when taken). `ExpenseTypeView` = row fields camel-cased + `accountName: string | null` (from `ledger_accounts`).
- `actions.ts` (`"use server"`, global admin only via `requireExpensesAdmin()` modelled on `requireAccountingAccess`): `getExpenseTypesView(): Promise<{ types: ExpenseTypeView[]; accounts: { accountNumber: number; name: string; taxCode: number }[]; tableEmpty: boolean }>`; `saveExpenseType(id: string | null, input): Promise<ActionResult<ExpenseTypeView>>` — new rows get `$id`/`slug` from `slugFromLabel`; existing rows never change `slug`; `account_number` must exist among active `ledger_accounts` (else `{ error }`); `tax_code` defaults to the account's `tax_code ?? 0`; audit `expense_type.create|update`. `seedStartingExpenseTypes(): Promise<ActionResult<{ created: number; skipped: number }>>` — upserts each `STARTING_EXPENSE_COST_TYPES` entry **only when no row with that slug exists** (never overwrites edits); audit `expense_type.seed`. `syncExpenseAccounts()` — calls `syncLedgerAccounts(db)` like the shop accounting action, audit `ledger_accounts.sync`.
- Page: `requireNavAccess("portal.expensesSettings")`, `PageHeader`, a tab strip with one tab **Typer** (Types) (Stage 4 adds more), `ExpenseTypesClient` with labels passed from `getTranslations("adminPortal.expensesSettings")`. Client: table of types (name, Norwegian name, account `number name`, asks occasion, active), inline edit per row like `accounting-client.tsx`, a searchable account picker built from `@repo/ui` `Popover` + `Command` (search by number or name), buttons **Legg til type** (Add type), **Last inn startlisten** (Load starting list — shown only when `tableEmpty`), **Synkroniser kontoer fra Finago** (Sync accounts from Finago). Toasts on success/error.

- [ ] **Step 1: Failing tests** (`bun:test`): `types-model.test.ts` — schema rejects account 3000 and an empty label; `slugFromLabel("Møtemat", new Set())` → `"motemat"`, and `slugFromLabel("Travel", new Set(["travel"]))` → `"travel-2"`. `actions.test.ts` (mock module pattern from `shop/accounting/actions.test.ts`): `saveExpenseType creates a row with a generated slug`, `refuses an account that is not an active ledger account`, `never changes the slug on update`, `seedStartingExpenseTypes skips existing slugs`, `rejects a campus admin`. `nav-tree.test.ts`: the expenses group shows for a global admin only.
- [ ] **Step 2: Run, see fail** — `cd apps/admin && bun test ./src/app/\(portal\)/expenses ./src/lib/nav-tree.test.ts`.
- [ ] **Step 3: Implement**, including en/no strings: nav `expenses` "Expenses"/"Utlegg", `expensesSettings` "Settings"/"Innstillinger"; page namespace `expensesSettings` with title "Expense settings"/"Innstillinger for utlegg", description, tab, column headers, buttons, toasts. Delete the seed route.
- [ ] **Step 4: Run** the tests → PASS; `bun run check-types --filter=admin` → clean.
- [ ] **Step 5: Commit** — `feat(admin): expense types settings page`.

---

### Task 11: Docs

**Files:**
- Modify: `apps/docs/content/docs/developers/reference/accounting.mdx` (Reimbursements; `covers` += `apps/api/src/lib/receipt-scan.ts`, `apps/api/src/lib/expense-submission.ts`, `apps/api/src/lib/expense-examples.ts`, `apps/api/src/lib/expense-types.ts`, `apps/api/src/lib/expense-duplicates.ts`, `packages/shared/utils/expense-cost-types.ts`, `packages/shared/utils/expense-hints.ts`)
- Create: `apps/docs/content/docs/guide/access-and-settings/expense-types.mdx` (+ add to that folder's `meta.json`)

- [ ] **Step 1: Developer docs** — a "Types and AI" subsection: types live in `expense_cost_types` (fallback starting list), scans keyed by SHA-256 in `expense_receipt_scans`, the two AI calls and the 0.8 threshold, what submission decides (account snapshot, AI account for own text, legacy app handling, hints), examples written at booking without who submitted, and the `expenses_ocr` flag. Every claim checked against the code.
- [ ] **Step 2: Guide task page** "Manage expense types" (`who: Global admins`, `covers: apps/admin/src/app/**/expenses/settings/**`), six-part shape: before you start (sync accounts first), steps (load the starting list once, add/edit a type, pick the account, Norwegian name, ask occasion, deactivate), what happens next (students see names only; the AI picks from active types; a changed account applies to new submissions), what the student sees, common mistakes (deactivate instead of renaming a type to mean something else).
- [ ] **Step 3: Check** — `cd apps/docs && bun test` → PASS (coverage/structure tests).
- [ ] **Step 4: Commit** — `docs: expense types and AI on submission`.

## Rulings made in this plan

- **R1** — `academic` → 7305 *Faglig arrangement* and `other` → 6555 *Andre driftskostnader* (spec's "Two mismatches", owner to confirm in review).
- **R2** — Classification is a second, text-only call on the fast model after extraction, because the examples need the vendor the first call extracts.
- **R3** — Duplicates are matched by file hash or by same day + amount within ±0.01 in submitted, non-rejected expenses; vendor isn't stored on attachments, so it isn't part of the soft match.
- **R4** — `expense_attachments.expense_id` is denormalised at submission because the attachment relationship is one-way and duplicates must name the other reimbursement.
- **R5** — A legacy app payload is recognised by the absence of `cost_type_chosen` on its attachments; it is never refused for a missing occasion.
- **R6** — The seed action never overwrites existing rows (the old seed route did); the old route is deleted.
