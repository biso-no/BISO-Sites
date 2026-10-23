# Page editor redesign: on-brand, creative department pages and a Winter Games page — design

## Why

`redesign/apps-web` gives `apps/web` a new visual identity: navy and white
surfaces, Museo Slab uppercase display type, the 13° chevron media frame,
hairline-separated sections and quiet motion. It is the version that goes to
production.

Pages built in the admin block editor (`packages/editor`) were left out of
that redesign. Its blocks still render in the old look: gradient buttons,
16px corners, black shadows, grey alternating bands, sentence-case headings
and the old hex palette. A department page built today looks like a
different site from the one around it. That blocks the production deploy.

BISO wants its departments and projects to make **great** pages, not fill in
a form. A board should be able to tell its story with real structure
(things side by side, media, numbers, people, live events) and give the page
its own colours, while the result still clearly belongs to biso.no. The
limit is the design system, not the number of blocks.

The first real page is **Winter Games**, BISO's national winter project. Its
page replaces the coded hub at `/projects/winter-games` and shows off the
2026 aftermovie.

## Success looks like

- The Winter Games board signs into admin, opens their page and finds a
  finished draft built from the new blocks: header with a looping clip from
  the aftermovie, facts, the full aftermovie, activity cards, gallery,
  upcoming events and the team. They change a sentence, press Publish, and
  `/projects/winter-games` shows it within a minute.
- The Fadderullan board in Oslo builds their page at
  `/units/oslo/fadderullan`. They put a photo next to a text block in a
  two-column section, check it on the phone preview, where the photo stacks
  above the text, and set their colours to deep purple and lilac with the
  theme picker. The nav, page header, dark sections and footer of their page
  turn purple. The rest of biso.no stays navy.
- They paste `#9B5DE5` as their dark colour. The picker says it is too light
  for white text and offers `#8A4DD6` with one click.
- Every block on a published page looks like it belongs on the redesigned
  site. Someone who knows the redesign could not tell a built page from a
  coded one.
- Nothing in the editor's own interface (topbar, palette, canvas chrome,
  inspector) changes look. Only the controls the new features need are added,
  in the existing style.

## Decisions made with Markus

These were decided in conversation on 2026-10-23. A builder should treat them
as fixed.

### D1. Where project and department pages live

- **National projects** (one unit, campus "national", e.g. Winter Games):
  the admin-built page is served at **`/projects/<project-slug>`**
  (`/projects/winter-games`) and replaces the coded hub there. The project's
  own board builds and edits it, under the normal rule that a department user
  edits only their own department's pages.
- **Multi-campus projects** (Fadderullan, Karrieredagene; one unit per
  campus): each campus unit's page lives at **`/units/<campus>/<slug>`**
  (today's setup) and replaces that unit's coded default page. The
  **`/projects/<slug>` hub** stays the coded cross-campus hub unless someone
  builds a hub page for it, which then replaces it. No single campus board
  owns a multi-campus hub, so only national admins (`globaladmin`) can build
  those.
- The general rule stays: **a published admin page replaces the coded
  default**; no page means the coded default shows.

### D2. Existing pages are disposable

All currently published editor pages are tests. There is **no migration** of
old documents. The new editor may ignore or discard old-format documents.

### D3. Storage limit

The page document columns on `page_translations` (`draft_document`,
`puck_document`, both deprecated `string` size 50000) are replaced by
**`mediumtext`** columns (about 4.2 million characters). Markus pushes schema
changes; see "Schema changes" below.

### D4. Uploads

Markus has raised the `media` bucket's maximum file size to **150 MB** in the
Appwrite console. The admin app's own limits must match (today both are
10 MB).

### D5. Sections and columns

A page is built from **sections**. A section holds **one to four columns side
by side**. Each column holds a stack of blocks. Section settings, as shown in
the editor mockup:

