# Phase 0 — Current-state audit: `apps/web`

**Date:** 2026-08-31
**Commit:** `c82f70d3` (branch `main`)
**Scope:** `apps/web` only. `packages/*` inspected read-only, and flagged where it constrains the redesign.
**Method:** static analysis of the working tree plus the production build output in `apps/web/.next` (BUILD_ID `q11pV6TJJNveI1epXoobj`, built 2026-08-27). No code changed.

**Size in scope:** ~32,000 LOC — 20,981 in `src/components`, 7,125 in pages and layouts, 3,877 in `src/lib`.

---

## 1. Route inventory

54 pages, 21 route handlers, 8 layouts, 11 dynamic segments.

### 1.1 Rendering strategy — how it is actually decided

No page in the app exports `dynamic`, `revalidate`, `fetchCache`, or `runtime`. Rendering is governed entirely by three things:

| Mechanism | Where | Effect |
|---|---|---|
| `cacheComponents: true` | `next.config.ts` | Next 16 component-level caching; build emits prerendered shells where a route can produce one |
| `partialPrefetching: true` | `next.config.ts` | Partial prefetch of route shells |
| `export const instant = false` | root `layout.tsx`, `(public)/layout.tsx`, `(protected)/layout.tsx` | Opts those segments out of instant-navigation validation because they read cookies at the top level |

> **Corrected 2026-08-31 during RD-001.** This section originally reported "47 prerendered entries", read from a stale `.next/prerender-manifest.json`. A clean build's own classification is the authority, and it says:
>
> | Class | Count |
> |---|---|
> | `ƒ` Dynamic — server-rendered on demand | **65** |
> | `◐` Partial-prerender shell (dynamic segments) | 11 |
> | `○` Static | **2** — `/robots.txt`, `/sitemap.xml` |
>
> **Only two routes in the app are static.** The manifest lists PPR *shells*, which are not statically served pages. Evidence: `docs/redesign/baseline/build-output.txt`.

Every `(public)` page awaits a cookie-dependent helper (`getUserPreferences()`, `getLocale()`, or `cookies()`) before it renders, and `SiteShell` reads the session cookie on every request — so no page can produce a static shell. The three `instant = false` exports exist precisely because of this; their inline comments say so and name the follow-up (move cookie reads behind Suspense boundaries per route). Only `/sitemap.xml` carries a revalidate window (3600s / expire 86400s).

A measured consequence, found in RD-001: because the PPR shell is flushed with a **200** before the dynamic part runs, `redirect()` and `unauthorized()` reached inside that dynamic part cannot set the HTTP status. `/varsling` and `/shop/membership` return **200 + a client-side redirect instead of 308**, and the four protected routes return **200 instead of 401**. Both redirects exist to preserve external inbound links. See `baseline/README.md` FINDING-A.

> **Correction to `apps/web/CLAUDE.md`:** that file states the root layout sets `dynamic = "force-dynamic"` and that `next.config.ts` sets `typescript: { ignoreBuildErrors: true }`. Neither is true at this commit. The root layout uses `export const instant = false`, and there is no `typescript` block in `next.config.ts`. Worth fixing so the next reader is not misled.

### 1.2 `(public)` — 48 pages

| Route | File | Type | Prerendered shell | Notes |
|---|---|---|---|---|
| `/` | `(public)/page.tsx` | static | yes | Homepage. 6 sections, all data awaited up front |
| `/about` | `(public)/about/page.tsx` | static | yes | `"use client"`, 328 lines |
| `/about/academics-contact` | `…/academics-contact/page.tsx` | static | yes | `"use client"`. **Orphan — nothing links to it** |
| `/about/alumni` | `…/alumni/page.tsx` | static | yes | `"use client"`. **Contains a link to `/alumni`, which does not exist** |
| `/about/bylaws` | `…/bylaws/page.tsx` | static | yes | `"use client"` |
| `/about/history` | `…/history/page.tsx` | static | yes | `"use client"` |
| `/about/operations` | `…/operations/page.tsx` | static | yes | `"use client"` |
| `/about/politics` | `…/politics/page.tsx` | static | yes | `"use client"` |
| `/about/saih` | `…/saih/page.tsx` | static | yes | `"use client"` |
| `/about/study-quality` | `…/study-quality/page.tsx` | static | yes | `"use client"` |
| `/about/what-is-biso` | `…/what-is-biso/page.tsx` | static | yes | `"use client"` |
| `/bi-fondet` | `(public)/bi-fondet/page.tsx` | static | yes | Funding |
| `/business` | `(public)/business/page.tsx` | static | yes | Partner-facing |
| `/business-hotspot` | `(public)/business-hotspot/page.tsx` | static | yes | 36 lines |
| `/campus` | `(public)/campus/page.tsx` | static | yes | **Overlaps `/students`** — same six data sources |
| `/contact` | `(public)/contact/page.tsx` | static | yes | |
| `/documents` | `(public)/documents/page.tsx` | static | yes | Not in sitemap |
| `/events` | `(public)/events/page.tsx` | static | yes | Listing |
| `/events/[slug]` | `…/events/[slug]/page.tsx` | dynamic | shell | |
| `/fs/approve/[token]` | `…/fs/approve/[token]/page.tsx` | dynamic | shell | Token-gated expense approval |
| `/jobs` | `(public)/jobs/page.tsx` | static | yes | Highest sitemap priority after `/` (0.9) |
| `/jobs/[slug]` | `…/jobs/[slug]/page.tsx` | dynamic | shell | Has `error.tsx` + `not-found.tsx` |
| `/member` | `(public)/member/page.tsx` | static | yes | Member portal. Has `loading.tsx` |
| `/membership` | `(public)/membership/page.tsx` | static | yes | |
| `/membership/join` | `…/membership/join/page.tsx` | static | yes | Purchase flow; requires linked BI identity |
| `/news` | `(public)/news/page.tsx` | static | yes | |
| `/news/[slug]` | `…/news/[slug]/page.tsx` | dynamic | shell | |
| `/onboarding` | `(public)/onboarding/page.tsx` | static | yes | Reached only via `redirect()` and the popout |
| `/policies/drugs-policy` | `…/drugs-policy/page.tsx` | static | yes | 38 lines |
| `/press` | `(public)/press/page.tsx` | static | yes | 84 lines |
| `/privacy` | `(public)/privacy/page.tsx` | static | yes | 450 lines |
| `/projects` | `(public)/projects/page.tsx` | static | yes | Large events |
| `/projects/[slug]` | `…/projects/[slug]/page.tsx` | dynamic | shell | Per-project brand overrides |
| `/recruitment/book/[token]` | `…/book/[token]/page.tsx` | dynamic | shell | Interview booking |
| `/resources` | `(public)/resources/page.tsx` | static | yes | `"use client"` |
| `/safety` | `(public)/safety/page.tsx` | static | yes | `"use client"`. Whistleblowing form |
| `/shop` | `(public)/shop/page.tsx` | static | yes | |
| `/shop/[slug]` | `…/shop/[slug]/page.tsx` | dynamic | shell | |
| `/shop/cart` | `…/shop/cart/page.tsx` | static | yes | |
| `/shop/checkout` | `…/shop/checkout/page.tsx` | static | yes | |
| `/shop/membership` | `…/shop/membership/page.tsx` | static | yes | 308 redirect → `/membership/join` |
| `/shop/order/[orderId]` | `…/order/[orderId]/page.tsx` | dynamic | shell | Receipt, opts into print |
| `/students` | `(public)/students/page.tsx` | static | yes | **Overlaps `/campus`**. Not in sitemap |
| `/terms` | `(public)/terms/page.tsx` | static | yes | |
| `/units` | `(public)/units/page.tsx` | static | yes | Has `loading.tsx` |
| `/units/[...segments]` | `…/[...segments]/page.tsx` | dynamic | shell | Campus-scoped; see §7.3 |
| `/varsling` | `(public)/varsling/page.tsx` | static | yes | 308 redirect → `/safety` |
| `/[...slug]` | `(public)/[...slug]/page.tsx` | dynamic | shell | Block-editor catch-all via `getPage()` |

