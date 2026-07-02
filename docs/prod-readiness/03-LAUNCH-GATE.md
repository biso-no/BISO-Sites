> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

# Production-Readiness Audit — Launch Gate

19 gates across 6 categories. Each gate is either mechanically verifiable
(e.g. `bun run build`, `bun run check-types`, a secret scan) or tied to a
specific finding in `02-FINDINGS.md`.

**Legend:** ✅ green (verified passing) · ⚠️ accepted-risk (deferred with
explicit sign-off, documented rationale) · ⬜ pending (not yet verified by
any session) · ❌ red (verified failing — blocks launch).

**Go condition:** every gate is ✅ or ⚠️ (with sign-off), **and** zero open
`blocker`-severity findings in `02-FINDINGS.md`. Any single ❌ blocks launch
outright, no exceptions absent an explicit deferral.

## Current status: NO-GO (reaffirmed after PR-032 code remediation, 2026-07-02)

Gates `C7`, `F5`, and now `D1`/`D2`/`D3` are ❌; the majority remain ⬜; and
`PR-032`, `PR-033`, `PR-015`, `PR-017`, and `PR-034` are now code/config
remediated locally, but owner live verification remains pending before full
closure. The runtime audit added the
money-path (`D`) evidence that was previously "planned for S05" and it remains
red because reconciliation, stock, reservation cleanup, and accounting gaps are
still open. See `07-GO-NO-GO.md` for the full verdict and ordered remediation
path.

---

## A — Builds & type safety (5 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| A1 | `bun run build` succeeds for all 4 apps | ✅ | S01: all 15 packages/apps build in 39s, exit 0 (warnings only — sitemap dynamic-server-usage, docs metadataBase). |
| A2 | `bun run check-types` passes with no suppressed errors | ✅ | S01: no `ignoreBuildErrors`/`ignoreDuringBuilds` found in any `next.config`. S04-partial: `tsc --noEmit` passes cleanly on all 15 packages, no `@ts-ignore`/`@ts-expect-error`/`as any` in scan output. |
| A3 | `bun run lint` passes for all packages | ⬜ | Not formally closed — S04 was cut short. Known issue: `@repo/ui`'s `biome.json` excludes all files, so this package currently has no effective lint gate (PR-030). Needs a full re-run to close this gate. |
| A4 | No dead code / unused-dependency backlog above an agreed threshold | ⬜ | Not formally closed. Knip found 11 unused deps, 2 unused files, 1 unused catalog entry (PR-031), and 2 circular-dependency pairs (PR-029) — none confirmed launch-blocking, but not triaged to zero either. |
| A5 | Appwrite-specific `build:*:appwrite` flatten scripts succeed for all 4 apps | ⬜ | S01 found `build:web:appwrite` fails locally on macOS (PR-002, dangling styled-jsx symlink); `build:admin:appwrite` succeeds. `api`/`docs` flatten scripts not confirmed either way locally. Whether Appwrite's own (Linux) build environment hits the same failure is unverified — see owner action `O-10`. |

## B — Deploy & runtime config (5 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| B1 | `turbo.json#tasks.build.env` allow-list is complete for every var read at build time | ⚠️ accepted-risk | S02: ~20+ missing vars are server-runtime reads, not build-inlined values, so this is a Turbo cache-correctness gap (PR-007), not a production misconfiguration risk. Deferred to post-launch with this rationale; requires owner sign-off to formally accept. |
| B2 | Every Appwrite site (`web`, `admin`, `api`) has all runtime-required env vars actually set in the console | ⬜ | S02 identified the audit-side gap (`.env.example` parity, PR-011/PR-012) but confirming actual console state is owner-only (owner actions `O-01`–`O-07`). |
| B3 | Dockerfiles (where present) are correct and buildable | ⬜ | PR-003 found stale paths/lockfile references in web/api Dockerfiles; not launch-relevant if Appwrite build-on-platform is the only deploy path in use, but not formally waived either. |
| B4 | `scheduled-dispatch` Appwrite function is deployed with correct schedule + `CRON_SECRET` | ⬜ | Owner action `O-09`; not independently verifiable from the repo alone (console-side state). |
| B5 | `cleanup-anon-users` is wired into a schedule that actually fires on Appwrite | ⬜ | PR-001: currently only referenced in a Vercel cron config that won't fire on the Appwrite deployment target. Owner decision needed (`O-11`). |

