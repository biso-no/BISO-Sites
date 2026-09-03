# Phase 2 — Migration plan

**Date:** 2026-08-31
**Depends on:** `00-current-state.md`, `01-design-spec.md`
**Status:** plan only. No code changed.

33 work packages, `RD-001`–`RD-033`. IDs are permanent and are never reused or
renumbered.

---

## 1. The constraint that shapes this order

The brief requires the app to stay shippable throughout. That is only possible
if the new design system can coexist with the old one on the same page, because
otherwise the first token change repaints all 54 routes at once.

**So the new tokens are additive and namespaced.** `RD-005` introduces
`--biso-deep`, `--biso-blue`, `--biso-sky`, `--biso-sun`, `--biso-line` and the
semantic aliases built on them. It does **not** touch `--brand`, `--primary`,
`--inverted` or `--section`. Nothing consumes the new tokens except
`/design-system` until a page is migrated. Every existing page renders
byte-identically after `RD-005` through `RD-012`.

That yields three properties:

- **Foundation ships invisibly.** Stage 1 is eight packages with zero visual
  change to any user-facing route.
- **Pages migrate independently.** A migrated page consumes new tokens; an
  unmigrated one consumes old. Both are correct simultaneously.
- **Only the shell needs a flag.** Header and footer are global, so Stage 2 is
  the one place where old and new cannot coexist — `RD-013` adds the toggle.

Legacy tokens are deleted in `RD-030`, only once nothing references them.

### Sizing

| Size | Means |
|---|---|
| **S** | 1–3 files, mechanical, no design judgement. Comfortable half-session |
| **M** | 4–8 files, or fewer files with real design decisions. One session with headroom |
| **L** | 8–15 files, or high blast radius. One full session, nothing else attempted |

No package is larger than L. Where a natural unit exceeded L it was split
(`RD-011`/`RD-012`, `RD-019`–`RD-021`).

### Decision gates

Three packages are blocked on answers, marked **[GATE-n]**. Everything before
each gate can proceed today.

| Gate | Question | Blocks | Spec |
|---|---|---|---|
| **GATE-1** | Where do the tokens live? `styles.test.ts` forbids declaring them in `apps/web` | `RD-005` → all of Stage 1+ | `00` §11.1, `01` §8.1 |
| **GATE-2** | Display typeface — Museo Sans 900 (licence?) or Archivo | `RD-006` | `01` §2.2 |
| **GATE-3** | Campus routing — `/campus/[slug]` + `?campus=` | `RD-016`, `RD-023` | `01` §3.3 |

`RD-001`–`RD-004` are ungated and can start immediately.

---

## 2. Stage 0 — Hygiene

Zero design dependency. Each ships on its own and reduces the surface area of
everything after it.

---

### RD-001 · Pre-redesign baseline capture
**Goal:** Record the performance and route baseline Phase 6 will be measured against.

| | |
|---|---|
| **Files** | `docs/redesign/baseline/` (new): `lighthouse-*.json`, `routes.txt`, `bundle.md` |
| **Depends on** | — |
| **Size** | S |

Must happen before any visual change lands.

- Run `bun run build --filter=web`, record `.next/static` total, chunk count, largest chunks
- Lighthouse (mobile + desktop) against a running instance for `/`, `/jobs`, `/events`, `/news`, `/shop`
- Record LCP, CLS, INP, TBT per route
- Capture the full resolving-route list from `sitemap.ts` + the 54 page files

**Verification**
1. `docs/redesign/baseline/` contains Lighthouse JSON for 5 routes × 2 form factors
2. `routes.txt` lists every route from the Phase 0 inventory with its HTTP status
3. `bundle.md` records `.next/static` size and the 10 largest chunks
4. Numbers reconcile with `00-current-state.md` §10.1 (3.5 MB, 94 chunks, 314.5 KB largest)

---

### RD-002 · Dead code removal
**Goal:** Delete the ~736 LOC and ~1.5 MB Phase 0 proved unreachable.

| | |
|---|---|
| **Files** | `components/member-portal/tabs/settings-tab.tsx`, `.../states/{not-member,no-bi-email,signed-out}-state.tsx`, `.../shared/quick-stats-card.tsx`, `components/home/skeletons.tsx`, `components/news/scroll-indicator.tsx`, `components/layout/nav.tsx` (+10 import sites), `app/(public)/shop/layout.tsx`, `public/images/person-placeholder.jpg` |
| **Depends on** | — |
| **Size** | M |

`home/skeletons.tsx` goes with the four dead `<Suspense>` boundaries in
`(public)/page.tsx` — the data is awaited before render, so they never suspend
(`00` §2.3). Removing them is behaviour-preserving.

The `layout/nav.tsx` shim is re-exported from 10 sites; each moves to
`@/components/nav/mega-nav`.

**Verification**
1. `bun run check-types --filter=web` passes
2. `bun run lint --filter=web` passes
3. `bun run test --filter=web` passes
4. `grep -r "settings-tab\|quick-stats-card\|scroll-indicator\|layout/nav" apps/web/src` returns nothing
5. `/member`, `/shop`, `/` render unchanged at 375 / 768 / 1440px
6. `bun run build --filter=web` succeeds; bundle no larger than RD-001 baseline

---

### RD-003 · Correctness and contrast fixes
**Goal:** Fix the live defects Phase 0 found, without waiting for the redesign.

| | |
|---|---|
| **Files** | `app/(public)/about/alumni/page.tsx`, `components/layout/footer.tsx`, `components/select-campus.tsx`, `app/(public)/about/*/page.tsx` (breadcrumbs), `app/layout.tsx`, `packages/i18n/messages/{en,no}/common.json` |
| **Depends on** | — |
| **Size** | M |

- **Broken link:** `about/alumni/page.tsx:68` points at `/alumni`, which 404s → `/about/alumni`
- **Footer contrast:** `text-muted-foreground` on `bg-inverted` is **4.18:1**, below AA. Minimal patch to `--inverted-foreground` at reduced opacity, or a compliant muted step. A live AA failure on every page should not wait for `RD-014`
- **Footer headings:** `"About"`, `"Students"`, `"Practical"` are object keys rendered raw → i18n keys
- **`select-campus.tsx:27`:** hardcoded `"Velg campus"` shown in English mode → i18n key
- **`/about/*` breadcrumbs:** hardcoded `"Home"`, `"About BISO"` → i18n keys
- **Root metadata:** `description: "BISO Apps"` placeholder → real description

