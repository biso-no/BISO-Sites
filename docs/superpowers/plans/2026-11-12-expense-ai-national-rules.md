# National Approval Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Approve National reimbursements the way the owner set out on 2026-11-12:
- the national **controller** approves every National reimbursement;
- on Drift BISO (1000) and Operations Unit (1002), a submitter who is the controller can say so, and the **general manager** then approves instead.

Oslo and the other campuses are unchanged.

**Architecture:**
- The rule table in `packages/shared/utils/expense-approvers.ts` gains National.
  - `approvalSwitchFor("5", "1000" | "1002")` offers the controller switch.
  - `getCampusApprovalPlan` sends National to a `controller` step on campus 5, or to the `national` step (the general manager) when the controller switch is on.
- The api resolution falls back to the general manager, with an issue, when there is no National controller in the directory.
- The web, the app and admin show the right wording.

**Spec:** BISO-Sites `docs/superpowers/specs/2026-11-11-expense-ai-booking-design.md`, Stage 3 "Rules", amended by the owner on 2026-11-12. This plan's table supersedes the spec's National row.

## The rules (binding)

| Campus | Department | Switch shown | Switch off | Switch on |
|---|---|---|---|---|
| Oslo `1` | not `1`/`2` | I'm this department's financial manager | dept financial manager → campus controller | dept manager (deputy if none) → campus controller |
| Oslo `1` | `1` Drift Campus Oslo, `2` Ledelsen Oslo | I'm the campus controller | campus controller | campus president |
| `2`/`3`/`4` | that campus's Drift/Ledelsen (`300`/`301`, `600`/`601`, `800`/`801`) | I'm the campus controller | campus controller | campus president |
| `2`/`3`/`4` | any other | none | campus controller | n/a |
| National `5` | `1000` Drift BISO, `1002` Operations Unit | I'm the controller | National controller | general manager |
| National `5` | any other (incl. HR, Control Committee) | none | National controller | n/a |

- **National controller:**
  - The active `expense_approvers` row `campus:5:controller`, which the owner adds in Settings → Approvers. There is no hardcoded mailbox.
  - When that row is missing, the step goes to the **general manager**, with a Needs-attention issue: "No National controller in the approver directory; sent to the general manager (<email>)".
- **General manager:**
  - The existing `national` role, directory row `campus:5:national`. It is seeded as markus@biso.no for testing, and the owner switches it to manager@biso.no later.
  - The fallback default stays `manager@biso.no`.
- **Display names:**
  - The role `national` is shown as **General manager** / **Daglig leder** everywhere: admin, cards, emails, history, docs.
  - The role `controller` on campus 5 reads **Controller**. On campuses 1–4 it reads **Campus controller**.

## Global Constraints

- **Worktrees and safety:**
  - BISO-Sites work: `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/expense-ai`. Flutter work: `/Users/markus/Documents/dev/BISO-Flutter/.claude/worktrees/expense-ai`.
  - Never push. Never write to production; reading live data is fine.
  - Explicit paths only for formatting and staging. Both worktrees may hold unrelated uncommitted files: never stage or revert them. Never use `git stash`.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Capture a RED run for new tests.
- **Copy:** en + no for every string, written plainly.

## Review Focus

- **The controller files on Drift BISO with the switch on:** only the general manager approves, and the controller never gets a step. Task 1 test: `national controller's own reimbursement goes to the general manager only`.
- **No National controller row exists:** the reimbursement still gets an approver (the general manager) and an issue. Task 1 test: `missing national controller falls back to the general manager with an issue`.
- **The controller switch is sent for HR or Control Committee** (crafted, or a stale draft): it is ignored, and the National controller approves. Task 1 test: `ignores the controller switch on other national departments`.

---

### Task 1: The rule and the server (BISO-Sites)

