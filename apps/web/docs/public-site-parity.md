# Public Site Parity & Migration Plan

Purpose: Track parity between the legacy WordPress site (biso.no) and this Next.js app, list missing pages, redirects, SEO tasks, and safety fixes. Update this doc as we implement.

Scope: Public‑facing content only (not admin). Sources include biso.no sitemaps and current routes under `src/app/(public)`.

Status: Draft (to be updated as pages ship)

Owners: Web team (content), Dev team (routing/SEO). Add specific owners per item.

---

## 1) Page Worklist (Missing vs. WordPress)

Legend: [P1] launch‑blocker, [P2] should‑have, [P3] nice‑to‑have

- Policies & legal
- [P1] Purchase Terms (WP: `/kjopsvilkar`, `/en/purchase-conditions`) → App: `/terms` (ADDED)
- [P1] Privacy Policy (WP: `/personvern`, `/en/privacy-policy`) → App: `/privacy` (ADDED)
- [P1] Cookies Policy (WP: `/cookies`, `/en/cookies`) → App: `/cookies` (ADDED)
  - [P2] Drugs/Alcohol Policy (WP: `/ruspolicy`, `/en/drugs-policy`) → App: `/policies/drugs-policy` (or `/about/policies/drugs-policy`)

- Press & media
  - [P2] Press/Media page (WP: `/biso-media`) → App: `/press` (logo pack, brand usage, press contact)

- Academics
  - [P2] Academics contact (WP: `/academics-contact`) → App: `/about/academics-contact` (or fold into Study Quality)

- Volunteering & involvement
- [P2] Apply for volunteer (WP: `/sok-utvalg`, `/en/apply-for-volunteer`) → App: `/volunteer` (explainer + CTA → `/jobs`)

- Funding
  - [P2] Apply for economic support (WP: `/sok-okonomisk-stotte`) → App: alias to `/bi-fondet` or short landing that points there

- Businesses/partners
- [P2] Business Hotspot standalone (WP: `/business-hotspot`, `/en/business-hotspot`) → App: `/business-hotspot` (currently only a section on `/partner`)
  - [P3] Campus‑specific business pages (WP: `/partnersoslo`, `/campus-oslo-bedrifter`, +en variants) → App: parameterize `/partner?campus={id}` or add `/partner/{campus}`

- Campus pages
- [P2] WordPress has `/campus/{oslo|bergen|trondheim|stavanger}`; App has a single `/campus` with a switcher. Plan 301 redirects (see Redirects). Footer links now point to query‑param routes (DONE).

- Legacy/assorted
  - [P3] Inspire (WP: `/inspire`, `/en/inspire`) → 301 to `/news` (if blog‑style content)
  - [P3] BISO news (WP: `/biso_news`) → 301 to `/news`
  - [P3] AU page (WP: `/au-2`) → merge with `/about/operations` or add specific AU section

- E‑commerce account (optional)
  - [P3] WooCommerce My Account (WP: `/min-konto`, `/en/my-account`) → App: `/profile` exists; optionally add “My orders” list


## 2) Redirect Plan (WordPress → App)

Implement permanent redirects. In this app we use Next.js `redirects()` (build‑time) which emits 308 Permanent Redirect (SEO‑equivalent to 301, method‑preserving). Core mappings:

- Campus
  - `/campus/:slug` → `/campus?campus=:slug`

- Jobs (AWsm Job Openings)
  - `/undergruppe/*` → `/jobs` (or per‑slug mapping once migrated)

- Events (The Events Calendar)
  - `/event/*` → `/events`
  - `/events` → `/events` (same list)

- Shop
  - `/nettbutikk` → `/shop`
  - `/handlekurv` → `/shop/cart`
  - `/kassen` → `/shop/checkout`
  - `/vipps_checkout*` → `/shop/checkout`

- News & misc
  - `/nyheter` → `/news`
  - `/biso_news` → `/news`
  - `/inspire` and `/en/inspire` → `/news`

- Policies & legal
  - `/kjopsvilkar`, `/en/purchase-conditions` → `/terms`
  - `/personvern`, `/en/privacy-policy` → `/privacy`
  - `/cookies`, `/en/cookies` → `/cookies`
  - `/ruspolicy`, `/en/drugs-policy` → `/policies/drugs-policy`

- Partners/Business
  - `/business-hotspot`, `/en/business-hotspot` → `/partner`
  - `/partnersoslo`, `/campus-oslo-bedrifter` → `/partner?campus=oslo`

