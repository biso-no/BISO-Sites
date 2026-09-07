# Phase 1 — Design spec

**Date:** 2026-08-31
**Direction:** `docs/redesign/reference/1.png`
**Depends on:** `00-current-state.md`
**Status:** spec only. No code changed.

All three references were read. 2.png and 3.png are cited where they clarify a
choice 1.png leaves ambiguous — chiefly the campus model, where all three
differ.

Every colour, angle and type metric below was **measured from `1.png`** with a
pixel sampler, not eyeballed. Where a measured value fails an accessibility
floor, that is stated and a corrected value is given (§1.2).

---

## 0. The one-paragraph version

BISO is five campuses pretending to be one website. The current site expresses
campus as an invisible dropdown; the chosen reference expresses it three times
above the fold — in the logo lockup, in a header pill, and as a sentence in the
hero. **The redesign's job is to make campus a place you can be, rather than a
filter you can set.** The angled chevron is the device that carries it: the
hero's sheared photo panels are that campus's face, and the same sheared frame
recurs at card scale so the whole site reads as one system. Everything else —
type, colour, spacing — stays disciplined so the chevron and the display type
are the only things anyone remembers.

---

## 1. Token system

### 1.1 Colour — six named values

Measured from `1.png`. Notably, the reference's navy, blue and yellow sit within
1–6 points per channel of the values already hardcoded 27 times across
`apps/web` (`#001731`, `#3DA9E0`, `#F7D64A`) — the mockup is using BISO's real
brand, so the redesign consolidates existing values rather than introducing new
ones.

| Token | Hex | Measured from | Role |
|---|---|---|---|
| `--biso-deep` | `#001A35` | hero field, dark panels, footer | Navy. Primary dark surface **and** the ink colour on light |
| `--biso-blue` | `#1668AE` | header CTA, corrected (§1.2) | Action. Button fills, links, focus rings |
| `--biso-sky` | `#3AA3E1` | "TOMORROW", chevron shape, promo card | Brand blue. Display accent and chevron fill — **on navy only** |
| `--biso-sun` | `#FECD45` | heading underline, hero squiggle, notice bar | Marker. Collection headings and notices |
| `--biso-paper` | `#FFFFFF` | page and card ground | Page surface |
| `--biso-line` | `#E8ECF0` | card hairline (measured `#EFEFEF`, cooled) | Borders and rules |

Three support values, needed because the six above cannot express state:

| Token | Hex | Role |
|---|---|---|
| `--biso-success` | `#187244` | "Register" pill, confirmations. Darkened from `#1B7F4B` in RD-011 — the original is 5.02:1 on paper but **4.39:1 on its own tint**, which is how a status pill uses it |
| `--biso-warning` | `#8A5A00` | Deadlines, capacity warnings |
| `--biso-danger` | `#B3261E` | Errors, destructive actions |

### 1.2 The reference's button blue fails AA — corrected

The header CTA in `1.png` measures `#217EC7`. White text on it is **4.31:1**,
below the 4.5:1 floor. White on the hero's lighter `#3AA3E1` is **2.80:1** —
well below.

Resolution: keep `#3AA3E1` exactly where the reference actually uses it — as
display accent and chevron fill **on navy**, where it measures 6.26:1 — and
introduce `#1668AE` for anything that carries text on a light surface. It is
the same hue family (207° vs 203°) and reads as the same blue, and it is
**5.79:1 in both directions**: usable as a fill under white text and as link
text on white. One action colour, two directions, no exceptions to remember.

### 1.3 Semantic aliases

Consumers use these, never the raw six.

> **Amended 2026-08-31 during RD-011.** The three state colours were defined in
> §1.1 as single values with no dark variant, unlike every semantic alias below.
> That held until `<Pill>` became the first component to actually render them:
> on navy, the light-mode green, amber and red measure **3.03 / 3.04 / 2.76:1**
> against their own 10% tint — all below AA. Dark-theme values were added
> (`#26b66d`, `#dd9000`, `#ff6f61`), measuring 5.7 / 6.0 / 5.7:1.
>
> The lesson generalises: a colour is only verified once something renders it in
> the context it will actually be used. Paper-only checks are not enough for a
> token that will appear on both surfaces.

| Alias | Light | On navy |
|---|---|---|
| `--surface` | `--biso-paper` | `--biso-deep` |
| `--surface-raised` | `--biso-paper` | `#0B2747` |
| `--ink` | `--biso-deep` | `--biso-paper` |
| `--ink-muted` | `#526475` | `#93A7BB` |
| `--ink-accent` | `--biso-blue` | `--biso-sky` |
| `--border` | `--biso-line` | `#12314F` |
| `--action` / `--action-ink` | `--biso-blue` / `--biso-paper` | `--biso-sky` / `--biso-deep` |
| `--focus` | `--biso-blue` | `--biso-sky` |
| `--marker` | `--biso-sun` | `--biso-sun` |

### 1.4 Contrast validation

Every pairing the system permits, verified:

| Pair | Ratio | Level |
|---|---|---|
| ink / paper | 17.51:1 | AAA |
| ink-muted / paper | 6.11:1 | AA |
| action blue text / paper | 5.79:1 | AA |
| paper / action blue fill | 5.79:1 | AA |
| ink / sky fill | 6.26:1 | AA |
| ink / sun fill | 11.70:1 | AAA |
| paper / deep | 17.51:1 | AAA |
| ink-muted-on-dark / deep | 7.08:1 | AAA |
| sky / deep | 6.26:1 | AAA (large) / AA (body) |
| sun / deep | 11.70:1 | AAA |
| success / warning / danger on paper | 5.95 / 5.93 / 6.54:1 | AA |

**No pairing in this system falls below AA.** Compare the current footer at
4.18:1 (`00-current-state.md` §8.5).

Two rules make that hold: **`--biso-sky` never carries text on a light
surface**, and **`--biso-sun` is never a text colour** — it is a fill or a rule
with `--ink` on top.

### 1.5 Type roles

