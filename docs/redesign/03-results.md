# Phase 6 results — RD-033

**Measured:** 2026-09-02 · **Next.js** 16.3.0 · **Runtime:** `bun` 1.4.0

This is the closing comparison for the `apps/web` redesign: 33 of 34 packages
landed, and this one measures what they did. It compares the working tree
against `RD-001`'s pre-redesign baseline on routes, bundle size, crawler
surface and Core Web Vitals.

---

## 0. Method — and why the recorded baseline could not be used directly

`baseline/README.md` closes with a warning that turned out to matter more than
anything else in this package:

> **RD-033 must re-measure under `bun`**, and the RD-001 vitals in
> `vitals.json` should be treated as a lower bound: they were captured with no
> content to render.

The baseline was served under Node 26, where every Appwrite read fails silently
(FINDING-C). Its pages rendered empty. Comparing today's fully-populated pages
against those numbers would have compared a full site to a blank one and called
the difference a regression.

**So the baseline was rebuilt and re-measured, not read off the page.** `HEAD`
is still `c82f70d3` — the entire redesign is uncommitted — so a detached
worktree at `HEAD` reconstructs the pre-redesign app exactly:

```bash
git worktree add <tmp>/baseline-wt HEAD --detach
cd <tmp>/baseline-wt && bun install --frozen-lockfile && bun run build --filter=web
```

That build reproduces `bundle.md` **byte for byte** — 3.3 MB `.next/static`, 89
JS files, 2,555.7 KB JS, 332.8 KB CSS — which is the evidence that the
reconstruction is faithful and that RD-001's figures are reproducible.

Both builds were then served under `bun` from their own standalone output, the
old one on `:3001` and the new on `:3000`, **at the same time, on the same
machine, in the same session**, and measured with the committed
`baseline/collect-vitals.js`, unmodified.

Three sets of numbers appear below and they are not interchangeable:

| Column | What it is |
|---|---|
| **RD-001 (recorded)** | `vitals.json` as captured, under `node`, empty pages. Kept only for continuity. |
| **baseline (re-measured)** | The same commit, rebuilt, served under `bun` with real content. **This is the comparison basis.** |
| **RD-033** | The working tree, same conditions. |

### LCP sampling

FINDING-D required a median of at least three desktop runs because desktop LCP
is bimodal. Three turned out not to be enough, and mobile turned out to be
bimodal too — the first median-of-3 pass reported a 107% `/shop` mobile
regression that a single re-run then contradicted at 1,420 ms.

LCP is therefore reported from a **paired sampler at n = 7**: for each route it
alternates new / old / new / old, so machine drift lands on both arms equally.
Every individual sample is printed alongside the median. Payload, DOM, CLS and
TBT figures are deterministic and come from the median-of-3 full-metric runs.

---

## 1. Route resolution

**Every route in the Phase 0 inventory still resolves. Nothing was removed.**

Diffing the build's own route table, old against new:

| | Baseline | RD-033 |
|---|---|---|
| `ƒ` Dynamic | 65 | 69 |
| `◐` PPR shell | 11 | 11 |
| `○` Static | 2 | 2 |
| **Total entries** | **78** | **82** |

**Removed: none.** Added: four, all of them planned —

```
/campus/[slug]   /campus/bergen   /campus/oslo      (GATE-3)
/design-system                                      (RD-007)
```

Page and handler counts:

| | Baseline | RD-033 | Note |
|---|---|---|---|
| `page.tsx` | 54 | 54 | `/varsling` and `/shop/membership` became handlers; `/design-system` and `/campus/[slug]` are new |
| `route.ts` | 21 | 23 | the two RD-034 redirect handlers |

A 59-route live sweep (the baseline's 47, plus the four new pages, plus the
GET-able API handlers) resolved **59/59**. Full table in
`baseline/routes-rd033.tsv`.

Two status codes changed, both intended:

| Route | Baseline | RD-033 |
|---|---|---|
| `/varsling` | 200 + client-side hop | **308 → `/safety`** |
| `/shop/membership` | 200 + client-side hop | **308 → `/membership/join`** |
| `/api/health/ready` | 503 under `node` | 200 `{"status":"ready"}` under `bun` |

FINDING-A is closed. Both `Location` headers were confirmed by `curl -sI`.