## C — Secrets & security (7 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| C1 | No server-only secrets reachable from client-side code | ✅ | S02: 433 `"use client"` files scanned, 0 matches for non-`NEXT_PUBLIC_`/`NODE_ENV` `process.env` reads. |
| C2 | No real secrets committed to the repo (working tree or history) | ✅ | S02: gitleaks scanned working tree + 598-commit history, 12 hits, all confirmed false positives (PR-014 — Appwrite schema `twoWayKey` IDs and a test-only fixture). No rotation required. |
| C3 | Authorization chain integrity (Azure AD → M365 provisioning → Appwrite team → role → RLS) is sound end-to-end | ⬜ | PR-015 is code-remediated locally: new M365 users are assigned required Azure security groups during creation and covered by a targeted test. Gate stays pending until owner verifies with a real Azure tenant test user; PR-016 naming fragility remains open. |
| C4 | Appwrite collection-level `$permissions` follow least-privilege, consistent with the role model | ⬜ | PR-017/PR-033/PR-034 are code/config-remediated locally: source config has zero `create("any")` / `create("users")`, protected by `packages/api/appwrite-config.test.ts`. Gate stays pending until owner pushes/verifies live Appwrite permissions. |
| C5 | CORS / proxy layer is correctly scoped (no unintended cross-origin exposure) | ✅ | S03 confirmed `apps/api/src/proxy.ts` is intentionally CORS-only (handles preflight, applies CORS headers) and does not itself gate authentication — matches its documented intent, not a bypass. |
| C6 | Webhook signature verification enforced on all payment/bot callbacks (Vipps, Stripe, Bot Framework) | ✅ | S05 verified Vipps HMAC (raw body, `POST\n<pathAndQuery>\n<date>;<host>;<contentSha256>`, constant-time compare) and Stripe SDK verification (raw body, 300s tolerance) directly in code — both correct. Note the *authenticity* is sound; the availability/idempotency issues around them are separate findings (PR-038/PR-039). |
| C7 | JWT/authentication enforced on every admin-scoped and money-moving API route | ❌ | **Red.** PR-032 has been code-remediated locally: checkout now requires an Appwrite JWT, derives `userId` from `account.get()`, recomputes trusted totals, and rejects mismatches; targeted route tests plus api/web typecheck/lint pass. Gate remains ❌ until owner live smoke verifies the deployed checkout flow and the admin-route JWT pass from S03 (PR-026) is completed. |

## D — Money path / payments (4 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| D1 | Vipps webhook HMAC signature verification is correct and enforced | ✅ | S05 verified the HMAC scheme, raw-body handling, content-hash pre-check, and constant-time compare directly in `packages/payment/src/vipps/webhook.ts` + callback route. Correct. (Missing timestamp-freshness check PR-042 is low-risk by design.) |
| D2 | Payment checkout → webhook → return flow handles all failure modes without silent data loss | ❌ | **Red.** PR-032's unauthenticated client-amount checkout has been code-remediated locally, pending owner live smoke. The gate remains red because no reconciliation sweep exists for captured-but-diverged/webhook-dead orders (PR-038), stock decrement is non-atomic across 3 entry points (PR-035), and reservation cleanup fails silently on every paid order (PR-037). |
| D3 | Accounting/reconciliation fields (e.g. Finago account number) are always populated or the failure is loud, not silent | ❌ | **Red.** S05: Finago posting happens only on the unauthenticated return route with a non-atomic sentinel; `finago_transaction_id`/`finago_account_number` columns appear absent from schema config; mobile buyers who don't return produce no ledger entry ever (PR-039). Failure is silent, not loud. Owner must confirm column existence live. |
| D4 | Stripe/Vipps credentials are correctly scoped per environment (no prod creds in staging or vice versa) | ⬜ | S05 found the resolution logic falls back to env creds on *any* error (not just 404) and mode/secret can diverge between checkout and webhook verify (PR-041); actual per-env console/portal state is owner-only (`O-21`..`O-24`). Vipps is live at launch; Stripe checkout is OFF. |

## E — Data integrity (3 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| E1 | Appwrite schema has no structural defects (duplicate/invalid collection IDs) | ⬜ | S03 found a duplicate `departments` table ID (PR-019) — must be fixed and re-verified. |
| E2 | Row-permission (RLS) backstop is idempotent — access is retracted when it should be, not just granted | ⬜ | S03 found the sync is additive-only; stale access persists (PR-018). Needs a design decision + fix before this can be green. |
| E3 | Anonymous session/user cleanup runs reliably in production | ❌ | S06 found the cleanup itself has two runtime defects: it fires up to 5000 concurrent `users.delete` calls (PR-052), and its 14-day cutoff vs the 30-day anon cookie strands returning visitors with a dead cookie and no recovery (PR-061, add-to-cart broken up to 16 days). Plus the PR-001/B5 wiring gap. |
| E4 | Concurrent writes on contended rows don't corrupt state (stock, counters, upserts) | ❌ | **New gate (S06/S07).** Non-atomic stock RMW race (PR-035), oversell masking (PR-035), non-atomic `applications_count`/benefit-reveal/purchase-limit check-then-act (PR-078/PR-080/PR-082), booking-token/slot races (PR-059/PR-060). The atomic-claim pattern exists in-repo (expense posting) but is not applied to these paths. |

