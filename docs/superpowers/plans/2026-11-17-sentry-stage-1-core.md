# Sentry Stage 1 — Core (errors, tracing, releases) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every unhandled error and a trace of every server request in web, admin, api and docs reach Sentry, scrubbed of personal data, tagged with app, release and (when signed in) the Appwrite user id — and the whole thing is proven to work on the Bun runtime the Sites use.

**Architecture:** A new workspace package `@repo/observability` owns all privacy rules (scrubbers), sample rates and option builders; each Next app keeps only the thin files Next requires (`instrumentation-client.ts`, `sentry.server.config.ts`, `instrumentation.ts`, `global-error.tsx`, `withSentryConfig` in `next.config`). Sentry is inert when `NEXT_PUBLIC_SENTRY_DSN` is unset.

**Tech Stack:** `@sentry/nextjs` 11.13.0, `@sentry/bun` 11.13.0 (optional peer the Next SDK uses on Bun), `@sentry/core` 11.13.0 (types + `setUser`/`startSpan` from shared code), Next 16.3, Bun 1.4, vitest / bun:test.

**Spec:** `docs/superpowers/specs/2026-11-17-sentry-design.md` (sections 1–3, 7). Reference notes for implementers (git-ignored, in this worktree): `.superpowers/sentry-sdk11-facts.md` (verified SDK 11 API — read before writing any Sentry code), `.superpowers/sentry-codebase-facts.md` (paths and line numbers), `.superpowers/sentry-dsns.md` (project DSNs).

## Global Constraints

- Bun only. Pin `"@sentry/nextjs": "11.13.0"`, `"@sentry/bun": "11.13.0"`, `"@sentry/core": "11.13.0"` (exact, no caret) in the root `package.json` `catalog`; reference them as `"catalog:"`.
- Sentry org `bi-student-organisation`; projects `biso-web`, `biso-admin`, `biso-api`, `biso-docs`. Never set `sentryUrl` (org tokens carry the EU region).
- One env var per Site for the DSN: `NEXT_PUBLIC_SENTRY_DSN` (browser and server). Optional `NEXT_PUBLIC_SENTRY_ENVIRONMENT` overrides the environment; default `production` when `NODE_ENV === "production"`, else `development`. Build-only: `SENTRY_AUTH_TOKEN` (pass-through), `SENTRY_RELEASE`, `APPWRITE_VCS_COMMIT_HASH`.
- No DSN ⇒ `enabled: false` and no network calls. Missing `SENTRY_AUTH_TOKEN` ⇒ build still passes (no upload). A failed source map upload ⇒ warning, never a failed build.
- Server traces 100% on all four apps; browser traces web 0.25, admin 1.0, docs 0.25 (spec section 3). Replay/feedback/profiling/logs/metrics/AI are Stage 2 — do not add them here.
- `NEXT_PUBLIC_*` values must be referenced literally as `process.env.NEXT_PUBLIC_SENTRY_DSN` in app files (Next only inlines literal member expressions); option builders take values as arguments.
- Browser `tracePropagationTargets` must never match `appwrite.biso.no` (CORS).
- Sentry's wrapper is outermost: `withSentryConfig(withNextIntl(baseConfig), …)`.
- Don't remove existing behaviour: `register()` start-up checks, `logServerRequestError` stdout logging, admin security headers (admin `src/next-config.test.ts` must still pass), web `cacheComponents`.
- `bun run check-types` must pass; run `bun x ultracite fix` on touched files before each commit. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push, deploy, or change Appwrite settings. Sending test events to the `development` environment of the BISO projects is allowed.

## Review Focus