Measured from `1.png`: hero cap-height 56px with 66px baseline-to-baseline
(**line-height 0.85** — negative leading); section-heading cap-height 11px, a
5.1× ratio to the hero.

| Role | Size | Weight | Line-height | Tracking | Case |
|---|---|---|---|---|---|
| `display-hero` | `clamp(2.5rem, 7vw, 5rem)` | 900 | **0.85** | `-0.02em` | UPPER |
| `display-lg` | `clamp(2rem, 5vw, 3.5rem)` | 900 | 0.9 | `-0.015em` | UPPER |
| `display-sm` | `clamp(1.5rem, 3vw, 2.25rem)` | 800 | 0.95 | `-0.01em` | UPPER |
| `heading-section` | `1.125rem` | 800 | 1.2 | `0.04em` | UPPER |
| `heading-card` | `1.0625rem` | 700 | 1.3 | `0` | Sentence |
| `body` | `1rem` | 400 | **1.6** | `0` | Sentence |
| `body-sm` | `0.875rem` | 400 | 1.55 | `0` | Sentence |
| `label` | `0.75rem` | 600 | 1.4 | `0.06em` | UPPER |
| `data` | `0.875rem` | 600 | 1.2 | `0.01em` | tabular-nums |

`data` exists for the date blocks, deadlines, prices and stat counters — all of
which need `font-variant-numeric: tabular-nums` so columns align.

> **Display sizes capped 2026-08-31 during RD-018.** `display-hero` was
> `clamp(2.75rem, 8.5vw, 6.5rem)`. Norwegian compounds are single unbreakable
> tokens — *studentstemme*, *studentorganisasjon* — and at 6.5rem the longest
> of them is wider than any sensible column, so the heading overflowed its grid
> cell into the hero collage. English never exposed it. Both display roles now
> set `hyphens: auto` (which uses the `lang` on `<html>`) and
> `overflow-wrap: break-word`, and the hero cap dropped to 5rem so the
> treatment does not depend on hyphenation to fit.

**Measure:** `--measure: 54ch` on every prose container, replacing the 51 uses
of `max-w-4xl` (≈100ch) found in Phase 0.

> **Corrected 2026-08-31 during RD-007.** This originally said `68ch`, on the
> assumption that `Nch` yields N rendered characters. It does not: `ch` is the
> advance width of `0`, which in Inter is far wider than the average character
> in running prose (dominated by narrow lowercase and spaces). Measured by
> walking a `Range` and recording where each visual line actually breaks,
> **`68ch` renders up to 91 characters per line** — over the brief's 80-character
> floor. `54ch` renders ~72–75. The floor is a rendered-character count, so the
> token must be tuned against measurement, not arithmetic.

### 1.6 Spacing — 4px base

`--space-1` 4px · `2` 8px · `3` 12px · `4` 16px · `5` 24px · `6` 32px ·
`7` 48px · `8` 64px · `9` 96px · `10` 128px

Section rhythm is **two values only**, replacing the four in use today:
`--section-y: clamp(3rem, 6vw, 5rem)` and `--section-y-lg: clamp(4rem, 9vw, 8rem)`
(hero and closing bands only).

Container widths, replacing seven ad-hoc ones:
`--container: 1200px` · `--container-wide: 1440px` (hero, full-bleed bands) ·
`--container-prose: 68ch`

### 1.7 Radii

| Token | Value | Applies to |
|---|---|---|
| `--radius-sm` | 4px | Inputs, pills-with-corners, tags |
| `--radius-md` | 8px | Cards, panels, buttons |
| `--radius-lg` | 12px | Modals, large promo panels |
| `--radius-pill` | 999px | Filter chips, status pills, avatars |
| `--radius-none` | 0 | **Every sheared/chevron surface** |

That last row is the rule that keeps the system coherent: soft rectangles and
hard angles never mix on the same element. A sheared panel has square corners,
always.

### 1.8 Elevation

Three levels. The current app uses arbitrary one-off shadows plus 72 backdrop
blurs across 4 strengths; this replaces both.

| Token | Value | Use |
|---|---|---|
| `--elev-0` | `none`, `1px solid var(--border)` | Default. Cards are **bordered, not shadowed** |
| `--elev-1` | `0 1px 2px rgb(0 26 53 / 0.06), 0 4px 12px rgb(0 26 53 / 0.06)` | Hover on interactive cards; dropdowns |
| `--elev-2` | `0 8px 32px rgb(0 26 53 / 0.14)` | Modals, mega-panel, mobile drawer |

Shadows are tinted with the navy, never neutral black. **No `backdrop-blur`
anywhere** — the sticky header goes solid navy on scroll instead of translucent.
This removes the glassmorphism entirely.

### 1.9 Motion