### The 404 status code is unchanged, and was never a redesign problem

Seven not-found URLs were checked against **both** builds:

```
/this-page-does-not-exist  /news/nope  /jobs/nope  /units/oslo/nope
/shop/nope  /campus/nope  /events/nope
```

All fourteen answer **HTTP 200** with the not-found UI, every one carrying
`x-nextjs-prerender: 1` and `x-nextjs-postponed: 1`. This is the
`cacheComponents` shell flush described in FINDING-A, it predates the redesign,
and it is identical on both sides. It is recorded here so it is not misread
later as something Phase 6 introduced.

**It is also not fixable from page code, which RD-033 established rather than
assumed.** Four throwaway probe routes were built and served, then removed:

| Probe | Result |
|---|---|
| `notFound()` as the first statement of a page, no async work | **200** |
| `await connection()` — the `cacheComponents` prerender opt-out — then `notFound()` | **200** |
| `export const prefetch = "force-disabled"` then `notFound()` | **200** |
| A route handler returning `new Response(…, { status: 404 })` | **404** ✅ |

And two more never got as far as running:

| Escape hatch | Result |
|---|---|
| `export const dynamic = "force-dynamic"` | **build error** — `Route segment config "dynamic" is not compatible with nextConfig.cacheComponents` |
| `export const revalidate = 0` | **build error** — same rejection |

So it is not about *when* `notFound()` runs, or about whether a route has a
prerendered shell — `/campus/[slug]` is classified `ƒ` Dynamic and still answers
with `x-nextjs-postponed: 1`. **Under `cacheComponents`, no page in this app can
set a 404 status. Only route handlers can.**

The config levers are no better:

- `partialPrefetching: false` alone changes nothing — still `x-nextjs-postponed: 1`, still 200.
- `cacheComponents: false` does not build. It first fails on `partialPrefetching requires cacheComponents`, then on **22 route files** using the `instant` segment config, and behind those sit **13 files using `"use cache"`** — two of them in `packages/`.

That is the honest close on FINDING-E: **fixing it is an architectural migration
off `cacheComponents`, not a patch.** The two aliases RD-034 fixed were fixable
precisely because a fixed path can become a route handler; a 404 that depends on
a database lookup for an arbitrary slug cannot. Introducing middleware would run
on every request in an app that deliberately has none (`apps/web/CLAUDE.md`
documents the absence) and would still need a per-request existence check.

The user-facing impact is limited — the correct not-found UI renders, so a human
sees the right page. The cost is that crawlers see a 200, so unknown URLs are
indexable. Worth carrying as a known issue rather than a task.

**The duplicate-`<main>` symptom is gone.** With true 308s the redirect happens
before any render, so `/varsling` now settles on `/safety` with exactly one
`<main>` and one `<h1>`. Checked across eight routes including both aliases,
both 404 shapes, `/campus/oslo` and `/design-system`: **one `<main>`, one
`<h1>`, correct `<html lang>` on every one.**

---

## 2. Bundle

| Metric | Baseline | RD-033 | Δ |
|---|---|---|---|
| `.next/static` total | 3.3 MB | **2.8 MB** | −0.5 MB |
| JS files | 89 | **65** | −24 |
| JS bytes | 2,555.7 KB | **2,144.3 KB** | **−411.4 KB (−16.1%)** |
| CSS files | 3 | 3 | — |
| CSS bytes | 332.8 KB | **291.4 KB** | −41.4 KB (−12.4%) |
| Preloaded font payload | 108.7 KB | **81.4 KB** | −27.3 KB (−25%) |
| `.next/server` | 79 MB | 97 MB | +18 MB (server-only, not shipped) |
| `.next/standalone` | 64 MB | 65 MB | +1 MB |

The font line is the clearest single win of RD-006: the baseline preloaded
Museo Sans 300 as a **61.4 KB unsubsetted `.otf` that rendered zero characters**
(FINDING-B) alongside Inter. Today it preloads Inter (47.3 KB, unchanged, same
file hash) and Archivo (34.1 KB), and both render.

Largest chunk is unchanged at 314.7 KB (was 314.5 KB) — that ceiling was not
this redesign's to move. The 24 fewer files and 411 KB less JS come from the
v1 tree deleted in RD-030.

### Per-route JS, measured in the browser