- **Columns:** 1, 2 equal, 2 wide-left, 2 wide-right, 3 equal, 4 equal.
- **Background:** White, Tinted, Dark (the theme's dark colour) or Photo
  (full-bleed image behind the section, with a flat dark scrim for legible
  text).
- **Spacing:** Tight, Normal, Roomy.
- **Align columns:** Top, Middle, Bottom.
- **Tablet:** Side by side or Stacked.
- **Phone:** always stacked, with "Show column 2 first" and "Hide section on
  phone".

Blocks are dragged from the palette into any column, and each column has its
own "+ Add block". "+ Add section" sits at the bottom of the page (and
between sections). The existing desktop / tablet / phone preview stays. Every
block must look right at any column width; a four-column cell is narrow.

### D6. Mobile and tablet

Pages must be fully usable on phones and tablets. Editors can preview each
device in the editor and control the behaviour above. A block can also be
hidden on phones.

### D7. Themes: a dark colour and an accent

Any department or project can have a **theme** of two colours:

- **Dark:** replaces BISO navy (`--biso-deep`) as the dark surface colour.
- **Accent:** replaces BISO sky (`--biso-sky`) as the bright accent.

On that department's pages the theme colours the **nav, page header, dark
sections, footer**, buttons, links, stat numbers, accent rules and chevron
frames. White surfaces, typography, the chevron shape and spacing stay BISO.
Elsewhere on the site, navy comes back. A department with no theme looks
exactly like the rest of biso.no.

This deliberately overrides `docs/redesign/01-design-spec.md` §7.4 (project
identity only inside the chevron frame). Markus found navy next to a project
colour clashes, and chose to let the project colour replace navy on its own
pages.

Shades that must work on white (link text, button text, numbers on white)
are **derived** from the theme, never picked separately. A light accent such
as gold becomes a darker gold for text on white.

### D8. The theme picker

In the editor's page settings, a **Theme** panel shows the two colours. Each
has:

- a full colour picker (saturation/value area plus hue slider),
- a **hex field** to type or paste a value,
- quick picks for BISO's own colours (deep `#001A35`, blue `#1668AE`, sky
  `#3AA3E1`, sun `#FECD45`),
- **Reset** to BISO.

The check runs live as they drag or type:

- **Dark** must give white text at least **4.5 : 1** contrast.
- **Accent** must stand out on the dark colour (at least **3 : 1**) and work
  as a button with dark text on it (at least 4.5 : 1).

(The exact thresholds were tightened in C2b.)

A colour that fails shows a plain-language reason and a one-click button
offering the **nearest passing shade** (same hue, adjusted lightness). The
canvas repaints live. The page cannot save a failing theme.

The current five-swatch accent picker (`HUE_COLORS` / `meta.accentColor`)
goes away.

### D9. The block library

Every block is rebuilt in the redesign's visual language and works at any
column width.

