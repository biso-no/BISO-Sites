> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

# Production-Readiness Audit — Owner Action Items

These are items the audit itself cannot verify or complete — they require
Appwrite/Azure console access, a staging deploy, or a product decision only
the repo owner (MHeien) can make. Each is: ID, action, why it matters, how
to verify, status.

## From S02 (dependencies, config & secrets)

### O-01 — Confirm `RECRUITMENT_BOOKING_SECRET` matches between `web` and `admin`
**Why:** This secret is used to validate recruitment booking tokens issued
by one app and consumed by the other. A mismatch silently breaks booking
validation (tokens generated as valid are rejected, or worse, validation
logic degrades unsafely). Read in `apps/web/src/app/actions/booking.ts:18`
with no fallback.
**How to verify:** In the Appwrite console, compare the value of
`RECRUITMENT_BOOKING_SECRET` set on the `web` site vs. the `admin` site —
they must be byte-identical.
**Status:** open.

### O-02 — Confirm `CRON_SECRET` is set in the `web` app's Appwrite console
**Why:** Missing from `apps/web/.env.example` but read by
`apps/web/src/app/api/cron/cleanup-reservations/route.ts`. That route's own
code comment states an unset `CRON_SECRET` allows unauthenticated calls
outside production — if an operator has no reason to expect this var is
required (because it's undocumented), it may simply not be set. See PR-011.
**How to verify:** Appwrite console → `web` site → environment variables →
confirm `CRON_SECRET` is present and non-empty.
**Status:** open.

### O-03 — Confirm `CRON_SECRET` is set in the `admin` app's Appwrite console
**Why:** Same variable, same risk pattern as O-02, also missing from
`apps/admin/.env.example` (PR-011).
**How to verify:** Appwrite console → `admin` site → environment variables.
**Status:** open.

### O-04 — Confirm `APPWRITE_DATABASE_ID`, `APPWRITE_PROJECT_ID` / `NEXT_PUBLIC_APPWRITE_PROJECT_ID` are set in the `web` app's console
**Why:** These core infrastructure IDs are read with non-null assertions
(`!`) in `apps/web/src/app/api/checkout/return/route.ts`. If unset, the
payment-return handler throws at runtime, breaking the payment flow at the
worst possible moment (right after a customer has paid). Missing from
`apps/web/.env.example` (PR-011 — see `02-FINDINGS.md` for full evidence).
**How to verify:** Appwrite console → `web` site → environment variables;
also grep-confirm these match the values actually used by
`packages/api/appwrite.config.json`'s target project.
**Status:** open.

### O-05 — Confirm `APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID` and `APPWRITE_CAMPUS_BOARD_FUNCTION_ID` are set in the `web` app's console
**Why:** Read in the checkout/return flow and the campus board feature
respectively; both missing from `apps/web/.env.example` (PR-011).
**How to verify:** Appwrite console → `web` site → environment variables.
**Status:** open.

### O-06 — Resolve `AZURE_CLIENT_SECRET` vs. `AZURE_GRAPH_CLIENT_SECRET` naming mismatch in `api`
**Why:** `apps/api/src/app/api/campus/[campusId]/[departmentId]/board/route.ts:123`
reads `process.env.AZURE_CLIENT_SECRET!` (non-null assertion — crashes if
unset), but `apps/api/.env.example` documents `AZURE_GRAPH_CLIENT_SECRET`.
Confirm which name is actually set in the console; if it's the documented
one, the board route will crash.
**How to verify:** Appwrite console → `api` site → environment variables →
check which of the two names is actually present; align code and docs to
match whichever is authoritative (or set both during a transition).
**Status:** open.

### O-07 — Confirm `NEXT_PUBLIC_WEB_BASE_URL` is set at **build time** for the `api` app
**Why:** This var is build-inlined (due to the `NEXT_PUBLIC_` prefix), not
just a runtime read, despite being consumed server-side in
`apps/api/src/app/api/payment/[provider]/checkout/route.ts:44`. It's
missing from `apps/api/.env.example` (PR-012). If unset at build time, the
payment redirect falls back to `NEXT_PUBLIC_BASE_URL` (the api app's own
domain) instead of `web.biso.no`, sending paying customers to the wrong
host after checkout.
**How to verify:** Confirm the var is set in the Appwrite **build**
configuration for the `api` site (not just runtime env), then rebuild and
check the compiled output actually contains the correct inlined value.
**Status:** open.

### O-08 — Bump `next` from 16.2.2 to a patched version (≥16.2.5) and redeploy all 4 sites
**Why:** `bun audit` flags 8 high-severity vulnerabilities in the current
pinned version, including pre-auth-reachable middleware/proxy bypasses and
an SSRF via WebSocket upgrade on the public `web` app (PR-008).
**How to verify:** Update the `next` catalog entry in root `package.json`,
run `bun install`, `bun run build`, `bun run check-types`, confirm
`bun audit` no longer flags the Next.js CVE range, then redeploy `web`,
`admin`, `api`, and `docs`.
**Status:** open.

### O-09 — Confirm `scheduled-dispatch` Appwrite function is deployed with correct schedule + secret
**Why:** This is the function that pings all cron-gated endpoints
(cleanup-anon-users, post-pending, sync jobs, etc.) — repo-side code alone
can't confirm it's actually deployed and scheduled in the target Appwrite
project.
**How to verify:** Appwrite console → Functions → `scheduled-dispatch` →
confirm deployment status, the configured cron schedule, and that its
`CRON_SECRET` env var matches the value each target app expects.
**Status:** open.

### O-10 — Pull and review actual Appwrite build logs for all 4 sites, specifically the flatten step
**Why:** `build:web:appwrite` fails locally on macOS due to a dangling
`styled-jsx` symlink (PR-002); `build:admin:appwrite` succeeds locally.
Whether Appwrite's own (Linux) build container hits the same failure — or a
different one — is unknown without looking at real build logs.
**How to verify:** Trigger (or find the most recent) build for each of the
4 Appwrite sites, download/review the build log, and confirm the flatten
step completes and produces the expected bundle structure (root
`server.js` wrapper, static assets, `node_modules`).
**Status:** open.

### O-11 — Decide how `cleanup-anon-users` gets triggered on Appwrite
**Why:** The repo currently only wires this route into a Vercel cron
config, which will not fire on the actual Appwrite deployment target
(PR-001). Anonymous sessions/users will accumulate unbounded until this is
fixed.
**How to verify / decide:** Choose between (a) adding it to
`scheduled-dispatch`'s ping list (recommended, consistent with other cron
endpoints) or (b) some other mechanism; implement and confirm it actually
fires by checking Appwrite function/route logs after the next scheduled
run.
**Status:** open.