Runtime JS is the number that reaches a user, and RD-001's headline finding was
that it barely varied by route. It still barely varies — but every route is
lighter by the same ~24 KB:

| Route | Baseline | RD-033 |
|---|---|---|
| `/` | 360 KB | **336 KB** |
| `/jobs` | 367 KB | **344 KB** |
| `/events` | 360 KB | **336 KB** |
| `/news` | 359 KB | **337 KB** |
| `/shop` | 359 KB | **336 KB** |

This confirms RD-030's provisional "~23 KB per route" against a like-for-like
baseline. **It also confirms the shape of the problem is unchanged**: the shared
client bundle still dominates, per-route splitting still barely happens, and
336 KB is still a lot of JavaScript for a content site. The redesign made it
16% smaller; it did not change the architecture that makes it uniform.

---

## 3. Core Web Vitals

### Mobile — 390×844 @3×, 4× CPU, ~1.6 Mbps, 150 ms RTT · LCP, n = 7 paired

| Route | Baseline | RD-033 | Δ |
|---|---|---|---|
| `/` | **6,152 ms** | **1,404 ms** | **−77%** |
| `/jobs` | 4,376 ms | **2,624 ms** | −40% |
| `/events` | 4,440 ms | **3,360 ms** | −24% |
| `/news` | 4,312 ms | **2,628 ms** | −39% |
| `/shop` | 1,476 ms | **3,088 ms** | **+109% — regression, §3.2** |

All seven samples per cell:

```
/       new 1372 1396 1400 1404 1404 1408 1472   old 6128 6140 6148 6152 6152 6320 6428
/jobs   new 1416 2620 2620 2624 2624 2628 2636   old 4364 4372 4376 4376 4376 4384 4396
/events new 3336 3352 3352 3360 3376 3376 3388   old 4428 4436 4436 4440 4444 4452 4456
/news   new 1412 2628 2628 2628 2636 2636 2676   old 4296 4296 4300 4312 4312 4312 4340
/shop   new 1424 3024 3072 3088 3096 3100 3108   old 1468 1468 1472 1476 1476 1476 1480
```

Four of the five routes RD-001 measured were in Google's "poor" LCP band
(> 4 s) on mobile. **Three of those four now sit under 2.7 s and the homepage
under 1.5 s**; `/events` improves but stays above 3 s. The homepage went from
the worst route on the site to the best.

### Desktop — 1440×900, unthrottled · LCP, n = 7 paired

| Route | Baseline | RD-033 | Δ |
|---|---|---|---|
| `/` | 1,164 ms | **72 ms** | −94% |
| `/jobs` | 164 ms | 180 ms | +16 ms |
| `/events` | 932 ms | **332 ms** | −64% |
| `/news` | 256 ms | 332 ms | +76 ms |
| `/shop` | 824 ms | **188 ms** | −77% |

```
/       new 60 64 64 72 72 72 264      old 1148 1152 1164 1164 1164 1176 1352
/jobs   new 168 172 172 180 180 196 264 old 140 148 160 164 268 328 972
/events new 324 328 328 332 332 336 348 old 144 148 148 932 936 944 952
/news   new 288 328 332 332 332 336 336 old 216 224 232 256 256 308 1036
/shop   new 168 176 180 188 196 208 228 old 796 812 816 824 828 836 840
```

The two desktop "regressions" are 16 ms and 76 ms and both sit inside the
bimodality FINDING-D warned about — look at the old `/jobs` spread
(140→972 ms) and old `/events` (144→952 ms) against the new build's tight
clusters. **The new build's desktop distributions are visibly tighter than the
baseline's**, which is worth more than either median.

### 3.1 Everything else

| | Desktop FCP | TBT | CLS | Requests | Transfer KB | DOM nodes |
|---|---|---|---|---|---|---|
| `/` | 212 → 76 | 0 → 0 | 0 → 0 | 51 → 55 | 1081 → **531** | 766 → **342** |
| `/jobs` | 96 → 72 | 0 → 0 | 0 → 0 | 48 → 50 | 528 → 493 | 322 → 297 |
| `/events` | 72 → 72 | 0 → 0 | 0 → 0 | 48 → 50 | 559 → 515 | 362 → 348 |
| `/news` | 152 → 64 | 0 → 0 | 0 → 0 | 48 → 48 | 549 → 484 | 395 → 305 |
| `/shop` | 60 → 76 | 0 → 0 | **0.06 → 0** | 46 → 47 | 552 → 491 | 840 → 849 |

