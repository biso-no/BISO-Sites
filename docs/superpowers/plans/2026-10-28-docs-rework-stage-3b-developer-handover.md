# Docs rework, Stage 3b: Developer handover pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the developer handover: the pages a consultant or new hire needs to understand, run, change and recover the BISO platform cold. Sensitive details go in `<Private>` blocks.

**Architecture:**
- **Location:** MDX pages under `apps/docs/content/docs/developers/`, in four folders:
  - `start-here/`
  - `keep-it-running/`
  - `change-it/`
  - `reference/`
- **Sources:** the two fact sheets and the owner answers in `.superpowers/sdd/docs-rework-shared/`.
- **Private values:** they go through the Stage 3a `<Private>` component and the registry.
- **Writers and reviewers:** every writer follows `developer-writer-instructions.md` and every reviewer follows `developer-reviewer-instructions.md`, both in that folder.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md`, section "Developer handover".

**Work in:** the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push, deploy, or touch live services.

## Global Constraints

- **Binding rules:** `apps/docs/CLAUDE.md` and `developer-writer-instructions.md`. The rules on privacy, evidence, style and `covers`/`meta.json` apply to every page.
- **Precedence:** the owner answers (`owner-answers.md`) override code-derived assumptions about live setup.
- **Facts the pages must state (owner answers):**
  - Deploys are manual in the Appwrite console. Pushing to `main` does not deploy, and a GitHub workflow is planned.
  - The server is a Webdock Linux VPS with a nightly full-server backup that includes the encryption keys. No restore test has been reported.
  - There are three functions. `scheduled-dispatch` has a 330 s console timeout, while the repo config says 60 s.
  - Better Stack provides uptime alerts and Umami provides analytics. Neither is in the repo.
  - Infisical is the store for developers' credentials. Values are copied into the Appwrite console by hand.
  - The live hosts are `biso.no`, `api.biso.no` and `admin.biso.no`, with `docs.biso.no` planned.
  - iOS is built by hand with `flutter build ipa --release`.
  - Appwrite 2.5.0.
  - Expiry dates:
    - Apple app certificate: 2027-06-12
    - Wallet pass certificate: 2027-10-17
    - Azure OAuth secret: probably 2027-03-05; check it in the portal
    - "BISO Sites" Azure secret: being rolled now
- **Known gaps stated plainly where relevant:**
  - CI runs no tests, lint or type-check, and the lefthook hook is inactive.
  - If Appwrite env vars are unset, the apps silently target production.
  - The admin and API derive roles from team names, which anyone can create. This is a known critical issue that the owner will fix.
  - Production has no git history in the build, so pages show no last-updated dates.
- **Grouping:** reference pages group integrations into about six pages, and all packages go on one page with a section each.
  - This is a controller ruling. The spec said one page per integration and package. The spec's goal of fewer, accurate pages wins.
- **Tooling:**
  - Bun only. Run ultracite scoped to `apps/docs`.
  - `bun run check-types`, `bun run test` and `bun run build` with `--filter=docs` must pass at the end of every task.
  - Commits end with the session trailer.

## Review Focus

1. **A private value written into a page instead of a `<Private>` block.** Every reviewer runs the privacy check first.
2. **A command a stranger would run that targets production by accident.** Unset Appwrite env defaults to production. Pages must show how to point at a non-production project, and warn.
3. **A runbook step that relies on knowing something not written down.** The reviewer's actionability check covers this.
4. **Old developer docs leaking in.** `legacy/` is often wrong. Any claim copied from it without code evidence is cut.
5. **The registry-usage gate.** Task 8 flips `REQUIRE_REGISTRY_USAGE` to `true`. Every non-kit registry name must then be used by a page, or removed if no page needs it.

---

### Task 1: Runbook and drift-test follow-ups from Stage 3a

**Files:** Modify `apps/docs/CLAUDE.md` ("Private details", owner step 2) and `apps/docs/lib/auth/access.test.ts`.

- [ ] **Step 1: Extend owner step 2.** For each of the 10 trusted team ids, the owner must also check in the Appwrite console that the team has **no owner** and **no members you can't account for**. The M365 sync only ever adds `member` (`apps/admin/src/lib/m365-sync.ts` ~291), so an owner means someone created the team by hand. If so, delete the team and recreate it with the exact id and the sync's name, then redo the department-team setup. Don't use the IT team-health view for this check: it lowercases ids (`team-health.ts` `normalizeId`). Use the console.
- [ ] **Step 2: Extend the drift test.** Also pin the source of the name. The sync reads `group.displayName` (`m365-sync.ts` ~147). Assert that the source still contains that expression, with a message pointing at `access.ts`.
- [ ] **Step 3: Run the checks and commit** with the message `docs(docs): check trusted team ids for owners; pin the sync's name source`.