### O-12 — Run a staging smoke test hitting each app's health endpoint
**Why:** Confirms baseline availability post-deploy before committing to a
production cutover.
**How to verify:** Hit `/api/health` (or equivalent) on each of `web`,
`admin`, `api` in staging; confirm 200 responses and expected payload
shape. Cross-reference with the existing required-teams health check
(`GET /api/health/teams`) documented in project memory.
**Status:** open.

### O-13 — Run a full end-to-end Vipps payment flow in staging
**Why:** Confirms the payment path (checkout → Vipps redirect → webhook →
return) works correctly with real Appwrite env vars configured per
O-01–O-07, and specifically exercises the code paths flagged by PR-011
(non-null assertions on checkout/return) and PR-012 (build-time base URL).
**How to verify:** Complete a real (or Vipps test-mode) purchase in
staging; confirm the order is created, the webhook is received and
verified, and the return page shows correct order status with a populated
Finago account number (see also gate `D3` in `03-LAUNCH-GATE.md`).
**Status:** open.

## From S03 (security / authorization architecture)

### O-14 — Product/security decision on the 31 over-permissive collections (PR-017)
**Why:** Table-by-table review is required: for each of the 31 tables
granting `create("users")`/`create("any")`, decide whether that's
genuinely intended (e.g. public order/reservation submission may be by
design for `orders`/`cart_reservations`) or should be tightened to
team-scoped create, consistent with the row-permission model already in
place for reads.
**How to verify:** Walk the table list in `PR-017` (`02-FINDINGS.md`)
against the Appwrite console's collection permissions; for each, document
the decision and, where tightening is needed, update
`packages/api/appwrite.config.json` and redeploy the schema.
**Status:** open.