| Group | Blocks |
|---|---|
| Page opening | **Page header**: dark band with breadcrumb, eyebrow, display title, intro, up to two buttons and optional media (image, video or muted loop) in a chevron frame. Variants: split (media beside), full-bleed media behind, plain. |
| Text and story | **Text** (rich text), **Heading** (eyebrow, title, intro; optional "see all" link with the sun marker), **Quote**, **Callout**, **Highlights** (accent-rule list), **Facts** (the "At a glance" label/value rail) |
| Media | **Image**, **Gallery**, **Video** (upload or YouTube/Vimeo; poster image; a large "featured" style; muted autoplay loop option) |
| Structure | **Stats**, **Timeline** (also used as a programme), **Steps**, **FAQ** (a real accordion), **Tabs**, **Cards** (merges today's featureGrid, featuredCards, linkTileGrid and scrollRow: grid or scroll-row layout, cards with or without image, icon and link) |
| People | **Team** (photo upload or initials, name, role, email, optional phone; or the department's board pulled live from Microsoft 365, the way the default unit page does through `cachedUnitBoard`), **Contact** (email, phone, socials, address, hours) |
| Live from BISO | **Events**, **News**, **Jobs**, **Partners**, **Units**, **Shop** (connected to the webshop for real) |
| Actions | **Buttons**, **Call-to-action band**, **Signup**, **Form** (multi-step, sending every step's answers), **Documents** (upload files instead of typing IDs) |
| Small extras | **Divider**, **Marquee** |

**Cut:** profileHeader, filterBar, campusSelector, twoCol, and hero (replaced
by Page header).

### D10. The editor keeps its look

The editor's interface (topbar, palette, canvas stage, inspector, copilot)
keeps its current design, which Markus likes. Section/column controls and the
theme picker are added **in that existing style**. The mockups from the
brainstorm only showed layout, not styling.

### D11. Motion

Blocks follow the redesign's quiet motion rules (`docs/redesign/01-design-spec.md`
§1.9; enforced for `apps/web` by `apps/web/src/app/motion.test.ts`): no
fade-ins on scroll, no hover lift, no gradients. The exceptions are the
Marquee and muted looping video, which are opt-in per block and stop (poster
image or static text) when the visitor has reduced motion turned on.

### D12. The Winter Games page

Markus approved the draft in
`.superpowers/brainstorm/9164-1792732362/content/winter-games-page-v3.html`
("This looks awesome!"). Its content and order are specified under
"The Winter Games page" below.

## My calls (Markus can override)

- **C1. Theme storage.** A department's theme is stored on the
  **department** row, so all its pages (and its coded default page) match.
  A page with no department (a multi-campus hub, a general page) stores its
  own theme in page meta. The editor's Theme panel edits whichever applies
  and says so ("Applies to all Fadderullan Oslo pages").
- **C2. Who sets a theme.** Anyone who can edit the department's pages.
- **C2a. A theme goes live on Publish, like everything else.** While editing,
  the theme is part of the page's draft (in the draft document's meta), so
  trying colours never touches the live site. Publishing a department page
  copies its theme to the department row, which then applies to all that
  department's pages and its coded default page. Publish already refreshes
  the site (C5). Pages without a department keep the theme in their own
  published document.
- **C2b. Contrast thresholds, made coherent.** Text on an accent button is
  the theme's **dark** colour (as in the approved mockup). So the rules are:
  dark against white at least **7 : 1** ("dark" stays genuinely dark, like
  navy at 17 : 1, which leaves room for a bright accent), and accent against
  dark at least **4.5 : 1** (covers both "stands out" and button text). This
  tightens D8's 4.5 : 1 for the dark colour. The `#9B5DE5` → `#8A4DD6`
  example in the mockup was only an illustration. The "nearest passing
  shade" keeps the hue and moves lightness just past the threshold.
- **C3. National project URL.** For a national project, the unit URL
  (`/units/national/wintergames`) redirects to `/projects/winter-games` once
  a page exists, so there is one canonical address.
- **C4. Page slugs for project pages.** Hub and national-project pages use
  the slug `projects/<project-slug>`, reserved like `units/` is today
  (`apps/admin/src/lib/unit-page-guard.ts`). A national project's page is
  bound to its national unit (so its board can edit it). A multi-campus hub
  page has no department, so only `globaladmin` can edit it. The admin
  "unit page" entry point (`createUnitPage`) creates `projects/<slug>` instead
  of `units/national/<slug>` for national project units.
- **C5. Publish refreshes the site.** Publish and unpublish trigger the
  existing web revalidation hook (`apps/admin/src/lib/web-revalidate.ts`) so
  changes show within seconds, not after the cache expires.
- **C5a. Large uploads are chunked.** The admin upload route reads the whole
  body into memory and runs on Appwrite Sites, whose request-size limit is
  unknown. Rather than trusting a 150 MB single request, the browser sends
  large files to the admin route in chunks of a few MB, and the route
  forwards each chunk to Appwrite's chunked upload (same file ID,
  `Content-Range`) with the service key. The `media` bucket's permissions do
  not change. Small files keep the single-request path.
