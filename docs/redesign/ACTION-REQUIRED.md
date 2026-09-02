# Action required — the work only you can do

**The code is finished.** All 34 packages of the `apps/web` redesign are done,
`main` is deployable, and nothing below blocks shipping. Everything here needs
something I could not supply: BISO's own content, a schema change, an
external console, or a decision that is yours.

Ordered by what unblocks the most. Nothing in **§5** is a task — it is context so
you are not surprised by it later.

| | Group | Items | Effort |
|---|---|---|---|
| §1 | Empty database tables — pages render, with nothing in them | 8 | Content work |
| §2 | Schema columns that don't exist yet | 3 | Appwrite console + regenerate types |
| §3 | Content and assets BISO owns | 5 | Writing / brand |
| §4 | Decisions | 5 | Judgement |
| §5 | Known issues being carried deliberately | 3 | None — read only |
| §6 | Cleanup from my testing | 3 | Two minutes |

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

---

## §3 · Content and assets BISO owns

| ID | Needed | Why I stopped |
|---|---|---|
| **PLACEHOLDER-001** | **The BISO logo and chevron as SVG** | Only a PNG exists, in four variants. This blocks a crisp header lockup and the decorative marks in `<ChevronFrame>`. The highest-leverage single asset on this list |
| **PLACEHOLDER-008** | **The alumni site URL** | `/about/alumni`'s CTA reads "Go to Alumni site" — it always meant an *external* site, and no such URL exists anywhere in the repo. The button is withheld rather than pointed at a guess |
| **PLACEHOLDER-012** | **A Norwegian privacy statement** | `/privacy` is **English only**. The `privacy` message namespace holds a *different*, shorter five-section summary in both locales; substituting it would publish a weaker policy than the one BISO wrote, so I did not. Its "Last updated: December 2024" is kept verbatim — restamping it would assert a review that has not happened |
| — | **Five Norwegian document-category labels** | `documents.categories.*`. "Lokale vedtekter" and "Næringslivsreglement" are *my* rendering of BISO's own governing-document names, not BISO's. **The keys on this list most worth a human check** — `packages/i18n/messages/no.ts` |
| **PLACEHOLDER-004** | **A member count, or a decision not to publish one** | The reference design shows "1000+ Active Members". `cachedHomeCounts` returns only `eventCount` + `jobCount`. Member numbers are not public data, so the tile is omitted entirely rather than guessed. A `departments` count *is* available if you want a third stat |

---

## §4 · Decisions

| Question | Options | My recommendation |
|---|---|---|
| **Header search** (PLACEHOLDER-006) | There is **no search anywhere in `apps/web`**. Build it as its own work package, or leave the icon out | Leave it out until it is real. A decorative search field that does nothing is worse than none |
| **Notification bar** (PLACEHOLDER-005) | No push infrastructure exists. Omit, or repurpose the slot for a real announcement | Repurpose it if you have announcements worth the space; otherwise omit |
| **Museo Sans 900** (GATE-2) | The redesign ships Archivo 800–900. If BISO holds a **web** licence for Museo Sans 900, that is the brand-correct display face | Swapping back is two lines: `apps/web/src/app/fonts.ts` and the `--font-biso-display` line in `packages/ui/styles/biso-surface.css`. Worth checking the licence |
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

## Where the rest of the detail lives

| Document | What it holds |
|---|---|
| [`STATUS.md`](STATUS.md) | Per-package log for all 34 packages, newest first, with every deviation and finding |
| [`03-results.md`](03-results.md) | Phase 6: before/after routes, bundle and Core Web Vitals, with method |
| [`01-design-spec.md`](01-design-spec.md) | The design system, and the full `PLACEHOLDER-###` registry |
| [`02-plan.md`](02-plan.md) | The 34 work packages and their dependency graph |
| [`00-current-state.md`](00-current-state.md) | The pre-redesign audit |
| [`baseline/`](baseline/) | Measurement artefacts and the collectors, so any of it can be re-run |