- Volunteering/Funding
  - `/sok-utvalg`, `/en/apply-for-volunteer` → `/jobs` (until `/volunteer` exists)
  - `/sok-okonomisk-stotte` → `/bi-fondet`


Note: If hosting requires, these rules can be replicated at the reverse proxy (e.g., Nginx/Traefik) instead of Next.js; but using `redirects()` keeps them versioned with code and is compatible with Appwrite Sites.

## 3) SEO & Indexing Tasks

- [P1] Add `src/app/robots.ts` (disallow admin, allow app routes) and `src/app/sitemap.ts` with:
  - Static pages listed above
  - Dynamic content: news, events, jobs, projects
  - i18n alternates (`no`/`en`) where applicable
- [P1] Add `generateMetadata` to key pages (Home, Campus, News list/detail, Events list/detail, Jobs list/detail, Projects, Students, About, Shop, and all new policy/press pages)
- [P1] robots + sitemap added (DONE). Metadata added for new policy pages.
- [P2] Add JSON‑LD structured data where useful:
  - Organization for Home/About, Event for event details, NewsArticle for news, Product for products, BreadcrumbList on content detail
- [P2] Add favicons/app icons + manifest and Open Graph/Twitter metadata


## 4) Public Data Safety (Critical)

Ensure public endpoints never leak drafts:

- [P1] Force published/open in public lists and details (ignore `status` query for anonymous users):
  - Events: `/events` and details use only `published`; no draft/cancelled in public filter
  - News: `/news` uses only `published`
  - Jobs: lists use `published`; closed allowed on detail, drafts hidden
- [P1] Search API (`src/app/api/search/route.ts`) must filter parent content by status to exclude drafts
  - Implemented for jobs/news/events


## 5) Navigation & Discovery

- [P2] Implement `/search` page (UI) and wire header search button to open it or a modal
- [P2] Update Footer links in `src/app/(public)/layout.tsx` to real routes:
  - Campuses → `/campus?campus={id}` for each campus
  - Contact, Privacy → new routes below


## 6) New Routes To Add (App)

- [P1] `/privacy` — content parity with WP
- [P1] `/cookies` — list cookie categories and purposes
- [P1] `/terms` — purchase conditions (Vipps/e‑commerce)
- [P2] `/policies/drugs-policy` — reference student conduct where relevant
- [P2] `/press` — logos, brand usage, press contact
- [P2] `/volunteer` — explain process, link to `/jobs`
- [P2] `/business-hotspot` — standalone page; keep section in `/partner`
- [P2] `/contact` — campus selection, addresses, emails, general form
- [P3] `/about/academics-contact` — or fold into Study Quality


## 7) Implementation Milestones

Milestone A – Launch blockers (P1)
- Add `/privacy`, `/cookies`, `/terms`
- Lock down public content (status filtering) and search API
- Add `robots.ts`, `sitemap.ts`, and metadata on key pages
- Update footer links to real routes

Milestone B – Parity (P2)
- Add `/contact`, `/policies/drugs-policy` (DONE)
- Add `/press`, `/volunteer`, `/business-hotspot` (DONE)
- Add `/about/academics-contact` (or integrate)
- Implement `/search` UI
- Add JSON‑LD to priority pages

Milestone C – Nice‑to‑have (P3)
- Campus‑specific partner pages/params
- My orders section in `/profile` (if desired)
- Clean up legacy aliases (`/inspire`, `/biso_news`, `AU` page)


## 8) Content & i18n Checklist

For each new route, ensure:
- [ ] Content parity (no/en)
- [ ] Breadcrumbs via `PublicPageHeader`
- [ ] Translations added to `messages/{no,en}`
- [ ] SEO metadata (title, description, canonical, i18n alternates)
- [ ] JSON‑LD where applicable


## 9) Open Questions

- Press page owner and media assets source of truth?
- Should Business Hotspot be its own page in nav or remain nested under Partner?
- Academics contact: separate page or merge under Study Quality?
- My orders history needed for v1, or later?


## 10) Appendix – Reference Files

- App public routes: `src/app/(public)`
- Header: `src/lib/components/Header/index.tsx`
- Footer: `src/app/(public)/layout.tsx`
- Campus context: `src/components/context/campus.tsx`
- Search API: `src/app/api/search/route.ts`
- Cookie banner: `src/components/cookie-consent.tsx`