### 1.3 `(protected)` — 5 pages

Gated by `(protected)/layout.tsx`: `getLoggedInUser()` → `unauthorized()` if absent, `redirect("/onboarding?required=1")` if no profile.

| Route | File | Notes |
|---|---|---|
| `/applications` | `(protected)/applications/page.tsx` | Job applications |
| `/fs` | `(protected)/fs/page.tsx` | Financial services. `error.tsx` + `loading.tsx` |
| `/fs/new` | `(protected)/fs/new/page.tsx` | `loading.tsx` |
| `/fs/[id]` | `(protected)/fs/[id]/page.tsx` | `error.tsx` + `loading.tsx` + `not-found.tsx` |
| `/profile` | `(protected)/profile/page.tsx` | |

All four are reachable **only** from the account menu — there is no other entry point.

### 1.4 `(auth)` and route handlers

| Route | File | Kind |
|---|---|---|
| `/auth/login` | `(auth)/auth/login/page.tsx` | page |
| `/auth/callback` | `(auth)/auth/callback/route.ts` | OAuth return leg |
| `/auth/oauth` | `(auth)/auth/oauth/route.ts` | OAuth start |
| `/auth/invite` | `(auth)/auth/invite/route.ts` | Invite/magic link |

18 further handlers under `/api/*`: `analytics/page-view`, `auth/bi-link`, `auth/check`, `campus-leadership`, `checkout/return`, `checkout/webhook` (410 Gone), `cron/cleanup-reservations`, `cron/reconcile-orders`, `documents/[id]/download`, `form/submit`, `health`, `health/ready`, `membership`, `pages/{departments,events,jobs,news,partners}`.

### 1.5 Error and loading surfaces

`global-error.tsx`, `not-found.tsx`, `unauthorized.tsx` at root; `error.tsx` in `(public)` and `(protected)`; 6 `loading.tsx`; 2 `not-found.tsx`; 3 nested `error.tsx`. Coverage is uneven — `/events/[slug]`, `/news/[slug]`, `/shop/[slug]` and `/projects/[slug]` have none of the three.

### 1.6 URL contract to preserve

`src/app/sitemap.ts` is the authoritative public URL list: 34 static entries plus slug-mapped `/jobs/*`, `/events/*`, `/news/*`, `/shop/*`, `/projects/*`, editor pages, and `/units/<campus>/<slug>`.

Real routes **absent** from the sitemap: `/students`, `/documents`, `/member`, `/membership/join`, `/policies/drugs-policy`. Two redirects (`/varsling`, `/shop/membership`) must keep working — they exist to hold external inbound links.

---

## 2. Server/client boundary

**108 of 139 components (78%) are client components.** 99 of 139 import `motion`.

### 2.1 Client components that do not need to be

| Files | Why they are client | What they actually need | Cost today |
|---|---|---|---|
| 11 × `about/*` pages, `/resources`, `/safety` | `useTranslations()` + `motion` at render | `getTranslations()` from `next-intl/server`; motion only where a real interaction exists | Forces 3 extra `layout.tsx` files (§8.2) that exist *only* to carry metadata a client page cannot export |
| `(public)/shop/layout.tsx` | `"use client"` returning a bare `<div>` | Nothing | Makes the whole `/shop/*` layout boundary a client component for no gain |
| `layout/footer.tsx` | `useTranslations` + 5 `whileInView` reveals | Server render; the reveals are decoration | Footer JS on every page |
| `about/about-hero.tsx` (15 usages) | `motion` | Static hero | Ships to 15 routes |

### 2.2 Client components that genuinely need it

`nav/mega-nav.tsx` (panel state, scroll, focus management), `context/campus.tsx`, `context/membership-provider.tsx`, `lib/contexts/cart-context`, all `shop/cart/*`, `jobs/job-application-form.tsx`, `safety/varsling-form.tsx`, `onboarding/onboarding-flow.tsx`, the `expense-v3/*` set, `locale-switcher.tsx`, `select-campus.tsx`.

### 2.3 Suspense boundaries that never suspend

`(public)/page.tsx` awaits **all seven** data promises in one `Promise.all` (lines 95–107), then wraps the results in four `<Suspense>` boundaries with skeleton fallbacks (lines 114–132). Because the data is already resolved, none of these boundaries can suspend — `HeroSkeleton`, `AboutSkeleton`, `EventsSkeleton` and `NewsSkeleton` (149 lines in `home/skeletons.tsx`) are unreachable at runtime. The homepage blocks on its slowest query before sending any HTML.

---

## 3. Styling system

### 3.1 What is in use

| Layer | Location | Notes |
|---|---|---|
| Tailwind v4, CSS-first | `apps/web/src/app/styles.css` | **No `tailwind.config.*` anywhere.** `@import "tailwindcss"` + `@source` globs |
| Token mappings | `packages/ui/styles/globals.css` | `@theme inline` maps `--color-*` → bare CSS vars. **Shared package** |
| Token *values* | `packages/ui/styles/biso-surface.css` | The BISO palette. **Shared package** |
| App utilities | `apps/web/src/app/styles.css` (135 lines) | `bg-grid-primary`, `surface-spotlight`, `glass-panel`, `accent-ring`, `gradient-divider`, print rules |
| Plugins | — | `@tailwindcss/typography`, `tw-animate-css`, `tailwind-scrollbar-hide` |
| Component library | `@repo/ui` (shadcn/Radix) | **Shared package** |

### 3.2 The palette is two disconnected systems