| | Mobile FCP | TBT | CLS | Requests | Transfer KB | DOM nodes |
|---|---|---|---|---|---|---|
| `/` | 1476 → 1396 | **14 → 0** | 0 → 0 | 43 → 42 | 768 → **474** | 765 → **342** |
| `/jobs` | **2528 → 1400** | 0 → 0 | 0 → 0 | 41 → 41 | 523 → 483 | 321 → 297 |
| `/events` | 1436 → 1404 | 0 → 0 | 0 → 0 | 41 → 40 | 538 → **650** | 361 → 348 |
| `/news` | 1476 → 1404 | 1 → 0 | 0 → 0 | 42 → 39 | 507 → 478 | 394 → 305 |
| `/shop` | 1476 → 1408 | 1 → 2 | 0 → 0 | 47 → 38 | 548 → 483 | 840 → 849 |

- **CLS is 0 on every route in both profiles.** The baseline's one non-zero
  figure — `/shop` at 0.06 desktop — is gone.
- **TBT was already good and stayed good.** The brief's requirement was not to
  regress it; it did not.
- The homepage lost **half its DOM** (766 → 342 nodes) and half its desktop
  transfer (1,081 → 531 KB). That is RD-018 and RD-030 showing up in the
  numbers.
- `/events` mobile transfer went **up**, 538 → 650 KB, entirely in images:
  29 KB → 181 KB. The new event cards carry real photography where the old ones
  carried gradients. That is a deliberate design outcome, not a defect, but it
  is the one payload line that moved the wrong way and it is worth a
  `sizes`/quality pass if mobile data budget matters.

### 3.2 The one regression: `/shop` mobile LCP, 1,476 → 3,088 ms

Reproducible: 6 of 7 samples land at 3,024–3,108 ms, one at 1,424 ms. The
baseline is tight at 1,468–1,480 ms. This is the only regression in the set.

The LCP element is **the same hero paragraph in both builds** — "Fra eksklusiv
merch til turegenandeler og campusskap…". Not a different element, not an image.

**Cause: the LCP paint is gated on delivery of the HTML document over the
throttled link.** A Chrome trace of one mobile navigation settles it:

| Evidence | Figure |
|---|---|
| Main-thread task time between FCP (1,317 ms) and the LCP paint (2,997 ms) | **383 ms of 1,680 ms** — the thread is idle five-sixths of the window |
| `ParseHTML` spans in that window | 111 spans, **27 ms of actual work**, last one ending at 2,946 ms — the parser is starved, not busy |
| LCP paint vs `MarkDOMContent` | 2,997 ms vs 2,946 ms — **the paint lands 51 ms after parsing completes** |
| Same page, network throttling removed, CPU still at 4× | `responseEnd` 74 ms, **LCP 404 ms** |

That last row is the decisive one. With the CPU throttle unchanged and only the
1.6 Mbps link removed, LCP collapses from ~3,080 ms to 404 ms. It is document
delivery, and nothing else.

Ruled out along the way, each with a measurement:

