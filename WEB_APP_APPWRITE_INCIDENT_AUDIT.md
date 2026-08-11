# apps/web → Appwrite worker-exhaustion incident audit

**Date:** 2026-08-11
**Scope:** read-only audit. No source, config, or dependency was modified.
**Central question:** why does `apps/web` present → Appwrite exhausts Swoole workers within ~20s,
while `apps/web` deleted → Appwrite stays healthy indefinitely?

---

## 1. Executive summary

This is **not** a resource-exhaustion problem. It is a **re-entrant thread-pool deadlock**.

Appwrite serves a Site request over its custom domain as a **synchronous execution** — the Appwrite
API container holds one Swoole HTTP worker for the *entire* duration of the Next.js SSR render.
During that render, `apps/web` turns around and makes **~18 HTTP calls back to
`https://appwrite.biso.no/v1`**, each of which must acquire **another worker from the same pool**.

```
Browser → Traefik → Appwrite API  [worker #1 HELD for whole SSR]
                        └→ OpenRuntimes → Next.js SSR (apps/web)
                                              └→ https://appwrite.biso.no/v1  ×18
                                                    → Traefik → Appwrite API  [workers #2..#9 concurrently]
```

With `_APP_WORKER_PER_CORE=6` (Appwrite default) on 8 vCPU, the API container has roughly **48 HTTP
workers**. Each in-flight page render occupies **~9 of them** (1 held for the synchronous Site
execution + up to ~8 concurrent callbacks from the `Promise.all` fan-outs).

**≈48 / 9 ≈ 5–6 concurrent page renders is enough to consume the entire pool.**

Past that point every remaining worker is a Site execution *blocked waiting* on an Appwrite call
that can never be dispatched, because no worker is free to serve it. That is a textbook deadlock,
and it produces exactly the reported signature:

| Observed | Explained by |
|---|---|
| `swoole_dispatch: Risky branch: did not find a idle worker` | all 48 workers held, none idle |
| `Synchronous function execution timed out` | Site execution hits the 15s/30s sync cap while blocked |
| Load average ~0.4, 8.6 GiB free, zero swap | nothing is *computing*; everything is blocked on I/O |
| Container reports healthy | the process is alive and accepting; it just can't dispatch |
| Console, API, Sites **all** unreachable | they share one worker pool |
| ~20s after start | ~6 concurrent renders is trivially reached by crawlers + prefetches |
| Deleting the Site → instant, permanent recovery | removes both the worker-holding executions **and** the 18× callback amplification |
| admin/api Sites unaffected | see §4 — they make 1–2 Appwrite calls per request and are auth-gated |

The Next 16.3 upgrade did **not** cause this. It landed 2026-08-10 (`af1678f2`), one day before the
audit, while degradation had been building for weeks. It did, however, **remove the last brake**
(see F-7) and is a strong aggravating factor.

---

## 2. Incident evidence

**Confirmed from official Appwrite documentation** (`/docs/products/functions/execute`,
`/docs/advanced/self-hosting/environment-variables`):

> "Synchronous executions are those where Appwrite makes the request to the function runtime
> synchronously and **waits for the response**."
> Synchronous executions are created by: "Requests to custom or auto-generated **domains**"
> Synchronous executions "Have a **30-second hard timeout limit**"

> Sites: "The default timeout is set at `15 seconds` and the maximum value possible is `30 seconds`."

> `_APP_WORKER_PER_CORE` — "Internal Worker per core for the **API**, Realtime and Executor
> containers… **The default value is 6.**"

Two consequences follow directly, and they are the whole incident:

1. **A Site page view holds an Appwrite API worker for the full SSR duration.** Sites are not
   served by a separate pool.
2. **Every server-side Appwrite SDK call from that Site re-enters the same pool** — because
   `NEXT_PUBLIC_APPWRITE_ENDPOINT` is the *public* hostname `https://appwrite.biso.no/v1`, so the
   call goes back out through Traefik into the same API container.

The isolation result you already have (delete Site → `no_idle_worker=0`, `sync_timeouts=0`, stable
30+ min) is consistent with this and inconsistent with a host-resource explanation.

---

## 3. `apps/web` Appwrite call map — anonymous homepage render

This is the core evidence. Traced from `app/layout.tsx` down. "anon" = **no cookies**, which is
every crawler, uptime monitor, link unfurler, and first-time visitor.