---

### Task 2: Start here (four pages)

**Files:**
- Create `apps/docs/content/docs/developers/start-here/` containing `meta.json`, `if-youre-hiring-someone.mdx`, `your-first-day.mdx`, `what-biso-runs.mdx` and `getting-access.mdx`.
- Modify `developers/meta.json` and `developers/index.mdx` (link the sections that now exist).

**Content:**
- **`if-youre-hiring-someone`** is written for the BISO board. It is a narrative page, so add it to `narrative-pages.json`. Cover:
  - what BISO owns: the code (public GitHub repo), the server, accounts, domains, and the app store listings
  - who holds the keys (`<Private name="account-owners" />`)
  - the emergency kit: that it exists, that the administration leader holds it, and when to use it (`<Private name="admin-leader-contact" />`)
  - what to give a consultant on day one: access to the docs, the `docs-handover` team, an Infisical login, and a GitHub collaborator invite
  - what to ask a consultant to do first: read "Your first day"
  - the critical known issue: the admin's role check. State that it is known and must be fixed, without exploit detail.
- **`your-first-day`:**
  - the reading order through the developer area
  - an access checklist: GitHub, the Appwrite console (`<Private name="appwrite-console-url" />`), Infisical (`<Private name="infisical-url" />`), and server access (`<Private name="server-access" />`)
  - the first safe things to do: local setup against a non-production project, read "What BISO runs", look at the issues list
- **`what-biso-runs`:**
  - one Mermaid system diagram: the browser and app, `biso.no` (web), `admin.biso.no`, `api.biso.no`, `docs.biso.no`, Appwrite (self-hosted, on the Webdock VPS), Infisical (self-hosted), the 3 functions, the Flutter app, and the external services grouped
  - a table of each component: what it does, where it runs, and its repo path
- **`getting-access`:**
  - every account and system, who grants it, and how
  - private details are in `<Private>` blocks; add registry names as needed, for example `github-org` or `webdock-account`, each with a safe description
  - the "Docs handover" team and how a consultant gets into it

- [ ] **Step 1: Write the pages**, per the writer instructions.
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): start here`.

---

### Task 3: Keep it running, part 1 (deploying, scheduled jobs, secrets and env vars)

**Files:** Create `developers/keep-it-running/` containing `meta.json`, `deploying.mdx`, `scheduled-jobs.mdx` and `secrets-and-environment.mdx`, and modify the parent `meta.json`.

**Content:**
- **`deploying`:**
  - For each app (web, admin, api, docs): how it is built (the `build:*:appwrite` scripts, standalone output) and how it is deployed today (manually in the Appwrite console, step by step, as far as the code and owner answers support).
  - Pushing to `main` does not deploy, and a GitHub workflow is planned. Note what such a workflow needs: `fetch-depth: 0` for last-updated dates, and the env vars.
  - The 3 Appwrite functions: how each is deployed (from its README/config) and the 330 s console timeout.
  - Android: CI to the Play internal track on push to `main` (BISO-Flutter repo).
  - iOS: a manual `flutter build ipa --release`, then upload.
  - "After a deploy, check" steps: the health endpoints.
- **`scheduled-jobs`:**
  - The `scheduled-dispatch` function (every 5 min, `x-cron-secret`), with a table of every endpoint it calls: what each does and what breaks if it stops.
  - `content-notifier` and `member-roster-sync`.
  - The webhooks.
  - Endpoints nothing calls (`cleanup-anon-users`).
- **`secrets-and-environment`:**
  - How secrets flow: Infisical is the source of truth for developers, and values are copied by hand into the Appwrite console for runtime.
  - Env var names by service, with which app reads each, required or optional, and build-time or runtime. Summarise from `developer-facts-ops.md` section 4; link a full table if it's long.
  - The warning that unset Appwrite env targets production, and how to avoid it.
  - Rotating a secret: what to update, where, and in what order.

- [ ] **Step 1: Write the pages.**
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): deploying, scheduled jobs, secrets`.

