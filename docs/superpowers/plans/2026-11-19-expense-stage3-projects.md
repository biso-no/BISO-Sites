# Expense Stage 3 — Finago Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Book receipts on the right Finago project (dimension 1) and year, from Finago's live project list and booking history, with approvers able to set it by hand (spec Part C). The AI picks projects in Stage 4.

**Architecture:** A nightly/on-demand sync reads Finago projects and two years of cost-account lines into `finago_projects`, `finago_project_usage` and `departments.project_share`. Pure functions in `packages/shared/utils/finago-projects.ts` parse names (series + year), aggregate usage, list a department's candidates and work out which edition a receipt date belongs to. Receipts store their project; booking puts it on the debit line and the 2400 line.

**Tech Stack:** Bun monorepo, Appwrite (`@repo/api`), Finago REST via `packages/connectors/src/24sevenoffice/rest` (openapi-fetch), vitest (api, shared, web), `bun test` (admin, connectors).

**Spec:** `docs/superpowers/specs/2026-11-17-expense-agent-and-projects-design.md` (Part C; "What Finago shows" has the real data).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-agent`. Never use `git stash`. Never push or deploy. Never write to production Finago or production Appwrite data. Reading production Finago is allowed (override `TFSO_REST_ORG_ID=266330540180206` on the command line; local `.env.local` points at DEMO 628779637070457). Write tests go to DEMO only.
- Bun only. Ultracite before each commit; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Schema edits in `packages/api/appwrite.config.json` mirror existing entries exactly; hand-mirror `packages/api/types/appwrite.ts` in the generator's style (`T | null`, no `?`); update `packages/api/appwrite-config.test.ts`. New tables are server-only (`read("team:sg-app-dept-operationsunit")`, like `expense_type_examples`).
- Nothing about projects is hard-coded: no project, series or department lists in code.
- Students never see projects (strip them in the api's `studentView` like accounts). Submit/draft response shapes and expense statuses stay unchanged (Flutter).
- Finago is never posted twice; a booking's lines must balance per date.
- Projects that leave Finago's active list are marked inactive, never deleted.
- Test commands: api `cd apps/api && NODE_ENV=test bun x vitest run <file>`; shared `cd packages/shared && bun x vitest run <file>`; connectors `cd packages/connectors && bun test <file>`; web `cd apps/web && bun x vitest run <file>`; admin `cd apps/admin && bun test <file>` (known failure: content-translation.test.ts); `bun run build --filter=admin` after a "use server" edit.

## Review Focus

1. **Wintergames 2027 does not exist yet and a receipt from November 2026 is clearly for it** → the timing result says the next edition is missing (`missing: { series: "wintergames", year: 2027 }`), never suggests 2026. Task 3 test `reports a missing next edition instead of last year's`.
2. **Two receipts on the same date with different projects** → two 2400 lines for that date (one per project), the day still balances. Task 7 test `splits the payout line by project on one date`.
3. **A project renamed in Finago (Vinterlekene 2026 → Wintergames 2026)** → names always come from the element list; usage keeps the project id. Task 4 test `keeps the element name when lines carry an old name`.
4. **A department that never used projects** → no candidates, share `rare`, editor shows all active projects only on search. Task 3 test `a department without history has no candidates`.
5. **Sync runs against a Finago page error mid-way** → nothing is marked inactive from a partial list. Task 4 test `a failed project fetch marks nothing inactive`.

---

### Task 1: Schema for projects

**Files:** Modify `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts`, `packages/api/appwrite-config.test.ts`, `apps/docs/content/docs/developers/change-it/data-model.mdx`.

**Interfaces — Produces:**
- Table `finago_projects`: `project_id` string(20) required (unique index), `name` string(255) required, `series` string(255) (key index), `year` integer nullable, `active` boolean default true, `event_date` datetime nullable (finance sets it), `peak_date` datetime nullable, `first_line_date` datetime nullable, `last_line_date` datetime nullable, `line_count` integer default 0, `synced_at` datetime nullable.
- Table `finago_project_usage`: `project_id` string(20) required, `department_id` string(40) required, `line_count` integer default 0, `first_line_date` datetime nullable, `last_line_date` datetime nullable, `synced_at` datetime nullable; unique index (`project_id`, `department_id`); key index `department_id`.
- `departments`: `project_share` double nullable (0–1).
- `expense_attachments`: `project_id` string(20) nullable, `project_name` string(255) nullable, `project_source` enum `["ai_check","approver","admin"]` nullable, `project_confidence` double nullable.
- `expense_type_examples`: `project_id` string(20) nullable, `project_name` string(255) nullable.
- Types: `FinagoProjects`, `FinagoProjectUsage`, enum `ExpenseAttachmentsProjectSource`, new fields on `Departments`, `ExpenseAttachments`, `ExpenseTypeExamples`.