- **C5b. "Tinted" is the redesign's sunken surface** (`--surface-sunken`,
  `#EEF1F5`). It is only ever applied when an editor picks it. Sections never
  alternate automatically (today's `resolveBackgrounds` auto-alternation is
  dropped), so the grey zebra bands the redesign removed can't come back by
  default.
- **C6. Aftermovie delivery.** The 109 MB / 11 Mbps master is too heavy for
  phones. Upload a web encode instead: H.264 1080p at about 4.5 Mbps with
  `+faststart` (about 45 MB), plus a poster frame. The header loop is a
  separate muted 4-second clip (720p, about 1–2 MB, no audio).
- **C7. Copilot.** The AI copilot is kept and updated to the new model
  (insert sections and blocks into columns, set the theme within the same
  contrast rules, all blocks insertable). It is not redesigned.
- **C8. Live blocks with nothing to show** (Events with no upcoming events,
  for example) are hidden on the public page and show a placeholder in the
  editor.
- **C9. Phone numbers.** The Winter Games team is shown with role emails
  only. Their contact list has personal mobile numbers; publishing them is
  Markus's call (see open questions).
- **C10. Languages.** The Winter Games page gets a hand-written English
  version alongside the Norwegian one, not machine translation.
- **C11. Fix-while-there bugs.** These sit in code the work touches anyway:
  - Unpublishing one locale takes both offline (`unpublishPage` sets the page
    to draft).
  - The editor's department dropdown lists every department on the campus to
    department users (`listAllDepartments`), and the server then rejects the
    choice. It should list only departments they can edit.
  - `MediaPicker` treats an uploaded video as an image, because Appwrite
    `/view` URLs have no file extension.
  - Opening `/pages/new` creates an empty "Uten navn" row after 800 ms through
    autosave.

## Non-goals

- Restyling the editor's interface (D10).
- Migrating existing editor pages (D2).
- A media library browser for previously uploaded files.
- Project palettes from the empty `large_event` table. Themes come from D7
  instead; `large_event` is untouched.
- Per-block colour pickers, custom fonts or free spacing values. The theme
  and section settings are the only styling controls.
- Revision history for pages.
- Generic iframe or HTML embeds (security), and Instagram feed embeds.
- Draft visibility. Both page tables are `rowSecurity: false` with
  `read("any")`, so drafts are publicly readable through the API. This is a
  pre-existing issue, flagged for a separate fix.

## Anti-goals (a failure even if it works)

- A built page that looks off-brand next to the coded pages: gradients,
  rounded soft cards with shadows, sentence-case display headings, grey
  zebra bands, colours outside the theme.
- A theme that produces unreadable text. The contrast rules are hard limits.
- A themed department leaking its colours onto other pages after navigation.
- A layout that breaks on a phone: horizontal scroll, columns that don't
  stack, text overflowing a narrow column.
- The editor's look changing.
- The editor's stylesheet restyling the host site (the regression fixed in
  1645ab12, guarded by `theme/brand-surface.test.ts` "nothing reaches the
  host page").

## Constraints

- Bun only; `bun run check-types` must pass; Ultracite/Biome formatting.
- All data access through `@repo/api`.
- `packages/api/appwrite.config.json`: column and table changes are made in
  this file and **Markus pushes them**, then regenerates
  `packages/api/types/appwrite.ts` (never hand-edited).
- No production writes, schema pushes, deploys or `git push` without Markus.
- The visual source of truth is `docs/redesign/01-design-spec.md` and the
  living design-system page `apps/web/src/app/(public)/design-system/page.tsx`.
  Tokens are in `packages/ui/styles/biso-surface.css` (`.biso-surface-v2`) and
  `packages/ui/styles/globals.css` (type roles, radii, elevation, motion,
  `.chevron-frame`). Reuse the redesign's primitives and idioms
  (`apps/web/src/components/ui/*`) where the editor package can; the editor
  package cannot import from `apps/web`, so shared pieces may need to move to
  `@repo/ui`.
