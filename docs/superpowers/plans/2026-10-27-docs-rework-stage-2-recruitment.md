# Docs rework, Stage 2: Recruitment guide and screenshot pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the recruitment area of the platform guide and its sign-in page, checked against the code. Wire them into the landing page and the redirects. Build the scripts that seed a docs-only Appwrite project with made-up data and capture admin screenshots.

**Architecture:**
- **Fact sheet first.** One research task writes a verified fact sheet: every claim, its file:line evidence, and the on-screen label in Norwegian and English. Every writing task works from it, and every review checks against it and the code.
- **Pages.** They follow `apps/docs/CLAUDE.md` exactly: the six-part task-page shape, the panel pattern, `who` and `covers`.
- **Screenshot pipeline.** Two Bun scripts in `apps/docs/scripts/screenshots/`: a seed script and a Playwright capture script. Both refuse to touch the production project.
- **Screenshots wait for the owner.** They need a project the owner creates. Pages ship text-only now, and a manifest records where each shot goes.

**Tech Stack:** MDX on Fumadocs, `bun test`, `@repo/api/server` (`createAdminClient`) for seeding, `playwright` for capture.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md`. Binding authoring rules: `apps/docs/CLAUDE.md`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push, deploy, write to production, or switch the main checkout's branch.

## Global Constraints

- **Authoring rules:** `apps/docs/CLAUDE.md` is binding. That covers front matter, the six-part task-page shape, the panel pattern, the language rule, no placeholders, no private values, and adding every page to its folder's `meta.json`.
- **Labels:** name each on-screen label as it appears in the admin's default Norwegian locale, with the English in brackets, for example **Opprett ny stilling** (New vacancy). Where the screen shows a hard-coded English string, use it alone. Take every label from the fact sheet, never from memory or the old docs.
- **Evidence:**
  - Every factual claim needs evidence in the code. A page's report lists claim → fact-sheet entry, or file:line.
  - A claim with no evidence is cut.
  - Where code and on-screen help text disagree, the guide describes what the code does. The disagreement goes into the report for the issues file; the guide does not mention it.
- **Prose:**
  - English, second person, sentence case, short sentences, written for a student volunteer in their first week.
  - No marketing words.
  - Avoid these patterns: "not X but Y" contrasts, rule-of-three filler, em-dash chains, one-line dramatic closers.
- **Examples:** use invented people and units only, such as "Kari Nordmann" or "Oslo HR". Never use real names or emails.
- **`who` for recruitment pages:** the real roles from `apps/admin/src/lib/roles.ts`, in staff language. The fact sheet gives the exact wording.
- **Tooling:**
  - Bun only.
  - `bun x ultracite fix apps/docs`, scoped, before each commit.
  - `bun run check-types --filter=docs` and `bun run test --filter=docs` pass at the end of every task.
  - Commits end with the session's attribution trailer.
- **The live system:** never read or write production Appwrite, Infisical, Microsoft Graph or any live service. Research means reading code.

## Review Focus

1. **A step that names a label the screen doesn't show,** because it is the wrong locale or wording. Every label must trace to an i18n key or hard-coded string in the fact sheet. Covered by the evidence table in every content task.
2. **A page that promises an email or notification the system never sends.** Applicants get no confirmation and HR gets no alert. Advance and bulk emails are drafts staff copy themselves. Covered by fact-sheet section 8 and the "What happens next" checks in Tasks 3–7.
3. **The two interview paths behave differently:** the schedule modal moves the candidate to Interview, but a booking link does not. Staff following one page must not be surprised by the other. Covered in Task 6.
4. **The screenshot scripts pointed at production by mistake.** They must refuse to run unless `DOCS_APPWRITE_PROJECT` is set and differs from the production project id. Test: Task 9.
5. **Seed data that looks real:** realistic Norwegian names, but `@example.org` emails and an obviously fake department. Test: Task 9.

---

### Task 1: Recruitment and sign-in fact sheet (research)

**Files:**
- Create: `.superpowers/sdd/2026-10-27-docs-rework-stage-2-recruitment/recruitment-facts.md` (the plan workspace, gitignored)

**Interfaces:**
- Produces: a fact sheet with numbered sections. Each fact is a row: `ID | claim (plain English) | evidence (file:line) | label NO | label EN`. IDs look like `R3.4`. Every later task cites these IDs.

Sections, in this order:
1. **Access:** which roles see Jobs and applications (`NAV_ACCESS` in `apps/admin/src/lib/roles.ts`, nav in `nav-tree.ts`, page-level guards). Include what the role names mean in staff terms (HR department members on their campus, National HR, global admins) and that campus admins do not have access. Note the Access tab's on-screen text and whether it matches.
2. **Sign-in and finding your way:**
   - the sign-in page and method, and what happens without a role
   - the sidebar groups an HR user sees
   - the language setting and who can change it
   - the notification bell
   - any command palette or keyboard shortcut
   - the in-app recruitment tour and guide video (`_actions/tour-context.ts`, `api/recruitment/guide-video`)
3. **Jobs list** (`(portal)/jobs/page.tsx`, `job-studio-dashboard.tsx`): what is listed, filters, actions (new, duplicate, open applications), labels.
4. **Vacancy editor** (`[id]/page.tsx`, `job-studio-editor.tsx`, `job-form-issues.ts`). For every step: fields, required or optional, validation messages, defaults (including auto-screen), AI helpers. Also cover:
   - scheduling: publish now versus later, and the cron interval from `api/recruitment/publish-scheduled` and `functions/scheduled-dispatch`
   - the notify-students push: delay and quiet hours (from the content notifier)
   - members-only, and what it gates
   - the "Push to inboxes" and "Friday newsletter" switches and whether anything reads them
   - duplicate
   - the interview template
5. **Vacancy statuses** and what each means on biso.no and in the app. Also: closing a vacancy, and editing a published one.
6. **The student side.**
   - Applying, on the web (`apps/web/src/app/(public)/jobs`) and in the app API (`apps/api/src/app/api/recruitment`, `packages/shared/recruitment/apply.ts`): BI sign-in, the membership check, the form steps, document rules (type, size, required), consent text and the retention period, and blocked cases.
   - Whether any confirmation is sent.
   - What `/applications` shows the student, and the status labels they see.
7. **Applications workspace** (`[id]/applications/**`):
   - the tabs and their labels
   - the pipeline: kanban and list, sort, star, drag, bulk move, compare tray, AI insights, ask AI
   - the candidate drawer's contents
   - the application statuses: internal value, UI label in NO and EN, and the allowed transitions
   - the overall applications dashboard (`/jobs/applications`)
8. **AI screening:**
   - what triggers it, and the condition that turns it on (including the `OPENAI_API_KEY` gate in `isAutoScreened`)
   - the model provider, and what is anonymised
   - the output (score, strengths, gaps, recommendation)
   - that it never changes status
   - what staff see when screening didn't run
9. **Emails:**
   - every email the system sends in recruitment, and to whom
   - every email it only drafts for staff to copy (`advance-stage-modal.tsx`, `bulk-email-composer.tsx`, `email-draft-default.ts`)
10. **Interviews:**
    - the schedule modal: free/busy source, hours, window, panel, the Teams meeting and invite, and the status change
    - booking links: validity, single use, how staff send them, what happens when the candidate books, and that the status does not change
    - interview statuses
    - the scorecard fields and recommendation values
    - the interview template's rounds
11. **Form and rubric tab, funnel and sources tab, access and data tab:** what each does.
12. **Retention:**
    - what deletes applications, and when (`api/cron/cleanup-recruitment`)
    - what the UI says
    - what the student consent says
13. **Discrepancies:** a list of every place where on-screen text, help or the old docs disagree with the code, each with evidence. This feeds the issues file.

- [ ] **Step 1: Read the code and write the fact sheet.** Every row needs evidence. For labels, resolve i18n keys against `packages/i18n/messages/no/*.json` and `en/*.json`. Where a string is hard-coded, record it and mark it `hard-coded`.
- [ ] **Step 2: Self-check.** Pick 10 rows at random and re-open their evidence to confirm. Record which rows you checked.
- [ ] **Step 3:** No commit; the file is in the gitignored workspace. Report the path and the section row counts.

---

### Task 2: Sign-in page and the recruitment folder skeleton

**Files:**
- Create: `apps/docs/content/docs/guide/start-here/meta.json` (`{ "title": "Start here", "pages": ["sign-in"] }`)
- Create: `apps/docs/content/docs/guide/start-here/sign-in.mdx`
- Modify: `apps/docs/content/docs/guide/meta.json` → `"pages": ["index", "start-here"]`
- Test: the existing `lib/content-structure.test.ts` and the build

**Interfaces:**
- Consumes: fact-sheet section 2.
- Produces: URL `/guide/start-here/sign-in`. (The `recruitment` folder is created by Task 3.)

`sign-in.mdx`:
- `title: Sign in and find your way`
- `who`: everyone with a BISO admin role
- `covers`: the admin's auth route, `lib/roles.ts`, `lib/nav-tree.ts`, and the locale action
- Shape (a task page):
  - **Before you start:** you need a BISO Microsoft account in a group that gives a role. Say who to ask in role terms ("ask IT"), never by name.
  - **Steps:** sign in; what you see first; the sidebar groups by role; the language setting and who can change it; the notification bell; the in-app recruitment tour, if the facts confirm it.
  - **What happens next:** none needed, so leave it out.
  - **What the student sees:** not applicable, so leave it out.
  - **Common mistakes:** a personal Microsoft account; a role that is missing until the next sign-in; and the like, only as the facts support.

- [ ] **Step 1:** Write the page and the `meta.json` files.
- [ ] **Step 2:** Run `bun run test --filter=docs && bun run build --filter=docs`. Expected: pass, and `/guide/start-here/sign-in` is in the build output.
- [ ] **Step 3:** Write the evidence table in the report: every claim → fact ID.
- [ ] **Step 4:** Commit `docs(guide): sign in and find your way`

---

### Task 3: How recruitment works

**Files:**
- Create: `apps/docs/content/docs/guide/recruitment/index.mdx`
- Create: `apps/docs/content/docs/guide/recruitment/meta.json` with `{ "title": "Recruitment", "pages": ["index"] }`
- Modify: `apps/docs/content/docs/guide/meta.json` → `"pages": ["index", "start-here", "recruitment"]`

Tasks 4–7 each append their page's slug to `recruitment/meta.json`, in this order: `publish-a-vacancy`, `review-applications`, `book-interviews`, `make-offers-and-close`.

Content (an overview page, not a task page; no `who` line):
- **Who can use recruitment:** the roles, and that campus admins can't.
- **The round from start to finish,** as a short numbered overview linking to each task page: publish, applications arrive, screening, shortlist, interviews, offer or archive, close, data deleted.
- **A statuses table:** what you see (NO, then EN) | what it means | where it can go next | what the applicant sees. Exactly per fact section 7, with the student labels from section 6.
- **"What the system does on its own"** set against **"What you do yourself"**, as two short lists. This is the key list: scheduled publishing, the push to students, screening and Teams invites on the system side; every email to applicants, booking links and the status change after a booked interview on the staff side. Per section 9.
- **"How long applications are kept":** per section 12.
- `covers`: the jobs routes, `packages/shared/recruitment/**`, the web jobs and applications routes, the api recruitment routes, and the cleanup cron.
- One plain Mermaid flowchart of the status transitions is allowed if it adds clarity. Use the `<Mermaid>` component, with labels in NO and EN.

- [ ] **Step 1:** Write the page.
- [ ] **Step 2:** Run the tests and the build.
- [ ] **Step 3:** Write the evidence table.
- [ ] **Step 4:** Commit `docs(guide): how recruitment works`

---

### Task 4: Publish a vacancy

**Files:** Create `guide/recruitment/publish-a-vacancy.mdx`. Modify `guide/recruitment/meta.json`.

The six-part task page, per fact sections 3–5:
- **Before you start:** what to have ready (department, deadline, contact, what to screen for, a cover image).
- **Steps:** one `<Step>` per editor step, plus "publish now or schedule". Each step names its fields with NO/EN labels, says which are required, and gives the defaults that matter (auto-screen on). Cover duplicating last year's vacancy as the first step's alternative.
- **What happens next:** scheduled publishing timing; the notify-students push (delay, quiet hours, once only); where the vacancy appears.
- **What the student sees:** biso.no/jobs and the app, and members-only behaviour (visible to everyone, only members can apply).
- **Common mistakes:** only what the facts support. For example: forgetting the deadline; expecting "Push to inboxes" or "Friday newsletter" to send something if the facts show nothing reads them, said plainly in one line; editing a published vacancy after applications have arrived.
- `who`: per fact section 1.

- [ ] Steps 1–4 as in Task 3, with the commit message `docs(guide): publish a vacancy`.

---

### Task 5: Review applications

**Files:** Create `guide/recruitment/review-applications.mdx`. Modify `meta.json`.

The six-part task page, per sections 7–9:
- **Before you start:** the vacancy is published and applications have arrived. There is no alert for new applications, so check the workspace.
- **Steps:**
  - open the workspace
  - read a candidate (the drawer)
  - use the AI screening result, as advice only
  - shortlist or archive one candidate
  - move several at once
  - compare candidates
- **What happens next:** which status changes the applicant sees, and that nothing is emailed automatically.
- **What the student sees:** the label on `/applications` for each status.
- **Common mistakes:** treating the AI score as a decision; expecting an email to go out; the allowed transitions (for example, an archived candidate can't be moved back, if the facts say so).
- Include a short section, "If there is no AI score", that matches the facts in section 8.

- [ ] Steps 1–4, with the commit message `docs(guide): review applications`.

---

### Task 6: Book interviews

**Files:** Create `guide/recruitment/book-interviews.mdx`. Modify `meta.json`.

The six-part task page, per section 10:
- **Before you start:** the candidate is shortlisted, the panel is decided, and the interview template is set.
- **Steps, two options, each with its own `<Steps>` under its own heading:**
  - "Pick a time for them (schedule)", which moves the candidate to Interview
  - "Let them pick (booking link)", where staff email the link themselves and then move the candidate to Interview by hand
  - then "After the interview: fill in the scorecard"
- **What happens next:** the Teams meeting and Outlook invite, who sends them, the link's validity and single use.
- **What the student sees:** the booking page, the invite, and the `/applications` interview details.
- **Common mistakes:** not moving the status after a booking; sending an expired or used link.

- [ ] Steps 1–4, with the commit message `docs(guide): book interviews`.

---

### Task 7: Make offers, reject, and close the round

**Files:** Create `guide/recruitment/make-offers-and-close.mdx`. Modify `meta.json`.

The six-part task page, per sections 7, 9, 5 and 12:
- **Steps:**
  - move to Offer (Tilbud, or whatever the facts say)
  - copy and send the offer email yourself
  - archive or reject with the drafted email
  - bulk-reject the rest
  - close the vacancy
- **What happens next:** what the applicant sees, and when the application data is deleted.
- **Common mistakes:** forgetting the people who weren't selected (they get no email unless staff send one); final statuses can't be undone, if the facts say so.

- [ ] Steps 1–4, with the commit message `docs(guide): make offers and close the round`.

---

### Task 8: Landing and redirects for the new pages

**Files:**
- Modify: `apps/docs/lib/landing.ts`
- Modify: `apps/docs/redirects.json`
- Test: the existing `lib/landing.test.ts` and `lib/redirects.test.ts`

**Interfaces:**
- Consumes: the page URLs from Tasks 2–7.

Changes:
- `readingPaths`: add `{ role: "HR team", steps: [Sign in and find your way → /guide/start-here/sign-in, How recruitment works → /guide/recruitment, Publish a vacancy → /guide/recruitment/publish-a-vacancy, Review applications → /guide/recruitment/review-applications, Book interviews → /guide/recruitment/book-interviews] }`
- `taskGroups`: add `{ title: "Recruitment", href: "/guide/recruitment", tasks: [...] }` with these tasks:
  - Publish a vacancy
  - Shortlist or archive a candidate → `review-applications` with the anchor of its shortlist step
  - Send a booking link → `book-interviews` with the booking anchor
  - Make an offer → `make-offers-and-close`

  Anchors must match the real heading slugs; check them in the built HTML.
- `redirects.json`: add these specific rules above the fallbacks:

  | Old URL | New URL |
  |---|---|
  | `/docs/admin-handbook/jobs` | `/guide/recruitment` |
  | `/docs/admin-handbook/jobs/creating-vacancies` | `/guide/recruitment/publish-a-vacancy` |
  | `/docs/admin-handbook/jobs/applications-workspace` | `/guide/recruitment/review-applications` |
  | `/docs/admin-handbook/jobs/ai-screening` | `/guide/recruitment/review-applications` |
  | `/docs/admin-handbook/jobs/interviews-and-booking` | `/guide/recruitment/book-interviews` |
  | `/docs/admin-handbook/signing-in` | `/guide/start-here/sign-in` |

- [ ] **Step 1:** Make the changes.
- [ ] **Step 2:** Run `bun run test --filter=docs`. It must pass; the landing link test and the redirect tests now exercise real data.
- [ ] **Step 3:** Run the build. In the built HTML, check that each anchor `href` on the landing exists as an `id` on its target page.
- [ ] **Step 4:** Commit `feat(docs): HR reading path, recruitment tasks and redirects`

---

### Task 9: Screenshot pipeline (seed and capture)

**Files:**
- Create: `apps/docs/scripts/screenshots/config.ts`, `config.test.ts`
- Create: `apps/docs/scripts/screenshots/seed-data.ts`, `seed-data.test.ts`
- Create: `apps/docs/scripts/screenshots/seed.ts` (CLI)
- Create: `apps/docs/scripts/screenshots/manifest.ts`, `manifest.test.ts`
- Create: `apps/docs/scripts/screenshots/capture.ts` (CLI)
- Create: `apps/docs/scripts/screenshots/README.md`
- Modify: `apps/docs/package.json`: devDependency `playwright`, plus scripts `"screenshots:seed": "bun scripts/screenshots/seed.ts"` and `"screenshots:capture": "bun scripts/screenshots/capture.ts"`

**Interfaces:**
- `readScreenshotConfig(env: Record<string, string | undefined>): ScreenshotConfig` in `config.ts`.
  - `ScreenshotConfig = { endpoint: string; projectId: string; apiKey: string; adminUrl: string; outDir: string }`.
  - It reads `DOCS_APPWRITE_ENDPOINT`, `DOCS_APPWRITE_PROJECT`, `DOCS_APPWRITE_API_KEY`, `DOCS_ADMIN_URL` (default `http://localhost:3001`) and `DOCS_SCREENSHOT_DIR` (default `apps/docs/public/screenshots`).
  - **It throws** when any required value is missing, or when `projectId` equals the production project id. Read that id from `packages/api/appwrite.config.json` `projectId`; never hard-code it. It also throws when `DOCS_APPWRITE_PROJECT` equals `process.env.APPWRITE_PROJECT_ID` or `NEXT_PUBLIC_APPWRITE_PROJECT` in `env`.
- `buildSeedData(): SeedData` in `seed-data.ts`. It is deterministic, with no randomness and no dates relative to now: dates come from a fixed base date, `2026-09-01`. It contains:
  - one campus and one HR department (an obviously fake name, such as "Demo HR")
  - one staff user per role needed for screenshots: HR, global admin, department editor
  - two vacancies: one published and one draft
  - eight applicants spread across every application status
  - one scheduled interview and one scorecard
  - **every email ends in `@example.org`**

  Field names and table IDs come from `packages/api/types/appwrite.ts` and `appwrite.config.json`.
- `seed.ts`:
  - Reads the config from the original `process.env` first, so the guard sees the developer's real settings. It then sets the env that `@repo/api/server` reads (endpoint, project, key) to the docs project's values, and imports `@repo/api/server` dynamically after that.
  - Upserts the seed data through `@repo/api/server` `createAdminClient`, with the env pointed at the docs project, so it is idempotent by fixed row ids.
  - Creates the Appwrite teams and memberships the admin's role logic needs for each staff user.
  - Prints the staff user ids.
- `manifest.ts` exports `SHOTS: { id: string; route: string; page: string; afterStep: string; caption: string; role: "hr" | "globaladmin" | "department"; width: number; height: number; prepare?: string }[]`.
  - `page` is the repo-relative `.mdx` path the shot belongs in.
  - `afterStep` is the step title it follows.
  - `prepare` is an optional named action that `capture.ts` implements, such as `"open-first-candidate"`.
  - Cover at least: the jobs list, editor step 1, the pipeline, the candidate drawer, the schedule modal, booking-link creation, the scorecard, and the sign-in page.
- `capture.ts`:
  - Reads the config.
  - For each role it mints a session for the seeded user with the server SDK (`users.createSession`) and sets the admin's session cookie on `adminUrl` (name from `apps/admin/src/lib/server.ts`).
  - Sets the user's locale pref to `no`.
  - Visits each shot's route, runs its `prepare`, and saves `<outDir>/<id>.png` at the given size.
  - Prints a summary.
  - It never writes outside `outDir` and the docs project.
- `README.md`: the owner's steps.
  1. Create the project.
  2. Push the schema to it with the Appwrite CLI and a project override.
  3. Create an API key with the scopes listed.
  4. Run `bunx playwright install chromium`.
  5. Start the admin against the docs project with the env vars listed.
  6. Run seed, then capture.
  7. Afterwards: add `<Screenshot>` tags to the pages per the manifest and commit the images.

- [ ] **Step 1: Write the failing tests:**
  - `config.test.ts`:
    - throws on a missing project
    - throws when the project equals the production id from `appwrite.config.json`
    - throws when it equals `APPWRITE_PROJECT_ID` in env
    - returns defaults for `adminUrl` and `outDir`
  - `seed-data.test.ts`:
    - deterministic (two calls are deep-equal)
    - every email matches `/@example\.org$/`
    - every application status from `packages/api/types/appwrite.ts` appears at least once
    - no field holds `biso.no` or a real campus email
  - `manifest.test.ts`:
    - ids are unique and URL-safe
    - every `page` file exists
    - every `afterStep` appears as a `<Step title=…>` or heading text in that page
    - `width` and `height` are positive
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.** In the seed script, check how the admin derives roles from team membership (`apps/admin/src/lib/roles.ts` and the authorization code). Create matching teams so each seeded user gets exactly the intended role.
- [ ] **Step 4: Run the tests and `check-types`.** Expected: pass. Do not run `seed.ts` or `capture.ts` against anything: no docs project exists yet.
- [ ] **Step 5: Commit** `feat(docs): screenshot seed and capture scripts for a docs-only project`

---

### Task 10: Stage verification

**Files:** none (fix-ups only, committed separately)

- [ ] **Step 1: Full checks.** `bun x ultracite check apps/docs`, `bun run check-types --filter=docs`, `bun run test --filter=docs`, `bun run build --filter=docs`. All must pass.
- [ ] **Step 2: Look at the pages.** Serve the build, then screenshot every new page and the landing at 1300px and 375px. Check:
  - the TOC lists the panel headings
  - step numbering is continuous inside each `<Steps>`
  - Mermaid renders, if used
  - landing anchors land on the right heading
  - no horizontal scroll at 375px
- [ ] **Step 3: Accuracy spot check.** For each page, pick five claims and re-verify them against code (not the fact sheet). Record the results.
- [ ] **Step 4: Issues file.** Append every discrepancy from fact-sheet section 13 that isn't already listed to `/Users/markus/Documents/dev/BISO-Sites/docs/2026-10-27-issues-from-docs-audit.md` in the main checkout. It is untracked, so editing it doesn't touch the main checkout's branch.
- [ ] **Step 5: Report.** List the outcome of each check.
