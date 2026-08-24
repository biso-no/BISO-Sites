# On-brand page blocks

**Date:** 2026-08-21
**Status:** Approved design, pending implementation plan
**Scope:** `packages/editor`, `packages/ui`, `apps/web`, `apps/admin`

## 1. Problem

Pages composed in the admin page editor (`/pages/{id}`) are rendered to students
by `apps/web`. The blocks that compose those pages are built on a design system
unrelated to the BISO brand, and are not production-quality on the public web.

`apps/admin` looking different from `apps/web` is deliberate and stays that way.
This document is only about the **block-rendering path** — what a student sees.

### 1.1 Verified current state

| Finding | Evidence |
|---|---|
| Blocks use a "paper" design system — warm paper `#faf7f2`, claret `#6b1e1e`, gold, serif display type — ported from an older `BISOAdm-4` project. The web brand is BISO blue `#3DA9E0` / navy `#001731` / yellow `#F7D64A`. | `packages/editor/src/theme/tokens.css` vs `apps/web/src/app/styles.css` |
| `blocks.css` contains **zero** media queries in 1742 lines. Column counts are inline `repeat(N,1fr)`, section padding is a fixed `48px`, hero `h1` is a fixed `60px`. Every CMS page is a squashed desktop layout on a phone. | `packages/editor/src/theme/blocks.css` |
| `tokens.css` styles bare `body`/`html` — `background: var(--paper)`, `font-size: 14px`, plus a `body::before` overlay. `apps/web` imports it, so opening a CMS page repaints the whole site's body. | `tokens.css`, `apps/web/.../rendered-page.tsx:3` |
| No dark mode. `apps/web` runs next-themes with `defaultTheme="system"`, so CMS pages would be the only light-locked pages on the site. | `apps/web/src/app/providers.tsx` |
| `.pg-page`, the wrapper `RenderedPage` renders, is **not defined in any stylesheet**. There is no max-width and no vertical rhythm; each block improvises its own padding. | `rendered-page.tsx` + `grep pg-page packages/editor/src/theme/*.css` |
| Museo Sans and Inter are loaded on every web page view and applied to nothing. No `font-family` declaration exists in either stylesheet, there is no `tailwind.config.*` (v4 is CSS-first) and no `--font-sans` override. The site renders in the default system stack. | `apps/web/src/app/layout.tsx:44`, `fonts.ts`, `styles.css`, `packages/ui/styles/globals.css` |
| Four data blocks fetch endpoints that do not exist: `/api/pages/{events,jobs,news,partners}`. Only `/api/pages/departments` and `/api/form/submit` are real. Each failure is caught and silently falls back to `block.items`, so an admin ships a page showing invented events with no error anywhere. | `blocks/{events,jobs,news,partners}/render.tsx` vs `find apps/web/src/app/api -name route.ts` |
| Three matching endpoints exist in **admin** at `/api/page-editor/collections/{events,jobs,news}` but nothing calls them — dead code. They are auth-gated and emit the same toy shape. | `apps/admin/src/app/api/page-editor/collections/*` |
| `productGrid` never fetches at all. In view mode it renders the literal sentence "Products load from the shop on the live page." to students. | `blocks/productGrid/render.tsx` |
| Block data shapes are placeholders. `EventItem` is `{date, going, title, where}` — no id, no image, no href — so even a working endpoint could not produce a clickable card. | `packages/editor/src/editor/types.ts:156` |
| The block palette advertises "Start from a template" over a single button that opens the AI copilot. No templates exist. | `components/editor-shell/palette/index.tsx:96` |
| The page accent is written to `--accent`, which in Tailwind/shadcn is the reserved "subtle hover surface" token consumed by `command`, `dialog`, `calendar`, `toolbar`, `toggle` and others. | `theme-scope.tsx:20`, `theme/apply.ts:5`, `packages/ui/components/ui/*` |

## 2. Goals

1. A page composed in admin is visually indistinguishable from a hand-coded
   `apps/web` page — same tokens, same components, same typography, same motion.
2. Pages are correct on phones, tablets and desktops, in light and dark.
3. An admin who sets no options still produces a well-composed page; the design
   controls are overrides, not prerequisites.
4. It is structurally impossible to author an unreadable colour combination.
5. Live-data blocks show live data, or say plainly that they cannot.

## 3. Non-goals

- Redesigning `apps/admin` chrome. `editor.css` (`.pe-*`) and the `#6b1e1e`
  claret used across `apps/admin/src/app/(portal)/**` are admin's own visual
  language and are **explicitly out of scope**. See §9.1.
