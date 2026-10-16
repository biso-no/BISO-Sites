# Action required — the work only you can do

**The code is finished.** All 34 packages of the `apps/web` redesign are done,
`main` was merged in on 2026-10-15 (every page is on the redesign), the branch is deployable, and nothing below blocks shipping. Everything here needs
something I could not supply: BISO's own content, a schema change, an
external console, or a decision that is yours.

Ordered by what unblocks the most. Nothing in **§5** is a task — it is context so
you are not surprised by it later.

| | Group | Items | Effort |
|---|---|---|---|
| §1 | Empty database tables — pages render, with nothing in them | 8 | Content work |
| §2 | Schema columns that don't exist yet | 4 | Appwrite console + regenerate types |
| §3 | Content and assets BISO owns | 6 | Writing / brand |
| §4 | Decisions | 5 | Judgement |
| §5 | Known issues being carried deliberately | 4 | None — read only |
| §6 | Cleanup from my testing | 3 | Two minutes |
| §7 | Raised by the `main` merge | 6 | Mixed — see each row |

Every `PLACEHOLDER-###` below is also an inline comment at the exact place in the
code it affects, so `grep -rn "PLACEHOLDER-009" apps/web/src` takes you straight
there. **No placeholder invents content** — a page with no data omits the section
entirely rather than showing filler, so filling a table is the only step needed
to make it appear. None of them require code changes.

---

## §1 · Empty tables

These are the biggest ones. In every case the schema already supports the field,
the page already renders it, and the table has **zero rows**. Writing rows is the
whole task.

| ID | Table | What is dark today | Where |
|---|---|---|---|
| **PLACEHOLDER-009** | `campus_metadata`, `campus_data` | Campus tagline, description, highlights, focus areas, team, partners, benefits, photo collage. `campus` carries a name and an email and nothing else | `/campus/[slug]` — all five |
| **PLACEHOLDER-010** | `departments.logo` / `.hero` / `.type`, `content_translations` | Null on **all 280 rows**; `content_translations` holds **zero** department rows. Units render from name + abbreviation + slug alone | `/units`, `/campus/[slug]` |
| **PLACEHOLDER-010** | `department_board` | Empty. No unit has a listed board | `/units/[...segments]` |
| **PLACEHOLDER-011** | `large_event` | Empty. The four projects on `/projects` come from the message bundle, and their gradients from constants in the page file. `primaryColorHex`, `gradientHex[]`, `textColorHex`, `heroOverrideEnabled` all exist and hold nothing | `/projects`, `/projects/[slug]` |
| **PLACEHOLDER-013** | `funding_programs` | Empty. `/bi-fondet` is two sentences plus two "will be published soon" notices where eligibility and application steps belong. **Who may apply and what the fund grants are BISO's to state** | `/bi-fondet` |
| **PLACEHOLDER-014** | `documents` | Zero published rows. The empty state is what the route actually serves — so the list, the chips and both per-row actions are **unverified against real data** | `/documents` |
| — | `feature_flags` | Empty | — |
| — | `expense`, `job_applications` | Empty, so `/fs` and `/applications` were verified against their empty states only | `/fs`, `/applications` |

> **Worth knowing:** `campus_data` being empty is why `/students`'s member-benefits
> block renders nothing. The 18 real benefit rows are in `campus_benefits` and
> already show on `/membership#fordeler` — so this may be a data-location
> question rather than missing content.

---

## §2 · Schema columns that do not exist

Each needs a column added in the Appwrite console, then
`appwrite types -l ts ./types` to regenerate `packages/api/types/appwrite.ts`.
Until then the corresponding UI is deliberately absent, not broken.

