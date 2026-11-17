# Sentry across the BISO platform — design

Date: 2026-11-17. Owner: BISO IT. Status: draft for owner review (builder check done, owner answers folded in).
Branches: BISO-Sites `feat/sentry` (worktree `.claude/worktrees/sentry`);
BISO-Flutter gets its own branch when its stage starts.

## Why

BISO got Sentry's non-profit plan ("Sentry for Good"). Today the owner learns
that something is broken when a student or staff member sends a Teams message
or an email, or when they happen to read the Appwrite logs. The developer docs
say it plainly (`apps/docs/content/docs/developers/keep-it-running/monitoring-and-health.mdx`,
"What isn't monitored"): errors, scheduled jobs, the functions, Appwrite
failing behind a running app, and stuck payments all fail silently.

The goal is that **Sentry tells the owner before anyone has to send a
message**, and that the next person in the IT role can find what's wrong
without the owner. The owner wants to use as much of Sentry as fits.

## Goals

1. Every unhandled error in web, admin, api, docs, the three Appwrite
   functions and the Flutter app reaches Sentry with a readable stack trace,
   the release it came from, and (for signed-in users) the Appwrite user id.
2. The silent failures get a watcher: scheduled jobs (cron monitors), the
   functions, Appwrite slowness and timeouts, payments failing or stuck.
3. Alerts reach the owner by email from day one; a Teams channel when they add
   Sentry's Teams integration.
4. One "BISO platform health" dashboard plus Sentry's built-in ones.
5. Students and staff can report a problem from the site, the admin and the
   app; the report lands in Sentry linked to their replay and any error.
6. Performance is visible: slow pages, slow server routes, slow Appwrite calls,
   app start and frozen frames, AI call cost and latency.
7. The developer docs say where to look, so the setup survives a handover.

## Non-goals

- Replacing Better Stack now. It keeps running until the owner trusts Sentry's
  uptime checks (owner decision).
- Replacing Umami (visitor analytics) or the admin's operations page.
- Monitoring the Webdock server itself (disk, memory, CPU) or the nightly
  backup. Sentry has no agent for that; it stays on the "not monitored" list.
- Monitoring the self-hosted Appwrite server's own internals.
- A staging environment.
- Server-side profiling. The Sites run on Bun, and Sentry's Node profiler
  needs V8 (see Approaches → extra features).

## Anti-goals (would make this a failure even if it "works")

- **Student data leaking into Sentry.** Bank account numbers, national ID
  numbers (fødselsnummer), receipts, job applications, emails, names, session
  cookies or Appwrite keys stored in a third-party tool.
- **Alert fatigue.** An inbox full of noise the owner learns to ignore is worse
  than today.
- **Slowing the site down or loading the shared Appwrite worker pool**
  noticeably. web, admin, api and docs run on the same self-hosted server as
  Appwrite.