| Token | Value |
|---|---|
| `--dur-fast` | 120ms |
| `--dur-base` | 200ms |
| `--dur-slow` | 320ms |
| `--dur-hero` | 900ms (the one orchestrated moment) |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-in-out` | `cubic-bezier(0.5, 0, 0, 1)` |

**Motion budget — three permitted categories, nothing else:**

1. **One orchestrated moment.** On first load of the home hero, the sheared
   photo panels wipe in along the shear axis in sequence (~900ms total). Once
   per session, home only.
2. **Response to user action.** Panel open/close, drawer, filter chips, cart,
   focus rings, button press. Always welcome.
3. **State transitions.** Skeleton→content, validation messages.

Explicitly forbidden: scroll-triggered reveals, `whileInView`, hover-lift on
cards, section fade-ups. Phase 0 counted **161 fade-and-slide-ups and 115
`whileInView`** in the current app — all of them are deleted, not restyled.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

This ships in Phase 3 as part of the foundation — Phase 0 found **zero**
reduced-motion handling anywhere in `apps/web` or `packages/ui`.

### 1.10 The chevron — measured geometry

Measured from `1.png`: the hero collage's leading edge runs **13.6° from
vertical**, the return edge **12.7°**.

| Token | Value | Notes |
|---|---|---|
| `--shear` | `13deg` | The single system angle |
| `--shear-run` | `0.231` | `tan(13°)` — horizontal offset per unit of height |

> **Revised 2026-08-31 during RD-010.** This section originally specified a
> lookup table of rounded cut percentages, and a second primitive
> `.chevron-band` for sheared section edges. Both were wrong.
>
> **The table rounds badly.** At `3/2` a rounded `15%` renders **12.68°** — a
> third of a degree out, at the edge of tolerance. Deriving the cut instead is
> exact at every ratio and deletes the table entirely.
>
> **`.chevron-band` is not geometrically viable.** A 13° edge across a
> full-width section drops **332px at 1440px** (277px at 1200px, 177px at
> 768px) — taller than most sections. Introducing a second, shallower angle to
> make it work would break the single rule that makes this motif read as a
> system rather than decoration. It is dropped; the chevron applies to media
> frames only.

**One primitive, and one formula.** In `clip-path: polygon()` an x-percentage
resolves against **width**, but the edge's angle depends on **height**. So the
cut is derived rather than declared:

> `cut = tan(13°) × (height / width)` = `0.2309 × --ar`

Because the same `--ar` also drives `aspect-ratio`, one number per instance
keeps the frame and its angle in lockstep — they cannot drift apart.

```css
.chevron-frame {
  --ar: 0.5625;                                        /* height / width, 16:9 */
  --cut: calc(var(--shear-run, 0.2309) * var(--ar) * 100%);
  aspect-ratio: 1 / var(--ar);
  overflow: hidden;
  border-radius: 0;                        /* never rounded — see §1.7 */
  clip-path: polygon(var(--cut) 0, 100% 0, calc(100% - var(--cut)) 100%, 0 100%);
}
/* The return edge, for alternating panels in a collage. */
.chevron-frame[data-lean="right"] {
  clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% 100%, var(--cut) 100%);
}
```

Media uses `object-fit: cover` and fills the frame, so no overscan or
counter-transform is needed — the clip removes corners, it does not move
content.

**Measured after implementation:** nine frames across all seven ratios and both
lean directions render **13.00°–13.03°** at 1440px and **12.97°–13.02°** at
320px. Worst error **0.03°**, against a ±0.3° tolerance.

Every angled edge in the system is 13 degrees. There is no second angle.

**The logo chevron is a separate thing.** Measured at ~26° from vertical, it is
a fixed brand mark, not a system primitive — and it does not exist as a vector
today (`PLACEHOLDER-001`, §6).

---

## 2. Typography — the actual typefaces

### 2.1 Body and UI: Inter — kept

Already loaded via `next/font/google`, already renders every character on the
site. The reference's body copy is a neutral grotesque; Inter is that, it has
proper tabular numerals for the `data` role, and it is excellent at the small
UI sizes this design leans on. Keeping it costs nothing and frees the entire
personality budget for the display face and the chevron.

This is a deliberate restraint choice, not an oversight — see the critique in
§7.2.

### 2.2 Display: a decision you need to make

**Phase 0's finding:** Museo Sans ships in **Light 300 only**, as a 62 KB
unsubsetted `.otf`, wired to a `font-display` utility that appears **zero
times** in the codebase. It is downloaded on every page load and never
rendered. It cannot produce the reference's display type — that is a 900.

| Option | What it is | Cost | Trade-off |
|---|---|---|---|
| **A. Museo Sans 900** *(recommended if licensed)* | BISO's actual brand face at display weight | Licence check + `.woff2` subset, ~25 KB | Brand-correct. Requires a licence covering web at 900 — **please confirm whether BISO holds one** |
| **B. Archivo, variable 800–900** | Google Fonts grotesque, closest skeleton match to Museo Sans's proportions | ~28 KB woff2, latin subset, via `next/font/google` — **no npm dependency** | Free and immediate. Not the brand face |
| **C. Keep Inter at 900** | No new font at all | 0 KB | Inter's round, open forms do not read as the reference's squared, industrial display. Weakest option |

**Recommendation: A if the licence exists, B if not.** Either way, **Museo Sans
300 is removed** — it is 62 KB of unrendered payload on every page.

Deliberately not proposed: Anton and Bebas Neue. Both are the reflexive answer
to "heavy uppercase display" and neither matches the reference's width — the
mockup's display type is wide, not condensed.

> This is the second of two open decisions. The first is §11.1 of the Phase 0
> audit (where the tokens live). Both must be settled before Phase 3 writes any
> CSS. Neither blocks Phase 2.

### 2.3 Delivery

Both faces through `next/font` — no new package, no external stylesheet, no
CLS. `font-display: swap`, latin + latin-ext subsets (Norwegian needs æ ø å).

---

## 3. Information architecture

### 3.1 How the three references differ on campus

| | Campus expressed as | Implies |
|---|---|---|
| **1.png** *(chosen)* | Logo lockup "BISO / OSLO" + header pill "Campus Oslo ▾" + hero sentence "YOU ARE ON CAMPUS OSLO" + "Switch campus" + section headings scoped ("LATEST NEWS — OSLO") | Campus is **a place you are**, stated 3× above the fold |
| 2.png | Horizontal tab bar under the header: OSLO / BERGEN / TRONDHEIM / STAVANGER | Campus is a **top-level section**. Note: no National |
| 3.png | Header dropdown pill + a "CAMPUSES ▾" nav item | Campus is **a filter**, closest to today |

The chosen direction commits hardest. That is the design decision with the
largest engineering consequence in this whole project.

### 3.2 The collision, stated plainly

`00-current-state.md` §11.3: **campus has no URL.** It lives in a cookie, in
`localStorage`, and in Appwrite user prefs — three sources that disagree on
first visit, because the client switcher defaults to *the first campus in the
list* while the server, seeing no cookie, filters *nothing*.

A page that says "YOU ARE ON CAMPUS OSLO" and lists Oslo events **must be
linkable**. As built, it is not: you cannot send anyone the Bergen events page.
Implementing 1.png as drawn without addressing this ships a page that lies
about its own state.

### 3.3 Resolution — additive, breaks nothing

Four options were considered. Path prefixes (`/oslo/events`) would express it
best and would also invalidate every inbound link, double the sitemap, and
require canonical/redirect handling on ~40 routes. That is disproportionate.

**Recommended: campus landing pages + a query parameter on feeds.**

| Piece | Mechanism | Why it is safe |
|---|---|---|
| **Campus home** | `/campus/[slug]` — `oslo`, `bergen`, `trondheim`, `stavanger`, `national` | `/campus` **already exists and is unlinked** (Phase 0 §9). This gives the orphan a purpose instead of adding a route |
| **Scoped feeds** | `?campus=oslo` on `/events`, `/news`, `/jobs` | Purely additive. Parameter absent → today's exact cookie behaviour. **No existing URL changes meaning** |

> **Corrected 2026-08-31 during RD-016.** This originally listed five feeds.
> The data supports three:
>
> - **`/projects` cannot be scoped.** `LargeEvent` has no `campus_id` — only a
>   `campusConfigs` JSON blob of per-campus configuration. Projects are national
>   by nature; adding `?campus=` would mean inventing a filter the data does not
>   express.
> - **`/units` defers to RD-025.** It fetches every department server-side and
>   filters client-side in `departments-list-client.tsx`. Adding a server-side
>   parameter would fight that state; the right fix is to make its filter
>   URL-driven with `<FilterChips>`, which is RD-025's work anyway.
>
> Slugs, not ids: campus is `"1"`–`"5"` internally, but an id in a URL is
> unreadable and unguessable. The parameter accepts the same slugs the unit
> routes already use, and still accepts raw ids because `/jobs` has supported
> `?campus=1`.
| **Default** | Cookie, as today | A visitor who has not chosen still gets their remembered campus |
| **Precedence** | URL > cookie > `all` | One rule. Eliminates the three-way disagreement by making the URL authoritative when present |
| **Fix the drift** | `CampusProvider` receives campuses and the active id **as props from `SiteShell`**, drops `localStorage` and its on-mount fetch | Kills the client/server disagreement *and* a hydrate-then-fetch waterfall |

`CampusMetadata` already carries `tagline_nb/en`, `description_nb/en`,
`highlights_nb/en[]`, `focusAreas_nb/en[]` per campus — **rich, localised,
currently near-unused content**. The campus landing page is mostly a matter of
rendering data that already exists.

Sitemap gains 5 `/campus/[slug]` entries plus campus variants of the five
feeds. Canonical on a `?campus=`-scoped feed points at the unscoped feed.

**This is a routing change and needs your approval before Phase 2 sequences
it.** If you would rather not, the fallback is to drop the hero's "YOU ARE ON
CAMPUS OSLO" line and treat campus as a filter — but then the design's central
promise goes with it.

### 3.4 Navigation tree

`1.png` shows six nav items: Students ▾ · Projects ▾ · Events · News · Jobs ·
Business ▾. It shows **no Shop and no About**. Dropping Shop from the nav would
bury a revenue surface, and About is a large real subtree. Both are kept; the
tree below reconciles the reference's shape with the routes that actually
exist. **No route path changes.**

```
BISO ▸ <campus>                                    [logo + campus lockup]