### O-15 — Confirm whether recruitment PII tables are among the 31 over-permissive collections
**Why:** If `job_applications`, `candidate_profiles`, or `job_interviews`
carry collection-level `create("users")`, the HR-only creation intent from
`PERMISSIONS_REVIEW.md` Finding D is not enforced at the collection layer —
a possible GDPR-relevant re-exposure on the *create* path (PR-021).
**How to verify:** Cross-reference the PR-017 table list against these
three collection names in the Appwrite console or
`packages/api/appwrite.config.json`; if any overlap, tighten collection
create to HR/Operations-Unit teams only.
**Status:** open.

### O-16 — Fix the duplicate `departments` table ID and redeploy the schema
**Why:** `packages/api/appwrite.config.json` defines the `departments`
table ID twice — invalid Appwrite configuration (PR-019).
**How to verify:** Identify the authoritative definition, remove the
duplicate, `appwrite push` the schema, and confirm in the console that
exactly one `departments` collection exists post-fix.
**Status:** open.

### O-17 — Add Azure security-group assignment to M365 user creation
**Why:** `createM365User()` never assigns newly created users to any
`SG-App-*` security group, so their first admin sign-in resolves to zero
Appwrite team membership and zero authorization — a launch-blocking gap
(PR-015).
**How to verify:** Add an explicit Graph group-assignment call (e.g.
`addUserToGroup` per group the new user should belong to) to
`apps/admin/src/app/(portal)/_actions/it-users.ts`'s `createM365User()`;
test by creating a real test user in the Azure tenant and confirming they
land in the correct Appwrite team(s) on first sign-in.
**Status:** open.

### O-18 — Add Unicode sanitization to Azure-group-to-Appwrite-team-ID derivation
**Why:** `apps/admin/src/lib/m365-sync.ts:22` derives team IDs via
`.toLowerCase()` only — Norwegian characters (æ/ø/å), spaces, or other
special characters in an Azure group's display name will produce an
invalid or colliding Appwrite team ID, silently breaking access for every
user in that group (PR-016).
**How to verify:** Add explicit sanitization (normalize/strip diacritics,
enforce Appwrite's `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$` pattern) to the
derivation function; re-run sync against every existing Azure group
(especially ones with Norwegian names) and confirm no ID collisions or
failures.
**Status:** open.

### O-19 — Decide and implement a policy for retracting stale row permissions
**Why:** The current sync flow only adds Appwrite team memberships/row
permissions; nothing removes them when a user's Azure group membership
changes (department transfer, offboarding, role change) — access persists
after the entitlement that granted it is gone (PR-018).
**How to verify:** This is a design decision, not a quick fix — decide
between a periodic reconciliation job vs. an explicit revoke-on-sync step,
implement it, and verify by removing a test user from an Azure group and
confirming their Appwrite access is actually revoked within an acceptable
window.
**Status:** open.

## Meta

### O-20 — Commit `docs/prod-readiness/` to git
**Why:** This entire reconstruction exercise was necessary because the
original S01–S04 audit documentation was written to disk but never
committed, and was lost. Untracked audit state is a single `rm` or a
crashed session away from disappearing again.
**How to verify:** `git add docs/prod-readiness/ && git commit`, then
confirm with `git log -- docs/prod-readiness/` that the files are tracked.
**Status:** open — recommended as the very next action once this
reconstruction is reviewed.