- [ ] **Step 1: Failing config tests** for both new tables (columns, indexes, server-only permissions) and the new columns.
- [ ] **Step 2: Run** — FAIL. **Step 3: Edit** config + types. **Step 4: Run** config test + root `bun run check-types` — PASS (fix fixtures that build full rows).
- [ ] **Step 5: Commit** `feat(schema): finago projects, usage and receipt projects`.

### Task 2: Finago connector — projects and cost lines

**Files:**
- Modify: `packages/connectors/src/24sevenoffice/rest/departments.ts` (generalise paging; drop the `console.log("Response:", …)`), `packages/connectors/src/24sevenoffice/rest/index.ts` (exports)
- Create: `packages/connectors/src/24sevenoffice/rest/projects.ts`, `projects.test.ts`, `cost-lines.ts`, `cost-lines.test.ts`

**Interfaces — Produces:**
- `listDimensionElements(dimensionType: number): Promise<DimensionElement[]>` (all pages via the Link `continuationToken`); `getDepartments()` uses it.
- `export const PROJECT_DIMENSION_TYPE = 1`; `getProjects(): Promise<{ projectId: string; name: string }[]>`.
- `listCostLines(input: { accountNumbers: number[]; from: string; to: string; signal?: AbortSignal }): Promise<CostLine[]>` where `CostLine = { accountNumber: number; amount: number; date: string; departmentId: string | null; projectId: string | null }` — one `/transactionlines` query per account (`includeDimensions=true`, `limit=1000`, follow the Link `next`), project = dimension 1, department = dimension 2.

- [ ] **Step 1: Failing tests** (mock `finago.GET`): `follows the continuation token across pages`; `maps project and department dimensions`; `a line without a project has projectId null`; `queries each account separately`.
- [ ] **Step 2–4:** RED → implement → GREEN (`cd packages/connectors && bun test src/24sevenoffice`).
- [ ] **Step 5: Commit** `feat(connectors): read Finago projects and cost lines with their dimensions`.

### Task 3: Project names, usage and the year rule (pure)

**Files:** Create `packages/shared/utils/finago-projects.ts`, `packages/shared/utils/finago-projects.test.ts`.

**Interfaces — Produces:**
- `parseProjectName(name: string): { series: string; year: number | null }` — lowercased, whitespace-collapsed series with the year token and Norwegian/English month words removed. Year: a 4-digit `19xx`/`20xx` anywhere (also glued to a month: `oktober2026`); else a final 2-digit token when the name has ≥ 2 words (`Fadderullan 17` → 2017, `Ball 18` → 2018); else null.
  Pinned: `KD 2026` → `{kd, 2026}`; `Wintergames 2027` → `{wintergames, 2027}`; `Landsmøte mars 2026` → `{landsmøte, 2026}`; `Academics samling oktober2026` → `{academics samling, 2026}`; `Fadderullan 17` → `{fadderullan, 2017}`; `24Sevenoffice` → `{24sevenoffice, null}`; `BISO-Lunsj` → `{biso-lunsj, null}`.
