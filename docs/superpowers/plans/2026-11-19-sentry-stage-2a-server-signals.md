# Sentry Stage 2a — Server signals (logs, metrics, AI, ops page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The servers send searchable logs, a few business counters (payments, pushes, expenses, Appwrite slowness), and AI call cost/latency to Sentry; the admin operations page shows whether Sentry is set up and can send a test error; Stage 1's carried fixes land.

**Architecture:** Everything shared goes in `@repo/observability` (new modules `metrics`, `ai`; server options gain the console-logging integration and a root-span namer). Call sites get one-line helper calls. AI spans are always manual (runtime-independent; ai v7 `generateObject` has no automatic spans and the diagnostics channel is unverified on Bun), and the SDK's automatic Vercel AI integration is removed to avoid duplicates.

**Tech Stack:** `@sentry/core` / `@sentry/nextjs` 11.13.0, `ai` 7.0.148, Next 16.3 on Bun 1.4, vitest / bun:test.

**Spec:** `docs/superpowers/specs/2026-11-17-sentry-design.md` (section 3: Logs, AI monitoring, Metrics, Admin operations page). Reference notes (git-ignored, this worktree): `.superpowers/sentry-sdk11-facts.md`, `.superpowers/sentry-codebase-facts.md` (call-site paths), `.superpowers/sentry-stage1-spike.md` (Bun build/run method), `.superpowers/sentry-rulings-stage1.md` (carried items R, S, T, O), `.superpowers/sentry-dsns.md`.

## Global Constraints

- Everything from Stage 1 still holds: Bun only; `@sentry/*` pinned 11.13.0 via `catalog:`; Sentry inert without `NEXT_PUBLIC_SENTRY_DSN`; never break build/boot/sign-in; no static `@sentry/nextjs` value imports in `instrumentation.ts`; shared code uses `@sentry/core` (shared global carrier); next.config imports observability by relative path.
- **No personal data in logs, metric attributes or AI spans.** Logs pass `scrubLog`; metric attributes come from a fixed allow-list (`provider`, `kind`, `app`, `client`, `outcome`); AI spans never carry prompts, messages, tool arguments or outputs.
- Metric names (exact): `payment.completed`, `payment.failed`, `orders.stuck` (gauge), `push.sent`, `push.failed`, `expense.submitted`, `expense.booking_failed`, `appwrite.slow_request`, `appwrite.timeout`.
- Server console logging: `warn` and `error` levels only; no browser console logging.
- Workspace dependency graph must stay acyclic for Turbo: `@repo/observability` must NOT depend on `@repo/shared` (Task 1 moves `SENSITIVE_HEADERS` into observability; shared imports it from there).
- `bun run check-types` must pass; `bun x ultracite fix` on touched files (quote paths with parentheses); commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push/deploy/touch Appwrite settings. Throwaway verification routes are never committed.

## Review Focus

1. **An AI span leaking content**: a `generateObject` call over a receipt or job application must produce a span with model/tokens/duration and nothing from the prompt or result → Task 5 helper tests assert no attribute values contain prompt/result text.
2. **A metric with a user identifier** (order id, email, user id as an attribute) → Task 4 helper rejects unknown attribute keys at type level and drops them at runtime (test).
3. **Turbo cyclic dependency** after packages/shared/api/payment import observability → Task 1 moves `SENSITIVE_HEADERS`; Task 4 runs `bun run check-types` (Turbo fails fast on cycles).
4. **Metric/log calls throwing** inside payment or expense code paths (e.g. called before Sentry init, or with odd values) must never break the business flow → Task 4 tests call helpers with no client and with bad input.
5. **Appwrite span names** must group by route for the real `documents`/`teams`/`memberships` tables and the `documents` bucket → Task 1 tests (carried Ruling R).

---

### Task 1: Carried fixes in the packages

**Files:** `packages/api/appwrite-span-name.ts` (+ its test), `packages/observability/src/scrub.ts` + `scrub.test.ts`, `packages/observability/src/options.ts` + `options.test.ts`, `packages/shared/utils/server-error-logging.ts`, `packages/observability/package.json`, `packages/shared/package.json`

**Interfaces:**
- Produces: `SENSITIVE_HEADERS` exported from `@repo/observability/scrub` (moved; shared re-imports it); browser options gain `tracesSampler`.

