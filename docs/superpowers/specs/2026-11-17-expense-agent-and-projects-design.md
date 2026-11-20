# Expenses: background AI check with tools, Finago projects, and fixes — design

## Why

The expense module (`/fs` on the web, the Flutter app, the admin Expenses
section) was built in Nov 2026 (spec
`docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md`, PR #119 and
follow-ups #121/#122). The owner asked for three things on 2026-11-17:

1. **Check that it works, and that the AI really learns.** A read-through of
   `main` (ed9faf05) found the flow is built as intended and all 971 api tests
   pass, but the learning loop is dormant in production and a handful of bugs
   exist (Part A and B).
2. **Book the Finago project dimension.** Some departments put a project on
   almost every ledger line (`Fadderullan 2026`, `KD 2026`, `Wintergames 2027`,
   `BBL 2027` …). Finance creates new projects every year. The owner wants no
   hard-coded list: read the projects from Finago, and let the AI pick the right
   project **and year** (Part C).
3. **Let the AI work with tools instead of a fixed pipeline.** Today every AI
   step is one prompt and one answer in a fixed order. The owner wants an agent
   that has expense tools and keeps using them until everything is in order,
   for better accuracy — without making the student wait (Part D).

Everything below marked *(my call)* is mine; everything else the owner decided
in the conversation on 2026-11-17.

## What exists (read before building)

- AI calls: `apps/api/src/lib/receipt-scan.ts` (extract with `balancedModel`,
  classify with `fastModel`, 8 s), `apps/api/src/lib/expense-submission.ts`
  (`enrichSubmission`: snapshot accounts, own-text → account, classify untyped,
  legacy app payloads, duplicates, hints), `apps/api/src/lib/expense-summary.ts`
  (description at the review step), `expense-approver-lookup.ts` (M365 lookup).
- Learning: `expense-examples.ts` (select up to 10 examples, vendor match
  first), `expense-posting.ts` `writeBookedExamples` (writes one example per
  booked receipt), `expense-eval.ts` (re-run check), admin
  `expenses/settings/ai/*` (kept-rate stats from submitted attachments).
- Submit: `apps/api/src/app/api/expenses/submit/route.ts` → `enrichOrReject` →
  `submitForApproval` (`createApprovalChain`: resolve approvers, create chain
  rows as the exactly-once claim, notify step 1) or `submitByEmail` (flag
  `expenses_ledger_posting` off — **production today**).
- Background precedent: `apps/api/src/lib/expense-book-on-approval.ts` books
  in `next/server` `after()` after the last approval; `post-pending` cron route
  is the backstop. Reuse this pattern.
- Booking: `expense-posting.ts` (`buildAndPostLedgerTransaction`),
  `packages/connectors/src/24sevenoffice/rest/transactions.ts`
  (`buildExpenseDimensions`: one dimension array per expense; department type 2,
  campus only when `TFSO_CAMPUS_DIMENSION_TYPE` is set; 2400 lines add customer
  type 5).
- Finago projects: system dimension type 1. `GET /dimensions/1/elements` lists
  active projects (value + name only, paged with a Link `continuationToken`),
  read-only — projects can't be created via the API. `getDepartments` in
  `rest/departments.ts` is the paging template (generalise it; drop its stray
  `console.log`). `GET /transactionlines?includeDimensions=true` (with
  `accountNumber`, `dateFrom`, `dateTo`) returns line dimensions.
- The repo's AI stack is the Vercel AI SDK with `@ai-sdk/anthropic`;
  `packages/ai/src/models.ts` reserves `balancedModel` (Claude Sonnet 5.5) for
  agentic tool loops. The admin assistant (`packages/ai/src/assistant/tools`)
  is an existing tool-loop example.

## What Finago shows (pulled read-only from prod on 2026-11-17)

Local `.env.local` points `TFSO_REST_ORG_ID` at the DEMO company (no projects).
Prod is org `266330540180206`.

- 143 active projects. Mixed: current (`KD 2026`, `Wintergames 2027`,
  `BBL 2027`, `Fadderullan 2026`), old (`Fadderullan 17`, `Ball 18`), payroll
  (`Ferie`, `Sykemelding`, `Lønnsregistrering - IT`), and year-less ones
  (`24Sevenoffice`, `BISO-Lunsj`, `Speilende verv samlinger`). Year formats vary:
  `2026`, `17`, `oktober2026`, `mars 2026`. Abbreviations: KD = Karrieredagene,
  BBL = Bergensbaneløpet, FBF = Female Business Forum.
- Cost-account lines Aug 2024 – Nov 2026 (24 accounts, 8 899 lines, 3 118 with
  a project). Share of a department's lines carrying a project:
  OSL Fadderullan 450/455, BRG Fadderullan 177/178, Wintergames 107/107,
  Samlinger - CL 220/221, OSL Karrieredagene 398/418, Bergensbaneløpet 236/266,
  FBF 45/51, Drift BISO 955/1962 (Landsmøte, Ledersamling, Nordic Forum,
  24Sevenoffice …), HR 62/542, Operations Unit 17/370. BRG/TRD Næringslivsutvalget
  book on `KD YYYY`.
- **Projects are also on 2400 lines** (692 of 2 192 in Aug–Oct 2026), so the
  payout side carries the project too.
- Year timing from the booking windows: `Wintergames 2026` 2025-08 → 2026-08,
  `Wintergames 2027` from 2026-06-17; `Fadderullan 2026` 2025-10 → 2026-10;
  `KD 2026` from 2025-08-25; `BBL 2026` to 2026-10-27 and `BBL 2027` from
  2026-08-27 — **windows overlap**, so a date alone can't always decide.
- Project 120 is named `Wintergames 2026` now but `Vinterlekene 2026` on older
  lines (renamed), so always take names from the element list, not from lines.

## Goals

- Every confirmed bug from the check is fixed (Part A).
- The AI learns from what students, approvers and admins actually decide, in
  production too, and the learning signal is correct (Part B).
- Receipts that belong to a project are booked with the right project and year,
  from Finago's live list, with nothing hard-coded (Part C).
- After the student presses Submit, an AI agent with read-only expense tools
  checks the whole expense in the background and settles types, own-text
  accounts and projects; whatever it can't settle reaches the approver as a
  flag (Part D).
- With direct booking off, accounting's email carries what the AI settled.

## Non-goals

- No model training or fine-tuning; learning stays "show the AI past examples".
- No agent while the student is on the page. The quick per-receipt read and type
  pick at upload stay as they are.
- No creating projects in Finago (the API can't); finance keeps creating them.
- No change to who approves or to the payout run.

## Anti-goals (a failure even if it works)

- **The student waits for the agent.** Submit must return as fast as today or
  faster.
- **Approvers notified before the check is done**, or notified twice.
- **Booking to an account, type or project nobody chose or saw.** The agent only
  proposes; code validates every value against the live lists; anything set by
  the agent is visible to approvers before they approve.
- **The agent overriding the student's own explicit choice** silently.
- **Personal details to the model** beyond what goes today (receipt contents,
  the occasion text, department/campus). No name, email, phone or bank account.
- **The examples table identifying a submitter.**
- **Breaking the Flutter app.** The submit/draft API shapes and the expense
  status values the app parses stay the same.
- **An expense stuck forever** because a background run died.

## Owner decisions (2026-11-17)

- Projects come from Finago at runtime; no hard-coded project or department list.
- **Year rule:** a receipt belongs to the next edition of the event that has not
  yet taken place on the receipt's date (e.g. a BBL receipt in September 2026,
  after the summer 2026 race, is `BBL 2027`).
- Event timing is learned from booking history; a website event with a matching
  name and department, when one exists, gives the real date.
- Candidates are the projects the department has used before plus newer years of
  the same series; payroll projects drop out because they never appear on cost
  accounts.
- When next year's project doesn't exist in Finago yet, leave the project empty
  and flag it for the approver — never book on last year's project.
- The final project is stored with the booked examples so corrections teach the
  next guess.
- The agent uses tools freely until everything is in order.
- The student is never held: Submit returns at once; the agent runs afterwards
  in `after()`; approvers are notified only once the agent is done; on failure
  or timeout fall back to today's fixed steps and notify anyway, with a flag; a
  scheduled job picks up anything left waiting.
- With direct booking off, accounting's email waits for the agent the same way
  and includes types, project, occasion.
- What the agent can't settle goes to the approver as a flag to fix in admin
  before approving; the student is not emailed questions.
- Costs just after an event (afterparty, thank-you gifts, late event-day costs)
  most likely belong to the edition that just finished, not next year's. The date
  rule is the default; clear content wins; unclear cases are flagged.
- The owner raises the Appwrite site timeouts in the console (all sites are 30 s
  today).
- Direct booking goes live soon, so the learning gap while it is off is
  short-lived; no reading back of accounting's manual bookings.
- Building may read production Finago (read-only) for fixtures and checks;
  write tests go to the DEMO company, where test projects may be created.

---

## Part A — Fixes from the check

Each is a confirmed defect on `main` (file:line as of ed9faf05).

1. **Resend revives a rejected expense.** `resendApprovalNotification`
   (`expense-approval.ts:1261`) and the token path (`decideStep` with
   `requireCurrentStep:false`, ~1134) never check the expense status; the final
   approval sets `approved` unconditionally (~1068). Refuse resend and decisions
   unless the expense is `pending`; when an expense is rejected, close its
   remaining pending steps and resolve its open issues.
2. **A failed scan leaves the receipt stuck** (`expense-split-view.tsx:745`,
   `store.ts:278`). A receipt in `error` blocks the type picker and submit. Make
   it usable: keep the file, let the student fill amount/date/type by hand, and
   offer "Try again".
3. **Own-text account call has no time limit** (`expense-submission.ts:406`).
   Add an abort signal like the classify call. (Part D moves this off the
   request path anyway; fix it regardless, it stays the fallback.)
4. **Server default recorded as the student's choice**
   (`expense-submission.ts:111` `defaulted()` sets `type_source: "student"`, and
   overwrites `legacy_app` from `decideLegacy`). Add a distinct source (e.g.
   `default`) that never teaches.
5. **Admin approve doesn't block a receipt with no account**
   (`decideApprovalStep` ~1153; `decision-panel.tsx`). Same guard as the token
   path.
6. **Re-routing a fallback step overwrites the general manager's directory row**
   (`changeStepApprover` → `directoryTarget`, `expense-approval.ts:1336`). A
   re-route of a step whose `directory_key` belongs to another role must not
   write that key.
7. **Reopened draft never gets its AI description**
   (`expense-split-view.tsx:483,534,599`; `store.ts:218`). After a reopen, an
   empty description must be generated once every receipt has a type.
8. Smaller ones:
   - Admin amount edit sums only attachments with `expense_id`
     (`expenses/[expenseId]/actions.ts:173`); older rows lack it → wrong total.
     Sum through the expense relation.
   - Department dimension dropped when `departmentRel` is null
     (`expense-posting.ts:631`); fall back to `expense.department`.
   - A claim without its marker stays stuck (`expense-posting.ts:726`);
     `post-pending` lists `approved` with `limit(5)`, no order, and counts skips
     as posted (`post-pending/route.ts:58`). Order by oldest, skip claimed rows in
     the query, report skips honestly, and let the reaper act on a lock without
     a marker after the stale window.
   - "Booked, status write failed" ends `failed` forever (`writeSuccess`,
     reaper, retry refuses as already booked). Let retry, when a booked
     transaction id or `booked` event exists, finish the success write (status,
     `booked_date`, examples) without posting again.
   - A zero-step chain stays pending with no admin way out
     (`expense-approval.ts:364`); let a global admin rebuild the chain.
   - Optional while there: event not cleared when the department changes
     (`store.ts:241`), and the description has no 800-char cap in zod/UI.

## Part B — Learning that works

Today examples are written only when an expense is booked
(`writeBookedExamples`). With direct booking off, nothing is learned.

1. **Write an example at submission, upgrade it at the end.** At submit (after
   the agent, Part D), write one example per receipt with `confirmed = false`,
   holding **only what a person chose or saw**: a type the student picked, or the
   AI's upload pick the student saw and kept; the student's own text. Values only
   the agent chose (projects, own-text accounts, types it changed) are stored on
   the row but never shown to later prompts until confirmed, so the agent never
   learns from its own unchecked picks. When the expense is booked, update that
   same example with the booked values, `confirmed = true`, and the final source
   (`student`, `approver`, `admin`). An admin/approver edit on a pending expense
   (either submit path) updates the example right away as a human choice.
   A rejected expense's examples are deleted. *(my call: the owner wants student
   selections stored for learning now, not only once booking goes live.)*
   - With direct booking off, nothing gets `confirmed` and projects don't learn
     until booking goes live; reading accounting's manual Finago bookings back is
     out of scope *(my call)*.
   - Linking the example to the receipt must not make the examples table
     identify anyone: use a one-way key (e.g. HMAC-SHA256 of the receipt's
     `file_hash` with a server secret), never the expense or attachment id.
   - Selection ranks confirmed above unconfirmed, then human corrections above
     student/AI choices, then recency.
