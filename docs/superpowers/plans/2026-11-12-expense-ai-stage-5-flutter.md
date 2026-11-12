# Expense Types, AI State and Approval Switches in the App — Stage 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Flutter app's reimbursement flow up to the new server:
- expense types are loaded from the table and shown as the app's language says;
- a searchable type picker in a bottom sheet, reachable from the receipt list, with "use what I typed";
- the AI's pick, with three states;
- the controller switch beside an updated financial-manager switch;
- the occasion question;
- receipt and duplicate notices;
- payloads that send `cost_type_chosen` and `cost_type_text`.

The owner wants it to feel designed for the app, not ported from the web.

**Architecture:**
- **Pure Dart logic** in `lib/core/utils/` and `lib/data/models/`, tested with flutter_test:
  - the type state rules;
  - the approval switch rule;
  - the payload mapping.
- **Cost types** are a Riverpod `FutureProvider` over `TablesDB.listRows` on `expense_cost_types`, which everyone can read.
- **New widgets** live in their own files under `lib/presentation/screens/expense/widgets/`. The 2 468-line `create_expense_screen.dart` only wires them in.

**Tech Stack:** Flutter 3.47.9, Riverpod, Appwrite `TablesDB`, `flutter gen-l10n` (ARB `lib/generated/l10n/app_en.arb` / `app_no.arb`), flutter_test.

**Spec:** BISO-Sites `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md`, section "Stage 5 — The Flutter app". It also follows the Stage 3 "Rules" table and the Stage 2 web behaviour (BISO-Sites `apps/web/src/components/expense-v3/receipt-types.ts`) that this mirrors.

## Global Constraints

- **Where to work:**
  - Work in a new worktree of the Flutter repo: `/Users/markus/Documents/dev/BISO-Flutter/.claude/worktrees/expense-ai`, on a new branch `feat/expense-ai` from `origin/main` (b40ae8f).
  - The main Flutter checkout is on `fix/release-asc-key` and is used by other sessions. Never switch its branch.
  - Never push. Never run the release pipeline or bump the store version.
- **Server contract** (BISO-Sites `apps/api`):
  - **OCR response** (`POST /api/expenses/ocr`): `data` includes the receipt fields plus `receiptIssues: string[]`, `costType: string | null`, `costTypeConfidence: number` (0–1), `ocrAmount: number | null` and `possibleDuplicate: boolean`.
  - **Attachments in the draft/submit payload:**
    - `cost_type`: a slug, or `""` when there is no choice yet or the student wrote their own text.
    - `cost_type_text`: string or null.
    - `cost_type_chosen`: always `true` from this app version on.
  - **Expense payload:** adds `submitter_is_controller: bool` and `occasion: string | null`. `submitter_is_financial_manager` stays.
  - **Missing occasion:** submit returns HTTP 400 with JSON `{ error: "Occasion is required", field: "occasion", expenseId }`.
  - **Budget:** the server already keeps a submit inside 20 s, the app's JSON timeout. Keep that timeout.
- **AI threshold:** **0.8**. A pick with confidence ≥ 0.8, whose slug is among the active types, counts as "AI picked". Anything else needs a choice.
- **Which receipts need a type:**
  - A receipt needs a type when `amount > 0`, it isn't a bank statement, and it has no `parentReceiptId`. Supporting statements never need one.
  - A hydrated draft attachment whose slug is unknown or inactive becomes "needs a choice". This matches the web.
- **Approval switches** (campus id → department id):

  | Campus | Department | Switch |
  |---|---|---|
  | `1` (Oslo) | not `1` or `2` | financial-manager switch |
  | any | `1`, `2`, `300`, `301`, `600`, `601`, `800`, `801` | controller switch, but only on its own campus (`1`/`2` → Oslo, `300`/`301` → `2`, `600`/`601` → `3`, `800`/`801` → `4`) |
  | anything else | | no switch |

  - The two switches are never shown together.
  - Both reset when the department changes.
  - A switch that isn't shown is sent as `false`.
- **Copy:**
  - Every new string goes in both `app_en.arb` and `app_no.arb`, with `@key` descriptions. Regenerate with `flutter gen-l10n` and commit the generated files the way the repo does.
  - Use plain words with no self-praise. The slogan "Dare to be more." stays English.
  - Students never see account numbers.
