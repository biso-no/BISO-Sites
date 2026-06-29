# BISO Platform Launch Document
## web.biso.no — Site Audit, Content Migration Plan & Claude Code Prompt

> **Purpose:** Full audit of `web.biso.no` vs `biso.no`, mapping of missing/incomplete pages, navigation redesign spec, and a ready-to-paste Claude Code prompt for launch preparation.

---

## 1. Current State Audit

### 1.1 web.biso.no — Confirmed Pages

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ Live | Hero, membership pricing, events carousel, about section. Stats widget shows hardcoded "261+ Studentgrupper". News section says "Ingen nyheter publisert ennå". |
| `/events` | ✅ Live | Filterable event listing (Sosialt, Karriere, Faglig, Idrett, Kultur). Only 2 events visible (Bergensbaneløpet). |
| `/events/[id]` | ✅ Live | Dynamic event detail pages from Tickster. |
| `/membership` | ⚠️ Incomplete | National benefits section shows placeholder: "Vi oppdaterer de nasjonale fordelene akkurat nå." Campus benefits tab shows no content. FAQ exists but is collapsible-only. |
| `/shop` | ⚠️ Empty | Scaffold exists (categories: Merch, Turer, Skap, Medlemskap), but 0 products. |
| `/jobs` | ⚠️ Empty | Page exists with 4 department filters, but 0 positions listed. |
| `/news` | ⚠️ Empty | Page exists with social/newsletter sidebar. 0 articles. `og:image` points to `localhost:3000` — **must fix before launch**. |
| `/business` | ⚠️ Incomplete | Partner page exists. "Telefon kommer snart" on all campuses. Career Days sections have no detail, just "BLI MED" labels. |
| `/contact` | ⚠️ Broken | "No email available" for all campuses. Untranslated key: `contact.campuses.subtitle`. Typo in national email: `post@bfriso.no` instead of `contact@biso.no`. |
| `/campus` | ⚠️ Timeout | Route exists (linked in nav) but times out. Likely heavy async content. |
| `/shop/membership` | ✅ Live | Linked from membership page — presumably WooCommerce or custom checkout. |
| `/code-of-conduct` | ✅ Assumed | Linked in footer, not tested. |
| `/privacy` | ✅ Assumed | Linked in footer. |
| `/terms` | ✅ Assumed | Linked in footer. |
| `/history` | ❌ 404 | Linked in footer as "Vår historie". Page does not exist. |
| `/resources` | ❌ 404 | Linked in footer as "Ressurser". Page does not exist. |
| `/about` | ❓ Unknown | Linked from `/contact` page. Status unclear. |

---

### 1.2 biso.no — Full Content Inventory (Pages to Migrate)

The old WordPress site has significantly more content. Below are all pages with migration priority.

#### Om BISO

| Old URL | Content Summary | Priority |
|---|---|---|
| `/om-biso/` | Who is BISO, strategy (Påvirkning/Påkoblet/Engasjert), what we do, org structure chart, national partners (24SevenOffice, TicketCo, Kai Hansen) | 🔴 High |
| `/var-politikk/` | Student politics — 4 core demands: increased grants, 12-month grant disbursement, student housing (2500/year, 25% coverage), private professional education. Forums: NSO, Velferdstinget, Kulturstyret. PDF policy document. Studentpolitisk utvalg (SPU). | 🔴 High |
| `/academics-2/` | Academic representation: wins at BI (digital teaching extension, exam format, home exam extension, bachelor writing option). Forums: Undervisningsutvalget, LMU, Studentkvalitetssystemet, Kollegiet, Studentpanel, Sustainability Working Group. Academic Target Document PDF. | 🔴 High |
| `/au-2/` | Arbeidsutvalget (Executive Committee) — full-time student employees running the organization. | 🔴 High |
| `/lover-og-vedtekter/` | Bylaws and statutes. | 🟡 Medium |
| `/alumni/` | Alumni registration (MS Forms link), Events/Connect/Engage value props, 4 active alumni profiles with LinkedIn. | 🟡 Medium |
| `/stotte-til-saih/` | Solidarity fund (SAIH). | 🟡 Medium |
| `/varsling/` | Whistleblowing: form, Code of Conduct (5 rules), anonymous reporting explanation, contacts (board@, HR@, manager@). | 🔴 High — **legal requirement** |

#### For Studenter

