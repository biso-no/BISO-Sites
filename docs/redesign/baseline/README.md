# Pre-redesign baseline — RD-001

**Captured:** 2026-08-31 · **Commit:** `c82f70d3` · **Next.js** 16.3.0

This is the reference point `RD-033` (Phase 6) compares against. It was taken
**before any visual change**, on a clean production build served the way
production serves it.


> **Closed out 2026-09-02 by RD-033.** The comparison lives in
> `../03-results.md`. Because these figures were captured under `node` with
> every Appwrite read failing (FINDING-C), RD-033 did **not** compare against
> them directly — it rebuilt this commit in a detached worktree, re-measured it
> under `bun`, and compared that. The rebuild reproduces `bundle.md` byte for
> byte. Files added by RD-033: `routes-rd033.tsv`,
> `vitals-baseline-rerun.json`, `vitals-rd033.json`,
> `lcp-paired-rd033.json`, `paired-lcp.js`, `trace-navigation.js`.
> FINDING-D was understated: mobile LCP is bimodal too, so `paired-lcp.js`
> samples n = 7 alternating between the two builds rather than taking a
> median of 3.
>
> `trace-navigation.js <base> <route> <out.json>` captures a filtered Chrome
> trace of one throttled mobile navigation. It is what established that
> `/shop`'s LCP is gated on document delivery rather than CPU — see
> `../03-results.md` §3.2. Grep the output for `largestContentfulPaint`,
> `firstContentfulPaint`, `MarkDOMContent` and `ParseHTML`.

## Files

| File | What it is |
|---|---|
| `bundle.md` | Build output: bundle sizes, largest chunks, route classification |
| `routes.txt` | Every route with HTTP status, bytes and TTFB |
| `vitals.json` | Core Web Vitals, 5 routes × 2 form factors |
| `build-output.txt` | Raw `bun run build --filter=web` output |
| `collect-vitals.js` | The collector, so Phase 6 measures identically |

## Method

No Lighthouse CLI is installed and none was added. Metrics come from Chrome's
own Performance APIs (`largest-contentful-paint`, `layout-shift`, `longtask`,
Navigation and Resource Timing) driven over the DevTools Protocol by
`collect-vitals.js` — **zero new dependencies**.

Served with `node .next/standalone/apps/web/server.js`, not `next start`: the
build sets `output: "standalone"` and `next start` warns it is not compatible.
Both were tried and behave identically, but standalone is what production runs.

**Re-run in Phase 6 exactly as:**

```bash
rm -rf apps/web/.next && bun run build --filter=web
cd apps/web && cp -r .next/static .next/standalone/apps/web/.next/ && cp -r public .next/standalone/apps/web/
set -a && . ./.env.local && set +a
# `bun`, not `node` — see FINDING-C. Under Node 26 every Appwrite read fails
# silently and pages render with no content.
PORT=3000 HOSTNAME=127.0.0.1 bun .next/standalone/apps/web/server.js &
node docs/redesign/baseline/collect-vitals.js "/,/jobs,/events,/news,/shop"
```

Mobile profile: 390×844 @3x, 4× CPU throttle, ~1.6 Mbps down / 750 Kbps up,
150 ms RTT, cache disabled. Desktop: 1440×900, unthrottled, cache disabled.

## Core Web Vitals

### Desktop — 1440×900, unthrottled

| Route | LCP | FCP | TTFB | TBT | CLS | Requests | Transfer | JS | DOM |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 1580 ms | 424 ms | 6 ms | 0 ms | 0 | 48 | 563 KB | 357 KB | 490 |
| `/jobs` | 976 ms | 84 ms | 2 ms | 0 ms | 0 | 47 | 513 KB | 365 KB | 315 |
| `/events` | 952 ms | 204 ms | 2 ms | 0 ms | 0 | 46 | 505 KB | 357 KB | 298 |
| `/news` | 140 ms | 72 ms | 2 ms | 0 ms | 0 | 43 | 495 KB | 356 KB | 325 |
| `/shop` | 76 ms | 76 ms | 2 ms | 0 ms | 0.02 | 46 | 497 KB | 357 KB | 318 |

### Mobile — 390×844 @3x, 4× CPU, ~1.6 Mbps, 150 ms RTT

| Route | LCP | FCP | TTFB | TBT | CLS | Long tasks | Transfer | JS | DOM |
|---|---|---|---|---|---|---|---|---|---|
| `/` | **5392 ms** | 1460 ms | 2 ms | 36 ms | 0 | 2 | 506 KB | 357 KB | 489 |
| `/jobs` | **4368 ms** | 1452 ms | 2 ms | 3 ms | 0 | 1 | 508 KB | 364 KB | 314 |
| `/events` | **4308 ms** | 1448 ms | 2 ms | 4 ms | 0 | 1 | 500 KB | 357 KB | 297 |
| `/news` | **4240 ms** | 1488 ms | 2 ms | 6 ms | 0 | 1 | 484 KB | 356 KB | 324 |
| `/shop` | 1484 ms | 1484 ms | 2 ms | 16 ms | 0 | 1 | 489 KB | 357 KB | 318 |

### What the numbers say

- **Four of five routes are in the "poor" LCP band on mobile** (> 4 s). Only
  `/shop` passes.
- **TTFB is 2 ms.** The server is not the problem — the Partial Prerender shell
  is served instantly.
- **JS is ~357 KB on every single route**, varying by under 3% between the
  homepage and a content page. Per-route code splitting is barely happening;
  the shared client bundle dominates. This is the measured consequence of 108
  of 139 components being client components.
