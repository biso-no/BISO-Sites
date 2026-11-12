# Expenses: types, AI booking, approvals in admin — design

## Why

Students submit reimbursements on the website (`/fs`). Finance then has to book
each receipt to the right ledger account in 24SevenOffice (Finago), on the
right date, after the right people approve it. Today three things get in the
way:

- **Accounts are a guess.** A receipt gets one of four hardcoded "cost types"
  (Travel 7140, Social event 7310, Academic event 7315, Other 7790). The AI
  never picks one directly. It guesses a coarse category (meal, travel, …) that
  a fixed table maps to a type, it can't say when it's unsure, and the type is
  only editable inside each receipt's detail pane.
- **Bookings land in the wrong period.** Every transaction is dated the day it
  is posted (`expense-posting.ts`: `date: new Date()…`). A receipt from 10
  October submitted on 11 November is booked in November.
- **Approvers can't fix anything.** The Teams card can approve or reject. When
  a financial manager spots a wrong account, there is nowhere to change it, and
  the next approver can't see what happened.

The owner wants an AI that picks the type (and so the account), learns from
every correction, and an admin area where finance and approvers can see, fix
and approve expenses, with the whole history on the approval.

Decisions marked *(my call)* are mine; everything else the owner decided in the
conversation on 2026-11-11.

## What already exists (don't rebuild it)

- **Booking goes through REST.** `postApprovedExpense` (`apps/api/src/lib/expense-posting.ts`)
  merges the cover PDF and receipts, uploads them with REST `POST /fileUpload`
  (`packages/connectors/src/24sevenoffice/rest/files.ts`) and posts one
  transaction with `POST /transactions` (`rest/transactions.ts`): one debit line
  per receipt, one credit line to the supplier-debt account (2400) carrying the
  bank account and the reimbursement number. It has a claim lock so nothing is
  posted twice. No SOAP is involved.
- **Teams approval chain.** `createApprovalChain` / `decideApproval`
  (`apps/api/src/lib/expense-approval.ts`), Adaptive Card with Approve/Reject
  plus an Outlook email fallback with token links
  (`packages/connectors/src/teams-bot/cards.ts`), a token-gated web approval
  page (`apps/web/src/app/(public)/fs/approve/[token]/`), the routing rules in
  `packages/shared/utils/expense-approvers.ts`, the Graph lookup in
  `apps/api/src/lib/expense-approver-resolution.ts`, and the
  `expense_approvals` + `expense_approval_issues` tables. The ledger post runs
  after the last approval.
- **A cost-type table nobody uses yet.** `expense_cost_types` exists in Appwrite
  (`label, slug, description, ocr_category, account_number, tax_code,
  campus_id, sort_order, active`; read any, write Operations Unit) and is read at
  posting time, but the web form uses the hardcoded
  `DEFAULT_EXPENSE_COST_TYPES` and admin has only a seed route
  (`apps/admin/src/app/api/expenses/cost-types/seed/route.ts`).
- **The Finago chart of accounts is synced** into `ledger_accounts` by
  `apps/admin/src/app/api/expenses/ledger-accounts/sync/route.ts`.
- **Attachments already carry** `cost_type`, `account_number`, `tax_code`
  (`expense_attachments`). Posting already prefers `account_number` over the
  type's account when it is set.
- **AI endpoints** in `apps/api`: `/api/expenses/ocr` (extracts vendor, date,
  amount, currency, category, location, purchase context) and
  `/api/expenses/summary` (writes the general description). Both run on
  Anthropic through `@repo/ai/models` and are gated by the `expenses_module` +
  `expenses_ocr` feature flags. The description regenerates whenever the receipts
  change (`expense-split-view.tsx`, the summary effect).
- **The Flutter app uses the same API** (OCR, summary, draft, submit,
  attachments). Its request and response shapes must keep working.

## Success looks like

1. A student in OSL Næringslivsutvalget uploads three receipts: an SAS flight,
   a Peppes Pizza receipt and a Canva invoice. The overview list shows
   *Travel*, *Food during meetings* and *Digital services* next to each
   receipt, with a small "AI" mark. The pizza one is flagged *Choose a type*
   because the AI wasn't sure; the student opens the combobox in the row and
   picks *Food during meetings* without opening the receipt. A question appears:
   "What was the occasion, and who was it for?"; they answer "Board meeting,
   6 board members". The general description updates once every receipt has a
   type: "Travel to the Trondheim finance gathering, food for a board meeting
   and a Canva subscription for Næringslivsutvalget."
