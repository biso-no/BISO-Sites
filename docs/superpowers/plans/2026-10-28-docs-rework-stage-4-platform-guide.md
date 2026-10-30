# Docs rework, Stage 4: the rest of the platform guide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover every other user-facing admin feature in the platform guide, checked against the code. Add **Pick your role** and the remaining reading paths and task groups to the landing page, redirect the old handbook URLs, and extend the screenshot seed and manifest to the new screens.

**Architecture:**
- **Fact sheets first.** Six research dispatches each write one area fact sheet in the shared folder, using the Stage 2 row format. Every writing task works from its sheet, and every review checks against the sheet and the code.
- **One writer per area.** Each writer produces the area's "How [area] works" page plus its task pages, in the six-part shape. Area folders follow the admin nav (`apps/admin/src/lib/nav-tree.ts`).
- **Pick your role** renders the guide's reading paths from `lib/landing.ts`, so the landing page and the page can't drift apart.
- **Screenshots** still wait for the owner's docs project. Seed data and manifest entries are added now, and pages ship text-only.

**Tech Stack:** MDX on Fumadocs 16.7.10, `bun test`, React server rendering for component tests, the existing screenshot scripts in `apps/docs/scripts/screenshots/`.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md` (Platform guide, Keeping it accurate, Stages item 4). Binding authoring rules: `apps/docs/CLAUDE.md`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. `origin/main` was merged at `e76af72d` (event RSVP, ticket link). Never push, deploy, write to production, or switch the main checkout's branch.

**Before Task 1 (controller):** rewrite `.superpowers/sdd/docs-rework-shared/writer-instructions.md` and `content-reviewer-instructions.md` for Stage 4. They should point at the area fact sheets and this plan's constraints instead of the deleted Stage 2 workspace, and keep every rule they hold.

## Global Constraints

- **Authoring rules:** `apps/docs/CLAUDE.md` is binding. That covers front matter, the six-part task page shape, the panel pattern, the language rule, no placeholders, no private values, and adding every page to its folder's `meta.json`.
- **Optional parts.** A part of the six-part shape that doesn't apply is left out, not filled with "not applicable". Example: "What the student sees" on an IT page.
- **Labels:** give the Norwegian label as the admin shows it, with the English in brackets, for example **Utlys stilling** (Post Job). Where the screen is hard-coded English, give that alone. Every label comes from the fact sheet, never from memory, the old docs or `legacy/`.
- **`who`:** the real roles from `apps/admin/src/lib/roles.ts`, in staff words, including any data-layer scoping. Use these words:
  - global admin: "global admins (National + Operations Unit)"
  - campus admin: "campus leaders (Ledelsen on your campus)"
  - `department`: "department members, for their own department"
  - HR
  - National HR
  - benefits editor
- **Evidence:**
  - Every factual claim traces to a fact-sheet row or to file:line in the writer's report.
  - A claim with no evidence is cut.
  - Where code and on-screen help disagree, describe what the code does. The disagreement goes into the report for the issues file.
- **Public site.** The guide is public. Never describe an unfixed security weakness, and never give role-bypass detail. Where a flaw changes what staff should do, give only the safe instruction. Example: "Only run the handover on a shared role account, such as hr.oslo@…; never on a person's own account." Don't explain why it's dangerous.
- **Money and member data.**
  - Never suggest switching production payments to Test.
  - Never show or invent real buyers, members or applicants. Examples use invented people and units: Kari Nordmann, "Demo Events".
- **Prose:**
  - English, second person, sentence case, short sentences, written for a student volunteer in their first week.
  - No marketing words.
  - Avoid "not X but Y" contrasts, rule-of-three filler, em-dash chains and one-line dramatic closers.
- **Outside-service screens** have text-only steps and no manifest shots: IT users and audit (Graph), analytics (Umami), documents (SharePoint), shop accounting and expense approvals (24SevenOffice).
- **Tooling:**
  - Bun only.
  - Run `bun x ultracite fix apps/docs`, scoped, before each commit.
  - `bun run check-types --filter=docs` and `bun run test --filter=docs` pass at the end of every task.
  - Commits end with the session's attribution trailer.
- **The live system.** Never read or write production Appwrite, Infisical, Graph, Umami, 24SevenOffice or any live host. Research means reading code.

## Review Focus

1. **A page that says a role can do something it can't.** This covers department members versus campus leaders versus global admins, and scoping to your own campus or department. Each area's "How it works" page carries a role table built from `NAV_ACCESS` and the data-layer scope. Each review checks it against `roles.ts`, the page guards and `applyScopeQueries`. The landing test in Task 9 checks the paths' links.
2. **Automatic pushes and emails, promised or missed.** Content that notifies students by default, quiet hours, once-only sends, Tickster imports, and what is never emailed. Fact-sheet section "Automatic behaviour" is mandatory in sheets F2–F5. Every "What happens next" in Tasks 3–6 cites it.
3. **Irreversible actions without a warning.** Deleting content, refunds, the role-account handover on a personal account, and varsling changes. Fact-sheet section "Irreversible actions" is mandatory in every sheet. Each such action needs a Common mistakes line or a `Callout type="warn"`, and the reviews check it.
4. **Member-only versus public visibility.** Members-only events, products and benefits, drafts (owner answer 8: only published pages are public), and what a non-member sees on biso.no and in the app. "What the student sees" cites the sheet.
5. **Screenshot data that looks real, or a shot of an outside-service screen.** Task 10 tests that every seeded email ends `@example.org`, that no field holds `biso.no`, and that no shot's route is an outside-service route.

---

### Task 1: Area fact sheets (research)

**Files** (shared folder, gitignored; each dispatch writes one file):
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-workspace.md` (F1)
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-content.md` (F2)
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-events-and-announcements.md` (F3)
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-shop.md` (F4)
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-members-and-benefits.md` (F5)
- Create: `.superpowers/sdd/docs-rework-shared/guide-facts-it-and-settings.md` (F6)