| ID | Add | To | Unlocks |
|---|---|---|---|
| **PLACEHOLDER-002** | `workload_pct: integer?` | `jobs` | The "20% / 15% / 10%" workload badge on job cards |
| **PLACEHOLDER-003** | `category` enum | `news` | News category pills. Mirror the 8-value `EventsCategory` that already exists. Today `News` has only `metadata: string[]`, untyped and unvalidated |
| **PLACEHOLDER-007** | `email` | `department_board` | The email icon on contact cards. `Campus.email` works as a fallback, or link to `/contact` instead |
| — | ~~`paid_at: datetime?`~~ | `orders` | **No longer needed (2026-10-15).** This was the residual of the redesign's accrual-from-purchase-date fix. The merge with `main` reverted that fix: main's 24SO catalog sells one plan per season (and next season's in June and December), so the plan's own start date is the correct accrual date and the purchase moment no longer matters |

---

## §3 · Content and assets BISO owns

| ID | Needed | Why I stopped |
|---|---|---|
| **PLACEHOLDER-001** | **The BISO logo and chevron as SVG** | Only a PNG exists, in four variants. This blocks a crisp header lockup and the decorative marks in `<ChevronFrame>`. The highest-leverage single asset on this list |
| **PLACEHOLDER-008** | **The alumni site URL** | The alumni section of `/about` (formerly `/about/alumni`) has a "Go to Alumni site" CTA — it always meant an *external* site, and no such URL exists anywhere in the repo. `main`'s merged page pointed it at `/alumni`, which is not a route either. The button is withheld rather than pointed at a guess |
| **PLACEHOLDER-012** | **A Norwegian privacy statement** | `/privacy` is **English only**. The `privacy` message namespace holds a *different*, shorter five-section summary in both locales; substituting it would publish a weaker policy than the one BISO wrote, so I did not. Its "Last updated: December 2024" is kept verbatim — restamping it would assert a review that has not happened |
| — | **Five Norwegian document-category labels** | `documents.categories.*`. "Lokale vedtekter" and "Næringslivsreglement" are *my* rendering of BISO's own governing-document names, not BISO's. **The keys on this list most worth a human check** — `packages/i18n/messages/no.ts` |
| — | **Norwegian phrasing for `students.*` when a campus is named** | `students.hero.title`, `hero.badge`, `units.title` and `benefits.subtitle` all interpolate `på {campus}`. That is correct for the default — "på alle campus" — and wrong for a city: `/students?campus=bergen` renders "Alt du trenger for å trives **på Bergen**". Norwegian wants *i Bergen* or *på campus Bergen*, and neither substitutes cleanly into the "alle campus" case, so this is a copy decision rather than a find-and-replace. Pre-existing — the page has always taken the campus from the cookie — but far easier to hit now that the switcher puts the campus in the URL. `packages/i18n/messages/no/students.json` |
| **PLACEHOLDER-004** | **A member count, or a decision not to publish one** | The reference design shows "1000+ Active Members". `cachedHomeCounts` returns only `eventCount` + `jobCount`. Member numbers are not public data, so the tile is omitted entirely rather than guessed. A `departments` count *is* available if you want a third stat |

---

## §4 · Decisions

| Question | Options | My recommendation |
|---|---|---|
| **Header search** (PLACEHOLDER-006) | There is **no search anywhere in `apps/web`**. Build it as its own work package, or leave the icon out | Leave it out until it is real. A decorative search field that does nothing is worse than none |
| **Notification bar** (PLACEHOLDER-005) | No push infrastructure exists. Omit, or repurpose the slot for a real announcement | Repurpose it if you have announcements worth the space; otherwise omit |
| ~~**Museo Sans 900** (GATE-2)~~ | **Resolved 2026-10-15.** The Branding Committee supplied Museo Slab 700/900 and Museo Sans 700; the site now sets display type in Museo Slab and body in Museo Sans | One follow-up: the four faces ship as `.otf` (~220 KB, all preloaded). Converting them to subsetted `.woff2` would cut most of that, but `apps/web/CLAUDE.md` lists font binaries as do-not-touch, so it needs your go-ahead |
| **`/units?campus=` and `/shop?campus=` in the sitemap** | Both scope server-side now and both are absent from `sitemap.xml`, unlike `/events`, `/news` and `/jobs` | Leave them out. All 141 `/units/<campus>/<slug>` pages are already listed — that is the campus content a crawler wants — and the filtered index would add five near-duplicates. Both now carry a canonical pointing at the unscoped URL either way |
| **`packages/api/file.ts`** | It was deleted in the working tree, **not by me** — a one-line `export { InputFile } from "node-appwrite/file"` that five call sites across both apps import. `node-appwrite@28` still exports `./file`, so I restored it | Keep it. If the deletion was deliberate, `git rm packages/api/file.ts` and fix the five importers |

### Facebook sign-in is broken, and it is not a code fix

Appwrite answers `createOAuth2Token` with **`Invalid redirect`** for Facebook,
while **Google and Apple succeed from the same origin with the same code path**.
That points at the provider's redirect-URI configuration in the Appwrite console,
not at `apps/web`. Microsoft is listed in the plan as a working provider but is
**dead code** — it is not wired up.

---

## §5 · Known issues being carried — not tasks

These are documented so nobody rediscovers them as bugs. Full evidence in
[`03-results.md`](03-results.md).

**Every 404 answers HTTP 200** (FINDING-E). Users see the correct not-found page;
crawlers see a 200, so unknown URLs are indexable. **Proven unfixable from page
code** — I built four probe routes to settle it. Under `cacheComponents`, no page
can set a 404 status; only route handlers can, and a 404 that depends on a
database lookup cannot become a route handler. Disabling `cacheComponents` fails
to build on 22 route files using `instant` and 13 files using `"use cache"`. This
predates the redesign and is identical in the pre-redesign build.

**Three-quarters of every HTML document is the same message bundle, twice.**
`NextIntlClientProvider` serialises the *entire* bundle into every page — once in
the SSR HTML, once in the RSC flight payload. Two identical 188,898-byte blocks
are **75–76% of the document** on `/`, `/contact`, `/news` and `/jobs`. This
predates the redesign (the baseline does it at 2 × 174,385 B) but is **the largest
performance item left in `apps/web`**. The fix is to pass the provider only the
namespaces a page's client components actually read. It needs nothing from this
redesign.

**The desktop header bar has 4px of gutter left, not 32.** *(2026-10-15: largely handled — the merge brought main's overflow "…" menu into the redesign header, so Business, Shop and News fold into it, in that order, when the row runs out of room. The measurement below describes the bar before that.)* Measured at its
1340px breakpoint: logo 161 + menu 516 + utilities 595 + two 16px gaps = 1304
inside a 1276 content box, so the row eats 28 of its own 32px right gutter.
Nothing clips, nothing overflows and no control is off-screen — it just has no
slack (27px at 1366, comfortable from 1440 up). This predates the campus work:
the 547px figure the source comment quoted was written before the theme
switcher joined the row and was never re-measured. **Anything added to that bar
has to displace something**, which is why the link to a campus's page lives in
the "For students" panel rather than beside the campus filter. Buying slack
means shortening a control — the locale switcher's "🇳🇴 Norsk" is the widest
non-CTA item at 113px — or raising the 1340px breakpoint, which would push
1366px laptops to the hamburger. Neither is worth doing on my judgement alone.

**`/shop` mobile LCP regressed, 1,476 → 3,088 ms** — the only route that got
worse. It is gated on delivery of the HTML document (removing the network
throttle alone drops it to 404 ms), which is the message bundle above. Fixing
that fixes this.

---

## §6 · Cleanup from my testing

Small, and all in Appwrite rather than the repo.

1. **4 `cart_reservations` rows** created while testing the shop checkout flow.
2. **4 anonymous Appwrite users** created by the same tests.
3. **The `claude@test.com` account has a `user` profile row** that onboarding
   wrote during RD-029. I deleted that row once to re-run the create path, and it
   was written again. Delete the account and the row whenever you like.

I never typed the password you gave me into a login form — sessions were minted
server-side with the admin key instead. No magic-link email was sent, and OAuth
providers were verified with external requests stubbed locally, so Google,
Facebook and Apple were never contacted.

---

## §7 · Raised by the `main` merge (2026-10-15)

None of these block shipping. Each was found while reconciling the two
branches and left as is because it is a product decision or predates both.

| Item | What | Suggested next step |
|---|---|---|
| **"Export data" on `/profile` is a stub** | On both branches the button waits 1.5 s and tells the user their data will be emailed within 30 days — nothing is sent. GDPR access requests are real obligations | Wire it to a real request (an email to the privacy contact, or an admin queue), or remove the button and point to the contact address in the privacy policy |
| **Membership copy states a price** | `membership.json`'s FAQ and CTA copy still says "NOK 550" while the page's plans and prices come from the 24SO catalog | Remove the figure from the copy, or let it be interpolated from the catalog |
| **Feed totals can be the whole table** | `main` notes (`countRows` in `lib/data/queries.ts`) that Appwrite's `listRows().total` now reports the table size, not the filtered count. The events and jobs feeds guard the display (a short page ends the list and is the count), but a full first page still shows Appwrite's figure | Count with `countRows` inside `queryEvents` / `listJobs` |
| **Some readers still turn failures into empty lists** | `listProducts`, `getProductDetailBySlug`, `listJobs` and `listJobFacets` return `[]`/`null` on any error, which #77 set out to stop: an outage shows an empty shop or a 404 | Let them throw and catch at the call site, as `lib/data/units.ts` does |
| **`/students` benefits** | The section is omitted when the campus has no benefit rows, instead of main's "will be published soon" placeholder (spec §6 rule) | Write the `campus_benefits` rows, or decide you want the placeholder back |
| **`@repo/editor` type-check** | `src/lib/sanitize.test.ts` imports `happy-dom`, which no `package.json` declares — fails on `main` too | Add `happy-dom` as a dev dependency of `packages/editor` |

---

## Where the rest of the detail lives

| Document | What it holds |
|---|---|
| [`STATUS.md`](STATUS.md) | Per-package log for all 34 packages, newest first, with every deviation and finding |
| [`03-results.md`](03-results.md) | Phase 6: before/after routes, bundle and Core Web Vitals, with method |
| [`01-design-spec.md`](01-design-spec.md) | The design system, and the full `PLACEHOLDER-###` registry |
| [`02-plan.md`](02-plan.md) | The 34 work packages and their dependency graph |
| [`00-current-state.md`](00-current-state.md) | The pre-redesign audit |
| [`baseline/`](baseline/) | Measurement artefacts and the collectors, so any of it can be re-run |