1. **A secret in a URL query** (magic-link `secret`/`userId`, OAuth `code`/`state`, Vipps/Stripe callback params) must not reach Sentry in an error's `request.url`, a breadcrumb, or a span attribute → Task 1 `scrubUrl` tests + Task 2 `scrubSpan` test.
2. **An 11-digit account number or fødselsnummer inside an exception message** (e.g. a Finago error echoing a payout account) must be redacted, while a 13-digit timestamp and an Appwrite id must survive → Task 1 `scrubText` tests.
3. **A visitor with an ad blocker** must still be able to send browser errors (tunnel through the Site) → Task 4 runtime verification step.
4. **Sites without the new env vars** (owner deploys before adding them) must boot and serve normally → Task 2 `enabled:false` test + Task 4 "no DSN" boot check.
5. **Bun runtime**: the standalone server started with Bun must load the Sentry server SDK (the `bun` export condition needs `@sentry/bun` in `.next/standalone/node_modules`) → Task 4 spike step.

---

### Task 1: `@repo/observability` package with scrubbers

**Files:**
- Create: `packages/observability/package.json`, `packages/observability/tsconfig.json`, `packages/observability/src/scrub.ts`, `packages/observability/src/scrub.test.ts`
- Modify: root `package.json` (catalog), `packages/shared/utils/server-error-logging.ts` (export `SENSITIVE_HEADERS`)

**Interfaces:**
- Produces (`@repo/observability/scrub`):
  - `REDACTED = "[redacted]"`
  - `scrubText(text: string): string`
  - `scrubUrl(url: string): string`
  - `redactHeaders(headers: Record<string, string | string[] | undefined> | undefined): Record<string, string | string[] | undefined>`
  - `scrubEvent<T extends ErrorEvent>(event: T): T`
  - `scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb`
  - `scrubLog(log: Log): Log`
  - `scrubSpan(span: StreamedSpanJSON): StreamedSpanJSON`
  - `scrubMetric(metric: Metric): Metric`
  (types from `@sentry/core`)

Package shape follows `packages/payment`: no `type` field, `exports` map to raw `.ts` (`"./scrub": "./src/scrub.ts"`, later `"./options"`, `"./build"`, `"./user"`), scripts `check-types: tsc --noEmit`, `lint: biome lint .`, `test: vitest run`; deps `@sentry/core: catalog:`, `@repo/shared: workspace:*`; devDeps `@repo/typescript-config`, `typescript`, `vitest` (catalog). tsconfig extends `@repo/typescript-config/react-library.json`.

- [ ] **Step 1: Write failing tests** in `scrub.test.ts` (vitest), at least:
  - `scrubText("Konto 1234.56.78903 avvist")` → `"Konto [redacted] avvist"`; also `"12345678903"` and `"1234 56 78903"` → `[redacted]`.
  - `scrubText("fnr 01019912345")` and `"010199 12345"` → redacted.
  - `scrubText("mail ola.nordmann+x@student.bi.no feilet")` → `"mail [redacted] feilet"`.
  - Survivors: `"ts 1794913200123"` (13 digits) unchanged; Appwrite id `"6745a1b2c3d4e5f6a7b8"` unchanged; `"order 42"` unchanged.
  - `scrubUrl("https://biso.no/auth/verify?secret=abc&userId=u1#x")` → `"https://biso.no/auth/verify"`; `scrubUrl("/api/payment/return?orderId=1&code=z")` → `"/api/payment/return"`; `scrubUrl("https://biso.no/u/ola@biso.no")` → `"https://biso.no/u/[redacted]"`.
  - `redactHeaders({ Cookie: "a", Authorization: "b", "x-appwrite-key": "c", accept: "d" })` keeps `accept`, redacts the rest (case-insensitive).
  - `scrubEvent`: input with `request: { url: "…?secret=s", cookies: {a:"1"}, data: "{}", query_string: "secret=s", headers: { cookie: "x" } }`, `user: { id: "u1", email: "a@b.no", ip_address: "1.2.3.4", username: "ola" }`, `message: "fnr 01019912345"`, `exception.values[0].value: "acct 1234.56.78903"`, `breadcrumbs: [{ message: "a@b.no", data: { url: "/x?code=1" } }]` → url has no query, `cookies`/`data`/`query_string` deleted, header redacted, `user` is exactly `{ id: "u1" }`, message/exception/breadcrumb scrubbed.
  - `scrubLog`: `{ message: "M365 Sync Failed: ola@biso.no", attributes: { url: "/a?x=1", n: 3 } }` → message and string attributes scrubbed, `url` query stripped, number untouched.
  - `scrubSpan`: `{ name: "GET /api/payment/return?code=z", attributes: { "url.full": "https://api.biso.no/x?secret=1", "http.query": "secret=1", "db.x": "ola@biso.no" } }` → name and `url.full` without query, `http.query`/`url.query` removed, string attrs scrubbed. (Check the real `StreamedSpanJSON` attribute shape in `@sentry/core` types — attributes may be `{ type, value }` objects; scrub the string `value`.)
  - `scrubMetric`: string attribute values scrubbed.