- `aggregateUsage(lines: CostLine[]): { projects: Map<string, ProjectStats>; usage: Map<string /* project|department */, UsageStats>; departmentShare: Map<string, { total: number; withProject: number }> }`, where `ProjectStats = { lineCount; firstLineDate; lastLineDate; peakDate }` and `peakDate` is the middle day of the 14-day window with the largest sum of absolute amounts.
- `shareClass(share: number | null): "expected" | "sometimes" | "rare"` — ≥ 0.8 expected, ≥ 0.2 sometimes, else rare (null → rare).
- `departmentCandidates(input: { departmentId: string; projects: FinagoProjects[]; usage: FinagoProjectUsage[]; today: string }): FinagoProjects[]` — active projects this department used with `last_line_date` within 24 months of `today`, plus active projects whose `series` matches one of those and whose `year` is higher than any used; never inactive ones.
- `editionTiming(input: { series: string; editions: FinagoProjects[]; websiteEventDates?: Map<string /* projectId */, string>; receiptDate: string }): { editions: { projectId; name; year; eventDate: string | null; eventDateSource: "finance" | "website" | "bookings" | null }[]; suggested: string | null /* projectId */; recentlyHeld: string | null; missing: { series: string; year: number } | null }` — event date per edition: `event_date` (finance) > website event > a bookings estimate. The bookings estimate is NOT the edition's own `peak_date` (a future edition's peak is preparation spending): it is the series' usual day of the year — the median day-of-year of the `peak_date`s of the series' editions whose year is lower than the newest year in the series (fall back to all editions' peaks when only one exists) — placed in the edition's own `year` (project years name the calendar year of the event: `Wintergames 2027` is held in early 2027). Editions without a year get no event date. `suggested` = the edition with the earliest event date on or after `receiptDate`. `recentlyHeld` = an edition whose event date is within 30 days before `receiptDate` (after-event costs). If every known edition's event date is before `receiptDate` and the series has years, `missing` = latest year + 1 and `suggested` null.

- [ ] **Step 1: Failing tests:** the parse table above; `the busiest two weeks set the peak date`; `department share counts lines with and without a project`; `a department without history has no candidates`; `a newer year of a used series is a candidate before it has lines`; `inactive projects are never candidates`; `a BBL receipt in September after a summer race suggests next year` (BBL 2025 peak 2025-06-10, BBL 2026 peak 2026-06-15, BBL 2027 exists with a preparation peak 2026-09-15 → BBL 2027's estimated event date is mid-June 2027, suggested BBL 2027, recentlyHeld null for receipt 2026-09-20); `a future edition's own preparation peak is not its event date`; `a receipt a week after the event is recently held`; `reports a missing next edition instead of last year's` (Wintergames 2026 peak 2026-02-10, receipt 2026-11-05, no 2027 → missing 2027, suggested null); `finance's event date wins over the website and the bookings`.
- [ ] **Step 2–4:** RED → implement → GREEN.
- [ ] **Step 5: Commit** `feat(expenses): project names, usage and which edition a receipt belongs to`.

### Task 4: Sync from Finago (shared) and the nightly route (api)

**Files:**
- Create: `packages/shared/utils/finago-project-sync.ts` + test
- Create: `apps/api/src/app/api/cron/sync-finago-projects/route.ts` + `route.test.ts` (mirror `apps/api/src/app/api/cron/cleanup-member-pass/route.ts`: `CRON_SECRET`, `maxDuration = 300`)

**Interfaces — Produces:** `syncFinagoProjects(db, deps: { getProjects; listCostLines; now: Date; budgetMs?: number }): Promise<{ projects: number; inactive: number; usageRows: number; departments: number; partial: boolean }>`.
- Accounts: 6000–7999 from `ledger_accounts` (active) plus every account an active `expense_cost_types` row maps to; window = 24 months before `now`.
- Upsert `finago_projects` by `project_id` (name from the element list; series/year via `parseProjectName`; stats from `aggregateUsage`); mark rows missing from a successful element list inactive; upsert `finago_project_usage`; write `departments.project_share` for departments with lines.
- If `getProjects` fails → throw (nothing written). If the line fetch runs out of `budgetMs` (default 240 000) → write projects and stats gathered so far, skip inactive-marking and share updates, return `partial: true`.

- [ ] **Step 1: Failing tests:** `upserts projects with series and year`; `keeps the element name when lines carry an old name`; `a failed project fetch marks nothing inactive` (throws, no writes); `marks a project inactive when it leaves the list`; `writes each department's project share`; `a partial run marks nothing inactive`; route: `refuses without the cron secret`, `runs the sync and reports counts`.
- [ ] **Step 2–4:** RED → implement → GREEN.
- [ ] **Step 5: Commit** `feat(expenses): sync Finago projects and their history nightly`.

### Task 5: Admin — Projects settings tab

**Files:** Create `apps/admin/src/app/(portal)/expenses/settings/projects/page.tsx`, `_components/projects-client.tsx`, `actions.ts`; modify `apps/admin/src/app/(portal)/expenses/settings/_components/expenses-settings-tabs.tsx`, `packages/i18n/messages/{en,no}/adminPortal.json`.

**Interfaces — Produces:** server actions `syncProjectsFromFinago(): Promise<ExpenseActionResult<SyncSummary>>` (global admins; calls `syncFinagoProjects` with the connector functions) and `setProjectEventDate(projectId: string, date: string | null): Promise<ExpenseActionResult<null>>` (global admins; writes `event_date`, logs an audit event).

The tab lists active projects grouped by series (name, year, departments that used it, first/last booking, peak date, event date with an edit control), a "Sync projects from Finago" button with the last sync time, and a filter by department. Plain language; Norwegian and English strings.

- [ ] **Step 1: Failing tests:** `only global admins can sync projects`; `only global admins can set an event date`; `an event date is stored and audited`; `the page groups projects by series`.
- [ ] **Step 2–4:** RED → implement → GREEN, `bun run build --filter=admin`.
- [ ] **Step 5: Commit** `feat(admin): see Finago projects and set event dates`.

### Task 6: Admin receipt editor — set a project

**Files:** Modify `apps/admin/src/app/(portal)/expenses/[expenseId]/receipt-edit.ts` (`ReceiptChanges.projectId?: string | null`), `actions.ts`, `edit-options.ts` (project options: department candidates first, then all active), `_components/receipt-editor.tsx`, `_components/expense-receipts.tsx` (show the project), i18n files.

**Interfaces — Produces:** `planReceiptEdit` accepts `projectId` (null clears; must be an active project or `invalid_project`) and sets `project_id`, `project_name`, `project_source` approver/admin, `project_confidence: null`, with an `edited` event `field: "project"`. New action `applyProjectToAllReceipts(expenseId: string, projectId: string | null)` (same permissions as a receipt edit; one event per changed receipt). Each changed receipt re-syncs its example (Task 8 adds the project to examples).

- [ ] **Step 1: Failing tests:** `sets a project and records who chose it`; `refuses an inactive project`; `clearing the project logs before and after`; `apply to all sets every receipt with an amount`; `options list the department's candidates first`.
- [ ] **Step 2–4:** RED → implement → GREEN, admin build.
- [ ] **Step 5: Commit** `feat(admin): approvers set the Finago project on receipts`.

### Task 7: Book the project

**Files:** Modify `packages/connectors/src/24sevenoffice/rest/transactions.ts` (`ExpenseReceiptLine.projectId?: string | null`; per-line dimensions), `apps/api/src/lib/expense-posting.ts` (`buildReceiptLines` passes `att.project_id`), tests `transactions.test.ts`, `expense-posting-dates.test.ts`; `apps/api/scripts/post-expense-to-demo.ts` only if it builds lines itself.

Each debit line carries the base dimensions (department, campus) plus `{ dimensionType: PROJECT_DIMENSION_TYPE, value: projectId }` when set. 2400 credit lines are grouped by (date, projectId), each with the base dimensions, the customer dimension and the project when set; amounts still sum to zero per date.

- [ ] **Step 1: Failing tests:** `a receipt's project goes on its cost line`; `the payout line carries the project`; `splits the payout line by project on one date`; `receipts without a project book as before`; posting: `booking passes each receipt's project`.
- [ ] **Step 2–4:** RED → implement → GREEN (connectors + api suites).
- [ ] **Step 5: Commit** `feat(expenses): book receipts on their Finago project`.

### Task 8: Show the project and learn it

**Files:** Modify `apps/api/src/lib/expense-card-details.ts` (receipt rows gain `projectName`; shown once when all receipts share it), the Teams card builder in `packages/connectors/src/teams-bot/cards.ts`, the email HTML builder, the web approval page `apps/web/src/app/(public)/fs/approve/[token]/approval-client.tsx`, the api `studentView` (strip project fields), `packages/shared/utils/expense-examples.ts` (`exampleFields` stores `project_id`/`project_name`).

Also (carried from the Stage 2 final review, ledger ruling): an AI pick nobody saw at upload — `type_source` null with `cost_type === ai_cost_type` and `ai_confidence ≥ AI_TYPE_CONFIDENCE_THRESHOLD` — teaches once the example is **confirmed** (booked after an approver saw it), like a booked old-app replacement. A server default (no confident AI agreement) never teaches, confirmed or not. Change `typeTeaches`/`exampleTeaches` in `packages/shared/utils/expense-examples.ts` accordingly.

- [ ] **Step 1: Failing tests:** `the card shows one project when every receipt shares it`; `the card shows each receipt's project when they differ`; `the student never sees the project`; `an example keeps the receipt's project`; `an unseen AI pick teaches once booked`; `an unseen AI pick does not teach before booking`; `a server default never teaches, even when booked`.
- [ ] **Step 2–4:** RED → implement → GREEN.
- [ ] **Step 5: Commit** `feat(expenses): approvers see the project and examples remember it`.

### Task 9: Docs and verification

**Files:** `apps/docs/content/docs/guide/access-and-settings/expenses-admin.mdx` (setting a project), a projects section on the expense settings page (`expense-types.mdx` or a new `expense-projects.mdx` with `covers` for the new files), `apps/docs/content/docs/developers/reference/accounting.mdx` (project dimension on debit and 2400 lines, sync, tables), `apps/docs/content/docs/developers/keep-it-running/scheduled-jobs.mdx` (the nightly sync route — the owner adds it to the scheduled dispatcher).

- [ ] **Step 1:** Update the pages. **Step 2:** Run all suites, root check-types, admin and docs builds. **Step 3: Commit** `docs(expenses): Finago projects`.
