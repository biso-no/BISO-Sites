# Docs rework, final stage: clean-up, drift pass and go-live checklist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave `feat/docs-rework` ready for the owner's single cut-over. That means four things:
- remove the old `legacy/` pages
- re-check every page whose covered code changed after it was written, and fix the drift
- write the owner's go-live checklist
- run one last full verification

**Architecture:** The coverage CLI (`apps/docs/scripts/page-coverage/cli.ts --changed <list>`) finds the drifted pages. It's fed two change lists:
- the files `origin/main` brought in at merge `e76af72d`, measured against the pre-merge head `9e10bc5b`
- the docs-app code that changed in Stages 4–5a (`2f445a1f..HEAD`)

Two kinds of page drop out of that result:
- Stage 4 guide pages, which were written on the merged code. The CLI flags them only because they were committed after the merge.
- Pages that a later stage rewrote.

What remains is the drift set.

**Tech Stack:** MDX on Fumadocs, `bun test`, and the existing coverage CLI and leak check.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md`, under "Release" (a final pass re-checks every page against the current `main`) and "Owner actions". Binding authoring rules: `apps/docs/CLAUDE.md`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push, deploy or write to production.

## Global Constraints

- **The repo is public.** The go-live checklist has no secret values, no emails, no hosts beyond the public ones, and no description of unfixed security weaknesses. Where an owner step depends on a security fix, it says "fix the items marked for before go-live in the private issues list" and nothing more.
- **Evidence.** Every corrected claim cites code (file:line). Guide pages follow `.superpowers/sdd/docs-rework-shared/writer-instructions.md`, and developer pages follow `developer-writer-instructions.md`.
- **Tooling.**
  - Bun only.
  - Run `bun x ultracite fix apps/docs` scoped to the docs app.
  - `bun run check-types --filter=docs`, `bun run test --filter=docs` and `bun run build --filter=docs` pass at the end of every task.
  - Commits end with the session's attribution trailer.

## Review Focus

1. **A page still states a fact the merged code changed.** Task 2 re-verifies the drift set claim by claim. Typical drift: table counts, the new `event_rsvps` table, recruitment consent text, docs-app internals.
2. **A redirect or test still depends on `legacy/`.** Task 1 keeps `legacy-urls.json`, which the redirect tests read, and removes the code that generated it.
3. **A go-live step is missing or out of order.** For example, creating the `docs-handover` team after the private source is switched on. Task 3 builds the checklist from every stage's owner items and the runbooks, in a dependency order.

---

### Task 1: Remove `legacy/`

**Files:**
- Delete: `apps/docs/legacy/` (the whole folder) and `apps/docs/scripts/list-legacy-urls.ts`.
- Modify: `apps/docs/CLAUDE.md`. Remove the paragraph about `legacy/`. Keep the redirects paragraph, and add one sentence: `legacy-urls.json` is a frozen list of the old site's URLs, and the redirect tests check that every one of them resolves.
- Modify: any script entry in `apps/docs/package.json` or test that references the deleted script or folder. Find them with `git grep -n "legacy/" apps/docs` and `git grep -n "list-legacy" apps/docs`.

- [ ] **Step 1:** Delete the folder and the script, then fix every reference.
- [ ] **Step 2:** Run the tests and the build. Expected: pass. The redirect tests still read `legacy-urls.json`, and every legacy URL still resolves.
- [ ] **Step 3:** Commit `chore(docs): remove the old pages; keep the frozen URL list`.

---

### Task 2: Drift pass

**Files:** the drift set below, plus any other page the reviewer finds in the same way. Each page is edited only where its claims drifted.

**The drift set.** This is the CLI output, after dropping Stage 4 guide pages that were written on the merged code:
- `developers/change-it/data-model.mdx`
- `developers/change-it/the-mobile-app.mdx`
- `developers/change-it/local-setup.mdx`
- `developers/change-it/code-layout.mdx`
- `developers/keep-it-running/when-things-break.mdx`
- `developers/keep-it-running/secrets-and-environment.mdx`
- `developers/reference/ai.mdx`
- `developers/reference/known-limitations.mdx`
- `developers/reference/packages.mdx`
- `developers/start-here/your-first-day.mdx`
- `developers/start-here/what-biso-runs.mdx`
- `guide/recruitment/index.mdx`
- `guide/recruitment/publish-a-vacancy.mdx`

The writer re-runs the CLI with both change lists (see Architecture) to confirm the set before starting.

- [ ] **Step 1:** For each page, list every claim that touches the changed files, and re-verify each one against the current code. Changes worth checking include:
  - the table count and the new `event_rsvps` table on data-model
  - the RSVP API route for the app, on the-mobile-app
  - the recruitment consent and application text change that came in with the merge
  - the docs app's new `lib/assistant`, `@repo/ai` dependency, `bunfig.toml` test preload and env vars, on code-layout, packages, local-setup and secrets
- [ ] **Step 2:** Fix every drifted claim. Record each fix in the report as page, old claim, new claim and evidence.
- [ ] **Step 3:** Run all checks. The coverage CLI must show no dead globs.
- [ ] **Step 4:** Commit `docs: drift pass against the merged main`.

---

### Task 3: Go-live checklist

**Files:**
- Create: `apps/docs/GO-LIVE.md`, the owner's ordered checklist for the cut-over.
- Modify: `apps/docs/CLAUDE.md`, adding one line under "Two areas" that links to it.

**Content.** Group the steps under these headings, in dependency order. Each step has a "done when" check.

1. **Before go-live: security fixes.** Fix the items marked for before go-live in the private issues list. Don't name them.
2. **Microsoft and Appwrite teams.** These come from the "Private details" owner steps in `apps/docs/CLAUDE.md`:
   - create the `docs-handover` team first
   - check the 10 trusted team ids
   - remove stray members
3. **Infisical.**
   - Create the docs folder and a read-only machine identity.
   - Fill in every registry name. List the names from `apps/docs/lib/private/registry.ts`, with each one's description and no values.
   - The administration leader assembles the emergency kit, using the kit-only entry's checklist.
4. **Anthropic.** Create a separate workspace and API key for the docs site, with a monthly spend limit.
5. **Appwrite site for docs.**
   - Create it.
   - Set every env var from `apps/docs/.env.example` with real values.
   - Set `NEXT_PUBLIC_DOCS_URL` on the admin and rebuild the admin.
   - Set `NEXT_PUBLIC_ADMIN_URL` on docs.
   - Point `docs.biso.no` at it.
   - Make sure the admin session cookie is set on `.biso.no`.
   - Confirm the proxy sets `x-forwarded-for`.
6. **Screenshots.**
   - Create the docs Appwrite project.
   - Push the schema.
   - Run seed and capture, following `apps/docs/scripts/screenshots/README.md`.
   - Add `<Screenshot>` tags to the pages, following the manifest.
   - Commit the images.
7. **Deploy and check.**
   - Deploy.
   - Sign in, and check every `<Private>` block shows a value.
   - Check the sign-in link from a signed-out page.
   - Run the assistant's three test questions, waiting as the runbook says.
   - Check a sample of legacy URLs redirect.
   - Check that last-updated dates show. If they don't, the build has a shallow clone, as `deploying.mdx` explains.
8. **After go-live.**
   - Retire the old docs.
   - Open questions for the owner: the BI OIDC secret expiry, and the door policy on orange scans.
   - Stage 5b (the admin assistant tool) waits for `feat/admin-assistant` to merge.

- [ ] **Step 1:** Collect the owner items from `apps/docs/CLAUDE.md` (Private details, Assistant), the screenshots README, `apps/docs/.env.example`, and the developer `deploying` page. The private rulings record at `.superpowers/sdd/docs-rework-rulings.md` has the "owner/go-live items" lists. Use it as a source, but copy no security details from it.
- [ ] **Step 2:** Write the checklist. Run ultracite and the tests.
- [ ] **Step 3:** Commit `docs: go-live checklist for the docs cut-over`.

---

### Task 4: Final verification

**Files:** none. Make fix-ups only, each committed separately.

- [ ] **Step 1:** Run `bun x ultracite check apps/docs`, check-types, test, a forced build, and `check:private-leaks` (stop or avoid any dev server serving `apps/docs/.next` first). Run the coverage CLI over `git diff --name-only origin/main...HEAD` and record the warnings. Expected: no dead globs and no malformed `covers`.
- [ ] **Step 2:** Visual sweep. Serve the build and load every page in the sitemap at 1300 px and 375 px. Check for a 200 response, the H1, and no horizontal scroll. Screenshot the landing and 6 random pages.
- [ ] **Step 3:** Report the outcome of each check.