## F — Correctness & UX floor (5 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| F1 | All 4 apps build and serve without console errors on core flows | ⬜ | Not yet exercised end-to-end against a running deployment in this audit round. |
| F2 | SEO/metadata correctness (sitemap, OG images, `metadataBase`) | ⬜ | S01 found related low-severity issues (PR-005, PR-006) but gate itself not formally closed. |
| F3 | Accessibility floor met on core public flows | ⬜ | Not yet audited. |
| F4 | Feature-flag kill switches correctly gate unfinished/risky features (payments, AI copilot, expenses) | ✅ | S05/S09 verified `packages/shared/utils/feature-flags.ts`: fail-safe defaults (kill switches ON, `payments_stripe` + `expenses_ledger_posting` OFF), DB-override-else-catalog reader, missing/erroring table falls back to defaults. Confirmed the payout cron honors `expenses_ledger_posting` (returns a healthy no-op when off). **Caveat:** keep `expenses_ledger_posting` OFF until PR-034's deployed schema and approval/posting smoke are owner-verified. |
| F6 | System degrades (not fails) when a single upstream — Appwrite, 24SO, Graph, Vipps, OpenAI — is slow or down | ❌ | **New gate (S08).** No timeouts on Appwrite (PR-046), Vipps chain (PR-047), or 24SO SOAP (PR-050); PR-049's homepage Appwrite-blip crash is code-remediated locally; admin loops to login on outage (PR-051); PR-048 now has minimal structured `onRequestError` logging in all four apps but still needs deploy log retention/alerting or Sentry/OTel to be pageable; no dependency-aware readiness probe (PR-055). |
| F5 | Authorization correctness on core admin/member flows (a logged-in user only sees/does what their role allows) | ⬜ | PR-015 and PR-017 are code/config-remediated locally, but this gate remains pending until owner verifies Azure group assignment and live Appwrite collection permissions. PR-018 stale-access/idempotency remains open separately. |

---

## Summary

| Category | ✅ | ⚠️ | ⬜ | ❌ |
|----------|----|----|----|----|
| A — Builds & type safety | 2 | 0 | 3 | 0 |
| B — Deploy & runtime config | 0 | 1 | 4 | 0 |
| C — Secrets & security | 4 | 0 | 2 | 1 |
| D — Money path / payments | 1 | 0 | 1 | 2 |
| E — Data integrity (+E4) | 0 | 0 | 2 | 2 |
| F — Correctness & UX floor (+F6) | 1 | 0 | 4 | 1 |
| **Total (31)** | **8** | **1** | **16** | **6** |

_S05–S09 added two gates (`E4` concurrency-safety, `F6` graceful degradation),
promoted `C6`/`D1`/`F4` to ✅ (verified sound in code), and turned
`C7`/`D2`/`D3`/`E3`/`E4`/`F6` red as the runtime evidence came in — previously
these sat ⬜ "planned for S05."_

**Discrepancy note (not resolved from recovered observations):** session
memory (obs 3530) states the launch gate has "19 gates" but *also* gives the
per-category counts reproduced above (5+5+7+4+3+5), which sum to **29**, not
19. This inconsistency exists in the source material itself and could not
be reconciled — it's possible an earlier draft had 19 gates and later grew
to 29 as categories were fleshed out, or the "19" figure referred to a
different subset (e.g. only the gates considered launch-critical vs. the
full checklist). This document uses the explicit per-category counts (29
total gates) since those were the more specific, itemizable figure
available. Flagged here rather than silently resolved one way or the other.

**Bottom line:** launch is **NO-GO**, reaffirmed after the runtime audit. There
are now **4 severity-blocker findings code/config-remediated locally but pending
owner live verification** (`PR-015`, `PR-017`, `PR-032`, `PR-033`) plus a gated
one (`PR-034`), and 6 red gates. The money path — previously unassessed — is red
across `D2`/`D3` with a confirmed unauthenticated client-amount checkout
(`PR-032`) and silent accounting divergence (`PR-039`). Degradation behaviour
(`F6`) is red: no timeouts mean a single slow upstream can still take the site
down; PR-048 now provides minimal structured server-error logs, but paging/log
retention remains an infrastructure owner action. See `07-GO-NO-GO.md` for the
ordered remediation path. The runtime sessions S05–S09 are now **complete**;
what remains before a go decision is the remediation of the blockers/high
findings plus the live-console owner verifications in `05-OWNER-ACTIONS.md`.
