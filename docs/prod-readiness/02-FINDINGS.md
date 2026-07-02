> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

# Production-Readiness Audit — Findings Ledger

Format per finding: **ID · severity · app/package · title**, then what breaks
+ the production condition that triggers it, evidence, recommended fix, and
status.

All findings below are `status: open` unless noted otherwise. Where the
observation record didn't give an unambiguous PR-number↔content mapping, the
finding is marked **(reconstructed mapping)** — the underlying fact is
attested in session memory, but the exact numbering/severity slotting is a
best-effort reconstruction, not a verbatim recovery.

---

## S01 — Build, deploy & CI

### PR-001 · high · `functions/scheduled-dispatch`, `apps/api` · cleanup-anon-users not wired to the cron dispatcher
**What breaks / condition:** A `cleanup-anon-users` route exists but isn't
triggered by the `scheduled-dispatch` Appwrite function. The repo's Vercel
cron config references it, but the app is deployed on Appwrite (not Vercel),
so that cron definition never fires. Anonymous Appwrite sessions/users
accumulate unbounded in production.
**Evidence:** `functions/scheduled-dispatch` source; Vercel cron config vs.
actual deployment target (Appwrite).
**Fix:** Add `cleanup-anon-users` to the `scheduled-dispatch` function's list
of secret-gated endpoints it pings on schedule, and register the schedule in
the Appwrite console.
**Status:** open.

### PR-002 · medium · `apps/web` (build tooling) · dangling `styled-jsx` symlink breaks web's Appwrite flatten script
**What breaks / condition:** `bun run build:web:appwrite` exits 1 on
macOS/BSD: the standalone output contains a dangling symlink at
`apps/web/.next/standalone/node_modules/.bun/node_modules/styled-jsx` (Bun
cache path) whose target directory doesn't exist in the traced output. The
flatten script's `cp -r` aborts entirely when it hits the dangling symlink,
leaving the bundle incomplete (no root `server.js` wrapper, no static/public
assets copied). `build:admin:appwrite` succeeds because admin's flatten
script uses `tar` (tolerant of missing paths) instead of `cp -r`.
`api`/`docs` also use `cp -r` but don't currently hit a dangling symlink.
**Evidence:** `package.json` flatten scripts (`build:*:appwrite`);
`apps/web/.next/standalone/node_modules/.bun/node_modules/styled-jsx`
symlink target `../styled-jsx@5.1.6+b1ab299f0a400331/node_modules/styled-jsx`
(missing); `apps/web/next.config.ts` (`outputFileTracingRoot`).
**Fix:** Either switch web's (and api's/docs's) flatten script to the
tar-based approach admin uses, or fix Next.js output-file-tracing so
styled-jsx's target directory is included in the standalone output.
**Status:** open.

### PR-003 · low · `apps/web`, `apps/api` · Dockerfiles reference stale paths
**What breaks / condition:** web/api Dockerfiles reference a nonexistent
`bun.lockb` (repo uses `bun.lock`), have incorrect paths, and set
`HOSTNAME=localhost`. `apps/admin`'s Dockerfile is correct. Low impact since
the actual deploy path is Appwrite build-on-platform, not these Dockerfiles,
but they'd fail if anyone tried to build/run them directly.
**Evidence:** `apps/web/Dockerfile`, `apps/api/Dockerfile` vs.
`apps/admin/Dockerfile`.
**Fix:** Align web/api Dockerfiles with admin's pattern; fix lockfile
filename and `HOSTNAME`.
**Status:** open.

### PR-004 · low · `packages/api/server.ts` · dead copy-paste typo env var
**What breaks / condition:** A doubled-prefix env var name
`NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT` appears in
`@repo/api/server.ts` — a copy-paste typo. Dead code; the correctly named
`NEXT_PUBLIC_APPWRITE_ENDPOINT` is what's actually read/used elsewhere.
**Evidence:** `packages/api/server.ts`.
**Fix:** Remove the dead typo'd reference.
**Status:** code-remediated locally and verified.

### PR-005 · low · `apps/docs` · `metadataBase` not set
**What breaks / condition:** Docs app doesn't set Next.js metadata's
`metadataBase`, so Open Graph/Twitter image URLs resolve against
`http://localhost:3000` in production instead of the real docs domain.
**Evidence:** `apps/docs` metadata config; build-time warnings.
**Fix:** Set `metadataBase` to the production docs URL.
**Status:** open.

### PR-006 · low · `apps/web` · `/sitemap.xml` dynamic-server-usage warnings at build
**What breaks / condition:** The sitemap route calls `cookies()`, which
forces dynamic (request-time) rendering instead of static pre-generation.
The route still works correctly at runtime, just uncached/regenerated on
every request instead of being a static asset.
**Evidence:** `bun run build` output — 5 "Dynamic server usage" error
instances during `/sitemap.xml` static generation.
**Fix:** Remove the `cookies()` dependency from the sitemap route (or
explicitly mark it `force-dynamic` and accept the tradeoff) so build output
doesn't log spurious errors.
**Status:** open.

### PR-007 · medium · `turbo.json` · build env allow-list incomplete
**What breaks / condition:** `turbo.json`'s `tasks.build.env` allow-list is
missing ~20+ server-runtime environment variables that are actually read at
build/runtime. Per project convention (`CLAUDE.md`), any undeclared
build-time env var breaks Turbo cache correctness — builds may be served
from a stale cache when an undeclared var changes. This does not misconfigure
production (these are server-runtime reads, not build-inlined values); it's
a cache-correctness gap, not a prod outage risk. Tied to launch gate `B1`.
**Evidence:** `turbo.json` vs. grep of `process.env.*` reads across apps.
**Fix:** Add the missing vars to `turbo.json#tasks.build.env`.
**Status:** open. (Gate `B1` marked `⚠️ accepted-risk` for launch — see
`03-LAUNCH-GATE.md`.)

---

## S02 — Dependencies, config & secrets

### PR-008 · high · whole repo (`next` catalog dependency) · unpatched Next.js 16.2.2
**What breaks / condition:** Root `package.json` catalog pins
`next@16.2.2`. `bun audit` flags 8 high-severity vulnerabilities in the
range `>=16.0.0 <16.2.5`, which includes 16.2.2 — among them
middleware/proxy-layer bypasses (a follow-up fix to an earlier incomplete
patch), dynamic-route-parameter injection bypass, Pages Router i18n bypass,
App Router segment-prefetch bypass, two Server Component DoS vectors, an
SSRF via WebSocket upgrade, and a Cache Components connection-exhaustion DoS.
All 4 apps + `@repo/ai`, `@repo/api`, `@repo/ui` are affected. This is
reachable pre-auth on the public `web` app. `packages/ai` already pins the
more permissive `>=16.2.2`, suggesting the intended patched floor is
`16.2.5+`.
**Evidence:** `bun audit` output (`docs/prod-readiness/scans/audit.txt`);
root `package.json` line 33; `bun.lock` (single resolved `next@16.2.2`
across all consumers).
**Fix:** Bump the catalog `next` version to `>=16.2.5` (or later patched
release) and redeploy all 4 Appwrite sites. Tracked as owner action `O-08`.
**Status:** open. Flagged in session memory as a near-blocker candidate for
S20/S10 triage given the trivial fix and public-facing pre-auth exposure.

### PR-009 · medium · `packages/connectors` (soap), `apps/api` (botbuilder) · unpatched transitive high vulns, runtime-reachable
**What breaks / condition:** `soap` (used for the 24SevenOffice ERP
integration) pulls in `@xmldom/xmldom <0.8.13` (4 high vulns: uncontrolled
recursion DoS, XML injection via DOCTYPE/PI/comment serialization).
`botbuilder` (Teams bot integration in `api`) pulls in `axios >=1.0.0
<1.15.2` (11 high vulns: prototype pollution enabling credential theft/MITM,
`NO_PROXY` bypass, ReDoS via cookie injection, proxy-auth leak on
redirects). Both `soap` and `botbuilder` are regular (not dev) dependencies,
so these are runtime-reachable production attack surfaces, not just build
noise. Practical exploitability is assessed as lower because both
integrations talk to trusted peers (24SevenOffice, Microsoft Teams/Bot
Framework), but the vulnerable code paths are live.
**Evidence:** `bun audit` output; `packages/connectors/package.json`
(`soap`), `apps/api/package.json` (`botbuilder`).
**Fix:** Upgrade `soap`/`@xmldom/xmldom` and `botbuilder`/`axios` to patched
versions where available; if no patched `botbuilder` exists yet, pin a
patched transitive `axios` via package overrides.
**Status:** open.

### PR-010 · low · `apps/docs`, `apps/api` (build/dev/test tooling), `packages/i18n` · build-time-only unpatched high vulns
**What breaks / condition:** `vite >=8.0.0 <=8.0.15` (3 vulns: dev-server
`server.fs.deny` bypass, arbitrary file read via WebSocket) affects `docs`
and `api` vitest builds but is dev/build-time only, not shipped to
production. `@parvineyvazov/json-translator` (used only by
`packages/i18n`'s `scripts/translate.ts` maintenance script — confirmed via
grep, zero runtime imports) carries transitive `axios`/`undici`/`form-data`
vulns, but is not imported by any runtime code path. `lodash` code
injection and `tmp` path traversal round out this bucket.
**Evidence:** `bun audit` output; `packages/i18n/package.json` +
`packages/i18n/scripts` (no runtime imports of json-translator found).
**Fix:** Upgrade when convenient; not launch-blocking since these paths
aren't exposed in the deployed apps.
**Status:** open.

### PR-011 · medium · `apps/web`, `apps/admin`, `apps/api` · `.env.example` parity gaps — undocumented vars read at runtime
**What breaks / condition:** Several env vars are read by app code but
absent from the corresponding `.env.example`, creating an onboarding/deploy
risk: an operator following `.env.example` will under-configure the
deployment. Specifically: `apps/web` reads 7 undocumented vars
(`APPWRITE_CAMPUS_BOARD_FUNCTION_ID`, `APPWRITE_DATABASE_ID`,
`APPWRITE_PROJECT_ID`, `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID`,
`CRON_SECRET`, `NEXT_PUBLIC_APPWRITE_PROJECT_ID`,
`RECRUITMENT_BOOKING_SECRET`); `apps/admin` reads 2
(`CRON_SECRET`, `NEXT_PHASE`); `apps/api` reads 3 (`AZURE_CLIENT_SECRET`,
`EXPENSE_APPROVAL_WEB_URL`, `NEXT_PUBLIC_WEB_BASE_URL`). Two sub-risks are
notable: (1) `apps/web/src/app/api/checkout/return/route.ts` reads
`APPWRITE_DATABASE_ID!` and `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID!` with
non-null assertions — if unset, the payment-return handler throws at
runtime; (2) `apps/web/src/app/api/cron/cleanup-reservations/route.ts`'s own
code comment states that outside production an unset `CRON_SECRET` allows
unauthenticated calls to the cleanup route — if an operator misses
configuring it (which `.env.example` gives them no reason to expect), the
production authorization posture of that route depends entirely on
`NODE_ENV` being correctly set, which is worth explicit verification rather
than assumption.
**Evidence:** `apps/web/.env.example`, `apps/admin/.env.example`,
`apps/api/.env.example` vs. grep of `process.env.*` reads;
`apps/web/src/app/api/checkout/return/route.ts:60–80`;
`apps/web/src/app/api/cron/cleanup-reservations/route.ts:17,31–34`;
`apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:123`
(`AZURE_CLIENT_SECRET!`); `apps/web/src/app/actions/booking.ts:18`
(`RECRUITMENT_BOOKING_SECRET`, no fallback).
**Fix:** Add every var above to the relevant `.env.example` with a
description; replace non-null assertions on external config with explicit
checked errors; confirm (owner action `O-02`/`O-03`/`O-04`) that
`CRON_SECRET` is actually set in both the `web` and `admin` Appwrite site
consoles.
**Status:** open.

