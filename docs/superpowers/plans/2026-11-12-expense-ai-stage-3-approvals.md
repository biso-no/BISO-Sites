# Approval Rules and Approver Directory — Stage 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every reimbursement to the right approvers under the owner's rules (including a controller's own expense going to the campus president), and find each approver once — from a saved directory, by AI from real Microsoft 365 mailboxes when missing — confirming the entry when that person actually approves.

**Architecture:** The pure rule table in `packages/shared/utils/expense-approvers.ts` decides which roles approve and which switch a department shows. `apps/api/src/lib/expense-approver-directory.ts` stores approvers in a new `expense_approvers` table keyed by department/campus + role. `apps/api/src/lib/expense-approver-lookup.ts` asks the AI to pick one of the real Graph candidates when the directory has no entry. `resolveExpenseApprovers` combines them, `createApprovalChain` records which directory key each step used, and `decideApproval` confirms that key on approval. The web form gets the "I'm the campus controller" switch.

**Tech Stack:** TypeScript, Vitest (apps/api, apps/web, packages/shared, packages/api), AI SDK `generateObject` with `@repo/ai/models` `fastModel`, Microsoft Graph via `GraphUserService` (`@repo/connectors/azure/users`), Appwrite via `@repo/api/server`.

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md` — Stage 3 ("Rules", "Approver directory"), plus the Stage 4 access rule that an expense with `submitter_is_controller` is closed to that campus's controller role (enforced here by never routing it to the controller). Earlier rulings: `.superpowers/expense-ai-rulings-stage1.md`, `-stage2a.md`, `-stage2b.md` (git-ignored, in the worktree).

## Global Constraints

- Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never `cd` to the main checkout. Never push. Bun only. Never stage uncommitted `apps/web` changes you didn't make.
- Never write to production Appwrite, never call live Microsoft Graph or the real Anthropic API in tests (mock `GraphUserService`, `ai`, `@repo/ai/models`).
- `packages/api/types/appwrite.ts` is regenerated with the CLI from the local config, keeping only this task's hunks (procedure in the Stage 2a plan, Global Constraints).
- Verified facts (2026-11-12): `departments.$id === departments.Id` (the Finago value) for all 280 rows; `departments.abbreviation` is empty everywhere. Campus ids: Oslo `1`, Bergen `2`, Trondheim `3`, Stavanger `4`, National `5`. Drift/Ledelsen departments: Oslo `1`/`2`, Bergen `300`/`301`, Trondheim `600`/`601`, Stavanger `800`/`801`.
- Mailbox facts (2026-11-11 survey): role mailboxes are mostly `finance.<x>.<campus>@`, `manager.<x>.<campus>@`, `deputy.<x>.<campus>@`, with variants `financial.`, `Finance.`, `deputymanager.`, Norwegian `leder.`/`nestleder.` (Stavanger); Trondheim mailboxes use `.trd`; presidents exist as `president.oslo@`, `president.bergen@`, `president.<x>.trd@`; controllers are `controller.oslo@`, `controller.bergen@`, `controller.trondheim@`, `controller.stavanger@`; national is `manager@biso.no`.
- AI approver choice: the answer must be one of the candidate emails (checked in code); confidence ≥ **0.8** to use it.
- Never route an expense to the person who submitted it as approver: with the controller switch on, the controller is never a step.
- Before each commit: `bun x ultracite fix <changed files>`. Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Type checks: `bun run check-types --filter=<pkg>`.

## Review Focus

- A controller's own expense (switch on, Drift/Ledelsen department) must never include a controller step — even if the president can't be found. → Task 2 `routes a controller's own expense to the president only`; Task 4 `falls back to the national approver when no president is found`.
- A switch sent for a department where it doesn't apply is ignored server-side (e.g. the FM switch on Ledelsen Oslo, the controller switch on an OSL department). → Task 2 `ignores a switch that does not apply`.
- The AI returning an email that is not among the Graph candidates must never become an approver. → Task 3 `rejects an email that is not a candidate`.
- A directory entry is confirmed only for the step's own approver email (a different person approving via a forwarded link doesn't confirm someone else's row). → Task 5 `confirms the directory entry only when the approver email matches`.
- Old submissions (no `submitter_is_controller` field, Flutter 2.2.x) keep today's routing. → Task 5 `treats a missing controller flag as false`.