- **Design:**
  - Use the BISO design system: `BisoPalette.of(context)`, `bisoInputDecoration`, `BisoListRow`, `SliverBisoListGroup`, and `showBisoSheet` (never a raw `showModalBottomSheet`).
  - `test/presentation/design_rules_test.dart` and `create_expense_design_test.dart` must stay green.
- **Before each commit:**
  - `dart format` the changed files.
  - `flutter analyze` must be clean for the changed files.
  - Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Tests:**
  - `flutter test <path>`, then the whole `flutter test` once before each commit.
  - Mock services and providers. No network.

## Review Focus

- **The AI pick is not confident enough** (0.79 or an inactive slug). The receipt shows "Choose a type" and blocks submit until the student picks. Task 2 test: `a 0.79 pick needs a choice`.
- **A student types their own text that exactly matches a type's name** (in either language, any case). Enter picks the type, not own text. Task 3 test: `enter on an exact name picks the type`.
- **The student switches department from Ledelsen Oslo (controller switch on) to an OSL department.** The controller flag is cleared and never sent as `true`. Task 4 test: `changing department clears both switches`.
- **A draft saved by the web with own text, reopened in the app,** keeps that text and still counts as chosen. Task 2 test: `own text from a draft stays chosen`.
- **Submit is turned away for a missing occasion.** The app shows the occasion field with a message, keeps the draft id, and doesn't create a second draft on retry. Task 5 test: `occasion 400 focuses the field and keeps the draft id`.

---

### Task 1: Worktree, cost types from the table, OCR and API fields

**Files:**
- `lib/core/constants/app_constants.dart`: add `expenseCostTypesTableId = 'expense_cost_types'`.
- `lib/data/models/expense_cost_type_option.dart` (new, + test).
- `lib/data/services/expense_cost_type_service.dart` (new, + test).
- `lib/providers/expense/expense_provider.dart`: add `expenseCostTypesProvider`.
- `lib/data/models/expense_v2_models.dart`: OCR fields.
- `lib/data/services/expense_api_client.dart`: `ExpenseApiException` gains `code` and `field`.

**Interfaces:**
- `class ExpenseCostTypeOption { final String slug; final String label; final String? labelNo; final bool askOccasion; final int sortOrder; String labelFor(Locale locale); factory ExpenseCostTypeOption.fromRow(Map<String, dynamic> data); }`. `labelFor` returns `labelNo` when the language code is `no` or `nb` and `labelNo` is non-empty; otherwise `label`.
- `ExpenseCostTypeService.listActive()`: `listRows(databaseId: 'app', tableId: 'expense_cost_types', queries: [Query.equal('active', true), Query.orderAsc('sort_order'), Query.limit(100)])`, mapped to options.
- `final expenseCostTypesProvider = FutureProvider<List<ExpenseCostTypeOption>>(...)`
- `ExpenseOcrResult` gains `costType` (String?), `costTypeConfidence` (double, default 0), `receiptIssues` (List<String>, default empty), `ocrAmount` (double?) and `possibleDuplicate` (bool, default false). It reads these from `data` the way the other fields are read.
- `ExpenseApiException` gains `final String? code; final String? field;`, read from the error JSON (`code`, `field`). `toString` is unchanged.

Steps:
- [ ] **Step 0: Set up the worktree (controller does this before dispatch):** `git -C /Users/markus/Documents/dev/BISO-Flutter worktree add -b feat/expense-ai .claude/worktrees/expense-ai origin/main`. Then run `flutter pub get` and `flutter test` in it, and record the baseline in the ledger.
- [ ] **Step 1: Write failing tests:**
  - `labelFor picks the Norwegian label in Norwegian`
  - `falls back to the English label when label_no is empty`
  - `fromRow reads ask_occasion and sort_order`
  - `listActive asks for active types in sort order` (fake TablesDB)
  - OCR `fromMap` reads `costType`, `costTypeConfidence`, `receiptIssues`, `ocrAmount` and `possibleDuplicate`, with defaults when they're absent
  - `ExpenseApiException carries code and field from a 400 body`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `flutter analyze` and the whole `flutter test`.