2. **Account-only corrections.** When an approver/admin changes the account but
   not the type, the example keeps `final_cost_type` but its `source` must not
   claim a human chose that type. Store the type's source and the account's
   source separately (e.g. `type_source` and `account_source` on the example)
   and teach the type only from the type's source.
3. **Old app versions.** A type change by an approver/admin on a `legacy_app`
   receipt marks the type as human-chosen, so it teaches.
4. **Server defaults never teach** (A4).
5. **Department and project on examples.** Store `department_id` and
   `project_id`/`project_name` on each example. Department is not personal data
   and is a strong hint for both type and project.
6. **Better matching than exact vendor.** Vendor match stays first, but also
   match on the vendor's first word(s) (`rema 1000 majorstuen` ↔ `rema 1000`) and
   on description keywords. Exact approach left to the builder; the agent's
   `search_past_bookings` tool (Part D) uses the same search.
7. **Own text teaches the account.** Examples with an own text and a final
   account are returned by the search tool (with the account), so the agent can
   reuse "Taxi to venue → 7140".
8. **Eval.** The AI settings tab adds project kept-rate (how often the agent's
   project was kept by approvers) next to the type kept-rate. The re-run check
   keeps working for types.

## Part C — Finago projects

### Sync

- `getProjects()` in the connector (dimension type 1, all pages).
- New table `finago_projects` *(my call; schema edited in
  `packages/api/appwrite.config.json`, the owner pushes)*: `project_id` (Finago
  value, unique), `name`, `series` (name with the year token removed,
  normalised), `year` (int, nullable; parse `2026`, `17` → 2017, `oktober2026`,
  `mars 2026`), `active`, `synced_at`.
