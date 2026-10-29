# Docs rework: sync with the deployed issue fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `feat/docs-rework` describe the platform as it now runs. The owner merged and deployed six PRs: #108 (role ids and row permissions), #109 (page drafts and translation permissions), #110 (recruitment), #111 (admin hardening) and #113 (the expense approver). `origin/main` was merged into this branch at `0d7d032a`.

**Architecture:** Two inputs show what has to change.
- The private hand-off list at `/Users/markus/Documents/dev/BISO-Sites/docs/issues-fix-docs-handoff.md`. It has one row for each page change, written by the session that made the fixes.
- The coverage CLI, run over `git diff --name-only e76af72d^2 origin/main` (172 files). It flags 42 pages whose covered code changed.

The work splits by area. Each writer checks every claim on their pages that touches the changed code, and every hand-off row for their pages.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md`. Binding rules are in `apps/docs/CLAUDE.md`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push or deploy without the owner's go-ahead.

## Global Constraints

- **The code is the source of truth.** Hand-off rows are pointers, not facts. Verify every one against the merged code (file:line) before writing it, and report any that are wrong.
- **The repo and site are public.** Pages must not describe unfixed weaknesses beyond what the developer pages already allow, and must not print email addresses, role mailboxes included. Write "the national manager's mailbox", not the address. Where a fixed weakness is gone, remove the warning; don't describe how it used to work.
- **Still-open items.** These are 143, 150, 141's caveat if any remains, 65/68 and 117. Developer pages may state them plainly as limitations, with no exploit detail. Guide pages give only safe instructions.
- **Guide pages** follow `.superpowers/sdd/docs-rework-shared/writer-instructions.md`. **Developer pages** follow `developer-writer-instructions.md`. Labels come from i18n or the code.
- **Tooling:**
  - Bun only.
  - Run `bun x ultracite fix apps/docs` before committing.
  - `bun run check-types --filter=docs` and `bun run test --filter=docs` pass at the end of each task.
  - Commits end with the session trailer.

## Review Focus

1. A page still warns about a weakness that's now fixed, or describes the old role model built on team names.
2. A page states a fixed behaviour wrongly. Examples: booking links, the confirm card, the turnover rules, who creates users, the drafts table.
3. An email address or an exploit detail slips in through a hand-off row.
4. The screenshot seed no longer gives seeded users their roles under the new model, which needs saved team lists.

---

### Task 1: Docs code for the new role model

**Files:**
- Modify `apps/docs/scripts/screenshots/seed-data.ts`, `seed-data.test.ts`, `seed.ts` and the README.
- Modify the header comment in `apps/docs/lib/auth/access.ts`.

- [ ] Replace the removed `team-roles` imports (`getManagedCampuses`, `isNationalOperations`, `KNOWN_CAMPUS_NAMES`) with the current API in `packages/shared/utils/team-roles.ts`, such as `rolesFromTeams` and `CAMPUS_TEAM_IDS`.
- [ ] Seed an `m365_team_sync` row for every seeded staff user, so their roles resolve under the saved-team-list check. Use the table and column names from `packages/api/appwrite.config.json` and the admin's reader in `apps/admin/src/lib/authorization.ts`.
- [ ] Add a test that every seeded staff user gets exactly the intended role through the same helpers the admin uses.
- [ ] Update the `access.ts` comment. The admin and the API now also use exact ids, plus the saved list. Docs trusts a fixed list of ids plus `docs-handover`.
- [ ] Run check-types and test, then commit `fix(docs): screenshot seed and access comment follow the synced team ids`.

### Task 2: Developer pages

**Pages:** every developer page the CLI flagged, plus every developer row in the hand-off:
- auth-and-roles, code-layout, common-changes, data-model
- backups-and-recovery, scheduled-jobs, when-things-break, yearly-calendar
- ai, events-and-content-sources, known-limitations, microsoft, packages
- getting-access, your-first-day, if-youre-hiring-someone, design-decisions, local-setup

- [ ] Rewrite the roles material on auth-and-roles for the new model:
  - exact ids
  - the `m365_team_sync` saved list, written at each Microsoft sign-in
  - the backfill script
  - the API scope rules
  - who creates users (campus admins in their own campus, global admins anywhere)
  - turnover is global-admin only and limited to `@biso.no`
  - HR comes from `SG-App-Dept-HR` only
- [ ] Remove the known-issue text for 60, 64, 72 and 74 everywhere, and update data-model's permission lists and table count. That includes `m365_team_sync`, `page_drafts` and any other new table.
- [ ] Add the new scripts with their dry-run defaults: `backfill:m365-team-sync`, `reconcile:row-permissions`, `migrate:page-drafts` and `backfill:scorecard-interviews`.
- [ ] Apply every other developer hand-off row, and fix any other drift found.
- [ ] Run the checks, then commit `docs(developers): describe the fixed roles, permissions and new scripts`.

### Task 3: Guide — recruitment and start here

**Pages:**
- recruitment/{index, publish-a-vacancy, review-applications, book-interviews, make-offers-and-close}
- start-here/{everyday-tools, inbox-and-approvals, pick-your-role, sign-in}

- [ ] Apply the hand-off rows for 22, 24, 25, 26, 35, 40, 86, 112 and 59:
  - AI prompts use labels instead of names, and drafts start on a click
  - scorecards show on the board
  - booking links work only while the candidate is in Interview; a new link replaces the old one; staff can list and revoke links
  - a failed Teams invite is flagged
  - bulk Archive moves candidates; "Draft invite emails"
  - vacancies can be closed and reopened
  - vacancies are recruiter-only in Drafts, the overview and the assistant
  - the assistant writes only after a confirm click that the server checks, and the card shows every field it will write
- [ ] Re-check every claim the CLI flagged on these pages, and fix any drift.
- [ ] Run the checks, then commit `docs(guide): recruitment and start-here match the deployed fixes`.

### Task 4: Guide — the other areas

**Pages:**
- access-and-settings/{index, manage-users, hand-over-a-role-account, expense-approvals}
- announcements/index
- departments-and-documents/index
- events/{index, create-an-event, run-the-event}
- members-and-benefits/{index, publish-a-benefit}
- pages-and-news/{index, edit-a-page, department-pages}
- shop/{index, add-a-product, accounting, orders-and-refunds}

- [ ] Apply the hand-off rows:
  - turnover rules (70, 139, plus the global-admin requirement)
  - campus admins can create users in their own campus
  - the national expense approver (97). Give the mailbox by role only, never the address.
  - page drafts (141): publishing can't replace a live page with an empty one
  - event and benefit visibility, and translation permissions (142)
- [ ] Re-check every claim the CLI flagged on these pages, and fix any drift.
- [ ] Run the checks, then commit `docs(guide): areas match the deployed fixes`.

### Task 5: Verification

- [ ] Run these checks:
  - ultracite check
  - check-types: forced for docs, plus admin
  - test for docs, plus admin's `utils.test.ts`
  - a forced build
  - `check:private-leaks`
  - the coverage CLI over `origin/main...HEAD`
- [ ] Grep the content for email addresses. Also grep for "team names", "known critical", "aren't safe", and "anyone can create", and check each hit is a true statement.
- [ ] Do a visual check of the changed pages at 1300 and 375 px.
- [ ] Report, then do the final whole-stage review with one fix wave.