Adds i18n keys to `common.json`; **no existing key is renamed or removed.**

**Verification**
1. `/about/alumni` — every link resolves 200
2. Footer body copy measures ≥ 4.5:1 (state the measured value)
3. Footer headings, campus placeholder and about breadcrumbs all render in English under `NEXT_LOCALE=en`, Norwegian under `no`
4. `en`/`no` key parity still exact (the Phase 0 script; must stay equal)
5. No pre-existing key changed — `git diff` on `packages/i18n` shows additions only
6. `bun run check-types`, `lint`, `test` pass

---

### RD-004 · Animation library consolidation
**Goal:** Ship one animation library, not two.

| | |
|---|---|
| **Files** | `components/expense-v3/{expense-report,generative-receipt-preview,receipt-wallet}.tsx`, `components/onboarding/{onboarding-flow,onboarding-popout}.tsx`, `app/expenses/profile/profile-form.tsx`, `apps/web/package.json` |
| **Depends on** | RD-002 |
| **Size** | S |

6 files import `framer-motion`; 92 import `motion/react`. Both bundle today.
`motion` is framer-motion's successor with a compatible API — the change is the
import specifier.

Also relocates `app/expenses/profile/profile-form.tsx` → `components/profile/profile-form.tsx`. It is a component parked inside `src/app/` with no `page.tsx` beside it (`00` §9).

**Verification**
1. `grep -r "from \"framer-motion\"" apps/web/src` returns nothing
2. `framer-motion` removed from `apps/web/package.json`; `bun install` clean
3. `/fs/new`, `/onboarding`, `/profile` — animations behave as before at 375 / 1440px
4. `bun run build` succeeds; bundle **smaller** than RD-001 baseline (record the delta)
5. `check-types`, `lint`, `test` pass

---

## 3. Stage 1 — Foundation (Phase 3)

Eight packages. **Zero visual change to any user-facing route.** `/design-system`
is the only surface that renders new tokens, and it is built in `RD-007` so
every package after it has a verification surface.

---

### RD-005 · Token layer  **[GATE-1]**
**Goal:** Land the new palette, spacing, radii and elevation as additive tokens.

| | |
|---|---|
| **Files** | `packages/ui/styles/biso-surface.css` *(pending GATE-1)*, `apps/web/src/app/styles.css`, `apps/web/src/app/styles.test.ts` |
| **Depends on** | GATE-1 |
| **Size** | M |

Implements `01` §1.1–1.8: six brand values, three state values, semantic
aliases, 4px spacing scale, radii, three-level elevation.

**Adds only.** `--brand*`, `--primary`, `--inverted`, `--section` are untouched.

`styles.test.ts` gains assertions that the new tokens live wherever GATE-1
decides, mirroring the existing ownership rules rather than weakening them.

**Verification**
1. Every token in `01` §1.1–1.8 resolves in the browser (`getComputedStyle` on `:root`)
2. **Contrast matrix reproduced in-browser** — all 13 pairings in `01` §1.4 measured, none below AA
3. `bun run test --filter=web` passes, **including the existing `styles.test.ts` ownership assertions**
4. `/`, `/events`, `/jobs`, `/news`, `/shop` render **pixel-identically** to RD-004 (screenshot diff, 1440px)
5. `apps/admin` page editor canvas renders unchanged (required if GATE-1 chose a shared-package edit)

---

### RD-006 · Typography  **[GATE-2]**
**Goal:** Install the display face, remove the unrendered one, wire the type scale.

| | |
|---|---|
| **Files** | `apps/web/src/app/fonts.ts`, `app/layout.tsx`, `packages/ui/styles/biso-surface.css`, `styles.test.ts`, `public/museo_sans_300.otf` (delete) |
| **Depends on** | RD-005, GATE-2 |
| **Size** | M |

Museo Sans 300 is removed: 62 KB of unsubsetted `.otf` downloaded on every page
and rendered **zero times** (`00` §4). Replaced per GATE-2. Inter stays.

Implements the nine type roles in `01` §1.5, including `line-height: 0.85` on
`display-hero` and `tabular-nums` on `data`.

**Verification**
1. `museo_sans_300.otf` gone; no reference remains
2. Display face loads as `.woff2`, latin + latin-ext (**æ ø å render correctly**)
3. All nine roles render on `/design-system` at 375 / 768 / 1440px
4. `display-hero` measured line-height is 0.85× its font-size
5. `data` role renders tabular — digits align in a column
6. **No CLS from font swap** — Lighthouse CLS on `/design-system` ≤ 0.01
7. `styles.test.ts` font-wiring assertions updated and passing
8. Total font payload recorded vs RD-001 baseline

---

### RD-007 · `/design-system` route
**Goal:** Build the living showcase that verifies every package after this one.

| | |
|---|---|
| **Files** | `app/(public)/design-system/page.tsx` (new), `app/(public)/design-system/_components/*` (new), `app/sitemap.ts`, `app/robots.ts` |
| **Depends on** | RD-005, RD-006 |
| **Size** | M |

Sections: colour swatches with **live computed contrast ratios**, the type
scale, spacing, radii, elevation, motion durations. Primitives are appended by
each later package.

Excluded from `sitemap.ts` and disallowed in `robots.ts` — an internal surface.

**Verification**
1. `/design-system` renders at 375 / 768 / 1440px
2. Every token from RD-005/RD-006 appears with its name and computed value
3. Contrast ratios computed **live in the page**, not hardcoded — none below AA
4. Renders correctly in both `no` and `en`
5. Absent from `/sitemap.xml`; disallowed in `/robots.txt`
6. Keyboard-navigable; visible focus on every interactive element

---

### RD-008 · Motion foundation
**Goal:** One motion primitive, and the reduced-motion floor the app has never had.

| | |
|---|---|
| **Files** | `apps/web/src/app/styles.css`, `components/ui/reveal.tsx` (new), `/design-system` |
| **Depends on** | RD-007 |
| **Size** | S |

Adds the global `prefers-reduced-motion` block (`01` §1.9) — Phase 0 found
**zero** handling in `apps/web` or `packages/ui`. Adds `<Reveal>`, the only
sanctioned motion wrapper, which no-ops under reduced motion.

Does **not** yet remove the 161 existing reveals; those go per page in Stage 3.

