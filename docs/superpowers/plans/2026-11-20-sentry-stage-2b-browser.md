# Sentry Stage 2b — Browser (consent, replay, feedback, profiling, privacy page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visitors to biso.no and staff in the admin are asked once whether masked recordings may be made; only those who agree are recorded (25% of their visits plus every visit of theirs that hits an error). Anyone can "Report a problem" from the site and the admin. Browser profiling runs on a share of traced page loads. The privacy page says all of this.

**Architecture:** Consent lives in a first-party cookie on `.biso.no` set by a small server action in each app and read in the browser. A browser-only module in `@repo/observability` lazy-loads the Replay and Feedback integrations on demand (no Replay/Feedback code for people who never use them). One shared consent-bar component in `@repo/ui` takes translated labels and the server action as props.

**Tech Stack:** `@sentry/nextjs` 11.13.0 (replay, feedback, browser profiling), Next 16.3 (App Router, server actions), next-intl via `@repo/i18n`, Radix/Tailwind `@repo/ui`, vitest / bun:test, Playwright MCP + Sentry MCP for verification.

**Spec:** `docs/superpowers/specs/2026-11-17-sentry-design.md` sections 3 (Replay, Feedback, UI profiling), 4 (Consent prompt), 10 (Privacy page). Notes (git-ignored): `.superpowers/sentry-sdk11-facts.md` (Replay/Feedback/profiling API), `.superpowers/sentry-codebase-facts.md` (footer, menus, sidebar, i18n, privacy page, cookies), `.superpowers/sentry-stage1-spike.md` (Bun build/run method), `.superpowers/sentry-rulings-stage2a.md` (carried Ruling AC), `.superpowers/sentry-dsns.md`.

## Global Constraints