Students ▾
├─ Membership     /membership · /membership/join · /membership#fordeler
├─ Get involved   /jobs · /units · /students
└─ Support        /resources · /bi-fondet · /about/study-quality · /safety

Projects ▾
├─ Flagships      (4 from i18n: fadderullan, winterGames, karrieredagene, inspire)
└─ All            /projects · /events

Events                                             /events
News                                               /news
Jobs                                               /jobs

About ▾
├─ Organisation   /about · /about/what-is-biso · /about/history
│                 /about/operations · /about/alumni · /about/saih
├─ Governance     /about/politics · /about/bylaws · /documents
│                 /policies/drugs-policy · /safety
└─ Contact        /contact · /press · /about/academics-contact

Business ▾                                         /business · /business-hotspot
Shop                                               /shop

── utility ──────────────────────────────────────────────────────────
Campus pill ▾   Locale EN/NO   Search   Cart   [Become a member]   Account ▾

Account ▾ (signed in)     /profile · /applications · /fs (flagged) · /member
Footer only               /privacy · /terms · /campus
```

Two Phase 0 orphans are adopted: `/about/what-is-biso` and `/about/saih` move
into the About panel, and `/about/academics-contact` gets a Contact-column
entry. `/campus` becomes the campus index.

### 3.5 Header changes from today

Today's utility cluster holds **nine** controls. This is the largest usability
regression in the current build and the reference fixes it.

| Control | Today | Proposed |
|---|---|---|
| Campus | Ghost dropdown, 4th in a row of 9 | **Promoted** into the logo lockup + a labelled pill |
| Theme toggle | Always visible | **Moved** to the account menu / footer |
| Locale | Ghost dropdown | Kept, reduced to `EN / NO` text toggle |
| Cart | Icon + badge | Kept |
| "Partner" link | Text link | **Moved** into Business ▾ |
| "Member portal" btn | Outline button | **Moved** to the account menu |
| "Apply verv" btn | Outline button | **Removed** — Jobs is now a top-level nav item |
| "Become member" btn | Solid button | Kept. **The only primary CTA in the header** |
| Account | Avatar menu | Kept |

Nine controls → five. Three buttons that use `router.push()` become real
`<Link>`s, restoring prefetch and middle-click.

**Desktop breakpoint moves from `xl` (1280px) to `lg` (1024px).** Today every
viewport below 1280px gets the hamburger, including most laptops.

---

## 4. Page templates

Grid: 12 columns, 24px gutters, `--container` 1200px, 16px page margin at
≤640px. Wireframes are desktop; stacking notes follow each.

### 4.1 Home

```
┌──────────────────────────────────────────────────────────────────────┐
│ BISO ▸    Students▾ Projects▾ Events News Jobs About▾ Business▾ Shop  │
│  OSLO                    [Campus Oslo ▾] EN/NO ⌕ 🛒 [Become a member] │
├──────────────────────────────────────────────────────────────────────┤
│▓▓▓ NAVY ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╱────────╱────────╱─────────────────│
│                                ╱  photo ╱  photo ╱   photo    ╱     │
│  STUDENTS                     ╱───────╱────────╱────────────╱       │
│  SHAPING                     ╱ photo ╱  photo ╱   photo   ╱  ◣ sky  │
│  TOMORROW ◄ sky             ╱──────╱────────╱──────────╱   chevron  │
│                                                                      │
│  Lede, 2–3 lines, max 48ch                                          │
│  [Become a member →]  [See upcoming events →]                       │
│  ⚲ YOU ARE ON CAMPUS OSLO   [Switch campus]                         │
├──────────────────────────────────────────────────────────────────────┤
│ WHO TO CONTACT      │ UPCOMING EVENTS     │ LATEST NEWS — OSLO       │
│ ▔▔▔▔ (sun marker)   │           See all → │              See all →   │
│ ┌───┬───┬───┬───┐   │ ┌MAY┐ Title        │ ┌──┐ Headline             │
│ │ ◯ │ ◯ │ ◯ │ ◯ │   │ │ 22│ ⏱ ⚲   [pill] │ │▨ │ [tag]  13 May       │
│ │nam│nam│nam│nam│   │ ├MAY┤ Title        │ ├──┤ Headline             │
│ │rol│rol│rol│rol│   │ │ 27│ ⏱ ⚲   [pill] │ │▨ │ [tag]  09 May       │
│ └───┴───┴───┴───┘   │ └───┘               │ └──┘                     │
│   4 cols            │   5 cols            │   3 cols                 │
├──────────────────────────────────────────────────────────────────────┤
│▓▓ NAVY BAND ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ OPEN POSITIONS   See all jobs →                                     │
│ (All)(Societies)(Projects)(Academic)(Staff)(National)   ← chips     │
│ ┌────────┐┌────────┐┌────────┐┌────────┐  ┌──────────────────────┐ │
│ │▸ Title ││▸ Title ││▸ Title ││▸ Title │  │ Want to make         │ │
│ │[cat]   ││[cat]   ││[cat]   ││[cat]   │  │ an impact?           │ │
│ │⏱ date  ││⏱ date  ││⏱ date  ││⏱ date  │  │ [Explore →]          │ │
│ └────────┘└────────┘└────────┘└────────┘  └──────────────────────┘ │
│   8 cols (4 cards, horizontal scroll ≤lg)      4 cols               │
├──────────────────────────────────────────────────────────────────────┤
│ OUR SOCIETIES       │ OUR PROJECTS        │ ┌──────────────────────┐ │
│ ▔▔▔▔                │ ▔▔▔▔                │ │ PARTNER WITH BISO    │ │
│ ╱──╱╱──╱╱──╱╱──╱    │ ╱──╱╱──╱╱──╱╱──╱    │ │ [Join KD network →]  │ │
│ ╱  ╱╱  ╱╱  ╱╱  ╱    │ ╱  ╱╱  ╱╱  ╱╱  ╱    │ ├──────────────────────┤ │
│  ◂ ● ○ ○ ○ ▸        │  ◂ ● ○ ○ ○ ▸        │ │ NEED HELP?           │ │
│   4 cols            │   4 cols            │ │ [Help Center →]      │ │
├──────────────────────────────────────────────────────────────────────┤
│▓▓ NAVY FOOTER ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│ BE PART OF          │ 50+      1000+    5        ∞     │ ig in fb  │
│ SOMETHING BIGGER    │ societies members campuses opps  │ post@…    │
│ Explore · Campuses · About · Contact          [4 link columns]      │
└──────────────────────────────────────────────────────────────────────┘
```

**Alignment.** Section headings sit on the left grid edge with their `see all →`
flush right on the same baseline. The sun marker is a 3px underline, 40px wide,
under the first word only — and appears **only** on headings that lead to a
collection (§7.3). Card grids never break the 12-column rhythm.

**Stacking.** ≥1024px as drawn. 768–1023px: the three-column band becomes 2 + 1;
job cards scroll horizontally. <768px: everything single-column; hero display
drops to `clamp` floor; the photo collage becomes **two** panels, not six.

### 4.2 Feed / listing — `/events` `/news` `/jobs` `/projects` `/units` `/shop`

```
┌──────────────────────────────────────────────────────────────────────┐
│ [ header ]                                                           │
├──────────────────────────────────────────────────────────────────────┤
│▓▓ NAVY, short ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╱────────────────────│
│  Home ▸ Events                                 ╱   ◣ sky chevron     │
│  EVENTS                                       ╱                      │
│  One-line description, 60ch max              ╱                       │
├──────────────────────────────────────────────────────────────────────┤
│ (All)(Social)(Career)(Workshop)…    [Campus ▾] [Sort ▾]   24 results │
├──────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                        │
│ │╱ image   ╱ │ │╱ image   ╱ │ │╱ image   ╱ │  ← chevron-frame media │
│ │[tag] date  │ │[tag] date  │ │[tag] date  │                        │
│ │Title       │ │Title       │ │Title       │                        │
│ │⚲ campus    │ │⚲ campus    │ │⚲ campus    │                        │
│ └────────────┘ └────────────┘ └────────────┘   4 cols each          │
│                    [ Load more ]                                     │
└──────────────────────────────────────────────────────────────────────┘
```

Filters are real links (`?category=…&campus=…`), so a filtered view is
shareable and server-rendered. 3 cols ≥1024px · 2 cols 640–1023px · 1 col below.

### 4.3 Detail / article — `/news/[slug]` `/events/[slug]` `/jobs/[slug]` `/projects/[slug]`

```
┌──────────────────────────────────────────────────────────────────────┐
│▓▓ NAVY ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  Home ▸ News ▸ Article                                              │
│  [tag]  13 May 2025  ·  Oslo                                        │
│  HEADLINE SET IN DISPLAY-LG, MAX 20 WORDS                           │
│  By Author                                                           │
├──────────────────────────────────────────────────────────────────────┤
│ ╱────────────────────────────────────────────────────────────╱      │
│ ╱            lead image, chevron-frame, 16:9                 ╱       │
├───────────────┬──────────────────────────────────────────────────────┤
│ ▏Share        │  Body copy at --measure (68ch).                      │
│ ▏Published    │  Blockquotes, lists and subheads inherit the         │
│ ▏Campus       │  prose scale. Images inside the article are          │
│ ▏Author       │  full-measure, chevron-framed.                       │
│  3 cols       │  ↑ 7 cols, offset 1                                  │
├──────────────────────────────────────────────────────────────────────┤
│ RELATED  ▔▔▔▔        ┌──────┐ ┌──────┐ ┌──────┐                     │
└──────────────────────────────────────────────────────────────────────┘
```

Meta rail is sticky ≥1024px; below that it collapses to a horizontal strip
under the headline. **Event and job detail replace the meta rail with a sticky
action card** (date, location, price, capacity → "Register" / "Apply").

### 4.4 Campus landing — `/campus/[slug]` *(new)*

Renders `CampusMetadata` + `CampusData`, which already exist and are barely used.

```
┌──────────────────────────────────────────────────────────────────────┐
│▓▓ NAVY ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓╱──────────╱──────────╱────────────│
│  ⚲ CAMPUS                       ╱  photo   ╱  photo   ╱             │
│  THIS IS                       ╱──────────╱──────────╱              │
│  BISO OSLO                    ╱ tagline_nb/en from CampusMetadata    │
│  description_nb/en                                                   │
│  [Explore events →] [Join a society →]                              │
├──────────────────────────────────────────────────────────────────────┤
│  25+ societies   ·   120+ events/yr   ·   3000+ students            │
│  ↑ PLACEHOLDER-004 — no counts exist for these                      │
├──────────────────────────────────────────────────────────────────────┤
│ HIGHLIGHTS ▔▔▔▔   (highlights_nb/en[] — real data)                  │
│ FOCUS AREAS ▔▔▔▔  (focusAreas_nb/en[] — real data)                  │
├──────────────────────────────────────────────────────────────────────┤
│ WHO TO CONTACT ▔▔▔▔  │ UPCOMING HERE ▔▔▔▔ │ SOCIETIES HERE ▔▔▔▔     │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.5 Content page — `/about/*` `/privacy` `/terms` `/resources` `/safety` `/[...slug]`

