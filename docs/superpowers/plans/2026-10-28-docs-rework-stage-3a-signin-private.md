# Docs rework, Stage 3a: Sign-in and private details — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let global admins, campus admins and members of a "Docs handover" Appwrite team see private details on docs pages. Everyone else sees a "sign in to see this" box. Private values come from Infisical at request time and never reach the public repo, static HTML, the search index, `llms-full.txt` or OG images.

**Architecture:**
- **Sign-in.** Docs reuses the admin's Microsoft sign-in. In production the admin session cookie `a_session_biso_admin` is set on `.biso.no`. Locally it is set host-only on `localhost`, and cookies ignore ports, so docs receives it either way. Docs validates the cookie with `@repo/api/server`'s `createSessionClient()`, configured through `APPWRITE_SESSION_COOKIE=a_session_biso_admin`, then reads the user's teams.
- **Who gets access.** A pure function in docs derives access from team names. A drift test pins it to the admin's role derivation.
- **"Sign in".** The button links to the admin login. The admin learns to redirect back to the docs origin, and only that exact origin.
- **Pages stay static.** A `<Private name="…" />` client component fetches values from a no-store API route, `/api/private`. The route checks the viewer and returns only values the viewer may see, from a `PrivateValueSource`: Infisical in production, a fake source for development and tests.
- **Registry.** Every private name is declared in a typed registry. That registry is the owner's list of what to put in Infisical.

**Tech Stack:** Next.js 16 route handlers, `@repo/api/server`, the Infisical REST API (universal-auth machine identity, read-only), `bun:test`.

**Spec:** `docs/superpowers/specs/2026-10-27-docs-rework-design.md`, sections "Private details" and "Constraints". Owner answers: `.superpowers/sdd/docs-rework-shared/owner-answers.md`.

**Work in:** worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/docs-rework`, branch `feat/docs-rework`. Never push, deploy, or touch production Appwrite or Infisical.

## Global Constraints

- **Who gets access:**
  - **Global admins:** members of both the National campus team and the OperationsUnit department team.
  - **Campus admins:** members of a campus team plus the matching `Ledelsen{City}` department team.
  - **Docs handover:** members of the Appwrite team with id `docs-handover`.
  - **Everyone else:** no access. That includes plain department members, HR and signed-out visitors.
  - The derivation must match `apps/admin/src/lib/roles.ts` and `apps/admin/src/lib/authorization.ts` (team-name parsing). A drift test pins this.
- **Never in static output:**
  - No private value may appear in any static HTML, RSC payload, search index, `llms-full.txt`, sitemap or OG image.
  - Values are returned only by `/api/private`, with `Cache-Control: no-store`, and only to an allowed viewer.
- **Never in the repo:** private values (owner names, emails, server addresses, group names, Infisical links, kit contents). The registry holds names and descriptions only.
- **Failure states, in the viewer's language:**
  - **Signed out:** "Sign in with your BISO admin account to see this."
  - **Signed in, no access:** "Your account doesn't have access to this."
  - **Source unavailable:** "This couldn't be loaded right now. Try again later."
  - The page always renders.
- **Env vars:** names only. Infisical: `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT`, `INFISICAL_SECRET_PATH`. Source selection: `DOCS_PRIVATE_SOURCE` = `infisical` | `fake` | `none`, default `none`. Fake data: `DOCS_PRIVATE_FAKE_FILE`. Cross-app links: `NEXT_PUBLIC_ADMIN_URL` on docs and `NEXT_PUBLIC_DOCS_URL` on admin. The session: `APPWRITE_SESSION_COOKIE` on docs. `NEXT_PUBLIC_*` vars go into `turbo.json` build env.
- **Tooling:**
  - Bun only. Run `bun x ultracite fix` on the touched app folders only.
  - `bun run check-types` and `bun run test` pass for `docs`, and for `admin` where it is touched.
  - Commits end with the session's attribution trailer.

## Review Focus

1. **An expired or revoked admin session cookie.** `/api/private` must treat it as signed out, never throw a 500, and never fall back to an API-key client. Test: Task 2.
2. **A redirect parameter pointing at a lookalike origin** (`https://docs.biso.no.evil.com`, `//docs.biso.no`, `https://docs.biso.no@evil.com`). The admin must reject it. Test: Task 3.
3. **Infisical slow or down.** `/api/private` returns the unavailable state within a bounded timeout, and the page still renders. Test: Task 4.
4. **A page uses a private name that isn't in the registry, or the registry lists a name no page uses.** The build or tests fail on the first, and the second needs an explicit `kitOnly` flag. Test: Task 5.
5. **A sentinel value from the fake source shows up in the build output.** Test: Task 6.