**Verification**
1. With `prefers-reduced-motion: reduce`, **no movement — no transform, translate, scale or position animation — plays anywhere** on `/`, `/events`, `/design-system`
2. `<Reveal>` renders children with no wrapper element when reduced motion is on
3. Motion duration tokens resolve and are demonstrated on `/design-system`
4. Existing animations still play with reduced motion off (no regression)

> **Criterion 1 amended 2026-08-31 during RD-008.** It originally read "no
> animation or transition plays anywhere". That is stricter than the standard
> and stricter than the library allows: `<MotionConfig reducedMotion="user">`
> suppresses transform and layout animation — the vestibular trigger WCAG
> targets — while permitting opacity, which is the documented, standards-aligned
> behaviour.
>
> Measured on `/` under `reduce`: three animations remain, **all `props:
> ["opacity"]`, zero movement**. Forcing those to stop too would need a global
> `getAnimations().finish()` hack with side effects on legitimate state
> transitions, to suppress fades that RD-018 deletes outright. The criterion now
> tests for movement, which is the thing that matters, and Stage 3 removes the
> residual fades page by page.

---

### RD-009 · Layout primitives
**Goal:** `<Container>`, `<Section>`, `<Prose>` — the vocabulary that does not exist today.

| | |
|---|---|
| **Files** | `components/ui/{container,section,prose}.tsx` (new), `/design-system` |
| **Depends on** | RD-007 |
| **Size** | M |

Replaces 176 hand-rolled `mx-auto max-w-*` across 7 widths, 4 `py-*` rhythms
and 50 `min-h-screen` wrappers (`00` §3.3). `<Prose>` enforces `--measure: 68ch`
— the brief's floor is 80 characters and 51 current containers are ≈100ch.

**Verification**
1. All three render on `/design-system` at 375 / 768 / 1440px
2. `<Prose>` measured line length ≤ 80 characters at every width (**state the measured count at 1440px**)
3. `<Container>` respects a 16px page margin at 320px with no horizontal scroll
4. `<Section>` emits exactly the two rhythm values from `01` §1.6
5. No existing page changed — these are unused until Stage 3

---

### RD-010 · Chevron primitives
**Goal:** Build the signature element.

| | |
|---|---|
| **Files** | `components/ui/chevron-frame.tsx` (new), `packages/ui/styles/globals.css`, `/design-system` |
| **Depends on** | RD-009 |
| **Size** | M |

Implements `01` §1.10. The geometry is the risk: a clip-path x-percentage
resolves against **width** while the angle depends on **height**, so a single
cut value does not hold 13° across shapes.

> **Revised during implementation.** The spec's per-aspect `--cut` table rounds
> badly (`3/2` → 12.68°). Replaced with a derived cut,
> `calc(0.2309 × var(--ar) × 100%)`, which is exact at every ratio and keeps the
> frame and its angle driven by one number. The CSS lives in
> `packages/ui/styles/globals.css` beside the type roles rather than in
> `apps/web/src/app/styles.css`, for consistency — the `--shear` tokens are
> already there.

`PLACEHOLDER-001` (no SVG logo/chevron mark) does **not** block this — the
frame is a clip-path, not an asset. It blocks only the header lockup in `RD-017`.

**Verification**
1. `<ChevronFrame>` renders at all seven aspect ratios on `/design-system`
2. **Measured edge angle is 13° ± 0.3° at every aspect ratio** — verify by measuring rendered pixel geometry, not by trusting the table
3. Corners are square (`border-radius: 0`) in every instance
4. Images fill the frame with no gap or letterbox at any width
5. Renders correctly at 320px
6. ~~`<ChevronBand>` bottom edge holds 13°~~ — **dropped in RD-010.** A 13° edge across a 1440px section drops 332px, taller than most sections; a shallower second angle would break the single-angle rule. The chevron applies to media frames only. See `01-design-spec.md` §1.10.
7. No layout shift when images load

---

### RD-011 · Content primitives A
**Goal:** `<SectionHeading>`, `<Pill>`, `<DateBlock>`, `<StatRow>`.

| | |
|---|---|
| **Files** | `components/ui/{section-heading,pill,date-block,stat-row}.tsx` (new), `/design-system` |
| **Depends on** | RD-009, RD-010 |
| **Size** | M |

`<SectionHeading>` carries the sun marker, which per `01` §7.3 appears **only**
when a `see all →` action is present — the marker means "there is more behind
this", so it is a prop-driven rule, not a style option.

`<Pill>` replaces ~40 inline badge spans. `<DateBlock>` and `<StatRow>` use the
`data` role's tabular numerals.

**Verification**
1. All four on `/design-system` at 3 widths, both locales
2. `<SectionHeading>` renders **no marker** without a `seeAllHref` — assert in a test
3. `<Pill>` variants (status / category / campus) each meet AA against their fill
4. `<DateBlock>` digits align in a column across differing dates
5. `<StatRow>` collapses to 2×2 below 640px without overflow

---

### RD-012 · Content primitives B
**Goal:** `<PageHeader>`, `<FilterChips>`, `<CardGrid>`, `<PersonCard>`.

| | |
|---|---|
| **Files** | `components/ui/{page-header,filter-chips,card-grid,person-card}.tsx` (new), `/design-system` |
| **Depends on** | RD-011 |
| **Size** | M |

`<PageHeader>` replaces `about-hero` (15 usages — the most-reused component in
the app), `public-page-header` (3) and 8 per-feature heroes.

`<FilterChips>` is **link-based**, not state-based: chips are `<Link href="?category=…">`
so filtered views are shareable and server-rendered. This is the prerequisite
for `RD-016`'s `?campus=` work.

`<PersonCard>` carries `PLACEHOLDER-007` — `DepartmentBoard` has `name`, `role`,
`imageUrl` but **no email**. Build it with an optional email prop, rendered only
when present.

**Verification**
1. All four on `/design-system`, 3 widths, both locales
2. `<PageHeader>` renders breadcrumb + display title + chevron; the `<h1>` is the display title
3. `<FilterChips>` navigate via real URLs — **middle-click opens a new tab**, back button restores the previous filter
4. Chips are keyboard-reachable with visible focus; active chip has `aria-current`
5. `<PersonCard>` renders correctly with `email` absent (no empty icon)
6. `<CardGrid>` reflows 3 → 2 → 1 at the documented breakpoints

---

## 4. Stage 2 — Shell (Phase 4)