| Old URL | Content Summary | Priority |
|---|---|---|
| `/members fordeler/` | Full member benefits page with campus-specific content. | 🔴 High (already partially on `/membership`) |
| `/units/` | All BISO units/committees overview. | 🔴 High |
| `/sok-utvalg/` | Apply for volunteer position. | 🔴 High |
| `/sok-okonomisk-stotte/` | BI-fondet — detailed application page, full FAQ (10 questions), downloadable budget template + guidelines + fund conditions (all SharePoint PDFs), process explanation. | 🔴 High |

#### Campus Pages

| Old URL | Content Summary | Priority |
|---|---|---|
| `/campus-oslo-4/` | Oslo campus hub | 🔴 High |
| `/campus-bergen-2/` | Bergen campus hub | 🔴 High |
| `/campus-trondheim-2/` | Trondheim campus hub | 🔴 High |
| `/campus-stavanger-2/` | Stavanger campus hub | 🔴 High |

#### Flagship Projects

| Old URL | Content Summary | Priority |
|---|---|---|
| `/fadderullan-oslo-2/` (+ bergen, trondheim, stavanger) | Fadderullan per campus | 🔴 High |
| `/winter-games/` | Winter Games national page | 🔴 High |
| `/karrieredagene-oslo/` (+ 3 campuses) | Career Days per campus | 🔴 High |

#### For Bedrifter

| Old URL | Content Summary | Priority |
|---|---|---|
| `/for-bedrifter/` | Partner page (partially migrated to `/business`) | 🟡 Medium |
| `/business-hotspot/` | Business Hotspot — new concept | 🟡 Medium |

---

## 2. Gap Analysis — What's Missing

### 🔴 Critical (blocking launch)

1. **`/about`** — "Om BISO" page — who we are, strategy, org chart, partners
2. **`/varsling`** — Whistleblowing — legally important, must exist
3. **`/bi-fondet`** — BI Fund application page with full FAQ
4. **`/units`** — All BISO committees listing
5. **`/campus/[slug]`** — Individual campus pages (Oslo, Bergen, Trondheim, Stavanger)
6. **`/history`** — Currently 404, linked in footer
7. **Contact page** — fix broken emails, missing campus emails, fix i18n key

### 🟡 Important (before full public launch)

8. **`/politics`** — Student political positions ("Vår politikk")
9. **`/academics`** — Studiekvalitet/academic representation
10. **`/projects/fadderullan`** — Flagship event hub
11. **`/projects/winter-games`** — Flagship event hub
12. **`/projects/karrieredagene`** — Flagship event hub
13. **`/jobs`** — Needs real data populated
14. **`/resources`** — Currently 404, linked in footer

### 🟢 Nice-to-have (post-launch)

15. **`/alumni`** — Alumni network page
16. **`/au`** — Arbeidsutvalget / executive committee
17. **`/lover-og-vedtekter`** — Bylaws
18. **`/stotte-til-saih`** — SAIH solidarity

---

## 3. Existing Page Issues to Fix

| Page | Issue | Fix |
|---|---|---|
| `/contact` | Untranslated key `contact.campuses.subtitle` | Replace with real subtitle |
| `/contact` | All campuses show "No email available" | Populate campus emails from `/business` page |
| `/contact` | National email typo `post@bfriso.no` | Fix to `contact@biso.no` |
| `/news` | `og:image` points to `http://localhost:3000/news-hero.jpg` | Fix to production URL or upload proper OG image |
| `/membership` | National benefits placeholder text showing | Populate or remove section |
| `/membership` | Campus benefits tab shows nothing | Populate or link to campus pages |
| `/business` | "Telefon kommer snart" on all campuses | Either populate or remove phone field |
| `/` | News section: "Ingen nyheter publisert ennå" — will look bad on launch | Publish at least 1-2 news articles before launch |
| `/shop` | 0 products — page looks broken | Populate or redirect to `/shop/membership` until populated |
| `/jobs` | 0 positions — page looks broken | Populate or add empty state with "Se etter stillinger til høsten" |
| `footer` | `/history` and `/resources` links are 404s | Create pages or remove links |

---

## 4. Proposed Navigation Redesign — Mega Menu

The current nav is too sparse for the content BISO offers. With 15+ pages to add, a mega menu is the right solution.

### Current Nav (simplified)
```
Campus | Arrangementer | Nyheter | Butikk | Søk her | Om oss
[Bedrift] [Medlemsportal]
```

### Proposed Mega Menu Architecture

