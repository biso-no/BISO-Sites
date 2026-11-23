# Sentry Stage 3 — Carried privacy fixes, Appwrite functions and cron monitors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last two privacy gaps from Stage 2b (capability tokens in URL paths reaching Sentry; buffered navigation entries in replays), then make the three Appwrite functions report errors to Sentry and give every scheduled job a Sentry cron monitor, so a failed or missed run raises an issue.

**Architecture:** A dependency-free reporter (`packages/observability/src/functions/reporter.ts`: plain `fetch`, no imports) sends error envelopes and cron check-ins over Sentry's HTTP API. The two bundled functions import it via `@repo/observability/functions`; `scheduled-dispatch` (no build step, deployed from the repo root on Bun 1.0) imports the same file by relative path. Monitors are upserted by the check-ins themselves (`monitor_config`), so nothing is created by hand.

**Tech Stack:** Bun (functions run on Appwrite's Bun runtime; `scheduled-dispatch` on `bun-1.0`), Sentry envelope + cron check-in HTTP APIs, bun:test, vitest (observability).

**Spec:** `docs/superpowers/specs/2026-11-17-sentry-design.md` section 5 (Appwrite functions) and the anti-goals. Notes (git-ignored): `.superpowers/sentry-sdk11-facts.md` → "Plain HTTP (functions)" (exact URLs, envelope format, check-in params), `.superpowers/sentry-codebase-facts.md` → "Functions", `.superpowers/sentry-rulings-stage2b.md` (carried Ruling AP), `.superpowers/sentry-dsns.md` (biso-functions DSN).

## Global Constraints

- Bun only; never push/deploy/touch Appwrite settings; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; biome only on changed files; `bun run check-types` passes.
- **The reporter has zero imports** (not even types from packages) so it runs unchanged under Bun 1.0 from a relative path. Only `fetch`, `crypto.randomUUID`, `AbortController`, `setTimeout`, `JSON`, `Date`.
- **Inert without `SENTRY_DSN`** (function env var): no network call, no throw. A Sentry outage or slow response never fails or delays a function run beyond a 2 s total cap per execution.
- Function env vars (exact names): `SENTRY_DSN` (biso-functions DSN), optional `SENTRY_ENVIRONMENT` (default `production`), optional `MEMBER_ROSTER_SYNC_SCHEDULE` (default `0 3 * * *`). Release: `biso-functions@<APPWRITE_FUNCTION_DEPLOYMENT>` when that env var exists, else unset. Tags: `function: <name>`.
- Monitor slugs (exact): `scheduled-dispatch`; one per dispatch target `dispatch-<kebab target>` where `<kebab target>` = the env var name minus `_URL`, lower-cased, `_`→`-` (e.g. `ORDERS_RECONCILE_URL` → `dispatch-orders-reconcile`); `member-roster-sync`.
- Monitor config (upserted on every check-in): `schedule: { type: "crontab", value }` — dispatcher and its targets `*/5 * * * *`, roster sync from `MEMBER_ROSTER_SYNC_SCHEDULE`; `timezone: "UTC"`; `checkin_margin` 2 (dispatcher/targets) / 30 (roster); `max_runtime` 6 (dispatcher/targets) / 20 (roster); `failure_issue_threshold` 2; `recovery_threshold` 1.
- Errors sent by the reporter pass a self-contained scrubber equivalent to `scrubText`/`scrubUrl` for the cases in Task 2's sync test (emails incl. `%40`, account numbers, fødselsnummer, IBANs, secret pairs, query strings, token path segments).

## Review Focus

1. **A Sentry outage or DNS failure** inside a function run must not throw, must not exceed the 2 s cap, and must not change the function's HTTP response → Task 2 tests (fetch rejects / hangs).
2. **Bun 1.0 compatibility** of the reporter as imported by `scheduled-dispatch` → Task 3 runs its tests under Bun 1.0 (`bun x bun@1.0.36 test …` or the closest 1.0.x available) as well as 1.4.
3. **A dispatch target that's unset** (env var missing) must not create a monitor that then reports "missed" forever → Task 3 test: only configured targets check in.
4. **Capability tokens in URL paths** (`/fs/approve/<token>`, `/recruitment/book/<token>`, `/scan/<token>`, `/shop/order/<id>`, `/auth/verify`) must not reach Sentry in any event, breadcrumb, span or replay → Task 1 tests.
5. **Dev verification leaving monitors behind** that alert "missed" → Task 5 deletes the `development` monitor environments it created.

---

### Task 1: Carried privacy fixes (Ruling AP)

**Files:** `packages/observability/src/scrub.ts` (+tests), `packages/observability/src/browser/replay.ts` (+tests), `apps/web/src/lib/sentry-configured.ts`, `apps/admin/src/lib/sentry-configured.ts`.

**Interfaces:**
- `CAPABILITY_PATH_PATTERNS: RegExp[]` in `scrub.ts` — one per capability route; `scrubUrl` replaces the capability segment with `[redacted]`: `/fs/approve/<x>` → `/fs/approve/[redacted]`, `/recruitment/book/<x>` → `/recruitment/book/[redacted]`, `/scan/<x>` → `/scan/[redacted]`, `/shop/order/<x>` → `/shop/order/[redacted]`. Audit web and admin routes for other `[token]`/capability segments (grep `app/**/[*]` dynamic segments used as secrets, e.g. member pass, verification, booking links) and add them; list them in the report. Applies everywhere `scrubUrl` runs (events, breadcrumbs, spans, logs, feedback, replay URLs).
- Replay `beforeAddRecordingEvent` becomes app-aware: drop (`return null`) any `navigation.*`/`resource.*` performance span whose description or `data.previous` is a denied route for that app (`isReplayDenied(app, url)`); otherwise strip as today.
- Minors: resolve relative hrefs in the denylist check against `location.href` when available; install the history handler via the SDK's `maybeInstrument`/`addHistoryInstrumentationHandler` (verify the 11.13.0 export) rather than relying on breadcrumbs; `sentry-configured.ts` comments say "when the DSN is set at build time".

- [ ] **Step 1: Failing tests:** `scrubUrl("https://biso.no/fs/approve/abc123?x=1")` → `"https://biso.no/fs/approve/[redacted]"`, same for each pattern, relative and absolute; an unrelated `/events/123` survives; a replay recording event `{ type: 5, data: { tag: "performanceSpan", payload: { op: "navigation.navigate", description: "https://biso.no/fs/approve/tok" } } }` for app web → `null`; a non-denied description → query stripped only; relative-href denylist check resolves against the current location.
- [ ] **Step 2–4:** FAIL → implement → PASS (`cd packages/observability && bun x vitest run`; web/admin tests for the touched helper files; `bun run check-types`).
- [ ] **Step 5: Commit** `fix(observability): keep capability tokens out of Sentry and replays`.

---

### Task 2: Dependency-free functions reporter

**Files:** create `packages/observability/src/functions/reporter.ts`, `packages/observability/src/functions/reporter.test.ts`, `packages/observability/src/functions/reporter-scrub-sync.test.ts`; `packages/observability/package.json` (export `./functions`).

**Interfaces (all exported from `reporter.ts`):**
- `interface ReporterConfig { dsn?: string; environment?: string; release?: string; tags?: Record<string, string>; timeoutMs?: number }`
- `function createReporter(config: ReporterConfig): Reporter`
- `interface Reporter { enabled: boolean; captureError(error: unknown, extraTags?: Record<string, string>): void; checkIn(slug: string, status: "in_progress" | "ok" | "error", options?: { checkInId?: string; durationSeconds?: number; monitorConfig?: MonitorConfig }): string | undefined; flush(): Promise<void> }`
- `interface MonitorConfig { schedule: string; checkinMargin: number; maxRuntime: number; failureIssueThreshold: number; recoveryThreshold: number; timezone: string }`
- `function reporterFromEnv(env: Record<string, string | undefined>, functionName: string): Reporter` — reads `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `APPWRITE_FUNCTION_DEPLOYMENT` → release `biso-functions@<id>`, tag `function`.
- `checkIn` returns the check-in id (generate with `crypto.randomUUID()` for `in_progress`, reuse for the closing call). Sends `POST https://o<org>.ingest.<region>.sentry.io/api/<project>/cron/<slug>/<publicKey>/` with JSON body `{ status, check_in_id, duration, environment, monitor_config: { schedule: { type: "crontab", value }, checkin_margin, max_runtime, failure_issue_threshold, recovery_threshold, timezone } }` (verify field names and whether `check_in_id`/`duration` go in the body or query against Sentry's cron HTTP docs via the Sentry MCP `search_docs`/`get_doc`; build the host from the DSN, never hard-code `de`).
- `captureError` sends one envelope `POST …/api/<project>/envelope/?sentry_key=<key>&sentry_version=7` with `Content-Type: application/x-sentry-envelope`, three lines (envelope header, item header, event) — event has `event_id` (32 hex), `timestamp` (seconds), `platform: "javascript"`, `level: "error"`, `environment`, `release`, `tags`, `exception.values[0] = { type, value, stacktrace?: { frames } }` parsed from `error.stack` (oldest first; best effort), all strings through the local scrubber.
- All sends are tracked in an internal set; `flush()` awaits them with a single shared deadline of `timeoutMs` (default 2000 ms) using `AbortController`; it never rejects. Disabled reporter (no/blank/invalid DSN): every method is a no-op, `checkIn` returns `undefined`, `flush` resolves immediately, no `fetch` call.
- Local scrubber (private): self-contained copies of the patterns needed (no imports).

- [ ] **Step 1: Failing tests** (`reporter.test.ts`, bun-compatible but run with vitest in this package; mock `globalThis.fetch`): DSN parsing for `https://<key>@o<org>.ingest.de.sentry.io/<id>` → correct envelope and cron URLs; disabled when DSN missing/blank/garbage (no fetch); `captureError(new Error("Konto 1234.56.78903 failed for ola@biso.no"))` → one envelope, three lines, message scrubbed, tags merged, release/environment set; `checkIn("scheduled-dispatch","in_progress",{monitorConfig})` → POST to the cron URL with the exact body fields and returns an id; closing check-in reuses it; `flush()` resolves within ~2 s when fetch hangs (fake timers) and when fetch rejects; no exception escapes any method.
- [ ] **Step 2: Sync test** (`reporter-scrub-sync.test.ts`): a corpus of ~20 strings (emails incl. `%40`, account numbers, fnr, IBANs, secret pairs, URLs with queries, capability paths from Task 1, harmless text) — the reporter's internal scrubber (exported as `__scrubForTest`) and `scrubText`/`scrubUrl` from `../scrub` produce identical results.
- [ ] **Step 3: Check zero imports**: a test reads `reporter.ts` source and asserts it contains no `import ` / `require(` statements.
- [ ] **Step 4–5:** FAIL → implement → PASS + check-types. **Step 6: Commit** `feat(observability): dependency-free Sentry reporter for Appwrite functions`.

---

### Task 3: scheduled-dispatch — errors and cron monitors

**Files:** `functions/scheduled-dispatch/src/main.ts`; new `functions/scheduled-dispatch/src/main.test.ts`; `functions/scheduled-dispatch/package.json` (`"test": "bun test ./src"`); `functions/scheduled-dispatch/README.md` (env vars).

**Interfaces:** import `{ reporterFromEnv }` from `"../../../packages/observability/src/functions/reporter.ts"` (relative — the function deploys from the repo root with no workspace install; add a comment). Export a pure helper `monitorSlugFor(envVar: string): string` (Global Constraints rule).

Behaviour: at handler start `const reporter = reporterFromEnv(process.env, "scheduled-dispatch")`; `checkIn("scheduled-dispatch","in_progress", { monitorConfig: dispatcher })`; after `Promise.all` of pings, for each **configured** target `checkIn(monitorSlugFor(name), result.ok ? "ok" : "error", { durationSeconds, monitorConfig: target })` (single closing check-in, no in_progress, since the dispatcher measured it); failed targets also `captureError(new Error(\`${name} failed: ${status ?? "no response"}\`), { target: name })`; closing dispatcher check-in `ok` if all ok else `error`, with duration; the catch-all path captures the error and closes `error`; `await reporter.flush()` before every `return res…`. Response bodies/status unchanged.

- [ ] **Step 1: Failing tests** (bun:test; build a fake Appwrite context `{ req, res, log, error }` and mock `fetch` to answer target pings and record Sentry calls): with `SENTRY_DSN` set and two targets configured (one 200, one 500) → dispatcher in_progress + error close, two target check-ins with the right slugs/statuses, one captured error, response 502 as before; with no `SENTRY_DSN` → zero Sentry calls and identical response; an unset target produces no check-in; `monitorSlugFor("ORDERS_RECONCILE_URL") === "dispatch-orders-reconcile"`; Sentry fetch hanging doesn't delay the response beyond ~2 s.
- [ ] **Step 2: Run under Bun 1.4 and Bun 1.0**: `cd functions/scheduled-dispatch && bun test ./src` and `bun x bun@1.0.36 test ./src` (if 1.0.36 isn't fetchable, use the closest 1.0.x and say which) → FAIL then PASS on both.
- [ ] **Step 3: Implement**, update README (new optional env vars, monitors it creates).
- [ ] **Step 4:** tests on both Bun versions + `bun run check-types --filter=scheduled-dispatch`.
- [ ] **Step 5: Commit** `feat(scheduled-dispatch): report failures and check in to Sentry cron monitors`.

---

### Task 4: content-notifier and member-roster-sync

**Files:** `functions/content-notifier/src/main.ts` (+ its tests), `functions/member-roster-sync/src/main.ts` (+ `run.test.ts`/a new `main.test.ts`), both `package.json` (dep `@repo/observability: workspace:*` if not already transitive), both READMEs.

**Interfaces:** `import { reporterFromEnv } from "@repo/observability/functions"`.
- content-notifier: errors only — capture the handler's catch-all error and any response ≥ 400 path's error (`captureError` with tag `function: content-notifier`); no monitor (the dispatcher's `dispatch-content-notifier` monitor covers its schedule). `await reporter.flush()` before returning.
- member-roster-sync: `checkIn("member-roster-sync","in_progress",{ monitorConfig: { schedule: env.MEMBER_ROSTER_SYNC_SCHEDULE ?? "0 3 * * *", checkinMargin: 30, maxRuntime: 20, failureIssueThreshold: 2, recoveryThreshold: 1, timezone: "UTC" } })`; close `ok` when `runSync` returns `ok: true` or `skipped`, `error` otherwise (and `captureError` for thrown errors or `ok: false`); `flush()` before returning.

- [ ] **Step 1: Failing tests** for both (mock `fetch` for Sentry; existing deps injected): DSN set → expected calls; no DSN → none; a skipped run closes `ok` (don't alert on overlap skips); responses unchanged.
- [ ] **Step 2–4:** FAIL → implement → PASS (`bun test ./src` in each; `bun run bundle` in each still succeeds and the bundle contains the reporter; `bun run check-types`).
- [ ] **Step 5: Commit** `feat(functions): report content-notifier and roster-sync failures to Sentry`.

---

### Task 5: Live verification and cleanup

- [ ] **Step 1:** With the biso-functions DSN and `SENTRY_ENVIRONMENT=development`, run each handler once locally from a tiny script (fake context; dispatcher with two targets pointing at a local HTTP stub returning 200 and 500 — never at production endpoints; roster sync with its Appwrite/24SO deps stubbed or skipped via the overlap guard → `skipped`). Confirm in Sentry (MCP `find_monitors`, `search_issues`; org `bi-student-organisation`, regionUrl `https://de.sentry.io`, project `biso-functions`) that monitors `scheduled-dispatch`, `dispatch-<stub targets>`, `member-roster-sync` exist with the right schedule/margins and the failing target raised an error event with scrubbed text and tag `function`.
- [ ] **Step 2:** Run the dispatcher test path under Bun 1.0 once end-to-end (same script with `bun x bun@1.0.x`).
- [ ] **Step 3: Cleanup:** delete the `development` environment of every monitor created (MCP `delete_monitor_environment`), so they never alert "missed". Leave production environments untouched (none should exist).
- [ ] **Step 4:** Write `.superpowers/sentry-stage3-notes.md`: verified items with evidence, the exact env vars the owner must add per function, and the monitor list for Stage 5's alerts.