The six dispatches touch no tracked file, so the controller may run them in parallel.

**Interfaces:**
- Produces: the row format of `.superpowers/sdd/docs-rework-shared/recruitment-facts.md`, which is `ID | claim | evidence (file:line) | label NO | label EN`. Each sheet's IDs carry its prefix, for example `F4.3.2`. Every later task cites these IDs.

Every sheet has these sections, in this order:
1. **Access.** Write a role × action table from `NAV_ACCESS` (`apps/admin/src/lib/roles.ts`), the page and server-action guards, and data-layer scoping (`applyScopeQueries` and the `can*` helpers).
2. **Screens and labels.** Cover each route the sheet owns: what it lists, the filters, every button and field with its NO and EN labels, which fields are required, defaults, validation messages and empty states. Resolve i18n keys against `packages/i18n/messages/{no,en}/*.json`, and mark strings that are hard-coded.
3. **Flows and statuses.** Give every status with its internal value, its NO and EN labels, and its allowed transitions.
4. **Automatic behaviour.** This section is mandatory, even when it says "none". Cover pushes (`functions/content-notifier`, the notify toggles, delays, quiet hours, once-only), scheduled jobs (`functions/scheduled-dispatch` targets), emails sent, and imports. Also list what is never sent.
5. **What the student or member sees.** Cover biso.no routes, the BISO app (read `git -C /Users/markus/Documents/dev/BISO-Flutter show origin/main:<path>` read-only), and the members-only rules.
6. **Irreversible actions.** This section is mandatory. List deletes, refunds, sends, renames and resets, with what can and can't be undone.
7. **Outside services.** Say which screens need Graph, Umami, SharePoint or 24SevenOffice, and what staff see when the service isn't configured.
8. **Discrepancies.** List on-screen text, help or old docs that disagree with the code, each with evidence. This feeds the issues file.

What each sheet owns:
- **F1, workspace:**
  - the overview dashboard (`(portal)/page.tsx`)
  - the inbox: `inbox`, `inbox/submissions` and `inbox/submissions/[topic]`, and `inbox/approvals`, including what gets approved there and by whom
  - `drafts`, `activity`, the command palette (`_components/command-palette.tsx`) and the assistant widget as it is on this branch (`_components/assistant/**`)
  - analytics (`analytics`)
  - a full role map for Pick your role: every role in `ROLES` plus `department`, how each is granted (Microsoft groups, the `BENEFITS_EDITOR_EMAILS` allow-list), and which nav groups each sees after `filterNavTree`

  The notification bell, the language setting and sign-in are already on `guide/start-here/sign-in.mdx`. Cite them; don't redo them.