2. A fourth receipt is a taxi. Nothing in the list fits their wording, so they
   type "Taxi to venue" and press Enter. At submission the AI books that line to
   7140 and notes it on the approval.
3. The financial manager (`finance.nu.oslo@biso.no`) gets a Teams card listing
   each receipt with date, type, account and amount, plus "Taxi to venue: account
   chosen by AI (7140), please check". They click **Open in admin**, sign in with
   that account, change the pizza line from 7360 to 7300, and approve there. The
   controller's Teams card now shows the history: "Financial manager changed
   receipt 2 from 7360 Møtemat to 7300 Internt styrearrangement · approved".
   The controller approves on Teams; the expense is booked with each receipt on
   its own date.
4. A receipt dated December 2025 is approved in January 2026 after the 2025
   books were locked. It is booked on 1 January 2026, and the history says so.
5. Finance opens Expenses → Settings → AI and sees "AI kept 87 % of the time
   (last 90 days)", that *Food during meetings* is most often corrected to
   *Board event*, and a suggestion: "12 students typed 'Taxi' — make it a type?"

## Goals

- Finance manages the list of expense types in admin: a name and a ledger
  account picked from the Finago chart of accounts. Students see names only,
  never account numbers.
- The AI picks a type from that live list for every receipt and says how sure
  it is. When it isn't sure, the student must choose before submitting.
- Students set types straight from the overview list, with a searchable
  combobox that also accepts their own text.
- For a student's own text, the AI chooses the ledger account at submission, so
  approvers see it and can correct it.
- The general description is rewritten with the types once every receipt has
  one.
- Every AI guess, student choice and approver correction is logged. Booked
  receipts become anonymous examples that make future guesses better for
  everyone, and finance can see how often the AI is right.
- More AI help during submission: receipt check, duplicate catch, occasion and
  attendees for types that need it, event match, and hints for approvers.
- Each receipt is booked on its own date in Finago; a date in a closed period
  moves to the next open period.
- The approval rules match the owner's (see Stage 3), including the controller
  submitting their own expense.
- Approvers are found once (by AI if needed), saved in a directory, and reused.
- An admin Expenses section to list every expense, open one, fix it, approve
  or reject it, and see its full history. The Teams card links into it.
- The Flutter app gets the same type picker and the controller switch, with a
  design that fits the app (Stage 5).

## Non-goals

- No model training or fine-tuning. "Learning" means showing the AI past
  confirmed examples.
- No change to who pays out or how (the payment run in Finago is untouched).
- No VAT handling beyond the tax code each type already carries.

## Anti-goals (would make this a failure even if it works)

- **Booking to an account nobody chose or saw.** Every account that reaches
  Finago was either set by a type finance configured, or shown to an approver
  before they approved.
- **Posting twice, or posting a changed amount nobody approved.** Keep the
  existing claim lock; any edit is logged and visible to every later approver.
- **A student's personal details going to the AI** beyond what the receipt
  itself shows (as today). The examples table never stores who submitted.
- **Breaking the Flutter app** by changing an API shape it depends on.
- **The AI inventing an approver.** It may only pick from real Microsoft 365
  mailboxes it was shown.

## Stages

Five stages, built and merged in this order *(my call: booking dates first
because it is a live bug and stands alone; the directory before the admin
section because admin edits it)*:

1. Booking on receipt dates and closed periods
2. Expense types, AI on submission, learning loop
3. Approval rules and the approver directory
4. Admin Expenses section and the richer Teams card
5. The Flutter app (BISO-Flutter repo)

**Release:** Stages 2–4 go live together, with the app update (Stage 5)
released at the same time *(my call)*. Stage 2 relies on
Stage 4 for the anti-goals: until the card shows receipts and accounts and admin
can edit, an AI-chosen account would reach Finago unseen, and an AI-saved
approver row couldn't be corrected. Shipping them together avoids temporary
guards. Stage 1 stands alone and may go live early.

---

## Stage 1 — Booking on receipt dates