- New table `finago_project_usage`: `project_id`, `department_id`,
  `line_count`, `first_line_date`, `last_line_date`, `synced_at`, built from
  `/transactionlines?includeDimensions=true` over the last 24 months on
  accounts 6000–7999 plus any account an active expense type maps to (adds e.g.
  5900) *(my call: keeps the 5000-series payroll lines, and so payroll projects,
  out)*. Department-level totals (lines with/without a project) in
  the same sync, to give each department a **project share**.
- Runs nightly from a cron route (`CRON_SECRET`, like `post-pending`) and on
  demand from admin (Expenses → Settings, next to "Sync accounts from Finago").
  Incremental after the first run (`modifiedFrom`) is left to the builder.
- Projects that disappear from the active list are marked inactive, never
  deleted.

### Candidates and timing (what the agent gets)

For a department:
- **Candidates:** active projects with usage by this department in the last
  24 months, plus active projects in the same `series` with a higher `year`
  than any it used (e.g. `Wintergames 2028` once finance creates it). Year-less
  projects the department used count. Everything else is excluded.
- **Project share:** ≥ 80 % of the department's cost lines carry a project →
  *expected*; 20–80 % → *sometimes*; below → *rare*. *(my call; thresholds are
  constants to tune.)*
- **Timing per series:** for each year, the booking window (first/last line
  date), the takeover date (first line of the next year), the amounts per month,
  and an **estimated event date**. Order of sources *(my call)*:
  1. an event date finance set on the project in admin (optional field
     `event_date` on `finago_projects`, editable in Expenses → Settings);
  2. a website event matching the series and department (from `events`,
     published, not cancelled);
  3. the busiest 14-day stretch of that edition's bookings by amount (finance
     keeps booking late invoices for months after an event, so the window's end
     and the takeover date are not the event date).
  The usage sync therefore also stores amount per project per month.