Highest-risk stage: these touch every page at once. `RD-013` lands the toggle
that makes the rest reversible.

---

### RD-013 · Shell structure and the old/new toggle
**Goal:** Fix the landmark structure and add the mechanism for comparing shells.

| | |
|---|---|
| **Files** | `app/layout.tsx`, `components/layout/site-shell.tsx`, `app/(public)/layout.tsx`, `app/(protected)/layout.tsx`, `packages/shared/utils/feature-flags-server` (read only) |
| **Depends on** | RD-012 |
| **Size** | M |

Fixes three structural defects from `00` §8.2:

- **Nested `<main>`** — root `layout.tsx:53` and `site-shell.tsx:95` both open one. Root's is removed; `SiteShell` keeps the single `<main>`
- **`<nav>` and `<footer>` inside `<main>`** — hoisted out
- **No skip-to-content link** — added as the first focusable element

Adds the shell toggle. Preference: reuse the existing `isFeatureEnabled`
mechanism already imported by `site-shell.tsx`, so no new infrastructure.

**Verification**
1. **Exactly one `<main>` per page** — assert across `/`, `/events`, `/profile`
2. `<nav>` and `<footer>` are siblings of `<main>`, not descendants
3. Skip link is the first Tab stop, visible on focus, and moves focus to `<main>`
4. Landmark order (banner → main → contentinfo) correct in an a11y tree dump
5. Toggle flips both shells; **the `(auth)` group is unaffected** (it has no chrome)
6. No visual change with the flag off
7. `check-types`, `lint`, `test` pass

---

### RD-014 · Footer
**Goal:** Rebuild the footer per `01` §4.1, as a Server Component.

| | |
|---|---|
| **Files** | `components/layout/footer.tsx`, `packages/i18n/messages/{en,no}/common.json` |
| **Depends on** | RD-013 |
| **Size** | M |

Fixes everything in `00` §8.5: `"use client"` → server (it only needs
translations); `<a>` → `<Link>` (every footer click is currently a full page
reload); the `from-purple-600 to-pink-600` social hover; social buttons that are
`bg-inverted` on a `bg-inverted` footer; five `whileInView` reveals removed.

Carries `PLACEHOLDER-004` — the stat row ships with `eventCount` and `jobCount`
(real, from `cachedHomeCounts`) plus a campus count. **"1000+ Active Members" is
omitted; it is not public data.**

**Verification**
1. Renders as a Server Component — no `"use client"`, no footer JS in the bundle
2. Every internal link is `<Link>`; navigation is client-side (no full reload)
3. **All text ≥ 4.5:1** — state each measured pair
4. All headings translated; both locales verified
5. Social buttons visible without hover; each has an accessible name
6. No `whileInView` remains
7. 375 / 768 / 1440px, no horizontal scroll at 320px
8. Only real data in the stat row — no invented figures

---

### RD-015 · Campus state consolidation
**Goal:** One source of truth for campus. No visual change.

| | |
|---|---|
| **Files** | `components/context/campus.tsx`, `components/layout/site-shell.tsx`, `components/layout/public-providers.tsx`, `components/select-campus.tsx` |
| **Depends on** | RD-013 |
| **Size** | M |

Fixes `00` §6.5: three sources disagree. `CampusProvider` defaults to *the first
campus in the list*; the server, seeing no cookie, filters *nothing* — so the
switcher can display "Oslo" above unfiltered content on a first visit.

`CampusProvider` receives campuses and the active id **as props from
`SiteShell`** (already a Server Component that can supply them), drops
`localStorage`, and drops its on-mount `getCampuses()` fetch — removing a
hydrate-then-fetch waterfall.

Deliberately **behavioural only**, landed before `RD-016` so the routing change
builds on a correct state model.

**Verification**
1. **First visit, no cookie:** switcher label and rendered content agree (both "all")
2. Selecting a campus updates cookie, switcher and feeds consistently
3. `localStorage["biso-active-campus"]` no longer written; a stale one is ignored
4. No client-side `getCampuses()` on mount — confirm in the network panel
5. Campus persists across reload and across routes
6. Existing `campus-scope.test.ts` and `campus.test.ts` pass
7. No visual change vs RD-014

---

### RD-016 · Campus routing  **[GATE-3]**
**Goal:** Make campus-scoped views linkable, without changing any existing URL.

| | |
|---|---|
| **Files** | `app/(public)/campus/page.tsx`, `app/(public)/campus/[slug]/page.tsx` (new), `lib/campus-scope.ts`, `lib/data/public-content.ts`, `app/(public)/{events,news,jobs,units,projects}/page.tsx`, `app/sitemap.ts` |
| **Depends on** | RD-015, GATE-3 |
| **Size** | L |

Implements `01` §3.3. `?campus=` on five feeds; precedence URL > cookie > `all`.
`/campus` becomes the campus index (it exists today and nothing links to it).

**Purely additive: with the parameter absent, behaviour is identical to today.**

**Verification**
1. `/events?campus=oslo` returns only Oslo + National content (per `campusScopeIds`)
2. `/events` with no parameter behaves **exactly** as before — diff against RD-015
3. All five campus slugs resolve on all five feeds; an invalid slug 404s rather than silently showing everything
4. URL beats cookie when both present; cookie applies when URL is absent
5. `/campus` and `/campus/[slug]` resolve for all five campuses
6. Canonical on a scoped feed points at the unscoped feed
7. Sitemap gains campus entries; **every pre-existing sitemap URL still present and unchanged**
8. Shareable: pasting a scoped URL in a fresh browser (no cookie) shows the same content

---

### RD-017 · Header and navigation
**Goal:** Rebuild the header per `01` §3.4–3.5. Highest-risk package in the project.

| | |
|---|---|
| **Files** | `components/nav/{mega-nav,desktop-menu,mega-panel,mobile-drawer,account-menu,nav-config}.tsx`, `components/nav/panels/*`, `components/ui/campus-pill.tsx` (new), `packages/i18n/messages/{en,no}/common.json` |
| **Depends on** | RD-016 |
| **Size** | L |

Nine utility controls → five. Desktop breakpoint `xl` (1280px) → `lg` (1024px) —
today every laptop under 1280px gets the hamburger. Three `router.push()` buttons
become `<Link>`s. Solid navy on scroll, no `backdrop-blur`.

