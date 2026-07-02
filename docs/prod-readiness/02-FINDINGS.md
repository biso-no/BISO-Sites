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
**Status:** open.

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
**Evidence:** `apps/admin/src/app/(portal)/_actions/it-users.ts`
(`createM365User()` — no `addUserToGroup` call in the create path);
`apps/admin/src/lib/m365-sync.ts` (`syncM365Permissions` reads
`transitiveMemberOf`, never writes group membership);
`apps/admin/src/lib/authorization.ts` (`getUserAuthContext()` derives roles
entirely from Appwrite team membership, which depends on the sync above).
**Fix:** Add an explicit Graph group-assignment call to `createM365User()`
so new users are placed in the correct security group(s) at creation time,
not just read from later. Verify against a real Azure tenant test user.
Tracked as owner action `O-17`.
**Status:** open — **launch blocker**.

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
**Evidence:** `packages/api/appwrite.config.json` (collection permission
enumeration, 82 tables audited); `apps/admin/PERMISSIONS_REVIEW.md`
(documents Phase 2 scope was read-permission isolation only).
**Fix:** Table-by-table product/security decision (owner action `O-14`):
for each of the 31 tables, either (a) confirm any-user/anonymous create is
genuinely intended (e.g. public order/reservation submission may be by
design) and leave it, or (b) restrict collection-level create to the
relevant team role(s), consistent with the row-permission model already in
place for reads.
**Status:** open — **launch blocker**.

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

## Severity tally

| Severity | Count | IDs |
|----------|-------|-----|
| blocker | 2 | PR-015, PR-017 |
| high | 7 | PR-001, PR-008, PR-016, PR-018, PR-019, PR-020, PR-021 |
| medium | 10 | PR-002, PR-007, PR-009, PR-011, PR-012, PR-022, PR-023, PR-024, PR-025, PR-030 |
| low | 12 | PR-003, PR-004, PR-005, PR-006, PR-010, PR-013, PR-014, PR-026, PR-027, PR-028, PR-029, PR-031 |

Total: 31 findings (PR-001–PR-031). This corrects the round-number tally in
`01-TRACKER.md`'s summary line, which approximates per-session totals; this
table is the authoritative count. See each finding's own header for its
severity — this table is a convenience index, not a separate source of truth.