- **CLS and TBT are already good.** They are not where the wins are — and the
  redesign must not regress them.
- The improvement target is therefore **JS payload**, not server time.

### FINDING-F · Cookie-setting cannot be verified on a production build at localhost

Added 2026-08-31 during RD-015. `prefCookieOptions()` emits `Secure`,
`SameSite=None` and `Domain=.biso.no` when `NODE_ENV === "production"`. A
standalone production build served from `http://localhost:3000` therefore has
**every preference cookie silently rejected by the browser** — campus and locale
selection appear to do nothing, and the state looks broken when it is not.

Verify anything cookie-dependent against `bun run dev`, where the same helper
emits `SameSite=Lax` with no `Secure` and no domain.

### FINDING-E · Grepping HTML for translated strings gives false positives

`NextIntlClientProvider` serialises the **entire message bundle** into the page
so client components can read it. A string therefore appears in the HTML whether
or not anything renders it — a check for "is the new footer showing?" matched
its tagline even with the feature flag off and the old footer in the DOM.

Verify rendered content by inspecting the DOM, not by grepping the response.

### FINDING-D · Desktop LCP is bimodal; take a median of 3

Added 2026-08-31 during RD-006. Three consecutive unthrottled desktop runs of
`/news` returned **952 ms, 148 ms, 156 ms**. A single desktop sample is not
comparable between builds and will manufacture phantom regressions — the
baseline's own 140 ms for `/news` is the fast mode of the same distribution.

Mobile is stable: the same three runs gave 4240 / 4240 / 4228 ms.

**RD-033 must take the median of at least 3 desktop runs per route.** Mobile
single samples are fine.

Also note `collect-vitals.js` reports `fontKB: 0`: fonts arrive via the `Link:
rel=preload` header, so their Resource Timing `initiatorType` is `link` and they
are counted in `cssKB`. `transferKB` is unaffected. Compare font payload from
the preload headers directly, as RD-006 did, rather than from this field.

## Findings recorded during capture

### FINDING-A · Redirects and auth gates return 200, not 308/401

`x-nextjs-postponed: 1` and `x-nextjs-prerender: 1` appear on every page
response. With `cacheComponents: true` + `partialPrefetching: true`, Next serves
the prerendered shell with a **200** and streams the dynamic part afterwards.
Any `redirect()` or `unauthorized()` reached inside that dynamic part therefore
cannot set the HTTP status — headers are already flushed. The redirect happens
client-side, after hydration.

Measured:

| Route | Intended | Actual |
|---|---|---|
| `/varsling` | 308 → `/safety` | **200** + client-side redirect |
| `/shop/membership` | 308 → `/membership/join` | **200** + client-side redirect |
| `/profile`, `/applications`, `/fs`, `/fs/new` | 401 (`unauthorized()`) | **200**, correct UI rendered |

Both redirects exist *specifically* to preserve external inbound links — their
source comments say so. A crawler that does not execute JS sees a 200 with
shell content, so no link equity passes to the target. The auth cases render
the right UI, so users are unaffected; only the status code is wrong.

This predates the redesign and is **not** caused by it. It is recorded here so
Phase 6 does not misread it as a regression. Worth a decision separately —
route-handler redirects or middleware would restore true 308s.

### FINDING-B · Museo Sans is preloaded on every page

The `Link:` response header on every route includes:

```
</_next/static/media/museo_sans_300-s.p.2sqgq4qvw1gxa.otf>; rel=preload; as="font"; type="font/otf"
```

Header-level confirmation of `00-current-state.md` §4: a 62 KB unsubsetted
`.otf` is **preloaded** on every page and rendered zero times. `RD-006` removes
it.

### FINDING-C · `/api/health/ready` returns 503 — **resolved 2026-08-31 (RD-014)**

Not a deployment problem. **Every Appwrite read fails when the standalone server
is run under Node 26**, with:

```
TypeError: fetch failed
  [cause]: Error [InvalidArgumentError]: invalid onError method  (UND_ERR_INVALID_ARG)
```

an incompatibility between Node 26's undici and the Appwrite SDK's fetch usage.
`/api/pages/events` returned `[]`, `/shop` showed zero products, and the
readiness probe reported 503 — all the same root cause.

**Running the same build under `bun` fixes it entirely:** zero fetch errors,
real rows returned, and `/api/health/ready` reports
`{"status":"ready","latencyMs":114}`.

```bash
# wrong — data reads silently fail, pages render with empty content
node .next/standalone/apps/web/server.js
# right
bun .next/standalone/apps/web/server.js
```

**This invalidates the data-dependent half of every earlier verification in this
project.** Route sweeps, screenshots and vitals captured under `node` exercised
the shell and static content only; anything data-driven rendered empty. Route
resolution, bundle sizes, landmark structure, contrast and typography are
unaffected — none of them depend on backend reads.

**RD-033 must re-measure under `bun`**, and the RD-001 vitals in `vitals.json`
should be treated as a lower bound: they were captured with no content to
render.

## Correction to `00-current-state.md`

Phase 0 §1.1 reported "the build emits **47 prerendered entries**", read from a
stale `.next/prerender-manifest.json`. The build's own classification is the
authority and it says otherwise: **65 routes are `ƒ` Dynamic (server-rendered
on demand)**, 11 are partial-prerender shells, and **only 2 are static**
(`/robots.txt`, `/sitemap.xml`).

The manifest lists PPR shells, which are not statically served pages. Phase 0's
prose hedged correctly ("the prerendered entries are shells, not cached
content") but the headline number was misleading. `00-current-state.md` has
been corrected.