- [ ] **Step 1: Failing tests.**
  - Span names (Ruling R): `GET /tablesdb/app/tables/documents/rows/6745a1b2c3d4` → `GET /tablesdb/app/tables/documents/rows/{id}`; `GET /tablesdb/app/tables/teams/rows/r1` → `…/tables/teams/rows/{id}`; `GET /storage/buckets/documents/files/f1/view` → `GET /storage/buckets/documents/files/{id}/view`; `GET /tablesdb/app/tables/documents/rows` unchanged; `GET /teams/abc/memberships/m1` → `GET /teams/{id}/memberships/{id}`; `GET /account` unchanged. Rule: a segment is a collection word only when the segment before it is not one of `tables`, `collections`, `buckets`, `databases`, `tablesdb`; evaluate against the original segments, not already-templated ones.
  - SECRET_PAIR (Ruling T): `oauth_token_secret=abc`, `x_client_secret=abc`, `client-secret=abc`, `refresh_token=abc` → value redacted; `description=abc` unchanged.
  - Browser sampler (Ruling O): `buildBrowserOptions({app:"web",…}).tracesSampler({ parentSampled: true, … })` returns `0.25`; for admin returns `1`; docs `0.25`; `tracesSampleRate` absent when `tracesSampler` is set (check SDK precedence in 11.13.0 types/sources and assert whatever makes the sampler authoritative).
  - `SENSITIVE_HEADERS` importable from `@repo/observability/scrub`; `packages/shared/utils/server-error-logging.test.ts` still passes; `packages/observability/package.json` has no `@repo/shared` dependency.
- [ ] **Step 2: Run** (`cd packages/observability && bun x vitest run`; `cd packages/api && bun x vitest run`) → FAIL.
- [ ] **Step 3: Implement.** Move `SENSITIVE_HEADERS` into `scrub.ts`; `server-error-logging.ts` imports it from `@repo/observability/scrub` (add `@repo/observability: workspace:*` to shared; remove `@repo/shared` from observability). SECRET_PAIR accepts any `[A-Za-z0-9]+([_-][A-Za-z0-9]+)*` key ending in `secret|token|code|state|password|userId` (case-insensitive) — keep `code`/`state` exact-word to avoid matching `postcode=`/`estate=`. Browser `tracesSampler` returns the app's browser rate regardless of `parentSampled`.
- [ ] **Step 4: Run** tests + `bun run check-types` → PASS.
- [ ] **Step 5: Commit** `fix(observability): group Appwrite span names, wider secret pairs, browser sampler`.

---

### Task 2: Relay body cap (carried Ruling S)

**Files:** `apps/web/src/app/api/relay/route.ts`, `apps/admin/src/app/api/relay/route.ts`, tests beside them (web vitest, admin bun:test). Shared logic in `packages/observability/src/relay.ts` (`export const MAX_RELAY_BYTES = 10 * 1024 * 1024`; `export function relayTooLarge(request: Request): boolean` — true when `Content-Length` is missing-or-non-numeric is NOT our call (the SDK already 411s), true only when it parses above the cap).

- [ ] **Step 1: Failing tests:** a POST with `Content-Length: 10485761` → 413 and the SDK handler is not called (mock `@sentry/nextjs/tunnel`); `Content-Length: 2048` → delegated to the SDK `POST`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (route checks `relayTooLarge` first, else delegates). **Step 4: Run** → PASS + check-types.
- [ ] **Step 5: Commit** `fix(web,admin): cap Sentry relay request size`.

---

### Task 3: Server root-span names show routes (not just "GET")

Under Bun the api's `http.server` root spans are named `GET`. The dashboard (Stage 5) needs `GET /api/…` route names.

**Files:** `packages/observability/src/options.ts` (compose a namer into `beforeSendSpan` after `scrubSpan`), `src/span-name.ts` + test.

**Interfaces:** `nameServerSpan(span: StreamedSpanJSON): StreamedSpanJSON` — if the span is an `http.server` root whose name is a bare HTTP method, rename to `<METHOD> <route>` using the first present of these attributes: `http.route`, `next.route`, `url.template`; else leave unchanged. Never use `url.full`/`url.path` (ids).

