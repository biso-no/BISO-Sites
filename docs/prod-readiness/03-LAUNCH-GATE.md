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

## Current status: NO-GO

Two gates are ❌ (`C7`, `F5`), the majority of gates remain ⬜ unverified,
and `02-FINDINGS.md` currently has 2 open blockers (`PR-015`, `PR-017`).

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
| C3 | Authorization chain integrity (Azure AD → M365 provisioning → Appwrite team → role → RLS) is sound end-to-end | ⬜ | S03 found this chain has a confirmed break at the provisioning step (PR-015, blocker) and a naming-fragility risk (PR-016). Cannot be marked green while PR-015 is open. |
| C4 | Appwrite collection-level `$permissions` follow least-privilege, consistent with the role model | ⬜ | S03: 31 of 82 tables found over-permissive (PR-017, blocker). Cannot be marked green while PR-017 is open. |
| C5 | CORS / proxy layer is correctly scoped (no unintended cross-origin exposure) | ✅ | S03 confirmed `apps/api/src/proxy.ts` is intentionally CORS-only (handles preflight, applies CORS headers) and does not itself gate authentication — matches its documented intent, not a bypass. |
| C6 | Webhook signature verification enforced on all payment/bot callbacks (Vipps, Stripe, Bot Framework) | ⬜ | S03 delegated this to a sub-agent verification pass that had not reported conclusions in the recovered session memory (PR-026). Needs re-verification. |
| C7 | JWT authentication enforced on every admin-scoped API route | ❌ | S03 delegated this to a sub-agent verification pass that had not reported conclusions in the recovered session memory (PR-026) — treated as failing/unverified rather than assumed-clean given the two confirmed authz blockers found elsewhere in the same session. Must be explicitly re-verified before this can move off ❌. |

## D — Money path / payments (4 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| D1 | Vipps webhook HMAC signature verification is correct and enforced | ⬜ | Not independently re-verified in S01–S04; test coverage exists (`webhook.test.ts`) but production enforcement not confirmed in this audit round. Planned for S05. |
| D2 | Payment checkout → webhook → return flow handles all failure modes without silent data loss | ⬜ | S02 found the payment-return handler crashes on missing `APPWRITE_DATABASE_ID`/`APPWRITE_WEBSHOP_PRODUCTS_COLLECTION_ID` (PR-011) rather than degrading gracefully; full flow not yet exercised end-to-end. Planned for S05, owner action `O-13`. |
| D3 | Accounting/reconciliation fields (e.g. Finago account number) are always populated or the failure is loud, not silent | ⬜ | Not yet audited. Planned for S05. |
| D4 | Stripe/Vipps credentials are correctly scoped per environment (no prod creds in staging or vice versa) | ⬜ | Not yet audited; console-side, owner-only verification. |

## E — Data integrity (3 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| E1 | Appwrite schema has no structural defects (duplicate/invalid collection IDs) | ⬜ | S03 found a duplicate `departments` table ID (PR-019) — must be fixed and re-verified. |
| E2 | Row-permission (RLS) backstop is idempotent — access is retracted when it should be, not just granted | ⬜ | S03 found the sync is additive-only; stale access persists (PR-018). Needs a design decision + fix before this can be green. |
| E3 | Anonymous session/user cleanup runs reliably in production | ⬜ | Tied to PR-001/B5 — cron wiring gap. |

## F — Correctness & UX floor (5 gates)

| Gate | Description | Status | Evidence |
|------|-------------|--------|----------|
| F1 | All 4 apps build and serve without console errors on core flows | ⬜ | Not yet exercised end-to-end against a running deployment in this audit round. |
| F2 | SEO/metadata correctness (sitemap, OG images, `metadataBase`) | ⬜ | S01 found related low-severity issues (PR-005, PR-006) but gate itself not formally closed. |
| F3 | Accessibility floor met on core public flows | ⬜ | Not yet audited. |
| F4 | Feature-flag kill switches correctly gate unfinished/risky features (payments, AI copilot, expenses) | ⬜ | Not yet audited in this round; see project memory `reference_feature_flag_kill_switches` for the existing catalog — worth cross-referencing in S05/S09. |
| F5 | Authorization correctness on core admin/member flows (a logged-in user only sees/does what their role allows) | ❌ | **Red — directly tied to the two open blockers `PR-015` and `PR-017`.** Until M365 user-creation assigns group membership and the 31 over-permissive collections are resolved, this gate cannot be green regardless of any other progress. |

---

## Summary

| Category | ✅ | ⚠️ | ⬜ | ❌ |
|----------|----|----|----|----|
| A — Builds & type safety | 2 | 0 | 3 | 0 |
| B — Deploy & runtime config | 0 | 1 | 4 | 0 |
| C — Secrets & security | 3 | 0 | 3 | 1 |
| D — Money path / payments | 0 | 0 | 4 | 0 |
| E — Data integrity | 0 | 0 | 3 | 0 |
| F — Correctness & UX floor | 0 | 0 | 4 | 1 |
| **Total (29)** | **5** | **1** | **21** | **2** |

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

**Bottom line:** launch is currently **NO-GO**. The two blockers (`PR-015`,
`PR-017`) must close before `F5`/`C3`/`C4` can move off red, `C7` needs an
explicit re-verification pass (not just an assumption of pass), and the
majority of gates simply haven't been checked yet by the runtime-focused
sessions (S05–S09) that remain in `00-PLAN.md`.