- **The year rule in the prompt:** a receipt belongs to the next edition not yet
  held on its date; but costs shortly after an edition that clearly belong to it
  (afterparty, thank-you gifts, travel home, event-day invoices; occasion or
  receipt naming that edition) go on the edition that just finished. When
  neither the date nor the content settles it, `project_unsure`.
- **Missing next year:** if the timing says the receipt belongs to year N+1 and
  no active `series N+1` project exists, report that explicitly so the agent
  flags it instead of picking year N.

### Storage, editing, booking

- **Per receipt** *(my call: usually all receipts share one project, but an
  expense can mix, e.g. Drift BISO)*: new `expense_attachments` columns
  `project_id`, `project_name` (snapshot), `project_source` (`ai_check`,
  `approver`, `admin`), `project_confidence`.
- **Students never see projects** (like accounts); `studentView` strips them.
- **Admin receipt editor** gets a project field: candidates first, all active
  projects searchable, "none". An "apply to all receipts" shortcut. Changes are
  logged in `expense_events` like account changes.
- **Teams card, email and admin page** show each receipt's project (once per
  expense when all receipts share it) and the project flags.
- **Booking:** the receipt's debit line(s) and its 2400 line carry dimension
  type 1 = `project_id`, alongside department/campus/customer. Dimensions become
  per line: `buildExpenseDimensions` per receipt. 2400 lines are grouped by
  date **and** project (balance per date still holds).