- [ ] **Step 1: Investigate first** (record in the report): build the api with `bun --bun run build:api:appwrite` and the biso-api DSN + `NEXT_PUBLIC_SENTRY_ENVIRONMENT=development`, run from a copy outside the repo with Bun, hit `/api/health` and one parameterised read-only route, and inspect the root span attributes in Sentry (`get_span_details` / `search_traces`). Confirm which attribute carries the route. If none does, report NEEDS_CONTEXT with the attribute dump instead of guessing.
- [ ] **Step 2: Failing tests** for `nameServerSpan` using the real attribute shape found: bare `GET` + route attr → `GET /api/expenses/[id]`; already-named span unchanged; non-root or non-`http.server` unchanged; no route attr → unchanged.
- [ ] **Step 3: Implement**, wire into server `beforeSendSpan` (`(span) => nameServerSpan(scrubSpan(span))`). **Step 4:** tests + check-types; rebuild + rerun; confirm a named root span in Sentry. **Step 5: Commit** `fix(observability): name server root spans by route`.

---

### Task 4: Logs and metrics

**Files:** `packages/observability/src/options.ts` (+test), new `packages/observability/src/metrics.ts` (+test), call sites: `packages/api/server.ts` (`logAppwriteTiming`), `packages/shared/utils/vipps-order-ops.ts` (`applyOrderStatusTransition`), `packages/shared/utils/push-dispatch.ts` (`sendPush`), `apps/api/src/app/api/expenses/submit/route.ts` (success path of `POST`/`submitExpense`), `apps/api/src/lib/expense-posting.ts` (`recordFailure`), `apps/api/src/app/api/cron/reconcile-orders/route.ts` (after the sweep), plus each touched package's `package.json` (`@repo/observability: workspace:*`).