- The admin canvas renders blocks in the same DOM as the admin app, not in an
  iframe. It must mount the v2 tokens (`biso-surface-v2`) **on the canvas frame
  only**, so the admin's own UI is untouched.
- Blocks size against their container with container queries (today
  `container: pg` on `.pg-page` / `.pe-frame`), so the editor's device preview
  hits the real breakpoints. Columns need their own container context so a
  block in a narrow column lays out as narrow.
- `turbo.json` build env allow-list for any new build-time env var.

## How it fits together (current state, for orientation)

- **Document model today:** `PageDoc { meta, blocks: Block[] }`, flat, no
  nesting, no version (`packages/editor/src/editor/types.ts`). Stored as JSON
  per locale on `page_translations` (`draft_document`; published copy in
  `puck_document`), via `packages/api/page-builder.ts`.
- **Registry:** `packages/editor/src/blocks/registry.ts` plus a
  hand-maintained `BLOCK_LIBRARY` palette list that has drifted from it.
- **Rendering:** `BlockView` (`packages/editor/src/blocks/block-view.tsx`) is
  shared by the admin canvas and web (`apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx`,
  and the units route). Blocks are client components, SSR'd. Live feeds are
  resolved server-side in web (`apps/web/src/lib/data/page-feeds.ts`) and
  passed through `PageFeedProvider`; the admin canvas fetches them over HTTP
  from `/api/pages/*`.
- **Styling today:** `packages/editor/src/theme/{tokens,blocks,editor}.css`.
  `blocks.css` (about 2,160 lines) styles 32 blocks on legacy tokens;
  `editor.css` is the admin chrome (keep). `_primitives/` (`BlockSection`,
  `BlockHeading`, ...) is Tailwind but on legacy tokens too. `--ink` in
  `tokens.css` collides with the v2 `--ink`.
- **Routing:** `apps/web/src/app/(public)/projects/[slug]/page.tsx` never
  looks for an editor page today. Unit pages are looked up in
  `apps/web/src/app/(public)/units/[...segments]/page.tsx` by slug
  `units/<campus>/<departments.slug>` plus `department_id`
  (`packages/shared/utils/unit-urls.ts`). Project ↔ unit mapping is
  `packages/shared/utils/project-units.ts` (`winter-games` → unit slug
  `wintergames`, campus "5" / national).
- **Nav and footer** (`apps/web/src/components/nav/mega-nav-v2.tsx`,
  `components/layout/footer-v2.tsx`) paint with the v2 tokens
  (`bg-deep` / `data-surface="deep"`), so a theme can recolour them by
  overriding the token values for the duration of a themed page.
- **Scoping:** `apps/admin/src/lib/utils/authorization.ts` and
  `apps/admin/src/lib/content-authorization.ts`; enforced in
  `apps/admin/src/app/(portal)/_actions/pages.ts`.
- **Uploads:** `apps/admin/src/lib/upload-client.ts` (`MAX_UPLOAD_BYTES`) and
  `apps/admin/src/lib/upload-buckets.ts` (`TEN_MB`), through
  `apps/admin/src/app/api/upload/route.ts`. Images render as plain `<img>`
  of the full original file.
- **Known broken blocks today** (being replaced anyway): productGrid shows
  nothing publicly; filterBar is wired to nothing; campusSelector is
  hardcoded; FAQ never collapses; multiStepForm sends only the last step;
  documents links to a nonexistent `/api/files` route; several renderer
  classes have no CSS; twoCol and featureGrid never stack on phones.

## Schema changes (Markus pushes)

1. `page_translations`: remove `draft_document` and `puck_document`; add two
   `mediumtext` columns for the draft and the published document (suggested
   keys `draft_doc` and `published_doc`). No data copy (D2).
2. `departments`: add two nullable colour columns for the theme (suggested
   `theme_dark`, `theme_accent`, varchar 7, `#RRGGBB`).