```
┌──────────────────────────────────────────────────────────────────────┐
│▓▓ NAVY, short ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│  Home ▸ About ▸ History                                             │
│  OUR HISTORY                                                         │
├───────────────┬──────────────────────────────────────────────────────┤
│ ▏On this page │  Prose at --measure (68ch).                          │
│ ▏  Section 1  │  h2 = display-sm, h3 = heading-card.                 │
│ ▏  Section 2  │  The block-editor catch-all (/[...slug]) renders     │
│  3 cols       │  PageDoc into this same column — one prose scale     │
│               │  for authored and hardcoded content alike.           │
└───────────────┴──────────────────────────────────────────────────────┘
```

These 12 pages become **Server Components** (Phase 0 §2.1). The three
metadata-only layouts (`about/`, `resources/`, `safety/`) are then deleted.

### 4.6 Commerce and account

`/shop` uses the feed template; `/shop/[slug]` uses detail with a sticky buy
card. `/shop/cart` and `/shop/checkout` are single-column at
`--container-prose` + a sticky summary. `/member`, `/profile`, `/applications`,
`/fs` keep their tabbed structure and are **restyled only** — no structural
change. `/auth/login` is centred, single-column, on navy, with no site chrome
(as today).

---

## 5. Component mapping

Against the 139-component Phase 0 inventory.