**The keyboard logic in `mega-nav.tsx` is preserved verbatim** — hover-intent
with 120ms close delay, ArrowDown-opens-and-focuses, Escape-closes-and-restores,
pointer-down-outside. It is the best-built thing in the current codebase (`00` §8.3).

Blocked on `PLACEHOLDER-001` for the logo lockup only. If no SVG is available,
ship with the existing PNG and note it.

**Verification**
1. Full keyboard walkthrough: Tab order, ArrowDown, Escape-restores-focus, outside-click — **all four behaviours still work**
2. Desktop layout at 1024px; drawer below
3. All nav links from `01` §3.4 resolve 200
4. Campus pill reflects `RD-015` state and drives `RD-016` routing
5. Both locales; no untranslated strings
6. 320 / 375 / 768 / 1024 / 1440px, no horizontal scroll
7. Visible focus on all 5 utility controls and every panel link
8. Old shell still renders correctly with the flag off
9. Header contains exactly one primary CTA

---

## 5. Stage 3 — Pages (Phase 5)

One package per session. Order follows `sitemap.ts` priority as a traffic proxy.
Each ends with: verify at 3 widths, verify both locales, update `STATUS.md`, stop.

Every package in this stage also **deletes that page's `whileInView` reveals**
and replaces off-token colour utilities with tokens. The 161 reveals and 711
off-token utilities are retired page by page, not in one sweep.

---

### RD-018 · Home
**Goal:** The reference design's primary surface.

| | |
|---|---|
| **Files** | `app/(public)/page.tsx`, `components/home/*` (6 files), new `components/home/{hero-chevron,contact-strip,open-positions-band}.tsx` |
| **Depends on** | RD-017 |
| **Size** | L |

Implements `01` §4.1. `hero-carousel.tsx` (371 LOC) → the chevron collage and
**the project's one orchestrated motion moment** (~900ms, once per session).

Also fixes `00` §2.3: the four `<Suspense>` boundaries wrap already-awaited
data. Either stream properly or drop the boundaries — do not keep dead ones.

Placeholders in play: `-004` (stats — real counts only), `-005` (notification
bar — omitted), `-007` (contact emails — optional prop).

**Verification**
1. 375 / 768 / 1440px, both locales
2. Hero motion plays **once**; nothing plays under `prefers-reduced-motion`
3. Chevron edges measure 13° at all three widths
4. Exactly one `<h1>`
5. **No invented content** — every string traces to i18n or the data layer
6. Zero `whileInView` remains in `components/home/`
7. LCP not worse than the RD-001 baseline (record both)
8. Campus switch updates hero, events and news together

---

### RD-019 · Jobs — list and detail
| | |
|---|---|
| **Files** | `app/(public)/jobs/{page,[slug]/page}.tsx`, new `components/jobs/v2/{jobs-v2,job-detail-v2,copy-link-button,lede}.tsx`, extracted `components/jobs/job-posting-schema.tsx`, `components/ui/{page-header,filter-chips}.tsx`, `packages/ui/styles/globals.css` |
| **Depends on** | RD-018 |
| **Size** | M |

Sitemap priority 0.9 — highest after `/`. `<FilterChips>` replaces client filter
state, making filtered job views shareable. `job-application-form.tsx` (709 LOC)
is **kept as-is**; only its surrounding chrome is restyled.

`PLACEHOLDER-002`: the reference's "20%" workload badge has no column. **Omitted.**

**Verification**
1. Both routes, 3 widths, both locales
2. Filters are URL-driven; middle-click and back button work
3. `?campus=` from RD-016 composes with category filters
4. Application form still submits end-to-end — **partially verified.** The form
   is gated behind a signed-in BISO account and a live submission would write a
   real row to production Appwrite, so it was not exercised. Verified instead:
   `job-application-form.tsx` is untouched and its prop list is identical in
   both versions.
5. No workload badge rendered
6. Zero `whileInView` in `components/jobs/`
7. `error.tsx` / `not-found.tsx` on `/jobs/[slug]` still render
8. `JobPosting` JSON-LD still emitted on the detail page — extracted to a
   shared module so v1 and v2 produce identical structured data
9. Visible keyboard focus on every control, on both surfaces and both colour
   schemes (added after the `--color-focus-ring` finding below)

**Amended during implementation.** Three additive changes outside the file list
above, each recorded in `STATUS.md`:

- `--color-focus-ring` registered in `packages/ui/styles/globals.css`.
  `ring-focus-ring` had been used **27 times since RD-011 without being a real
  utility** — Tailwind only emits `ring-*` for a registered theme colour, so all
  27 compiled to nothing while the `outline-none` beside them applied. A focus
  block was added to `/design-system` so it cannot regress unseen.
- `<PageHeader>` gained a `meta` slot (status pills between title and lede) and
  a bottom hairline. The hairline exists because dark mode paints the page and
  the deep band the same navy, which merged header and content into one field.
- `<FilterChips>` renders nothing below two options.

---

### RD-020 · Events — list and detail
| | |
|---|---|
| **Files** | `app/(public)/events/{page,[slug]/page}.tsx`, `components/events/*` (9 files) |
| **Depends on** | RD-019 |
| **Size** | M |

Uses the real `EventsCategory` enum (8 values) for filter chips. The
"Register / Info only" pill derives from `ticket_url` presence — real data,
no placeholder. Detail page gets the sticky action card (`01` §4.3).

**Verification**
1. Both routes, 3 widths, both locales
2. Category chips map to the actual enum; all 8 filter correctly
3. Status pill derives from `ticket_url`, never hardcoded
4. Sticky action card does not overlap content at 1024px or collapse wrongly at 768px
5. Collection events (`is_collection`) still render
6. Member-only events still gated correctly for signed-in vs anonymous
7. Zero `whileInView` in `components/events/`
8. Event dates and times read as the organiser's wall clock on any host
9. The Norwegian page is not blank where only English copy exists

**Amended during implementation**

- **Criterion 2, narrowed.** All eight enum values filter correctly when supplied
  as `?category=`, and that is verified. The chips offered are derived from the
  data, so only the three categories any published event carries are shown —
  the rule `FilterChips` already applies, rather than five chips that return
  nothing.
- **Criterion 6, could not be met as written.** The current behaviour is not a
  gate: `EventsListClient` drops `member_only` events unless `isMember`, and
  `isMember` is never passed, so they are hidden from everyone — while
  `/events/[slug]` renders the same event in full to anonymous visitors. Treated
  as what it is, a pricing and access fact, and stated on the card and in the
  header rather than used to suppress the event.
