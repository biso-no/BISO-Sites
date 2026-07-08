> Reconstructed 2026-07-02 from session memory after the original (uncommitted) files were lost. Wording is reconstructed; finding IDs and severities are preserved.

# Production-Readiness Audit — Plan

**Repo:** BISO-Sites (Turborepo monorepo: `web`, `admin`, `api`, `docs` + shared packages)
**Target launch:** ~2026-07-08
**Scale:** ~172,000 LOC, 1,100+ TypeScript/JSX files, 4 apps + 9 runtime packages.

## Method

The audit runs as a series of context-scoped sessions (S01, S02, S03, …). Each
session resets context so a ~170K-LOC repo can be covered without blowing a
single context window. Every session:

1. Reads `01-TRACKER.md` to see what's done and what's next.
2. Works its assigned scope only.
3. Logs findings to `02-FINDINGS.md` with a `PR-###` ID, severity, evidence,
   and recommended fix.
4. Updates any relevant rows in `03-LAUNCH-GATE.md`.
5. Marks itself done in `01-TRACKER.md` before ending.

Findings are numbered sequentially across the whole audit (`PR-001`,
`PR-002`, …) regardless of which session produced them — the ledger in
`02-FINDINGS.md` is the single source of truth.

## Severity taxonomy

| Severity   | Definition |
|------------|------------|
| `blocker`  | Launch-blocking: data corruption, money loss, security breach, or outage under normal traffic. Zero open blockers is a hard go/no-go condition. |
| `high`     | Fix before or immediately after launch; painful under real traffic (auth gaps, unpatched public-facing CVEs, silent payment-path failures). |
| `medium`   | Fix soon; degraded behavior under specific conditions (config drift, fragile fallback chains, missing observability). |
| `low`      | Polish/hygiene (dead code, typos, unused deps, cosmetic warnings). |

## Sessions

### Completed

| Session | Scope | Findings |
|---------|-------|----------|
| S01 | Build, deploy & CI (whole repo) | PR-001–PR-007 |
| S02 | Dependencies, config & secrets (whole repo) | PR-008–PR-014 |
| S03 | Security & authorization architecture (whole repo) | PR-015–PR-028 |
| S04 (partial) | Types, lint & dead-code — session was cut short; circular-dep, lint-config, and knip leads captured but the pass was not formally closed | PR-029–PR-031 |

### Remaining — runtime-focused plan (new, set 2026-07-02)

The original plan's remaining sessions (S05–S20) are superseded. Given S01–S04
already covered build/deploy/CI, dependencies/config/secrets, and
authorization architecture reasonably thoroughly, the remaining work is
narrowed to **runtime behavior under real traffic and failure conditions** —
the class of bug that static/architectural review can't catch.

| Session | Scope |
|---------|-------|
| S05 | Payments & money-path runtime — Vipps/Stripe webhook races, idempotency, partial-failure states, reconciliation (Finago) correctness under real traffic. |
| S06 | Auth token lifecycle — JWT expiry/refresh, session client re-auth, Appwrite team-membership cache staleness in long-lived sessions (ties to PR-018/PR-024). |
| S07 | Appwrite runtime semantics — query pagination edge cases, row-permission race conditions on concurrent writes, function/cron execution guarantees. |
| S08 | Next.js/Bun runtime — streaming/RSC edge cases, cache-tag invalidation, standalone-output runtime behavior in the actual Appwrite container (not just local build). |
| S09 | Failure modes & resource exhaustion — rate limiting, connection pool exhaustion, dependency timeouts, graceful degradation under partial outages (Azure/Graph/SOAP/Vipps down). |
| S10 | Synthesis & go/no-go — roll every open finding into `03-LAUNCH-GATE.md`, produce the final go/no-go recommendation. |

New findings from S05–S10 are numbered starting at `PR-032` (see
`06-SESSION-STATE.md`).

## Documents in this audit

| File | Purpose |
|------|---------|
| `00-PLAN.md` | This file — scope, method, severity taxonomy, session list. |
| `01-TRACKER.md` | Live session-by-session checklist and blockers board. |
| `02-FINDINGS.md` | Findings ledger — every `PR-###` with severity, evidence, fix, status. |
| `03-LAUNCH-GATE.md` | The 19-gate minimal go/no-go checklist. |
| `04-AUTHZ-MODEL.md` | Deep-dive reconstruction of the authorization architecture (from S03). |
| `05-OWNER-ACTIONS.md` | Action items only the repo owner can complete (console/staging/rotation). |
| `06-SESSION-STATE.md` | Current in-flight state for whichever session picks this up next. |