---

### Task 1: Access decision with a drift test

**Files:**
- Create: `apps/docs/lib/auth/access.ts`, `apps/docs/lib/auth/access.test.ts`

**Interfaces:**
- Produces:
  - `type DocsAccess = "globaladmin" | "campusadmin" | "docs-handover" | null`
  - `docsAccessFromTeams(teams: { $id: string; name: string }[]): DocsAccess`. The order of precedence is globaladmin, then campusadmin, then docs-handover.
  - `DOCS_HANDOVER_TEAM_ID = "docs-handover"`

- [ ] **Step 1:** Write the failing tests:
  - National + OperationsUnit → globaladmin.
  - Oslo campus + LedelsenOslo → campusadmin.
  - Oslo campus + LedelsenBergen → null.
  - HR department only → null.
  - Team `docs-handover` alone → docs-handover.
  - No teams → null.
  - Team-name matching uses the same normalisation as the admin (read `apps/admin/src/lib/authorization*.ts` for the exact rules: `SG-App-Campus-*`, `SG-App-Dept-*`, case).
  - **Drift test:** read the admin source files as text and assert that the constants and patterns `access.ts` mirrors are still present (for example the National/OperationsUnit pair and the Ledelsen prefix). If one changes, the test fails with a message pointing to `access.ts`.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement `access.ts`. It mirrors the admin logic and imports nothing from `apps/admin`.
- [ ] **Step 4:** Run `cd apps/docs && bun test lib/auth`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(docs): decide private-details access from Appwrite teams`.

---

### Task 2: Viewer from the admin session cookie

**Files:**
- Create: `apps/docs/lib/auth/viewer.ts`, `apps/docs/lib/auth/viewer.test.ts`
- Create: `apps/docs/app/api/viewer/route.ts`
- Modify: `apps/docs/package.json` (add `@repo/api` if it's missing), `turbo.json` (add `NEXT_PUBLIC_ADMIN_URL` to the build env)

**Interfaces:**
- Consumes: Task 1's `docsAccessFromTeams`.
- Produces:
  - `type Viewer = { signedIn: false } | { signedIn: true; name: string; access: DocsAccess }`
  - `getViewer(deps?: { loadAccount: () => Promise<{ name: string }>; loadTeams: () => Promise<{ $id: string; name: string }[]> }): Promise<Viewer>`
    - The default deps use `createSessionClient()` from `@repo/api/server`.
    - Any error from `loadAccount` (no cookie, 401, network) → `{ signedIn: false }`.
    - An error from `loadTeams` → signed in with `access: null`.
    - It never throws, and it never uses `createAdminClient`.
  - `GET /api/viewer` → `{ signedIn, name?, canSeePrivate }` with `Cache-Control: no-store`.

- [ ] **Step 1:** Write the failing tests with injected deps:
  - The account throws → signed out.
  - The teams throw → signed in with null access.
  - A global admin's teams → access globaladmin.
  - The module source must not contain `createAdminClient` (a static check in the test).
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement `viewer.ts` and the route. Document in `apps/docs/CLAUDE.md` that docs must run with `APPWRITE_SESSION_COOKIE=a_session_biso_admin`, plus the Appwrite endpoint and project vars. **Read the cookie-collision warning in `apps/web/CLAUDE.md` and confirm docs never sets cookies.**
- [ ] **Step 4:** Run the tests, `check-types` and the build. Expected: PASS.
- [ ] **Step 5:** Commit `feat(docs): read the signed-in viewer from the admin session`.

---

### Task 3: Sign-in link and the admin redirect back to docs

**Files:**
- Modify: `apps/admin/src/lib/utils.ts` (`sanitizeRedirectTarget`) and its test (create `apps/admin/src/lib/utils.test.ts` if there isn't one)
- Modify: `turbo.json` (add `NEXT_PUBLIC_DOCS_URL`)
- Create: `apps/docs/components/viewer-status.tsx` (client), shown in the docs header and the landing site header
- Modify: `apps/docs/app/(docs)/layout.tsx`, `apps/docs/components/landing/site-header.tsx`

**Interfaces:**
- `sanitizeRedirectTarget(input)` also accepts an absolute URL whose origin **exactly equals** `new URL(process.env.NEXT_PUBLIC_DOCS_URL).origin`, and returns it unchanged. Everything else behaves as before. With the var unset, no absolute URL is accepted.
- `ViewerStatus` fetches `/api/viewer`.
  - **Signed out:** a "Sign in" link to `${NEXT_PUBLIC_ADMIN_URL}/auth/login?redirectTo=${encodeURIComponent(location.href)}`.
  - **Signed in:** the first name, a "Private details on" marker when `canSeePrivate`, and no sign-out (sign out in the admin).
  - With `NEXT_PUBLIC_ADMIN_URL` unset, it shows nothing.

- [ ] **Step 1:** Write the failing admin tests:
  - The docs origin is accepted, with path and query preserved.
  - Rejected: `https://docs.biso.no.evil.com/x`, `https://docs.biso.no@evil.com/`, `//docs.biso.no/x`, `https:/docs.biso.no`, the docs origin with a different scheme or port.
  - With the var unset, no absolute URL passes.
  - Existing relative-path behaviour is unchanged.