### 5.1 New primitives — Phase 3 (`/design-system` showcases all of these)

| Component | Replaces | Why |
|---|---|---|
| `<Container>` | 176 hand-rolled `mx-auto max-w-*` across 7 widths | One width scale |
| `<Section>` | 4 competing `py-*` rhythms + 50 `min-h-screen` | Two rhythm values |
| `<PageHeader>` | `about-hero` (15×), `public-page-header` (3×), 8 per-feature heroes | One navy header with breadcrumb + display title + chevron |
| `<SectionHeading>` | `shared/section-heading` (3×) + ~30 inline | Uppercase + sun marker + `see all →` |
| `<ChevronFrame>` | — | **The signature.** Sheared media frame |
| `<ChevronBand>` | — | Sheared section edge |
| `<Prose>` | `.prose` + 51 `max-w-4xl` | 68ch measure |
| `<DateBlock>` | inline in 4 card components | Tabular MAY/22 stack |
| `<Pill>` | ~40 inline badge spans | Status/category/campus |
| `<FilterChips>` | inline in 4 list clients | Link-based, server-rendered |
| `<StatRow>` | `about/stats-bar`, inline footer stats | Tabular counters |
| `<Reveal>` | 161 ad-hoc `motion` blocks | The **only** motion wrapper; respects reduced-motion |
| `<CampusPill>` | `select-campus` | Header campus control |
| `<PersonCard>` | — | "Who to contact" |

### 5.2 Layout and navigation

| Component | Action | Note |
|---|---|---|
| `layout/site-shell` | **restyle** | Remove inner `<main>`; add skip-link; move `<nav>`/`<footer>` out of `<main>` |
| `layout/footer` | **replace** | Server component; fix untranslated headings; fix 4.18:1 contrast; `<Link>` not `<a>`; drop purple/pink hover; remove 5 reveals |
| `layout/public-providers` | **restyle** | Campus passed as props, not fetched |
| `layout/nav` | **delete** | Legacy shim; update 10 import sites |
| `nav/mega-nav` | **restyle** | 9 utility controls → 5; `lg` breakpoint; solid on scroll, no blur. **Keep the keyboard logic verbatim — it is good** |
| `nav/desktop-menu`, `mega-panel`, `mobile-drawer` | restyle | |
| `nav/account-menu` | restyle | Gains theme toggle + member portal |
| `nav/panels/*` (3) | restyle | Rebuilt to §3.4 |
| `nav/featured-{event,project}-card` | replace | → `<ChevronFrame>` card |
| `nav/campus-link` | keep | |
| `layout/analytics-identity`, `analytics-tracker`, `account-link-session-cleanup` | **keep** | No visual surface |