### PR-012 · medium · `apps/api` (payment checkout) · `NEXT_PUBLIC_WEB_BASE_URL` build-inlined but undocumented
**What breaks / condition:** `apps/api/src/app/api/payment/[provider]/checkout/route.ts:44`
reads `process.env.NEXT_PUBLIC_WEB_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL`
to build the payment redirect URL. Because of the `NEXT_PUBLIC_` prefix this
value is build-inlined for the `api` app, not just server-read — it must be
set at **build time**, not just runtime. It's missing from
`apps/api/.env.example`. If unset at build time, the payment redirect falls
back to `NEXT_PUBLIC_BASE_URL` (the api app's own domain) instead of the web
app's domain, which would send users to the wrong host after paying.
**Evidence:** `apps/api/src/app/api/payment/[provider]/checkout/route.ts:44`;
`apps/api/.env.example` (absent).
**Fix:** Document `NEXT_PUBLIC_WEB_BASE_URL` in `apps/api/.env.example` and
confirm (owner action `O-07`) it's set as a build-time variable for the api
app's Appwrite build, not just a runtime var.
**Status:** open.

### PR-013 · low · `packages/ai/src/utils/document-utils.ts` · dead `NEXTAUTH_URL` fallback
**What breaks / condition:** A third-tier fallback to `NEXTAUTH_URL` exists
in a base-URL resolution chain, left over from a prior NextAuth-based
architecture. It's not actively configured anywhere and is harmless dead
code, but signals stale references worth cleaning up.
**Evidence:** `packages/ai/src/utils/document-utils.ts:31`.
**Fix:** Remove the dead fallback branch.
**Status:** open.

### PR-014 · low · repo-wide (git history) · gitleaks flags — all confirmed false positives
**What breaks / condition:** Nothing in production; documented here to
close the loop, not as a live risk. `gitleaks` flagged 12 potential secrets
across 598 commits. Investigation confirmed: 11 hits are a repeated
20-character hex string that is actually an Appwrite `twoWayKey` schema
relationship ID inside `packages/api/appwrite.config.json` (schema
metadata, not a credential — it appears nowhere else in the codebase). The
12th hit is a hardcoded UUID test fixture in
`packages/payment/src/vipps/webhook.test.ts` used only to exercise HMAC
signature-verification logic in tests; it appears nowhere else and is not a
production webhook secret.
**Evidence:** `docs/prod-readiness/scans/gitleaks-history.json`;
`packages/api/appwrite.config.json`;
`packages/payment/src/vipps/webhook.test.ts:5–8`.
**Fix:** None required for launch. Optional hygiene: replace the hardcoded
test UUID with a per-run generated fixture to avoid future false-positive
noise in secret scanners.
**Status:** open (documentation-only closure; no rotation needed). Confirms
launch gates `C1`/`C2` pass — see `03-LAUNCH-GATE.md`.

---

## S03 — Security & authorization architecture

Full narrative reconstruction of the authorization chain lives in
`04-AUTHZ-MODEL.md`. This section is the findings-ledger view.

### PR-015 · **blocker** · `apps/admin` · M365 user-creation never assigns Azure security-group membership
**What breaks / condition:** `createM365User()`
(`apps/admin/src/app/(portal)/_actions/it-users.ts`) calls Microsoft Graph
`createUser()`, optionally sets a manager, and creates the corresponding
Appwrite user row — but no `addUserToGroup` (or equivalent Graph
group-membership write) call was found anywhere in the creation path. The
authorization chain (`04-AUTHZ-MODEL.md`) is: Azure security group → M365
user provisioning → Appwrite team creation → role derivation → row RLS. If
a newly created user is never placed into the relevant `SG-App-Campus-*` /
`SG-App-Dept-*` Azure security group, their first admin sign-in triggers
`syncM365Permissions()`, which reads (via `transitiveMemberOf`) an **empty**
group list, creates no Appwrite team memberships, and the user ends up with
zero roles and zero access — a fully provisioned M365/Azure AD account that
is a dead end in the authorization model. This exactly matches a gap the
repo owner had already suspected going into S03.
**Evidence:** Original gap verified in `apps/admin/src/app/(portal)/_actions/it-users.ts`;
the local remediation now derives `SG-App-Campus-*` / `SG-App-Dept-*` groups,
requires them to exist, and calls `graph.addUserToGroup()` before reporting
M365 user creation success. Regression coverage:
`apps/admin/src/app/(portal)/_actions/it-users.test.ts`.
**Fix:** Code-remediated locally 2026-07-02. New users are assigned the required
Azure security groups during `createM365User()`, and missing/failed group writes
fail loudly with audit context instead of silently creating a zero-access user.
Owner still needs a real Azure tenant test user to verify Graph permissions and
live group names.
**Status:** code-remediated and locally verified; owner Azure live verification pending before full closure.

### PR-016 · high · `apps/admin/src/lib/m365-sync.ts` · team-ID derivation has no Unicode sanitization
**What breaks / condition:** Team IDs are derived via
`azureDisplayName.toLowerCase()` only (`m365-sync.ts:22`) — no
normalization or sanitization for non-ASCII characters (Norwegian æ/ø/å),
spaces, or other special characters. Appwrite team IDs must match
`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$`. Any Azure security group whose display
name contains these characters will fail team creation or lookup, silently
denying access to every user in that group — the same failure mode as
PR-015 (zero team membership → zero authorization) but triggered by naming
rather than a missing write call.
**Evidence:** `apps/admin/src/lib/m365-sync.ts:22`.
**Fix:** Add explicit sanitization (normalize diacritics / strip or
transliterate non-ASCII characters, enforce the allowed character set and
length) before using a derived value as an Appwrite team ID. Re-run sync
against existing Azure groups with non-ASCII names to confirm no ID
collisions or failures. Tracked as owner action `O-18`.
**Status:** open.

### PR-017 · **blocker** · `packages/api/appwrite.config.json` (schema, whole-repo impact) · 31 of 82 collections grant over-permissive `create()`
**What breaks / condition:** Collection-level (table-level) `$permissions`
in the Appwrite schema grant `create("any")` (unauthenticated) on 3 tables —
`orders`, `cart_reservations`, `approval_requests` — and `create("users")`
(any authenticated user, regardless of team/role) on 28 more, including
high-value tables: `payments`, `expense`, `expense_attachments`, `user`,
`jobs`, `webshop_products`, `events`, `news`, `pages`, and others. Appwrite
evaluates collection permissions as an **OR** with row (`$permissions`)
permissions — if the collection allows it, the row-level check is bypassed
entirely for that operation. This directly contradicts the intended
authorization model (Azure group → Appwrite team → role-gated row RLS): any
authenticated user (or, for 3 tables, any anonymous visitor) can create
rows in these tables today, independent of team membership or role. The
admin app's `PERMISSIONS_REVIEW.md` Phase 2 hardening (see
`04-AUTHZ-MODEL.md`) fixed *read* isolation for draft/unpublished content
but did not touch collection-level *create* grants — this gap predates and
survives that hardening work.
**Evidence:** `packages/api/appwrite.config.json` previously granted broad
collection creates; local remediation removes every `create("any")` and
`create("users")` grant and adds `packages/api/appwrite-config.test.ts` to
prevent regression. Legitimate self-service creates were moved behind
authenticated/admin server writes with per-user row permissions for cart
reservations, benefit reveals/interactions, public/profile rows, and expenses.
**Fix:** Code/config-remediated locally 2026-07-02. Owner still needs to push the
schema and verify live Appwrite collection permissions match source.
**Status:** code/config-remediated and locally verified; owner Appwrite live permission verification pending before full closure.

### PR-018 · high · Appwrite schema/runtime (whole repo) · RLS backstop is non-idempotent — stale access persists
**What breaks / condition:** Per-row `$permissions` are set additively at
document-creation/update time by application code (e.g.
`buildContentRowPermissions()`, `buildRecruitmentStaffRowPermissions()`),
but nothing in the sync flow **retracts** previously granted row access
when a user's team membership or role changes — e.g. after a department
transfer, a promotion/demotion, or offboarding. Because the M365 sync
(`syncM365Permissions`) only adds team memberships found in the user's
current Azure groups (via `createMembership`/`updateExistingMembership`,
see `04-AUTHZ-MODEL.md`) and there's no corresponding step that removes a
user from an Appwrite team they've lost, and no step that re-stamps or
prunes row-level permissions on already-created rows, previously granted
access on existing documents outlives the access grant that created it.
**Evidence:** `apps/admin/src/lib/m365-sync.ts` (additive sync flow, no
membership-removal or permission-revocation path found); `apps/admin/src/lib/utils.ts`
(row-permission builders run only at write time, not on a schedule).
**Fix:** Add a periodic reconciliation job (or an explicit revoke-on-sync
step) that removes Appwrite team memberships no longer backed by an Azure
group and/or re-stamps row permissions for affected documents. Tracked as
owner action `O-19`. This is a design decision, not a one-line fix — likely
needs its own follow-up session (see S06/S07 in `00-PLAN.md`).
**Status:** open.

### PR-019 · high · `packages/api/appwrite.config.json` · duplicate `departments` table ID
**What breaks / condition:** The table ID `departments` is defined twice in
the schema file. Appwrite collection IDs must be unique; this is an invalid
configuration that will error or behave unpredictably on `appwrite push` /
deploy, and risks two divergent definitions of the same logical collection
existing in source.
**Evidence:** `packages/api/appwrite.config.json` (duplicate `departments`
table ID entries).
**Fix:** Identify which definition is authoritative, remove the duplicate,
and redeploy the schema. Verify in the Appwrite console that only one
`departments` collection exists post-fix. Tracked as owner action `O-16`.
**Status:** open.

### PR-020 · high · `apps/admin/src/lib/team-provisioning.ts` · department-team create grants are redundant given PR-017
**What breaks / condition:** `grantTeamContentAccess(teamId)` and
`grantTeamRecruitmentAccess(teamId)` add `create("team:sg-app-dept-*")` (or,
for HR, `create("team:sg-app-dept-hr")`) to content/recruitment tables under
the implicit assumption that this is what gates who can create rows in
those tables. But per PR-017, the same tables already carry a
collection-level `create("users")` grant that supersedes the team-scoped
grant (any authenticated user can create regardless of team membership) —
so the department-team provisioning code is not actually providing the
access control its authors intended; it's decorative on top of an
already-open door.
**Evidence:** `apps/admin/src/lib/team-provisioning.ts`
(`grantTeamContentAccess`, `grantTeamRecruitmentAccess`); cross-reference
with `packages/api/appwrite.config.json` collection permissions (PR-017).
**Fix:** Resolve alongside PR-017's table-by-table decision — once
collection-level create is tightened to team-scoped-only where appropriate,
this provisioning code becomes the actual (not decorative) enforcement
layer, and no further action is needed here beyond that.
**Status:** open.