| # | Call site | Appwrite request | Anon result |
|---|---|---|---|
| 1 | `app/layout.tsx` → `getLocale()` | `account.get()` | **401 — wasted** |
| 2 | `i18n/request.ts` → `getLocale()` (via `getMessages()`) | `account.get()` | **401 — wasted** |
| 3 | `(public)/layout.tsx` → `getMembershipStatus()` | — | short-circuits ✅ |
| 4 | `(public)/layout.tsx` → `getLoggedInUser()` | — | short-circuits ✅ |
| 5 | `actions/nav.ts` → `getNavFeatured()` → `getLocale()` | `account.get()` | **401 — wasted** |
| 6 | `getNavFeatured()` → `getFeaturedEvent()` | `listRows events` limit 6 + relations | data |
| 7 | `getNavFeatured()` → `getFeaturedProject()` | `listRows large_events` limit 1 | data |
| 8 | `getNavFeatured()` → `getFeaturedNews()` | `listRows news` limit 1 + relations | data |
| 9 | `(public)/page.tsx` → `getUserPreferences()` | `account.getPrefs()` | **401 — wasted** |
| 10 | `(public)/page.tsx` → `getPartners()` | `listRows partners` | data |
| 11 | `(public)/page.tsx` → `getLocale()` | `account.get()` | **401 — wasted** |
| 12 | `(public)/page.tsx` → `listEvents()` | `listRows events` **limit 1000** + relations | data |
| 13 | `(public)/page.tsx` → `listJobs()` | `listRows jobs` limit **200** (clamped) + relations | data |
| 14 | `(public)/page.tsx` → `getCampuses()` | `listRows campus` limit 500 + `departments.*` | data |
| 15 | `(public)/page.tsx` → `listNews()` | `listRows news` limit 3 + relations | data |
| 16 | `components/home/hero-section.tsx` → `getLocale()` | `account.get()` | **401 — wasted** |
| 17 | `hero-section.tsx` → `listEvents()` | `listRows events` + relations | data |
| 18 | `hero-section.tsx` → `listNews()` | `listRows news` + relations | data |

**≈18 Appwrite HTTP requests per anonymous homepage view. 6 of them are guaranteed-to-fail 401s.**
Peak simultaneous in-flight (the `Promise.all` groups in layout / page / hero overlapping under
Suspense): **~8**.

None of these are deduplicated. React request memoization and the Next data cache only apply to
`fetch()`; these are `node-appwrite` SDK calls, so `getLocale()` genuinely executes 5 separate
round-trips per render.

---

## 4. Why admin and api don't do this (the control group)

This is the causal difference the audit was asked to isolate.

| | `apps/web` | `apps/admin` | `apps/api` |
|---|---|---|---|
| Appwrite calls per request | **~18** | **1** (`getLoggedInUser()` in `(protected)/layout.tsx`) | 1–2 |
| Reachable by anonymous crawlers | **Yes, entirely** | No — `unauthorized()` bounces before fan-out | No — JWT required |
| Layout-level data fetching | 3 actions, one of which fans out to 4 more | none | n/a |
| Unbounded row limits | `limit: 1000` ×2 on `/` | no | no |
| Catch-all route hitting the DB | **Yes** (`(public)/[...slug]`) | no | no |

`apps/admin` holds a worker for its Site execution too — but it needs **one** callback, not eighteen,
and bot traffic is rejected before any fan-out happens. Its worker-hold ratio is ~1:1 instead of
~1:9. That is why it never trips the pool.

---

## 5. Findings

### F-1 — Re-entrant Appwrite calls from inside a synchronous Site execution
**Severity:** Critical · **Confidence:** CONFIRMED (mechanism), HIGH (as *the* root cause)
**Files:** `packages/api/server.ts:47-52`, all of `apps/web/src/app/actions/*`

`createSessionClient()` / `createAdminClient()` point at
`NEXT_PUBLIC_APPWRITE_ENDPOINT` = `https://appwrite.biso.no/v1`. Every server-side call from the
Site leaves the container, traverses Traefik, and re-enters the same Appwrite API container,
consuming a second worker while the first is still held for the SSR.

**Why it matters:** this is the deadlock itself. Any service that synchronously calls back into the
thread pool that is currently blocked waiting on it will deadlock at a concurrency far below what
the hardware suggests. CPU stays near idle throughout — which is exactly what you measured.