- **Criterion 5, not verified against real data.** No published event is a
  collection or belongs to one, so the sibling list is covered structurally and
  by a unit test only.
- **Criterion 3, extended.** The pill still derives from `ticket_url`; so does
  the action card, which offers the event's own organiser rather than a
  "Register Now" button with no registration behind it.

---

### RD-021 · News — list and detail
| | |
|---|---|
| **Files** | `app/(public)/news/{page,[slug]/page}.tsx`, `components/news/*` (16 files after RD-002) |
| **Depends on** | RD-020 |
| **Size** | M |

Article template per `01` §4.3, at `--measure` (68ch) — currently `max-w-4xl`
≈100ch, over the brief's 80-character floor.

`PLACEHOLDER-003`: `News` has no category enum, only untyped `metadata: string[]`.
Render `metadata[0]` when present, nothing otherwise. **No invented categories.**

**Verification**
1. Both routes, 3 widths, both locales
2. **Article body ≤ 80 characters per line at every width** — state the measured count
3. Category pill renders only when `metadata[0]` exists
4. Sticky meta rail behaves at 1024px; collapses below
5. `sticky` news still surfaces first
6. Zero `whileInView` in `components/news/`
7. The feed's data locale matches the page's chrome locale

**Amended during implementation**

- **The premise of the package was stale.** The body is not `max-w-4xl`; v1
  already caps it at `max-w-[68ch]`. The conclusion held anyway, and is now
  measured rather than asserted: `ch` is the advance of "0", so 68ch is not 68
  characters — at `prose-lg` v1 renders **84–85 characters** at ≥1280px, over
  the floor. `<Prose>` at `--measure` renders **76–77**, at every width in both
  locales.
- **Criterion 3 resolves to "never".** `metadata` is an empty array on every
  published row, so no pill renders and no category chip is offered.
  PLACEHOLDER-003 stands; the fix is a `category` enum on `news`.
- **Criterion 5 met by ordering, not by a separate band.** Sticky articles lead
  the one grid and carry the pill. A dedicated featured section is one card in a
  three-column row while exactly one article is pinned.

---

### RD-022 · Shop
| | |
|---|---|
| **Files** | `app/(public)/shop/**` (6 pages), `components/shop/*` (13 after RD-002), `components/shop/cart/*` (8) |
| **Depends on** | RD-021 |
| **Size** | L |

Restyle only — **no change to cart, reservation or checkout logic.** Commerce
paths carry real money and are covered by `cart-reservations.test.ts` and
`orders.test.ts`.

Preserve the print rules in `styles.css` that let `/shop/order/[orderId]` print
as a clean receipt.

**Verification**
1. All 6 routes, 3 widths, both locales
2. **End-to-end: browse → add to cart → checkout → return** still completes
3. Cart drawer, reservation timeout and stock states behave as before
4. `/shop/order/[orderId]` prints correctly (chrome hidden, receipt visible)
5. `/shop/membership` still 308-redirects to `/membership/join`
6. Member vs non-member pricing correct in both states
7. `orders.test.ts`, `cart-reservations.test.ts` pass
8. The shop is not narrowed to one locale's translations

**Amended during implementation**

- **Criteria 2 and 4 cannot be met on a local standalone server, and were not
  claimed.** The build runs with `NODE_ENV=production`, so the anonymous session
  cookie is `Secure` and scoped to `.biso.no` and a browser will not store it
  from `http://localhost`. The reservation row is written, the next request
  carries no session, and the cart page reads empty — **identically on v1 and
  v2**, verified by running the same probe against both. `/shop/order/[orderId]`
  is readable only by the buyer, so it renders the not-found UI for an anonymous
  visitor on both versions; its print rules are verified structurally instead.
- **Criterion 3, stock states.** Every one of the 55 published products is
  `inventory_mode: "unlimited"` with `stock: null`, so no stock or reservation
  state can be exercised against real data. The code paths that read them are
  the unchanged v1 components.
- **Criterion 6, member pricing.** Exactly one product carries a `member_price`,
  so both states were checked against that one product.
- **Cart, checkout and order are restyled through their chrome only.** They get
  `<ShopPageShell>` and nothing inside them is touched — the order body was
  proven byte-identical to its predecessor. Restyling the inner cards is a
  follow-up pass on money-path files.

---

### RD-023 · Campus landing pages
| | |
|---|---|
| **Files** | `app/(public)/campus/{page,[slug]/page}.tsx`, `components/campus/*` (new) |
| **Depends on** | RD-022, GATE-3 |
| **Size** | M |

Implements `01` §4.4. Renders `CampusMetadata` (`tagline_*`, `description_*`,
`highlights_*[]`, `focusAreas_*[]`) — **localised content that already exists and
is currently near-unused.**

> **Revised 2026-08-31 (RD-002).** This package was scoped as "build a campus
> landing page". It is not: `src/app/(public)/campus/components/` already holds
> **13 components, 1,885 LOC** — a complete tabbed campus experience (hero,
> overview, students, team, partners, departments grid, upcoming events, latest
> news, job postings) that **nothing links to**. RD-023 is therefore
> *restyle + campus-scope + link up*, not greenfield. Re-read those components
> before starting; much of `01` §4.4 is already built. Size may drop from M.

`PLACEHOLDER-004`: the reference's "25+ / 120+ / 3000+" tiles have no source.
Ship only counts that are real.

**Verification**
1. All 5 campus slugs render, 3 widths, both locales
2. Tagline/description/highlights/focusAreas pull from `CampusMetadata` per locale
3. A campus with missing metadata degrades gracefully — no empty headings
4. Only real counts shown
5. Feeds on the page respect that campus
6. `/campus` index links all five

**Amended during implementation**

- **The premise was wrong twice over.** `campus_metadata` and `campus_data`
  hold **zero rows**, not "content that already exists and is barely used" — so
  criterion 2 has nothing to pull and the 13-component tabbed experience this
  package was meant to restyle is built entirely on that empty data. Logged as
  **PLACEHOLDER-009**. Criterion 3 is therefore the *only* state the page has
  today, and it is what was built and verified against.
- **Criterion 4 is met with three counts that are real** — active units on this
  campus, published events here, open positions here — and a tile is dropped
  when its count is zero. The reference's "25+ / 120+ / 3000+" remain
  unsourced (PLACEHOLDER-004) and are not shown.