- **Not blocking:** a missing project on an *expected* department is a flag, not
  an approval block *(my call: finance can still book without, as today)*.

## Part D — The background check (agent with tools)

### When it runs

1. Student presses Submit. The route does what needs no AI: auth, draft save,
   required fields and the occasion rule, the exactly-once claim, status
   `pending`. It returns at once with the same response shape.
2. In `after()`: the agent runs (below), its validated results are saved, then
   approvers are notified (chain step 1) — or, with direct booking off, the
   email to accounting is sent.
3. If the agent errors or passes its deadline: run today's fixed enrichment
   (`enrichSubmission` steps) for whatever is unsettled, add an
   `ai_check_incomplete` flag, and notify anyway.
4. A cron route (every few minutes) picks up expenses whose check is still
   `queued`/`running` after a stale window (~5 min), takes a claim, and runs the
   check or the fallback, then notifies. Notification must happen exactly once.

**Runtime limit.** Every Appwrite site (api included) has a 30 s timeout today;
the owner raises it in the console (300 s for the api). Whether work in `after()`
keeps running after the response on the self-hosted Appwrite runtime is not
documented, so Stage 4 **starts with a probe**: a deployed route whose `after()`
work writes timestamps for ~3 minutes. If it survives, keep `after()`. If not,
the same `runExpenseCheck(expenseId)` runs in an Appwrite Function executed
asynchronously (up to 15 min), triggered by submit and by the backstop. Keep the
check behind that one entry point so the runner can be swapped. Note the 30 s
limit also applies today to routes that declare `maxDuration = 300` (ocr,
submit, retry-booking, post-pending); booking after approval runs in `after()`
of the decision routes.

State: new `expense` columns `check_state` (`queued`, `running`, `done`,
`fallback`), `check_claim` (atomic lock like `posting_lock`),
`check_started_at`, `check_finished_at`. The expense `status` enum is unchanged
(the app parses it). The admin list shows "Checking" while the state is
`queued`/`running`.

Today approver resolution (`resolveExpenseApprovers`, possibly an 8 s M365/AI
lookup) and chain creation also run inside the request. Moving them into the
background too is welcome; the double-submit guard (the chain's unique
`(expense_id, step)` index today) must stay intact — the builder chooses the
claim.

### What the agent sees up front

The expense: campus, department (id, name, project share), occasion, accepted
event, and each receipt: id, date, amount, currency, extracted vendor /
description / purchase context, receipt issues, duplicate flags, the student's
type or own text, the AI's upload pick + confidence, `type_source`. The active
expense types (slug, name, note, account). No name, email, phone or bank account.

### Tools (all read-only)

| Tool | Returns |
|---|---|
| `search_past_bookings` (text, vendor?, department?, type?) | Examples (Part B) with type, own text + account, project, source, confirmed. |
| `list_projects` (department) | Candidates, project share, timing per series, website event dates, "next year missing" notes. |
| `find_events` (department?, from, to, text?) | Website events (name, date, department). |
| `search_accounts` (text) | Active cost accounts 4000–7999 (number, name). |
| `view_receipt` (receiptId) | The receipt file for the model, shrunk as in `fitFileForModel`. Capped at a few calls per run. |

The run ends with one structured answer (a `finish_check` tool or output
schema): per receipt `{ type, accountNumber (own text only), project | none,
confidence per field, reason }`, plus flags `{ receiptId?, code, note }`.

### Rules the code enforces on the answer

- Type must be an active type; account must be an active cost account in range;
  project must be in that department's candidate list and active. Anything else
  is dropped and flagged.
