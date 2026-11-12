# Admin Expenses Section — Stage 4a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give finance staff and approvers an admin Expenses section: a list with "Waiting on me" and "Needs attention", a detail page with receipts, steps and the full history, and the actions the spec allows. These are edit, approve or reject (also on behalf), change approver and retry booking. Each action is gated by who the viewer is.

**Architecture:** A pure permission function in `apps/admin/src/lib/expense-access.ts` decides what a viewer may do with one expense. Its inputs are the viewer (roles, campuses, Microsoft-verified emails, the campuses where they are the directory's controller) and the expense with its steps. Admin reads and edits Appwrite directly with the admin key after that check, and writes history through the shared `recordExpenseEvents`. Decisions, approver changes and booking retries go to new CRON_SECRET-gated `apps/api` routes. That way the chain logic stays in one place (`decideApproval`'s core, `notifyStep`, `postApprovedExpense`). A role mailbox gets into the portal through a new `expenseapprover` role, granted from an email match on approval or directory rows.

**Tech Stack:** Next.js 16 App Router (RSC + server actions), next-intl (`packages/i18n/messages/{en,no}/adminPortal.json`), Appwrite via `@repo/api/server`, Vitest (apps/api, packages/*), `bun test` (apps/admin), sonner toasts, STUDIO tokens from `(portal)/_components/studio`.

**Spec:** `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md`, Stage 4: "Navigation and pages", "Access", "Editing and approving in admin" and "History". Stage 4b (next plan) covers the Settings Approvers and AI tabs, the richer Teams card and email, the Teams card update after an admin decision, and the carried server fixes. Earlier rulings are in `.superpowers/expense-ai-rulings-stage{1,2a,2b,3}.md` (git-ignored, in the worktree).

## Global Constraints

- **Where to work:**
  - Work only in `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai` (branch `feat/expense-ai`). Never `cd` to the main checkout.
  - Never push. Use Bun only.
  - Never stage `apps/web` changes you didn't make.
- **No live services:**
  - Never write to production Appwrite.
  - Never call live Graph, Finago or the Anthropic API in tests.
- **Generated types:** `packages/api/types/appwrite.ts` is regenerated with the CLI from the local config. Keep only this task's hunks (the procedure is in the Stage 2a plan's Global Constraints).
- **Who is who:**
  - Campus ids: Oslo `1`, Bergen `2`, Trondheim `3`, Stavanger `4`, National `5`.
  - `expense.campus` holds the campus id. `expense.department` holds the Finago department id (`departments.$id === departments.Id`).
  - `expense.userId` is the submitter's Appwrite user id.
- **Email-based grants:**
  - The approver role, the per-expense approver grant and the campus-controller grant come **only** from the emails of the account's Microsoft identities (`provider === "microsoft"`, `providerEmail`), trimmed and lowercased.
  - Never use the bare account email for a grant. An email/password or anonymous session can claim any address (see `hasVerifiedBenefitEditorIdentity` in `apps/admin/src/lib/benefit-access.ts`).
- **Email storage:** from this stage on, every email written to `expense_approvals.approver_email` and `expense_approvers.email` is trimmed and lowercased. Comparisons lowercase both sides.
- **No self-approval:**
  - A viewer whose `userId` equals `expense.userId` may view the expense but never edit, decide, change the approver or retry booking.
  - With `submitter_is_controller = true`, the campus-controller grant gives no actions on that expense.
  - With `submitter_is_financial_manager = true`, a `finance` step's approver email gives no actions.
- **What can change when:**
  - Only the current step can be decided: the lowest-numbered `pending` step of an expense whose status is `pending`.
  - Nothing is editable once the expense is `approved` (waiting for posting) or `success` (booked).
  - Retry booking never reposts automatically. It needs an explicit click after a warning, and it refuses an expense whose `ledger_transaction_id` holds a real transaction id.
- **Admin to api:** calls go server-to-server only, `Bearer ${CRON_SECRET}` to `${NEXT_PUBLIC_API_BASE_URL}` (the existing resend pattern). Admin authorizes the viewer. The api route re-checks the expense and step state.
- **Copy:**
  - Every new admin string goes in both `en` and `no` `adminPortal.json`.
  - Plain words, no self-praise.
  - Students never see account numbers (unchanged; admin pages are staff-only).
- **Before each commit:**
  - Run `bun x ultracite fix <changed files>`.
  - Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Checks and tests:**
  - Type checks: `bun run check-types --filter=<pkg>`.
  - Admin tests: `cd apps/admin && bun test <path>`.
  - api tests: `cd apps/api && bun run test <file>`.
  - packages tests: `cd packages/<pkg> && bun run test <file>`.

## Review Focus

- **A role mailbox with no `sg-app-*` teams** signs in with Microsoft. It must reach `/expenses` and see only the expenses where its email is on a step. Every other portal page must stay closed: the dashboard redirects to `/expenses`, and other nav keys 404.
  - Task 3 tests: `grants the approver role from a Microsoft identity email`, `ignores the bare account email`, `approver role opens only the expenses nav`.
- **The campus controller opening their own expense** (`submitter_is_controller`) can view it but not edit, decide, change the approver or retry. The submitter (same `userId`) gets the same, even as a global admin.
  - Task 3 tests: `controller cannot act on a controller-submitted expense`, `a global admin who submitted cannot act`.
- **A stale admin page** (the approver already decided on Teams, or a later step's approver clicks early) must not record a second decision or skip a step.
  - Task 2 tests: `returns the existing outcome when the step is already decided`, `refuses a step that is not the current one`.
- **Email casing:** the approval row says `Finance.NU.Oslo@biso.no` and the Microsoft identity says `finance.nu.oslo@biso.no`. The approver must still match.
  - Task 3 test: `matches approver emails case-insensitively`.
- **Retry booking on an expense that already has a real transaction id**, or that isn't `failed`, is refused and leaves the row untouched.
  - Task 7 test: `refuses retry when a transaction id is stored`.

---

### Task 1: Schema, shared events writer and reference numbers

**Files:**
- `packages/api/appwrite.config.json`
- `packages/api/types/appwrite.ts` (regenerated)
- `packages/api/appwrite-config.test.ts`
- Move `apps/api/src/lib/expense-events.ts` (and its test) to `packages/shared/utils/expense-events.ts`, and update every api import.
- Move `apps/api/src/lib/reimbursement-number.ts` (and its test) to `packages/shared/utils/reimbursement-number.ts`, and update the imports. If `expense-approval.ts` or `expense-posting.ts` keep a private copy, replace it with the shared one.
- `apps/docs/content/docs/developers/change-it/data-model.mdx`

**Produces:**
- `expense_approvals`:
  - New column `decided_by_email` (string 320, optional).
  - New column `on_behalf` (boolean, optional, default `false`).
  - New key index `idx_approver_email` on `[approver_email]`.
- `expense`: key indexes `idx_campus` on `[campus]` and `idx_department` on `[department]`.
- `expense_approvers`: key indexes `idx_email` on `[email]` and `idx_campus_role` on `[campus_id, role]`.
- `expense_events.action` enum gains `booking_retried`.
- `@repo/shared/utils/expense-events`: the existing `recordExpenseEvents(db, events)`, `ExpenseEventInput`, `ExpenseEventsDb`, `ExpenseEventActorKind` and `ExpenseEventAction`, unchanged except that `ExpenseEventAction` gains `"booking_retried"`.
- `@repo/shared/utils/reimbursement-number`: the existing `reimbursementNumber(sequence)`.

Steps:
- [ ] **Step 1: Write failing config tests** in one `describe("admin expenses schema")`: the two `expense_approvals` columns and their index; the two `expense` indexes; the two `expense_approvers` indexes; `booking_retried` in the `expense_events.action` elements.
- [ ] **Step 2: Run them and see them fail:** `cd packages/api && bun run test appwrite-config.test.ts`.
- [ ] **Step 3: Add the schema**, mirroring the existing JSON shapes.
- [ ] **Step 4: Run the tests** → PASS.
- [ ] **Step 5: Regenerate the types**, keeping only this task's hunks.
- [ ] **Step 6: Do both moves with `git mv`**, update the imports, and run the moved tests from `packages/shared`.
- [ ] **Step 7: Type-check:** `bun run check-types --filter=@repo/api --filter=@repo/shared --filter=api --filter=admin --filter=web` → clean.
- [ ] **Step 8: Update docs:** add the new columns, indexes and the enum value to data-model.mdx.
- [ ] **Step 9: Commit:** `feat(schema): admin decisions on approvals, expense list indexes, shared history writer`.

---

### Task 2: Decisions by approval id, decision and notification history (apps/api)

**Files:**
- `apps/api/src/lib/expense-approval.ts` (+ test)
- `apps/api/src/lib/internal-auth.ts` (new, + test)
- `apps/api/src/app/api/expenses/admin/decide/route.ts` (new, + test)
- `apps/api/src/app/api/expenses/resend-approval/route.ts` (switch to the shared auth helper)

**Interfaces:**
- **Consumes:** `recordExpenseEvents` (`@repo/shared/utils/expense-events`).
- **Produces:**
  - `export interface ApprovalActor { email: string | null; kind: "approver" | "admin"; name: string }`
  - `export async function decideApprovalStep(params: { approvalId: string; decision: "approved" | "rejected"; actor: ApprovalActor; onBehalf: boolean; reason?: string }): Promise<DecisionResult>` (the existing `DecisionResult` type).
  - `export function isInternalRequest(request: Request): boolean` checks `Bearer <CRON_SECRET>` or `x-cron-secret` with `safeSecretCompare`, and returns false when `CRON_SECRET` is unset. Lift it from resend-approval.
  - Route `POST /api/expenses/admin/decide`:
    - Body (zod): `{ approvalId: string (1–64), decision: "approved" | "rejected", actor: { email: string email ≤320 | null, name: string 1–256, kind: "approver" | "admin" }, onBehalf: boolean, reason?: string ≤1000 }`.
    - A `rejected` decision needs a non-blank `reason`.
    - Responses: 401 when not internal, 400 on a bad body or an `ok: false` result, 200 `{ result }` otherwise.

**Rules:**
- **Shared core:** `decideApproval` (token) and `decideApprovalStep` (id) share one internal `decideStep(row, …)`. It keeps today's claim, release, reject, notify-next and finalize behaviour exactly.
- **What only the id path adds:**
  - It returns `{ ok: false, error: "This step is not waiting for a decision." }` unless the expense status is `pending` and the row is the lowest-numbered `pending` step. Check this before the claim.
  - It has no expiry check.
- **Already-decided rows:** on both paths they keep returning their existing outcome (today's `decidedResult` plus reconcile).
- **The step row write:**
  - The token path writes `decided_by` as today, `decided_by_email` = the row's `approver_email`, and `on_behalf: false`.
  - The id path writes `decided_by = actor.name`, `decided_by_email = actor.email?.toLowerCase() ?? null`, and `on_behalf`.
- **The history event:** both paths record one `approved` or `rejected` event, best-effort, after the step write succeeds.
  - `actorKind`: token path `"approver"`; id path `actor.kind`.
  - `actorEmail` and `actorName` as above.
  - `note`: join the non-empty parts with `" · "`, or use `null` when there are none:
    - `On behalf of <role noun>` when on behalf;
    - `Reason: <reason>` when there is a reason.
  - Role nouns:
    - finance → "the financial manager"
    - manager → "the department manager"
    - deputy → "the deputy manager"
    - controller → "the campus controller"
    - president → "the campus president"
    - national → "the national approver"
- **Directory confirmation:** `confirmDirectoryApprover` runs only when the decision is not on behalf. The token path is never on behalf.
- **Notifications:** `notifyStep` records a `notified` event after at least one channel delivered: `actorKind: "system"`, `after: row.approver_email`, `note: "teams,email"` or `"email"`. Best-effort.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `decides the current step by id and advances the chain`
  - `refuses a step that is not the current one` (step 2 pending while step 1 is pending)
  - `refuses when the expense is not pending`
  - `returns the existing outcome when the step is already decided`
  - `records an approved event with the on-behalf note and skips directory confirmation`
  - `records a rejected event with the reason`
  - `token decisions record the approver email and confirm the directory row`
  - `notifyStep records a notified event`
  - route tests: 401 without the secret, 400 for a reject without a reason, 200 on success
  - `isInternalRequest` cases
- [ ] **Step 2: Run them and see them fail:** `cd apps/api && bun run test src/lib/expense-approval.test.ts src/app/api/expenses/admin/decide/route.test.ts src/lib/internal-auth.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, plus the whole `expense-approval` and `teams/bot` suites.
- [ ] **Step 5: Type-check:** `bun run check-types --filter=api`.
- [ ] **Step 6: Commit:** `feat(api): decide approval steps by id from admin, with history of decisions and notifications`.

---

### Task 3: Who may do what, and approver sign-in (apps/admin)

**Files:**
- `apps/admin/src/lib/expense-access.ts` (new, + test)
- `apps/admin/src/lib/microsoft-identity.ts` (new, + test)
- `apps/admin/src/lib/authorization.ts` (+ test)
- `apps/admin/src/lib/roles.ts` (+ test)
- `apps/admin/src/lib/nav-tree.ts` (+ test)
- `apps/admin/src/app/(portal)/layout.tsx` (role label)
- `packages/i18n/messages/{en,no}/admin.json` or the file that holds `admin.roles`: the label `expenseApprover`, "Approver" / "Godkjenner".

**Interfaces:**
- `export function microsoftIdentityEmails(identities: { provider: string; providerEmail?: string | null }[]): string[]`: trimmed, lowercased and de-duplicated `providerEmail`s where `provider === "microsoft"`. Reuse the provider constant from `benefit-access.ts`.
- `ROLES.EXPENSE_APPROVER = "expenseapprover"`.
- `NAV_ACCESS["portal.expenses"] = [GLOBAL_ADMIN, CAMPUS_ADMIN, EXPENSE_APPROVER]`.
- `export interface ExpenseViewer { userId: string; name: string | null; accountEmail: string | null; isGlobalAdmin: boolean; isCampusAdmin: boolean; managedCampusIds: string[]; emails: string[]; controllerCampusIds: string[] }`
- `export interface ExpenseAccessExpense { userId: string; campus: string; status: string; submitter_is_controller: boolean; submitter_is_financial_manager: boolean }`
- `export interface ExpenseAccessStep { $id: string; step: number; approver_role: string; approver_email: string; status: string }`
- `export function currentPendingStep<T extends ExpenseAccessStep>(expenseStatus: string, steps: T[]): T | null`: the lowest-numbered `pending` step when `expenseStatus === "pending"`, else null.
- `export interface ExpensePermissions { canView: boolean; isSubmitter: boolean; canEdit: boolean; canEditBankAccount: boolean; canDecide: boolean; decideAs: "approver" | "on_behalf" | null; currentStepId: string | null; canChangeApprover: boolean; canRetryBooking: boolean }`
- `export function expensePermissions(viewer: ExpenseViewer, expense: ExpenseAccessExpense, steps: ExpenseAccessStep[]): ExpensePermissions`
- `export function canOpenExpensesSection(viewer: ExpenseViewer, roles: string[]): boolean`: true for a global admin, a campus admin, any controller campus, or the approver role.
- `export function expenseVisibilityQueries(viewer: ExpenseViewer, approverExpenseIds: string[]): string[]` (Appwrite query strings):
  - a global admin gets `[]`;
  - otherwise an `or` of `equal("campus", campuses)` and `equal("$id", ids)`, where `campuses` = `managedCampusIds` (only when `isCampusAdmin`) ∪ `controllerCampusIds`;
  - an empty side is dropped;
  - when both sides are empty, return the existing `NO_MATCH_FILTER` from `lib/utils/authorization.ts`.
- `export const getExpenseViewer: () => Promise<ExpenseViewer | null>`:
  - Wrap it in React `cache`, and keep it server-only.
  - Build it from `getUserAuthContext()`, the session account's identities via `microsoftIdentityEmails`, and the campus ids of active `expense_approvers` rows with `role = "controller"` and `email` in those emails (admin client).
  - Return null when there is no session.

**Permission rules** (derive the flags in this order):

| Name | Definition |
|---|---|
| `isSubmitter` | `viewer.userId === expense.userId` |
| `isGlobal` | `viewer.isGlobalAdmin` |
| `controllerHere` | `controllerCampusIds` includes `expense.campus` |
| `controllerActs` | `controllerHere && !expense.submitter_is_controller` |
| `step` | `currentPendingStep(expense.status, steps)` |
| `approverHere` | `step` exists, its lowercased `approver_email` is in `viewer.emails`, and not (`step.approver_role === "finance"` && `expense.submitter_is_financial_manager`) and not (`step.approver_role === "controller"` && `expense.submitter_is_controller`) |
| `onAnyStep` | some step's lowercased `approver_email` is in `viewer.emails` |
| `campusAdminHere` | `viewer.isCampusAdmin && managedCampusIds.includes(expense.campus)` |
| `canView` | `isGlobal \|\| controllerHere \|\| campusAdminHere \|\| onAnyStep \|\| isSubmitter` |
| `actor` | `!isSubmitter && (isGlobal \|\| controllerActs)` (acts on behalf) |

Every permission below is false when `isSubmitter` is true.

| Permission | Rule |
|---|---|
| `canDecide` | `step` exists and (`approverHere \|\| actor`) |
| `decideAs` | `approverHere` → `"approver"`; else `actor` → `"on_behalf"`; else null |
| `currentStepId` | `step?.$id ?? null` |
| `canEdit` | status `pending`: `approverHere \|\| actor`. Status `failed`: `actor`. Otherwise false. |
| `canEditBankAccount` | `canEdit && actor` |
| `canChangeApprover` | `step` exists and (`isGlobal`, or `controllerActs` with `step.approver_role` in `finance`, `manager`, `deputy`) |
| `canRetryBooking` | status `failed` && `actor` |

**The approver role** (in `getUserAuthContext`):
- Only for users who are neither global nor campus admin.
- Take the Microsoft identity emails, then run two `limit(1)` queries in parallel:
  - `expense_approvals` with `approver_email` in those emails (any status);
  - active `expense_approvers` with `email` in those emails.
- Either match pushes `ROLES.EXPENSE_APPROVER`.
- Any error leaves the role out. Log it and don't throw.
- `requireAdminAccess` lets the role through.
- `nav-tree.ts`: the expenses group gets `leaf("expensesList", "portal.expenses", "/expenses", Receipt)` before the settings leaf. Pick a list icon that isn't `Receipt` if the group already uses it.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `expensePermissions`, one test per row above:
    - global admin on behalf
    - controller on own campus; controller on another campus (no view)
    - `controller cannot act on a controller-submitted expense` (view only)
    - campus admin read-only
    - current approver approves as approver
    - a later step's approver can view but not decide
    - finance approver closed on an FM-submitted expense
    - `a global admin who submitted cannot act`
    - failed expense: edit and retry for actors only
    - approved and success: nothing editable
    - `matches approver emails case-insensitively`
  - `canChangeApprover` for a controller on a controller step → false
  - `expenseVisibilityQueries` cases (global, campus admin plus approver ids, no grants → `NO_MATCH_FILTER`)
  - `microsoftIdentityEmails` (ignores other providers, lowercases)
  - `grants the approver role from a Microsoft identity email`
  - `ignores the bare account email`
  - `approver role opens only the expenses nav` (`hasNavAccess` for `portal.expenses` true, `portal.dashboard`/`portal.pages` false; `getDefaultNavPath` → `/expenses`)
  - the nav group has two leaves for a global admin
- [ ] **Step 2: Run them and see them fail:** `cd apps/admin && bun test src/lib/expense-access.test.ts src/lib/microsoft-identity.test.ts src/lib/roles.test.ts src/lib/nav-tree.test.ts src/lib/authorization.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS.
- [ ] **Step 5: Type-check:** `bun run check-types --filter=admin`.
- [ ] **Step 6: Commit:** `feat(admin): expense permissions and sign-in for approver mailboxes`.

---

### Task 4: The list page `/expenses`

**Files:**
- `apps/admin/src/app/(portal)/expenses/expenses-data.ts` (new, `import "server-only"`, + test of the pure parts)
- `apps/admin/src/app/(portal)/expenses/page.tsx` (new)
- `apps/admin/src/app/(portal)/expenses/_components/expenses-list.tsx` (new, client: filters and table)
- `apps/admin/src/app/(portal)/expenses/_components/expense-status-badge.tsx` (new)
- i18n `adminPortal.expenses.*`

**Interfaces:**
- `export type ExpenseListView = "all" | "mine" | "attention"`
- `export interface ExpenseListFilters { page: number; size: number; q: string; status: string | null; campusId: string | null; departmentId: string | null; view: ExpenseListView }`
- `export function resolveExpenseListFilters(sp: Record<string, string | string[] | undefined>): ExpenseListFilters`:
  - Built on `parseListParams`.
  - Unknown `status` or `view` values fall back to null / `"all"`.
  - `draft` is never a valid status.
- `export interface ExpenseListRow { id: string; reference: string; submitterName: string; departmentName: string; campusName: string; total: number; status: string; currentStep: { role: string; approverEmail: string } | null; submittedAt: string; flags: { hints: number; failed: boolean; approverIssue: boolean } }`
- `export async function listExpenses(viewer: ExpenseViewer, filters: ExpenseListFilters): Promise<PaginatedResult<ExpenseListRow>>`

**Rules:**
- **Base query:** admin client, `status != draft`, `orderDesc("$createdAt")`, `expenseVisibilityQueries(viewer, approverIds)`, plus the filters.
  - `approverIds` are the `expense_id`s of `expense_approvals` rows whose `approver_email` is in `viewer.emails` (limit 100).
- **`mine`:** pending steps with `approver_email` in `viewer.emails` (limit 100). Keep only the expenses where that step is `currentPendingStep`, then `equal("$id", ids)`. No ids means an empty result without querying `expense`.
- **`attention`:** `or(status = failed, $id in <expense_ids of open expense_approval_issues, limit 100>)`.
- **`q`:**
  - Digits only → `equal("$sequence", Number(q) - 10000)`.
  - Otherwise `search("description", q)`. The fulltext index `search` exists.
- **Per-page enrichment** (one query each, for the page's ids):
  - steps → `currentStep`;
  - open issues → `flags.approverIssue`;
  - `flags.hints` = the number of entries `parseApproverHints(approver_hints)` returns (`@repo/shared/utils/expense-hints`).
- **Select only the needed columns:** `$id`, `$sequence`, `$createdAt`, `status`, `total`, `campus`, `department`, `approver_hints`, `userId`, `user.name`, `departmentRel.Name`, `campusRel.name`.
- **Page:**
  - `const viewer = await getExpenseViewer()`. When there's no viewer, or `canOpenExpensesSection` is false → `notFound()`.
  - View tabs: All / Waiting on me / Needs attention.
  - Filters: status, campus (only campuses the viewer can see; all for global), department (the `departments` rows for the chosen campus).
  - Table columns as the spec lists, then pagination (`ListParamsProvider` pattern from shop).
  - A row links to `/expenses/<id>`.
  - Approver-only viewers land on "Waiting on me" by default when `view` is absent.

Steps:
- [ ] **Step 1: Write failing tests** for `resolveExpenseListFilters`:
  - defaults;
  - `view=attention`;
  - an unknown status → null;
  - `status=draft` → null;
  - a size outside `PAGE_SIZES` is clamped.

  Also test `buildExpenseListQueries(viewer, filters, ids)`, exported for testing:
  - `mine` with no ids → `null` (short-circuit);
  - a digits `q` → the `$sequence` equal;
  - the status filter;
  - drafts are always excluded.
- [ ] **Step 2: Run them and see them fail:** `cd apps/admin && bun test "src/app/(portal)/expenses/expenses-data.test.ts"`.
- [ ] **Step 3: Implement** the data, the page and the components.
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=admin`.
- [ ] **Step 5: Commit:** `feat(admin): expenses list with waiting-on-me and needs-attention views`.

---

### Task 5: The detail page `/expenses/[expenseId]` (read-only) and the receipt file route

**Files:**
- `expenses-data.ts`: adds `getExpenseDetail`.
- `apps/admin/src/app/(portal)/expenses/[expenseId]/page.tsx`
- `[expenseId]/_components/expense-header.tsx`
- `[expenseId]/_components/expense-receipts.tsx`
- `[expenseId]/_components/expense-steps.tsx`
- `[expenseId]/_components/expense-history.tsx`
- `apps/admin/src/app/(portal)/expenses/history-model.ts` (pure, + test)
- `apps/admin/src/app/api/expenses/[expenseId]/files/[fileId]/route.ts` (+ test)
- i18n

**Interfaces:**
- `export interface ExpenseDetail` with these fields:
  - identity and people: `id`, `reference`, `status`, `submitter { name, email }`, `campus { id, name }`, `department { id, name }`
  - content: `description`, `occasion`, `event { id, title } | null`, `switches { financialManager: boolean; controller: boolean }`
  - payout: `bankAccount: string`, which is the full number only when `permissions.canEditBankAccount`, otherwise `"•••• " + last 4 digits`; `total`
  - flags: `hints` (parsed), `presidentFallback: boolean` (true when some step has role `national` and `campus !== "5"`)
  - `receipts: ExpenseDetailReceipt[]`, `steps: ExpenseDetailStep[]`, `events: ExpenseDetailEvent[]` (oldest first, limit 200)
  - booking: `bookingFailure: string | null` (the latest `booking_failed` note when the status is `failed`), `ledgerTransactionId` (a real id only; the `"posting"` marker becomes null)
  - `permissions: ExpensePermissions`
- `ExpenseDetailReceipt`: `{ id, fileId, description, date, amount, costType, costTypeLabel, costTypeText, accountNumber, accountName, accountSource, aiCostType, aiConfidence, receiptIssues: string[], bookedDate, isSupporting }`.
  - `fileId` comes from the existing url → file-id helper; reuse the function next to `APPWRITE_FILE_ID_RE`/`STORAGE_FILE_URL_RE` in `apps/api/src/lib/expense-payload.ts`, moved to `@repo/shared/utils` if admin needs it.
  - `isSupporting` = `(amount ?? 0) <= 0`. The server never stores the web's `parentId`; supporting statements are saved with amount 0.
- `ExpenseDetailStep`: `{ id, step, role, approverEmail, status, decidedBy, decidedByEmail, decidedAt, onBehalf, reason, isCurrent }`.
- `ExpenseDetailEvent`: `ExpenseEvents` fields minus Appwrite internals, plus `at`.
- `export async function getExpenseDetail(viewer: ExpenseViewer, expenseId: string): Promise<ExpenseDetail | null>`: null when the expense is missing, a draft, or `!canView`.
- `history-model.ts`: `export function describeEvent(event: ExpenseDetailEvent): { key: string; values: Record<string, string> }`. It maps each action (and `edited` per field) to an i18n key under `adminPortal.expenses.history.*` with the values to interpolate. Unknown actions use `history.unknown`.
- **File route:** `GET /api/expenses/<expenseId>/files/<fileId>`.
  - Get the viewer and load the detail. Return 404 unless `canView` and `fileId` equals one of the receipts' `fileId`s.
  - Stream with the admin storage `getFileView` from bucket `expenses`, with the file's mime type, `Cache-Control: private, no-store` and `Content-Disposition: inline`.

**Page:**
- **Header:** reference, status badge, submitter, department and campus, total, bank account, description, occasion, event, the switch shown as a line ("Submitter says they are the department's financial manager" / "… the campus controller"), and the president-fallback note.
- **Hints:** a panel of warning lines. Reuse the hint copy used on the web if a shared label map exists; otherwise add admin keys.
- **Receipts table:**
  - Columns: preview link (opens the file route in a new tab with `rel="noopener"`), date, description, amount, type (or the student's own text in quotes), account number + name, AI note (AI type with confidence %, receipt issues), booked date.
  - Supporting statements are shown indented with no type.
- **Steps:** label, approver email, status, and "by X on behalf of the … · time" when `onBehalf`.
- **History:** a timeline using `describeEvent`.
- **Booking failure:** a panel with Finago's message.
- No actions yet. Tasks 6–7 add them.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `describeEvent` for each action: `edited` with field `amount` and with field `account_number`, `approved` with an on-behalf note, `date_shifted`, unknown
  - `maskBankAccount("12345678903")` → `"•••• 8903"`
  - file route: 404 for a file not on the expense, 404 for a viewer without view, 200 streams for the submitter's campus admin
  - `getExpenseDetail` returns null for a draft (mock db)
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=admin`.
- [ ] **Step 5: Commit:** `feat(admin): expense detail with receipts, steps, history and receipt previews`.

---

### Task 6: Editing receipts and the bank account

**Files:**
- `apps/admin/src/app/(portal)/expenses/[expenseId]/actions.ts` (new, `"use server"`, + test of `planReceiptEdit`)
- `[expenseId]/_components/receipt-editor.tsx` (client dialog)
- `[expenseId]/_components/bank-account-editor.tsx`
- Extract the account picker from `expenses/settings/_components/expense-types-client.tsx` into `expenses/_components/ledger-account-picker.tsx`, and use it in both places.
- i18n

**Interfaces:**
- `export type ActionResult<T> = { data: T } | { error: string }`. Reuse the settings type and move it to `expenses/action-result.ts`.
- `export interface ReceiptChanges { costType?: string; accountNumber?: number; date?: string; description?: string; amount?: number }`
- `export interface ExpenseTypeOption { slug: string; label: string; labelNo: string | null; accountNumber: number; taxCode: number | null }` (active types only).
- `export function planReceiptEdit(current: ExpenseAttachments, changes: ReceiptChanges, ctx: { types: ExpenseTypeOption[]; accounts: Map<number, { taxCode: number | null; active: boolean }>; source: "approver" | "admin"; today: string }): { patch: Partial<ExpenseAttachments>; events: { field: string; before: string | null; after: string | null }[] } | { error: string }` (pure).
- `export async function updateExpenseReceipt(input: { expenseId: string; attachmentId: string; changes: ReceiptChanges }): Promise<ActionResult<{ total: number }>>`
- `export async function updateExpenseBankAccount(input: { expenseId: string; bankAccount: string }): Promise<ActionResult<null>>`

**Rules for `planReceiptEdit`:**
- Only fields that actually change produce patch entries and events.
- `costType`:
  - It must be an active type slug.
  - The patch sets `cost_type = slug`, `cost_type_text = null`, `account_number` and `tax_code` from the type, and `account_source = ctx.source`.
  - Events: `cost_type` (before: the old slug, or the old own text in quotes; after: the slug), plus `account_number` when that changes.
- `accountNumber`:
  - It must be an active ledger account in `EXPENSE_ACCOUNT_MIN`–`EXPENSE_ACCOUNT_MAX` (`types-model.ts`).
  - The patch sets `account_number`, `tax_code` = the account's `tax_code ?? null` (the same rule as the AI's freeform account), and `account_source = ctx.source`.
  - Applied after `costType` when both are given.
- `date`: `YYYY-MM-DD`, from `2000-01-01` up to `ctx.today` (Oslo). Stored as the same datetime shape the submit route writes.
- `description`: trimmed, 1 to the column size from the config.
- `amount`: finite, greater than 0 and at most 1 000 000, rounded to 2 decimals.
- Supporting statements (`(current.amount ?? 0) <= 0`) accept only `description` and `date`.

**Rules for `updateExpenseReceipt`:**
- Load the expense with its steps and attachments (admin client), get the viewer, and run `expensePermissions`.
- Refuse unless `canEdit`. The attachment must belong to the expense.
- `source`: `"approver"` when `decideAs === "approver"`, otherwise `"admin"`.
- Apply the patch.
- When the amount changed, set `expense.total = round2(sum of positive attachment amounts)` and add a `total` event.
- Record the events: `edited`, `actorKind` = `source === "approver" ? "approver" : "admin"`, `actorEmail` (the matched step email for an approver, else the first Microsoft email, else the account email), `actorName = viewer.name`, `attachmentId`.
- `revalidatePath("/expenses/<id>")`.

**Rules for the bank account:**
- Needs `canEditBankAccount`.
- Digits only after removing spaces and dots, exactly 11 digits. Reuse an existing Norwegian account validator if `grep -rn "bank_account" apps/web/src/components/expense-v3` shows one.
- The event field is `bank_account`, with masked before and after values.

**UI:**
- An Edit button per receipt opens a dialog with:
  - the type select (active types, Norwegian label in the Norwegian UI);
  - the account picker;
  - date, description and amount;
  - Save, with toasts on success and error.
- The bank-account editor sits in the header.
- Both are hidden unless the matching permission is true.

Steps:
- [ ] **Step 1: Write failing tests** for `planReceiptEdit`:
  - `type change takes the type's account and tax code`
  - `account change keeps the type and takes the account's tax code`
  - `own text replaced by a type records the text as before`
  - `inactive account refused`
  - `future date refused`
  - `amount rounds to two decimals`
  - `unchanged fields produce no events`
  - `supporting statement refuses amount`

  Also test the action: `refuses when the viewer cannot edit` and `recomputes the total after an amount change` (mock db and viewer).
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS, then `bun run check-types --filter=admin`.
- [ ] **Step 5: Commit:** `feat(admin): approvers and finance can correct receipts and the bank account, logged in history`.

---

### Task 7: Approve, reject, change approver and retry booking

**Files:**
- api:
  - `apps/api/src/lib/expense-approval.ts`: `changeStepApprover`, plus a refactor of `resendApprovalNotification` into a shared internal `reissueAndNotify`.
  - `apps/api/src/lib/expense-posting.ts`: `retryExpenseBooking`, success-write backoff, `todayInOslo` inside the try.
  - routes `apps/api/src/app/api/expenses/admin/change-approver/route.ts` and `admin/retry-booking/route.ts` (+ tests).
- admin:
  - `apps/admin/src/lib/expenses-api.ts` (new). Refactor `_actions/expense-approval-issues.ts`'s resend call onto it.
  - `[expenseId]/actions.ts`: `decideExpenseStep`, `changeExpenseApprover`, `retryExpenseBooking`.
  - `[expenseId]/_components/decision-panel.tsx`, `change-approver-dialog.tsx`, `retry-booking-button.tsx`.
  - i18n.

**Interfaces (api):**
- `export async function changeStepApprover(params: { approvalId: string; email: string; actor: ApprovalActor }): Promise<{ ok: true; notified: boolean } | { ok: false; error: string }>`
  - The row must be the current step (the same check as `decideApprovalStep`).
  - `email` is lowercased.
  - Look the person up with the existing Graph `getUser(email)` under `AbortSignal.timeout(6000)`, best-effort, for the AAD id and display name.
  - Update the row's `approver_email` and `approver_aad_id`.
  - Upsert the directory row for `row.directory_key`. When the key is null, use `directoryKey` from the row's role, campus and department. Set `source: "admin"`, `active: true`, `confirmed_at: null`, `confidence: null`, `display_name`, `aad_id`.
  - Record `approver_resolved` with `actorKind` from the actor, `field: "approver_email"`, before and after, and `note: "changed in admin"`.
  - Then `reissueAndNotify`. A notify failure records the existing notification issue and returns `notified: false`.
- `export async function retryExpenseBooking(params: { expenseId: string; actor: ApprovalActor }): Promise<{ ok: true; status: string } | { ok: false; error: string }>`
  - Status must be `failed`. `ledger_transaction_id` must be null or the claim marker.
  - Otherwise return `{ ok: false, error: "Already booked as <id>." }` or `"Only failed bookings can be retried."` and write nothing.
  - On success, reset `{ status: "approved", posting_lock: 0, ledger_transaction_id: null }`, record `booking_retried` (actor, `note: "retried from admin"`), then `await postApprovedExpense(expenseId)`.
  - Return `{ ok: true, status: <the expense's status after the run> }`. A posting error becomes `{ ok: false, error: message }`; posting has already recorded `booking_failed`.
- Stage 1 carry-over in `expense-posting.ts`:
  - The success-write retries wait 500 ms, then 2 s, through an injectable `sleep` (default `setTimeout`).
  - `todayInOslo()` moves inside the try, so a throw records `booking_failed` and releases nothing.
- Routes:
  - Both use `isInternalRequest`, take zod bodies `{ approvalId, email (email, ≤320), actor }` and `{ expenseId (1–64), actor }`, and return 401, 400 or 200 like Task 2.
  - Retry also returns 409 when the `expenses_ledger_posting` feature flag is off, the same as resend.

**Interfaces (admin):**
- `export async function callExpensesApi<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }>`
  - Server-only. Uses `NEXT_PUBLIC_API_BASE_URL` (trailing slashes removed), `Bearer ${CRON_SECRET}`, `cache: "no-store"`.
  - An error comes from the JSON `error` field or the status text.
- `decideExpenseStep({ expenseId, approvalId, decision, reason? })`:
  - Needs `canDecide` and `approvalId === currentStepId`. Reject needs a reason (1–1000 characters after trimming).
  - Calls `/api/expenses/admin/decide` with `actor { email, name, kind: decideAs === "approver" ? "approver" : "admin" }` and `onBehalf: decideAs === "on_behalf"`.
- `changeExpenseApprover({ expenseId, approvalId, email })`: needs `canChangeApprover` and the current step. The email must end with `@biso.no` (case-insensitive).
- `retryExpenseBooking({ expenseId })`: needs `canRetryBooking`.
- All three `revalidatePath` the detail and `/expenses`.

**UI:**
- The decision panel shows only when `canDecide`.
  - Approve, and Reject with a required reason in a dialog.
  - When `decideAs === "on_behalf"`, the buttons read "Approve on behalf of the <role noun>" and "Reject on behalf of …".
- Change approver is a button on the current step row when `canChangeApprover`. Its dialog has an email field and a note that the directory entry changes for future expenses too.
- Retry booking shows only when `canRetryBooking`. It opens a confirm dialog with the warning: "Check in Finago that this expense isn't already booked before you retry. Booking it twice pays the student twice." (Norwegian equivalent in `no`).

Steps:
- [ ] **Step 1: Write failing tests:**
  - api:
    - `changes the approver, saves the directory row as admin and re-sends`
    - `change refuses a decided step`
    - `refuses retry when a transaction id is stored`
    - `refuses retry when the expense is not failed`
    - `retry resets the claim, records booking_retried and posts`
    - `success write waits between attempts` (fake sleep called with 500 then 2000)
    - `a todayInOslo throw records booking_failed`
    - route 401/400/409 cases
  - admin:
    - `decideExpenseStep refuses a step that is not current`
    - `sends on-behalf for a global admin and approver for the step's approver`
    - `reject needs a reason`
    - `changeExpenseApprover refuses a non-biso address`
    - `callExpensesApi maps an error body` (mock `fetch`)
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** → PASS. Then run the full `cd apps/api && bun run test` and `cd apps/admin && bun test src/lib "src/app/(portal)/expenses"`, and `bun run check-types --filter=api --filter=admin`.
- [ ] **Step 5: Commit:** `feat: approve, reject, change approver and retry booking from the admin expense page`.

---

### Task 8: Needs-attention issues move under Expenses, and docs

**Files:**
- `apps/admin/src/app/(portal)/expenses/_components/approval-issues-panel.tsx`: moved from `it/expense-approvals/_components/expense-approval-issues-client.tsx`.
- `apps/admin/src/app/(portal)/expenses/issues-actions.ts`: moved from `_actions/expense-approval-issues.ts`. Fix the imports of every caller.
- `it/expense-approvals/page.tsx` becomes a `redirect("/expenses?view=attention")`.
- `it/users/_components/it-users-tabs.tsx`, plus the pages passing `labels.expenseApprovals`: remove the tab.
- `expenses/page.tsx`: the issues panel is shown above the table in the `attention` view.
- i18n: move the `adminPortal.it.expenseApprovals.*` keys to `adminPortal.expenses.issues.*`. Delete the old keys.
- Docs:
  - new `apps/docs/content/docs/guide/access-and-settings/expenses-admin.mdx` (or the guide folder that holds `expense-approvals.mdx`), with front-matter `covers` for `apps/admin/src/app/(portal)/expenses/**` and `apps/admin/src/lib/expense-access.ts`;
  - update `expense-approvals.mdx` (approving in admin, on behalf, change approver, retry booking, who sees what);
  - update `developers/reference/accounting.mdx` (retry resets the claim; Stage 1 nit: replace "row stays in posting" with "status stays approved and `ledger_transaction_id` holds the claim marker");
  - update the docs nav `meta.json` if the folder uses one.

**Rules:**
- **Issue access:**
  - Listing: viewers who can see the issue's campus (global, campus admin of that campus, controller of that campus).
  - Resolve and resend: a global admin, or the campus controller of the issue's campus.
  - Replace the old `it.tenant.audit`/`it.users.editProfile` guards with these checks via `getExpenseViewer`.
- **Docs copy** follows the docs rules in `apps/docs/CLAUDE.md`: plain words, written for finance staff.

Steps:
- [ ] **Step 1: Write failing tests:**
  - `issue actions refuse a campus admin resolve`
  - `controller may resend for own campus`
  - the redirect page test, if the folder has page tests; otherwise skip and note it
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** the move, the redirect, the tab removal and the docs.
- [ ] **Step 4: Run** `cd apps/admin && bun test src`. The known pre-existing `content-translation.test.ts` failure is allowed; name it in the report. Then run `bun run check-types --filter=admin --filter=docs`.
- [ ] **Step 5: Run `cd apps/docs && bun run build`** if a covers check script exists (`grep -n covers apps/docs/package.json`), else skip.
- [ ] **Step 6: Commit:** `feat(admin): approval issues live under Expenses → Needs attention; docs for the admin Expenses section`.

---

## Rulings made in this plan

- Ruling: Stage 4 splits into 4a (this plan: list, detail, access, edits, decisions, issues move) and 4b (Settings Approvers + AI tabs, Teams card and email with the update after an admin decision, carried server fixes). Cost if wrong: Teams cards stay plain until 4b lands.
- Ruling: admin decides through new CRON_SECRET-gated api routes instead of re-implementing the chain in admin. The spec says decisions "go through the same decideApproval as Teams", and the shared secret is the existing admin → api pattern. Cost if wrong: one more internal route surface behind the same secret.
- Ruling: an approver role (`expenseapprover`) is granted from Microsoft identity emails matching any approval row or an active directory row, mirroring the benefits-editor exception, so role mailboxes pass the portal gate and see only Expenses. The spec asks for "the narrowest exception needed". Cost if wrong: a mailbox that was once an approver keeps seeing an empty-ish Expenses list.
- Ruling: only the current pending step can be decided, edited by its approver, or have its approver changed. Tokens are only minted for it, and the spec says "while their step is pending". Cost if wrong: none.
- Ruling: change approver is allowed for global admins on any step, and for the campus controller on department steps only. The spec keeps controller/president rows global-only. Cost if wrong: a controller asks a global admin to repoint a controller/president step.
- Ruling: changed approvers must be `@biso.no` addresses. Approval links shouldn't leave the organisation. Cost if wrong: an external approver needs a BISO mailbox.
- Ruling: an account change in admin takes the ledger account's tax code, the same rule as the AI's freeform account. A type change takes the type's account and tax code. Cost if wrong: same as the open tax-code hand-over question.
- Ruling: the full bank account is shown only to those who may edit it; others see the last 4 digits. It is payout-critical personal data. Cost if wrong: approvers can't cross-check a bank account themselves.
- Ruling: a failed expense is editable by global admins and the campus controller, so they can fix the cause before retrying. Approved-but-unposted expenses are not editable, because posting may start at any moment. Cost if wrong: an approver who spots a mistake after final approval asks finance to reject or fix it after a failure.