- **Breaking a build or a sign-in.** Sentry must stay inert when its env vars
  are missing (local dev, tests, a Site where the owner hasn't added them yet).
- A setup only the owner understands.

## Owner decisions (2026-11-17)

- **Scope:** the whole platform, including the Flutter app (BISO-Flutter repo)
  and the three Appwrite functions.
- **Session replay, option 2:** record sessions that hit an error, plus a
  share of normal sessions. Everything masked: all text and inputs show as
  `***`, media blocked. Users are identified by Appwrite user id only, never
  name or email. The privacy page explains it.
- **Consent prompt:** replays need the visitor's consent (section 4 has the
  design; what it gates is Claude's call).
- **Plan (from the owner's screenshot of the Sponsored Business plan):** per
  month 5M errors, 1B spans, 100K replays, 5 TB logs, 5 TB application
  metrics, 10 GB attachments, 500 cron monitors, 25 uptime monitors, 3K
  continuous profile hours, 150 UI profile hours, 1K size-analysis builds,
  5 Seer users. Pay-as-you-go limit $0, so over-quota data is dropped, never
  billed. Seer starts using Seer credits from 2026-12-08.
- **Runtime:** "We use Bun 1.4" (see Assumptions).
- **Alerts:** email to the owner from day one; Teams via Sentry's integration
  when the owner installs it.
- **Uptime:** Sentry uptime checks on the health endpoints; Better Stack stays.
- **Dashboard:** one custom platform-health dashboard.
- **Go ahead** with the extra features below unless they strike them at review.

## Approaches considered

### Sentry project layout
- **One project per app (chosen):** `biso-web`, `biso-admin`, `biso-api`,
  `biso-docs`, `biso-functions`, `biso-app`. Issue ids show the source
  (`BISO-WEB-12`), releases and alerts stay per app, and each project gets the
  right platform defaults.
- One project with an `app` tag: fewer things to manage, but releases, release
  health and alert rules tangle across six deploy units.
- The existing empty `appwrite` and `react-native` projects and the 2024 alert
  rules are left alone (no issues in the last 90 days). The owner can delete
  them.

### Code structure
- **One shared package for options and privacy rules, thin per-app files
  (chosen).** A new workspace package (working name `@repo/observability`)
  owns sample rates, scrubbing, `beforeSend*` hooks, ignore lists and helpers
  (`setSentryUser`, metric helpers). Each Next app keeps the small files Next
  requires.
- Sentry's wizard per app: four copies of the privacy rules that drift apart.

### How the Sentry account gets configured
- **Directly, with the Sentry tools in this session, plus a checked-in script
  for what those tools can't do (chosen).** Projects, uptime monitors and alert
  rules are created through the Sentry plugin; the dashboard (the plugin can't
  create dashboards) through Sentry's API from a JSON definition in the repo,
  so it can be re-created. Org settings the API/plugin can't reach go on the
  owner's go-live list.
- Terraform: reproducible, but one more tool for the next person, for one org.

### Extra features (Claude's calls, owner may strike)
Included: user feedback ("Report a problem"), logs, AI monitoring without
prompt/answer content, a few business counters (metrics), releases + GitHub
suspect commits, app vitals (app start, frozen frames, ANR), server-side data
scrubbing, spike protection. After seeing the plan: **browser UI profiling** on
web and admin and **app profiling** where sentry_flutter supports it (150 UI
profile hours are included), and **size analysis** of the Android and iOS
builds uploaded from the release workflow (1K builds included).
Skipped: server profiling (V8-only, the Sites run on Bun), Seer (a setting,
not code; the owner turns it on and watches the credit change on 2026-12-08),
snapshot testing (iOS-native only).

## Constraints and facts the builder must respect

- Bun only; pin `@sentry/nextjs` and `@sentry/bun` in the root `catalog` and
  reference them as `catalog:`. Latest seen 2026-11-17: `@sentry/nextjs`
  11.13.0 (peer `next ^16`), `@sentry/bun` 11.13.0, `sentry_flutter` 10.4.0,
  `sentry_dart_plugin` 3.5.0. `ai` is 7.0.148; the Vercel AI integration
  supports `ai >=3 <=7`.
- Next 16.3, App Router, React 19.2. **web has `cacheComponents: true`** — the
  web production build must still pass with Sentry's server instrumentation;
  check early, it's the most likely breakage.
- Next 16 builds with Turbopack by default; source map upload must work for
  that build path.
- All four apps build with `output: "standalone"` via
  `build:<app>:appwrite`, deployed by hand from the Appwrite console from the
  latest commit on `main`. No CI deploy, no staging.
- **Turbo `build` env allow-list:** every new build-time var goes in
  `turbo.json`. Secrets that don't change output (`SENTRY_AUTH_TOKEN`) should be
  pass-through, not cache inputs.
- **The repo is public.** No tokens in git. DSNs aren't secret but are still
  read from env (so an unset env disables Sentry).
- Server-only vars never reach a Client Component; the browser gets only
  `NEXT_PUBLIC_*`.
- Each app already has `instrumentation.ts` with `register()` (start-up checks)
  and `onRequestError` calling `logServerRequestError`. Keep both; add Sentry
  next to them. `apps/docs/instrumentation.ts` sits at the app root, not in
  `src/`. web and admin have `global-error.tsx`; docs doesn't.
- `packages/shared/utils/server-error-logging.ts` already redacts sensitive
  headers (`SENSITIVE_HEADERS`). Reuse that list.
- `packages/api/server.ts` logs `[appwrite] slow request` (≥2 s) and
  `[appwrite] request timed out` (8 s). Those become Sentry logs/metrics.
- **Runtime:** the owner runs Bun 1.4 (local `bun --version` is 1.4.0; root
  `packageManager` still says `bun@1.3.1`). Read as: the Sites serve the
  standalone build with Bun 1.4. `@sentry/nextjs` targets Node: error capture
  through `onRequestError` works anywhere, but its automatic server tracing
  relies on Node hooks and Node's `fetch`, which Bun may not honour. **Stage 1
  starts with a spike** that runs the web standalone build under Bun 1.4 with a
  development DSN and records what arrives (errors with mapped stack traces,
  request spans, outbound fetch spans, logs). If spans are missing, the
  fallback is spans added by hand where it matters: the Appwrite timing wrapper
  in `packages/api/server.ts`, the payment and AI call sites.
- Functions: `appwrite.config.json` records `scheduled-dispatch` on `bun-1.0`
  (schedule `*/5 * * * *`); the other two on an unrecorded Bun. `@sentry/bun`
  11 needs Bun ≥1.3.14 (see section 5 for why the functions don't use it).
- `scheduled-dispatch` installs with
  `bun install` and has no build step (no workspace imports);
  `content-notifier` and `member-roster-sync` ship a `bun build` bundle.
  Functions are short-lived: flush Sentry before returning.
- `scheduled-dispatch` pings up to ~11 secret-gated endpoints (see its README
  and `src/main.ts`), logging `OK`/`FAIL` per target. `member-roster-sync` runs
  nightly (`0 3 * * *` suggested in README; actual schedule is in the console).
  `content-notifier` is pinged by the dispatcher every 5 minutes.
- **Browser calls to `appwrite.biso.no` must not get `sentry-trace`/`baggage`
  headers** (CORS preflight would fail). `tracePropagationTargets` lists only
  BISO's own app origins and relative URLs. Server-side calls may propagate.
- No cookie-consent banner exists on the web (Umami is cookieless). See Open
  question 1.
- The privacy page is code: `apps/web/src/app/(public)/privacy/_content/privacy-sections.ts`
  plus `packages/i18n/messages/{no,en}/privacy.json`; also
  `apps/web/src/docs/privacy-compliance.md`.
- Docs rule: pages whose `covers:` match changed code must be updated
  (`monitoring-and-health.mdx` covers the instrumentation files and
  `server-error-logging.ts`; `deploying.mdx` covers workflows). Flutter has the
  same rule in its CLAUDE.md.
- Sentry org: `bi-student-organisation`, EU region (`https://de.sentry.io`),
  one team `bi-student-organisation`.
- Never push, open PRs, deploy, or change Appwrite settings. Creating things in
  the Sentry org (projects, monitors, alerts, dashboard) and sending test
  events from local dev to the `development` environment **is** in scope (the
  owner asked for the account setup).

## Design

### 1. Sentry org

- **Projects:** the six above, team `bi-student-organisation`. Platforms:
  `javascript-nextjs` ×4, `bun`, `flutter`.
- **Environments:** `production` (deployed), `development` (local, only when a
  developer sets a DSN locally). Without a DSN the SDK doesn't initialize.
- **Server-side scrubbing (second layer), owner go-live if the API can't:**
  default scrubbers on, "prevent storing IP addresses" on, advanced scrubbing
  rules for Norwegian account numbers (`\d{4}[ .]?\d{2}[ .]?\d{5}`),
  fødselsnummer (11 digits), and email addresses on all projects.
- **Spike protection** on; inbound filters on (browser extensions, legacy
  browsers, web crawlers, localhost for production).
- **Uptime monitors** (25 included; one exists already: "BISO API",
  `https://api.biso.no/api/health` every 10 min, in the old `appwrite` project
  — left alone, the owner may delete it once the new ones run):
  `https://biso.no/api/health`,
  `https://admin.biso.no/api/health`, `https://api.biso.no/api/health` every
  1–5 min, plus `https://api.biso.no/api/health/ready` every 5 min (catches
  Appwrite down behind a running app; costs one Appwrite request per check).
  docs.biso.no once it's live.
- **Integrations the owner installs:** GitHub (suspect commits, code mappings,
  "Fixes" resolution, both repos) and Microsoft Teams. Seer if the plan has it.

### 2. Shared package (`@repo/observability`, name is the builder's call)

Exports, at least:
- Option builders per runtime (browser, Node server, edge if any) taking the
  app name, returning DSN, environment, release, sample rates, integrations and
  hooks. Returns "disabled" when no DSN.
- **Privacy hooks** used by every runtime: `beforeSend`,
  `beforeSendTransaction`, `beforeSendLog`, `beforeBreadcrumb`:
  - `sendDefaultPii: false` and the restrictive equivalent of SDK 11's
    `dataCollection` (no cookies, headers, bodies, query strings, IPs, frame
    locals).
  - Redact `SENSITIVE_HEADERS` (reuse from `server-error-logging.ts`).
  - Strip URL query strings and known secret params (magic-link `secret`,
    `userId`, OAuth `code`/`state`, Vipps/Stripe callback params) from URLs in
    events, spans and breadcrumbs.
  - Replace account-number, fødselsnummer and email patterns in messages,
    exception values, log bodies and breadcrumb messages with `[redacted]`.
  - User context is `{ id }` only (Appwrite `$id`).
- **Ignore list:** benign browser noise (ResizeObserver loop, aborted fetches
  on navigation, extension frames); Next control-flow errors are already
  filtered by the SDK.
- Helpers: `setSentryUser(id | null)`, typed metric helpers (below).
- Unit tests for every scrubber and URL cleaner (this is the anti-goal guard).

### 3. Next apps

Each app gets `instrumentation-client.ts`, server (and edge if used) config,
`withSentryConfig` in `next.config`, `Sentry.captureRequestError` in
`onRequestError` beside `logServerRequestError`, and a `global-error.tsx` that
reports (add to docs). Source maps: hidden, uploaded at build when
`SENTRY_AUTH_TOKEN` is present, deleted from the output after upload, never
served. **Tunnel route** on web and admin so ad blockers don't drop reports
and feedback (Claude's call; costs one small Site request per envelope).

Starting sample rates (all in the shared package, tunable in one place):

| App | Errors | Server traces | Browser traces | Replay (consenting visitors only) | UI profiling | Feedback |
|---|---|---|---|---|---|---|
| web | 100% | 100% | 25% | 25% of sessions, 100% on error | 10% of traced | footer + account menu |
| admin | 100% | 100% | 100% | 25% of sessions, 100% on error | 10% of traced | user menu |
| api | 100% | 100% | — | — | — | — |
| docs | 100% | 100% | 25% | — | — | — |

The plan has room for far more spans than BISO produces, so server traces are
100%. Browser traces on web and docs stay lower because every browser envelope
goes through the tunnel route, which is a request on the shared Site.

- **Replay:** `maskAllText`, `maskAllInputs`, `blockAllMedia` on; network
  request/response details off; `stickySession: false` (Replay keeps nothing in
  browser storage). The replay integration is **lazy-loaded only after
  consent** (section 4), so visitors who decline don't download it.
- **UI profiling:** browser profiling in Chromium needs a
  `Document-Policy: js-profiling` response header on HTML pages; add it in
  `next.config` headers for web and admin.
- **Feedback:** Sentry's feedback integration with no auto-injected floating
  button; opened from a "Report a problem" / "Rapporter et problem" link
  (labels in `@repo/i18n`, nb + en). Name/email fields hidden (the user id is
  attached when signed in). Screenshot attachment allowed on web (the user's
  own screen, by their choice) — builder: off in admin, where screens show
  other people's data.
- **Logs:** `enableLogs`; console integration for `warn` and `error` only;
  `Sentry.logger` for the existing tagged lines (`[appwrite] slow request`,
  `[request-error]`, `M365 Sync Failed`, push failures, AI screening failures,
  payment credential fallback). All pass through `beforeSendLog` scrubbing.
- **AI monitoring:** Vercel AI integration on admin, api, docs (and web if it
  calls `ai`) with `recordInputs: false`, `recordOutputs: false`. Each call is
  named by feature (assistant, page-editor AI, translation, receipt scan,
  expense booking, recruitment screening, docs ask) via the AI SDK's telemetry
  `functionId`.
- **Tracing:** default Next/HTTP instrumentation; Appwrite calls show as
  outbound HTTP spans. Propagate traces web → api and app → api.
- **User id:** set on the server scope where the session user is resolved, and
  in the browser after sign-in; cleared on sign-out.
- **Metrics (starting set):** `payment.completed` / `payment.failed`
  (attributes: provider, kind), `orders.stuck` (gauge from the reconcile job:
  orders still pending past the reconcile window), `push.sent` /
  `push.failed`, `expense.submitted` / `expense.booking_failed`,
  `appwrite.slow_request` / `appwrite.timeout`. No user data in attributes.
- **Admin operations page:** shows whether the Sentry DSNs are set, and gives
  global admins a "Send test error to Sentry" button for go-live and handover
  checks (Claude's call).

### 4. Consent prompt (web, admin, app)

Owner decision: ask before recording. Claude's calls:

- **What it gates:** session replay only, both the share of normal visits and
  the recording around an error. Someone who says no is never recorded. Error
  reports, tracing, logs and "Report a problem" run for everyone: they store
  nothing in the browser and are covered by the privacy page.
- **No answer = no.** Nothing is recorded until the visitor accepts.
- **Web and admin:** one shared component (in `@repo/ui` or the new package),
  a small bar at the bottom of the page, not a modal, shown once, in the page's
  language. "Allow" and "No thanks" look equally prominent. Rendered
  client-side only, so crawlers and the uptime checks never see it.

  ```
  ┌────────────────────────────────────────────────────────────────────┐
  │ Help us make biso.no better                                        │
  │ May we record your visit to see where things break or confuse?     │
  │ Everything you type or read is hidden. Read more (privacy)         │
  │                                     [ No thanks ]   [ Allow ]      │
  └────────────────────────────────────────────────────────────────────┘
  ```
- **Stored choice:** a first-party cookie on `.biso.no` (shared by web and
  admin), value `granted`/`denied` plus a text version, 12 months. Storing a
  consent choice needs no consent. Bumping the version asks again.
- **Change your mind:** a "Privacy settings" / "Personverninnstillinger" link
  in the web footer and admin user menu reopens the prompt; withdrawing stops
  a running replay at once.
- **App:** a one-time bottom sheet after onboarding (not during it), same text
  and buttons, and a switch in Profile. The choice is stored with the app's
  other preferences. Replay starts only when it's on.
- Copy in nb and en lives in `@repo/i18n` (app: its ARB files). Follow the
  brand-copy rules: plain, no slogans, no self-praise.

### 5. Appwrite functions

- **No Sentry SDK in the functions (Claude's call).** The repo records
  `scheduled-dispatch` on `bun-1.0`, below what `@sentry/bun` 11 needs, and the
  dispatcher drives every scheduled job: an SDK that fails to load there stops
  all of them. Instead, a small dependency-free reporter (one file, plain
  `fetch`) that sends cron check-ins over Sentry's HTTP check-in API and errors
  as envelopes to project `biso-functions`, tag `function`. It works on any Bun
  version, needs no build step, and carries the same scrubbing rules (a copy
  of the scrubbers with a test that keeps it in sync with the shared package).
- Wrap the handler: report errors, await the sends (with a short timeout)
  before returning. A Sentry outage must never fail a function run.
- **Cron monitors (upserted from code, not created by hand):**
  - `scheduled-dispatch` itself (its console schedule; timeout 330 s).
  - One monitor per dispatch target (`announcements-dispatch`,
    `orders-reconcile`, `tickster-sync`, …), check-in `ok`/`error` from the
    HTTP result the dispatcher already records. A target that keeps failing
    raises its own issue.
  - `member-roster-sync` (its nightly schedule, ≥600 s runtime).
  - Failure threshold 2 consecutive (noise guard), recovery 1.

### 6. Flutter app (BISO-Flutter)

- `sentry_flutter`; init in `main()` around the existing startup. DSN as an app
  constant (DSNs are public; the binary ships it anyway) with a
  `--dart-define` override. Off in debug builds unless a DSN is defined.
- `AppLogger.error`/`critical` → `Sentry.captureException`; lower levels as
  breadcrumbs; Sentry logs on. The placeholders in
  `lib/core/logging/logging_config.dart` become the real init.
- `SentryNavigatorObserver` on GoRouter (screen loads, TTID/TTFD).
- The app's own `http` calls to `api.biso.no` through `SentryHttpClient`
  (traces continue into the api). Appwrite SDK calls stay untouched.
- Replay only after consent (section 4): sessions 25%, on error 100%;
  defaults mask text, inputs and images.
  **Also mask** the member pass (QR is custom-painted), the scanner camera
  preview, and any web view. `attachScreenshot` off (not masked).
  View hierarchy only if it carries no text values.
- "Report a problem" in Profile using Sentry's feedback widget, nb + en.
- Release health (crash-free sessions/users per version) on; release is
  `biso@<version>+<build>` from the pubspec. App start, slow/frozen frames,
  Android ANR on (defaults).
- `release.yml`: build with `--split-debug-info` (no `--obfuscate`) and upload
  debug symbols, Android mappings and iOS dSYMs with `sentry_dart_plugin`
  using a `SENTRY_AUTH_TOKEN` repo secret. Skip the upload step when the secret
  is missing so CI keeps working.
- App profiling at a low rate on the platforms sentry_flutter supports.
- Size analysis: upload the Android AAB and the iOS build from `release.yml`
  (skipped without the token).
- Firebase background isolate: out of scope.

### 7. Releases

- Release name per app: `<project-slug>@<git sha>` for the Next apps and
  functions; the pubspec version for the app.
- At Appwrite build time the commit SHA must come from somewhere: try
  `SENTRY_RELEASE`, then Appwrite's VCS build variables (verify the exact name
  on a real build), then `git rev-parse HEAD`, then the package version.
  Whatever is chosen, the browser bundle and the server must report the same
  release as the uploaded source maps.
- Commits associated when the GitHub integration exists.

### 8. Alerts (email to the owner; Teams action added when installed)

1. New high/medium-priority issue in production, any project (once per issue,
   30-minute action interval).
2. Regression: a resolved issue comes back.
3. Error spike per project (anomaly detection if available, otherwise a
   threshold such as >50 errors in 10 min — builder tunes).
4. Payments failing: `payment.failed` ≥3 in 15 min.
5. Stuck payments: `orders.stuck` > 0 for 1 h.
6. App crash-free session rate < 99% for the latest release.
7. Cron monitor failed or missed; uptime check down (these open issues; make
   sure an alert covers their categories).
8. New user feedback.
Anything else lives on the dashboard, not in the inbox.

### 9. Dashboard "BISO platform health"

Errors per project (24 h), new issues, web vitals p75 (LCP, INP) on web,
slowest server routes p95 (web, api), Appwrite outbound p95 and timeouts,
payments completed vs failed, pushes sent vs failed, expense booking
failures, app crash-free sessions per release, AI calls/cost by feature, user
feedback count. Defined as JSON in the repo (e.g. `scripts/sentry/`), created
through Sentry's API with an owner-provided token, or built by hand from the
JSON if the API needs scopes the owner doesn't want to grant.

### 10. Privacy page and docs

- Privacy page (nb + en): Sentry (EU region) is used to find and fix errors;
  what is recorded for everyone (errors, technical and performance data, the
  user's id if signed in), what is recorded only with consent (masked session
  recordings), what never is (typed text, names, emails), how to change the
  choice, retention (the org's setting; Business plans default to 90 days,
  check before writing it).
- Developer docs: rewrite `monitoring-and-health.mdx` around Sentry (where to
  look, the alerts, the dashboard, the "isn't monitored" list shrinks);
  `deploying.mdx` and `secrets-and-environment` get the new env vars and the
  source map token; `when-things-break` starts from Sentry. Flutter docs per
  its CLAUDE.md rule.

### 11. Go-live (owner, written as a checklist at the end)

Create an org auth token; add `SENTRY_AUTH_TOKEN` to each Site's build env and
the BISO-Flutter repo secrets; add the DSN vars to each Site and function;
install GitHub and Teams integrations; apply org scrubbing settings the API
couldn't; turn on Seer if wanted (credits from 2026-12-08); delete the old "BISO API"
uptime check once the new ones run; move `scheduled-dispatch` off `bun-1.0`
if the console still shows it (not required by this design);
update the App Store privacy labels and Google Play data-safety form for
crash, performance and diagnostic data; deploy; press "Send test error";
confirm in Sentry; watch quota use after two weeks and tune the rates.

## Suggested stages

1. Bun-runtime spike, then Sentry projects + shared package (with scrubber
   tests) + errors, tracing, source maps and releases in web, admin, api, docs.
2. Consent prompt, replay, UI profiling, feedback, logs, AI monitoring,
   metrics, operations-page check, privacy page.
3. Functions + cron monitors.
4. Flutter app (BISO-Flutter).
5. Uptime monitors, alerts, dashboard, developer docs, go-live checklist.

## Branch base

`feat/sentry` starts from `main` (ed9faf05). Open branches that touch the same
files (#118 `simplify/all`: `packages/api/server.ts`, payment routes,
`reconcile.ts`; #119 expense AI; `feat/expense-agent`) merge on their own
schedule. Metric and AI-naming call sites stay one-line additions so whichever
lands second resolves cheaply (Claude's call).

## Left to the builder

Package name and file layout; exact ignore list; tunnel route path (must not
collide with routes or the i18n proxy matcher); how the release SHA is found
on Appwrite; which call sites emit each metric; whether the dashboard goes in
by API or by hand; how `scheduled-dispatch` gets the shared privacy code
without a build step; Flutter widgets to mask beyond the defaults; exact alert
thresholds.

## Assumptions to confirm

- "We use Bun 1.4" means the four Sites serve the app with Bun 1.4. If a Site
  actually runs Node, server tracing simply works better; nothing else
  changes.