| Suspected cause | Test | Result |
|---|---|---|
| The bigger product grid (55 cards vs the baseline's 3) | `/shop?category=clothing`, which renders **0** products | still 2,672 ms |
| Total payload | `/contact`: 36 requests / 469 KB / 329 nodes vs `/shop?category=clothing`: 35 / 470 KB / 314 nodes | **matched on every axis**, yet 1,400 ms vs 2,672 ms |
| Font loading | Both preloaded fonts complete at 1,191 ms and 1,526 ms, `display: swap` | LCP is 1.5 s later |
| Hydration replacing the node | Element tagged at 1.6 s, re-checked at 3.6 s | `sameNode: true` |
| A shared-shell floor | `/contact`, `/press`, `/documents`, n = 3 | 1,400 / 1,408 / 1,408 ms — no floor |
| Main-thread saturation | Trace, above | 383 ms of work in a 1,680 ms window |

Two things follow, and the second is worth more than the first.

**One:** `/shop` was the only one of the five routes whose baseline already beat
3 s, so it had the least room and the most to lose. Every other metric on the
route — transfer, requests, JS, CLS — improved.

**Two:** if the document is the gate, the document is what to look at. §3.3.

### 3.3 Three-quarters of every HTML document on this site is the same message bundle, twice

`NextIntlClientProvider` serialises the **entire** message bundle into the page
so client components can read it, and it lands twice — once in the SSR HTML,
once in the RSC flight payload. Measured on the current build:

| Route | Document | Two largest inline blocks | Share of document |
|---|---|---|---|
| `/` | 503,585 B | 188,898 + 188,898 | **75%** |
| `/contact` | 494,980 B | 188,898 + 188,898 | **76%** |
| `/news` | 504,494 B | 188,898 + 188,898 | **75%** |
| `/jobs` | 496,913 B | 188,898 + 188,898 | **76%** |
| `/shop` | 620,291 B | 188,898 + 188,898 | 61% |

Across all of them, 85–93% of the document is inline `<script>` payload and only
7–15% is markup. The block begins
`{"units":{"hero":{"title":"Enheter og foreninger"…` — the whole bundle, every
namespace, on every route, whether or not a client component on that page reads
a single key of it.

**This is pre-existing, not something the redesign introduced.** The baseline
does exactly the same thing at 2 × 174,385 B — 77% of its `/shop` document. What
the redesign changed is the size of one copy: RD-032 took the bundle from 3,580
to 3,905 keys, so each copy grew 174,385 → 188,898 B (+8.3%), adding ~29 KB of
uncompressed HTML to **every page on the site**.

It also explains FINDING-E in `baseline/README.md` — grepping page HTML for a
translated string always matches, because every string is in every page.

**The fix is not a redesign fix and is out of scope here**, but it is the largest
single performance item left in `apps/web` and it is worth stating precisely:
pass `NextIntlClientProvider` only the namespaces the page's *client* components
actually use, rather than the whole bundle. On a page like `/contact` that is a
handful of keys against 3,905. Nothing in this redesign is a prerequisite.

### 3.4 A second, separate defect on the filtered shop view

While isolating the above: on `/shop?category=clothing` the page's `<h1>` sits at
byte **491,514 of 500,227** — 98% of the way through the document, behind 455 KB
of inline script. On `/contact` and `/press` the `<h1>` is at byte 17,173 with
756 bytes of script ahead of it, and on unfiltered `/shop` at byte 29,029.

So when the shop is filtered by a query parameter, the hero leaves the
prerendered shell and is streamed last. A crawler or a slow connection sees the
page header arrive after everything else. This is a `/shop` routing detail rather
than anything the redesign's visual work touched, and it is recorded here because
it was found, not because RD-033 owns it.

---

## 4. Crawler surface

### Sitemap

| | Baseline | RD-033 |
|---|---|---|
| `<loc>` entries | 28 | **244** |
| Pre-redesign URLs missing | — | **0** |

Every one of the baseline's 28 URLs is present. The 216 additions are the five
campus landing pages, the `?campus=` variants of `/events`, `/jobs` and `/news`,
and — the bulk of it — the unit, shop, news, job and event detail pages the old
sitemap never listed at all. The baseline sitemap was re-measured under `bun`
and is still 28 entries, so this growth is the redesign's doing, not a
content-availability artefact.

`/units` and `/shop` accept `?campus=` (all five feeds do, confirmed live) but
are deliberately not enumerated. The comment in `sitemap.ts` explaining that had
gone stale — it said "`/units` filters client-side until RD-025", and RD-025 has
shipped — so it is corrected to state the real reason: `/units` already has all
141 of its `/units/<campus>/<slug>` pages in the sitemap, which is the
campus-specific content a crawler wants, and the filtered index would add five
near-duplicate listings on top. Whether to list them anyway is an SEO call, not
something to flip silently.

### A gap that fix uncovered: two scoped feeds had no canonical

`/events`, `/news` and `/jobs` each carry
`alternates: { canonical: "/<feed>" }`, so a campus-scoped view points at the
unscoped URL instead of competing with it in search. **`/units` and `/shop` did
not** — they gained server-side `?campus=` scoping at RD-025 without gaining the
canonical that goes with it, so `/units?campus=oslo` was an indexable near-copy
of `/units`.

Both now declare it, verified in the rendered HTML:

```
/units?campus=oslo    → <link rel="canonical" href="…/units">
/shop?campus=bergen   → <link rel="canonical" href="…/shop">
```

`campus-routing.test.ts` covered three feeds and now covers all five, so the next
feed to gain campus scoping cannot skip the canonical silently. Mutation-tested:
removing the canonical from `/units` fails the suite.

### robots.txt

`/design-system` is disallowed, alongside `/api/`, `/auth/`, the three protected
routes and the shop's transactional paths. It appears **zero** times in the
sitemap.

Nothing was locking that in, so `apps/web/src/app/seo-surface.test.ts` now does:
it asserts the robots entry, asserts `sitemap.ts` never mentions
`design-system`, and asserts both legacy aliases are 308 route handlers with no
`page.tsx` shadowing them. The exclusion assertion was mutation-tested — adding
`design-system` back to `sitemap.ts` fails it.

---

## 5. Gates

| Check | Result |
|---|---|
| `bun run build` | **exit 0** — clean build from `rm -rf .next` |
| `bun run check-types` | **exit 0** — 15/15 tasks |
| `bun x ultracite check` | 3 errors, **all pre-existing**, **0 in `apps/web`** |
| `bun run test` | **exit 0** — 836 tests: web 535 / 48 files, `@repo/shared` 217, `api` 86 |

The three lint errors are `.infisical.json` formatting,
`packages/editor/src/ai/tools/streaming.test.ts` and
`packages/editor/src/editor/page-feed-context.test.tsx`. The same three fail at
the baseline commit, verified by running `ultracite check` inside the worktree.
All three are outside `apps/web`, so they were left alone.

**A fourth error was found and fixed, and it was the redesign's.** RD-013's
edit to `turbo.json` expanded every short array to multi-line, which Biome
rejects. Since the `BISO_SHELL_V2` entry that edit added is now dead — RD-030
removed the toggle and nothing reads the variable — both were removed together.
`turbo.json` and `apps/web/.env.example` are now **byte-identical to `HEAD`**:
the redesign leaves zero net change to root configuration.

---

## 6. Against RD-033's stated criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Every route from the Phase 0 inventory still resolves | **Pass.** 0 removed, 4 added, 59/59 sweep, both redirects now true 308s |
| 2 | Same 5 routes × 2 form factors, before/after table | **Pass.** §3, with the baseline rebuilt so the comparison is honest |
| 3 | LCP / CLS / INP / TBT per route, regressions explained or fixed | **Pass on explained, not fixed.** The one regression (`/shop` mobile LCP) is reproduced, isolated, six candidate causes eliminated, and the real cause established by trace and confirmed by removing the network throttle alone. Fixing it means unpicking the duplicated message bundle (§3.3), which is out of this package's scope. INP is not measurable without synthetic interaction; TBT is reported in its place, as RD-001 did |
| 4 | Bundle size vs RD-001 | **Pass.** −411 KB JS, −41 KB CSS, −27 KB fonts |
| 5 | Sitemap contains every pre-redesign URL plus campus entries | **Pass.** 0 lost, 28 → 244 |
| 6 | robots.txt correct, `/design-system` excluded | **Pass**, and now covered by a test |
| 7 | build / check-types / lint / test pass | **Pass**, with the one lint regression fixed and three pre-existing failures left in place |
| 8 | `03-results.md` records the comparison | This file |

---

## 7. What the redesign did to performance, in one paragraph

The site RD-001 measured shipped ~357 KB of JavaScript to every route, preloaded
a 61 KB font that rendered nothing, and put four of its five most-trafficked
pages in Google's "poor" LCP band on mobile, the homepage worst at 6.15 s. The
site today ships ~336 KB, preloads only fonts it renders, and has moved the
homepage to 1.40 s, `/news` to 2.63 s and `/jobs` to 2.62 s, with CLS at zero
everywhere and the homepage's DOM halved. The architecture that produced the
uniform bundle is untouched — that was never in scope — so the remaining
headroom is the same headroom RD-001 identified: 336 KB of shared client
JavaScript on a content site. **The one thing that got worse is `/shop`'s mobile
LCP; it is gated on document delivery, and three-quarters of every document on
this site is the same message bundle serialised twice.**