### PR-021 · high · recruitment PII tables (`job_applications`, `candidate_profiles`, `job_interviews`) · possible re-exposure of GDPR gap via collection-level create
**What breaks / condition:** `apps/admin/PERMISSIONS_REVIEW.md` (Finding D,
GDPR) documents that recruitment PII tables were previously hardened so
that table-level read/update/delete grants are restricted to Operations
Unit + HR teams, with per-row permissions via
`buildRecruitmentStaffRowPermissions()`. `grantTeamRecruitmentAccess()` is
correctly a no-op for non-HR department teams. However, S03's collection-permission
audit (PR-017) found 31 tables with over-permissive `create()` grants, and
recruitment tables were not confirmed excluded from that list at the time
these observations were recorded. If any recruitment PII table is among the
31, HR-only creation intent is not enforced at the collection layer,
re-opening (for the *create* path specifically — reads were already fixed)
the GDPR exposure Finding D was meant to close. **(reconstructed mapping —
exact table-by-table overlap between PR-017's 31-table list and the
recruitment PII tables needs explicit confirmation; treat as high pending
that confirmation, not yet proven.)**
**Evidence:** `apps/admin/PERMISSIONS_REVIEW.md` (Finding D); PR-017's
table enumeration; `apps/admin/src/lib/team-provisioning.ts`
(`grantTeamRecruitmentAccess`).
**Fix:** Confirm (owner action `O-15`) whether `job_applications`,
`candidate_profiles`, `job_interviews` carry collection-level
`create("users")`; if so, tighten to HR/Operations-Unit team-scoped create
only.
**Status:** open.

### PR-022 · medium · `apps/admin/src/app/(auth)/auth/oauth/route.ts` · OAuth callback silently swallows M365 sync errors
**What breaks / condition:** The OAuth callback calls
`syncM365Permissions(userId)` and swallows any error it throws (fails safe
— the user isn't crashed, they just get no role). This is a reasonable
safety choice, but it means a failed sync (including instances of PR-015 or
PR-016) is invisible to both the user and operators: there's no log,
metric, or alert. Provisioning failures are only discovered when a user
reports "I can't see anything in the admin," which could be hours or days
after the failure.
**Evidence:** `apps/admin/src/app/(auth)/auth/oauth/route.ts:35–42`.
**Fix:** Add structured logging/alerting on sync failure so operators can
detect provisioning gaps proactively instead of via user reports.
**Status:** open.

### PR-023 · medium · `apps/admin/src/lib/m365-sync.ts` · sync idempotency relies on HTTP-error-code control flow
**What breaks / condition:** `syncTeamMembership()` establishes idempotency
by attempting `teams.createMembership()` first, then branching on the
caught error: a `404` means the team doesn't exist yet (so it creates the
team then adds membership), a `409` means the user is already a member (so
it calls `updateExistingMembership()` to refresh roles). This works today,
but it's control flow built on top of Appwrite SDK error codes/semantics
rather than explicit existence checks — a change in Appwrite's error
behavior (or an unrelated 404/409 from a different cause) could silently
change this function's behavior. No test was confirmed to cover this exact
branch logic. **(reconstructed mapping — inferred maintainability/fragility
risk from the described pattern, not an explicitly labeled "finding" in the
source session.)**
**Evidence:** `apps/admin/src/lib/m365-sync.ts:51–56`.
**Fix:** Consider an explicit existence check (list-then-act) instead of
error-code branching, or at minimum add a regression test that pins the
404/409 branch behavior.
**Status:** open.