---

### Task 1: Schema

**Files:** `packages/api/appwrite.config.json`, `packages/api/types/appwrite.ts` (regenerated), `packages/api/appwrite-config.test.ts`, `apps/docs/content/docs/developers/change-it/data-model.mdx`

**Produces:**
- `expense`: + `submitter_is_controller` (boolean, optional, default `false`).
- `expense_approvals`: `approver_role` enum gains `president`; + `directory_key` (string 120, optional).
- New table `expense_approvers` ("Expense Approvers"): `key` (string 120, required; unique index `idx_key`), `scope` (enum `department|campus`, required), `department_id` (string 64), `campus_id` (string 10, required), `role` (enum `finance|manager|deputy|controller|president|national`, required), `email` (string 320, required), `aad_id` (string 64), `display_name` (string 256), `source` (enum `seed|ai|admin|confirmed`, required), `confidence` (double), `confirmed_at` (datetime), `last_used_at` (datetime), `active` (boolean, default `true`). `$permissions: ["read(\"team:sg-app-dept-operationsunit\")"]`, `rowSecurity: false`, `databaseId: "app"`.

- [ ] **Step 1: Failing config tests** (one `describe("approver directory schema")`): the table exists with exactly that permission and a unique index on `key`; `expense_approvals.approver_role` elements include `president`; `expense_approvals` has `directory_key`; `expense` has `submitter_is_controller`.
- [ ] **Step 2: Run, see fail** — `cd packages/api && bun run test appwrite-config.test.ts`.
- [ ] **Step 3: Add** (mirror existing JSON shapes). **Step 4: Run** → PASS. **Step 5: Regenerate types** (keep only this task's hunks). **Step 6:** `bun run check-types --filter=@repo/api --filter=api --filter=web --filter=admin` → clean. **Step 7:** data-model.mdx Expenses row + `expense_approvers`.
- [ ] **Step 8: Commit** — `feat(api): approver directory table and controller submissions in the schema`.

---

### Task 2: Rule table and switches (shared)

**Files:** `packages/shared/utils/expense-approvers.ts` (+ `expense-approvers.test.ts`)

**Produces:**
- `export type ApprovalSwitch = "financial_manager" | "controller"`
- `export function approvalSwitchFor(campusId: string, departmentId: string | null | undefined): ApprovalSwitch | null` — Oslo (`1`) and department not `1`/`2` → `"financial_manager"`; department in `CAMPUS_LEADERSHIP_DEPARTMENTS` (`1`, `2`, `300`, `301`, `600`, `601`, `800`, `801`) → `"controller"`; otherwise `null`.
- `ApprovalPlanInput` gains `submitterIsController?: boolean`. `getCampusApprovalPlan` (same name) returns steps `{ kind: "department"; role: "finance" | "manager" }` or `{ kind: "directory"; role: "controller" | "president" | "national" }` per this table (a switch that `approvalSwitchFor` doesn't offer for the department is treated as off):

| Campus | Department | Switch off | Switch on |
|---|---|---|---|
| 1 | not 1/2 | department `finance` → `controller` | department `manager` → `controller` |
| 1 | 1 or 2 | `controller` | `president` |
| 2/3/4 | Drift/Ledelsen of that campus | `controller` | `president` |
| 2/3/4 | any other | `controller` | n/a |
| 5 | any | `national` | n/a |

- `export const DEFAULT_DIRECTORY_EMAILS: Record<string, Partial<Record<"controller" | "national", string>>>` — campus `1..4` → `controller.<oslo|bergen|trondheim|stavanger>@biso.no`; `5` → `national: manager@biso.no`. (No default for presidents.)
- `export const CAMPUS_MAILBOX_SLUGS: Record<string, string[]>` — `1: ["oslo"]`, `2: ["bergen"]`, `3: ["trondheim", "trd"]`, `4: ["stavanger"]`.
- `directoryKey(input: { scope: "department" | "campus"; campusId: string; departmentId?: string | null; role: ApproverRole }): string` — `dept:<departmentId>:<role>` or `campus:<campusId>:<role>`.
- `ApproverRole` gains `"president"`. Remove the now-unused `controllerEmail`/`EXPENSE_APPROVER_DOMAIN`-based fixed-email path from the plan (the defaults table replaces it); keep `pickApproverByRole`/`ROLE_EMAIL_PREFIXES` only if still used (Task 3 replaces them).

- [ ] **Step 1: Failing tests** — every row of the table (Oslo OSL off/on, Oslo 1 and 2 off/on, Bergen 301 off/on, Trondheim 600 on, Stavanger other dept, national), `ignores a switch that does not apply` (FM on dept 2; controller on dept 101; controller on Bergen dept 302), `routes a controller's own expense to the president only`, `approvalSwitchFor` cases, `directoryKey` formats.
- [ ] **Step 2: Run, see fail** — `cd packages/shared && bun run test utils/expense-approvers.test.ts`. **Step 3: Implement.** **Step 4: Run** → PASS; `bun run check-types --filter=@repo/shared --filter=api --filter=web`.
- [ ] **Step 5: Commit** — `feat(shared): approval rules with the controller switch and president routing`.

---

### Task 3: Approver directory and AI lookup (apps/api)

**Files:** Create `apps/api/src/lib/expense-approver-directory.ts`, `apps/api/src/lib/expense-approver-lookup.ts` (+ tests)

**Produces (`expense-approver-directory.ts`):**
- `interface DirectoryApprover { key: string; email: string; aadId: string | null; displayName: string | null; source: "seed" | "ai" | "admin" | "confirmed" }`
- `findDirectoryApprover(db, key): Promise<DirectoryApprover | null>` — active row with that `key`; any error → `null` (logged).
- `saveDirectoryApprover(db, row: { key; scope; campusId; departmentId?; role; email; aadId?; displayName?; source; confidence? }): Promise<void>` — create, or on a unique-key conflict update the existing row **only if its source is not `admin` or `confirmed`**; never throws.
- `touchDirectoryApprover(db, key): Promise<void>` — sets `last_used_at`; never throws.
- `confirmDirectoryApprover(db, key, email): Promise<void>` — if the active row's `email` equals `email` (case-insensitive), set `source: "confirmed"`, `confirmed_at: now`; never throws.

**Produces (`expense-approver-lookup.ts`):**
- `departmentMailboxHints(name: string): string[]` — pure: lowercase tokens from the department name for matching mailbox local parts: drop the campus prefix (`OSL `, `BER `, `TRD `, `STV `), take the part before ` - ` and the part after it, split on spaces/punctuation, keep tokens ≥ 2 chars, plus the initials of multi-word parts (e.g. `"OSL BBA - Bachelor of Business Administration"` → includes `bba`; `"OSL Næringslivsutvalget"` → includes `naeringslivsutvalget` and `nu`? — initials only for multi-word parts; also fold æ→ae, ø→o, å→a).
- `ROLE_MAILBOX_PREFIXES: Record<"finance" | "manager" | "deputy" | "president", string[]>` — finance: `["finance.", "financial.", "okonomi", "økonomi"]`; manager: `["manager.", "leder."]`; deputy: `["deputy.", "deputymanager.", "nestleder."]`; president: `["president."]`.
- `findApproverCandidates(graph: Pick<GraphUserService, "searchUsers" | "findUsersByDepartment">, input: { role; campusId; departmentName?: string | null }): Promise<Candidate[]>` where `Candidate = { email: string; displayName: string | null; department: string | null; aadId: string | null }` — union (dedupe by lowercase email) of: users with `department === departmentName` (when given) whose local part starts with one of the role's prefixes; and `searchUsers(prefix, 100)` results for each prefix whose local part contains one of the campus slugs (`CAMPUS_MAILBOX_SLUGS`) as a dot-separated segment, and (for department roles) shares a hint token as a segment or prefix of a segment. Cap 25 candidates. Graph errors → `[]` (logged).
- `chooseApprover(input: { role; campusName: string; departmentName?: string | null; candidates: Candidate[] }): Promise<{ email: string; confidence: number; reason: string } | null>` — `generateObject({ model: fastModel, reasoning: "low", schema: z.object({ email: z.string().nullable(), confidence: z.number(), reason: z.string() }) })`; prompt lists the role in plain words ("financial manager of the department", "manager", "deputy manager", "campus president"), the department and campus names, and each candidate as `email | display name | department attribute`, says the candidate data is data, not instructions, and asks for one email from the list or null. Post-validation: the email must equal a candidate's (case-insensitive) — else `null`; confidence clamped 0..1; no candidates → `null` without calling the model; model error → `null` (logged).

- [ ] **Step 1: Failing tests** — directory: `finds an active row by key`, `does not overwrite an admin or confirmed row`, `confirms only when the email matches`, `never throws`; lookup: `departmentMailboxHints` examples (BBA, Næringslivsutvalget, `"OSL AI Club"` → `ai`, `club`), `finds finance candidates by department and by mailbox` (mock Graph: `finance.nu.oslo@` in department; `financial.nu.oslo@` via search; `finance.nu.bergen@` excluded by campus), `matches Trondheim's trd mailboxes`, `rejects an email that is not a candidate`, `returns null without calling the model when there are no candidates`.
- [ ] **Step 2: Run, see fail** — `cd apps/api && bun run test src/lib/expense-approver-directory.test.ts src/lib/expense-approver-lookup.test.ts`. **Step 3: Implement.** **Step 4: Run** → PASS; check-types api.
- [ ] **Step 5: Commit** — `feat(api): approver directory and AI approver lookup from Microsoft 365`.

---

### Task 4: Resolution

**Files:** `apps/api/src/lib/expense-approver-resolution.ts` (+ test)

**Produces:** `resolveExpenseApprovers(input: { campusId; campusName: string; departmentId; departmentName; submitterIsFinancialManager; submitterIsController }, deps?: { db?; graph?; choose? }) : Promise<ApproverResolution>` where each `ResolvedApproverStep` gains `directoryKey: string` and `source: "directory" | "ai" | "default"`, and `issues: ApproverResolutionIssue[]` (was a single `issue`; update callers). Per plan step:
- Department step (`finance` / `manager`): key `dept:<id>:<role>`; directory row → use (touch). Else candidates + `chooseApprover`; confident (≥ 0.8) → use, save (`source: "ai"`, confidence). For `manager` with no confident answer, try `deputy` the same way (key `dept:<id>:deputy`). Still nothing → drop the step and add an issue (today's behaviour: the controller step that follows still approves).
- Directory step `controller` / `national`: directory row → use; else the default email from `DEFAULT_DIRECTORY_EMAILS`, saved with `source: "seed"`.
- Directory step `president`: directory row → use; else candidates (`president` prefixes, campus slugs) + `chooseApprover`; confident → use and save; else **fall back to the national approver** (`manager@biso.no`, directory key `campus:5:national`) and add an issue (`roleSought: "president"`). Never fall back to the controller.
- Steps are numbered 1..n after drops.

- [ ] **Step 1: Failing tests** (inject fakes) — `uses the directory before asking the AI`, `saves a confident AI answer to the directory`, `falls back from manager to deputy`, `drops the department step with an issue when nobody is found`, `seeds the controller default`, `routes a controller's own expense to the president`, `falls back to the national approver when no president is found` (and no controller step), `numbers steps after a drop`.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement** (existing `findUsersByDepartment` path is replaced by the lookup module). **Step 4: Run** → PASS; check-types api.
- [ ] **Step 5: Commit** — `feat(api): resolve approvers from the directory, AI lookup and defaults`.

---

### Task 5: Chain, decisions and submission wiring

**Files:** `apps/api/src/lib/expense-approval.ts` (+ tests), `apps/api/src/lib/expense-payload.ts` (+ test), `apps/api/src/app/api/expenses/submit/route.ts` (+ test), `apps/api/src/lib/expense-submission.ts` (history note)

**Produces:**
- Payload: optional `submitter_is_controller: boolean` (default false; absent → false); row input writes it. The server normalises both switches with `approvalSwitchFor(campus, department)` before storing and routing (a switch the department doesn't offer is stored as false).
- `ApprovalChainContext` gains `submitterIsController`, `campusName` already exists as `campusLabel` (pass it as `campusName` to resolution). `createApprovalChain` writes `directory_key` on each `expense_approvals` row and one `expense_events` row per step (`action: "approver_resolved"`, `actorKind: "system"`, `after` = approver email, `note` = `<role> via <source>`). Every resolution issue becomes an `expense_approval_issues` row (as today, now possibly several).
- `stepLabel` gains `president: "Campus president"`.
- `decideApproval`: on `approved`, `confirmDirectoryApprover(db, row.directory_key, row.approver_email)` when the row has a `directory_key` (best-effort; never changes the decision).
- `enrichSubmission`'s `submitted` event note records a declaration: "Submitter says they are the department's financial manager" / "… the campus controller" when the normalised switch is on.

- [ ] **Step 1: Failing tests** — `treats a missing controller flag as false`, `stores a switch the department does not offer as false`, `writes the directory key and an approver_resolved event per step`, `confirms the directory entry only when the approver email matches` (decision with a row whose email differs → no confirm), `labels the president step`.
- [ ] **Step 2: Run, see fail.** **Step 3: Implement.** **Step 4: Run** the apps/api suite → PASS; check-types api.
- [ ] **Step 5: Commit** — `feat(api): controller submissions, directory keys on approvals and confirmation on approve`.

---

### Task 6: The web switch

**Files:** `apps/web/src/components/expense-v3/expense-report.tsx`, `store.ts`, `expense-split-view.tsx`, `apps/web/src/lib/actions/expense.ts` (select), tests; `packages/i18n/messages/{en,no}/expenses.json`

**Produces:**
- Store: `submitterIsController: boolean` + setter; reset on department change together with `submitterIsFinancialManager` (both cleared whenever the department changes).
- The report shows exactly one switch card, chosen by `approvalSwitchFor(selectedCampusId, selectedDepartmentId)`: the existing financial-manager card, or a new card **"I'm the campus financial controller"** / **"Jeg er campusets controller"** with hint "Your campus president approves instead." / "Campuspresidenten godkjenner i stedet." Same native switch markup and accessibility as the existing card. Replace the hard-coded Oslo/Ledelsen check with `approvalSwitchFor`.
- Payload sends `submitter_is_controller`; draft hydration reads it (`getExpenseById` selects it).
- Tests (happy-dom where needed): `shows the controller switch on Ledelsen Bergen`, `shows the financial-manager switch on an OSL department and none on Bergen 302`, `clears both switches when the department changes`, `sends submitter_is_controller`.
- [ ] Steps: failing tests → implement → `cd apps/web && bun run test` (incl. styles/motion) → check-types web → commit `feat(web): the campus controller switch`.

---

### Task 7: Docs

**Files:** `apps/docs/content/docs/guide/access-and-settings/expense-approvals.mdx`, `apps/docs/content/docs/developers/reference/microsoft.mdx` (Teams approval bot / approver lookup section — find the section that covers `expense-approver-resolution.ts`), `apps/docs/content/docs/developers/reference/accounting.mdx` if it states routing rules; `covers` += the new lib files.

- [ ] Update the routing rules (the table above, in plain words), the controller switch, the directory (what it stores, how entries are found and confirmed, that admins will manage it in Stage 4's settings page — say only what exists now), the president fallback to the national approver, the issues list. Every claim checked against the code. `cd apps/docs && bun test`; check-types docs; commit `docs: approval rules, the controller switch and the approver directory`.

## Rulings made in this plan

- **R1** — When no president can be found for a controller's own expense, the national approver (manager@biso.no) approves, with an issue — never the controller (no self-approval).
- **R2** — Controller and national approvers come from the directory, seeded from the known default mailboxes on first use; presidents only via directory or AI.
- **R3** — Mailbox hints come from the department name (the `abbreviation` column is empty everywhere).
- **R4** — A directory entry is confirmed only when the approving decision is made on that entry's own step and the step's email equals the entry's email.