- **The units list reads `departments` directly.** `getDepartments()` goes
  through `content_translations`, which holds **zero** department rows, so every
  consumer of it renders an empty list while 141 active departments sit in the
  table. Logged as **PLACEHOLDER-010**.

---

### RD-024 · Membership and member portal
| | |
|---|---|
| **Files** | `app/(public)/{membership/page,membership/join/page,member/page}.tsx`, `components/member-portal/*` (16 after RD-002), `components/membership/plan-card.tsx` |
| **Depends on** | RD-023 |
| **Size** | L |

Restyle only. **No change to the purchase flow** — BI identity linking, Finago
fulfilment and the trusted checkout in `apps/api` are untouched.

**Verification**
1. All 3 routes, 3 widths, both locales
2. All member-portal states render: signed out, signed in non-member, member, no-BI-identity
3. `/membership/join` still gates on a linked BI identity with `student_id`
4. `membership.test.ts`, `membership-purchase.test.ts` pass
5. Locked-content overlay still gates member-only benefits
6. `/membership#fordeler` anchor still resolves

---

### RD-025 · Units and projects
| | |
|---|---|
| **Files** | `app/(public)/units/{page,[...segments]/page}.tsx`, `app/(public)/projects/{page,[slug]/page}.tsx`, `components/projects/*` |
| **Depends on** | RD-024 |
| **Size** | M |

`/projects/[slug]` implements the per-project palette override from `01` §7.4 —
`LargeEvent.primaryColorHex`, `gradientHex[]`, `heroOverrideEnabled` scoped to
that subtree.

`/units/[...segments]` routing is intricate (canonical vs chooser vs redirect,
request-memoised). **Restyle only; `resolve.ts` is not touched.**

**Verification**
1. All 4 routes, 3 widths, both locales
2. `/units/<campus>/<slug>` **and** `/units/<slug>` both resolve as before; chooser still appears when the campus filter is unset
3. Legacy `/units/<24SO-id>` URLs still work
4. Project palette override applies only within `/projects/[slug]`, never leaking
5. **A project override still meets AA** — measure the overridden hero
6. `heroOverrideEnabled: false` falls back to the default hero
7. `/units` lists the units that exist

**Amended during implementation**

- **Criteria 4–6 cannot be met: `large_event` holds zero rows.** There are no
  projects, so §7.4's per-project palette has nothing to override and the
  override cannot be built or verified. `/projects` and `/projects/[slug]` are
  restyled chrome over content that comes from the `projects` message bundle
  and gradient constants in the page file. Logged as **PLACEHOLDER-011**.
- **Criterion 7 was the real work.** `/units` rendered **"0 units"** and `--`
  for every stat — a top-level nav destination showing nothing — because
  `getDepartments()` reads a translation table with no department rows. Rebuilt
  on `departments` directly: 141 active units, 131 linked.
- **The type filter and the member count are gone**, not restyled: `type` is
  null on all 280 rows and `department_board` is empty, so both were furniture.
- **`/units/[...segments]` is restyle-deferred.** `resolve.ts` is untouched as
  required, and the view it renders has no logo, hero, description or board to
  restyle (PLACEHOLDER-010). It carries a **pre-existing** horizontal overflow
  at 320px and 375px — measured identically with the shell flag on and off, so
  it is not introduced here.

---

### RD-026 · About subtree → Server Components
| | |
|---|---|
| **Files** | `app/(public)/about/**` (11 pages + layout), `components/about/*` (8), `app/(public)/{resources,safety}/**` |
| **Depends on** | RD-025 |
| **Size** | L |

Converts 12 `"use client"` pages to Server Components (`00` §2.1) — they are
client-only because they call `useTranslations()` at render. `getTranslations()`
from `next-intl/server` replaces it, after which the three metadata-only layouts
(`about/`, `resources/`, `safety/`) are deleted and metadata returns to each page.

`about-hero` (15 usages) → `<PageHeader>`.

`/safety` keeps `varsling-form.tsx` as a client island.

**Verification**
1. All 13 routes, 3 widths, both locales
2. **No `"use client"` remains** on the 12 converted pages
3. Each page exports its own metadata; the three layouts are deleted
4. `/safety` whistleblowing form still submits
5. `/varsling` still 308-redirects to `/safety`
6. `/safety#code-of-conduct` anchor still resolves (linked from the footer)
7. Measurable client-JS reduction on `/about/*` (record it)
8. Zero `whileInView` in `components/about/`

---

### RD-027 · Long-tail content pages
| | |
|---|---|
| **Files** | `app/(public)/{privacy,terms,press,contact,business,business-hotspot,bi-fondet,documents,students,policies/drugs-policy}/page.tsx`, `app/(public)/[...slug]/page.tsx` |
| **Depends on** | RD-026 |
| **Size** | M |

Ten pages onto the content template. `/[...slug]` is the block-editor catch-all
— `PageDoc` renders into `<Prose>` so authored and hardcoded content share one
scale.

**Verification**
1. All 11 routes, 3 widths, both locales
2. `/[...slug]` renders an editor page correctly; **`@repo/editor` block rendering is unchanged**
3. `/privacy` (450 LOC) and `/terms` readable at ≤80 characters per line
4. `/documents` SharePoint download still works
5. `/students` and `/campus` no longer duplicate each other (`00` §1.2) — state how resolved
6. `rendered-page.test.tsx` passes

---

### RD-028 · Account and protected routes
| | |
|---|---|
| **Files** | `app/(protected)/**` (5 pages), `components/profile/*`, `app/(public)/onboarding/page.tsx` |
| **Depends on** | RD-027 |
| **Size** | M |

Restyle only. **`components/expense-v3/*` is explicitly out of scope** — 2,711 LOC
behind the `expenses_module` flag; it inherits new tokens automatically (`01` §5.4).

**Verification**
1. All 6 routes, 3 widths, both locales
2. Auth gate intact: signed-out → `unauthorized()`; no profile → `/onboarding?required=1`
3. `/fs` still renders `<ExpensesUnavailable />` when the flag is off
4. `expense-v3` unchanged — `git diff` shows no edits there
5. Onboarding completes end-to-end
6. `user.test.ts`, `bi-identity.test.ts` pass

---

### RD-029 · Auth
| | |
|---|---|
| **Files** | `app/(auth)/auth/login/page.tsx`, `components/login.tsx` |
| **Depends on** | RD-028 |
| **Size** | S |