- Adding, removing or merging block types. All 33 survive.
- Changing the draft/publish flow in `@repo/api/page-builder`.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Retheme + page-level design controls | Restyling alone leaves every section an identical slab |
| D2 | Fixed brand palette, department-mapped; no hex field | A free colour picker is how a non-designer eventually ships an off-brand page |
| D3 | Blocks follow the site theme (light + dark) | CMS pages would otherwise be the only light-locked pages on the site |
| D4 | No backward-compatibility shims | Nothing real is published yet; confirmed with the owner |
| D5 | Full Tailwind + `@repo/ui` rewrite | CMS pages and hand-coded pages become literally the same components, so drift is impossible rather than merely discouraged |
| D6 | Wire the brand fonts sitewide | The fonts are already downloaded on every page view; scoping them to blocks only would make CMS pages the sole correctly-typeset pages |
| D7 | Expose background + spacing + width | Named choices only; the contrast contract keeps every combination legible |
| D8 | Build the five missing endpoints and share the real web cards | The full expression of D5 for the four highest-traffic content types |
| D9 | Starter templates + an AI-drafted first pass | The copilot is already functional; templates are data files once primitives exist |

## 5. Architecture

### 5.1 Token layer

The public palette currently lives inline in `apps/web/src/app/styles.css` under
`:root`/`.dark`, which is why `apps/admin` cannot reuse it. It moves verbatim
into one shared file behind a zero-specificity selector:

```css
/* packages/ui/styles/biso-surface.css — the BISO public brand surface */
:where(.biso-surface) { --background: …; --foreground: …; --brand: …; /* … */ }
.dark :where(.biso-surface) { /* dark ramp */ }
```

One definition, two mount points:

- `apps/web` puts `biso-surface` on `<html>` and deletes its now-duplicated
  `:root`/`.dark` blocks. Values are identical, so this is a visual no-op.
- `apps/admin` puts `biso-surface` on the editor **canvas frame only**. Chrome
  outside the canvas keeps admin's palette.

`:where()` holds specificity at 0 so app-level rules still win. Radix portals
mount to `document.body`; in web that is inside `.biso-surface` (correct), in
admin it is outside (also correct — admin dialogs should look like admin).

This works because `packages/ui/styles/globals.css` uses `@theme inline`, so
`bg-brand` compiles to `background-color: var(--brand)` and re-resolves at point
of use. It is the same mechanism the existing `.dark` blocks already rely on.

**Validate this first.** It is the load-bearing assumption of the whole design:
before any block work, confirm in a production build that a `bg-brand` element
inside `.biso-surface` in `apps/admin` paints BISO blue, not admin's palette.

`packages/editor/src/theme/tokens.css` is deleted — the paper palette, the
`body`/`html` rules, the `body::before` overlay and the `--font-geist-sans`
references all go with it.

### 5.2 Typography

`biso-surface.css` maps `--font-sans` → Inter and `--font-display` → Museo Sans,
so `font-sans` and a new `font-display` finally resolve. `apps/admin` adds a
`localFont` declaration for Museo (`apps/admin/public/museo_sans_300.otf` is
already present) plus Inter, so the canvas previews in the real typeface.

Sitewide fallout is expected and intended: `apps/web` changes typeface in the
same deploy. Heading sizes must be re-checked after the swap — Museo Sans 300 is
a lighter, wider face than the system stack it replaces.

### 5.3 Tailwind content scanning

Both apps must scan the editor package or its utilities are purged:

```css
@source "../../../../packages/editor/src/**/*.{ts,tsx}";
```

The pattern is already proven in this repo — both apps do exactly this for
`@repo/ui`, and admin additionally for `packages/tours`. Purged utilities do not
error, they vanish, and only in production builds. See §10.

### 5.4 Primitives

New: `packages/editor/src/blocks/_primitives/`.

- **`BlockSection`** — every block's outermost element. Owns background,
  vertical spacing, content width, responsive padding
  (`px-4 sm:px-6 lg:px-8`, `py-12 sm:py-16 lg:py-24` at `normal`, matching
  existing `apps/web` pages) and max-width
  (`prose`→`max-w-3xl`, `content`→`max-w-5xl`, `wide`→`max-w-7xl`, `full`→bleed).
- **`BlockHeading`** — eyebrow, heading and intro as one typographic unit on the
  `font-display` scale with `text-balance`. Takes the heading level so hero
  emits `h1` and everything else `h2`, fixing the document outline.
- **`BlockGrid`** — `columns` of 2/3/4 mapped to **static** class strings
  (`sm:grid-cols-2 lg:grid-cols-3`), never interpolated: Tailwind cannot see
  `grid-cols-${n}` and would purge it. Collapses to one column on phones.
- **`BlockCard`** — thin wrapper over `@repo/ui`'s `Card` for block-local use.
- **`Reveal`** — the fade-and-rise on scroll that `apps/web` gets from `motion`'s
  `whileInView`. Disabled in edit mode and under `prefers-reduced-motion`.