---

### Task 4: Keep it running, part 2 (monitoring, backups, when things break, yearly calendar)

**Files:** Create `monitoring-and-health.mdx`, `backups-and-recovery.mdx`, `when-things-break.mdx` and `yearly-calendar.mdx` in `keep-it-running/`, and update its `meta.json`.

**Content:**
- **`monitoring-and-health`:**
  - Better Stack uptime: what it watches; the account is `<Private>`.
  - Umami.
  - Each app's health endpoints and what they check.
  - Logs: where to find Appwrite function logs and app logs.
  - What isn't monitored.
- **`backups-and-recovery`:**
  - The Webdock nightly full-server backup includes encryption keys (owner).
  - What restoring brings back, and what an Appwrite restore needs (the encryption key, or the stored Vipps and Stripe keys can't be decrypted).
  - Infisical's own recovery (`<Private name="infisical-admin-recovery" />`) and the emergency kit, without its contents.
  - That no restore test has been reported. Recommend one.
- **`when-things-break`:** short runbooks in the form symptom → check → fix for:
  - site down
  - sign-in to the admin fails
  - payments fail (Vipps or Stripe)
  - push notifications not sending
  - scheduled jobs stopped
  - Appwrite down
  - Infisical down
  - an expired Azure secret (sign-in and Graph break)
  - AI features failing
- **`yearly-calendar`:**
  - The August board turnover: what's planned (Azure Automation retention via the admin) and what already exists in code (webhooks, cron), checked against the code.
  - Whose access gets added and removed: groups, the `docs-handover` team, Infisical and GitHub.
  - Renewals, with the owner's dates:
    - the Apple Developer membership and certificates (app certificate 2027-06-12; Wallet pass certificate 2027-10-17)
    - Google Play
    - domain certificates
    - the Azure app secrets (OAuth "probably 5 March 2027, check in the Azure portal"; "BISO Sites" being rolled now)
  - A checklist the next person can follow.

- [ ] **Step 1: Write the pages.**
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): monitoring, backups, runbooks, yearly calendar`.

---

### Task 5: Change it, part 1 (local setup, code layout, data model)

**Files:** Create `developers/change-it/` containing `meta.json`, `local-setup.mdx`, `code-layout.mdx` and `data-model.mdx`, and update the parent `meta.json`.

**Content:**
- **`local-setup`:**
  - Bun version, install, and the env files per app (names; `.env.example` files).
  - **How to point at a non-production Appwrite project, with a warning about production defaults.**
  - Ports, running each app, and the tests per app (`bun test` versus vitest).
  - check-types, Ultracite, and the hook status.
  - Common first-run failures, from section 2 of the code fact sheet.
- **`code-layout`:**
  - The monorepo: apps and packages with their purpose.
  - Turbo tasks and gotchas: `_transit`, strict env mode, the build env allow-list, remote cache off.
  - Where things live.
- **`data-model`:**
  - Two databases and about 100 tables, grouped by domain, with the key relationships.
  - Permission patterns.
  - Generating types (`bun run types:generate`) and what never to hand-edit.
  - Draft page permissions: describe them as "only published pages are publicly readable" (owner answer 8), and note this is a known schema issue the owner is fixing.

- [ ] **Step 1: Write the pages.**
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): local setup, code layout, data model`.

---

### Task 6: Change it, part 2 (auth and roles, common changes, the mobile app)

**Files:** Create `auth-and-roles.mdx`, `common-changes.mdx` and `the-mobile-app.mdx` in `change-it/`, and update its `meta.json`.

**Content:**
- **`auth-and-roles`:**
  - Admin: Azure via Appwrite OAuth, M365 group sync into teams, roles from teams, `NAV_ACCESS`.
  - Web: BI OIDC and magic link, with lazy anonymous sessions.
  - API: JWT.
  - The mobile app.
  - Cookie names and the `.biso.no` pitfalls.
  - Docs: reuses the admin session; access by exact team ids.
  - **State the known issue plainly.** The admin and API derive roles from team names, which any signed-in user can create. It is tracked and the owner will fix it. Recommend id-based checks, as the docs app does.