- [ ] **Step 5: Commit:** `feat(expense): load expense types from the table and read the AI's pick from OCR`.

---

### Task 2: The type state on a receipt, and the payload

**Files:**
- `lib/core/utils/expense_type_state.dart` (new, + test)
- `lib/data/models/expense_v2_models.dart` (+ test)
- `lib/core/utils/expense_cost_types.dart`: delete it, its test, and every use of `defaultCostTypeSlugForCategory` / `effectiveCostType`.
- the draft hydration in `create_expense_screen.dart` (~L258)

**Interfaces:**
- `enum ExpenseTypeState { aiPicked, needsChoice, chosen }`
- `bool needsType(ExpenseReceiptDraft r)`: true when `(r.amount ?? 0) > 0 && !r.isBankStatement && r.parentReceiptId == null`.
- `ExpenseReceiptDraft` gains `costTypeText` (String?), `typeState` (ExpenseTypeState, default `needsChoice`), `aiConfidence` (double?), `receiptIssues` (List<String>), `possibleDuplicate` (bool) and `ocrAmount` (double?).
  - Add a `clearCostType` flag, or a dedicated `withType({String? slug, String? text, ExpenseTypeState state})`, because `copyWith` can't reset a field to null.
- `ExpenseReceiptDraft withAiPick(ExpenseOcrResult ocr, List<ExpenseCostTypeOption> types)`: with `costTypeConfidence >= 0.8` and the slug among `types`, the state is `aiPicked` with `costType = slug`. Otherwise the state is `needsChoice` and `costType` is null. It also copies `receiptIssues`, `possibleDuplicate` and `ocrAmount`.
- `ExpenseReceiptDraft chooseType(String slug)` → `chosen`, text cleared. `ExpenseReceiptDraft useOwnText(String text)` → `chosen`, `costType` null, text trimmed (max 120). An empty text after trimming is refused, and the receipt is unchanged.
- `ExpenseReceiptDraft hydrateType({String? slug, String? text, required List<ExpenseCostTypeOption> types})`:
  - non-empty text → `chosen` with that text;
  - a slug among the active types → `chosen`;
  - otherwise → `needsChoice`.
- `bool isTypeMissing(ExpenseReceiptDraft r)` = `needsType(r) && r.typeState == ExpenseTypeState.needsChoice`.
- `Map<String, dynamic> attachmentTypeFields(ExpenseReceiptDraft r)` → `{ 'cost_type': text != null ? '' : (r.costType ?? ''), 'cost_type_text': text, 'cost_type_chosen': true }`, where `text` is the trimmed own text, or null. `toAttachmentMap` uses it, so `cost_type` never falls back to a category default again.
- `bool occasionRequired(List<ExpenseReceiptDraft> receipts, List<ExpenseCostTypeOption> types)`: true when some receipt that needs a type has a chosen or AI-picked slug whose option has `askOccasion`.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `withAiPick` cases:
    - `0.8 picks`
    - `a 0.79 pick needs a choice`
    - `an inactive slug needs a choice`
    - `issues and duplicate are copied`
  - `chooseType` and `useOwnText`, including refusing blank text and the 120-character cap.
  - `hydrateType`:
    - `own text from a draft stays chosen`
    - unknown slug → `needsChoice`
  - `needsType` for a bank statement, a child receipt and a zero amount.
  - `attachmentTypeFields`:
    - slug
    - own text
    - needs a choice (`cost_type ""`)
    - `cost_type_chosen` always true
  - `occasionRequired` cases.
  - The existing API-client test that asserts `body['expenseAttachments'][0]['cost_type']` is updated to the new fields.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement, and delete the old helper.**
- [ ] **Step 4: Run** → PASS, then the whole `flutter test` and `flutter analyze`.
- [ ] **Step 5: Commit:** `feat(expense): receipts carry the AI's pick, the student's choice or their own words`.

---

### Task 3: The type picker sheet and the type on each receipt row

**Files:**
- `lib/presentation/screens/expense/widgets/expense_type_picker_sheet.dart` (new, + widget test)
- `lib/presentation/screens/expense/widgets/receipt_type_chip.dart` (new, + widget test)
- `lib/core/utils/expense_type_search.dart` (new, pure, + test)
- `create_expense_screen.dart`: wire the chip into `_ReceiptRow` and `_ReportReceiptRow`, and replace the dropdown in `_ReceiptDetailEditor` with the same chip/sheet.
- ARB strings.