- **F2, content:**
  - pages: the list, plus the editor at `(editor)/pages/[id]` with its sections, blocks, themes, publishing and drafts, translations and auto-translation, and department-bound pages
  - news: `news` and `news/[id]`, with the studio, shared media, scheduling and notify
  - departments: `departments` and `departments/[id]`, covering units and projects as departments, members from groups, and the department page
  - documents: `documents` and `documents/[id]`, with SharePoint versions
- **F3, events and announcements:**
  - events: `events`, `events/[id]` and `events/[id]/segments`, covering the editor, logistics, the RSVP list, the ticket link, Tickster imports, members-only and notify
  - communications: `communications` and `communications/[id]`, covering the composer, audiences, scheduling and history
  - every automatic content notification in `functions/content-notifier`
- **F4, shop:**
  - `shop`, `shop/[id]`, `shop/orders/[orderId]` and `shop/accounting`
  - who authors products and who sees orders (`canViewShopOperations`)
  - the approval path for department products
  - membership products, refunds (full and partial, and what happens in 24SevenOffice), and the accounting settings (`canManageAccounting`)
- **F5, members and benefits:**
  - members: `members`, plus `members/scan`, `members/scan/access` and `members/scan/links`
  - the guest scanner `(scan)/scan/[token]`
  - benefits: `benefits`, `benefits/[id]`, `benefits/partners` and `benefits/texts`, including benefit codes, member-only and sections
- **F6, IT and settings:**
  - IT: `it`, `it/users`, `it/users/new`, `it/users/[userId]`, `it/users/audit`, `it/data-health` and `it/expense-approvals`
  - the role-account handover (`_actions/it-turnover.ts` and the dialog)
  - campus-admin read-only scope (`lib/it-permissions.ts`)
  - `varsling`
  - settings: `settings`, `settings/operations`, `settings/feature-flags`, `settings/payments` and `settings/app-versions`

- [ ] **Step 1: Read the code and write the sheet.** Every row needs evidence.
- [ ] **Step 2: Self-check.** Pick 10 rows at random and reopen their evidence. Record which rows you checked.
- [ ] **Step 3: Report.** No commit. Report the path and the row count per section.

---

### Task 2: Start here, the inbox, and analytics

**Files:**
- Create: `guide/start-here/everyday-tools.mdx`. It covers:
  - the overview
  - drafts
  - the activity log
  - the command palette
  - the assistant
- Create: `guide/start-here/inbox-and-approvals.mdx`
- Create: `guide/analytics.mdx`
- Modify: `guide/start-here/meta.json` → `"pages": ["sign-in", "everyday-tools", "inbox-and-approvals"]` (Task 9 puts `pick-your-role` first)
- Modify: `guide/meta.json`, appending `"analytics"` at the end. Later tasks insert their folders before it.

All paths are under `apps/docs/content/docs/`.

**Interfaces:**
- Consumes: F1.
- Produces: the URLs `/guide/start-here/everyday-tools`, `/guide/start-here/inbox-and-approvals` and `/guide/analytics`.

Content:
- **`everyday-tools`.** Write one task page with a `<Step>` per tool. Each step says who sees the tool. The assistant step describes only what the widget does on this branch.
- **`inbox-and-approvals`.** This is a task page.
  - Steps: read a submission, then approve or reject an item.
  - What happens next: per F1 section 4.
- **`analytics`.** This is a task page for global admins, with text-only steps.

- [ ] **Step 1:** Write the pages and the `meta.json` changes.
- [ ] **Step 2:** Run `bun x ultracite fix apps/docs`, then `bun run check-types --filter=docs && bun run test --filter=docs && bun run build --filter=docs`. Expected: everything passes, and the build lists the three URLs.
- [ ] **Step 3:** Write the report's evidence table: each claim → F1 ID or file:line.
- [ ] **Step 4:** Commit `docs(guide): everyday tools, inbox and approvals, analytics`.

---

### Task 3: Pages and news