### 5.3 Home

| Component | Action |
|---|---|
| `home/hero-carousel` (371) | **replace** → chevron collage; the one orchestrated moment |
| `home/hero-section` | replace |
| `home/about-section` (159) | **replace** → `<StatRow>` |
| `home/events-section`, `news-section` (454) | replace → shared `<CardGrid>` + `<SectionHeading>` |
| `home/join-us` (213) | restyle |
| `home/partners` | restyle |
| `home/skeletons` (149) | **delete** — unreachable (Phase 0 §2.3) |
| — | **new**: `home/contact-strip`, `home/open-positions-band` |

### 5.4 Feature components

| Group | keep | restyle | replace | delete |
|---|---|---|---|---|
| News (17) | 2 | 9 | 5 | 1 (`scroll-indicator`) |
| Events (9) | 1 | 5 | 3 | — |
| Jobs (5) | 1 (`job-application-form`) | 3 | 1 | — |
| Shop (22) | 3 | 14 | 4 | 1 (`shop/layout.tsx`) |
| Member portal (21) | 2 | 14 | — | **5 dead** |
| About (8) | — | 2 | 5 | 1 |
| Projects (3) | — | 2 | 1 | — |
| Documents (3) | — | 3 | — | — |
| Expense (8) | **8** | — | — | — |
| Onboarding (2) | — | 2 | — | — |
| Profile (3) | — | 3 | — | — |
| Safety / privacy (2) | — | 2 | — | — |
| Context (2) | 1 | 1 (`campus`) | — | — |

**`expense-v3/*` is kept untouched** — 2,711 LOC behind a feature flag, reached
only from the account menu, zero design value in migrating it. It inherits the
new tokens automatically. Flagged as an explicit scope exclusion.

### 5.5 Deletions

| Item | LOC |
|---|---|
| `member-portal/tabs/settings-tab` | 208 |
| `member-portal/states/not-member-state` | 144 |
| `member-portal/states/no-bi-email-state` | 67 |
| `member-portal/shared/quick-stats-card` | 49 |
| `member-portal/states/signed-out-state` | 46 |
| `home/skeletons` | 149 |
| `news/scroll-indicator` | 16 |
| `layout/nav` shim | 4 |
| `(public)/shop/layout.tsx` | 8 |
| 3 metadata-only layouts | ~45 |
| `public/images/person-placeholder.jpg` | 1.47 MB |
| `public/museo_sans_300.otf` | 62 KB |
| `framer-motion` (6 imports → `motion/react`) | one dependency |
| Broken `Button`/`Card` variants | 9 variants |
| **~736 LOC + ~1.5 MB + 1 dependency** | |

---

## 6. Content gaps

Everything the design implies that the data layer cannot supply today.
`PLACEHOLDER-###` marks anything with no real source — **none of these ship
with invented copy.**