**Interfaces:**
- `String foldForSearch(String s)`: lowercase; `æ`→`ae`, `ø`→`o`, `å`→`a`; strip other diacritics; collapse whitespace.
- `List<ExpenseCostTypeOption> searchTypes(List<ExpenseCostTypeOption> types, String query, Locale locale)`:
  - an empty query returns all types in `sortOrder`;
  - otherwise it keeps the types whose folded shown label, or folded other-language label, contains the folded query;
  - prefix matches come first.
- `ExpenseCostTypeOption? exactTypeMatch(types, query)` matches a folded full label in either language.
- `Future<ExpenseTypeChoice?> showExpenseTypePicker(BuildContext context, { required List<ExpenseCostTypeOption> types, String? currentSlug, String? currentText })`, using `showBisoSheet` with a `DraggableScrollableSheet` like `_showCampusPicker`.
  - `sealed class ExpenseTypeChoice` with `PickedType(slug)` and `OwnText(text)`.
- **Sheet:**
  - A title and a search field (`bisoInputDecoration`, autofocus, max 120 characters).
  - The filtered list, with the current choice checked.
  - When the query is non-empty and has no exact match, a visually distinct last row: an icon, the text "Use "<typed text>"", and a short hint that finance will place it.
  - Keyboard "done"/Enter: an exact match picks the type, otherwise it uses own text.
  - Empty states for no types and for a load error, with a retry.
- **`ReceiptTypeChip(receipt, types, onChanged)`:**
  - **AI picked:** the label with a small sparkle icon and the tooltip "Picked by AI — tap to change".
  - **Chosen:** the label, or own text in quotes.
  - **Needs a choice:** "Choose a type" in the attention colour from `BisoPalette`.
  - Tapping opens the sheet. Shown only when `needsType`.
  - Must reach a 48 dp tap target and have a semantics label.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `foldForSearch` on æøå;
  - `searchTypes` prefix-first ordering and matching on the other language;
  - `exactTypeMatch`;
  - widget tests:
    - `enter on an exact name picks the type`
    - `enter on other text uses own text`
    - `the own-text row appears only without an exact match`
    - `the chip shows needs-a-choice in the attention colour`
    - `tapping the chip opens the sheet and applies the choice`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement and wire it in.**
- [ ] **Step 4: Run** → PASS, then the design tests, `flutter analyze` and the whole suite.
- [ ] **Step 5: Commit:** `feat(expense): a searchable type picker on every receipt, with "use what I typed"`.

---

### Task 4: The controller switch and the updated financial-manager switch

**Files:**
- `lib/core/utils/expense_approval_switch.dart` (new, + test)
- `lib/presentation/screens/expense/widgets/approval_switch_card.dart` (new, + widget test)
- `create_expense_screen.dart`: replace `_showsFinancialManagerToggle` and the `CheckboxListTile`.
- `ExpensePayloadBuilder.buildBasePayload`: add `submitterIsController`.
- `ExpenseModel` reads `submitter_is_controller` for drafts.
- ARB strings.

**Interfaces:**
- `enum ApprovalSwitch { financialManager, controller }`
- `ApprovalSwitch? approvalSwitchFor(String campusId, String? departmentId)`, per the Global Constraints table. A port of BISO-Sites `packages/shared/utils/expense-approvers.ts` `approvalSwitchFor`; read it and copy its leadership map.
- `ApprovalSwitchCard({ required ApprovalSwitch kind, required bool value, required ValueChanged<bool> onChanged })`.
  - A labelled card with a switch, not a bare checkbox.
  - Financial manager: "I'm this department's financial manager". Hint: "Your department manager approves instead".
  - Controller: "I'm the campus controller". Hint: "The campus president approves instead".
  - Write the Norwegian wording in the same style as the web (`no` in BISO-Sites `packages/i18n/messages/no/expenses.json`: "Jeg er campusets controller" and the matching hint).