**Lines and dates.** Each receipt's debit line gets `date` = the receipt's date
(`expense_attachments.date`). Finago requires a transaction to balance *per
date* (REST `TransactionInput.lines`: "All lines must balance to zero per
date"), so the credit side gets **one 2400 line per distinct date**, each for
the sum of that date's debits, each carrying the same reimbursement number and
bank account. The owner accepted that this may show up as more than one item in
the payment run. Example: three travel receipts from August, September and
October → three 7140 lines and three 2400 lines, one pair per date, in one
transaction.

- Top-level `date` = the latest line date *(my call)*.
- Missing receipt date → the booking day. A date in the future (typo) → the
  booking day *(my call)*. Both are logged.

**Closed periods.** REST `GET /fiscalperiods` (scope now granted) returns the
monthly periods with no open/closed flag. SOAP
`TransactionService.GetFiscalYears`
(`https://api.24sevenoffice.com/Economy/Accounting/V001/TransactionService.asmx?wsdl`)
returns `IsLocked` per **year** (verified 2026-11-11: 2025 and earlier locked,
2026 onward open). So:

1. Before posting, check the receipt's year with SOAP `GetFiscalYears`. If it
   is locked, move the line to the start of the first period (from REST
   `/fiscalperiods`) of the first unlocked year after it. Add a code comment:
   *replace with REST `/fiscalperiods` once Finago returns a lock flag there.*
   Add the service to `WSDL_URLS` in `packages/connectors/src/24sevenoffice/client.ts`.
2. If Finago still rejects the transaction because a single month is closed,
   move the affected lines to the start of the next REST period and retry,
   period by period, until it is accepted (cap: 12 retries). Recognise this case
   by Finago's error. We have never seen that error text, so match
   conservatively (mentions of period/periode/locked/låst/closed/stengt together
   with the date) and log the raw message the first time it happens. Anything
   unrecognised fails the expense exactly as today (`failed` status, surfaced for
   review). Do not test this against the live company.
3. Every date shift is logged on the expense history (Stage 4 shows it):
   "Receipt 2 booked on 2026-01-01 instead of 2025-12-18 (2025 is closed)".

Tests: the pure builder (`buildExpenseTransactionInput`) gets per-date
grouping, rounding per date, and the shift logic as a pure function over a list
of periods + locked years.

---

## Stage 2 — Expense types and AI on submission

### Admin: Expenses → Settings → Types

A table of types with: **name** (English), optional **Norwegian name** (shown
on the Norwegian site when set) *(my call: the site is bilingual)*, **ledger
account** picked from a searchable list of `ledger_accounts` (number + name;
only active accounts), **note for the AI** (the existing `description`
column: what belongs here and what doesn't, e.g. "Food for a meeting; not
social events"), **Ask for occasion and attendees** switch, **active** switch,
sort order. Tax code comes from the chosen account's `tax_code` and can be
overridden. Deactivating a type hides it from students but old expenses still
resolve. A "Sync accounts from Finago" button calls the existing sync route.
Who can edit: global admins *(my call: types are organisation-wide)*.

The existing slugs `travel`, `social`, `academic`, `other` must stay so old
drafts and pending expenses still resolve. New types get a generated slug.

**Proposed starting list** for the owner to review (accounts and usage over
Aug 2025 – Nov 2026 pulled from Finago on 2026-11-11):

| Type | Account | Evidence (debit lines, examples) |
|---|---|---|
| Travel (flights, train, bus, hotel, taxi) | 7140 Reisekostnad | 1091 lines: flights, hotel |
| Food while travelling | 7160 Mat under reise | 236: "Reisemat" |
| Car rental, fuel, parking | 6430 Leiebil og andre transportmidler | 176: fuel, parking, bus hire |
| Food during meetings | 7360 Møtemat | 455: pizza, dinner before meeting |
| Board / internal event | 7300 Internt styrearrangement | 297: "Mat til styret" |
| Social event | 7310 Sosialt arrangement | 692 |
| Academic event | 7305 Faglig arrangement | 394 |
| Open day, stands, recruitment | 7315 Diverse arrangement | 91: stands, BISO-dag |
| General assembly | 7316 Felles arrangement | 104: "Mat til GF" |
| Venue rental | 6310 Leie av lokale, sosialt arrangement | 63 |
| Equipment and inventory | 6540 Inventar og IT-utstyr | 56: adapters, microphones |
| Office supplies | 6800 Kontorrekvisita | 50 |
| Digital services and software | 6810 IT-lisenser og software | 359 |
| Marketing and print | 7320 Markedsføring | 72: posters, banners |
| Merch and clothing | 7325 Markedsføring, bekledning | 161: sweaters |
| Prizes | 7330 Premier ifm. konkurranse | 125 |
| Gifts to external people | 7420 Gave til eksterne | 49: flowers |
| Gifts to volunteers and board | 5900 Gave til ansatte og engasjerte | 49 |
| Shipping and postage | 6100 Frakt | 22 |
| Cabin rental | 6490 Hytteleie | 31 |
| Courses and training | 6860 Kurs og opplæring | 25 |
| Other | 6555 Andre driftskostnader | 144 |

"Ask for occasion and attendees" on by default for: Food during meetings,
Board / internal event, Social event, Gifts to volunteers and board *(my call;
the owner reviews)*.

Two mismatches with today's code, for the owner to confirm:
- Code calls 7315 "Academic event", but in Finago 7315 is *Diverse arrangement
  (åpen dag, rekrutteringsdag e.l.)* and 7305 is *Faglig arrangement*. The list
  above maps the `academic` slug to 7305.
- "Other" posts to 7790, used once in 15 months. 6555 *Andre driftskostnader*
  (144 lines) looks like the real catch-all. The list maps `other` to 6555.

The seed route is replaced by an admin action that seeds this list once
(idempotent), after the owner has reviewed it.

### AI picks the type at upload

`/api/expenses/ocr` loads the active types (slug, name, note) and asks the
model to choose one, with a **confidence** (0–1) and a short reason. It also
gets up to ~10 **examples** from past booked receipts (see Learning loop).
Response adds `costType`, `costTypeConfidence`, `receiptIssues` (below),
`ocrAmount`; it keeps `category` (derived) and every existing field for the
Flutter app.

**The server keeps its own copy of every scan** *(my call)*. The client can't
be trusted to report AI results back: attachment rows are rebuilt from the
client's payload on every save, so a student could send `ocr_amount` equal to
`amount` and hide the "amount differs" hint, or skew the eval. So the OCR route
computes the file's SHA-256 and writes the result (type, confidence, reason,
`ocr_amount`, `receipt_issues`, extracted fields) to a new
`expense_receipt_scans` table keyed by that hash. At submission the server
hashes each attachment's stored file, looks up its scan, and fills `ai_*`,
`ocr_amount`, `receipt_issues` and `file_hash` itself. Values the client sends
for those fields are ignored. A file with no scan (OCR off, app, failure) is
classified at submission (below).

**Drafts across devices.** A draft save keeps the server-owned fields
(`ai_*`, `ocr_amount`, `receipt_issues`, `file_hash`, `account_source`) for
attachments whose file is unchanged, and keeps `cost_type_text` when the sender
didn't send a type field for that attachment. That way a web draft saved again
from the app doesn't lose them.

- Confidence ≥ 0.8 → the type is filled in and marked "AI" in the list.
- Below → the row is flagged **Choose a type**; submit is blocked until the
  student picks one. *(my call: 0.8, a constant; tune it with the eval data.)*
- AI unavailable or the flag off → the type is empty and the student chooses.

### The type combobox in the overview

In `expense-report.tsx` each receipt row gets a type control: a column
between Item and Date on desktop, under the vendor line on mobile. Built from
`@repo/ui` `popover` + `command` (a `combobox.tsx` exists; reuse it if it fits).

- Typing filters the list by name (and Norwegian name).
- When the text doesn't exactly match a type, the list ends with a separate
  item, styled unlike the options (e.g. a "+" icon and "Use “Taxi to venue”"),
  and **Enter** with no highlighted option picks it. That stores the text as the
  receipt's own type.
- States: *AI-picked* (subtle AI mark), *needs a choice* (warning style,
  "Choose a type"), *chosen*. Fully keyboard-operable; the row's click target
  must not swallow the combobox.
- The detail pane's `CostTypeField` uses the same combobox.
- Supporting bank statements (amount 0, attached to a receipt) need no type.

### The student's own text → ledger account (at submission)

In the submit route (`apps/api/src/app/api/expenses/submit/route.ts`), before
the approval chain is created:

- For a receipt with a listed type, copy that type's account and tax code onto
  the attachment (`account_number`, `tax_code`). This **snapshots** the account
  so a later change to the type doesn't move submitted expenses *(my call)*.
- For a receipt with the student's own text, the AI gets the text, the
  receipt's extracted fields, the types with their accounts, and the active
  cost accounts from `ledger_accounts` (4000–7999). It returns one account
  number from that list plus a confidence. Store it with `account_source =
  ai_freeform`. Low confidence still stores the best guess but adds an approver
  hint ("AI unsure about the account for receipt 4, please check").
- A receipt with no type at all is classified here on the server from the
  stored file, the same way as at upload *(my call: replaces today's silent
  default to "Other" in `expense-payload.ts`)*. Low confidence → approver hint.
- **Older app versions** (2.2.15 and 2.2.16) always send one of the four old
  slugs, filled in from the OCR category when the student didn't pick one, so
  the server can't tell a real choice from a default. Those payloads are
  recognisable because they lack the fields the updated app and the web send
  (`cost_type_chosen` per attachment, see Stage 5). For them, the server treats
  the slug as a suggestion, classifies the receipt itself, uses the AI's type
  when it is confident, and shows the approver both ("App sent Social event;
  AI chose Food during meetings").
- If the AI fails here, the account stays empty and the approver must set it in
  admin before approving (Stage 4 blocks Approve on Teams for such expenses).

### General description

The summary request gains each receipt's type name (or the student's own
text), the occasion answer and the matched event. The description regenerates
only once every receipt has a type. It no longer overwrites a description the
student has edited since the last AI version *(my call; today it always
overwrites)*. The summary request shape stays backward compatible (new fields
optional).

### More AI help during submission

1. **Receipt check.** The OCR call also returns `receiptIssues`: codes such as
   `not_a_receipt` (order confirmation, quote), `no_items`, `unreadable`,
   `missing_seller`, `missing_date`, `missing_total`. Shown as a warning on the
   row and in the detail pane. They don't block submission *(my call)*; they
   become approver hints.
2. **Duplicate catch.** On upload, store the file's SHA-256 (`file_hash`). Warn
   when the same file, or the same vendor + date + amount, appears in this
   expense or in any earlier non-rejected expense (any submitter). To the student:
   "This receipt looks like one already submitted" without saying by whom. To
   the approver: the other reimbursement's number. Non-blocking.
3. **Occasion and attendees.** When any receipt's type has *Ask for occasion and
   attendees*, the report shows a required field "What was the occasion, and
   who was it for?". The AI pre-fills it when the receipts make it evident;
   the student confirms or edits. Stored on the expense (`occasion`) and fed to
   the description.
4. **Event match.** Look up published, non-cancelled events of the selected
   department whose start date is within 7 days of any receipt date. If found,
   suggest "Was this for {event}?"; accepting fills the existing `eventName`
   (and a new `event_id`). Nearest date wins.
5. **Approver hints** (computed at submission, recomputed after admin edits):
   amount entered differs from the amount read from the receipt (`ocr_amount`),
   receipt older than 90 days *(my call)*, possible duplicate, receipt-check
   issues, AI-chosen or unsure account. Shown on the Teams card, the email and
   the admin page (Stage 4).

### Learning loop and eval

**Every decision is logged.** On each attachment: the AI's type and
confidence (`ai_cost_type`, `ai_confidence`), the final type or text, and where
the account came from (`account_source`: `type`, `ai_freeform`, `approver`,
`admin`). Approver/admin changes are also in the history (Stage 4).

**Examples.** When an expense is booked, write one row per receipt line to a
new `expense_type_examples` table: normalised vendor, short purchase
description, amount, the AI's pick and confidence, the final type or text, the
final account, and the source of the final answer (`student`, `approver`,
`admin`). No submitter, no names, no expense id *(my call: keeps the examples
anonymous and lets them outlive deleted expenses)*.

**Using them.** For a new receipt, pick up to ~10 examples: same normalised
vendor first (most recent, approver/admin corrections ahead of student
choices), then one or two recent examples per type for balance. They go into
the classification prompt as "past receipts like this were booked as …".
Better similarity (keywords, embeddings) is left to the builder; vendor match is
the floor.

**Eval** (Expenses → Settings → AI, Stage 4 builds the page):
- How often the AI's pick was kept, overall and per type, for the last 30/90
  days; which types it is most often corrected to.
- Student texts that recur (normalised, 3+ times) with a **Make this a type**
  action.
- **Re-run check:** classify the latest booked examples (cap 200) with the
  current type list and prompt, each without itself among its examples, and
  report the hit rate and the misses. Run on demand, e.g. after changing types.

---

## Stage 3 — Approval rules and the approver directory

### Rules

| Campus | Department | Switch shown | Switch off | Switch on |
|---|---|---|---|---|
| Oslo (1) | Every Oslo department except 1 and 2 (the "OSL …" ones) | I'm this department's financial manager | Financial manager → controller | Department manager (deputy if none) → controller |
| Oslo (1) | 1 Drift Campus Oslo, 2 Ledelsen Oslo | I'm the campus controller | Controller | Campus president |
| Bergen (2), Trondheim (3), Stavanger (4) | Drift + Ledelsen of that campus (300/301, 600/601, 800/801) | I'm the campus controller | Controller | Campus president |
| Bergen, Trondheim, Stavanger | All other departments | none | Controller | n/a |
| National (5) | All | none | manager@biso.no (unchanged) | n/a |

- Drift Campus Oslo becomes controller-only like Ledelsen Oslo. Today it goes
  looking for a department financial manager it won't find.
- The Finago department ids above were verified on 2026-11-11. The builder must
  confirm how the web's selected department id maps to them (`departments.$id`
  vs `departments.Id`); the current code compares `$id` with `"2"`.