**Remediation:** reduce the callback count per render (F-2…F-6) *and* raise `_APP_WORKER_PER_CORE`
so the pool has slack. The count reduction is the real fix; the worker bump only buys headroom.

---

### F-2 — `getLocale()` issues a guaranteed-401 `account.get()` for every cookieless request, 5× per render
**Severity:** Critical · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/actions/locale.ts:7-28` (called from 21 files)

```ts
const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
if (isLocale(cookieLocale)) return cookieLocale;
// Fall back to an authenticated user's stored preference
const { account } = await createSessionClient();
const user = await account.get();   // ← no session cookie exists; always 401
```

For a visitor with no `NEXT_LOCALE` cookie **and no session cookie**, this fires a network round-trip
that cannot possibly succeed. It runs 5 times per homepage render (layout, `i18n/request.ts`, page,
nav, hero). Crawlers and monitors are 100% cookieless, so this is worst-case for exactly the traffic
that never stops.

**Remediation:** skip the Appwrite call entirely when the session cookie is absent — the same guard
`getLoggedInUser()` already uses. Then wrap in React `cache()` so it resolves once per request.
This alone removes ~5 of 18 calls.

---

### F-3 — `getUserPreferences()` calls `account.getPrefs()` unconditionally
**Severity:** High · **Confidence:** CONFIRMED
**Files:** `apps/web/src/lib/auth-utils.ts:65-94` (8 call sites)

Same defect as F-2, no session-cookie guard at all. One more guaranteed 401 per render.

---

### F-4 — Homepage pulls up to 1200 relationship-expanded rows to compute two integers
**Severity:** Critical · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/(public)/page.tsx:36-48`

```ts
listEvents({ locale, status: "published", limit: 1000, campus: campusId ?? "all" }),
listJobs({ locale, status: "published", limit: 1000 }),
...
<AboutSection eventCount={events.length} jobCount={jobs.length} />
```

The full row sets are used **only** for `.length`.

`listJobs` silently clamps to 200 (`jobs.ts:69` — `Query.limit(Math.min(limit, 200))`), so the
`limit: 1000` at the call site is misleading but not honoured; it still expands relationships via
`JOB_SELECT` (`packages/shared/recruitment.ts:127-147`), including a full `"translations.*"`.
**`listEvents` is the heavy one** — it honours `limit: 1000` and selects across relationships
(`events.ts:47-77`):

```ts
Query.select([... "campus.$id","campus.name","department.$id","department.Name",
              "translation_refs.$id", ... ])
Query.equal("translation_refs.locale", locale)
```

Per `packages/api/appwrite.config.json`, `events.translation_refs` is `oneToMany twoWay`, and
`events.campus` / `events.department` are `manyToOne twoWay`. Appwrite populates relationships
**per row**, so a 1000-row page triggers thousands of internal MariaDB lookups — while one Swoole
worker is pinned for the whole thing, and a *second* worker is pinned holding the SSR that's waiting
for it. This is the single longest worker-hold in the app.

**Remediation:** use a count query (`Query.limit(1)` and read `total`) for the stats, and cap the
carousel/list feeds at what is actually rendered (~10–20).

---

### F-5 — Layout-level fan-out on every public page, including 404s
**Severity:** High · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/(public)/layout.tsx:15-19`, `apps/web/src/app/actions/nav.ts:93-104`

`getNavFeatured()` runs in the `(public)` layout, so **every** public URL — including every
bot probe of `/wp-login.php`, `/.env`, `/xmlrpc.php` — pays 1 `getLocale()` + 3 list queries before
Next even decides the route is a 404.

**Remediation:** the mega-nav featured items are identical for all anonymous visitors. This is the
single best `"use cache"` candidate in the app (see F-7).

---

### F-6 — Duplicated fetches with no request memoization
**Severity:** High · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/(public)/page.tsx` vs `components/home/hero-section.tsx`;
`apps/web/src/app/(public)/[...slug]/page.tsx:12-49`

- `HeroSection` re-fetches events and news that `page.tsx` already fetched in the same render.
- The catch-all calls `getPage(slug, locale)` **twice** — once in `generateMetadata`, once in the
  page body — and `getPage` is an Appwrite SDK call, so Next cannot dedupe it.

**Remediation:** wrap shared readers in React `cache()`, or pass data down as props.