| ID | Design element | Status | Smallest fix |
|---|---|---|---|
| **PLACEHOLDER-001** | Angled brand chevron as a vector | **No SVG exists.** Logo is PNG only, in 4 variants | Request the BISO logo + chevron as SVG from the brand owner. Blocks the header lockup and `<ChevronFrame>`'s decorative marks |
| **PLACEHOLDER-002** | Job card workload "20% / 15% / 10%" | **`Jobs` has no such column** | Add `workload_pct: integer?` to `jobs`. Until then, omit — do not invent |
| **PLACEHOLDER-003** | News category pills (EVENT RECAP / STUDENT STORIES / CAMPUS NEWS) | `News` has only `metadata: string[]`, untyped and unvalidated | Add a `category` enum to `news`, mirroring the 8-value `EventsCategory` that already exists. Until then, render `metadata[0]` if present, else nothing |
| **PLACEHOLDER-004** | Stats: "1000+ members", "50+ societies", "25+ / 120+ / 3000+" | `cachedHomeCounts` returns **only** `eventCount` + `jobCount` | Extend it with a `departments` count (available) . **Member count is not public data — omit the tile entirely rather than guess** |
| **PLACEHOLDER-005** | "Turn on notifications" bar | No push infrastructure in `apps/web` | Out of scope. Omit the bar, or repurpose it for a real announcement (2.png's top bar) |
| **PLACEHOLDER-006** | Header search | **No search exists anywhere in `apps/web`** | Either build it as its own work package or omit the icon. **Do not ship a decorative search field** |
| **PLACEHOLDER-007** | Email icon per contact card | `DepartmentBoard` has `name`, `role`, `imageUrl` — **no email** | Add `email` to `department_board`, or link to `/contact`. `Campus.email` exists as a fallback |
| — | "Who to contact" people | **Supported** — `DepartmentBoard` via the `get_board_members` Appwrite function | Note: it is a **POST route**, so it cannot be cached like a table read. Needs a GET/cached path for the home page |
| — | Event status pill ("Register" / "Info only") | **Supported** — derive from `ticket_url` presence | — |
| — | Societies/projects imagery | **Supported** — `Departments.hero` / `.logo`, `LargeEvent.backgroundImageUrl` | — |
| — | Partner tiers | **Supported** — `Partners.level` enum + `image_url` | — |
| **PLACEHOLDER-009** | Campus tagline, description, highlights, focus areas, team, partners, benefits, photo collage | ~~Supported and localised — `CampusMetadata.*_nb/_en`~~ **Corrected 2026-09-01 (RD-023): `campus_metadata` and `campus_data` are both empty — zero rows.** The schema supports all of it; none of it has been written. `campus` carries a name and an email and nothing else | Write the rows. `/campus/[slug]` renders every one of these fields the moment it arrives and omits it entirely until then, so this needs no code. Until it is written the page is built from what is real: contact, counts, scoped feeds, and the campus's active units |
| **PLACEHOLDER-011** | Projects, and the per-project palette override (§7.4) | **`large_event` holds zero rows.** The four projects on `/projects` come from the `projects` message bundle and their gradients from constants in the page file. `primaryColorHex`, `gradientHex[]`, `textColorHex` and `heroOverrideEnabled` all exist on the schema and have nothing in them | Write the rows. Until then §7.4's override has nothing to override and cannot be built or verified — `/projects` and `/projects/[slug]` are restyled chrome over bundle-driven content |
| **PLACEHOLDER-010** | Unit logos, hero images, descriptions, type — and the board | `departments.logo`, `.hero`, `.type` are **null on all 280 rows**, `content_translations` holds **zero** department rows, and **`department_board` is empty** | `departments` has `logo`, `hero`, `type` and a `description` via translations — **all null on all 280 rows, and `content_translations` holds zero department rows at all** | Populate them, or read units from the department row (name, abbreviation, slug), which is what `/campus/[slug]` and `/units` now do. The consequence was not cosmetic: `getDepartments()` reads through the translation table, so **`/units` rendered "0 units" and `--` for every stat** while 141 active departments sat in the table |
| — | Per-project brand override | **Supported** — `LargeEvent.primaryColorHex`, `secondaryColorHex`, `gradientHex[]`, `textColorHex`, `heroOverrideEnabled` | Token system must accept a runtime palette override on `/projects/[slug]` (§7.4) |

---

## 7. Critique pass

Testing each major choice against: *is this a decision for BISO, or the default
I would produce for any student organisation?*

### 7.1 Navy / blue / yellow — **holds**
Not chosen; measured. And the measured values land within a few points per
channel of hex literals already hardcoded 27 times in the codebase. This is BISO's real
brand, and the redesign consolidates it rather than inventing. The one change
is `#217EC7` → `#1668AE`, forced by a measured AA failure (§1.2).

### 7.2 Inter for body — **holds, but only just**
Inter is *the* default UI typeface, and picking it deserves suspicion. It
survives because: it is the incumbent (zero migration), the reference's body
copy is plainly a neutral grotesque, it has the tabular numerals the `data`
role needs, and the brief's own guidance is to spend boldness in one place. The
display face and the chevron are that place. Swapping Inter would spend budget
where the design does not ask for it.

### 7.3 The sun marker — **revised**
*Original:* a yellow underline on every section heading, as drawn.
*Problem:* that is decoration, and the frontend-design guidance is explicit —
structural devices should encode something true.
*Revised:* the marker appears **only** on headings that lead to a collection
(those with a `see all →`). A terminal heading — "Highlights", "On this page" —
gets none. The marker now means *"there is more behind this."* Same visual, now
load-bearing.

### 7.4 The chevron — **revised, and this is the important one**
*Original:* apply the shear to hero media and card media. Correct per the
brief, but purely stylistic — the motif would be wallpaper.
*Problem:* the codebase has a fact the mockup does not know: `LargeEvent` rows
carry `primaryColorHex`, `secondaryColorHex`, `gradientHex[]` and
`heroOverrideEnabled`. Flagship projects already own brand palettes.
*Revised — the chevron is a container for identity, not a shape:*

- On **home and campus pages**, the collage panels show *that campus* — switching
  campus changes the faces. The chevron is how "you are on Campus Oslo" is felt
  rather than merely asserted, which is the single hardest problem in §3.
- On **`/projects/[slug]`**, the same frame accepts the project's own
  `primaryColorHex` / `gradientHex[]`, scoped to that subtree. Flagships get
  their identity **inside** BISO's frame instead of overriding the page.
- At **card scale** the frame is the media mask everywhere else, so the system
  reads as one thing.

One shape, one 13° angle, carrying campus identity and project identity. That
is a decision made for this brief.

### 7.5 Campus routing — **holds, and it is the riskiest thing here**
Not a default: it comes from a specific finding (three disagreeing sources of
truth) plus a specific asset (an orphaned `/campus` route and unused
`CampusMetadata`). The recommendation is deliberately the *smallest* change
that makes the design honest — query params and landing pages, not path
prefixes — precisely because path prefixes would be the grander, more
disruptive answer. **Needs your approval** (§3.3).

### 7.6 Motion — **holds**
Deleting 161 reveals and keeping exactly one orchestrated moment is a real
position with a cost: the site will feel quieter than the current one. That is
the intent, and it is what the brief asks for.

### 7.7 Where I am overruling the mockup, and why

| Mockup | Change | Reason |
|---|---|---|
| Button blue `#217EC7` | → `#1668AE` | 4.31:1 fails AA |
| White on `#3AA3E1` | Sky restricted to navy surfaces | 2.80:1 fails badly |
| No Shop or About in nav | Both kept | Dropping Shop buries revenue; About is a real subtree. Operating rule 6 |
| "Turn on notifications" bar | Omitted | No push infrastructure — PLACEHOLDER-005 |
| Header search icon | Omitted or scoped separately | No search exists — PLACEHOLDER-006 |
| Job workload "20%" | Omitted | No column — PLACEHOLDER-002 |
| "1000+ Active Members" | Omitted | Not public data — PLACEHOLDER-004 |
| Underline on every heading | Collections only | Encode, don't decorate (§7.3) |

---

## 8. Open decisions blocking Phase 3

Neither blocks Phase 2, and both must be settled before any CSS is written.

1. **Where the tokens live** (`00-current-state.md` §11.1). `styles.test.ts`
   forbids declaring `--brand`/`--inverted`/`--section` in `apps/web`.
   Recommended: **option B** — add a second surface class in
   `packages/ui/styles/biso-surface.css` alongside the existing one, mounted
   only by `apps/web`. Additive, cannot affect `admin`, and doubles as the
   Phase 4 old/new comparison switch. Still a `packages/` edit, so it needs
   your approval.
2. **The display typeface** (§2.2). Museo Sans 900 if BISO holds a web licence
   at that weight; Archivo variable 800–900 if not.

And one blocking Phase 2's ordering:

3. **Campus routing** (§3.3). `/campus/[slug]` + `?campus=` on five feeds.
   Additive, no existing URL changes meaning — but it is a routing change and
   the brief says to ask.