### 5.5 The contrast contract

`BlockSection` does not merely paint a background — it **re-binds the semantic
tokens for its subtree**. On `inverted` it sets `--background: var(--inverted)`,
`--foreground: var(--inverted-foreground)`,
`--muted-foreground: var(--inverted-muted)`, `--border`, `--card`, and so on.

Because every `@repo/ui` component is token-driven, a `Button`, `Card` or
`Badge` dropped into a navy section becomes correct automatically, with no
per-block knowledge and no variant plumbing. Blocks read semantic tokens only —
**never a raw brand colour**. This is what makes unreadable output structurally
impossible rather than merely unlikely, and it is the primary payoff of D5.

### 5.6 Data model

```ts
export interface BlockLayout {
  background?: "auto" | "default" | "muted" | "brand" | "inverted" | "accent";
  spacing?: "none" | "compact" | "normal" | "spacious";
  width?: "prose" | "content" | "wide" | "full";
}
export type Block = (HeroBlock | MarqueeBlock | /* … */) & { layout?: BlockLayout };
```

Nested under `layout` so it cannot collide with existing block props, and
optional so it is a one-line type change rather than 33.

### 5.7 Auto-rhythm

`background` defaults to `auto`, resolved by a shared pure function that walks
the block list, alternates default/tinted, skips explicit overrides and never
repeats a background twice in a row. Both `RenderedPage` and the admin canvas
call the same function, so preview and production agree by construction.

## 6. Block inventory

### Tier 1 — interactive, rebuilt on `@repo/ui` (7)

`faq`→`Accordion`, `tabs`→`Tabs`, `gallery`→`Carousel`, `scrollRow`→`Carousel`,
`filterBar`→`ToggleGroup`+`Badge`, `campusSelector`→`Select`,
`multiStepForm`→`Progress`+`Input`+`Button` (submit logic to `/api/form/submit`
preserved unchanged). These stop hand-rolling keyboard and ARIA behaviour.

### Tier 2 — live data (6)

`events`, `jobs`, `news`, `partners`, `departmentGrid`, `productGrid`. See §7.

### Tier 3 — presentational (20)

`hero`, `marquee`, `text`, `quote`, `callout`, `twoCol`, `team`, `stats`,
`timeline`, `image`, `video`, `cta`, `contact`, `signup`, `featureGrid`,
`linkTileGrid`, `documents`, `featuredCards`, `stepGrid`, `profileHeader`.
Mostly mechanical. Two exceptions:

- `text` moves to `@tailwindcss/typography` (already loaded by both apps):
  `prose dark:prose-invert` plus a `prose` colour configuration bound to the
  surface tokens in `biso-surface.css`, so prose inherits the contrast contract
  instead of the plugin's own greys. Gives rich text real typographic rhythm.
- `hero` is rebuilt on the brand gradient/overlay tokens, replacing the
  hardcoded green `linear-gradient(135deg,#2f5d3a,#1a3422)` it paints today.

Per-block definition of done: renders correctly in light and dark, at 390 /
820 / 1180 px, in both the admin canvas and a web production build; reads only
semantic tokens; composes `BlockSection`; emits correct heading levels.

## 7. Live data

### 7.1 Endpoints

Add to `apps/web`: `/api/pages/{events,jobs,news,partners,products}`. These serve
anonymous public traffic, so unlike the admin equivalents they are **not**
auth-gated; they must apply the same row-permission rules the rest of the public
data layer uses. The dead admin routes at `/api/page-editor/collections/*` serve
as a query reference and are then deleted.

Endpoints return **full rows**, not the flattened toy shapes. The block item
types (`EventItem` and siblings) are replaced by the corresponding
`@repo/api/types/appwrite` row types.

### 7.2 Shared cards

`apps/web/src/components/{events/event-card,jobs/job-card,news/article-card,shop/product-card}.tsx`
move to a **new `@repo/content-ui` package** depending on `@repo/ui`,
`next-intl`, `date-fns`, `motion`, `lucide-react` and a type-only `@repo/api`.

Not `@repo/ui`: that package is documented in the root `CLAUDE.md` as the
Radix + Tailwind component library, and it currently has no `@repo/api` or
`next-intl` dependency. Adding backend row types and i18n to it would erase a
boundary the monorepo deliberately maintains. Not `@repo/shared` either — that
package is utils-only and contains no `.tsx`.

Their only app-local dependencies are `apps/web/src/lib/types/event.ts`
(84 lines) and `apps/web/src/lib/content-translation.ts` (45 lines); both import
nothing beyond `@repo/api/types/appwrite` and move with them.

Both the CMS blocks and the existing `/events`, `/jobs`, `/news` and `/shop`
pages then import the same components. Those four pages are regression surface
and must be checked before and after (§10).