- **Student's explicit choice is kept.** When the agent disagrees with a type the
  student chose, it does not change it; it adds a flag ("AI check thinks Food
  during meetings") for the approver. It may change types that came from the
  AI's upload pick or a default, and records that in the history.
- Own text → the agent's account, `account_source = ai_freeform`, as today.
- Confidence below 0.8 on any field → flag (`type_unsure`, `account_unsure`,
  `project_unsure`). Project expected but none fits → `project_missing`; next
  year not created → `project_not_created` with the series name.
- Every change and flag goes to `expense_events` (actor: AI check) and the
  approver hints, so the Teams card, email and admin show them.

### Limits *(my call)*

- Model: `balancedModel` (Claude Sonnet 5.5), per the repo's model policy for
  tool loops, with reasoning `medium`; switch to a stronger model only if the
  eval shows misses. Stay on the Vercel AI SDK like the rest of the repo.
- At most ~12 steps; overall deadline 120 s; per-tool timeouts; a `view_receipt`
  cap of 3. Log steps and token use per run for cost tracking.

### The email path (direct booking off)

`submitByEmail` runs after the check. The PDF cover and the accounting email list
per receipt: date, description, amount, type name or own text, account, project;
plus the occasion, the event, and the flags. Accounting acts on the flags when
it books by hand in Finago, or edits the expense in admin *(my call)*.

## Data model changes (summary)

- New: `finago_projects`, `finago_project_usage`.
- `expense`: `check_state`, `check_claim`, `check_started_at`,
  `check_finished_at`.
- `expense_attachments`: `project_id`, `project_name`, `project_source`,
  `project_confidence`; `type_source` gains `default`.
- `expense_type_examples`: `confirmed`, `link_key` (one-way), `department_id`,
  `project_id`, `project_name`, separate type/account sources.
- Hint codes: `project_unsure`, `project_missing`, `project_not_created`,
  `ai_check_incomplete`, `ai_check_disagrees`.
- Edit `packages/api/appwrite.config.json` and the generated types; the owner
  pushes the schema **before** the api deploy.

## Stages

1. **Fixes** — Part A. Independent; can ship first.
2. **Learning** — Part B (needs the examples columns).
3. **Projects** — Part C sync, tables, candidates/timing, admin field, booking
   dimension, card/email/admin display. Approvers can set projects by hand from
   here on.
4. **Background check** — Part D: check state, `after()` run, tools, validation,
   fallback, cron backstop, deferred notifications, email content, admin
   "Checking" state. Projects are picked by the agent from here on.

The Flutter app should need no change (response shape and statuses unchanged);
the builder verifies against `BISO-Flutter` `lib/data/models/expense_v2_models.dart`.

**Testing against Finago.** Local `.env.local` points at the DEMO company
(REST org 628779637070457). Production (266330540180206) may be read, never
written: override `TFSO_REST_ORG_ID` on the command line for read-only pulls
(project list, booking history) to build fixtures and check the year logic.
Write tests (a booking with a project on debit and 2400 lines) go to DEMO via
`apps/api/scripts/post-expense-to-demo.ts`. DEMO has no projects: create a few
(e.g. `Wintergames 2027`, `KD 2026`) through the SOAP project service if it
allows it, otherwise ask the owner to add them in the Finago UI. Never let a
DEMO SOAP session be stored in the shared `24so.auth_tokens` table (prod SOAP
calls would go to DEMO for up to 23 h).

## Left to the builder

- Search method for examples (keywords, prefixes, Appwrite full-text index).
- How chain creation/approver resolution is split between request and
  background, within the exactly-once constraint.
- Incremental project sync, and the exact year/series parser.
- Prompt wording, tool descriptions, step/timeout constants.
- Where the "apply to all receipts" project shortcut sits in the admin UI.

## Docs

Update the guide pages whose `covers` match the changed code (expenses for
approvers/finance, the AI settings tab, the student reimbursement guide), and
the developer pages for the expense flow. Mention: projects are read from
Finago; finance must create next year's project before receipts for it can be
booked on it; the check runs after Submit and approvers are notified when it
finishes.

## Owner actions before go-live

- Raise the Appwrite site timeouts in the console (api to 300 s) before the
  Stage 4 probe; if the console caps it, raise the server's limit in the
  Appwrite env.
- Push the schema (new tables/columns) before deploying api.
- Add the two cron jobs (check backstop, nightly project sync) with `CRON_SECRET`.
- Run the first project sync from admin and look at a few departments'
  candidates.
- Check the api deployment has `TFSO_CAMPUS_DIMENSION_TYPE=101` (it is commented
  out in `.env.example`; without it the campus dimension is skipped).
- Keep creating next year's projects in Finago as today.