```
[BISO Logo]

FOR STUDENTER ▾    PROSJEKTER ▾    OM BISO ▾    Nyheter    Butikk    Søk verv

[CTA: Bli Medlem]  [CTA: Medlemsportal]
```

#### FOR STUDENTER mega panel

```
┌─────────────────────────────────────────────────────────────┐
│  🎓 Bli Medlem          📍 Campus                           │
│  Fordeler & priser      Oslo                                │
│  Aktivere fordeler      Bergen                              │
│  FAQ                    Trondheim                           │
│                         Stavanger                           │
│  📋 Verv & Utvalg       💰 Støtte & Ressurser               │
│  Alle utvalg            BI-fondet                           │
│  Søk verv               Studiekvalitet                      │
│  Ledige stillinger      Ressurser for studenter             │
│                                                             │
│  ► FEATURED: Bergensbaneløpet → [event card]                │
└─────────────────────────────────────────────────────────────┘
```

#### PROSJEKTER mega panel

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 Fadderullan         🏔️ Winter Games                     │
│  Oslo · Bergen          Årets høydepunkt                   │
│  Trondheim · Stavanger                                      │
│                         💼 Karrieredagene                   │
│                         Oslo · Bergen                       │
│                         Trondheim · Stavanger               │
│                                                             │
│  → Se alle arrangementer                                    │
└─────────────────────────────────────────────────────────────┘
```

#### OM BISO mega panel

```
┌─────────────────────────────────────────────────────────────┐
│  🏢 Organisasjon        📜 Juridisk & Policy                │
│  Hva er BISO?           Lover og vedtekter                  │
│  Arbeidsutvalget        Vår politikk                        │
│  Alumni                 Code of Conduct                     │
│  Vår historie           Varsling                            │
│                                                             │
│  📞 Kontakt             🤝 For Bedrifter                    │
│  Kontakt oss            Bli partner                         │
│  Finn campus            Karrieredagene                      │
│                         Business Hotspot                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. New Pages — Content Spec

### `/about` — Om BISO

**Title:** Om BISO — Hva er BI Student Organisation?

**Sections:**
- Hero: "BI Studentorganisasjon" with mission statement
- Strategy pillars: Påvirkning / Påkoblet / Engasjert (matches old site and new homepage)
- What we do: Studentvelferd, Academics, Politikk, Events — with CTAs
- Org structure: Visual org chart (can be SVG or image from Appwrite)
- National partners: 24SevenOffice, TicketCo, Kai Hansen
- Contact CTA → `/contact`

**Copy source:** `biso.no/om-biso/`

---

### `/politics` — Vår politikk

**Title:** Vår politikk — BISO tar vare på deg

**Sections:**
- Hero with mission: "BISO er en partipolitisk uavhengig organisasjon som arbeider for å bevare organisasjonens medlemmers faglige, økonomiske, sosiale, psykososiale og helsemessige interesser."
- 4 core policy demands (cards):
  1. Økt studiestøtte — for lav til å klare seg uten jobb
  2. Utbetaling over 12 måneder — justeres for inflasjon
  3. Bygging av studentboliger — 2500/år, 25% dekningsgrad
  4. Profesjonsutdanninger — private skal ha lik rett
- Politisk måldokument — PDF download (SharePoint link)
- Studentpolitisk utvalg (SPU) — with join CTA
- Forums: NSO, Velferdstinget, Kulturstyret (with descriptions)

**Copy source:** `biso.no/var-politikk/`

---

### `/academics` — Studiekvalitet

**Title:** Studiekvalitet — Din stemme i akademia

**Sections:**
- Hero
- Wins at BI (6 cases won — accordion or cards):
  - Forlengelse av digital undervisning
  - Omgjøring av eksamensform
  - Utvidet frist på hjemmeeksamen
  - Utvidet frist på arbeidskrav
  - Økt fokus på kvinner i finans
  - Mulighet til å skrive bachelor (Org.psyk HR)
- "Men hva er din sak?" — contact CTA
- Academic forums (6): Undervisningsutvalget, LMU, Studentkvalitetssystemet, Kollegiet, Studentpanel, Sustainability Working Group
- Academic Target Document PDF download

**Copy source:** `biso.no/academics-2/`

---

### `/varsling` — Varsling

**Title:** Varsling — Alle skal være ivaretatt

**Sections:**
- Hero with form (use existing Appwrite/MS Forms integration or native form)
- "Hva er varsling?" — explanation text
- Code of Conduct (5 rules)
- Anonymous reporting explanation
- Contact info: board@biso.no, HR email, manager@biso.no