- **`common-changes`:** verified recipes from section 7 of the code fact sheet. Check each against current code:
  - add a route
  - add a server action
  - add an editor block
  - add a table or column
  - add an env var
  - add a translation string
  - add a nav item with role access
- **`the-mobile-app`:** BISO-Flutter.
  - Stack, and how it talks to Appwrite and `api.biso.no`.
  - Build and release: Android CI, and iOS by hand with `flutter build ipa --release`.
  - Signing and secrets by name; accounts in `<Private>` (`apple-developer-account`, `google-play-account`).
  - Known issues: the AI chat endpoint is missing, and the Xcode Cloud manifest is unused.

- [ ] **Step 1: Write the pages.**
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): auth and roles, common changes, mobile app`.

---

### Task 7: Reference (integrations, packages, design decisions, known limitations, history)

**Files:** Create `developers/reference/` containing:
- `meta.json`
- the integration pages:
  - `microsoft.mdx` (Entra, Graph, SharePoint, Teams bot, Azure Automation, BI OIDC)
  - `payments.mdx` (Vipps, Stripe, the payment-settings database row)
  - `accounting.mdx` (24SevenOffice/Finago)
  - `ai.mdx` (Anthropic, plus the OpenAI gate and leftovers; Pinecone unused)
  - `messaging-and-wallet.mdx` (SMTP, Appwrite Messaging/FCM, Apple and Google Wallet)
  - `events-and-content-sources.mdx` (Tickster, Entur, the legacy WordPress/WooCommerce)
- `packages.mdx`
- `design-decisions.mdx` (narrative)
- `known-limitations.mdx`
- `history.mdx` (narrative)

Update the parent `meta.json` and `narrative-pages.json`.

**Content:**
- **Each integration page:**
  - purpose
  - where the code lives
  - env vars by name
  - the account (`<Private>`)
  - what users see when it fails
  - how to test safely
- **`packages`:** one section per `@repo/*` package.
- **`design-decisions`:** summarise the major records in `docs/superpowers/specs/*.md`, with dates and why, plus the decisions recorded in CLAUDE.md files.
- **`known-limitations`:** an honest, current list, drawn from the code fact sheet's sharp edges and the ops fact sheet's "surprises". Group by severity. Keep it a short summary per item.
- **`history`:** how the platform got here: the WordPress era, the move to Next.js and Appwrite, and the major rebuilds. Use git history and the specs as evidence (`git log --reverse --format='%ad %s' --date=short | head`).

- [ ] **Step 1: Write the pages.**
- [ ] **Step 2: Run the checks and commit** with the message `docs(developers): reference`.

---

### Task 8: Wire-up — registry gate, redirects, developers index, landing

**Files:**
- Modify `apps/docs/lib/private/registry.test.ts` to flip `REQUIRE_REGISTRY_USAGE` to `true`, and `registry.ts` to remove unused names, if any are left.
- Modify `apps/docs/redirects.json` to add specific rules for legacy developer URLs that now have a clear successor, above the fallbacks. Go through `legacy-urls.json`'s `/docs/{architecture,developing,packages,integrations,operations,handover}/*` entries.
- Modify `developers/index.mdx` to give a short orientation, with links to each section.
- Optionally modify `apps/docs/lib/landing.ts`. If useful, add a "Developer or consultant" reading path: If you're hiring someone → Your first day → What BISO runs → Deploying → When things break.

- [ ] **Step 1: Make the changes.** Every redirect destination must be a live page, and the tests enforce this.
- [ ] **Step 2: Run the checks, including the leak check (`cd apps/docs && bun run check:private-leaks`), and commit** with the message `feat(docs): developer area wired into redirects, landing and the registry gate`.

---

### Task 9: Stage verification

- [ ] **Step 1: Run every check**, plus the leak check.
- [ ] **Step 2: Visual check.** Serve the build and screenshot each new page at 1300 px and at 375 px. Check:
  - that Mermaid renders
  - that `<Private>` boxes show the signed-out message with a sign-in link
  - that there is no horizontal scroll
- [ ] **Step 3: Accuracy and privacy spot check.** Pick 3 consequential claims per page and verify each against code or the owner answers. Then grep the built HTML for email patterns, IP patterns and `infisical` paths.
- [ ] **Step 4: Report.**