---

### F-6b — The one `cache()` wrapper that exists is defeated by an object argument
**Severity:** High · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/actions/jobs.ts:54-124`

`_listJobs` *is* wrapped in React `cache()` — but it takes a single **object** parameter, and every
call site constructs a fresh literal:

```ts
const _listJobs = cache(async (params: { campus?…; limit?…; locale?… }) => { … });
export async function listJobs(params: {…}) {
  return _listJobs({ campus: params.campus, department: params.department, … });  // ← new object every call
}
```

React `cache()` keys on argument identity (`Object.is` per argument). A freshly allocated object
never matches the previous one, so **the memo never hits** and every call is a fresh Appwrite
round-trip. By contrast `_getJobBySlug(slug, locale)` (`jobs.ts:126`) takes primitives and memoizes
correctly — that one works.

**Why it matters:** this is the trap to avoid when applying the `cache()` remediation in F-2/F-6
elsewhere. Wrapping in `cache()` and passing an options object looks correct, reviews as correct,
and does nothing.

**Remediation:** accept primitive parameters, or normalize to a stable string key inside a
primitive-keyed cached inner function.

---

### F-7 — `cacheComponents: true` with **zero** `"use cache"` directives
**Severity:** High · **Confidence:** CONFIRMED (state), MEDIUM (contribution to the incident)
**Files:** `apps/web/next.config.ts:23-24`, commit `af1678f2` (2026-08-10)

```
$ grep -rl '"use cache"' apps/web --include=*.ts --include=*.tsx | wc -l
0
```

Commit `af1678f2` enabled `cacheComponents: true` **and** removed
`export const dynamic = "force-dynamic"` from `app/layout.tsx`. Under Cache Components, everything
is dynamic *by default* and only `"use cache"` opts content into caching. With none present, the app
has no route cache, no data cache, and — critically — **no static shell**.

The same commit set `partialPrefetching: true`. Since there is no static shell to prefetch, every
`<Link>` that enters the viewport or is hovered resolves to a **full dynamic SSR render** with the
complete 18-call fan-out. The mega-nav exposes dozens of links per page, so one human page view can
spawn a burst of full renders.

**This did not start the problem, but it removed the last brake on it.** It is why the failure now
appears within ~20 seconds instead of under load.

---

### F-8 — `plainDb` deep-clones every result through `JSON.parse(JSON.stringify(…))`
**Severity:** Medium · **Confidence:** CONFIRMED
**Files:** `packages/api/server.ts:22-40`

```ts
return JSON.parse(JSON.stringify(result));
```

On the 1000-row relationship-expanded payloads from F-4, this is a synchronous, event-loop-blocking
serialize + reparse at ~3× peak memory. It does not consume Appwrite workers directly, but it
**lengthens the SSR**, which lengthens the time worker #1 stays held — directly worsening the
deadlock ratio.

**Remediation:** replace with `structuredClone`, or better, drop the clone and only sanitize at the
RSC → Client boundary where it's actually needed.

---

### F-9 — 8s client-side abort does not free the Appwrite worker
**Severity:** Medium · **Confidence:** HIGH
**Files:** `packages/api/server.ts:56-58, 128-145`

`APPWRITE_REQUEST_TIMEOUT_MS` defaults to 8000ms and aborts via `AbortSignal`. Aborting the HTTP
request closes the socket, but Appwrite's worker has already begun the query and runs it to
completion against MariaDB. So under stress the timeout **discards results without releasing
capacity** — the work is paid for and thrown away. Combined with the 15s Site timeout, a saturated
system burns full query cost on responses nobody receives.

---

### F-10 — Failures are swallowed, so the outage is invisible from the app side
**Severity:** Medium (operability) · **Confidence:** CONFIRMED
**Files:** `actions/events.ts:105-108`, `actions/campus.ts:115-118`, `actions/about.ts:22-25`,
`sitemap.ts:99-104`, and most other actions

Nearly every action ends in `catch { return [] }`. When Appwrite stops answering, pages still render
— empty — and nothing alerts. This is why the Site kept looking "fine" while the platform was down,
and it is why the culprit took weeks to find.

---

### F-11 — `/api/health/ready` performs an admin `users.list()`
**Severity:** Low–Medium · **Confidence:** LOW (nothing in the repo probes it)
**Files:** `apps/web/src/app/api/health/ready/route.ts`

Each probe = one Site execution (worker #1) + one admin API call (worker #2). Harmless at low
frequency; if anything probes it every few seconds it is a constant, traffic-independent drain.

**Searched and found nothing:** no `HEALTHCHECK` in `apps/web/Dockerfile`, no probe in
`packages/api/appwrite.config.json`, no reference in `functions/scheduled-dispatch`. The only hits
were Next.js build manifests under `.next/`. **So the repo wires no probe at all** — if one exists it
comes from your Appwrite Site settings, Traefik, or an external uptime monitor, which is the only
place left to check. Worth 60 seconds of your time because a probe here *would* fire from container
start with zero visitors, matching the "~20 seconds after restart" timing — but treat this as a
long shot, not a lead.

---

### F-12 — `sitemap.ts` fans out ~3000 rows on every request
**Severity:** Medium · **Confidence:** CONFIRMED
**Files:** `apps/web/src/app/sitemap.ts:98-105`

Six parallel list queries at `limit: 500` each. Under `cacheComponents` with no `"use cache"`, this
is dynamic — so every crawler hit on `/sitemap.xml` costs 6 concurrent workers plus relationship
expansion. Search-engine crawlers hit sitemaps frequently and are exactly the cookieless traffic
class from F-2.

---

## 6. Root-cause hypotheses, ranked

**Confirmed facts**
- Site domain requests are synchronous executions that hold an Appwrite API worker (docs).
- `_APP_WORKER_PER_CORE` defaults to 6 → ~48 API workers on 8 vCPU (docs).
- `apps/web` makes ~18 Appwrite calls per anonymous homepage render, ~6 of which are pointless 401s (code).
- `apps/admin` makes 1 and is auth-gated (code).
- Zero `"use cache"` directives exist while `cacheComponents: true` (code).

**Strong evidence**
1. **Worker-pool deadlock via re-entrant callbacks (F-1 + F-2 + F-4 + F-5).** Explains every
   symptom including the low CPU, the whole-platform outage, and the instant recovery on deletion.
   Predicts a hard concurrency cliff around 5–6 simultaneous renders. **This is the root cause.**

**Hypotheses (plausible aggravators, not causes)**
2. **`partialPrefetching` + no static shell (F-7)** multiplies renders per human visit. Explains why
   onset sharpened to ~20s after 2026-08-10, but not the weeks before.
3. **Health probe self-load (F-11)** would explain a visitor-independent trigger, but nothing in the
   repo configures a probe — it would have to come from Appwrite/Traefik/uptime config. Long shot.

**Ruled out**
- Host CPU/RAM/swap exhaustion — measurements contradict it.
- MariaDB or Redis failure — both healthy after Site deletion, and load was near zero during failure.
- The Next 16.2 → 16.3 upgrade as *cause* — degradation predates it by weeks.
- Unbounded in-memory cache / memory leak — searched `apps/web`, `packages/{api,shared,payment,connectors}`;
  the only module-level maps are bounded (`sharedTransports`, `FLAG_BY_KEY`, `rowCache` keyed by provider).
- Anonymous-session storms — already fixed; no middleware exists, provisioning is lazy
  (`apps/web/CLAUDE.md`, `lib/anon-session.ts`).
- Cron feedback loops — `scheduled-dispatch` runs `*/5 * * * *` with bounded sweeps (`SWEEP_LIMIT = 50`).
- SSR self-calls to `api.biso.no` — the only such fetch (`campus/components/team/team-tab.tsx:156`)
  is inside a `"use client"` component, so it runs in the browser. No nested Site execution.

---

## 7. Recommended remediation sequence

**Phase 0 — make it safe to redeploy the Site at all (do before re-enabling)**
1. Raise `_APP_WORKER_PER_CORE` (e.g. 6 → 16) on the Appwrite API container. Buys headroom; does
   **not** fix the ratio. Do not stop here.
2. Set the web Site's runtime timeout to the 30s max so a slow render fails cleanly rather than
   mid-flight.

**Phase 1 — cut the callbacks per render (the actual fix, ~18 → ~4)**
3. **F-2 / F-3**: guard `getLocale()` and `getUserPreferences()` on the session cookie, then wrap
   both in React `cache()` — they take no arguments, so the memo will actually hit. *(−6 calls, and
   it is a few lines.)*
4. **F-4**: replace the two count-only reads with count queries (`Query.limit(1)`, read `total`) and
   cap the feeds at what is rendered. Prioritise `listEvents` — it is the one that honours
   `limit: 1000`. *(largest single reduction in worker-hold time.)*
   **F-6b**: while doing this, fix the object-argument `cache()` on `_listJobs` — and don't
   reproduce that shape in the new wrappers.
5. **F-6**: `cache()` the shared readers; pass hero data as props instead of refetching; call
   `getPage()` once in the catch-all.

**Phase 2 — restore caching**
6. **F-5 / F-7 / F-12**: add `"use cache"` to `getNavFeatured()`, the partner list, campus list, and
   `sitemap.ts` with a sensible `cacheLife`. All are identical for every anonymous visitor. Keep
   `getMembershipStatus()` / `getLoggedInUser()` uncached — they are per-user and must stay dynamic.
   Once a static shell exists, `partialPrefetching` becomes a benefit instead of a multiplier.

**Phase 3 — hardening**
7. **F-8** `structuredClone`, **F-9** revisit the abort strategy, **F-10** stop swallowing errors —
   surface Appwrite failures to `onRequestError` so the next incident is visible in minutes.
8. **F-11** confirm what probes `/api/health/ready` and how often.

---

## 8. Verification plan

Reproduce the isolation test with instrumentation, in this order:

1. **Baseline (Site still deleted).** Record `no_idle_worker`, `sync_timeouts`, Appwrite p50/p99
   latency over 5 min. Expect zeros.
2. **Count the fan-out before touching anything.** Redeploy the Site, then issue **one** cookieless
   request:
   `curl -sS -o /dev/null https://web.biso.no/` and count inbound `/v1/*` hits in Traefik JSON access
   logs correlated by time. **The audit predicts ~18, with ~6 returning 401.** This single
   measurement confirms or refutes the whole thesis.