- [ ] **Step 2:** Run `cd apps/admin && bun test src/lib/utils.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Check that every caller of `sanitizeRedirectTarget` (the OAuth success URL builder in `apps/admin/src/lib/server.ts`, the login page and the OAuth route) still behaves as intended with an absolute docs URL. Then add the `ViewerStatus` UI in the brand style (white text on navy, focus ring).
- [ ] **Step 4:** Run the admin and docs tests, `check-types` for both, and the docs build.
- [ ] **Step 5:** Commit `feat: sign in to the docs through the admin`.

---

### Task 4: Private value sources

**Files:**
- Create: `apps/docs/lib/private/source.ts`, `apps/docs/lib/private/infisical.ts`, `apps/docs/lib/private/fake.ts`, plus tests for each

**Interfaces:**
- `interface PrivateValueSource { get(names: string[]): Promise<Record<string, string | undefined>> }`. A missing name maps to `undefined`.
- `createInfisicalSource(env, fetchImpl = fetch): PrivateValueSource`:
  - Logs in with universal auth: `POST {INFISICAL_SITE_URL}/api/v1/auth/universal-auth/login` with `{ clientId, clientSecret }`.
  - Reads the secrets under `INFISICAL_SECRET_PATH` in `INFISICAL_ENVIRONMENT` for `INFISICAL_PROJECT_ID` through the raw-secrets endpoint. Check the current API path and parameters in Infisical's docs; only read endpoints are allowed.
  - Caches the token and the values in memory for 5 minutes.
  - Times out each request after 3 seconds with `AbortSignal.timeout`.
  - Throws `PrivateSourceUnavailable` on any failure.
- `createFakeSource(filePath?)`: reads a JSON object of name → value. Used only when `DOCS_PRIVATE_SOURCE=fake`.
- `getPrivateSource(env): PrivateValueSource | null`: `null` for `none`. It throws a clear error when `infisical` is chosen but a required var is missing.

- [ ] **Step 1:** Write the failing tests with a mocked `fetch`:
  - Login, then fetch, maps names to values.
  - A second call within 5 minutes makes no new requests.
  - A timeout → `PrivateSourceUnavailable` (use a fake fetch that never resolves, with a short injected timeout).
  - A 401 → unavailable.
  - The fake source reads its file.
  - `getPrivateSource` selection, including missing-var errors.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement. Never log secret values or the token.
- [ ] **Step 4:** Run the tests and `check-types`.
- [ ] **Step 5:** Commit `feat(docs): private values from Infisical (read-only) or a fake source`.

---

### Task 5: Registry, `/api/private` and the `<Private>` component

**Files:**
- Create: `apps/docs/lib/private/registry.ts`, `apps/docs/lib/private/registry.test.ts`
- Create: `apps/docs/app/api/private/route.ts`, `apps/docs/app/api/private/route.test.ts`
- Create: `apps/docs/components/private.tsx` (client)
- Modify: `apps/docs/mdx-components.tsx`

**Interfaces:**
- `PRIVATE_VALUES` in `registry.ts`: a `const` record of `name → { description: string; kitOnly?: boolean }`. It starts with the entries the Stage 3b pages will need. Seed it with these, refining descriptions as needed:
  - `appwrite-console-url`
  - `server-provider-account`
  - `server-access`
  - `infisical-url`
  - `infisical-admin-recovery`
  - `admin-leader-contact`
  - `emergency-kit-contents` (`kitOnly`)
  - `docs-handover-team`
  - `account-owners`
  - `apple-developer-account`
  - `google-play-account`
  - `azure-app-registration`
- `type PrivateName = keyof typeof PRIVATE_VALUES`.
- `GET /api/private?names=a,b`:
  - Takes 1–20 names. Unknown names → 400.
  - The viewer comes from Task 2. Signed out → 200 `{ state: "signed-out" }`. No access → 200 `{ state: "forbidden" }`.
  - Allowed → `{ state: "ok", values }`, using only the requested names.
  - Source missing or failing → `{ state: "unavailable" }`.
  - Always `Cache-Control: no-store`.
  - Testable through injected `getViewer` and source.
- `<Private name="…" label?="…" />`:
  - Client component. Batches the fetch for every `Private` on the page through a small context or a module-level batcher.
  - Renders the value in a monospace-free inline code style, or one of the three failure messages from Global Constraints.
  - No private text in its server-rendered HTML: until the fetch finishes it shows only the neutral "Sign in…" or a loading skeleton.

- [ ] **Step 1:** Write the failing tests:
  - Route: all four states; unknown name → 400; more than 20 names → 400; `no-store` set; a forbidden viewer never triggers a source call.
  - Registry: every `<Private name="x"` found in `apps/docs/content/**/*.mdx` is a registry key; every registry key that isn't `kitOnly` is used by at least one page.
  - The registry test **must skip the "used" half** until Stage 3b pages exist. Do this with a clearly named exported flag, `REQUIRE_REGISTRY_USAGE = false`, that Stage 3b flips to `true`. Add a comment saying so.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement and register `Private` in `mdx-components.tsx`.
- [ ] **Step 4:** Run the tests, `check-types` and the build.
- [ ] **Step 5:** Commit `feat(docs): Private blocks fetched per viewer`.

---

### Task 6: Leak test and runbook

**Files:**
- Create: `apps/docs/scripts/private-leak-check.ts`, `apps/docs/scripts/private-leak-check.test.ts`
- Modify: `apps/docs/package.json` (script `"check:private-leaks"`), `apps/docs/CLAUDE.md` (a "Private details" section)
- Create: a temporary test page (fixture only)

**Interfaces:**
- `findLeaks(dir: string, sentinels: string[]): { file: string; sentinel: string }[]` scans every file under `dir`.
- The CLI:
  1. Writes a temporary fake-values file with random sentinel values for every registry name.
  2. Builds docs with `DOCS_PRIVATE_SOURCE=fake` and `DOCS_PRIVATE_FAKE_FILE` pointing at it, plus a temporary fixture page that uses every registry name, created and removed by the script.
  3. Scans `apps/docs/.next` (including `server/app`, static chunks, the search route output and `llms-full.txt` if prerendered).
  4. Fails on any hit.
  5. Always cleans up the fixture page, even on failure.

- [ ] **Step 1:** Write a failing unit test for `findLeaks` against a temp dir.
- [ ] **Step 2:** Implement `findLeaks` and the CLI, then run `bun run check:private-leaks` in `apps/docs`. Expected: no leaks found, and the fixture removed (`git status` clean).
- [ ] **Step 3:** Write the "Private details" section of `apps/docs/CLAUDE.md`:
  - How to use `<Private>`; the registry, and why values never go in pages.
  - Env vars by name.
  - Local development with the fake source.
  - The owner actions: create the Infisical folder and a read-only machine identity scoped to it; set the docs Appwrite site env; create the `docs-handover` team; set `NEXT_PUBLIC_DOCS_URL` on the admin and `NEXT_PUBLIC_ADMIN_URL` on the docs.
- [ ] **Step 4:** Commit `feat(docs): leak check for private values, and the private-details runbook`.

---

### Task 7: Stage verification

- [ ] **Step 1:** Run ultracite on `apps/docs` and `apps/admin`, `check-types` and `test` for both, `build --filter=docs`, and `check:private-leaks`.
- [ ] **Step 2:** Serve the build. With no session, a page with a fixture `<Private>` shows the sign-in message. `curl` `/api/private?names=…` without a cookie returns signed-out with `no-store`. `/api/viewer` returns signed out. The landing and the docs header show "Sign in", linking to the admin login with an encoded `redirectTo`.
- [ ] **Step 3:** Report.