3. `media` bucket: set `maximumFileSize` to 150 MB in the config file to match
   what Markus already set in the console.

Deploy order matters: the live `main` site and admin read the old columns.

- **Early push (D13):** the additive changes (the two new `mediumtext`
  columns, the theme columns, the bucket size) are written to
  `appwrite.config.json` first, and Markus pushes them before the build
  starts. Adding columns doesn't affect the live site.
- **At cutover:** `draft_document` and `puck_document` are removed, together
  with deploying the new web and admin.

## The document model (to be designed by the builder, within these rules)

- A **version field**; the loader treats anything without the new version as
  an empty page (D2).
- `sections[]` → `columns[]` → `blocks[]`. Sections carry the D5 settings and
  an optional **anchor** (so a button can link to `#aftermovie`). Blocks carry
  their own props plus "hide on phone".
- The **Page header** block may appear once, in the first section, full width.
- Feed collection (`collectPageFeedRequests`), `resolveBackgrounds`-style
  passes and the AI serializer must walk the tree, not a flat list.
- One document per locale, with shared meta synced across locales as today
  (`syncSharedMeta` in the admin page editor client).

## The Winter Games page

Department: the national **Wintergames** unit. URL: `/projects/winter-games`.
Theme: none (BISO navy and sky). Status: **draft** until Markus or the board
publishes.

Sources (in `temp/`, not committed):
- `WG - Biso nettsidebeskrivelser .pdf`: short and long descriptions (all page
  text comes from here).
- `WG kontaktliste.pdf`: the eight team members.
- `wg-26-aftermovie.mp4`: 78 s, 1080p, 109 MB.
- `AHA - BISO -05883Christian - Carpagnano_.jpg`: the arena (2000×1334).
  Note: Red Bull branding is visible in this photo and in much of the
  aftermovie.

Sections, in order (Norwegian copy as approved; English written to match):

1. **Page header**, split. Breadcrumb "Prosjekter / Winter Games". Eyebrow
   "Nasjonalt prosjekt". Title "Winter Games". Intro: "BISOs største
   nasjonale studentarrangement. Tre dager på Storefjell med studenter fra BI
   Oslo, Bergen, Trondheim og Stavanger." Buttons: "Se aftermovien" (to the
   aftermovie section's anchor) and "@bisowintergames"
   (`https://www.instagram.com/bisowintergames/`). Media: the muted loop from
   the aftermovie (about 0:09.8–0:13.8, the team in retro ski suits), with a
   still as the reduced-motion poster.
2. **Stats**, three items: "4 / campuser samlet på ett fjell", "3 / dager på
   Storefjell", "Alt / inkludert: transport, overnatting og måltider".