## 8. Authoring

**Accent.** `--accent` → `--page-accent` everywhere in the block path, freeing
`--accent` to mean what shadcn means by it. `HUE_COLORS`
(claret/gold/leaf/sky) is replaced by brand-derived swatches and
`DEPARTMENT_ACCENTS` remapped onto them. The inspector shows named swatches,
never a colour value.

Claret defaults to update: `theme/presets.ts`, `editor/store.ts:85`,
`theme-scope.tsx:20`, `page-editor-client.tsx:65`,
`blocks/featuredCards/inspector.tsx:110,133`, `blocks/team/inspector.tsx:12`,
`blocks/team/render.tsx:7`, and `ai/tools/index.ts:107,109` — the last of which
currently instructs the model to pick claret/gold/leaf/sky and would otherwise
keep reintroducing off-brand accents.

**Inspector.** `InspectorPane` renders `<def.Inspector>` at exactly one place
(`inspector/index.tsx:59`), so the shared Design panel — background, spacing,
width — is a single insertion appearing under every block automatically.

**Canvas WYSIWYG.** The canvas frame gets `biso-surface` and the brand fonts.
Because `apps/admin/src/app/providers.tsx:8` locks admin to
`defaultTheme="light" enableSystem={false}`, the canvas needs its own light/dark
preview toggle beside the existing desktop/tablet/mobile control. Implement it
by toggling a `dark` class on a wrapper **outside** the `biso-surface` element:
the shared custom variant is `@custom-variant dark (&:is(.dark *))`, which
matches descendants only, so a `dark` class on the element itself would not
apply to that element.

**Templates.** 4–5 starter templates as data files (block arrays with layout
already composed): department landing, long-form policy, event campaign,
recruitment drive, simple info page. This makes the existing "Start from a
template" heading true.

**AI first pass.** `/api/page-editor/ai/chat` is functional — auth-gated,
streaming, with `insertBlock`, `removeBlock` and `setProp`. Extending it means:
teach the tool schema about `layout` and the templates, and raise
`stopWhen: stepCountIs(5)`, which is far too few steps to compose a whole page.

The route calls `anthropic("claude-opus-4-7")` directly while `packages/ai`
standardizes on `openai("gpt-5")`. **Flagged, not decided here** — the model and
whether this route should route through `@repo/ai` are the owner's call.

## 9. Cleanup

Deleted: `theme/tokens.css`, `theme/blocks.css`, the dead
`/api/page-editor/collections/*` routes, and the duplicated `:root`/`.dark`
brand blocks in `apps/web/src/app/styles.css`.

### 9.1 Explicit boundary

`#6b1e1e` appears throughout `apps/admin/src/app/(portal)/**` — shop studio, job
studio, event studio, recruitment, communications — and in
`packages/editor/src/theme/editor.css` (`.pe-*`). **That is admin's intentional
design language and must not be touched.** The claret purge applies only to the
block-rendering path enumerated in §8.

## 10. Verification

`bun run check-types` is **not** sufficient evidence for this work. Purged
Tailwind utilities do not raise type or lint errors; they silently vanish, and
only in production builds.

Definition of done:

1. `bun run build` passes for **both** `apps/web` and `apps/admin`, and block
   utilities are confirmed present in the built CSS.
2. `bun run check-types` and `bun x ultracite check` pass.
3. Every block verified in light and dark at 390 / 820 / 1180 px, in the admin
   canvas and in a web production build.
4. `/events`, `/jobs`, `/news`, `/shop` compared before and after the card move.
5. A page authored end-to-end in admin, published, and viewed on web.

No completion claim is made without the command output backing it.

## 11. Phasing

| Phase | Content | Gate |
|---|---|---|
| 0 | Validate the `@theme inline` scoping assumption (§5.1) in a production build | Blocks everything |
| 1 | `biso-surface.css`, fonts sitewide, `@source` wiring, delete `tokens.css` | Both apps build; web visually unchanged apart from typeface |
| 2 | Primitives, contrast contract, `BlockLayout`, auto-rhythm, Design panel | One pilot block through the full stack |
| 3 | Tier 3 (20 blocks), then Tier 1 (7 blocks) | Per-block definition of done |
| 4 | Endpoints, `@repo/content-ui`, Tier 2 (6 blocks) | Regression pass on the four web pages |
| 5 | Accent palette, canvas theme toggle, templates, AI extension | End-to-end authoring test |

Phases 1–4 are the core deliverable. Phase 5 is separable if scope needs to be
cut, with the caveat that the accent rename in §8 belongs to phase 2, not 5,
because leaving `--accent` colliding with shadcn would visibly break `@repo/ui`
components inside the canvas as soon as phase 3 lands.