- [ ] **Step 2: Run** `cd packages/observability && bun x vitest run` → FAIL (module missing).

- [ ] **Step 3: Implement `src/scrub.ts`.** Patterns as top-level regex literals: account number `\b\d{4}[ .]?\d{2}[ .]?\d{5}\b`, fødselsnummer `\b\d{6} ?\d{5}\b`, email `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`. `scrubUrl` drops `?…` and `#…` (works on absolute and relative strings; no `new URL` requirement), then `scrubText` on the rest. `redactHeaders` imports the now-exported `SENSITIVE_HEADERS` from `@repo/shared/utils/server-error-logging` (export it there; its existing test must still pass). Hooks never throw: wrap each in try/catch and on error return the input with `message`/`exception` replaced by `REDACTED` rather than leaking.

- [ ] **Step 4: Run** tests → PASS. `bun run check-types --filter=@repo/observability --filter=@repo/shared` → PASS.

- [ ] **Step 5: Commit** `feat(observability): add Sentry privacy scrubbers package`.

---

### Task 2: Option builders, release resolver, user helper

**Files:**
- Create: `packages/observability/src/options.ts`, `src/options.test.ts`, `src/build.ts`, `src/build.test.ts`, `src/user.ts`
- Modify: `packages/observability/package.json` (exports `./options`, `./build`, `./user`)