- Stage 1/2a constraints hold (Bun only, `@sentry/*` 11.13.0 via `catalog:`, Sentry inert without DSN, never break build/boot/sign-in, no static `@sentry/nextjs` value imports in `instrumentation.ts`, relative import of observability's build helper in next.config).
- **Consent gates ALL replays** (normal-visit share and error-buffer). No answer = no recording. Error reports, tracing, logs, profiling and feedback run for everyone (they store nothing in the browser).
- Cookie: name `biso_replay_consent`, value `v1:granted` or `v1:denied`, `path=/`, 12 months (`maxAge` 31536000 s), `sameSite=lax`, `secure` and `domain=.biso.no` in production only, NOT httpOnly (the browser reads it). Unknown value or other version = no answer.
- Replay (consenting visitors only): `replaysSessionSampleRate` 0.25, `replaysOnErrorSampleRate` 1.0 on web and admin; `maskAllText: true`, `maskAllInputs: true`, `blockAllMedia: true`, `stickySession: false`, no network request/response details. Docs has no replay and no feedback.
- Feedback: no floating button (`autoInject: false`), `showName: false`, `showEmail: false`, `showBranding: false`, `colorScheme: "system"`, screenshot allowed on web, NOT on admin; opened from our own "Report a problem" / "Rapporter et problem" links; tags `{ app }`.
- Browser profiling (web, admin): `browserProfilingIntegration()`, `profileSessionSampleRate` 0.1, `profileLifecycle: "trace"`, and the `Document-Policy: js-profiling` response header on HTML routes.
- Copy is plain, no slogans or self-praise (brand rule); nb and en with key parity (web `locale.test.ts` enforces it). Equal visual weight for "Allow" and "No thanks".
- `bun run check-types` passes; `bun x ultracite fix` on touched files (quote paths with parentheses); commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push/deploy/touch Appwrite settings; verification is read-only (no sign-in, no form submits except the Sentry feedback form with a test message).

## Review Focus

1. **Recording before consent**: a first visit with no cookie must load no Replay code and send no replay envelope; a "No thanks" visitor likewise → Task 3 tests + Task 8 network check.
2. **Withdrawing consent mid-visit** stops a running recording at once (`stop({ flush: false })`) → Task 3 test.
3. **Masking**: a replay must show `***` for text and inputs on a page with personal data (member area) → Task 8 replay check in Sentry.
4. **Consent bar on bots, health checks and the app's web views** must not break rendering or SEO (client-only render, no layout shift that hides content) → Task 4 test + Task 8.
5. **Breadcrumb cost** with huge/cyclic console arguments (carried Ruling AC) → Task 1 perf test.

---

### Task 1: Carried fixes — bounded console breadcrumbs, email in encoded text

**Files:** `packages/observability/src/scrub.ts`, its tests (`scrub.test.ts`, `scrub-console.test.ts`).

- [ ] **Step 1: Failing tests.**
  - `scrubBreadcrumb` on a console breadcrumb whose args include a 40-node cyclic graph with 8 object properties per node finishes in < 50 ms and yields a `message` ≤ 2048 chars; a 300-row array argument → message ≤ 2048 chars ending in `…`.
  - `scrubText("body=Hello+my+name+is+Kari+and+I+need+a+refund+for+my+order+please+contact+kari.nordmann@biso.no")` and `"msg=Message%20from%20the%20student%20about%20the%20refund%20for%20ola.nordmann@biso.no"` → the address redacted; existing email and 200 KB adversarial tests still pass.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Console breadcrumb messages are built from args first normalized with `normalize(arg, 3, 1000)` from `@sentry/core`, then reduced as today, then capped at 2048 chars (`…` suffix). Treat `+`, `%20`, `=`, `&` (and `%2B`) as run boundaries for the EMAIL pattern without reintroducing quadratic behaviour.
- [ ] **Step 4: Run** → PASS + check-types. **Step 5: Commit** `fix(observability): bound console breadcrumbs, find emails in encoded text`.

---

### Task 2: Consent cookie — shared helpers and per-app server actions

**Files:** new `packages/observability/src/consent.ts` (+test, export `./consent`); new `apps/web/src/app/actions/replay-consent.ts`, new `apps/admin/src/lib/actions/replay-consent.ts` (+ tests in each app's runner).

**Interfaces:**
- `REPLAY_CONSENT_COOKIE = "biso_replay_consent"`, `REPLAY_CONSENT_VERSION = "v1"`
- `type ReplayConsent = "granted" | "denied" | "unknown"`
- `parseReplayConsent(cookieHeaderOrDocumentCookie: string | undefined): ReplayConsent`
- `serializeReplayConsent(choice: "granted" | "denied"): string` (→ `v1:granted`)
- `replayConsentCookieOptions(isProduction: boolean)` → `{ path: "/", maxAge: 31536000, sameSite: "lax", secure: isProduction, httpOnly: false, domain: isProduction ? ".biso.no" : undefined }`
- Each app: `"use server"` `setReplayConsent(choice: "granted" | "denied"): Promise<void>` using `cookies().set(REPLAY_CONSENT_COOKIE, serializeReplayConsent(choice), replayConsentCookieOptions(process.env.NODE_ENV === "production"))`. Validate `choice` at runtime (anything else → throw `Error("Invalid consent choice")`).

- [ ] **Step 1: Failing tests:** parse `"a=1; biso_replay_consent=v1:granted; b=2"` → granted; `v1:denied` → denied; `v0:granted`, `granted`, missing, garbage → unknown; options per environment exactly as above; actions reject `"maybe"` and set the cookie with the right options (mock `next/headers`).
- [ ] **Step 2–4:** run → FAIL; implement; run → PASS + check-types. **Step 5: Commit** `feat(observability): replay consent cookie`.

---

### Task 3: Browser replay controller (lazy, consent-gated)

**Files:** new `packages/observability/src/browser/replay.ts` (+test, export `./browser/replay`); `packages/observability/src/options.ts` (add `replaySessions: 0.25`, `replayOnError: 1` to web/admin `SAMPLE_RATES`; browser init keeps both rates 0); `apps/web/src/instrumentation-client.ts`, `apps/admin/src/instrumentation-client.ts` (call the controller with the cookie on load).

**Interfaces:**
- `applyReplayConsent(app: "web" | "admin", consent: ReplayConsent): Promise<void>` — `granted`: if no replay integration yet, set `getClient().getOptions().replaysSessionSampleRate`/`replaysOnErrorSampleRate` to the app's rates, then `const { replayIntegration } = await import("@sentry/nextjs")` and `addIntegration(replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true, stickySession: false, networkDetailAllowUrls: [] }))`; if already added and stopped, start buffering/sampling again consistent with the rates. `denied`/`unknown`: `getReplay()?.stop({ flush: false })` if running; never imports Replay. Never throws (catch + `console.warn` once). No-op without a Sentry client.
- `readConsentFromDocument(): ReplayConsent` (wraps `parseReplayConsent(document.cookie)`).

- [ ] **Step 1: Failing tests** (mock `@sentry/nextjs` dynamic import + client): unknown/denied → the replay module is never imported; granted → imported once, rates set before `addIntegration`, masking options exactly as above; granted twice → one integration; granted then denied → `stop({ flush: false })` called; no client → no-op; import failure → resolves, warns once.
- [ ] **Step 2–4:** run → FAIL; implement + wire into both `instrumentation-client.ts` (after `Sentry.init`, `void applyReplayConsent(app, readConsentFromDocument())`); run → PASS + check-types. **Step 5: Commit** `feat(observability): consent-gated, lazy-loaded session replay`.

---

### Task 4: Consent bar (web + admin) and "Privacy settings"

**Files:** new `packages/ui/components/replay-consent-bar.tsx` (client; + test in packages/ui's runner, or in web if ui has none); i18n: new namespace `replayConsent` in `packages/i18n/messages/{en,no}/replayConsent.json` registered in `messages/en.ts` and `messages/no.ts`; web mount in `apps/web/src/app/providers.tsx` (or the public providers — wherever client providers live for all pages); web footer link "Privacy settings" (client island beside `footer-social.tsx`) in `apps/web/src/components/layout/footer-v2.tsx`; admin mount in the portal layout/shell client tree; admin link in the sidebar footer user block (`apps/admin/src/app/(portal)/sidebar.tsx`) and the command palette account group.

**Interfaces:**
- `ReplayConsentBar({ labels, onChoose, open?, onOpenChange? })` — `labels: { title, body, privacyLink, privacyHref, allow, decline }`; `onChoose(choice)` awaits the app's `setReplayConsent`, then calls `applyReplayConsent(app, choice)` and closes. Shows itself when `readConsentFromDocument() === "unknown"` (checked in `useEffect` after mount so SSR/bots render nothing). Non-modal bar at the bottom, `role="region"` with an `aria-label`, both buttons the same size/variant weight, keyboard reachable, doesn't cover the cookie-less page's main content on phones (respect safe-area; no layout shift of page content).
- `openReplayConsentSettings()` — a tiny client event (e.g. `window.dispatchEvent(new Event("biso:replay-consent:open"))`) the bar listens to; the "Privacy settings" / "Personverninnstillinger" links call it.
- Copy (exact; `replayConsent.json`):
  - en: `title` "Help us find what's broken", `body` "May we record your visits to see where the site breaks or is hard to use? Everything you type or read is hidden, and recordings are deleted after 90 days.", `privacyLink` "Read more in our privacy policy", `allow` "Allow", `decline` "No thanks", `settings` "Privacy settings".
  - no: `title` "Hjelp oss å finne feil", `body` "Kan vi ta opp besøkene dine for å se hvor nettsiden feiler eller er vanskelig å bruke? Alt du skriver eller leser, er skjult, og opptakene slettes etter 90 dager.", `privacyLink` "Les mer i personvernerklæringen", `allow` "Tillat", `decline` "Nei takk", `settings` "Personverninnstillinger".
  - Admin uses the same keys (`privacyHref` points at `https://biso.no/privacy`).

- [ ] **Step 1: Failing tests:** bar renders nothing on the server and when consent is already granted/denied; renders when unknown; "Allow" → `onChoose("granted")` and closes; "No thanks" → `onChoose("denied")`; the open event re-shows it even when a choice exists; both buttons share the same variant/size classes; web `locale.test.ts` passes with the new namespace (parity, registration); footer test still passes with the new link.
- [ ] **Step 2–4:** run → FAIL; implement + mount in both apps; run → PASS + check-types. **Step 5: Commit(s)** `feat(ui): replay consent bar` + `feat(web,admin): ask before recording visits`.

---

### Task 5: "Report a problem" (feedback)

**Files:** new `packages/observability/src/browser/feedback.ts` (+test, export `./browser/feedback`); i18n namespace `reportProblem` (en/no, registered); web: a client "Report a problem" link in the footer island, an item in `apps/web/src/components/nav/account-menu.tsx` (via `ACCOUNT_LINKS` or a sibling action item) and in `mobile-drawer.tsx`; admin: an item in the sidebar footer block and the command palette.

**Interfaces:**
- `openFeedbackForm(app: "web" | "admin", labels: FeedbackLabels): Promise<void>` — lazy `import("@sentry/nextjs")`, add `feedbackIntegration({ autoInject: false, showName: false, showEmail: false, showBranding: false, colorScheme: "system", enableScreenshot: app === "web", tags: { app }, ...labels })` once, then `getFeedback().createForm()` → `appendToDom()` → `open()`; no-op (but resolves) without a client; never throws.
- `FeedbackLabels` = the SDK label keys we set: `formTitle`, `messageLabel`, `messagePlaceholder`, `isRequiredLabel`, `submitButtonLabel`, `cancelButtonLabel`, `addScreenshotButtonLabel`, `removeScreenshotButtonLabel`, `successMessageText`, `errorGenericText`.
- Copy (exact): en — link "Report a problem", formTitle "Report a problem", messageLabel "What went wrong?", messagePlaceholder "Tell us what you did and what happened.", isRequiredLabel "(required)", submitButtonLabel "Send", cancelButtonLabel "Cancel", addScreenshotButtonLabel "Add a screenshot", removeScreenshotButtonLabel "Remove screenshot", successMessageText "Thanks. We got your report.", errorGenericText "Sending failed. Please try again." no — link "Rapporter et problem", formTitle "Rapporter et problem", messageLabel "Hva gikk galt?", messagePlaceholder "Fortell hva du gjorde og hva som skjedde.", isRequiredLabel "(påkrevd)", submitButtonLabel "Send", cancelButtonLabel "Avbryt", addScreenshotButtonLabel "Legg til skjermbilde", removeScreenshotButtonLabel "Fjern skjermbilde", successMessageText "Takk. Vi har fått rapporten din.", errorGenericText "Sendingen mislyktes. Prøv igjen."

- [ ] **Step 1: Failing tests:** integration added once across two opens; options exactly as above (screenshot true for web, false for admin); no client → resolves without import; menu/footer items render and call `openFeedbackForm`; locale parity.
- [ ] **Step 2–4:** run → FAIL; implement + wire; run → PASS + check-types. **Step 5: Commit(s)** `feat(observability): open the feedback form on demand` + `feat(web,admin): report a problem`.

---

### Task 6: Browser UI profiling

**Files:** `apps/web/src/instrumentation-client.ts`, `apps/admin/src/instrumentation-client.ts` (add `Sentry.browserProfilingIntegration()`), `packages/observability/src/options.ts` (`profileSessionSampleRate` 0.1 + `profileLifecycle: "trace"` for web/admin browser options; docs 0), `apps/web/next.config.ts` + `apps/admin/next.config.ts` (`Document-Policy: js-profiling` on `/:path*`; in admin add it to the existing catch-all header rule so the camera-permission rules after it still win for their key — admin `next-config.test.ts` must stay green and should assert the new header).

- [ ] **Step 1: Failing tests:** browser options for web/admin carry `profileSessionSampleRate: 0.1` and `profileLifecycle: "trace"`, docs carries 0/none; web and admin `headers()` include `Document-Policy: js-profiling` for `/:path*`.
- [ ] **Step 2–4:** run → FAIL; implement; run → PASS + check-types. **Step 5: Commit** `feat(web,admin): sample browser profiles`.

---

### Task 7: Privacy page

**Files:** `apps/web/src/app/(public)/privacy/_content/privacy-sections.ts`, `apps/web/src/app/(public)/privacy/page.tsx` (`LAST_UPDATED` → 2026-11-20), `apps/web/src/docs/privacy-compliance.md`.

Add (English, matching the file's existing `**bold**` / `•` style) a new section `error-monitoring` after `website-tracking`, and update `cookies` and `data-storage`:
- What: BISO uses Sentry (Functional Software Inc., data stored in the EU, Frankfurt) to find and fix errors on biso.no, the admin and the BISO app.
- Always collected: error reports, technical and performance data (browser, device type, page addresses without query strings, timings), and your BISO account id if you're signed in. No names, emails or what you type.
- Only with your consent: masked recordings of your visits (all text and inputs hidden, images blocked) — 25% of visits plus visits where an error happens. Withdraw any time under "Privacy settings" at the bottom of the page.
- "Report a problem" sends what you write, and a screenshot only if you add one.
- Kept for at most 90 days. Legal basis: legitimate interest in running a working, secure service (errors, performance); consent (recordings).
- `cookies`: add the `biso_replay_consent` cookie (stores your choice, 12 months, strictly necessary to remember it).
- `data-storage`: add Sentry to the third-party storage list.

- [ ] **Step 1:** failing test (web vitest) asserting `PRIVACY_SECTIONS` has `error-monitoring` and that `cookies` mentions `biso_replay_consent`. **Step 2–4:** FAIL → write → PASS. **Step 5: Commit** `docs(web): explain error monitoring and recordings on the privacy page`.

---

### Task 8: Stage verification (live, read-only)

- [ ] **Step 1:** `bun run check-types`; tests for observability, ui, i18n-touching web suites, web, admin (known pre-existing failure only).
- [ ] **Step 2:** `bun --bun run build:web:appwrite` with the web DSN + `NEXT_PUBLIC_SENTRY_ENVIRONMENT=development`; run from a copy outside the repo with Bun. With the Playwright MCP tools:
  - Fresh context → consent bar visible; network: no request for replay code, no replay envelope to `/api/relay`.
  - "No thanks" → bar gone, cookie `v1:denied`, still no replay traffic after navigating two pages and throwing a test error (setTimeout throw) — the error arrives in Sentry without a replay.
  - "Privacy settings" in the footer reopens the bar → "Allow" → cookie `v1:granted`; throw a test error → an error with a linked replay arrives (`search_replays` / `get_replay_details` in biso-web, development); confirm text is masked (`***`) in the replay's recorded DOM / Sentry's replay details.
  - Footer "Report a problem" → form opens with Norwegian or English labels per locale; submit "Test report from Stage 2b verification" → a feedback issue arrives in biso-web.
  - Check a `Document-Policy: js-profiling` header on `/` and, if Sentry shows profiles for development, note it (Chromium only; absence isn't a failure).
- [ ] **Step 3:** `bun --bun run build:admin:appwrite`; boot from a copy; `/api/health` → 200 (no sign-in, so the portal UI isn't exercised live — covered by tests).
- [ ] **Step 4:** Write `.superpowers/sentry-stage2b-notes.md` (verified items with evidence, anything for Stage 5).