### PR-024 · medium · `apps/admin/src/lib/authorization.ts` · `React.cache()`-wrapped role lookup extends stale-access window
**What breaks / condition:** `getUserAuthContext()` is wrapped in
`React.cache()`, which is good for performance (one Appwrite `teams.list()`
round-trip per RSC render, shared across consumers) but means a
mid-session team/role change (e.g. an admin revoking another user's team
membership) doesn't take effect for that user until their next full
render/navigation — a session-lifetime extension of the stale-access window
already created by PR-018's non-idempotent sync. **(reconstructed mapping —
inferred from the described caching behavior; not independently confirmed
as a "finding" in the source session, but a direct and material consequence
of documented code.)**
**Evidence:** `apps/admin/src/lib/authorization.ts` (`getUserAuthContext()`
wrapped in `React.cache()`).
**Fix:** Acceptable tradeoff for most flows; consider a short TTL or
explicit cache-bust on permission-changing admin actions (e.g. when an
admin revokes another user's team membership) so the revocation is
effective sooner than "next full page load."
**Status:** open.

### PR-025 · medium · cron endpoints (`apps/api`, `apps/web`) · one scheduled endpoint retains a non-production bypass path
**What breaks / condition:** `CRON_SECRET` gating uses
`safeSecretCompare()` (`packages/shared/utils/secrets.ts`), which wraps
Node's `timingSafeEqual()` for constant-time comparison — correctly applied
across the cron endpoints checked (`cleanup-anon-users`, `post-pending`,
`departures/sync`, `tickster/sync`), all of which fail closed in
production. However, per the S03 session summary, one cron endpoint retains
a non-production bypass path (consistent with PR-011's note that
`cleanup-reservations`'s own code comment says an unset `CRON_SECRET`
allows unauthenticated calls "outside production"). This needs explicit
confirmation that the bypass is unreachable when `NODE_ENV` is correctly
set to `production` in the actual Appwrite Site/Function runtime, not just
in local dev.
**Evidence:** `packages/shared/utils/secrets.ts` (`safeSecretCompare`,
`timingSafeEqual`); cron endpoints reviewed:
`apps/api/src/app/api/cleanup-anon-users/route.ts`,
`apps/api/src/app/api/expenses/post-pending/route.ts`,
departures/sync and tickster/sync routes;
`apps/web/src/app/api/cron/cleanup-reservations/route.ts:17` (code comment
re: non-prod bypass).
**Fix:** Verify `NODE_ENV=production` is reliably set in every relevant
Appwrite Site's build/runtime config, or better, remove the environment-
conditional bypass entirely and require `CRON_SECRET` unconditionally.
**Status:** open.

### PR-026 · low · audit process (S03) · JWT/webhook/document-creation deep-verification left incomplete
**What breaks / condition:** Not a code defect — an audit-coverage gap.
S03 delegated three deep-verification passes to sub-agents: (1) permission
stamping across 30+ document-creation call sites, (2) JWT authentication
enforcement across admin API routes, (3) webhook signature verification on
payment/Vipps/Stripe/Bot Framework callbacks. These were confirmed still
"in progress" at the point the last S03 observation was recorded, and no
follow-up observation with their conclusions exists in the recovered
session memory. The results — pass or fail — are unknown and must be
re-verified rather than assumed clean.
**Evidence:** Final S03 session observation notes three async agents "in
progress" verifying M365 sync flow, API JWT auth enforcement, CRON secret
gating, and document-creation permission stamping.
**Fix:** Re-run this verification explicitly in a follow-up session (folded
into S06/S07 in the new runtime-focused plan, `00-PLAN.md`) rather than
assuming it was completed cleanly.
**Status:** open (informational — audit gap, not a confirmed defect).

### PR-027 · low · `apps/admin/src/lib/roles.ts` / `authorization.ts` · legacy `SG-App-Role-*` groups documented as unused but not swept
**What breaks / condition:** Code comments state that `SG-App-Role-*`
groups (finance/hr/pr/controller) are "no longer used" in favor of the
current campus/department team model, but no sweep was confirmed to remove
dead references to these groups elsewhere in the codebase (docs, admin
UI copy, provisioning scripts). Low risk of confusion/staleness only.
**(reconstructed mapping.)**
**Evidence:** `apps/admin/src/lib/roles.ts`, `apps/admin/src/lib/authorization.ts`.
**Fix:** Grep for remaining `SG-App-Role-*` references and remove/update.
**Status:** open.

### PR-028 · low · `apps/admin/src/lib/authorization.ts` · silent fail-closed on department-ID resolution
**What breaks / condition:** `resolveDepartmentIds()` returns an empty
array when department-ID lookup fails, which is the safe choice
(fail-closed, no extra access granted) — but the failure is silent, with no
logging, so a misconfiguration (e.g. a renamed/deleted department row) that
causes lookups to fail is hard to diagnose; it would present as "this user
suddenly can't see their department's data" with no error trail.
**(reconstructed mapping.)**
**Evidence:** `apps/admin/src/lib/authorization.ts` (`resolveDepartmentIds()`).
**Fix:** Add a log/metric on lookup failure so operators can distinguish
"correctly has no department" from "lookup silently failed."
**Status:** open.

---

## S04 (partial) — Types, lint & dead-code

Session was cut short before formal close-out; the following leads were
captured but the pass itself was not marked done in the tracker (gates A3/A4
remain pending a full re-run).

### PR-029 · low · `apps/admin` (tours), `packages/ui` (comments) · 2 circular dependency pairs
**What breaks / condition:** `madge` module-graph analysis (1,215 files
scanned) found two circular import cycles: (1)
`apps/admin/src/components/tours/registry.ts` ↔
`apps/admin/src/components/tours/recruitment-hr.ts`; (2)
`packages/ui/components/comment-kit.tsx` ↔
`packages/ui/components/ui/comment-node.tsx`. Both are localized
(intra-feature / intra-package), not repo-wide dependency pollution.
Circular deps can cause bundle duplication, runtime initialization-order
errors, or tree-shaking failures, but both may be benign patterns (e.g. a
registration pattern where a registry imports a feature module which
re-imports the registry for config). Not confirmed to currently cause a
build or runtime failure.
**Evidence:** `docs/prod-readiness/scans/madge.txt`.
**Fix:** Break the cycle via dependency inversion or extracting shared
types/utilities into a third module. Verify no runtime init-order issue
exists in the meantime.
**Status:** open.

### PR-030 · medium · `packages/ui` · Biome lint configuration excludes all files
**What breaks / condition:** `@repo/ui`'s lint task exits 1 with "No files
were processed in the specified paths" — its `biome.json` configuration
excludes the entire package directory (path `.` is ignored). All other 14
packages lint successfully. This means the shared UI package consumed by
both `web` and `admin` currently has **no effective lint gate at all**,
which could allow lint regressions (including accessibility or security
rules enforced by the project's Ultracite config) to accumulate silently in
a package with high fan-in across both apps. Blocks launch gate `A3`.
**Evidence:** `docs/prod-readiness/scans/lint.txt`; `packages/ui/biome.json`.
**Fix:** Fix the `biome.json` path configuration so `@repo/ui` is actually
linted, then run `bun x ultracite fix` to clear any backlog of issues that
accumulated while lint was silently disabled.
**Status:** open.

### PR-031 · low · repo-wide · 11 unused dependencies, 2 unused files, 1 unused catalog entry
**What breaks / condition:** `knip` static analysis flagged: unused
dependencies `@vippsmobilepay/sdk` and `zod` (`apps/web`), `@repo/connectors`
and `node-appwrite` (`packages/shared`), and 7 UI component libraries in
`packages/ui` (`@radix-ui/react-toggle-group`, `motion`, `react-hook-form`,
`react-lite-youtube-embed`, `react-player`, `react-resizable-panels`,
`react-textarea-autosize`); unused files
`apps/web/src/components/layout/nav.tsx` and
`packages/connectors/src/24sevenoffice/rest/transactions.test.ts`; and one
unused root catalog entry, `woocommerce-rest-ts-api`. Each needs manual
triage before removal — some may be false positives (dynamic imports,
type-only re-exports, feature-flagged code paths), and the `zod`/
`@vippsmobilepay/sdk` cluster in particular may indicate an incomplete
migration rather than genuinely dead code.
**Evidence:** `docs/prod-readiness/scans/knip.txt`.
**Fix:** Triage each item; remove genuine dead code and unused deps to
reduce bundle size and supply-chain surface area.
**Status:** open.

**Positive result (not a finding):** TypeScript (`tsc --noEmit`) passes
cleanly across all 15 packages with no suppressions (`@ts-ignore`,
`@ts-expect-error`, `as any`) logged in the scan output — supports launch
gate `A2`.

---

---

# S05–S09 — Runtime behavior findings (2026-07-02)

Runtime-focused audit lanes: payments/money-path, auth-token lifecycle,
Appwrite runtime semantics, Next.js/Bun runtime, failure modes & resource
exhaustion. Findings below are numbered `PR-032`+. IDs cross-referenced to the
lane temp-IDs (P-/A-/W-/N-/F-) in each entry. Only findings the orchestrator
verified directly in code are marked **VERIFIED-IN-CODE**; others carry the
lane's stated confidence and are pending orchestrator verification.

### PR-032 — BLOCKER — Unauthenticated checkout endpoint charges a client-supplied amount (Vipps live at launch)
**VERIFIED-IN-CODE (orchestrator). CODE-REMEDIATED 2026-07-02, pending owner live smoke.** Lane refs: N-1 open-question, payments lane.
**App:** `apps/api` (public JWT REST service; base URL is `NEXT_PUBLIC_API_BASE_URL`, so the endpoint URL is public knowledge).
**What breaks / production condition:** `POST /api/payment/vipps/checkout` (and `/stripe/`) has **no user authentication** — it uses `createAdminClient()` and reads `userId` from the request body. Its only gates are (1) the `payments_vipps` feature flag (defaults **ON** — live at launch) and (2) `applyCorsHeaders`, which is **not a gate**: `apps/api/src/lib/cors.ts:4-24` only *sets* response headers and never rejects a request, so any non-browser client (curl/script) is unaffected. The charged amount comes straight from the client: `route.ts:33,54` puts `body.total` into `CheckoutSessionParams.total`; `createOrder` persists it verbatim (`packages/shared/utils/vipps-order-ops.ts:74-76`, `total: params.total`); `startVippsCheckout` charges `order.total ?? params.total` (`route.ts:101-105`). **No code between the HTTP boundary and the Vipps charge recomputes the amount from trusted product/price data.** An attacker POSTs `{items:[<real product>], total: 1, userId:<any>, reference:<any>, customerInfo:{email}}`, pays 1 NOK in Vipps, the order is marked paid on webhook, and fulfillment (membership grant / product) proceeds on the item list — goods/entitlements for arbitrary underpayment.
**Evidence:** `apps/api/src/app/api/payment/[provider]/checkout/route.ts:19-73,97-105,136-176`; `apps/api/src/lib/cors.ts:4-24`; `packages/shared/utils/vipps-order-ops.ts:54-95`.
**Blast radius:** Direct financial fraud on the live money path — every product and membership purchasable at any price; also lets a caller attribute paid orders to arbitrary `userId`s. Revenue loss + accounting integrity.
**Fix:** Implemented in `apps/api/src/app/api/payment/[provider]/checkout/route.ts`
and `apps/web/src/app/actions/orders.ts`: the web checkout action now creates an
Appwrite JWT and sends raw cart selectors; the API route rejects missing/invalid
JWTs, derives `userId` from `account.get()`, loads trusted `webshop_products`
rows, recomputes line prices/discounts server-side, and rejects client/server
total mismatches before `createOrder()` or provider checkout. CORS remains
response-header-only, not authorization.
**Verification:** Targeted regression test added at
`apps/api/src/app/api/payment/[provider]/checkout/route.test.ts` covering missing
bearer, invalid JWT, spoofed `userId`, total mismatch, and trusted Vipps amount.
Local checks passed: targeted route test, `apps/api` typecheck/lint, `apps/web`
typecheck/lint. Owner still needs a live Appwrite/Vipps smoke test after deploy.
**Status:** code-remediated and locally verified; not marked fully closed until
owner live smoke confirms the deployed Appwrite/API/Vipps flow.

### PR-033 — BLOCKER — `orders` collection grants `create("any")` → forged paid orders
**Lane refs:** P-5. Concrete instance of PR-017.
**What breaks / condition:** `orders` `$permissions` includes `create("any")` (rowSecurity on); create is always collection-level, so any client with the public Appwrite endpoint+project id (both `NEXT_PUBLIC_*`) can `createRow` an order with `status:"paid"` (enum allows it), arbitrary `total`/`items_json`. A single GET to the unauthenticated return route then renders success and (per PR-039) injects a fabricated 24SO ledger transaction; also pollutes purchase-limit counting (`purchase-limits.ts:43,112`).
**Evidence:** `packages/api/appwrite.config.json` orders `$permissions`; return route `apps/web/src/app/api/checkout/return/route.ts`.
**Fix:** Remove `create("any")` — the legit flow creates orders only via `createAdminClient()` in the checkout route (verified: no non-admin `createRow` on `orders` in web/packages code), so removal is safe.
**Confidence:** CONFIRMED (config; legit-flow safety verified in code). Live perms → owner-action.
**Verification:** `orders` no longer has `create("any")`; `packages/shared/utils/vipps-order-ops.test.ts` now asserts legitimate order creation uses the provided admin DB client with buyer-scoped read permissions. Targeted order/checkout tests pass locally.
**Status:** code/config-remediated and locally verified; owner Appwrite live permission verification pending before full closure.

### PR-034 — HIGH (BLOCKER-if-enabled) — Forged pre-"approved" expenses paid out with no approval chain
**Lane refs:** P-6. Instance of PR-017. Gated by `expenses_ledger_posting` (OFF at launch).
**What breaks / condition:** `expense` and `expense_attachments` grant `create("users")`; the `status` enum includes `approved` and `bank_account`/`amount`/`account_number` are settable. An authenticated student can create an expense row directly via the SDK with `status:"approved"` + their own `bank_account`. The payout cron selects any row where `status===APPROVED` (`post-pending/route.ts:58-61`) and `postApprovedExpense` posts a ledger payout **without ever verifying an `expense_approvals` chain** (`expense-posting.ts:183-209` — trusts row status + its own idempotency lock only).
**Evidence:** `packages/api/appwrite.config.json` (expense/expense_attachments perms + status enum); `apps/api/src/app/api/expenses/post-pending/route.ts:49-61`; `apps/api/src/lib/expense-posting.ts:183-232`.
**Fix:** Remove `create("users")` from `expense`/`expense_attachments` (create via API route with admin client) AND make `postApprovedExpense` verify all `expense_approvals` rows are APPROVED before posting. Hard gate: do NOT enable `expenses_ledger_posting` until both are done.
**Confidence:** CONFIRMED (config + code; cron flag-gate confirmed). Live perms → owner-action.
**Verification:** `expense` and `expense_attachments` no longer grant `create("users")`; draft/submit routes create new expense rows through the admin client with submitter row permissions; `postApprovedExpense` verifies a non-empty, contiguous, fully approved `expense_approvals` chain before claiming/posting. Targeted route/config/posting tests pass locally.
**Status:** code/config-remediated and locally verified; keep `expenses_ledger_posting` OFF until owner verifies the deployed Appwrite schema and approval/posting smoke path.

### PR-035 — HIGH — Non-atomic stock decrement race across three entry points
**Lane refs:** P-3, P-8, W-2.
**What breaks / condition:** `applyOrderStatusTransition` reads `order.status`, decides `shouldDecrement`, then `decrementStockForItems` does read→`Math.max(0,stock-qty)`→write. Three concurrent callers — Vipps webhook (`callback/route.ts:68`), checkout return (`return/route.ts:40,50`), and the public `verifyOrder` action (`orders.ts:624,644`) — commonly run at once (webhook fires as the app redirects to return). Both read `status=pending` → double-decrement; or two orders' transitions on one product → lost update; oversell of the last unit is silently clamped at 0.
**Evidence:** `packages/shared/utils/vipps-order-ops.ts:142-183,202-271`; `apps/api/src/app/api/payment/[provider]/callback/route.ts:68`; `apps/web/src/app/api/checkout/return/route.ts:40,50`; `apps/web/src/app/actions/orders.ts:222-241,624,644`.
**Fix:** Use `decrementRowColumn({min:0})` and gate the transition side-effects with an atomic claim column (`incrementRowColumn`, the `posting_lock` pattern) so only one caller runs PENDING→PAID effects.
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and verified.

### PR-036 — HIGH — Last units of any tracked product unsellable at checkout
**Lane refs:** W-1.
**What breaks / condition:** `getAvailableStock` subtracts **all** active reservations including the buyer's own, but `createOrUpdateReservation` correctly adds the caller's hold back. So `ensureStockAvailability` at checkout requires `stock ≥ otherHolds + 2q`. With stock 1 and cart 1, checkout always reports out-of-stock — sell-out is impossible on exactly the limited merch drops this shop exists for.
**Evidence:** `apps/web/src/app/actions/cart-reservations.ts:25-63,117-131`; `apps/web/src/app/actions/orders.ts:222-241`.
**Fix:** In `ensureStockAvailability`, add the buyer's own active reservation qty back (mirror `cart-reservations.ts:117-131`), or pass an `effectiveMax` from the reservation layer.
**Confidence:** CONFIRMED (reproducible with stock=1).
**Status:** code-remediated locally and verified.

### PR-037 — HIGH — Post-payment reservation cleanup silently fails (legacy query syntax)
**Lane refs:** P-7, W-3.
**What breaks / condition:** `deleteUserReservations` passes the hand-built string `` `equal("user_id","${userId}")` `` instead of `Query.equal(...)`; node-appwrite v23 serializes queries to JSON and rejects the string with a 400, which is swallowed. It also has no `Query.limit`. Result: on every paid order, stock is decremented **and** the buyer's reservation stays active up to ~10 min → availability double-counts → false out-of-stock for other shoppers right after each sale.
**Evidence:** `packages/shared/utils/vipps-order-ops.ts:327-343`.
**Fix:** `Query.equal("user_id", userId)` + a limit; scope deletion to the ordered product ids; surface the error instead of swallowing. Local remediation on 2026-07-02 replaces the legacy string query with `Query.equal("user_id", userId)` and covers the paid-transition cleanup path in `packages/shared/utils/vipps-order-ops.test.ts`.
**Confidence:** NEEDS-LIVE-CHECK (server logs "Invalid query" on first paid order — owner-action), high confidence from SDK version.
**Status:** query syntax code-remediated locally; limit/product scoping and live paid-order smoke remain follow-up.

### PR-038 — HIGH — No reconciliation sweep for captured-but-diverged / webhook-dead orders
**Lane refs:** P-4.
**What breaks / condition:** Only `cleanup-reservations` cron exists; nothing reconciles stale PENDING/AUTHORIZED orders. If the webhook secret is missing/wrong every delivery 401s until Vipps gives up after 7 days, or a mobile buyer pays in the Vipps app and never returns to the site → money captured, order stuck pending forever. Stripe's `resolveStripeCredentials` returns an empty `webhookSecret` happily, making the return route the only Stripe fulfillment path.
**Evidence:** `apps/web/src/app/api/cron/cleanup-reservations/route.ts`; `apps/api/src/app/api/payment/[provider]/callback/route.ts:57-59`; `packages/payment/src/credentials/select.ts:96-105`.
**Fix:** Add a CRON_SECRET-gated sweep (fits scheduled-dispatch): orders with a `payment_session_id`, status in (pending, authorized), older than ~15 min → run reconcile / Stripe session sync.
**Confidence:** CONFIRMED (gap); retry semantics verified from docs.
**Status:** open.

### PR-039 — HIGH — Accounting posting depends on the buyer's browser, with a non-atomic sentinel and possibly-missing columns
**Lane refs:** P-2, W-6, F-6.
**What breaks / condition:** 24SO revenue posting happens ONLY on the unauthenticated, replayable return route (never the webhook path). The claim sentinel is read-then-write (author-acknowledged race), a claim-write failure is swallowed and posting proceeds anyway, and on unknown-outcome errors the sentinel is cleared so a later return-visit reposts → duplicate ledger entries. `finago_transaction_id` (orders) and `finago_account_number` (webshop_products) are **absent from `appwrite.config.json`**; if also absent live, every return hit reposts (or throws). Mobile buyers who never return produce no ledger entry ever.
**Evidence:** `apps/web/src/app/api/checkout/return/route.ts:94-143,215-219`; `packages/api/appwrite.config.json` (columns absent).
**Fix:** Post from the status-transition/webhook path (not a GET); replace the sentinel with an atomic `incrementRowColumn` claim (expense-posting pattern); keep the claim on ambiguous errors (never auto-clear); add the columns and re-pull config.
**Confidence:** races CONFIRMED; column existence NEEDS-LIVE-CHECK (owner-action — if absent, treat as blocker).
**Status:** open.

### PR-040 — MEDIUM (latent — Stripe OFF) — Stripe async-failure maps to AUTHORIZED; stale/out-of-order events applied
**Lane refs:** P-9, P-10.
**What breaks / condition:** `determineStatusFromStripeSession` maps `complete`+`unpaid`→AUTHORIZED and the callback applies it to all four events including `checkout.session.async_payment_failed` → a failed async payment stays AUTHORIZED forever; the return route treats authorized as success and posts Finago → stock gone + ledger entry + success page with no money captured. The callback also applies the event-embedded (possibly stale) session with no downgrade guard, so out-of-order events can regress PAID→AUTHORIZED. Only exposed if async methods are enabled and `payments_stripe` is turned on.
**Evidence:** `packages/shared/utils/stripe-pure.ts:43-58`; `apps/api/src/app/api/payment/[provider]/callback/route.ts:20-25,93-99`; `apps/web/src/app/api/checkout/return/route.ts:150-152,215-219`.
**Fix:** Branch on `event.type` (`async_payment_failed`→FAILED); re-fetch the session before mapping; forbid PAID→non-refund downgrades; only post Finago on PAID.
**Confidence:** CONFIRMED (code); exposure NEEDS-LIVE-CHECK (which methods enabled).
**Status:** open.

### PR-041 — MEDIUM — Payment credential resolution falls back to env on ANY error; mode/secret can diverge
**Lane refs:** P-11.
**What breaks / condition:** `resolveCredentials` treats any exception reading `payment_settings` (transient network/permission blip, not just 404) as "no row" → falls back to `VIPPS_*`/`STRIPE_*` env with an independent test/live mode. With the 15s cache, checkout can run on DB-row live creds while the webhook verify seconds later runs on env creds → wrong merchant charged, or live payment verified against the wrong webhook secret (all deliveries 401 → PR-038 territory).
**Evidence:** `packages/payment/src/credentials/resolve.ts:39-47`; `packages/payment/src/credentials/select.ts:26,44-47,61-75,108-117`.
**Fix:** Only fall back on a 404/row-not-found error type; rethrow everything else; in prod delete the env fallbacks or guarantee they equal the live account.
**Confidence:** CONFIRMED (code); real-world impact depends on prod env → NEEDS-LIVE-CHECK.
**Status:** open.

### PR-042 — LOW — Vipps webhook has no timestamp freshness check (replay accepted)
**Lane refs:** P-12.
**What breaks / condition:** `x-ms-date` is verified only as an HMAC input, never for freshness, so a captured request replays forever. Benign by design — the handler only triggers a reconcile against authoritative Vipps state; docs confirm Vipps mandates no freshness window.
**Evidence:** `packages/payment/src/vipps/webhook.ts:81-108`.
**Fix:** Optional hardening: reject `x-ms-date` older than ~5 min.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-043 — LOW — Guest orders are world-readable
**Lane refs:** P-13.
**What breaks / condition:** Guest orders get `Permission.read(Role.any())`, so buyer name/email/phone are readable by any client that learns an order id. Privacy, not money.
**Evidence:** `packages/shared/utils/vipps-order-ops.ts:44-49`.
**Fix:** Scope guest-order read to a capability token or the session; drop `read(any)`.
**Confidence:** CONFIRMED (config/code).
**Status:** open.

### PR-044 — LOW (latent — flag OFF) — Expense posting liveness gap strands a row as APPROVED
**Lane refs:** P-14.
**What breaks / condition:** If `incrementRowColumn` succeeds (lock=1) but the marker-write fails and the run dies before 24SO, `ledger_transaction_id` stays null; later runs pass the early check, get lock=2,3…, return silently, and post-pending counts the row as `posted`. Stuck APPROVED forever with healthy-looking metrics. Only active with `expenses_ledger_posting` on.
**Evidence:** `apps/api/src/lib/expense-posting.ts:243-258`; `apps/api/src/app/api/expenses/post-pending/route.ts:65-72`.
**Fix:** When `claimed!==1` and `ledger_transaction_id` is null and `$updatedAt` exceeds the lease, mark FAILED (mirror the stale-marker path).
**Confidence:** CONFIRMED.
**Status:** open.

### PR-045 — LOW — øre-level charge divergence between providers
**Lane refs:** P-15.
**What breaks / condition:** Vipps charges `Math.round(total*100)` of a float sum; Stripe charges Σ`Math.round(unit*100)×qty` per line. With percentage member discounts these can differ by øre from each other and from `order.total`. Cosmetic today; becomes real if refund logic ever compares amounts.
**Evidence:** `packages/payment/src/vipps/index.ts:32-34`; `packages/payment/src/stripe/index.ts:22`.
**Fix:** Compute a single authoritative minor-unit total server-side and pass it to both providers.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-046 — HIGH — node-appwrite sets no request timeout and rebuilds its connection pool per call
**Lane refs:** F-1.
**What breaks / condition:** `node-appwrite@23.1.0` sets no timeout anywhere and spreads a fresh undici+https Agent on every request (`client.mjs:278`). Across 205+ `createSessionClient`/`createAdminClient` sites, a slow self-hosted Appwrite (disk, MariaDB lock, restart) hangs every in-flight RSC render and server action with no deadline — the site appears fully down though Node is healthy. Under normal load it churns a TCP+TLS handshake per call against your own box all week.
**Evidence:** `packages/api/server.ts:56-128`; `node-appwrite/dist/client.mjs:278`.
**Fix:** Inject `AbortSignal.timeout(~10s)` at the SDK entry (global undici dispatcher or a `plainDb`-proxy `Promise.race`), and pin a shared module-scope dispatcher so pooling is reused. Local remediation on 2026-07-02 wraps server Appwrite clients with a per-call abort signal, translates timeouts to `AppwriteException` 504/`appwrite_timeout`, and reuses SDK transport objects by endpoint/self-signed setting.
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and covered by `packages/api/server.test.ts`; deploy/runtime smoke pending.

### PR-047 — HIGH — Vipps checkout chain has no deadline at any hop
**Lane refs:** F-3.
**What breaks / condition:** Vipps API hangs → the SDK call never resolves (`retryRequests:false`, no timeout) → the api checkout route hangs → the web action's fetch to the api app also has no timeout → the student sits on a frozen checkout forever, and concurrent checkouts stack request handlers on both web and api. Same for capture/refund inside the webhook and return-route reconcile.
**Evidence:** `packages/payment/src/vipps/client.ts:12-22`; `apps/web/src/app/actions/orders.ts:497-509`; `packages/payment/src/vipps/index.ts:127-145,288-321`.
**Fix:** `AbortSignal.timeout(15s)` on the web→api fetch; pass a timeout-wrapped fetch into the Vipps SDK or `Promise.race` each SDK call. (Reconcile logic itself is sound; it just needs a clock.) Local remediation on 2026-07-02 adds a web→api checkout fetch abort signal and a route-side Vipps checkout `Promise.race` deadline that returns HTTP 504 instead of hanging.
**Confidence:** CONFIRMED.
**Status:** checkout-chain code-remediated locally and covered by web/api checkout tests; other Vipps SDK maintenance paths should still get explicit deadlines when touched.

### PR-048 — HIGH — Minimal server error logging added; external alerting still pending
**Lane refs:** F-2.
**What breaks / condition:** Originally, there was no Sentry/OTel/pino anywhere,
no `instrumentation-client.ts`, `onRequestError` was unused, and all logging was
bare `console.*`. Several money-path failures also logged nothing at all
(expense-approval-issues folded errors into return values; `expenses/approve`
had no handler try/catch → unlogged 500). During an incident there was no signal
to page on and no trace to debug. Local remediation on 2026-07-02 adds a
shared structured `onRequestError` logger and wires it into all four Next apps
(`web`, `admin`, `api`, `docs`) with sensitive-header redaction. This captures
uncaught server render/action/route/proxy errors into deploy logs, but it is not
a full Sentry/OTel integration and does not by itself create paging/retention.
**Evidence:** `packages/shared/utils/server-error-logging.ts`;
`packages/shared/utils/server-error-logging.test.ts`;
`apps/web/src/instrumentation.ts`; `apps/admin/src/instrumentation.ts`;
`apps/api/src/instrumentation.ts`; `apps/docs/instrumentation.ts`.
**Fix:** Minimal code remediation complete: keep the structured
`onRequestError` hook in every app. Before launch, owner/deploy must confirm the
Appwrite log drain/retention/alerting path or replace the console sink with
Sentry/OTel so the signal is pageable.
**Confidence:** CONFIRMED.
**Status:** minimally code-remediated and locally verified; deploy log
retention/alerting remains owner/infrastructure work before this is a fully
operational closure.

### PR-049 — HIGH — Public homepage dies whole on an Appwrite blip (2 unguarded fetches)
**Lane refs:** F-4.
**What breaks / condition:** `getPartners` and `getCampuses` had no try/catch,
while sibling `listEvents/listJobs/listNews` gracefully `return []`. One thrown
Appwrite error in the homepage render sent the entire page to
`(public)/error.tsx` — the graceful degradation built into the other actions
never got a chance. Local remediation on 2026-07-02 wraps both lookups in
try/catch, logs the failure, and returns `[]`.
**Evidence:** `apps/web/src/app/actions/about.ts`;
`apps/web/src/app/actions/about.test.ts`; `apps/web/src/app/actions/campus.ts`;
`apps/web/src/app/actions/campus.test.ts`.
**Fix:** Code-remediated locally with two try/catch-return-[] wrappers.
**Confidence:** CONFIRMED.
**Status:** code-remediated and locally verified.

### PR-050 — HIGH — Every member's page view makes a synchronous, timeout-less 24SO SOAP call
**Lane refs:** F-5.
**What breaks / condition:** `(public)/layout.tsx` awaits `getMembershipStatus()`; the cookie cache **cannot be written from RSC render context** (the code admits it fails silently), so unless a server action happens to run, every navigation by a member with a `student_id` re-calls `getCustomerCategories` → 24SO SOAP with no timeout. 24SO slow = whole public site slow for members; hung = member renders hang; down = members silently flap to non-member (losing pricing/benefits mid-session).
**Evidence:** `apps/web/src/app/(public)/layout.tsx:15-19`; `apps/web/src/lib/actions/membership.ts:133-137,203-214`.
**Fix:** Move the cache server-side (Appwrite row / in-memory TTL keyed by user id), add a SOAP timeout, and treat 24SO as enrichment not a render dependency. Local remediation on 2026-07-02 adds a runtime-configurable Finago membership deadline and preserves the existing `finago_error` non-member fallback when 24SO stalls.
**Confidence:** CONFIRMED.
**Status:** timeout/fallback code-remediated locally and covered by `apps/web/src/lib/actions/membership.test.ts`; server-side membership cache remains open follow-up.

### PR-051 — MEDIUM — Admin app reports an Appwrite outage as "you're logged out" (redirect loop)
**Lane refs:** F-7.
**What breaks / condition:** `getUserAuthContext` catches everything → null → `requireAdminAccess` redirects to `/auth/login`, which also fails against the down backend → editors bounce in a loop during the exact incident when staff are trying to debug.
**Evidence:** `apps/admin/src/lib/authorization.ts:156-158,272-274`.
**Fix:** Distinguish "no session" from "backend unreachable" — rethrow non-401 errors to the error boundary.
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and verified.

### PR-052 — MEDIUM — Uncapped fan-out hot spots (OOM / connection-storm)
**Lane refs:** F-8, W-10.
**What breaks / condition:** No concurrency limiter on the risky paths: announcement dispatch pages an entire segment into memory then `Promise.all`s one `createRow` per member (one "all members" click = thousands of concurrent writes + a same-size permission array); the public board route `Promise.all`s Graph photo downloads base64-buffered, anonymous, no `maxDuration`; anon-cleanup fires up to **5000 parallel** `users.delete` (admin key bypasses rate limits → can brown out the instance); expense OCR has no cap/`maxDuration` and buffers the body before the 10MB check.
**Evidence:** `apps/admin/src/lib/announcements/send.ts:126-140,168`; `apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:186`; `apps/api/src/app/api/cleanup-anon-users/route.ts:51-60`; `apps/api/src/app/api/expenses/ocr/route.ts:161-361`.
**Fix:** Chunk with the existing `mapWithConcurrency` helper; add `maxDuration` to OCR/board; cap segment sizes; `allSettled` + page loop for cleanup.
**Confidence:** CONFIRMED (magnitude NEEDS-LIVE-CHECK for the biggest segment).
**Status:** open.

### PR-053 — MEDIUM — Public job application submit is coupled to OpenAI latency
**Lane refs:** F-9.
**What breaks / condition:** Submit awaits `screenApplication` (gpt-5-nano) inline when auto-screen is on, with no timeout/abortSignal on any AI call → OpenAI hang blocks the applicant's submit; an applicant spike fans out uncapped concurrent LLM calls from the web process.
**Evidence:** `apps/web/src/app/actions/jobs.ts:441-468`.
**Fix:** Fire screening after responding (or queue via cron); pass `abortSignal: AbortSignal.timeout(30s)` to `generateObject`.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-054 — MEDIUM — Legacy expense submit can strand an expense if email fails, causing duplicates
**Lane refs:** F-10.
**What breaks / condition:** The legacy submit path awaits two `messaging.createEmail` calls **before** the `status:PENDING` update, under one catch-all → an Appwrite messaging/SMTP failure leaves the expense pre-pending, the user sees a generic error and re-submits → duplicate reimbursement rows + duplicate PDFs. (The newer approval-chain path is sound: it transitions status first.)
**Evidence:** `apps/api/src/app/api/expenses/submit/route.ts:383-407,419`.
**Fix:** Reorder status update before notifications; make emails best-effort-logged.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-055 — MEDIUM — No dependency-aware readiness probe
**Lane refs:** F-12.
**What breaks / condition:** All four `/api/health` return 200 even with Appwrite fully down; the only dependency-aware check (`/api/health/teams`) is global-admin-gated, so an uptime monitor can only ever get 401. A hung-but-alive process is invisible to monitoring.
**Evidence:** `apps/{web,admin,api}/src/app/api/health/route.ts`; `apps/docs/app/api/health/route.ts`; `apps/admin/src/app/api/health/teams/route.ts`.
**Fix:** Add an unauthenticated (or shared-secret) `/api/health/ready` doing one cheap Appwrite read with a 3s deadline.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-056 — LOW-MEDIUM — Shared cached 24SO SOAP client mutated per call
**Lane refs:** F-13.
**What breaks / condition:** `createAuthenticatedClient` sets the session `Cookie` header on the module-cached shared SOAP client (last-writer-wins across concurrent requests). Benign with one org session today; becomes a cross-request bug the day sessions differ (e.g. mid-refresh). `createClientAsync(wsdlUrl)` also fetches the WSDL on cold start with no timeout.
**Evidence:** `packages/connectors/src/24sevenoffice/client.ts:26,55-64`.
**Fix:** Don't mutate shared client state per request (per-call client or request-scoped headers); add a WSDL fetch timeout.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-057 — LOW — Assorted silent-swallow and loop nits
**Lane refs:** F-14.
**What breaks / condition:** `getCompaniesByIds` maps per-company failures to `null` silently (partial sync looks complete); Finago departments pagination has no max-page guard and logs the full response every page; Finago OAuth token fetch has no timeout or concurrent-refresh dedupe; Umami admin fetchers hang (not crash) admin-only.
**Evidence:** `packages/connectors/src/24sevenoffice/company.ts:193-201`; `.../rest/departments.ts:23-51`; `.../rest/auth.ts:40`; `apps/admin/src/lib/umami/client.ts:75,115`.
**Fix:** Log partial failures loudly, add max-page guards + timeouts, drop full-response logging.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-058 — HIGH — Azure offboarding never invalidates Appwrite access
**Lane refs:** A-1. Ties to PR-015/PR-018.
**What breaks / condition:** `syncM365Permissions` runs only at OAuth login and is add-only (`teams.createMembership`/`updateMembership`; no `deleteMembership` anywhere in the codebase). Sessions last 365 days; no `users.updateStatus`/`deleteSessions` exists. A staffer disabled in Azure at semester turnover keeps a working Appwrite session and full team-derived CMS/campus access for up to a year. (`departures/sync` is Entur transit data; `account-turnover` only pokes an Azure Automation webhook — neither touches Appwrite auth.)
**Evidence:** `apps/admin/src/lib/m365-sync.ts:51,56,90,118-161`; `packages/api/appwrite.config.json:29-37` (365-day session).
**Fix:** Offboarding hook (cron or turnover route): `users.updateStatus(id,false)` + `users.deleteSessions(id)` + prune memberships against current Azure groups; make m365-sync reconciling at login.
**Confidence:** CONFIRMED (code-level absence).
**Status:** open.

### PR-059 — HIGH — Booking-token reuse-after-consume race creates duplicate interviews
**Lane refs:** A-2.
**What breaks / condition:** `confirmBookingSlot` reads `consumed_at=null`, creates a `job_interviews` row with `ID.unique()`, then stamps consume — non-atomically. Two tabs/devices within the same second both pass the null check → two interviews; the token's single `interview_id` clobbers the first, orphaning it.
**Evidence:** `apps/web/src/app/actions/booking.ts:126,162,190-195`.
**Fix:** Copy the proven expense claim — `incrementRowColumn` on a `consume_lock`, proceed only on 0→1 (as in `expense-approval.ts:586-595`).
**Confidence:** CONFIRMED.
**Status:** open.

### PR-060 — HIGH — No interview-slot uniqueness: two candidates can book the same instant
**Lane refs:** A-3.
**What breaks / condition:** `confirmBookingSlot` never queries existing interviews before creating one; all `job_interviews` indexes are non-unique `key`. Free/busy is consulted only at admin proposal time, never at confirm → the panel is double-booked during any round with parallel candidates.
**Evidence:** `apps/web/src/app/actions/booking.ts:162`; `packages/api/appwrite.config.json:7229-7258`.
**Fix:** Unique index on a slot key (panel+starts_at) or an atomic slot-claim row.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-061 — HIGH — Dead anonymous-session cookie has no recovery path; cleanup cron manufactures it
**Lane refs:** A-4.
**What breaks / condition:** The anon cookie has 30-day maxAge, but the cleanup cron deletes anon users idle >14 days and nothing bumps an anon user's `$updatedAt` after creation. Day 15-30: a returning visitor's cookie points at a deleted user; `ensureAnonymousSession` no-ops because the cookie exists → `account.get()` throws in cart actions → generic error; nothing clears or re-mints the cookie, so add-to-cart is broken for that browser for up to 16 days. Same trap when a logged-in session is evicted by `sessionsLimit:10`.
**Evidence:** `apps/web/src/lib/anon-session.ts:7,16,38-49`; `apps/api/src/app/api/cleanup-anon-users/route.ts:49-61`; `apps/web/src/app/actions/cart-reservations.ts:100-104`.
**Fix:** Validate the existing cookie (cheap `account.get()`) or catch 401 in session-using actions, delete the cookie, re-provision once; align cookie maxAge (≤14d) with the cleanup window.
**Confidence:** CONFIRMED (code); anon `$updatedAt` behavior NEEDS-LIVE-CHECK.
**Status:** code-remediated locally and verified.

### PR-062 — MEDIUM — Web login callbacks 500 on expired/replayed secrets (admin handles it, web doesn't)
**Lane refs:** A-5.
**What breaks / condition:** Neither web OAuth nor magic-link callback wraps `account.createSession` in try/catch; an expired token, a back/refresh replay, or a slow callback tab throws → raw Next 500 with no route back. Admin's equivalent catches and redirects to `/auth/login?error=session_failed`. Web OAuth failure URLs are also bare with no error param.
**Evidence:** `apps/web/src/app/(auth)/auth/oauth/route.ts:19-20`; `apps/web/src/app/(auth)/auth/callback/route.ts:20`; `apps/web/src/lib/server.ts:29,51,73,95`; cf. `apps/admin/src/app/(auth)/auth/oauth/route.ts:22-28`.
**Fix:** Copy admin's try/catch+redirect into both web routes.
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and verified.

### PR-063 — MEDIUM — No OAuth state/CSRF nonce on token-flow callbacks (login CSRF)
**Lane refs:** A-6.
**What breaks / condition:** Both web and admin callbacks accept any `userId`+`secret` query pair with no state nonce bound to the victim's browser. An attacker who initiates their own OAuth flow and captures the redirect can send the victim a callback URL that silently logs the victim into the **attacker's** account (session cookie `sameSite:"none"`, domain `.biso.no`) → anything the victim then submits (profile, `bank_account`) lands in the attacker-readable account.
**Evidence:** web oauth/callback routes above; `apps/admin/.../auth/oauth/route.ts:9-21`; cookie set at web oauth route 42-48.
**Fix:** Set a nonce cookie at initiation, echo via state/`redirectTo`, verify in the callback.
**Confidence:** CONFIRMED pattern; end-to-end exploitability NEEDS-LIVE-CHECK (secret TTL/one-shot timing).
**Status:** open.

### PR-064 — MEDIUM — Expired-JWT handling in apps/api is inconsistent and the browser cache can't self-heal
**Lane refs:** A-7.
**What breaks / condition:** JWT dies at 15 min or on session deletion. The browser cache (14-min cap, 1-min buffer) has **no 401-driven invalidation** — `clearCache()` has zero callers and the web app has no logout. Server side the failure shape diverges: `/expenses/ocr` calls `account.get()` outside its try → raw 500 (its `if(!user)` 401 branch is dead code); `/expenses/submit` returns HTTP 200 `{success:false, error}` with the raw `AppwriteException` serialized in, indistinguishable from a validation failure.
**Evidence:** `apps/web/src/lib/api-client.ts:27-62,129`; `apps/api/src/app/api/expenses/ocr/route.ts:343-361`; `apps/api/src/app/api/expenses/submit/route.ts:419-425`.
**Fix:** Normalize 401 to HTTP 401 in api consumers; on 401 clear the cache and retry once with a fresh mint.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-065 — MEDIUM — Long uploads/AI calls can outlive the cached JWT with no re-mint
**Lane refs:** A-8.
**What breaks / condition:** The cache serves a JWT with as little as 61s of life (`expiresAt > now+60s`); a 90s mobile receipt upload via `fetchFormData` arrives at apps/api after the JWT is dead → PR-064's 500/200-error after the user already paid the upload+wait cost. Same window for `/expenses/submit`'s multi-step Appwrite sequence.
**Evidence:** `apps/web/src/lib/api-client.ts:36-38`.
**Fix:** Mint a fresh JWT when initiating any upload (bypass cache for `fetchFormData`), or widen the buffer to ~3 min for form-data calls.
**Confidence:** CONFIRMED (arithmetic + code).
**Status:** open.

### PR-066 — MEDIUM — Graph/SharePoint clients rebuilt per call → no token cache, AAD /token pressure
**Lane refs:** A-9, F-11.
**What breaks / condition:** `createGraphClient` news up `ClientSecretCredential`+client per call, and SharePoint news up a fresh MSAL app per request, at ~30+ sites including the public board route (public page render → token mint). MSAL's in-memory cache never hits → one AAD `/token` round trip per operation → latency everywhere and `/token` 429 throttling (outside the Graph RetryHandler) under launch load. A failed login-time sync is swallowed → first-time admin lands role-less.
**Evidence:** `packages/connectors/src/azure/index.ts:5-28`; `.../teams-bot/graph.ts:25-28`; `.../sharepoint/index.ts:136-157`; board route:120-124; cf. good pattern `.../24sevenoffice/rest/auth.ts:20-71`.
**Fix:** Module-scope memoized credential/service keyed by tenantId+clientId (single tenant, so no mixing risk); add timeouts.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-067 — MEDIUM — Teams/Outlook scheduling failures swallowed with no rollback or flag
**Lane refs:** A-10.
**What breaks / condition:** `createTeamsMeeting`/`createCalendarEvent` catch all errors (401/403/429 undifferentiated) and return null; `applyGraphScheduling` only `console.warn`s. If the Teams meeting succeeds but the calendar event fails, the meeting isn't deleted and the interview is stamped with a URL but no invite — candidate booked with nulls, no reconciliation queue.
**Evidence:** `packages/connectors/src/azure/calendar.ts:278-281,339-342`; `apps/admin/src/app/(portal)/_actions/interviews.ts:133-137`.
**Fix:** Persist `scheduling_status`, add a retry/reconcile pass, delete the Teams meeting on partial failure.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-068 — MEDIUM — Membership status trusted from an unsigned, user-editable cookie
**Lane refs:** A-11.
**What breaks / condition:** `getMembershipStatus()` reads `biso_membership` and returns whatever the cookie says, including its own `expiresAt`. `httpOnly` blocks scripts, not the user: anyone can devtools/curl-set `{status:{isMember:true},expiresAt:9999999999999}` and be treated as a member indefinitely wherever this gates pricing/benefits. Also a Finago outage caches `isMember:false` for 10 min.
**Evidence:** `apps/web/src/lib/actions/membership.ts:44-52,88-107,203-215`.
**Fix:** HMAC-sign the cookie payload (server secret available) or cache server-side keyed by userId.
**Confidence:** CONFIRMED (code); exploit value depends on whether checkout pricing consults it → NEEDS-LIVE-CHECK (open question).
**Status:** open.

### PR-069 — LOW — Web app has no sign-out; sessions are user-unrevocable
**Lane refs:** A-12.
**What breaks / condition:** No logout action, `deleteSession`, or cookie deletion in `apps/web/src` (only admin has `signOut`). On a shared computer, closing the browser drops the cookie but the 1-year Appwrite session stays valid server-side and unreachable to the user.
**Evidence:** `apps/web/src` (absence); cf. `apps/admin/src/lib/actions/user.ts:146-167`.
**Fix:** Add a sign-out mirroring admin's (delete session best-effort, delete domain-scoped cookie, `apiClient.clearCache()`).
**Confidence:** CONFIRMED.
**Status:** open.

### PR-070 — LOW — Session-cookie attribute drift; SameSite=None broader than needed
**Lane refs:** A-13.
**What breaks / condition:** Three web setters use three lifetimes/attribute sets for the same cookie (OAuth: no maxAge, secure always; anon: 30-day, secure prod-only; invite: sameSite lax, host-only). The three hostnames are same-*site* (registrable domain biso.no), so `SameSite=None` buys nothing over `Lax` while exposing every cookie-authed GET route to true cross-site requests.
**Evidence:** `apps/web/src/app/(auth)/auth/oauth/route.ts`; `apps/web/src/lib/anon-session.ts:9-19`; `apps/web/src/app/(auth)/auth/invite/route.ts:15-23`.
**Fix:** One shared cookie-options helper; prefer `Lax` unless a genuinely cross-site embed needs `None`.
**Confidence:** CONFIRMED (drift); the `None` requirement NEEDS-LIVE-CHECK.
**Status:** open.

### PR-071 — LOW — Invite route looks stale: hardcoded foreign origin + host-only cookie then cross-host redirect
**Lane refs:** A-14.
**What breaks / condition:** The invite route hardcodes `origin="https://app.biso.no"`, sets the session cookie host-only on web's host, then redirects to `app.biso.no` where that cookie isn't visible → invited users land logged-out on a possibly-dead host.
**Evidence:** `apps/web/src/app/(auth)/auth/invite/route.ts:15-23,55,88`.
**Fix:** Derive origin from `NEXT_PUBLIC_BASE_URL`, use shared cookie options; or delete the route if invites are unused.
**Confidence:** CONFIRMED (code); whether invites are sent NEEDS-LIVE-CHECK.
**Status:** open.

### PR-072 — LOW — Concurrent first-cart actions race duplicate anonymous users
**Lane refs:** A-15.
**What breaks / condition:** Two parallel actions in a cookieless browser both pass the `cookieStore.get` check and both call `account.createAnonymousSession()` → two anon users; last cookie-set wins, the loser's 10-min reservation is orphaned (cron-cleaned).
**Evidence:** `apps/web/src/lib/anon-session.ts:38`.
**Fix:** A module-level promise lock or idempotent retry-on-conflict keeps it bounded; acceptable to leave.
**Confidence:** CONFIRMED (low impact).
**Status:** open.

### PR-073 — LOW — Recruitment Graph creds use bare AZURE_* with no fallback chain
**Lane refs:** A-16.
**What breaks / condition:** `readGraphCreds()` uses bare `AZURE_TENANT_ID`/`AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET` with no fallback (unlike `apps/api/src/lib/graph.ts` and the board route). If unset, scheduling silently returns all-null.
**Evidence:** `apps/admin/src/lib/recruitment-scheduling.ts:19-31,106-113`.
**Fix:** Unify env names; log loudly / flag interviews when Graph is unconfigured.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-074 — LOW — Booking slot window is browser-local; interview timezone hard-coded
**Lane refs:** A-17.
**What breaks / condition:** The slot generator uses `cursor.getHours()` in the candidate's browser TZ; server `confirmBookingSlot` validates only the epoch window and stamps `timezone:"Europe/Oslo"` — a candidate abroad (or a direct action call) can book 03:00 Oslo time. (Expiry/window comparisons themselves are epoch-based and DST-safe.)
**Evidence:** `apps/web/src/app/(public)/recruitment/book/[token]/booking-client.tsx:15-31`; `apps/web/src/app/actions/booking.ts:133-140,184`.
**Fix:** Enforce working hours server-side in Europe/Oslo.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-075 — HIGH — Role derivation and member detection truncated at 25 rows
**Lane refs:** W-5, both pagination sweeps.
**What breaks / condition:** `teams.list()` with no limit in both apps' canonical auth reads returns only the first 25 teams; a staffer in >25 campus/dept teams non-deterministically loses derived roles/campus scope. Separately, active `memberships` are listed unbounded and matched client-side against the user's Finago categories; >25 active rows → a paying member can be classified non-member (member pricing/benefits denied).
**Evidence:** `apps/admin/src/lib/authorization.ts:117`; `apps/api/src/lib/admin-auth.ts:51`; `apps/web/src/lib/actions/membership.ts:231-235`.
**Fix:** Add `Query.limit(...)`/cursor loop sized to reality; for membership, filter server-side with `Query.equal("category", …)` instead of client-side.
**Confidence:** truncation CONFIRMED; whether live counts exceed 25 → owner-action.
**Status:** code-remediated locally and verified.

### PR-076 — MEDIUM — M365 user provisioning multi-write has no compensation
**Lane refs:** W-7.
**What breaks / condition:** Provisioning does Graph create → manager (failure swallowed) → security groups → Appwrite `user` row → audit log with no transaction. A failure after the Graph create leaves an M365 account with no profile row (invisible to the app, license/seat consumed); no rollback or resume-from-partial. (Deterministic UPN + `graphUser.id` row ID prevent dup rows on retry.)
**Evidence:** `apps/api/src/app/api/admin/users/route.ts:180-232`; `.../bulk/route.ts:143`.
**Fix:** On `createRow` failure, delete the Graph user or persist a "provisioning incomplete" record for the IT queue; make the audit-log write unconditional.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-077 — MEDIUM — Login team sync swallows errors and ignores Graph pagination
**Lane refs:** W-8. Ties to PR-015.
**What breaks / condition:** The whole login-time sync (Graph fetch + `teams.create`/`createMembership` + grants) is caught and only logged → a user lands with stale/missing team-derived authorization and nothing surfaces. It also reads `graphData.value` once and ignores `@odata.nextLink`, so users in >100 AAD groups (Graph pages `transitiveMemberOf` at ~100) get a truncated, non-deterministic team sync.
**Evidence:** `apps/admin/src/lib/m365-sync.ts:135-150,158-160`.
**Fix:** Follow `@odata.nextLink`; surface sync failure (flag on session/user, retry next login).
**Confidence:** CONFIRMED (code); >100-group case NEEDS-LIVE-CHECK.
**Status:** open.

### PR-078 — MEDIUM — Recruitment application submit: dup applications, swallowed child writes, orphaned uploads
**Lane refs:** W-9.
**What breaks / condition:** No unique index on `(job_id, applicant_email)` + check-then-create → double-click/two-tab duplicate applications. Candidate-profile upsert failure is swallowed (application persists with `candidate_profile:null`; concurrent 409 on the unique `candidate_profiles.email` also swallowed). Per-answer failures swallowed → silent answer loss. Resume is uploaded **before** the application row → row failure orphans the file (no `deleteFile` anywhere). `applications_count` is a non-atomic RMW.
**Evidence:** `apps/web/src/app/actions/jobs.ts:276-286,288-301,326,375-377,429-434`; `packages/api/appwrite.config.json` (job_applications indexes).
**Fix:** Add unique `(job_id, applicant_email)` and handle 409 as "already applied"; retry-read on profile 409; fail/queue on answer failure; delete the resume in the failure path; use `incrementRowColumn` for the counter.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-079 — HIGH — Storage: anonymous unbounded uploads + config drift + no file cleanup
**Lane refs:** W-11.
**What breaks / condition:** The `resumes` bucket has `create("any")`, empty `allowedFileExtensions`, and a 100 MB max — the only guard is app-side validation, which a direct storage-API call bypasses → anonymous 100 MB arbitrary-type uploads. The `avatars` and `content` buckets are **absent from `appwrite.config.json`** (drift; live constraints unknown; avatars has no app-side size/type check). Zero `storage.deleteFile` calls repo-wide → replaced/deleted/failed-flow files leak forever.
**Evidence:** `packages/api/appwrite.config.json` (buckets); `apps/web/src/app/actions/jobs.ts:291`; `apps/web/src/app/actions/member-portal.ts:306`; `apps/admin/src/app/api/upload/route.ts:61`.
**Fix:** Tighten `resumes` (extension allowlist, ~10 MB, drop `create("any")` if the flow allows); add the missing buckets to config; add compensating deletes + an orphan sweep.
**Confidence:** config CONFIRMED; live avatars/content settings NEEDS-LIVE-CHECK.
**Status:** open.

### PR-080 — LOW-MEDIUM — Purchase-limit enforcement fails open and is check-then-act
**Lane refs:** W-12.
**What breaks / condition:** `checkMaxPerUser` returns `allowed:true` on any error (deliberate), and two concurrent checkouts both pass before either order exists → `max_per_user` bypass. Acceptable if limits are soft; a problem if any product uses limits for compliance (e.g. ticket caps).
**Evidence:** `apps/web/src/app/actions/purchase-limits.ts:53-57`.
**Fix:** Fail closed for compliance-critical limits; enforce atomically (reservation/claim) rather than check-then-act.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-081 — LOW-MEDIUM — Account deletion orphans the PII profile row (GDPR)
**Lane refs:** W-13.
**What breaks / condition:** Web account deletion deletes only the auth user; the `user` table row (name/address/phone/student_id) survives. The admin variant has the reverse gap (row deleted, then unguarded `users.delete`). GDPR-relevant for a "delete my account" surface.
**Evidence:** `apps/web/src/lib/actions/user.ts:133-139`; `apps/admin/src/lib/actions/user.ts:182-187`.
**Fix:** Delete profile row + auth user (row-first/auth-second) with a retry queue.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-082 — LOW — Benefit reveal race returns an error on a successful reveal
**Lane refs:** W-14.
**What breaks / condition:** Check-then-create with `ID.unique()`; the unique `(user_id, benefit_id)` index makes the concurrent loser throw 409 into the generic catch → the user sees failure though the benefit was revealed.
**Evidence:** `apps/web/src/app/actions/member-portal.ts:220-248`.
**Fix:** Handle 409 as success (re-read), like tour-progress does.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-083 — MEDIUM — Root layout `force-dynamic` disables all caching/ISR site-wide
**Lane refs:** N-1.
**What breaks / condition:** Both web and admin root layouts `export const dynamic = "force-dynamic"`, which cascades to the whole tree; per-page `revalidate` exports are dead no-ops. Every anonymous public hit re-runs the full RSC fan-out (`(public)/layout.tsx` membership + nav + per-page Appwrite queries) with no full-route cache — Appwrite load and TTFB scale linearly with launch traffic. (This is also why there is no cross-user cache-leak surface — a positive.)
**Evidence:** `apps/web/src/app/layout.tsx:70`; `apps/admin/src/app/layout.tsx:48`; dead exports at `campus/page.tsx:18`, `units/page.tsx:15`, etc.
**Fix:** Architecture decision — if dynamic is intended, drop the dead `revalidate` exports; if caching is wanted, move cookie/membership reads out of the shared layout render path and remove `force-dynamic`.
**Confidence:** CONFIRMED (cascade verified against Next source).
**Status:** open.

### PR-084 — LOW — `redirect()` swallowed by try/catch in 5 admin actions
**Lane refs:** N-2.
**What breaks / condition:** `requireSettingsAccess`/`requireFeatureFlagAccess`/`requirePaymentAccess` call `redirect()` inside try blocks whose catch returns `{error}`; no `isRedirectError` re-throw exists repo-wide. An admin whose session expired mid-session sees an opaque `{error:"NEXT_REDIRECT"}` toast instead of a login bounce. The mutation is still safely aborted (guard throws before any write) — not an authz bypass.
**Evidence:** `apps/admin/.../settings/actions.ts:19,33`; `.../feature-flags/actions.ts:40,89-90,132`; `.../payment-settings/actions.ts:50,147-148,178,197-198,252,268-269,285`.
**Fix:** `if (isRedirectError(error)) throw error;` in each catch, or move `await requireX()` above the try.
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and verified.

### PR-085 — HIGH — NEXT_PUBLIC_* inlined at build; a missing/misnamed build-env var bakes wrong fallbacks
**Lane refs:** N-3.
**What breaks / condition:** Each app builds separately on Appwrite, so the correct `NEXT_PUBLIC_*` values must be in each app's Appwrite build env; a missing/misnamed var silently bakes the fallback into the immutable client bundle. `api-client.ts` falls back to `http://localhost:3003` (all client JWT expense/upload calls fail in prod); `server.ts` falls back to project `"biso"`/`"dev"`. Naming drift (`_PROJECT` vs `_PROJECT_ID`, `_BASE_URL` vs `_WEB_BASE_URL`, a typo'd `NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT`) raises the odds of a mis-set var.
**Evidence:** `apps/web/src/lib/api-client.ts:3-4`; `packages/api/server.ts:44-52`; drift at `(protected)/fs/[id]/page.tsx:221`, `checkout/route.ts:44`.
**Fix:** Verify every app's Appwrite build env defines all four public vars with canonical names before launch (owner-action); consider failing the build if `NEXT_PUBLIC_API_BASE_URL` is unset rather than defaulting to localhost.
**Confidence:** code CONFIRMED; build-env NEEDS-LIVE-CHECK (owner-action).
**Status:** open.

### PR-086 — LOW — apps/api `/api/config` reads a file the flatten script doesn't ship
**Lane refs:** N-4.
**What breaks / condition:** The route `readFileSync(process.cwd()/config/app-config.json)`; the flatten script copies only `public` + `.next/static`, and Next can't trace a `cwd`-relative path, so the file is absent in standalone → the route always returns hardcoded fallbacks (which also disagree with the committed file). No runtime caller found, so impact is nil today.
**Evidence:** `apps/api/src/app/api/config/route.ts:9`; `package.json:160` (flatten script).
**Fix:** Delete the route, or add `outputFileTracingIncludes` for `config/**` and copy it; reconcile the two default sets.
**Confidence:** CONFIRMED.
**Status:** open.

### PR-087 — LOW — Public directories truncate to 25 rows
**Lane refs:** web pagination sweep.
**What breaks / condition:** The public departments directory on `/units` and `/students`, and per-department news/products, list without `Query.limit` → capped at 25 despite hundreds of departments (the page-builder reads the same table with `limit(500)`). The varsling recipient lookup and `getCampuses` are also unbounded but low-count today.
**Evidence:** `apps/web/src/lib/actions/departments.ts:62,106,138`; `apps/web/src/app/actions/varsling.ts:33`; `apps/web/src/app/actions/campus.ts:111`.
**Fix:** Add explicit `Query.limit` sized to reality (mirror the page-builder's 500).
**Confidence:** CONFIRMED.
**Status:** code-remediated locally and verified.

---

## Severity tally

| Severity | Count | IDs |
|----------|-------|-----|
| blocker | 4 | PR-015, PR-017, PR-032, PR-033 (all four now code/config-remediated locally or previously code-remediated, but owner live verification remains before full closure) |
| high | 25 | PR-001, PR-008, PR-016, PR-018, PR-019, PR-020, PR-021, PR-034 (code/config-remediated locally; flag must stay OFF until owner live verification), PR-035, PR-036, PR-037, PR-038, PR-039, PR-046, PR-047, PR-048, PR-049, PR-050, PR-058, PR-059, PR-060, PR-061, PR-075, PR-079, PR-085 |
| medium | 28 | PR-002, PR-007, PR-009, PR-011, PR-012, PR-022, PR-023, PR-024, PR-025, PR-030, PR-040, PR-041, PR-051, PR-052, PR-053, PR-054, PR-055, PR-062, PR-063, PR-064, PR-065, PR-066, PR-067, PR-068, PR-076, PR-077, PR-078, PR-083 |
| low | 30 | PR-003, PR-004, PR-005, PR-006, PR-010, PR-013, PR-014, PR-026, PR-027, PR-028, PR-029, PR-031, PR-042, PR-043, PR-044, PR-045, PR-056, PR-057, PR-069, PR-070, PR-071, PR-072, PR-073, PR-074, PR-080, PR-081, PR-082, PR-084, PR-086, PR-087 |

Total: 87 findings (PR-001–PR-087).

**Blockers still number 4 by original severity classification**, but PR-032,
PR-033, PR-015, and PR-017 are now code/config-remediated locally and await the
owner live checks called out in their entries before full closure. **PR-034** is
also code/config-remediated locally, but remains a *conditional/gated* item until
the deployed Appwrite schema and approval/posting smoke are verified; keep
`expenses_ledger_posting` OFF until then.

Severity notes: `HIGH (BLOCKER-if-enabled)` PR-034 is counted as high; the
`MEDIUM-HIGH` (PR-051) is counted as medium; the `LOW-MEDIUM` items (PR-056,
PR-080, PR-081) and the `MEDIUM-LOW` (PR-084) are counted as low. Latent items
gated by OFF-by-default flags (`payments_stripe`: PR-040; `expenses_ledger_posting`:
PR-034, PR-044) are marked in their entries. This table is a convenience index,
not a separate source of truth — see each finding's own header for its severity.