`biso-surface.css` defines the shadcn core (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--card`, `--border`, `--ring`) at **chroma 0 — pure neutral greyscale**. `--primary` is `oklch(0.205 0 0)`, i.e. near-black, not BISO navy.

BISO's actual identity lives in a parallel `--brand-*` namespace bolted on beside it: `--brand` `oklch(0.68 0.14 220)` (blue), `--brand-dark` `oklch(0.15 0.05 250)` (navy), `--brand-accent` `oklch(0.88 0.17 95)` (yellow), plus 6 gradient stops, 5 muted/border variants, and `--nav-background` / `--nav-foreground`.

Consequence: every `@repo/ui` primitive rendered with default variants is greyscale. Brand colour only appears where a developer explicitly reached for a `brand-*` utility. That is why the codebase is full of hand-written gradients — the primitives supply no brand by default.

### 3.3 Duplication and drift

| Finding | Count | Detail |
|---|---|---|
| Off-token colour utilities | **711 across 78 of 139 files** | `text-green-700` (26), `border-green-200` (22), `bg-green-100` (17), `from-blue-500` (10), `from-pink-500` (7)… vs 2,153 token usages — ~25% of colour decisions bypass the token system |
| Hardcoded hex in TSX | 12 files | `#001731` (14×), `#3DA9E0` (13×), `#1E3A8A`, `#14355B`, `#2d8bc0` — plus `#a855f7`/`#ec4899` (purple/pink, off-brand) |
| Hardcoded rgba in CSS | `styles.css` | `rgba(0,23,49,…)` = `#001731`, `rgba(61,169,224,…)` = `#3DA9E0`, `rgba(247,214,74,…)` = `#F7D64A`. The same three brand colours re-typed as literals instead of referencing the tokens |
| Gradients | **278** | `bg-linear-to-*` / `bg-gradient-to-*` |
| Border radii | 8 distinct | `rounded-full` 163, `rounded-lg` 102, `rounded-xl` 73, `rounded-2xl` 45, `rounded-md` 28, `rounded-3xl` 26, `rounded-none` 6, `rounded-sm` 1 — despite a `--radius` token existing |
| Backdrop blur | 72 usages, 4 levels | `sm` 49, `md` 14, `lg` 8, `xl` 1 |
| Container wrappers | **176 hand-rolled**, 7 widths | `max-w-7xl` 61, `max-w-4xl` 51, `max-w-2xl` 31, `max-w-6xl` 12, `max-w-5xl` 10, `max-w-3xl` 8, `max-w-xl` 3. No `<Container>` primitive |
| Section rhythm | 4 competing | `py-16` 85, `py-12` 34, `py-24` 11, `py-20` 7 |
| Fixed-nav offset | 4 different values | `pt-28` 4, `pt-20` 3, `pt-36` 2, `pt-32` 2 — each page compensates for the fixed nav by hand |
| `min-h-screen` wrappers | 50 | |

### 3.4 Broken variants in the shared primitives

`packages/ui/components/ui/button.tsx` and `card.tsx` reference colour and utility classes that **are never defined anywhere in the repo**:

`blue-accent`, `blue-strong`, `secondary-100`, `primary-80`, `primary-90`, `primary-100`, `gold-default`, `gold-accent`, `gold-subtle`, `gold-muted`, `shadow-glow`, `shadow-glow-blue`, `shadow-card-gold`, `.glass`, `.glass-dark`, `.gradient-border`.

(`apps/web/styles.css` defines `.glass-panel` — a *different* class. `apps/admin` defines `.glass-card` / `.glass-input`. Neither defines `.glass`.)

Affected variants and their real usage in `apps/web`:

| Variant | Component | Usages in web | Actual result |
|---|---|---|---|
| `gradient` | Button | **3** | Silently degrades to plain `bg-primary` — the `before:` overlay gradient is transparent |
| `glow`, `golden-gradient`, `animated` | Button | 0 | dead |
| `glass`, `glass-dark` | Button | 0 | dead |
| `glass`, `glass-dark`, `gradient`, `golden`, `gradient-border` | Card | 0 | dead |

### 3.5 Base-typography override that will fight the redesign

`packages/ui/globals.css` lines 143–191 pin every bare `h1`–`h4`, `p`, `label`, `button`, `input` to `line-height: 1.5` and `--font-weight-medium`, with `h1` at `--text-2xl`. The guard selector is:

```css
:where(:not(:has([class*=" text-"]), :not(:has([class^="text-"]))))
```

That expression is malformed — the second argument to the outer `:not()` is itself a `:not(:has(…))`, which inverts the intent. Any redesign specifying display type at `clamp()` sizes with tight leading must contend with this rule, in a shared package.

### 3.6 A test pins the token system in place

`apps/web/src/app/styles.test.ts` asserts:

- `apps/web/src/app/styles.css` **must not** contain `--brand:`, `--inverted:`, or `--section:` declarations
- `packages/ui/styles/biso-surface.css` **must** contain them, plus `--font-biso-sans`, `--font-biso-display`, `var(--font-inter)`, `var(--font-museo)`
- `packages/ui/styles/globals.css` must wire `--font-sans`/`--font-display` through those backing variables

Defining the redesign's palette or typefaces locally in `apps/web` fails this test by construction. See §11.1.

---

## 4. Typography

| Face | Source | Weight | Wired to | Actually rendered |
|---|---|---|---|---|
| Inter | `next/font/google`, latin subset | variable | `--font-inter` → `--font-biso-sans` → `font-sans` | **Everything** |
| Museo Sans 300 | `public/museo_sans_300.otf`, 62 KB | 300 only | `--font-museo` → `--font-biso-display` → `font-display` | **Nothing** |

**The `font-display` utility appears zero times in `apps/web` markup.** Museo Sans is downloaded on every page load and never painted. It is also shipped as unsubsetted `.otf` rather than `.woff2`, and only in Light (300) — which cannot produce the heavy uppercase display treatment the chosen reference direction calls for.

Weights in use: `font-bold` 196, `font-semibold` 182, `font-medium` 153, `font-normal` 4 — all Inter. Uppercase treatment already appears 35 times, with `tracking-tight` 17, `tracking-wide` 12, `tracking-wider` 10, `tracking-widest` 1.

---

## 5. Component inventory

> **Corrected 2026-08-31 during RD-002.** This section originally counted only `src/components/`. There are a further **40 components colocated under `src/app/`** (7,555 LOC) that it missed — feature UI living beside its route rather than in the shared tree.
>
> | | Components | LOC |
> |---|---|---|
> | `src/components/` (inventoried below) | 139 | 20,981 |
> | Colocated under `src/app/` (missed) | **40** | **7,555** |
> | **Real total** | **179** | **28,536** |
>
> The largest colocated cluster is **`src/app/(public)/campus/components/` — 13 components, 1,885 LOC** implementing a complete tabbed campus experience (hero, overview, students, team, partners) that **nothing in the app links to**. §9 recorded `/campus` as an unlinked route; it is in fact an unlinked *feature*. This materially improves the outlook for the campus work in `02-plan.md` (RD-016/RD-023) — see that file's note.
>
> Others: `units/` 13 · `membership/` 4 · `business*`, `member`, `shop/checkout`, `students`, `recruitment`, `fs/approve`, `[...slug]` 1 each.

139 components in `src/components/`, 20,981 LOC. Grouped by directory; usage count is import sites within `apps/web`.

### 5.1 Layout and navigation (13)

| Component | C/S | LOC | Uses | Purpose |
|---|---|---|---|---|
| `layout/site-shell.tsx` | S | 102 | 2 | Chrome for `(public)` + `(protected)`: providers, nav, `<main>`, footer, onboarding popout |
| `layout/footer.tsx` | C | 155 | 1 | Site footer |
| `layout/public-providers.tsx` | C | 37 | 1 | Campus → Cart → Membership providers + cart drawer |
| `layout/analytics-identity.tsx` | C | 37 | 1 | Umami `identify()` for members |
| `layout/nav.tsx` | S | 4 | 10 | Legacy re-export shim → `nav/mega-nav` |
| `nav/mega-nav.tsx` | C | 385 | 2 | Fixed mega-menu header |
| `nav/desktop-menu.tsx` | C | 90 | 1 | Desktop trigger row |
| `nav/mega-panel.tsx` | C | 100 | 5 | Animated panel container |
| `nav/mobile-drawer.tsx` | C | 241 | 1 | Mobile menu (below `xl`) |
| `nav/account-menu.tsx` | C | 127 | 2 | Signed-in dropdown |
| `nav/campus-link.tsx` | C | 35 | 2 | Campus-aware link |
| `nav/featured-event-card.tsx` | C | 57 | 1 | Featured slot in students panel |
| `nav/featured-project-card.tsx` | C | 50 | 1 | Featured slot in projects panel |
| `nav/panels/{about,projects,students}-panel.tsx` | C | 18/71/66 | 1 each | Panel contents |

### 5.2 Home (8)

| Component | C/S | LOC | Uses |
|---|---|---|---|
| `home/hero-carousel.tsx` | C | 371 | 1 |
| `home/events-section.tsx` | C | 237 | 1 |
| `home/news-section.tsx` | C | 217 | 1 |
| `home/join-us.tsx` | C | 213 | 1 |
| `home/about-section.tsx` | C | 159 | 1 |
| `home/skeletons.tsx` | S | 149 | 1 (**unreachable — §2.3**) |
| `home/partners.tsx` | C | 75 | 2 |
| `home/hero-section.tsx` | S | 18 | 1 |

### 5.3 News (17)

`article-card` (C, 171, 3×) · `news-filters` (C, 133) · `news-info-section` (C, 96) · `article-hero` (S, 85) · `article-share` (C, 75) · `news-grid-skeleton` (S, 65) · `article-meta-rail` (S, 60) · `related-articles` (S, 55) · `regular-articles` (C, 49) · `featured-articles` (C, 48) · `news-grid` (S, 47) · `news-hero` (C, 45) · `article-skeleton` (S, 38) · `no-results` (C, 37) · `article-body` (S, 31) · `back-button` (C, 19) · `scroll-indicator` (C, 16)

### 5.4 Shop (14 + 8 cart)

`shop-list-client` (C, 254) · `product-details-server` (S, 225) · `product-card` (C, 184) · `add-to-cart-client` (C, 165) · `order-receipt` (S, 143) · `order-details-client` (C, 138) · `product-options-client` (C, 111) · `stock-status-card` (S, 92) · `shop-hero-shell` (S, 85, 5×) · `price-details` (S, 71) · `member-callout-client` (C, 52) · `purchase-tracker` (C, 48) · `shop-hero` (C, 40) · `cart-reset-on-success` (C, 21)
Cart: `cart-item` (C, 216) · `cart-drawer` (C, 181) · `cart-summary` (C, 147) · `cart-list` (C, 98) · `cart-page-client` (C, 54) · `cart-alerts` (C, 44) · `cart-hero` (C, 35) · `cart-empty-state` (C, 28)

### 5.5 Member portal (11 shared + 7 tabs + 3 states)

Shared: `locked-content-overlay` (C, 245) · `member-portal-header` (C, 238) · `benefit-card` (C, 229, 2×) · `benefit-card-parts` (C, 173) · `membership-cta-section` (C, 163, 2×) · `tab-navigation` (C, 126) · `benefit-preview-card` (C, 113, 2×) · `benefits-showcase` (C, 89) · `membership-card` (S, 54) · `member-portal-skeleton` (S, 51, 2×) · **`quick-stats-card` (S, 49, 0×)**
Tabs: `home-tab` (C, 384) · `benefits-tab` (C, 316) · `profile-tab` (C, 267) · `membership-tab` (C, 217) · **`settings-tab` (C, 208, 0×)** · `campus-tab` (C, 58) · `opportunities-tab` (C, 56)
States: **`not-member-state` (C, 144, 0×)** · **`no-bi-email-state` (C, 67, 0×)** · **`signed-out-state` (C, 46, 0×)**
Plus `member-portal-tabs` (C, 118)

### 5.6 Events (9)

`event-detail-modal` (C, 356) · `event-card` (C, 278) · `event-info-cards` (S, 248) · `events-list-client` (C, 183) · `event-collection-list` (S, 147) · `event-hero` (S, 115) · `event-actions` (C, 85) · `event-content` (S, 80) · `events-hero` (C, 57)

### 5.7 Jobs (5)

`job-application-form` (C, 709) · `jobs-list-client` (C, 416) · `job-details-client` (C, 368) · `jobs-hero` (C, 97) · `job-card` (C, 92)

### 5.8 About (8)

`about-hero` (C, 154, **15×** — most-reused component in the app) · `topic-grid` (C, 132) · `strategy-cards` (C, 79) · `forum-list` (C, 51, 2×) · `policy-cards` (C, 45, 2×) · `pdf-cta` (C, 44, 2×) · `history-timeline` (C, 42) · `stats-bar` (C, 37)

### 5.9 Expense (8) — behind the `expenses_module` feature flag

`expense-v3/expense-split-view` (C, 905) · `expense-v3/expense-report` (C, 706) · `expense-v3/generative-receipt-preview` (S, 582) · `expense-v3/receipt-wallet` (C, 310) · `expense-v3/profile-completion-banner` (C, 208) · `expense/expense-card` (C, 158) · `expense/expense-skeleton` (C, 72, 4×) · `expense/expenses-unavailable` (S, 23, 2×)

### 5.10 Remaining (24)

`onboarding/onboarding-flow` (C, 811) · `onboarding/onboarding-popout` (C, 100) · `login` (C, 320) · `profile/membership-status-card` (C, 309) · `safety/varsling-form` (C, 272) · `projects/project-detail-body` (C, 266) · `profile/identity-management` (C, 220) · `documents/document-row` (C, 218) · `documents/documents-list-client` (C, 194) · `privacy-controls` (C, 195) · `projects/projects-body` (C, 187) · `locale-switcher` (C, 187, 2×) · `select-campus` (C, 172, 2×) · `context/campus` (C, 140, **24×**) · `public/public-page-header` (S, 118, 3×) · `profile/profile-tabs` (C, 102) · `context/membership-provider` (C, 96, 3×) · `membership/plan-card` (S, 87, 2×) · `documents/documents-hero` (C, 73) · `projects/project-card` (S, 72) · `shared/section-heading` (S, 53, 3×) · `account-link-session-cleanup` (C, 44) · `shared/step-card` (S, 29, 2×) · `analytics-tracker` (S, 10)

**Only three genuinely shared presentational primitives exist:** `shared/section-heading` (3×), `shared/step-card` (2×), `public/public-page-header` (3×). Everything else is per-feature. `about-hero` at 15× is the closest thing to a page-header primitive, and it lives in `components/about/`.

---

## 6. Data layer

### 6.1 Access pattern

Everything goes through `@repo/api`. Calls take the shape `db.listRows<T>("app", "<table>", queries)`. Two client factories: `createSessionClient()` (user-scoped) and `createAdminClient()` (service key).

Three read strategies coexist:

| Strategy | Where | Used for |
|---|---|---|
| `"use cache"` readers | `lib/data/public-content.ts` (14 KB), `lib/data/queries.ts` | Anonymous/bot traffic — shared cached result |
| Per-request server actions | `app/actions/*.ts` (19 files), `lib/actions/*.ts` (6 files) | Session holders, so member-only rows (`team:biso-members` row perms) still surface |
| React `cache()` memoisation | `getLoggedInUser`, `getUserPreferences`, `resolveUnitByKey` | Request-scoped dedupe |

`SiteShell` and the homepage both branch on `Boolean(cookieStore.get(SESSION_COOKIE))` to pick between the cached and the per-request path.

### 6.2 Appwrite tables touched by `apps/web`

| Table | Ops | Consumers |
|---|---|---|
| `events` | list ×5 | home, `/events`, `/events/[slug]`, `/campus`, `/students`, nav featured, sitemap |
| `orders` | get ×5, list ×4 | `/shop/order/[orderId]`, checkout return, reconcile cron, membership fulfilment |
| `news` | list ×4 | home, `/news`, `/news/[slug]`, `/campus`, nav featured |
| `departments` | list ×4, get ×1 | `/units`, `/units/[...segments]`, `/campus`, `/students` |
| `user` | get ×7, update ×4 | profile, onboarding, BI identity link, membership |
| `jobs` | list ×3, get ×2 | `/jobs`, `/jobs/[slug]`, `/applications`, home counts |
| `campus` | list ×3, get ×1 | campus switcher, `/campus`, `/contact`, `/business` |
| `campus_metadata` | list ×3 | campus pages |
| `large_event` | list ×3 | `/projects`, `/projects/[slug]`, nav featured |
| `cart_reservations` | list ×6, delete ×4, update ×1 | cart, cleanup cron |
| `campus_data` | list ×2 | campus pages |
| `documents` | list ×2 | `/documents` |
| `partners` | list ×2 | home |
| `job_applications` | list ×2, update ×1 | `/applications` |
| `expense` | list ×1, get ×1 | `/fs/*` |
| `memberships` | list ×1 | `/membership/join` |
| `pages` | list ×1 | `/[...slug]`, `/units/[...segments]` |
| `large_event_item` | list ×1 | `/projects/[slug]` |
| `benefit_reveals` | list ×1 | member portal |
| `webshop_products` | get ×1 | `/shop/[slug]` |

### 6.3 Shape that comes back — and what it does not contain

`Events`, `News`, `Jobs` and `Departments` carry **no title or body columns**. All human-readable text lives in a related `ContentTranslations` row:

```
ContentTranslations {
  content_id, locale, content_type,
  title, description, short_description,
  additional_fields  // JSON string
}
```

resolved by `getPrimaryTranslation(row, locale)` in `lib/content-translation.ts`, which prefers the locale match and otherwise falls back to the first translation present.

So the only per-item copy the design can rely on is **title, description, short_description**. There is no subtitle, excerpt, author biography, reading time, or pull-quote field.

Structured fields the design *can* use:

- `Events`: `start_date`, `end_date`, `location`, `location_mode`, `online_url`, `price`, `member_price`, `pricing_mode`, `member_only`, `capacity`, `waitlist`, `registration_deadline`, `image`, `cover_pattern`, `tags[]`, `category`, `ticket_url`, `is_collection`
- `News`: `image`, `author`, `sticky`, `url`, `metadata[]`
- `Jobs`: `application_deadline`, `department`, `campus`
- `Departments`: `Name`, `logo`, `hero`, `abbreviation`, `type`, `active`, `socials[]`, `boardMembers[]`, `slug`
- `LargeEvent` (projects): `name`, `description`, `startDate`, `endDate`, `priority`, `showcaseType`, `externalUrl`, `ctaText`, `logoUrl`, `backgroundImageUrl`, **`primaryColorHex`, `secondaryColorHex`, `gradientHex[]`, `textColorHex`, `heroOverrideEnabled`**

That last group matters: **projects can override the site's brand colours from the database**, including a full hero takeover. Any token system has to accommodate a per-project palette injected at runtime.

### 6.4 Campus scoping

`lib/campus-scope.ts` defines the rule: `null`/`"all"` → no filter; National (`"5"`) → National only; any study campus → `[campusId, "5"]`, so National content rides along with every campus.

Campus ids are fixed in `packages/shared/utils/unit-urls.ts`:

| id | segment | label |
|---|---|---|
| 1 | `oslo` | Oslo |
| 2 | `bergen` | Bergen |
| 3 | `trondheim` | Trondheim |
| 4 | `stavanger` | Stavanger |
| 5 | `national` | National |

### 6.5 Campus state has three sources of truth that disagree

| Source | Written by | Read by | Default when empty |
|---|---|---|---|
| `campusId` cookie | `setActiveCampus()` | `getUserPreferences()` — **all server rendering** | absent → `"all"` (no filter) |
| `localStorage["biso-active-campus"]` | `CampusProvider` effect | `useCampus()` — **the nav switcher UI** | absent → **first campus in the list** |
| Appwrite `user.prefs.campusId` | `setActiveCampus()` | `getUserPreferences()` as cross-device fallback | — |

`CampusProvider` (`components/context/campus.tsx:63-70`) sets `activeCampusId` to `response[0]?.$id` when nothing is stored. The server, reading the absent cookie, filters nothing. So on a first visit the switcher can display a specific campus while the page below it renders unfiltered national content.

`CampusProvider` also fetches the campus list **client-side on mount** via a server action, even though `SiteShell` is already a Server Component that could pass it down — a hydrate-then-fetch waterfall before the switcher can render its label.

---

## 7. Internationalisation

### 7.1 Setup

| Aspect | Value |
|---|---|
| Library | `next-intl` |
| Locales | `no` (default), `en` — `packages/i18n/config.ts` |
| Selection | `NEXT_LOCALE` cookie → authenticated `prefs.locale` fallback |
| **No locale in the URL** | `/news` serves both languages; no `/en/*` or `/no/*` prefix, no `hreflang` alternates |
| Loader | `src/i18n/request.ts` → `loadMessages(locale)` |
| Provider | `NextIntlClientProvider` in root `layout.tsx` — **all messages for the locale sent to the client on every page** |
| Structure | 37 namespace files per locale, nested keys |

### 7.2 Key health — structurally sound

**3,580 keys in `en`, 3,580 in `no`, with zero divergence** across all 37 namespaces. No missing keys, no orphans between locales. This is the healthiest part of the codebase.

### 7.3 Untranslated strings in shipped UI

| Location | String | Impact |
|---|---|---|
| `layout/footer.tsx:11-28,101` | Section headings `"About"`, `"Students"`, `"Practical"` — object keys rendered directly as `<h4>{title}` | Every page. Links inside are translated; the headings above them are not |
| `select-campus.tsx:27` | `placeholder = "Velg campus"` | Campus switcher in the nav on every page — hardcoded Norwegian, shown in English mode |
| `about/what-is-biso/page.tsx:39` and siblings | Breadcrumb `{ label: "Home" }`, `{ label: "About BISO" }` | Every `/about/*` page |
| `layout/footer.tsx:82,86` | `"Nydalsveien 37, 0484 Oslo, Norway"`, `"contact@biso.no"` | Addresses — arguably fine untranslated |
| `layout.tsx:13-14` | Root metadata `title: "BI Student Organisation"`, `description: "BISO Apps"` | `"BISO Apps"` is a placeholder description shipping to production |

### 7.4 Other

`packages/i18n/messages/{en,no}/unused.json` is a parked file of retired keys (`__comment: "Ubrukte nøkler beholdt for gjennomgang."`). `packages/i18n/messages/report.json` is a stale 2025-09-18 audit artefact referencing `apps/admin` election pages that reports coverage over 48 keys — it does not describe the current 3,580-key state. Both are in a shared package.

---

## 8. Layout shell

### 8.1 Composition

```
app/layout.tsx                      <html class="museo inter biso-surface">
  Providers (client)                  ThemeProvider → TooltipProvider → Toaster
    NextIntlClientProvider
      <main>                        ← outer main
        AnalyticsTracker
        Suspense → AccountLinkSessionCleanup
        {children}
        <Script analytics.biso.no>

  (public)/layout.tsx  →  SiteShell
  (protected)/layout.tsx → auth gate → SiteShell
  (auth)/layout.tsx    →  bare fragment, no chrome

  SiteShell (server)
    PublicProviders (client)
      CampusProvider → CartProvider → MembershipProvider
        AnalyticsIdentity
        <Navigation account featured>     ← fixed header
        <main><div>{children}</div></main> ← inner main
        <Footer>
        <OnboardingPopout>
        <CartDrawer>
```

### 8.2 Structural defects

1. **Nested `<main>` elements.** Root `layout.tsx:53` opens `<main>`; `SiteShell:95` opens another inside it. Invalid HTML, and it breaks the landmark structure screen readers rely on.
2. **`<nav>` and `<footer>` are inside `<main>`.** Both are descendants of the root `<main>`, so the header and footer are announced as page content.
3. **No skip-to-content link.** With a 12-item mega-menu plus 9 utility controls in the header, keyboard users tab through ~25 controls to reach page content on every navigation.
4. **Three `layout.tsx` files exist only to carry metadata** — `about/`, `resources/`, `safety/` — because their pages are `"use client"` and cannot export it. Each returns `children` unchanged.
5. **`shop/layout.tsx` is a `"use client"` wrapper returning `<div>{children}</div>`.** No purpose.

### 8.3 Header

`nav/mega-nav.tsx` (385 lines, client). Fixed, transparent until `scrollY > 50`, then `bg-nav-background` + `backdrop-blur-lg`. Desktop layout appears only at **`xl` (1280px)**; everything below gets the mobile drawer — so tablets and small laptops use the hamburger.

Desktop right-side cluster holds **nine** controls: campus select, theme toggle, locale switcher, cart, "Partner" link, "Member portal" button, "Apply verv" button, "Become member" button, account menu. Three of them are buttons using `router.push()` rather than `<Link>` — no prefetch, no middle-click, no right-click-open-in-new-tab.

Panel behaviour is genuinely well built: hover-intent with a 120ms close delay, `ArrowDown` opens and focuses the first link, `Escape` closes and restores focus to the trigger, pointer-down outside closes. Distinguishes keyboard focus from post-click focus.

### 8.4 IA as currently configured (`nav/nav-config.ts`)

```
For Students ▾
├─ Membership: /students · /membership · /membership#fordeler · /membership/join
├─ Resources:  /units · /jobs · /bi-fondet · /about/study-quality · /resources
└─ Campus:     (dynamic, per campus)
Projects ▾
├─ Flagships:  fadderullan · winterGames · karrieredagene · inspire  (slugs from i18n)
└─ /events
About BISO ▾
├─ Organisation: /about · /about/history · /about/operations · /about/alumni
├─ Policy:       /about/politics · /about/bylaws · /documents · /policies/drugs-policy · /safety
└─ Contact:      /contact · /business · /business-hotspot · /press
News (standalone)  ·  Shop (standalone)

Account menu (signed in): /profile · /applications · /fs (flagged) · /member
Utility: campus · theme · locale · cart · /business · /member · /jobs · /membership
```

Not reachable from the nav at all: `/campus`, `/about/what-is-biso`, `/about/saih`, `/about/academics-contact`, `/projects` (the index — only individual flagships are linked), `/privacy`, `/terms`.

### 8.5 Footer

`layout/footer.tsx` (155 lines, client). Three link columns + brand block + socials.

- **Internal links use `<a>`, not `<Link>`** — every footer click is a full page reload.
- **Contrast failure (measured):** `text-muted-foreground` `oklch(0.556 0 0)` = `#737373` on `bg-inverted` `oklch(0.145 0 0)` = `#0a0a0a` gives **4.18:1 — below the 4.5:1 WCAG AA floor** for normal-size text. This is the footer description, the address, the email, the copyright, and every footer link, on every page. Note also that `--inverted-muted` — the token whose name suggests it is *for* muted text on an inverted surface — is worse at **2.15:1**; only `--inverted-foreground` (18.96:1) is usable there. The inverted token set has no compliant muted step.
- **Social buttons are `bg-inverted` on a `bg-inverted` footer** — invisible until hover.
- **Social hover is `from-purple-600 to-pink-600`** — a purple/pink gradient with no relationship to BISO's palette.
- Five `whileInView` fade-and-slide-up reveals.

### 8.6 Global providers

| Provider | File | Scope |
|---|---|---|
| `ThemeProvider` (next-themes) | `app/providers.tsx` | Whole app. Dark mode is live |
| `TooltipProvider` | `app/providers.tsx` | Whole app |
| `Toaster` (sonner) | `app/providers.tsx` | Whole app |
| `NextIntlClientProvider` | `app/layout.tsx` | Whole app |
| `CampusProvider` | `layout/public-providers.tsx` | `(public)` + `(protected)` |
| `CartProvider` | `layout/public-providers.tsx` | `(public)` + `(protected)` |
| `MembershipProvider` | `layout/public-providers.tsx` | `(public)` + `(protected)` |

`(auth)` gets none of these — the login page renders outside all site chrome.

---

## 9. Dead weight

| Item | Size | Evidence |
|---|---|---|
| `member-portal/tabs/settings-tab.tsx` | 208 LOC | Zero imports; string `settings-tab` appears nowhere else |
| `member-portal/states/not-member-state.tsx` | 144 LOC | Zero imports |
| `member-portal/states/no-bi-email-state.tsx` | 67 LOC | Zero imports |
| `member-portal/shared/quick-stats-card.tsx` | 49 LOC | Zero imports |
| `member-portal/states/signed-out-state.tsx` | 46 LOC | Zero imports |
| `home/skeletons.tsx` | 149 LOC | Imported, but unreachable — its `<Suspense>` boundaries can never suspend (§2.3) |
| `public/images/person-placeholder.jpg` | **1.47 MB** | Zero references anywhere in `src` |
| Button variants `glow`, `golden-gradient`, `animated`, `glass`, `glass-dark` | — | 0 usages; classes undefined (§3.4) |
| Card variants `glass`, `glass-dark`, `gradient`, `golden`, `gradient-border` | — | 0 usages; classes undefined |
| `layout/nav.tsx` | 4 LOC | Legacy re-export shim, still imported 10× |
| `src/app/expenses/profile/profile-form.tsx` | — | A component parked inside `src/app/` with no `page.tsx` beside it; imported by `profile/profile-tabs.tsx`. Not a route, wrong location |
| `(public)/shop/layout.tsx` | 8 LOC | `"use client"` wrapper returning a bare `<div>` |
| `framer-motion` | dependency | 6 files still import it; the other 92 use `motion/react`. **Both libraries ship** |
| `/about/academics-contact` | 23 LOC route | In the sitemap, but nothing in the app links to it |
| `packages/i18n/messages/*/unused.json` | — | Explicitly parked retired keys (shared package) |
| `packages/i18n/messages/report.json` | — | Stale 2025-09-18 artefact describing `apps/admin` (shared package) |

**Broken link:** `(public)/about/alumni/page.tsx:68` renders `<Link href="/alumni">`. There is no `/alumni` route — only `/about/alumni`. This 404s today.

**Positive:** only 3 TODO/`@deprecated` markers in the entire non-test source, and no commented-out code blocks. The codebase is otherwise well maintained, and the inline comments explaining *why* (session cookie naming, cache strategy, campus scoping, unit URL conventions) are unusually good.

---

## 10. Quality-floor baseline

Measured against the brief's §3 non-negotiables.

| Requirement | Current state |
|---|---|
| Responsive to 320px | **Unverified.** Not yet rendered in a browser. Desktop nav starts at `xl` (1280px), so 320–1279px all use the drawer |
| Visible keyboard focus | **Fails widely.** `focus-visible` appears in **2 of 139** component files. `@repo/ui` `Button` carries `focus-visible:ring-2`, so shared buttons are covered — but the many hand-rolled `<button>` and `<a>` elements (cart toggle, mobile menu, social links, nav utility controls) have no focus style |
| Reduced motion respected | **Fails completely.** **Zero** `prefers-reduced-motion` handling in `apps/web` or `packages/ui`. 161 fade-and-slide-up instances and 115 `whileInView` scroll reveals across 99 of 139 files, all unconditional |
| Body line length < 80ch | **Unverified.** 51 uses of `max-w-4xl` (56rem ≈ 100ch at 16px) suggest prose blocks run long |
| Motion deliberate and sparse | **Fails by the brief's own definition.** 161 fade-and-slide-ups + 115 scroll reveals is exactly the pattern §3 names as the generic default |
| Contrast (not in §3 but implied by AA) | **At least one measured failure:** footer body copy at 4.18:1 (§8.5). Full sweep belongs in Phase 6 against the new token set |
| Semantic HTML before ARIA | **Mixed.** Nested `<main>`, nav and footer inside `<main>`, no skip link. Heading structure is composed through hero components (17 render an `<h1>`, several as `<motion.h1>`), so `<h1>` coverage cannot be settled statically — 15 public pages render no heading in their own markup and delegate entirely to children. **Confirm per page in the browser during Phase 6.** No raw `<img>` anywhere (0 instances), which is good. 24 files use ARIA attributes appropriately |

### 10.1 Performance baseline

From the 2026-08-27 production build:

| Metric | Value |
|---|---|
| `.next/static` total | 3.5 MB |
| Client JS chunks | 94 files |
| Largest chunk | 314.5 KB |
| Top 5 chunks | 314.5 + 227.8 + 135.2 + 130.9 + 125.1 KB = 933.5 KB |
| Prerendered route entries | 47 |
| Dynamic route shells | 11 |
| `public/images` total | ~3.5 MB |
| Largest unused asset | `person-placeholder.jpg` — 1.47 MB, zero references |
| Other heavy assets | `business-hotspot.png` 718 KB · `bedrift.png` 551 KB · `hero-bg.png` 457 KB |
| Fonts | Inter (Google, subsetted) + Museo Sans 300 (`.otf`, 62 KB, unsubsetted, **never rendered**) |

**Captured 2026-08-31 in RD-001** — see `docs/redesign/baseline/`. Core Web Vitals were measured over the DevTools Protocol against the standalone production server (no Lighthouse CLI was installed; no dependency added). Headline: mobile LCP is **4.2–5.4 s on four of five top routes** (the "poor" band), TTFB is **2 ms**, and JS is **~357 KB on every route**, varying under 3% between the homepage and a content page. The server is not the bottleneck; the uniform client bundle is.

### 10.2 Brand assets

The BISO logo exists **only as PNG**, in four variants: `home-logo.png` (9.5 KB), `logo-dark.png` (37 KB), `logo-light.png` (40 KB), `logo-home.png` (23 KB). There is no SVG BISO mark. The only SVGs in the app are `BI_POSITIVE.svg` (BI's own logo) and the two Vipps marks. The chosen reference direction's angled chevron motif has no vector source in the repo today.

---

## 11. The five things that will make this redesign hardest

### 11.1 The design tokens live in a shared package, and a test enforces it

The entire BISO palette and both font wirings live in `packages/ui/styles/biso-surface.css` — outside the stated scope. `apps/web/src/app/styles.test.ts` actively asserts that `--brand:`, `--inverted:` and `--section:` **must not** appear in `apps/web/src/app/styles.css`, and that the surface file **must** reference `var(--font-inter)` and `var(--font-museo)`.

So the redesign cannot define its own palette or typefaces inside `apps/web` without failing an existing test. The surface is also mounted on `apps/admin`'s page-editor canvas, so changing it changes what editors see while authoring.

There are three ways out, and this is a decision for you, not for me:

| Option | Blast radius | Cost |
|---|---|---|
| **A.** Edit `biso-surface.css` in place | `apps/admin` editor canvas re-skins with it | Lowest effort; arguably correct, since the editor canvas *should* preview the public surface |
| **B.** Add a second surface class (e.g. `.biso-surface-v2`) beside the existing one, mount it only on `apps/web` | None until `apps/web` switches | Still a shared-package edit, but additive and reversible; gives Phase 4 its old/new comparison mechanism for free |
| **C.** Define tokens locally in `apps/web` and amend `styles.test.ts` | None | Contradicts the deliberate architecture the test was written to protect |

My recommendation is **B**: it is additive, it cannot break `admin`, and it doubles as the Phase 4 old/new switch. But it is still a `packages/` edit, so per the brief I am stopping to ask rather than assuming.

### 11.2 The display typeface cannot render the chosen direction

The reference direction calls for heavy uppercase display type. The app ships **Museo Sans 300 — Light, one weight**, as an unsubsetted `.otf`, wired to a `font-display` utility that **appears zero times in the markup**. Every visible character on the site today is Inter.

So the "display face" is simultaneously a 62 KB tax on every page load and completely invisible. Fixing it means sourcing a heavy weight (Museo Sans 700/900, licensed, or a substitute), converting to `.woff2`, and changing the font wiring — which is in the same shared file and the same test as §11.1. Typography is therefore not a Phase 3 detail; it is a licensing and scope question that should be settled before Phase 1 finalises the token system.

### 11.3 Campus is the site's primary filter and it has no URL

Campus scoping touches events, news, jobs, departments, partners and the member portal — and it is expressed **only** as invisible client state. There is no `/oslo/*` segment, no query parameter, no `hreflang`-style alternate. The single exception is `/units/<campus>/<slug>`.

Three consequences for the design:

- A campus-specific page **cannot be linked, shared, or bookmarked**. Sending a friend "the Bergen events page" is impossible.
- The three sources of truth disagree on first visit (§6.5): the switcher can read "Oslo" from `localStorage` while the server, seeing no cookie, renders unfiltered content.
- Every campus switch calls `router.refresh()` — a full server round-trip re-rendering the entire tree.

The reference designs differ on how campus is expressed, so Phase 1 has to pick. Any option that puts campus in the URL is a routing change touching all six feeds and the sitemap — that is a genuine architectural work package, not a nav restyle, and it needs its own decision before Phase 2 can sequence the work.

### 11.4 78% of components are client components, and 99 of them animate

108 of 139 components are `"use client"`, 99 import `motion`, and there are **161 fade-and-slide-up instances and 115 `whileInView` scroll reveals with zero `prefers-reduced-motion` handling anywhere**.

This is both a quality-floor failure and the exact pattern the brief calls out as the generic default. It cannot be fixed component-by-component during page migration without the migration becoming a rewrite — 99 files is most of the app.

Compounding it: **two animation libraries ship simultaneously** (`motion/react` in 92 files, `framer-motion` in 6). And roughly a dozen pages are client components purely because they call `useTranslations()` at render, which in turn forces three `layout.tsx` files to exist solely to carry metadata those pages cannot export.

The realistic approach is a single Phase 3 work package that establishes one motion primitive honouring `prefers-reduced-motion`, then a mechanical sweep — not per-page fixes.

### 11.5 There is no layout vocabulary to redesign against

There are **176 hand-rolled `mx-auto max-w-*` containers across 7 different widths**, 4 competing section rhythms (`py-16` 85×, `py-12` 34×, `py-24` 11×, `py-20` 7×), 8 border radii, 4 backdrop-blur levels, 278 gradients, and 4 different `pt-*` values compensating for the same fixed nav. Only three genuinely shared presentational primitives exist in the whole app (`section-heading` 3×, `step-card` 2×, `public-page-header` 3×).

Meanwhile **711 colour utilities across 78 of 139 files bypass the token system entirely**, and five variants in the shared `Button` and `Card` reference colour names that were never defined anywhere in the repo — so `variant="gradient"`, used 3 times in `apps/web`, silently renders as a plain primary button.

There is no `<Container>`, no `<Section>`, no `<PageHeader>` to restyle. Every page composes its own layout from raw utilities. Phase 3 therefore has to *create* the vocabulary before Phase 5 has anything to migrate onto — and Phase 5's per-page work is closer to "recompose against new primitives" than "restyle existing ones". That should be reflected in how Phase 2 sizes the page packages.

---

## Appendix A — Corrections to `apps/web/CLAUDE.md`

| Claim | Reality at `c82f70d3` |
|---|---|
| "Top-level: `app/layout.tsx` (sets `dynamic = "force-dynamic"`…)" | Root layout sets `export const instant = false`. No `dynamic` export |
| "`next.config.ts` sets `typescript: { ignoreBuildErrors: true }` — `next build` will not catch type regressions" | No `typescript` block in `next.config.ts`. (`bun run check-types` is still the right command, but the stated reason is wrong) |
| "`images.remotePatterns` only allows `appwrite.biso.no`, `biso.no`, and `via.placeholder.com`" | `static.tickster.com` is also allowed |

## Appendix B — Verification commands

```bash
# Component client/server split
find src/components -name "*.tsx" | while read f; do head -5 "$f" | grep -q '"use client"' && echo C || echo S; done | sort | uniq -c

# Off-token colour utilities
grep -rhoE '\b(bg|text|border|from|to|via|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' src --include="*.tsx" | wc -l

# Motion audit
grep -rhoE 'initial=\{\{ opacity: 0, y: [0-9]+ \}\}' src --include="*.tsx" | wc -l
grep -rho 'whileInView' src --include="*.tsx" | wc -l
grep -rn "prefers-reduced-motion\|useReducedMotion" src ../../packages/ui   # → no matches

# i18n key parity
node -e 'const fs=require("fs");const flat=(o,p="")=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==="object"&&!Array.isArray(v)?flat(v,p+k+"."):[p+k]);let a=0,b=0;for(const f of fs.readdirSync("messages/en")){a+=flat(JSON.parse(fs.readFileSync("messages/en/"+f))).length;b+=flat(JSON.parse(fs.readFileSync("messages/no/"+f))).length}console.log(a,b)'   # run in packages/i18n → 3580 3580

# Rendering strategy from the build
node -e 'const m=require("./.next/prerender-manifest.json");console.log(Object.keys(m.routes).length,"prerendered;",Object.keys(m.dynamicRoutes).length,"dynamic")'

# font-display never used
grep -rn 'className="[^"]*font-display' src --include="*.tsx" | wc -l   # → 0
```