**Files:** Create `guide/pages-and-news/` with:
- `meta.json`: `{ "title": "Pages and news", "pages": ["index", "edit-a-page", "department-pages", "publish-news"] }`
- `index.mdx`: "How pages and news work". An overview page with no `who` line. It covers:
  - a role table
  - the draft-to-published flow, statuses and translations
  - "What the system does on its own" against "What you do yourself"
- `edit-a-page.mdx`, a task page:
  - open a page in the editor, add and arrange sections and blocks, set the theme, preview, publish
  - Common mistakes: unpublished drafts and translations
- `department-pages.mdx`: how a department's page replaces the coded default, and who can edit it
- `publish-news.mdx`, a task page:
  - write, add media, schedule, notify, publish
  - What the student sees: biso.no and the app

Insert `"pages-and-news"` into `guide/meta.json` after `"recruitment"`.

**Interfaces:** Consumes F2, sections for pages and news.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): pages and news`.

---

### Task 4: Departments and documents

**Files:** Create `guide/departments-and-documents/` with:
- `meta.json`: `{ "title": "Departments and documents", "pages": ["index", "documents"] }`
- `index.mdx`: "How departments work". It covers:
  - departments, units and projects
  - where members come from (Microsoft groups, by role words only, never group names beyond the `SG-App-*` pattern)
  - what a department admin page shows and edits
- `documents.mdx`: a task page with text-only steps (SharePoint): find, upload, new version

Insert `"departments-and-documents"` into `guide/meta.json` after `"pages-and-news"`.

**Interfaces:** Consumes F2, sections for departments and documents.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): departments and documents`.

---

### Task 5: Events and announcements

**Files:**
- Create `guide/events/` with:
  - `meta.json`: `{ "title": "Events", "pages": ["index", "create-an-event", "run-the-event"] }`
  - `index.mdx`: "How events work". Cover the role table, statuses, Tickster imports, members-only, and the automatic notification.
  - `create-an-event.mdx`: a task page.
  - `run-the-event.mdx`: a task page covering logistics, the RSVP list, the ticket link, and changes after publishing.
- Create `guide/announcements/` with:
  - `meta.json`: `{ "title": "Push announcements", "pages": ["index", "send-an-announcement"] }`
  - `index.mdx`: "How notifications reach students". Cover what is sent automatically for which content, the timing and quiet hours, and what a manual announcement adds.
  - `send-an-announcement.mdx`: a task page.

Insert `"events"` and `"announcements"` into `guide/meta.json` after `"departments-and-documents"`.

**Interfaces:** Consumes F3.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): events and push announcements`.

---

### Task 6: Shop and orders

**Files:** Create `guide/shop/` with:
- `meta.json`: `{ "title": "Shop and orders", "pages": ["index", "add-a-product", "orders-and-refunds", "accounting"] }`
- `index.mdx`: "How the shop works". Cover:
  - who authors products and who sees orders
  - the approval path
  - order statuses
  - what reaches 24SevenOffice
- `add-a-product.mdx`: a task page covering variations, custom fields, members-only and approval.
- `orders-and-refunds.mdx`: a task page.
  - Steps: find an order, then refund it, full or partial.
  - Warn callout: refunds can't be undone.
  - What happens next: the accounting effect, per F4 section 4.
  - Never suggest Test mode.
- `accounting.mdx`: a task page for campus leaders and global admins, with text-only steps (24SevenOffice). Cover sales types, clearing accounts and the posting switch.

Insert `"shop"` into `guide/meta.json` after `"announcements"`.

**Interfaces:** Consumes F4.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): shop and orders`.

---

### Task 7: Members and benefits

**Files:** Create `guide/members-and-benefits/` with:
- `meta.json`: `{ "title": "Members and benefits", "pages": ["index", "find-a-member", "scan-member-passes", "publish-a-benefit", "partners-and-texts"] }`
- `index.mdx`: "How membership and benefits work". Cover the role table, including the benefits editor; member-only rules; and what members see in the app and on biso.no.
- `find-a-member.mdx`: a task page for the roster.
- `scan-member-passes.mdx`: a task page. Cover scanning, door access, and making and revoking guest scanner links. Say what a guest scanner sees.
- `publish-a-benefit.mdx`: a task page. Never write a real benefit code; codes in examples are invented.
- `partners-and-texts.mdx`: a task page covering partners and the membership texts, with who can edit each.