**Notes:** This is a legal requirement. Must be accessible and not require login.

**Copy source:** `biso.no/varsling/`

---

### `/bi-fondet` — BI-fondet

**Title:** BI-fondet — Søk støtte til studentaktivitet

**Sections:**
- Hero with apply CTA (MS Forms link)
- Who can apply (3 groups: BISO units, companies/sister orgs, other students/groups)
- What it can be used for (8 bullet points)
- Application process (Finanskomiteen → Styret)
- Tips & tricks
- Downloads: Vilkår (PDF), Aktivitetsbudsjett (Excel), Retningslinjer (PDF)
- Full FAQ (10 questions — see copy source)
- Contact: manager.finance@biso.no

**Copy source:** `biso.no/sok-okonomisk-stotte/`

---

### `/units` — Alle utvalg

**Title:** Utvalg & enheter — Bli en del av noe større

**Sections:**
- Hero: "261+ studentgrupper"
- Filterable grid by campus and category
- Each unit card: name, campus, brief description, apply CTA → `/jobs`
- "Søk verv" CTA

**Notes:** Data should come from Appwrite. Campus filter should default to user's preferred campus.

---

### `/history` — Vår historie

**Title:** Vår historie — Fra SBIO til BISO

**Sections:**
- Timeline: SBIO (Studentforeningen ved Handelshøyskolen BI) → BIS (BI Studentsamfunn) → BISO
- Milestones
- Stats: year founded, campuses, members over time

**Notes:** Currently 404 and linked in footer — must exist before launch.

---

### `/resources` — Ressurser

**Title:** Ressurser — Alt du trenger som BI-student

**Sections:**
- Hub page with links to:
  - BI-fondet
  - Studiekvalitet
  - Vår politikk
  - Varsling
  - Alumni
  - Lover og vedtekter
- Links to external resources: bi.no, Velferdstinget, NSO

**Notes:** Currently 404 and linked in footer — must exist before launch.

---

### `/alumni` — Alumni

**Title:** Alumni — Hold deg koblet etter studiene

**Sections:**
- Registration CTA (MS Forms)
- 3 value props: Events, Connect, Engage
- Active alumni profiles (4 on old site)
- Advisory board / Advisory styret

**Copy source:** `biso.no/alumni/`

---

### `/campus/[slug]` — Campus pages (Oslo, Bergen, Trondheim, Stavanger)

**Dynamic route:** `/campus/oslo`, `/campus/bergen`, `/campus/trondheim`, `/campus/stavanger`

**Sections per campus:**
- Hero with campus name and image
- Upcoming events (filtered by campus)
- Campus leadership / campus board
- Contact info (email, address, phone)
- Local member benefits
- Active units/committees on this campus
- Flagship local events: Fadderullan, Karrieredagene links

**Notes:** The `/campus` route exists in nav but times out. This may be a dynamic Appwrite fetch issue. Investigate and fix loading state.

---

### `/projects/fadderullan` — Fadderullan

**Title:** Fadderullan — Norges største studentfestival

**Sections:**
- Hero
- What is Fadderullan
- Campus editions: Oslo / Bergen / Trondheim / Stavanger (tabs or cards)
- Timeline / key dates
- Register CTA

---

### `/projects/winter-games` — Winter Games

**Title:** Winter Games — Årets høydepunkt

**Sections:**
- Hero
- What is Winter Games
- Previous editions gallery
- Register CTA

---

### `/projects/karrieredagene` — Karrieredagene

**Title:** Karrieredagene — Møt din fremtidige arbeidsgiver

**Sections:**
- Overview hero
- Campus editions with contact/signup (Oslo, Bergen, Trondheim, Stavanger)
- For students section
- For businesses CTA → `/business`

---

## 6. Navigation Implementation Notes

### Mega Menu Component Spec

- Trigger: hover (desktop) / tap (mobile)
- Animation: smooth fade + slight translate-Y (200ms ease)
- Mobile: full-screen drawer, accordion-style collapsible sections
- Active state: highlight current section
- Keyboard accessible (arrow keys, Escape to close)
- "For Bedrifter" can be a standalone link (not mega) since `/business` is a complete page

### Recommended file structure

```
components/
  nav/
    Navbar.tsx           — main nav shell
    MegaMenu.tsx         — mega menu container
    MegaMenuPanel.tsx    — individual panel (students, projects, about)
    MobileDrawer.tsx     — mobile nav drawer
    NavLink.tsx          — individual nav link with active state
```