**Interfaces:**
- Consumes: Task 1 scrubbers.
- Produces:
  - `type SentryApp = "web" | "admin" | "api" | "docs"`
  - `SAMPLE_RATES: Record<SentryApp, { serverTraces: number; browserTraces: number }>` = web `{1, 0.25}`, admin `{1, 1}`, api `{1, 0}`, docs `{1, 0.25}`
  - `DATA_COLLECTION` (the most restrictive `DataCollection` from `.superpowers/sentry-sdk11-facts.md` → Privacy, verbatim)
  - `IGNORE_ERRORS: (string | RegExp)[]` (ResizeObserver loop limit exceeded / completed with undelivered notifications; `AbortError`; "The operation was aborted"; "The user aborted a request")
  - `DENY_URLS: RegExp[]` (`chrome-extension://`, `moz-extension://`, `safari-extension://`, `safari-web-extension://`)
  - `TRACE_PROPAGATION_TARGETS: (string | RegExp)[]` = relative URLs (`/^\/(?!\/)/`), `/^https:\/\/(www\.)?biso\.no(\/|$)/`, `/^https:\/\/(admin|api|docs)\.biso\.no(\/|$)/`
  - `resolveEnvironment(explicit: string | undefined, nodeEnv: string | undefined): string`
  - `interface OptionInput { app: SentryApp; dsn: string | undefined; environment: string }`
  - `buildServerOptions(input: OptionInput)` → object with `dsn`, `enabled`, `environment`, `tracesSampleRate`, `dataCollection`, `ignoreErrors`, `beforeSend`, `beforeBreadcrumb`, `beforeSendLog`, `beforeSendSpan`, `beforeSendMetric`, `initialScope: { tags: { app } }`
  - `buildBrowserOptions(input: OptionInput)` → the same plus `denyUrls`, `tracePropagationTargets`, browser `tracesSampleRate`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`
  - (`@repo/observability/build`) `readGitSha(): string | undefined`; `resolveRelease(app: SentryApp, env?: Record<string, string | undefined>, gitSha?: () => string | undefined): string | undefined`; `sentryBuildOptions(app: SentryApp)` → withSentryConfig options
  - (`@repo/observability/user`) `setSentryUser(id: string | null | undefined): void` (uses `setUser` from `@sentry/core`; `{ id }` or `null`)

- [ ] **Step 1: Failing tests** (`options.test.ts`, `build.test.ts`):
  - `buildServerOptions({ app:"web", dsn: undefined, environment:"development" }).enabled === false`; with `dsn: "  "` also false; with a DSN `enabled === true` and `dsn` trimmed.
  - `tracesSampleRate` per app matches `SAMPLE_RATES` (server 1 for all; browser web 0.25, admin 1, docs 0.25).
  - `buildBrowserOptions` → `replaysSessionSampleRate === 0 && replaysOnErrorSampleRate === 0`; `dataCollection` deep-equals `DATA_COLLECTION`; `beforeSend` is `scrubEvent`.
  - `TRACE_PROPAGATION_TARGETS` matches `"/api/x"`, `"https://biso.no/x"`, `"https://api.biso.no/api/x"`, and does NOT match `"https://appwrite.biso.no/v1/account"`, `"https://evil.biso.no.example.com"`, `"//cdn.example.com/x"`.
  - `resolveEnvironment(undefined, "production") === "production"`, `(undefined, "development") === "development"`, `("staging", "production") === "staging"`, `("  ", "production") === "production"`.
  - `resolveRelease("web", { SENTRY_RELEASE: "custom-1" }) === "custom-1"`; `resolveRelease("api", { APPWRITE_VCS_COMMIT_HASH: "abcdef1234567890ff" }) === "biso-api@abcdef123456"`; with empty env and `gitSha = () => "0123456789abcdef"` → `"biso-docs@0123456789ab"`; with nothing → `undefined`.
  - `sentryBuildOptions("admin")` → `org === "bi-student-organisation"`, `project === "biso-admin"`, `authToken === process.env.SENTRY_AUTH_TOKEN`, `release.name === resolveRelease("admin")`, `sourcemaps.deleteSourcemapsAfterUpload === true`, `widenClientFileUpload === true`, `telemetry === false`, `typeof errorHandler === "function"` and calling it does not throw.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** `readGitSha` uses `execFileSync("git", ["rev-parse", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] })` in try/catch. `sentryBuildOptions` sets `silent: true` unless `process.env.SENTRY_DEBUG_BUILD` is set, `errorHandler` logs one `console.warn("[sentry] source map upload failed", err.message)` and returns. Release prefix is `biso-<app>@` + first 12 chars of the SHA. Types: use `@sentry/core` `Options`/`DataCollection` where they fit; if a field isn't in core's types (e.g. browser-only), type the builder return as `Record<string, unknown>` spread into `Sentry.init` — prefer real types when they compile.

- [ ] **Step 4: Run** tests + `bun run check-types --filter=@repo/observability` → PASS.

- [ ] **Step 5: Commit** `feat(observability): add Sentry option builders and release resolver`.

---

### Task 3: Root wiring (catalog, turbo env)

**Files:**
- Modify: root `package.json` catalog (add `@sentry/nextjs`, `@sentry/bun`, `@sentry/core` at `11.13.0` if Task 1 didn't already), `turbo.json`

- [ ] **Step 1:** In `turbo.json` `tasks.build.env` add `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `APPWRITE_VCS_COMMIT_HASH` (keep the list's ordering style); add `"passThroughEnv": ["SENTRY_AUTH_TOKEN", "SENTRY_DEBUG_BUILD"]` to `tasks.build`.
- [ ] **Step 2: Verify** `bun install` succeeds and `bun x turbo run build --filter=@repo/observability --dry=json | grep -c SENTRY` shows the vars in the build task's env config (or inspect `--dry` output).
- [ ] **Step 3: Commit** `chore: declare Sentry build env in turbo`.

(Fold into Task 2's commit if the diff is tiny.)

---

### Task 4: web — integrate and prove it on Bun (the spike)

**Files:**
- Create: `apps/web/src/instrumentation-client.ts`, `apps/web/src/sentry.server.config.ts`
- Modify: `apps/web/package.json` (deps `@sentry/nextjs`, `@sentry/bun`, `@repo/observability`), `apps/web/next.config.ts`, `apps/web/src/instrumentation.ts`, `apps/web/src/instrumentation.test.ts`, `apps/web/src/app/global-error.tsx`, `apps/web/src/components/layout/analytics-identity.tsx`, `apps/web/src/lib/actions/user.ts`
- Create (git-ignored notes): `.superpowers/sentry-stage1-spike.md`

**Interfaces:**
- Consumes: `buildBrowserOptions`, `buildServerOptions`, `resolveEnvironment`, `sentryBuildOptions`, `setSentryUser`.
- Produces: the per-app file pattern Tasks 5–7 copy.

- [ ] **Step 1: Failing test** in `instrumentation.test.ts`: `onRequestError` still calls `logServerRequestError` with `app: "web"` AND calls `Sentry.captureRequestError` with the same `(error, request, context)` (mock `@sentry/nextjs`). Existing register() tests keep passing; add: `register()` with `NEXT_RUNTIME="nodejs"` and valid cookie env imports the server config (mock the module) without throwing when `NEXT_PUBLIC_SENTRY_DSN` is unset.
- [ ] **Step 2: Run** `cd apps/web && bun x vitest run src/instrumentation.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
  - `sentry.server.config.ts`: `Sentry.init({ ...buildServerOptions({ app: "web", dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, environment: resolveEnvironment(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT, process.env.NODE_ENV) }), integrations: [Sentry.serveTunnelIntegration()] })`.
  - `instrumentation-client.ts`: `Sentry.init({ ...buildBrowserOptions({...same literals, app: "web"}), tunnel: true })`; `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;`.
  - `instrumentation.ts`: keep the existing checks; after them, `if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config")` (register becomes `async`); `onRequestError` calls `logServerRequestError(...)` then `Sentry.captureRequestError(error, request, context)`.
  - `next.config.ts`: remove `productionBrowserSourceMaps: false` (the SDK enables maps for upload and deletes them afterwards); `export default withSentryConfig(withNextIntl(baseConfig), sentryBuildOptions("web"))` with `withSentryConfig` from `@sentry/nextjs/config`.
  - `global-error.tsx`: `Sentry.captureException(error)` in the existing `useEffect` (keep the `console.error`).
  - User id: in `_getLoggedInUser` (src/lib/actions/user.ts) after the user resolves, `setSentryUser(user.$id)`; in `AnalyticsIdentity`'s effect, `setSentryUser(accountId ?? null)` (it already runs on identity change, so sign-out clears it).
- [ ] **Step 4: Run** web tests + `bun run check-types --filter=web` → PASS.
- [ ] **Step 5: Spike — build and run like Appwrite (Bun).** From the worktree root, with the web DSN from `.superpowers/sentry-dsns.md`:
  ```bash
  NEXT_PUBLIC_SENTRY_DSN=<web dsn> NEXT_PUBLIC_SENTRY_ENVIRONMENT=development \
    bun --bun run build:web:appwrite
  ls .next/standalone/node_modules/@sentry   # expect nextjs AND bun
  cd .next/standalone && PORT=3999 NEXT_PUBLIC_SENTRY_DSN=<web dsn> NEXT_PUBLIC_SENTRY_ENVIRONMENT=development \
    bun --env-file=../../apps/web/.env.local server.js
  ```
  If `@sentry/bun` (or the `@sentry/nextjs` bun entry) is missing from the standalone output, add `outputFileTracingIncludes: { "/*": ["../../node_modules/@sentry/bun/**", …] }` (paths relative to `apps/web`) and rebuild. Then trigger, using an UNCOMMITTED throwaway route `apps/web/src/app/api/__sentry-spike/route.ts` (GET throws `new Error("sentry-spike-server")`, and does a `fetch("https://biso.no/api/health")` before throwing) built into this one run:
  - server error: `curl -s localhost:3999/api/__sentry-spike`
  - browser error + tunnel: open `http://localhost:3999/` with the Playwright MCP tools, run `setTimeout(() => { throw new Error("sentry-spike-browser") })` via evaluate; confirm the network request goes to the Site's own tunnel path, not `*.sentry.io`.
  - no-DSN boot: restart without `NEXT_PUBLIC_SENTRY_DSN`; `/` and `/api/health` answer 200 and no request leaves for Sentry.
  Check with the Sentry MCP (`search_issues` / `search_traces`, org `bi-student-organisation`, region `https://de.sentry.io`, project `biso-web`, environment `development`): server issue with `app:web` tag and readable (if unminified-or-sourcemapped) frames; browser issue; a request span for the spike route; a child `fetch` span; whether Appwrite calls on `/` show as `http.client` spans. Write results (works / missing / workaround) to `.superpowers/sentry-stage1-spike.md`. Repeat the build+run with plain `bun run build:web:appwrite` + `node server.js` only if the Bun run fails, to tell SDK problems from Bun problems.
- [ ] **Step 6:** Delete the throwaway route; `git status` shows it gone. Commit `feat(web): report errors and traces to Sentry` (do not commit `.next` or the spike route).

---

### Task 5: admin

**Files:** same pattern as Task 4 under `apps/admin/src/` (no Stage 1 user-menu work), plus `apps/admin/src/app/(portal)/_components/admin-shell.tsx` (client `setSentryUser(user.id)`), `apps/admin/src/lib/authorization.ts` (server `setSentryUser(ctx.userId)` inside `getUserAuthContext` once resolved), `apps/admin/src/instrumentation.ts` (keep env/cookie checks), `apps/admin/src/app/global-error.tsx`.

- [ ] **Step 1: Failing test** (bun:test, beside existing ones): `src/instrumentation.test.ts` asserting `onRequestError` calls both `logServerRequestError({app:"admin",…})` and `captureRequestError` (use `mock.module`). Keep `src/next-config.test.ts` green — it imports the wrapped config and calls `headers()`.
- [ ] **Step 2: Run** `cd apps/admin && bun test src/instrumentation.test.ts src/next-config.test.ts` → new test FAILS, next-config passes.
- [ ] **Step 3: Implement** like Task 4 with `app: "admin"`, `tunnel: true`, `sentryBuildOptions("admin")`.
- [ ] **Step 4: Run** admin tests + `bun run check-types --filter=admin` → PASS; `bun --bun run build:admin:appwrite` with the admin DSN succeeds and the standalone has `@sentry/bun` (apply Task 4's `outputFileTracingIncludes` fix if it was needed).
- [ ] **Step 5: Commit** `feat(admin): report errors and traces to Sentry`.

---

### Task 6: api (server only)

**Files:** `apps/api/package.json`, `apps/api/next.config.ts` (`withSentryConfig(baseConfig, sentryBuildOptions("api"))`), `apps/api/src/sentry.server.config.ts`, `apps/api/src/instrumentation.ts` (add `register()` that imports the server config on nodejs), `apps/api/src/lib/auth.ts` (`createAuthenticatedClient`: `setSentryUser(userIdFromJwt(jwt) ?? null)` — tagging only, the JWT is verified later by Appwrite), test `apps/api/src/instrumentation.test.ts` (vitest).

No `instrumentation-client.ts`, no tunnel, no global-error (no pages). Keep `serverExternalPackages` and `outputFileTracingIncludes` intact (merge any Sentry includes into the existing object).

- [ ] **Step 1: Failing test:** `onRequestError` calls both loggers; `register()` imports the server config only when `NEXT_RUNTIME === "nodejs"`.
- [ ] **Step 2: Run** `cd apps/api && NODE_ENV=test bun x vitest run src/instrumentation.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** api tests, `bun run check-types --filter=api`, `bun --bun run build:api:appwrite` → PASS, standalone contains `@sentry/bun`; start it with Bun + api DSN + `development` and `curl localhost:3999/api/health` → 200, a transaction for `/api/health` appears in `biso-api`.
- [ ] **Step 5: Commit** `feat(api): report errors and traces to Sentry`.

---

### Task 7: docs

**Files:** `apps/docs/package.json`, `apps/docs/next.config.mjs` (`withSentryConfig(withMDX(config), sentryBuildOptions("docs"))` — if importing the TS package from `.mjs` fails, rename to `next.config.ts` and keep the content), `apps/docs/instrumentation-client.ts` (`app: "docs"`, no tunnel), `apps/docs/sentry.server.config.ts`, `apps/docs/instrumentation.ts`, new `apps/docs/app/global-error.tsx` (client component: `Sentry.captureException` in `useEffect`; plain `<html><body>` with "Something went wrong" + a "Try again" button calling `reset`, styled minimally with existing Tailwind classes), test `apps/docs/instrumentation.test.ts` (bun:test).

- [ ] **Step 1: Failing test** as in Task 6.
- [ ] **Step 2: Run** `cd apps/docs && bun test instrumentation.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** docs tests, `bun run check-types --filter=docs`, `bun --bun run build:docs:appwrite` → PASS.
- [ ] **Step 5: Commit** `feat(docs): report errors and traces to Sentry`.

---

### Task 8: Appwrite spans fallback (only if the spike says so)

Do this task only if `.superpowers/sentry-stage1-spike.md` records that Appwrite calls do **not** show as `http.client` spans under Bun. Otherwise mark it skipped in the spike notes.

**Files:** `packages/api/server.ts`, `packages/api/package.json` (dep `@sentry/core: catalog:`), test beside existing `packages/api` tests (vitest).

**Interfaces:** in `configureServerClient`, `client.call` and `client.redirect` run inside `startSpan({ op: "http.client", name: describeAppwriteRequest(method, url), attributes: { "appwrite.client": kind } }, …)` from `@sentry/core`. Span names carry no query string (`describeAppwriteRequest` already returns `METHOD /path`).

- [ ] **Step 1: Failing test:** with `@sentry/core` `startSpan` mocked, one patched `call` produces exactly one `startSpan` call with `op: "http.client"` and the `METHOD /path` name, and the original result/exception passes through unchanged (including the 504 timeout conversion).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS + `bun run check-types --filter=@repo/api`.
- [ ] **Step 5: Commit** `feat(api-client): trace Appwrite calls as Sentry spans`.

---

### Task 9: Stage verification

- [ ] **Step 1:** `bun run check-types` (whole repo) → PASS. `bun run test --filter=web --filter=admin --filter=api --filter=docs --filter=@repo/observability --filter=@repo/shared --filter=@repo/api` → PASS (note any failure that also fails on `main` as pre-existing, with evidence).
- [ ] **Step 2:** `bun x ultracite check` on changed files → clean.
- [ ] **Step 3:** In Sentry (MCP), each of `biso-web`, `biso-admin`, `biso-api`, `biso-docs` shows at least one `development` event or transaction from the stage's runs, and no event in any project contains a cookie, an `Authorization` header, an email address or a query string (spot-check two events per project with `get_issue_details`/`get_trace_details`).
- [ ] **Step 4:** Append to `.superpowers/sentry-stage1-spike.md` a "Stage 1 hand-over" list: what works on Bun, workarounds applied, anything Stage 2 must handle (AI spans under Bun, tunnel), and pre-existing test failures.