Insert `"members-and-benefits"` into `guide/meta.json` after `"shop"`.

**Interfaces:** Consumes F5.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): members and benefits`.

---

### Task 8: Access and settings

**Files:** Create `guide/access-and-settings/` with:
- `meta.json`: `{ "title": "Access and settings", "pages": ["index", "manage-users", "hand-over-a-role-account", "audit-and-data-health", "expense-approvals", "varsling", "system-settings"] }`
- `index.mdx`: "How access works". Cover:
  - roles come from Microsoft groups, plus the benefits-editor list
  - a change takes effect at the person's next sign-in
  - who to ask, by role
  - the campus-leader read-only scope in IT
  - Don't describe the role flaw. The developer pages own that.
- `manage-users.mdx`: a task page with text-only steps (Graph). Cover create a user, change groups, reset MFA or password, and who can do each.
- `hand-over-a-role-account.mdx`: a task page.
  - Before you start, as a `Callout type="warn"`: only shared role accounts, never a person's own account.
  - Steps from F6.
  - What happens next: what the handover does and doesn't do, in staff terms. Link to the developer yearly calendar for the IT checklist.
- `audit-and-data-health.mdx`: a task page covering the audit log and the data-health checks.
- `expense-approvals.mdx`: a task page with text-only steps (24SevenOffice).
- `varsling.mdx`: a task page for global admins.
- `system-settings.mdx`: a task page for global admins. One `<Step>` group each for operations health, feature flags, payment settings and app version prompts. Payment settings carries a warn callout saying never to switch production to Test.

Insert `"access-and-settings"` into `guide/meta.json` after `"members-and-benefits"`, before `"analytics"`.

**Interfaces:** Consumes F6.

- [ ] Steps 1–4 as in Task 2, with the commit message `docs(guide): access and settings`.

---

### Task 9: Pick your role, the landing page and redirects

**Files:**
- Create: `apps/docs/components/role-paths.tsx` and `apps/docs/components/role-paths.test.tsx`
- Modify: `apps/docs/mdx-components.tsx` to register `RolePaths`
- Create: `apps/docs/content/docs/guide/start-here/pick-your-role.mdx`
- Modify: `guide/start-here/meta.json` → `"pages": ["pick-your-role", "sign-in", "everyday-tools", "inbox-and-approvals"]`
- Modify: `guide/index.mdx` so it gives a short orientation linking every area
- Modify: `apps/docs/lib/landing.ts`
- Modify: `apps/docs/redirects.json`

**Interfaces:**
- Consumes: every page URL from Tasks 2–8, and `readingPaths: ReadingPath[]` from `lib/landing.ts`.
- Produces: `RolePaths({ area }: { area: "guide" | "developers" }): JSX.Element`. It renders, as an ordered list per role, every reading path whose steps all start with `/${area}/` (or equal `/${area}`). Each role name is a heading, and each step is a link.

Changes:
- **`readingPaths`.** Add these after "HR team", keeping "Developer or consultant" last. Each has 4–6 steps, in reading order, chosen from the new pages:
  - "Department editor": sign in → pages and news → edit a page → publish news → create an event
  - "Campus leader": sign in → everyday tools → inbox and approvals → how the shop works → find a member → how access works
  - "IT": sign in → how access works → manage users → hand over a role account → system settings
  - "Benefits editor": sign in → how membership and benefits work → publish a benefit → partners and texts
- **`taskGroups`.** Add one group per new area, with 2–4 tasks each. Use step anchors (`stepSlug` from `lib/step-ids.ts`) where a task is one step.
- **`pick-your-role.mdx`.** Write a short intro and `<RolePaths area="guide" />`. Set `covers` to `apps/admin/src/lib/roles.ts` and `apps/admin/src/lib/nav-tree.ts`.
- **`redirects.json`.** Map each `/docs/admin-handbook/*` URL in `legacy-urls.json` that has a clear successor to that successor. Put these above `/docs/admin-handbook/:path*` and keep the fallback. The six recruitment and sign-in rules already exist.

- [ ] **Step 1: Write the failing test.** `role-paths.test.tsx`:
  - `renders every guide path's role and links, in order`. Use `renderToStaticMarkup(<RolePaths area="guide" />)` and check it contains each guide role and each step href in order.
  - `excludes the developer path from the guide`: no `/developers/` href.
  - `renders the developer path for area developers`.
- [ ] **Step 2:** Run `bun test apps/docs/components/role-paths.test.tsx`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3:** Implement `RolePaths` and register it. Then make the `landing.ts`, page, `meta.json`, index and redirect changes.
- [ ] **Step 4:** Run `bun run test --filter=docs && bun run build --filter=docs`. Expected: everything passes, including `landing.test.ts` and the redirect tests. In the built HTML, check that every landing anchor exists as an `id` on its target page.
- [ ] **Step 5:** Commit `feat(docs): pick your role, reading paths, task groups and handbook redirects`.

---

### Task 10: Screenshot seed and manifest for the new areas

**Files:**
- Modify: `apps/docs/scripts/screenshots/seed-data.ts` and `seed-data.test.ts`
- Modify: `apps/docs/scripts/screenshots/manifest.ts` and `manifest.test.ts`
- Modify: `apps/docs/scripts/screenshots/capture.ts`, only for new `prepare` actions
- Modify: `apps/docs/scripts/screenshots/README.md`, to add `BENEFITS_EDITOR_EMAILS` for the seeded benefits editor

**Interfaces:**
- Consumes: the pages from Tasks 2–8, with their `<Step title>` text.
- Changes:
  - `StaffRole` becomes `"hr" | "globaladmin" | "department" | "campusadmin" | "benefitseditor"`.
  - `SeedData` gains rows for:
    - one published page and one draft page
    - one published and one draft news item
    - two events, one members-only with three RSVPs
    - two products, one awaiting approval
    - two orders, one paid and one refunded
    - three roster members
    - one benefit, with an invented code, and one partner
    - one sent communication
  - `SHOTS` gains at least one shot per area from Tasks 2–8, excluding outside-service screens.

- [ ] **Step 1: Write the failing tests.**
  - In `seed-data.test.ts`:
    - every new staff role has a session user
    - every email ends `@example.org`
    - no string field contains `biso.no`
    - the members-only event has exactly three RSVPs
    - the refunded order's status is `refunded`
    - building twice gives deep-equal data
  - In `manifest.test.ts`:
    - no shot route starts with `/it/users`, `/analytics`, `/documents`, `/shop/accounting` or `/it/expense-approvals`
    - every area folder from Tasks 3–8 has at least one shot
    - every `afterStep` appears in its page
    - every `prepare` is in `PREPARE_NAMES`
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Take field names and table ids from `packages/api/types/appwrite.ts` and `appwrite.config.json`.
  - Teams for `campusadmin` come from `roles.ts` (campus plus Ledelsen of the same city).
  - Don't run `seed.ts` or `capture.ts`.
- [ ] **Step 4:** Run `bun run test --filter=docs && bun run check-types --filter=docs`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(docs): screenshot seed and shots for the rest of the guide`.

---

### Task 11: Stage verification

**Files:** none. Fix-ups only, each committed separately.

- [ ] **Step 1: Checks.** Run:
  - `bun x ultracite check apps/docs`
  - `bun run check-types --filter=docs`
  - `bun run test --filter=docs`
  - `bun run build --filter=docs`
  - `cd apps/docs && bun run check:private-leaks`. First check that no dev server is serving from `apps/docs/.next`. If one is, run the check in a temporary worktree instead.

  Everything must pass.
- [ ] **Step 2: Visual check.** Serve the build and check every new page at 1300 px and 375 px:
  - the TOC lists the panel headings
  - step numbering is continuous
  - landing anchors land on the right step
  - Pick your role matches the landing
  - there's no horizontal scroll

  Take screenshots of each area's index page and one task page.
- [ ] **Step 3: Accuracy spot check.** Re-verify 3 claims per page against code, not the fact sheets. Give `who` lines and "What happens next" the most weight.
- [ ] **Step 4: Issues file.** Append to `/Users/markus/Documents/dev/BISO-Sites/docs/2026-10-27-issues-from-docs-audit.md` in the main checkout every discrepancy from the six sheets' section 8 that isn't already there.
- [ ] **Step 5: Report.** Give each check's outcome.