3. **Find the cliff.** k6, ramping 1 → 2 → 4 → 6 → 8 → 12 VUs, 60s per step, watching
   `no_idle_worker` and `sync_timeouts`. Expect a sharp knee near **48 / 9 ≈ 5–6 VUs** — and note
   that a *gradual* degradation instead of a knee would weaken the deadlock hypothesis.
4. **Apply Phase 1, re-run step 2.** Expect ~4 calls, 0× 401.
5. **Re-run step 3.** The knee should move out by roughly the same factor (~4×). If it doesn't,
   something is holding workers that this audit missed — go back to the Traefik logs.
6. **Apply Phase 2, re-run steps 2–3** with a warm cache. Repeat views of `/` should show near-zero
   Appwrite calls.
7. Throughout: host CPU, RAM, swap, MariaDB threads-running, Redis latency. All should stay flat —
   they were never the constraint.

`_APP_WORKER_PER_CORE` should only be tuned back down *after* Phase 1–2 land, so you can tell
whether recovery came from the fix or the headroom.

---

## 9. Things I would NOT change

Reviewed and sound — leave them alone:

- **No middleware, lazy anonymous sessions.** `apps/web/CLAUDE.md` documents that eager anonymous
  provisioning was removed after it created junk accounts. That fix is correct and still in place;
  `lib/anon-session.ts` is the right shape.
- **`getLoggedInUser()` / `getMembershipStatus()` session-cookie guards.** These are the *correct*
  pattern — F-2 and F-3 are defects precisely because they don't do this. Don't "harmonize" the good
  ones down.
- **`unstable_cache` membership design.** The pure/dynamic split, the "don't cache transient
  failures" `MembershipComputationError`, and the admin-client-in-detached-callback reasoning are
  all deliberate and well-documented. (One thing to check separately: `unstable_cache` semantics
  under `cacheComponents` in 16.3.)
- **Cron endpoint design.** Bounded sweeps, `safeSecretCompare`, atomic Finago claims, single
  `CRON_SECRET` — no feedback-loop risk found.
- **Appwrite schema and indexes.** `idx_status_campus`, `idx_content_locale` etc. are appropriate.
  The problem is query *volume and shape*, not missing indexes.
- **`@repo/api` as the single Appwrite entrypoint.** There is exactly one client factory module.
  Consolidation is already done; no duplicate SDK layers found.
- **Client/server boundary.** `team-tab.tsx` and `apiClient` are correctly client-side. No
  accidental SSR self-calls exist.