- **Screen:**
  - Shows at most one card, from `approvalSwitchFor`.
  - Changing campus or department resets both flags.
  - Saving a draft and submitting send `submitter_is_financial_manager: kind == financialManager && value` and `submitter_is_controller: kind == controller && value`.
  - A draft hydrates both flags, then drops any that no longer apply.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `approvalSwitchFor`: Oslo OSL dept → FM; Oslo 1 → controller; Oslo 2 → controller; Bergen 301 → controller; Bergen 302 → none; Trondheim 600 → controller; campus 2 with dept 600 → none; national → none.
  - The payload sends both flags.
  - Widget tests:
    - `changing department clears both switches`
    - `only one card is shown`
    - `a hydrated controller flag on an OSL department is dropped`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS, then `flutter analyze` and the whole suite.
- [ ] **Step 5: Commit:** `feat(expense): controller switch on leadership departments; the financial-manager switch follows the new rules`.

---

### Task 5: Occasion, notices, submit gating, and docs

**Files:**
- `lib/presentation/screens/expense/widgets/occasion_field.dart` (new)
- `lib/presentation/screens/expense/widgets/receipt_notices.dart` (new, + widget tests)
- `create_expense_screen.dart`: occasion state, submit gating, error handling and notices placement.
- `ExpensePayloadBuilder`: `occasion`.
- `EXPENSE_V2.md`
- the `CLAUDE.md` "Expense Reimbursement System" section
- ARB strings.

**Rules:**
- **Occasion field:**
  - Shown in the report when `occasionRequired`. It stays shown once shown in the session.
  - Label: "What was the occasion, and who attended?". Max 500 characters, multi-line.
  - Sent as `occasion` (null when blank). Hydrated from the draft.
- **Submit gating:**
  - If any receipt `isTypeMissing`, submit is blocked. Select the first such receipt (on narrow screens, switch to the Receipts tab), open its type sheet, and show a message: "Choose a type for N receipts".
  - If the occasion is required and blank, focus the field and show its message.
  - Saving a draft is never blocked.
- **Server 400 with `field == "occasion"`:**
  - Show the occasion field and focus it, with the server's message mapped to the localised one.
  - Keep `expenseId` from the error body as `_draftExpenseId`, so the next submit updates the same draft.
- **Notices** on the receipt detail and in compact form on the report row:
  - receipt issues, each code mapped to a localised sentence; mirror BISO-Sites `apps/web` issue wording in `packages/i18n/messages/{en,no}/expenses.json`, with a generic fallback for unknown codes;
  - "This looks like a receipt you've already sent" when `possibleDuplicate`;
  - "The receipt says X kr; you entered Y kr" when `ocrAmount` differs from the entered amount by more than 1 kr.
  - Notices never block submit.
- **Docs:** update `EXPENSE_V2.md` and the CLAUDE.md expense section. Cover where types come from, the three states, the picker, the switches, the occasion and the notices, with **Location** and **Spec** lines in the style of the other feature sections.

Steps:
- [ ] **Step 1: Write failing tests** (widget tests with a fake API client and providers):
  - `submit is blocked and the first missing receipt is opened`
  - `occasion shows when a chosen type asks for it`
  - `occasion 400 focuses the field and keeps the draft id`
  - `notices render issues, duplicate and amount difference`
  - `blank occasion is sent as null`
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS, then the whole suite, the design tests and `flutter analyze` on the repo.
- [ ] **Step 5: Commit:** `feat(expense): occasion question, receipt notices and submit checks; docs`.

---

## Rulings made in this plan

- Ruling: the app always sends `cost_type_chosen: true`, mirroring the web: present means "only a chosen or accepted type is sent". A receipt that still needs a choice is sent with `cost_type ""` and blocks submit; drafts save it. Cost if wrong: none; the server decides any empty type at submission.
- Ruling: event match stays web-only (the spec says so). The app sends no `event_id`; the server keeps a stored one on drafts. Cost if wrong: app users don't get the event suggestion.
- Ruling: no version bump and no release in this stage. The owner releases through the pipeline after the server stages are live. Cost if wrong: none.
- Ruling: no description rewrite on type change in the app; the web does that. The app's existing summary call is unchanged. Cost if wrong: app descriptions don't mention the chosen types; the student can edit the description.