**Files:**
- `packages/shared/utils/expense-approvers.ts` (+ test)
- `apps/api/src/lib/expense-approver-resolution.ts` (+ test)
- `apps/api/src/lib/expense-approval-guard.ts` (+ test), only if its substitutes need the campus-5 controller case
- `apps/api/src/lib/expense-approval.ts` `ROLE_NOUN` / `stepLabel` and `apps/api/src/lib/expense-card-details.ts` texts: `national` reads "the general manager" / "General manager"; a campus-5 `controller` reads "the controller" / "Controller".

**Interfaces (unchanged names):**
- `approvalSwitchFor`
- `getCampusApprovalPlan`
- `DEFAULT_DIRECTORY_EMAILS`: campus 5 keeps only `national`.

Steps:
- [ ] **Step 1: Write failing tests.**
  - Shared: every National row of the table, plus `ignores the controller switch on other national departments` (HR `1005`, Control Committee `1004`) and `national controller's own reimbursement goes to the general manager only`. All existing Oslo/campus rows stay green.
  - Resolution:
    - `campus:5:controller` row present → used;
    - `missing national controller falls back to the general manager with an issue` (reason text as above);
    - an inactive campus-5 controller row → general manager, plus the existing deactivated wording.
  - Guard: a campus-5 controller step whose approver is the submitter goes to the general manager.
  - Labels: the step label and note for `national` read "General manager".
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Run the full api suite, `cd packages/shared && bun run test`, and `bun run check-types --filter=api --filter=@repo/shared --filter=web --filter=admin`.
- [ ] **Step 5: Commit:** `feat: national reimbursements go to the controller, the controller's own to the general manager`.

### Task 2: Web, admin and docs wording (BISO-Sites)

**Files:**
- **Web switch copy:** `apps/web/src/components/expense-v3/*` (the switch card). The controller switch on campus 5 reads "I'm the controller" / "Jeg er controller", with the hint "The general manager approves instead." / "Daglig leder godkjenner i stedet.". Campuses 1–4 keep today's copy. Web tests.
- **Admin role labels:** `packages/i18n/messages/{en,no}/adminPortal.json`. `roles.national` = "General manager" / "Daglig leder", and `onBehalfRoles.national` = "the general manager" / "daglig leder". `roles.controller` on campus 5 shows "Controller". If the label is keyed only by role, add a `controllerNational` variant used when the expense's campus is `5`.
- **Approvers tab:** a `controller` row on campus `5` must be allowed. Check the pairing/campus rules in `approvers-model.ts`, and add a test that a global admin can add `campus:5:controller`.
- **Docs:**
  - `apps/docs/content/docs/guide/access-and-settings/expense-approvals.mdx`: rules table and National text; the issue reason for a missing National controller.
  - `apps/docs/content/docs/developers/reference/microsoft.mdx` "Who approves".
  - The spec's Stage 3 table: add a dated amendment note pointing to this plan.

Steps:
- [ ] **Step 1: Write failing tests:**
  - web switch copy on campus 5;
  - admin: Approvers accepts `campus:5:controller`, and the label resolves to Controller for campus 5.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Run the admin `bun test "src/app/(portal)/expenses"`, the web expense tests, check-types for web and admin, `cd apps/admin && bun run build`, and `cd apps/docs && bun test`.
- [ ] **Step 5: Commit:** `feat: national approval wording in web, admin and docs`.

### Task 3: The app (BISO-Flutter)

**Files:**
- `lib/core/utils/expense_approval_switch.dart` (+ test): add `"5": ["1000", "1002"]` to the leadership map, mirroring the shared rule.
- `lib/presentation/screens/expense/widgets/approval_switch_card.dart`, plus where the screen picks the copy: on campus 5, show "I'm the controller" with the hint "The general manager approves instead.".
- ARB en + no; `flutter gen-l10n`.
- `EXPENSE_V2.md` and the `CLAUDE.md` expense section rules.

Steps:
- [ ] **Step 1: Write failing tests:** `approvalSwitchFor('5','1000')` → controller, `('5','1002')` → controller, `('5','1005')` → none; a card test for the national copy.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the whole `flutter test` and `flutter analyze lib test`.
- [ ] **Step 5: Commit:** `feat(expense): controller switch on Drift BISO and Operations Unit; national wording`.