- Switch visibility follows campus + department id, not the name prefix
  *(my call: same result for Oslo today, and doesn't break if a department is
  renamed)*.
- The two switches are never shown together, reset when the department
  changes, and are styled as the existing financial-manager card (a labelled
  card with a hint saying who will approve instead).
- The switches are self-declared, as today (submitters use personal accounts,
  so it can't be verified). The server ignores a switch that doesn't apply to
  the department, logs the declaration, and the card shows "Submitter says they
  are the campus controller".
- New expense column `submitter_is_controller` (boolean); `approver_role`
  enum gains `president`.

### Approver directory

A new table `expense_approvers`: one row per department + role (`finance`,
`manager`, `deputy`) and per campus + role (`controller`, `president`,
`national`). Columns: scope, department id, campus id, role, email, AAD id,
display name, source (`seed`, `ai`, `admin`, `confirmed`), confidence,
confirmed at, last used at, active.

Resolution order for each step:

1. **Directory row** (active) → use it.
2. **Otherwise ask the AI**, with real candidates from Microsoft Graph:
   users whose `department` equals the Finago department name, plus mailboxes
   whose local part starts with a role word (`finance`, `financial`, `manager`,
   `deputy`, `deputymanager`, `president`, and for Stavanger also `leder`,
   `nestleder`) and contains the department's abbreviation
   (`departments.abbreviation`) or the campus slug (`oslo`, `bergen`, `trd`,
   `trondheim`, `stavanger`). The model gets the department name, abbreviation,
   campus and role, and the candidates (mail, display name, department
   attribute). It returns one candidate's email or none, plus a confidence. The
   answer must be one of the candidates (checked in code). Fast model tier.
3. Confident → use it and save the row (`source = ai`). Not confident or none
   → today's fallback: skip the department step, go to the controller, and open
   an `expense_approval_issues` row for admin.

When an approver actually approves (Teams, email or admin), their directory row
gets `confirmed_at` and `source = confirmed`. Controller and president rows are
seeded once (controller.<campus>@biso.no; presidents found by the AI lookup on
first use or by the builder's one-off seed, e.g. `president.oslo@biso.no`,
`president.bergen@biso.no`), so nothing stays hardcoded. Manager falls back to
deputy, as today.

Microsoft 365 survey (2026-11-11), the reason this is needed: most mailboxes
are `finance.<abbr>.<campus>@` / `manager.<abbr>.<campus>@`, but there are
`financial.`, capitalised `Finance.`, `deputymanager.`, Norwegian
`leder`/`nestleder` (Stavanger), Trondheim uses `.trd` not `.trondheim`, about
19 finance mailboxes have no department set, and some carry the wrong one
(`manager.baa.oslo` is tagged OSL BBA).

---

## Stage 4 — Admin Expenses section and the Teams card

### Navigation and pages

A top-level **Expenses** item in the admin sidebar:

- `/expenses`: list. Columns: reference, submitter, department, campus, total,
  status, current step and approver, submitted date, flags (hints, failed,
  approver issue). Filters: status, campus, department, **Waiting on me**,
  **Needs attention** (failed bookings and approver issues). The existing
  `/it/expense-approvals` issues page moves here as the Needs attention filter;
  the old route redirects *(my call)*.
- `/expenses/[id]`: detail. Header (reference, status, submitter, department,
  campus, description, occasion, event, the submitter's switch), receipts
  (file preview, vendor, date, amount, type, account number + name, AI notes,
  booked date once booked), approval steps, and the **history**.
- `/expenses/settings`: tabs **Types** (Stage 2), **Approvers** (the
  directory: view, edit, deactivate, see source and last confirmed), **AI**
  (the eval).

### Access (owner decisions)

- **Global admins:** everything, including all settings. They may approve or
  reject any pending step **on behalf of** its approver. The history records
  both ("approved by X on behalf of the financial manager"), and an
  on-behalf decision does **not** mark the approver's directory row as
  confirmed.
- **Campus controller:** everything a global admin can do on an expense, for
  their own campus's expenses only: view, edit (including bank account),
  approve or reject on behalf, change approver, retry booking. Who counts as
  the controller comes from the directory's active `controller` row for that
  campus (email match on sign-in), not from team roles.
- **Campus admins:** can see their campus's expenses, not edit them. They may
  edit department approver rows for their campus. Controller and president
  rows are global-admin only, so nobody on campus can repoint them.
- **Approvers:** anyone signed in whose email matches an `expense_approvals`
  row sees that expense; they can edit and approve only while their step is
  pending. This grant comes from the approval rows, not from team roles, so a
  role mailbox like `finance.nu.oslo@biso.no` can use it after a normal
  Microsoft sign-in. The builder must check that such an account (and the
  controller mailbox) gets past the admin layout's sign-in gate, and add the
  narrowest exception needed if not.
- **No self-approval.** Nobody can approve, reject, edit or change the approver
  of an expense submitted from their own account. Because a controller submits
  from a personal account but signs in to admin with the controller mailbox,
  an expense with `submitter_is_controller = true` is also closed to that
  campus's controller role; only the president or a global admin can act on
  it. The same applies to the financial manager role when
  `submitter_is_financial_manager = true`.

### Editing and approving in admin

- The current approver, the campus controller or a global admin can change, per
  receipt: type, account (searchable `ledger_accounts`), date, description,
  amount. Bank account is read-only except for global admins and the campus
  controller *(my call: payout-critical)*.
- Every change is written to the history with who, when, field, before and
  after. Earlier approvals stand; the next approver sees the changes on their
  card.
- **Approve** and **Reject** (with a reason, sent to the student as today) on the
  page go through the same `decideApproval` as Teams, so the chain advances the
  same way and the Teams card updates.
- **Change approver** on a pending step updates the directory row and re-sends
  the request (existing resend route).
- After booking, nothing is editable. A failed booking shows Finago's message
  and a global-admin **Retry booking** with a warning to check Finago first
  (keeps the existing no-auto-repost rule).

### History (`expense_events`)

New table: expense id, actor email, actor name, actor kind (`student`,
`approver`, `admin`, `ai`, `system`), action (`submitted`, `ai_classified`,
`ai_account_chosen`, `edited`, `approved`, `rejected`, `approver_resolved`,
`notified`, `booked`, `booking_failed`, `date_shifted`), attachment id,
field, before, after, note. Server-written with the admin key; read by
Operations Unit (and through admin's access checks). Stages 1–3 already write
their events here, so this table is created in Stage 1 *(my call)*.

### Teams card and email

- Receipts table: date, vendor/description, type, account number + name,
  amount. Long lists truncate with "and N more"; the card must stay under the
  Teams payload limit.
- Approver hints as warning lines.
- The history (latest ~6 entries; full history in admin).
- Actions: **Approve**, **Reject**, **Open in admin** (`/expenses/<id>`), and
  **View receipts** (existing token page, kept for email users).
- If any receipt has no account, the card replaces Approve with "Set the
  account in admin" *(my call)*.
- The email carries the same content.

---

## Stage 5 — The Flutter app

In `/Users/markus/Documents/dev/BISO-Flutter` (today: the four hardcoded
types in `lib/core/utils/expense_cost_types.dart`, the financial-manager switch
in `lib/presentation/screens/expense/create_expense_screen.dart`, payload in
`lib/data/models/expense_v2_models.dart`). The owner wants it to look and feel
designed for the app, not ported from the web.

- **Types from the table.** The picker loads active types from
  `expense_cost_types` (readable by anyone) instead of the hardcoded four, and
  shows the Norwegian name when the app is in Norwegian.
- **A searchable type picker with "use what I typed"**, the app version of the
  web combobox (a bottom sheet with a search field suits the app *(my call)*),
  reachable from the receipt list so students don't have to open each receipt.
- **AI state:** the OCR response's `costType` and `costTypeConfidence` drive the
  same three states as on the web: *AI picked*, *needs a choice* (blocks
  submit), *chosen*.
- **Send a type only when one was chosen or confidently picked**, with
  `cost_type_chosen: true` per attachment and `cost_type_text` for the
  student's own text. Stop filling in `defaultCostTypeSlugForCategory`.
- **"I'm the campus controller" switch** next to the existing financial-manager
  switch, with the same visibility rules as the web (Stage 3), and the
  financial-manager switch's rule updated (Drift Campus Oslo no longer shows
  it).
- **Occasion and attendees** question when a chosen type asks for it, because
  the server requires it.
- Receipt-check and duplicate warnings shown as simple notices from the API
  response. Event match is web-only for now *(my call)*.
- English and Norwegian strings; release after the server stages are live,
  through the app's existing release pipeline.

---

## Data model changes (summary)

All in `packages/api/appwrite.config.json` (the owner pushes the schema and
regenerates `types/appwrite.ts`):

- `expense_cost_types`: add `label_no` (string), `ask_occasion` (boolean,
  default false). `ocr_category` becomes unused (leave it).
- `expense_attachments`: add `cost_type_text`, `type_source` (enum: `ai`,
  `student`, `legacy_app`), `ai_cost_type`,
  `ai_confidence` (double), `account_source` (enum), `ocr_amount` (double),
  `file_hash`, `receipt_issues` (string, JSON), `booked_date` (datetime).
- `expense`: add `occasion`, `event_id`, `submitter_is_controller` (boolean),
  `approver_hints` (string, JSON).
- `expense_approvals.approver_role`: add `president`.
- New: `expense_events`, `expense_type_examples`, `expense_approvers`,
  `expense_receipt_scans` (file SHA-256, scan result JSON, scanned at). Same
  permission pattern as `expense_approvals` (Operations Unit read; server
  writes with the admin key). Indexes on expense id, normalised vendor, and the
  directory's department/campus + role.

## Things found along the way

- **Graph secret expired on 2026-11-07.** Approver lookups in production fail
  if production uses it (every Oslo expense would fall back to the controller).
  A new secret, "BISO Sites 2026-11" (expires 2028-11-11), was added to app
  `170c512f…` and written to `apps/admin/.env.local` and `apps/api/.env.local`
  (`AZURE_GRAPH_CLIENT_SECRET`, which `apps/api` lacked). The owner copies it
  to the admin and api deployments.
- The 7315 and 7790 mismatches above.
- Trondheim department mailboxes use `.trd`, but `CAMPUS_EMAIL_SLUGS` has
  `trondheim`; the directory lookup accepts both.

## Left to the builder

- Prompt wording, the exact confidence calibration, and similarity beyond
  vendor match.
- Combobox internals and layout details within the design system rules in
  `apps/web/CLAUDE.md`.
- Card layout, truncation and the payload-size guard.
- How the closed-month error is matched, within the conservative rule above.
- Splitting each stage into tasks, and test coverage (pure functions first:
  per-date grouping, period shifting, approval plan table, candidate fencing,
  example selection).

## Docs

Update the platform guide pages for the student expense flow and for finance
staff, and the developer pages whose `covers` match the changed code
(`developers/reference/accounting.mdx`, `developers/change-it/data-model.mdx`,
`developers/keep-it-running/secrets-and-environment.mdx`). Add a guide page for
the admin Expenses section.

## Owner actions before go-live

- Review the proposed type list and accounts (and the 7315/7790 question).
- Push the schema changes; regenerate types.
- Set the new `AZURE_GRAPH_CLIENT_SECRET` in the admin and api deployments.
- Review the approver directory after the first seed.
- Deploy api, then web, then admin; then release the app update.