3. **Two columns** (wide-left). Left: Heading (eyebrow "Om Winter Games",
   title "En møteplass på tvers av campus") and Text, two paragraphs from the
   long description (the "felles møteplass" paragraph and the "høyfjellet /
   Storefjell Resort Hotel på Golsfjellet i Hallingdal" paragraph). Right:
   Facts: Hvor / Storefjell Resort Hotel, Golsfjellet; Hvem / Studenter fra
   BI Oslo, Bergen, Trondheim og Stavanger; Varighet / Tre dager; Inkludert /
   Transport, overnatting og måltider.
4. **Dark section**, anchor `aftermovie`. Heading (eyebrow "Aftermovie",
   title "Winter Games 2026"). Video, featured style, the web encode with a
   poster frame of the crowd (about 0:30).
5. **Cards**, heading "Tre dager, alt på ett sted", three cards with
   aftermovie stills:
   - "Vinterleker og lagkonkurranser": "Konkurranser laget for engasjement,
     lagfølelse og god stemning. Du trenger verken være erfaren på ski eller
     spesielt konkurranseinnstilt." (still about 0:10.5)
   - "Ski og vinteraktiviteter": "Dagene fylles med ski og aktiviteter på
     fjellet, sammen med studenter fra hele landet." (about 1:00)
   - "Afterski, konserter og DJs": "Kveldene byr på afterski, konserter, DJs,
     temakvelder og andre sosiale aktiviteter." (about 0:27)
6. **Quote**: "Det som gjør Winter Games spesielt, er kombinasjonen av
   aktivitetene, stemningen og menneskene." (no attribution)
7. **Gallery**, five stills: aerial at dusk (about 1:15.5), afterski selfie
   (about 0:52.5), two friends at the party (about 0:33.5), teepees from the
   air (about 1:03), arrival (about 0:04).
8. **Events** (live, Winter Games unit), heading "Kommende arrangementer".
   Hidden while empty (C8).
9. **Team**, eyebrow "Kontakt", title "Teamet bak Winter Games", initials (no
   photos supplied), role emails (C9):
   - Emma Martinsen, Prosjektleder, manager.wintergames@biso.no
   - Jørn Valaker, Sikkerhetsansvarlig, security.wintergames@biso.no
   - Sanne Skaarup, Event manager, dagsprogram og vinterleker, program.wintergames@biso.no
   - Julie Leonie Finberg, Event manager, kveldsprogram og artister, entertainment.wintergames@biso.no
   - Noemi Kudla, Logistikkansvarlig, operasjonell, operations.wintergames@biso.no
   - Emily Guldvog, Logistikkansvarlig, billett, logistics.wintergames@biso.no
   - Marielle Brenden, PR- og kommunikasjonsansvarlig, communication.wintergames@biso.no
   - Filip Riise, Økonomi- og forretningsansvarlig, finance.wintergames@biso.no
10. **Dark call-to-action band**: eyebrow "Følg eventyret", title "Se mer på
    Instagram", button "@bisowintergames".

**Getting it into production** (my call): build the page document and the
processed media in the repo's tooling (a script or fixture). Create it as an
**unpublished draft** bound to the Wintergames unit, uploading media to the
`media` bucket, which D13 allows. Markus or the board publishes from the
editor.

## Left to the builder

- The exact document schema, block prop shapes and how the store, DnD
  (dropping into columns, moving blocks between columns and sections) and
  undo work with the tree.
- How the theme reaches the nav and footer (which sit outside the page tree)
  for the duration of a themed page and is removed on navigation, without a
  flash of navy.
- The colour maths for deriving on-white shades and the "nearest passing
  shade".
- Whether blocks keep `pg-*` CSS or move to Tailwind on v2 tokens. Either
  way, the editor's guard tests (`theme/brand-surface.test.ts`,
  `theme/section-layout.test.ts`, `blocks/block-view.test.tsx`) are rewritten
  for the new system, and the redesign's legacy-utility ban
  (`apps/web/src/app/redesign-coverage.test.ts`) should cover
  `packages/editor/src/blocks` too.
- Responsive images (for example Appwrite's image preview endpoint for sized
  renditions) and lazy loading.
- Page-top clearance under the fixed, transparent nav (the Page header should
  sit under the nav the way coded page headers do).
- How Shop reads the webshop data the default unit page already uses
  (`UnitShop`), and how the Team block's live board option reuses
  `cachedUnitBoard`.
- How to stage the work into plans.

## Answered after the builder check

### D13. Testing against production (Markus, 2026-10-23)

Local `apps/admin` and `apps/web` point at the production Appwrite; there is
no staging. Markus chose:

- He pushes the **additive** schema changes before the build starts (see
  "Schema changes").
- While building, the builder **may create unpublished test pages and upload
  test media in production** to test save, upload and render end to end. It
  must **never publish** them, and must delete them when done (list them in
  the hand-over).
- Removing the old columns happens only at cutover.

Everything else outward-facing (publishing, deploys, `git push`, removing
columns, editing real departments' themes) still needs Markus.

### Still open

- C9: whether the Winter Games team's mobile numbers go on the page (default:
  no).