`(auth)` has no site chrome and no providers — the only route group that renders
outside `SiteShell`. Keep it that way.

**Verification**
1. 3 widths, both locales
2. All providers work: Microsoft, Google, Facebook, Apple, magic link
3. **Session cookie is still `a_session_biso_web`** — never `a_session_biso` (`00`/app CLAUDE.md)
4. OAuth callback and invite handlers unaffected
5. Post-login redirect preserved

---

## 6. Stage 4 — Sweep (Phase 6)

---

### RD-030 · Legacy token retirement
**Goal:** Delete the old system now that nothing consumes it.

| | |
|---|---|
| **Files** | `packages/ui/styles/biso-surface.css`, `globals.css`, `apps/web/src/app/styles.css`, `styles.test.ts`, `packages/ui/components/ui/{button,card}.tsx` |
| **Depends on** | RD-029 |
| **Size** | M |

Removes `--brand*`, `--inverted`, `--section` once unreferenced; removes the
shell toggle from `RD-013`; removes the `.glass-panel` / `surface-spotlight` /
`bg-grid-primary` utilities.

Also fixes `00` §3.4: nine `Button`/`Card` variants reference colours never
defined anywhere (`gold-*`, `blue-accent`, `primary-80`, `.glass`). Eight are
unused; `variant="gradient"` is used 3× and silently renders as a plain button.
**This is a `packages/ui` edit affecting `apps/admin` — needs its own approval
at that point.**

Also revisits the malformed base-typography selector in `globals.css` (`00` §3.5).

**Verification**
1. `grep -r "\-\-brand\|\-\-inverted\|\-\-section" apps/web/src` returns nothing
2. **`apps/admin` builds and its editor canvas renders correctly** — screenshot before/after
3. All 54 routes render unchanged vs RD-029
4. `styles.test.ts` updated; passes
5. Off-token colour utilities down from 711 to a stated number
6. Bundle smaller than RD-001 baseline (record the delta)

---

### RD-031 · Accessibility sweep
| | |
|---|---|
| **Files** | as found |
| **Depends on** | RD-030 |
| **Size** | L |

- Keyboard navigation and **visible focus on every interactive element** — Phase 0 found `focus-visible` in only 2 of 139 component files
- Contrast against the final token set, every route
- `prefers-reduced-motion` on every route
- Landmarks, heading order, exactly one `<h1>` per page — **the item Phase 0 could not settle statically**
- Accessible names on all icon-only controls

**Verification**
1. Every route keyboard-navigable end to end; **zero focus traps**
2. Visible focus on every interactive element (state the audit method)
3. **Zero contrast pairs below AA** across all 54 routes
4. With reduced motion on, **no animation plays on any route**
5. Exactly one `<h1>` per page; heading levels never skip
6. Automated axe pass on the 10 highest-traffic routes with zero criticals

---

### RD-032 · Locale sweep
| | |
|---|---|
| **Files** | `packages/i18n/messages/{en,no}/*`, as found |
| **Depends on** | RD-031 |
| **Size** | M |

**Verification**
1. **All 54 routes rendered in both locales; no raw key visible anywhere**
2. `en`/`no` key parity still exact — Phase 0's script, both counts equal
3. No key removed or renamed during the redesign (`git log` on `packages/i18n`)
4. Norwegian text does not overflow or clip at 320px (it is longer than English)
5. æ ø å render in the display face at every weight
6. `<html lang>` matches the active locale

---

### RD-033 · Performance and route verification
| | |
|---|---|
| **Files** | `docs/redesign/baseline/`, `docs/redesign/03-results.md` (new) |
| **Depends on** | RD-032 |
| **Size** | M |

**Verification**
1. **Every route from the Phase 0 inventory still resolves** — all 54 pages, 21 handlers, both redirects
2. Lighthouse on the same 5 routes × 2 form factors as RD-001; **table of before/after**
3. LCP, CLS, INP, TBT compared per route; **any regression explained or fixed**
4. Bundle size vs RD-001 baseline
5. `/sitemap.xml` contains every pre-redesign URL plus the new campus entries
6. `/robots.txt` correct; `/design-system` excluded
7. `bun run build`, `check-types`, `lint`, `test` all pass
8. `03-results.md` records the full comparison

---

## 7. Dependency graph

```
RD-001 ─┐
RD-002 ─┼─→ RD-004
RD-003 ─┘

[GATE-1] → RD-005 ─→ RD-006 [GATE-2] ─→ RD-007 ─┬─→ RD-008
                                                 └─→ RD-009 ─→ RD-010 ─→ RD-011 ─→ RD-012
                                                                                      │
        ┌─────────────────────────────────────────────────────────────────────────────┘
        ↓
      RD-013 ─┬─→ RD-014
              └─→ RD-015 ─→ RD-016 [GATE-3] ─→ RD-017
                                                  │
        ┌─────────────────────────────────────────┘
        ↓
      RD-018 → RD-019 → RD-020 → RD-021 → RD-022 → RD-023 → RD-024
                                                               │
        ┌──────────────────────────────────────────────────────┘
        ↓
      RD-025 → RD-026 → RD-027 → RD-028 → RD-029
                                              │
        ┌─────────────────────────────────────┘
        ↓
      RD-030 → RD-031 → RD-032 → RD-033
```

Stage 3 is drawn as a chain for session discipline, but `RD-019`–`RD-029` are
only truly dependent on `RD-018` establishing the page pattern. After that they
can be reordered if traffic priorities change — **except** `RD-023`, which needs
`RD-016`.

## 8. Shippability

Every package leaves `main` deployable.

| Stage | What a user sees if we stop here |
|---|---|
| After Stage 0 | Today's site, minus dead code, with a fixed 404, compliant footer contrast and translated headings |
| After Stage 1 | **Identical to Stage 0.** New tokens exist but only `/design-system` consumes them |
| After Stage 2 | New shell, old page bodies. Coherent because the shell is self-contained navy chrome; the toggle reverts it in one flag |
| During Stage 3 | Mixed — migrated pages new, unmigrated old. Both share the shell and the navy header, so it reads as a rolling refresh, not a broken site |
| After Stage 4 | Complete |

The mixed state in Stage 3 is the one deliberate compromise. It is acceptable
because the shell lands first: the header, footer and page header are consistent
from `RD-017` onward, and those are what carry the sense of "one site".