**Interfaces:**
- `type MetricName` = the nine names in Global Constraints; `type MetricAttributes = Partial<Record<"provider" | "kind" | "app" | "client" | "outcome", string>>`
- `countMetric(name: Exclude<MetricName, "orders.stuck">, attributes?: MetricAttributes): void`
- `gaugeMetric(name: "orders.stuck", value: number, attributes?: MetricAttributes): void`
- Both wrap `metrics.count` / `metrics.gauge` from `@sentry/core` in try/catch, drop any attribute key not in the allow-list at runtime, and never throw.
- `buildServerOptions` adds `integrations: [consoleLoggingIntegration({ levels: ["warn", "error"] })]` (from `@sentry/core`; if it's not exported there, return an `integrations` factory the app configs call — check first) and removes the default Vercel AI integration (filter by integration name — find the exact name in 11.13.0 sources) so Task 5's manual spans are the only AI spans.

- [ ] **Step 1: Failing tests:** helpers with no Sentry client don't throw; unknown attribute keys are dropped (`countMetric("push.sent", { email: "a@b.no" } as never)` → `metrics.count` called with `{}`); bad values (`NaN` gauge) don't throw; server options include the console integration with exactly `["warn","error"]` and exclude the Vercel AI integration. At each call site, a focused test (existing test files where present; otherwise a small new one) that the metric fires on the right branch: PAID transition → `payment.completed` with `provider`; CANCELLED/FAILED → `payment.failed`; push success/failure; expense submit success; `recordFailure` → `expense.booking_failed`; `logAppwriteTiming` slow/timeout → `appwrite.slow_request`/`appwrite.timeout` with `client: kind`; reconcile cron → `orders.stuck` gauge equal to the count of orders it leaves unresolved/still pending (use the route's existing summary numbers; name which one in the report).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Metric calls go after the business action succeeds/fails, never before, never inside a try that changes control flow. **Step 4:** tests + `bun run check-types` (catches a Turbo cycle) → PASS.
- [ ] **Step 5: Commit** `feat(observability): server logs and business metrics`.

---

### Task 5: AI monitoring (manual spans at every call site)

**Files:** new `packages/observability/src/ai.ts` (+test); call sites from `.superpowers/sentry-codebase-facts.md` → "AI call sites" (admin 7, api 5, docs 1, packages/ai 4 — runtime only, not scripts).

**Interfaces:**
- `traceAiCall<T extends { usage?: { inputTokens?: number; outputTokens?: number } }>(meta: { functionId: string; model: string; operation: "generate_object" | "chat" }, run: () => Promise<T>): Promise<T>` — span per Sentry's AI monitoring conventions for a single model call (read `platforms/javascript/guides/nextjs/ai-agent-monitoring.md` with the Sentry MCP `get_doc` first and use its exact `op`, `name` format and `gen_ai.*` attribute keys: operation name, request model, usage input/output tokens, and `gen_ai.function_id` or the doc's equivalent for the feature name). Records tokens from the result's `usage` (ai v7 shape — check `node_modules/ai` types). No prompt/response attributes. Errors propagate unchanged and mark the span errored.
- `traceAiStream(meta, start: (callbacks: { onFinish: (usage) => void; onError: () => void }) => R): R` for `streamText` sites — starts a manual span, ends it from `onFinish`/`onError` (compose with any existing `onFinish` at the call site).
- Feature names (functionId), exact: `admin.job-description`, `admin.event-description`, `admin.recruitment-comparison`, `admin.recruitment-assistant`, `admin.page-editor-chat`, `admin.assistant`, `admin.content-translation`, `docs.ask`, `api.expense-summary`, `api.expense-account`, `api.expense-approver`, `api.receipt-extract`, `api.receipt-classify`, `ai.assistant-content-tool`, `ai.recruitment-email`, `ai.recruitment-screening`, `ai.department-resolver`.

- [ ] **Step 1: Failing tests** for the helpers (with `@sentry/core` `startSpan`/`startSpanManual` mocked AND with a real client-less core): span op/name/attributes per the doc; tokens recorded; a result containing `"ola@biso.no"` and a prompt string never appear in any attribute value; errors propagate; stream span ends once on finish and once on error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement helpers**, then wrap each call site (one commit per app/package is fine). Model id comes from the call site's model object (`model.modelId` or the id string already used there).
- [ ] **Step 4:** observability tests + each touched app/package's tests + `bun run check-types` → PASS.
- [ ] **Step 5: Commit(s)** `feat(observability): trace AI calls without content` (+ per-app `feat(<app>): name AI calls for Sentry`).

---

### Task 6: Admin operations page — Sentry status and test error

**Files:** `apps/admin/src/lib/integration-health.ts` (+ its test), `apps/admin/src/app/(portal)/settings/operations/page.tsx`, `…/_components/operations-health.tsx` (or a new small client component beside it), a server action file beside the page (e.g. `…/operations/_actions/sentry-test.ts`), i18n keys in the admin's existing message namespace for this page (both `no` and `en`; follow whatever the page already uses).

**Interfaces:**
- New `IntegrationCategory` `"observability"`; entry `{ id: "sentry", label: "Sentry", category: "observability", envKeys: ["NEXT_PUBLIC_SENTRY_DSN"], runbook: "/docs/developers/keep-it-running/monitoring-and-health", purpose: <one plain sentence> }`.
- `sendSentryTestError(): Promise<{ ok: true; eventId: string } | { ok: false; reason: "not_configured" | "forbidden" }>` — `"use server"`; only global admins (`isGlobalAdmin()` from `src/lib/authorization.ts`); captures `new Error("Sentry test error from the admin operations page")` via `captureException` from `@sentry/nextjs` (dynamic import inside the action, matching the guarded-load pattern), `await flush(2000)`, returns the event id; `not_configured` when Sentry isn't enabled.
- UI: a "Send test error to Sentry" button (global admins only) that shows the event id or the reason.

- [ ] **Step 1: Failing tests:** integration-health test updated for the new id/category (runbook starts with `/docs/`); action returns `forbidden` for non-global-admins (mock `isGlobalAdmin`), `not_configured` without a client, `{ ok: true, eventId }` with a mocked `captureException`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4:** admin tests (`bun test` on touched files + full suite, noting the known pre-existing `content-translation.test.ts` failure) + check-types → PASS.
- [ ] **Step 5: Commit** `feat(admin): show Sentry status and send a test error`.

---

### Task 7: Stage verification

- [ ] **Step 1:** `bun run check-types` → exit 0; tests for observability, @repo/api, @repo/shared, @repo/payment, @repo/ai, web, admin (known pre-existing failure only), api, docs → pass.
- [ ] **Step 2:** `bun --bun run build:api:appwrite` and `build:admin:appwrite` with their DSNs + `development`; run each from a copy outside the repo with Bun; on api, an UNCOMMITTED throwaway route that does `console.warn("[appwrite] slow request", { request: "GET /x?secret=1", email: "ola@biso.no" })`, `countMetric("push.sent", { app: "api" })` and one `traceAiCall` around a stub returning `{ usage: { inputTokens: 3, outputTokens: 5 } }`; in Sentry (biso-api, development) confirm the log arrives scrubbed (no query, no email), the metric is searchable, the AI span has tokens and no content; on admin, press nothing — call the test-error action through a throwaway route or unit-level only (no sign-in). Delete throwaway routes.
- [ ] **Step 3:** Write a short Stage 2a hand-over in `.superpowers/sentry-stage2a-notes.md` (what's verified, anything for 2b/5).
