# Page Editor Stage 2: The Redesign Look, Part A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the redesign's visual language on editor pages. That means v2 tokens on sections and the canvas, a page header, and the first fourteen blocks rebuilt (text, story, media, numbers and actions), so a page built from them is indistinguishable from a coded page.

**Architecture:**
- **Tokens.** Sections and the canvas frame adopt the redesign's v2 tokens (`.biso-surface-v2`, `data-surface="deep"` for dark).
- **Page header.** It becomes a document-level `header`, rendered before the sections. It replaces the `hero` block and owns the fixed-nav clearance.
- **v2 blocks.** Rebuilt blocks set `v2: true` in their definition and render with Tailwind utilities on v2 tokens and type roles. They adapt to their **column** width with container-query variants (`@sm:` …), never viewport variants. `BlockView` stops wrapping them in the legacy frame. Blocks not yet rebuilt keep the legacy frame until stage 3.
- **Visual check.** A noindex `/design-system/page-blocks` page on web renders a fixture document with every block. Since it needs no login, it doubles as the visual check.

**Tech Stack:** TypeScript, React 19, Next.js 16, Tailwind v4 (native container queries), zustand + immer, bun:test / vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md` (D5 Photo background, D9, D10, D11, D12; "The document model": header once, first, full width). Visual source of truth: `docs/redesign/01-design-spec.md`, `apps/web/src/components/ui/*` (`PageHeader`, `SectionHeading`, `StatRow`, `Prose`, `ChevronFrame`, `StatusPanel` button classes), `packages/ui/styles/globals.css` (`type-*` roles, `.chevron-frame`, `rounded-biso-*`, `shadow-elev-*`), `packages/ui/styles/biso-surface.css` (`.biso-surface-v2`, `[data-surface="deep"]`).

## Global Constraints

Everything from stage 1's Global Constraints still applies. See `docs/superpowers/plans/2026-10-23-page-editor-stage-1-sections.md`: Bun only, check-types, runners per package, ultracite on touched paths, `@repo/api` only, schema via Markus, the editor chrome look unchanged (D10), no stylesheet leaks, D13, `"use server"` rule. Commit trailer:
`Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and
`Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq`.

Stage 2 additions (they apply to every file of a block whose definition has `v2: true`, and to `blocks/_v2/`, `header/`):

- **Colours:**
  - Only v2 token utilities: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `text-ink`, `text-ink-muted`, `text-ink-accent`, `border-edge`, `bg-action`, `text-action-ink`, `bg-deep`, `bg-marker`, `ring-focus-ring`, plus the state utilities that `packages/ui/styles/globals.css` defines.
  - Never hex values, `text-white`/`bg-white`/`text-black`, Tailwind palette colours (`blue-500`…), or legacy/shadcn tokens (`bg-brand*`, `bg-section`, `bg-inverted`, `bg-primary`, `text-foreground`, `bg-muted`, `bg-card`…).
- **Type:**
  - Use the `type-*` roles: `type-display-hero`, `-lg`, `-sm`, `type-heading-section`, `type-label`, `type-heading-card`, `type-body`, `-sm`, `type-data`.
  - No `font-medium` (it resolves to Museo Light); use `font-semibold`/`font-bold`.
- **Shape:**
  - Corners: `rounded-biso-sm|md|lg|pill` only. Chevron frames are never rounded.
  - Shadows: `shadow-elev-1|2` only.
  - No gradients, `backdrop-blur`, hover-lift (`hover:-translate*`, `hover:scale` on cards), or decorative icon tiles.
- **Motion:** No `whileInView`, fade-ups or reveal animations. Muted looping video is opt-in per block or header and shows its poster under `prefers-reduced-motion: reduce`.
- **Responsive:** Use container-query variants (`@xs:` `@sm:` `@md:` `@lg:` `@xl:` `@2xl:` …), which resolve against the column (`.pg-col` is a container) or, for the header, the page (`.pg-page` / `.pe-frame`). Never viewport variants (`sm:` `md:` `lg:` `xl:`) in block files.
- **Semantics:**
  - The header title is the page's only `<h1>`; blocks never render `<h1>`.
  - Images need `alt` (empty string allowed only when an editor marks the image decorative).
  - Links are `<a>`, not `next/link` (the package is shared by both apps).
- **Editing:**
  - Text that sits visibly on the page is editable inline in edit mode with `EditableText` (`components/editor-shell/canvas/editable-text.tsx`).
  - Everything else goes in the block's inspector, built from `InspSection`/`InspRow` and the shared `ItemList` (Task 3).

## Review Focus

- **Dark sections:** every v2 block must stay legible on `data-surface="deep"` (aliases flip). Task 3's guard test bans hard-coded colours, and each block task renders its block inside a deep section and asserts no light-only class.
- **Narrow columns:** a v2 block in one column of a four-column section (~260px at desktop) must not overflow or force horizontal scroll. Task 3's guard test bans viewport variants. Each block task with a multi-item layout asserts its container-variant classes.
- **Missing media:** an image, gallery, video or header with no `src` shows a sunken placeholder in the editor and renders no broken `<img>` on the site. Tests in Tasks 4, 8 and 9.
- **Fixed nav:**
  - With a header, the header clears the nav.
  - Without one, the first section clears it and paints a navy strip behind the transparent nav.
  - Anchored sections scroll to below the nav.
  
  Tests in Tasks 2 and 4.
- **Translation:** header text and every new field must reach the auto-translator: `lede` added to the walker; facts use `text`, not the skipped `value`. Tests in Tasks 4 and 6.

---

### Task 1: Carried fixes from stage 1

**Files:**
- Modify: `apps/admin/src/app/(editor)/pages/[id]/_components/page-editor-client.tsx` (the `router.replace` after the first create, ~141-144; the explicit translate save, ~229)
- Modify: `apps/web/src/app/(public)/[...slug]/page.tsx` (`generateMetadata`, ~58-75)
- Modify: `packages/editor/src/editor/serialize.ts` (`LAYOUT_VALUES`, ~26)
- Test: the `[...slug]` route test from stage 1's fix wave (vitest), `packages/editor/src/editor/serialize.test.ts`

**Interfaces:**
- Produces: none new.

- [ ] **Step 1: Write the failing tests**
  - Web (vitest): `generateMetadata` for a slug whose translation is published but has no `published_doc` returns the not-found metadata, not `translation.title`. Mirror the page body's `is_published && doc` guard.
  - Editor: `LAYOUT_VALUES` is checked against the unions. Write a type-level test: a `const _check: SectionBackground[] = [...LAYOUT_VALUES.background]` style assertion that fails to compile if a union member is missing. Also add a runtime test: normalizing a section with `background: "dark"` keeps it.
- [ ] **Step 2: Run them to see them fail** (`cd apps/web && bunx vitest run <route test>`; `cd packages/editor && bun test src/editor/serialize.test.ts`)
- [ ] **Step 3: Implement**
  - Replace `router.replace(\`/pages/${id}\`)` with `window.history.replaceState(null, "", \`/pages/${id}\`)` so the editor does not remount after the first save.
  - The translate save must use the latest page id (a ref updated after create), not the render-time closure.
  - Type each `LAYOUT_VALUES` array with `satisfies readonly <Union>[]`.
- [ ] **Step 4: Run the tests and `bun run check-types`**. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** — `fix: keep the editor mounted after a new page's first save; guard 404 metadata`

---

### Task 2: v2 tokens on sections, the canvas and the page top

**Files:**
- Modify (rename the legacy `--ink` custom property to `--pg-ink`, exact matches only: `--ink:` declarations and `var(--ink)` / `var(--ink,` references; leave `--ink-2…4`): `packages/editor/src/theme/tokens.css`, `blocks.css`, `editor.css`, and any `var(--ink)` in `packages/editor/src/**/*.tsx` inline styles
- Modify: `packages/editor/src/theme/brand-surface.test.ts` (assertions that pin `--ink`)
- Modify: `packages/editor/src/components/editor-shell/canvas/index.tsx` (frame class gains `biso-surface-v2`)
- Modify: `packages/editor/src/editor/types.ts` (`SectionBackground` adds `"photo"`; `SectionLayout.backgroundImage?: { alt?: string; fileId?: string; src: string }`), `editor/serialize.ts` (accept both)
- Modify: `packages/editor/src/sections/section-view.tsx`, `packages/editor/src/theme/sections.css`
- Modify: `packages/editor/src/blocks/block-view.tsx` (the legacy frame stops painting `SURFACE[...]` backgrounds; the section paints the surface)
- Modify: `packages/editor/src/components/editor-shell/inspector/section-panel.tsx` (Background gains Photo, with a `MediaPicker` (`accept="image/*"`) and an alt text field when Photo is chosen)
- Modify: `packages/editor/src/theme/blocks.css:~1994` (`.pg-page` padding-top) → moved to the rule below
- Test: `packages/editor/src/sections/section-view.test.tsx`, `packages/editor/src/theme/sections-css.test.ts`, `packages/editor/src/theme/brand-surface.test.ts`, `inspector/section-panel.test.tsx`

**Interfaces:**
- Produces:
  - `SectionView` output:
    - `data-background="white|tinted|dark|photo"`.
    - Dark and photo sections also get `data-surface="deep"`.
    - A photo section gets a background `<img class="pg-sec__photo" alt=…>` (absolutely positioned, `object-fit: cover`) and a `<div class="pg-sec__scrim">`, rendered before the grid. With no `backgroundImage.src` it falls back to dark.
  - CSS contract (`sections.css`):
    - `.pg-sec` uses `background: var(--surface); color: var(--ink)`.
    - `[data-background="tinted"]` uses `var(--surface-sunken)`.
    - The photo scrim is `color-mix(in srgb, var(--biso-deep) 62%, transparent)`.
    - Two consecutive white sections are separated by a `1px solid var(--edge)` hairline. This must work in both hosts: siblings on the site, and inside `.pe-section` wrappers on the canvas.
    - `.pg-sec[id] { scroll-margin-top: var(--pg-nav-offset, 0px) }`.
  - Page-top contract:
    - `.pg-page { --pg-nav-offset: 5rem }` on the site; `.pe-frame { --pg-nav-offset: 0px }` in the editor.
    - Without a header (Task 4 adds `.pg-header`), the first section gets `padding-top: calc(var(--pg-nav-offset) + <its spacing>)`.
    - If that first section isn't dark or photo, it also paints a `var(--biso-deep)` strip of height `--pg-nav-offset` across its top (as `Section`'s `backdropNeeded` does).
    - `SectionView` takes `first?: boolean` → `data-first`.
- Consumes: none new.

- [ ] **Step 1: Write the failing tests**
  - SectionView:
    - dark → `data-surface="deep"`;
    - photo with image → `<img class="pg-sec__photo"` with its alt, plus the scrim;
    - photo without image → `data-background="dark"` behaviour;
    - `first` → `data-first`.
  - CSS test:
    - `.pg-page` sets `--pg-nav-offset: 5rem`;
    - `.pe-frame` sets it to `0px`;
    - the first-section rule uses `--pg-nav-offset`;
    - the hairline rule exists for both host structures.
  - brand-surface test: no `--ink:` declaration remains in the editor's CSS (only `--pg-ink`), and the "nothing reaches the host page" suite still passes.
  - section-panel: choosing Photo shows "Background image"; Photo patches `{ background: "photo" }`.
- [ ] **Step 2: Run to see them fail** (`cd packages/editor && bun test src/sections src/theme src/components/editor-shell/inspector`)
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `bun test ./src` in packages/editor and `bun run check-types`**. Expected: PASS, exit 0.
- [ ] **Step 5: Commit** — `feat(editor): sections and the canvas use the redesign's v2 surfaces`

---

### Task 3: v2 primitives, the inspector list editor and the guard test

**Files:**
- Create: `packages/editor/src/blocks/_v2/button-link.tsx`, `chevron-media.tsx`, `media.ts`, `media-placeholder.tsx`, `index.ts`
- Create: `packages/editor/src/components/editor-shell/inspector/item-list.tsx`
- Modify: `packages/editor/src/blocks/types.ts` (`BlockDefinition.v2?: true`), `packages/editor/src/blocks/block-view.tsx` (a `v2` definition renders bare: no legacy frame)
- Modify: `packages/editor/src/editor/types.ts` (shared types below)
- Create: `packages/editor/src/blocks/_v2/v2-guard.test.ts`
- Test: `packages/editor/src/blocks/_v2/media.test.ts`, `_v2/button-link.test.tsx`, `_v2/chevron-media.test.tsx`, `inspector/item-list.test.tsx`

**Interfaces:**
- Produces (types.ts):
  - `interface LinkButton { href: string; label: string; style: "primary" | "secondary" }`
  - `type FrameRatio = "21/9" | "16/9" | "3/2" | "4/3" | "1/1" | "4/5" | "3/4"`
  - `interface MediaRef { alt?: string; fileId?: string; kind: "image" | "video"; poster?: string; posterFileId?: string; src: string }`
- Produces (`_v2`):
  - `BUTTON_CLASS: Record<LinkButton["style"], string>`, copied from `apps/web/src/components/ui/status-panel.tsx` `statusPanelPrimaryAction` / `statusPanelSecondaryAction`. Primary: `type-label rounded-biso-pill bg-action px-5 py-3 text-action-ink hover:opacity-90`. Secondary: pill, `border border-edge`, accent on hover. Both include the focus ring.
  - `ButtonLink({ button }: { button: LinkButton })` renders an `<a>` (external `http` links get `rel="noopener"` + `target="_blank"`).
  - `ratioValue(r: FrameRatio): number` (height/width, e.g. `"16/9"` → `0.5625`).
  - `ChevronMedia({ alt, lean, ratio, src, kind?, poster?, loop?, width? })` renders `<div class="chevron-frame" data-lean style="--ar:…">`. Its child is `<img loading="lazy" src={sizedImageSrc(src, width)}>`, or for `kind: "video"` with `loop`, `<video muted autoplay loop playsinline poster>` plus a `<img class="pg-reduced-motion-poster">` shown only under reduced motion (CSS in `sections.css`). With an empty `src` it renders `MediaPlaceholder` instead.
  - `MediaPlaceholder({ label, ratio })` is a `bg-surface-sunken` box with `type-body-sm text-ink-muted` text. It renders in the editor **and** on the site, so the site never shows a broken image.
  - `sizedImageSrc(src: string, width: number): string`. An Appwrite storage `…/files/<id>/view?…` URL becomes `…/files/<id>/preview?…&width=<width>&output=webp&quality=80` (keep `project`). Any other URL is returned unchanged.
  - `isEmbedUrl(url): boolean` (YouTube/Vimeo) and `embedSrc(url, { autoplay }): string | null`, moved from `blocks/video/render.tsx`.
- Produces (inspector):
  - `ItemList<T>({ addLabel, items, max?, newItem, onChange, renderItem, title }: { addLabel: string; items: T[]; max?: number; newItem: () => T; onChange: (items: T[]) => void; renderItem: (item: T, update: (next: T) => void, index: number) => ReactNode; title: (item: T, index: number) => string })`.
  - Each row has: move up, move down and remove buttons, styled like today's stats inspector rows (`blocks/stats/inspector.tsx`).
  - The "Add" button is disabled at `max`.
- Guard test (`v2-guard.test.ts`):
  - **Which files.** For every block folder whose `index.tsx` contains `v2: true`, plus `blocks/_v2/` and `src/header/`, it scans `*.tsx` except tests.
  - **What fails it:**
    - viewport variants (`/(^|\s)(sm|md|lg|xl|2xl):/`);
    - hex colours;
    - `text-white|bg-white|text-black`;
    - Tailwind palette colours (`/-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/`);
    - legacy tokens (`bg-brand`, `bg-section`, `bg-inverted`, `bg-primary`, `text-foreground`, `bg-muted`, `bg-card`, `text-muted-foreground`);
    - `font-medium`;
    - `gradient`;
    - `backdrop-blur`;
    - `whileInView`;
    - `hover:-translate`;
    - `shadow-` other than `shadow-elev-`;
    - `rounded-` other than `rounded-biso-` (and `rounded-none`);
    - `next/link`;
    - `<h1` (anywhere except `src/header/`).

- [ ] **Step 1: Write the failing tests**
  - `sizedImageSrc`:
    - `https://appwrite.biso.no/v1/storage/buckets/media/files/abc/view?project=biso` with width 1200 → `…/files/abc/preview?project=biso&width=1200&output=webp&quality=80`;
    - a non-Appwrite URL is unchanged.
  - `ratioValue("16/9") === 0.5625`.
  - `ButtonLink`:
    - primary renders `bg-action`;
    - an external href has `rel="noopener"`.
  - `ChevronMedia`:
    - with an image, renders `class="chevron-frame"` and `--ar:0.5625`;
    - with an empty src, renders the placeholder and no `<img`;
    - a looping video renders `muted`, `loop`, `playsinline` and the reduced-motion poster.
  - `ItemList`:
    - Add appends `newItem()`;
    - Add is disabled at `max`;
    - move down swaps two items;
    - remove drops one.
  - The guard test passes trivially (no v2 blocks yet), and a self-test proves it flags a planted violation string.
- [ ] **Step 2: Run to see them fail** (`cd packages/editor && bun test src/blocks/_v2 src/components/editor-shell/inspector/item-list.test.tsx`)
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `bun test ./src`**. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): v2 block primitives, list editor and design guard`

---

### Task 4: The page header

**Files:**
- Modify: `packages/editor/src/editor/types.ts`, adding:
  - `interface PageHeader { buttons: LinkButton[]; crumbs: { href?: string; label: string }[]; eyebrow: string; lede: string; media?: MediaRef; title: string; variant: "split" | "full" | "plain" }`
  - `PageDoc.header?: PageHeader`
  - `MediaRef.loop` is implied for header video; header video always loops muted.
- Create: `packages/editor/src/header/page-header-view.tsx`, `packages/editor/src/header/empty-header.ts`
- Modify: `editor/operations.ts`, `editor/store.ts`, `editor/hooks.ts`, `editor/serialize.ts` (normalize + `serializePageForAI`), `editor/templates.ts`
- Modify: `components/editor-shell/canvas/index.tsx`
- Create: `components/editor-shell/canvas/header-slot.tsx`
- Create: `components/editor-shell/inspector/header-panel.tsx`
- Modify: `inspector/index.tsx`, `components/editor-shell/autosave-signature.ts`
- Modify: `apps/web/src/app/(public)/[...slug]/_components/rendered-page.tsx` (render the header before the sections; pass `first` to the first section only when there is no header)
- Modify: `apps/admin/src/lib/page-document-translation.ts` (walk `header` with path `"header"`; add `"lede"` to `TRANSLATABLE_FIELDS`)
- Modify: `apps/admin/src/app/(portal)/_actions/departments.ts` (`createUnitPage` stores `header` from the template)
- Delete: the `hero` block — `packages/editor/src/blocks/hero/`, its import in `blocks/index.ts`, `"hero"` in `BlockType`/`Block`/`emptyBlock`, the AI `BLOCK_TYPES` entry, the `BLOCK_LIBRARY` entry, the `.pg-hero*` rules in `blocks.css`, and the hero assertions in `theme/brand-surface.test.ts`
- Test: `packages/editor/src/header/page-header-view.test.tsx`, `editor/operations.test.ts`, `editor/store-tree.test.ts`, `editor/serialize.test.ts`, `editor/templates.test.ts`, `inspector/header-panel.test.tsx`, `apps/admin/src/lib/page-document-translation.test.ts`, the departments test, and the web rendered-page test

**Interfaces:**
- Produces:
  - `emptyHeader(title?: string): PageHeader` — `variant: "plain"`, empty fields, no media.
  - Operations:
    - `setHeader(doc, header: PageHeader): void`
    - `removeHeader(doc): void`
    - `setHeaderProp(doc, path: string, value: unknown): void` — same dot-path rules as `setProp`.
  - Store:
    - `headerSelected: boolean` and `selectHeader()`. This is exclusive with `selection`/`selectedSectionId`; `select` and `selectSection` clear it.
    - `addHeader(): void` — adds `emptyHeader(meta.title)` if absent, then selects it.
    - `removeHeader()`, `setHeaderProp(path, value)` (with history).
    - Snapshots include `header`.
  - `normalizePageDoc`:
    - keeps a valid header object, filling missing fields from `emptyHeader`;
    - drops a non-object header;
    - drops media without a string `src`.
  - `serializePageForAI` adds `header: variant=… title="…"` (or `header: none`) under the page lines.
  - `unitPageTemplate(input): { header: PageHeader; sections: Section[] }`:
    - The header is `variant: "plain"`, eyebrow `BISO <campus>`, title = name, lede = the template subtitle, `buttons: []`.
    - The sections are today's list without the hero.
  - `PageHeaderView({ edit, header, onPatch })` renders `<header class="pg-header" data-surface="deep" data-variant>`, with:
    - container width 1200px;
    - page padding `padding-top: calc(var(--pg-nav-offset) + var(--section-y))`, bottom `var(--section-y)`;
    - crumbs as `<nav aria-label="Breadcrumb">`;
    - eyebrow `type-label text-ink-accent`;
    - `<h1>` `type-display-lg` (`type-display-hero` for `full`) `max-w-[18ch]`;
    - lede `type-body text-ink-muted max-w-(--measure)`;
    - buttons via `ButtonLink`.
  - Variants:
    - `split`: media in `ChevronMedia` ratio `4/3` beside the text from `@3xl:` (page container) and stacked below it under that width.
    - `full`: media fills the header behind a `.pg-header__scrim`.
    - `plain`: no media.
    - Video media always renders as a muted loop with its poster.
  - Inline editing (`EditableText`): eyebrow, title, lede.
  - Canvas: `HeaderSlot` above the sections.
    - With a header: it renders `PageHeaderView` in a `.pe-header` wrapper with the same selection chrome as `.pe-section` (tag "Page header", remove button). A click selects it.
    - Without a header, in edit mode: a slim "+ Add page header" control (same style as "+ Add section").
  - `HeaderPanel({ header, onPatch, onRemove })` (inspector, shown when `headerSelected`):
    - Variant buttons Split / Full / Plain.
    - Eyebrow, Title and Lede inputs.
    - "Breadcrumbs" `ItemList` (label, link).
    - "Buttons" `ItemList` (`max` 2; label, link, Primary/Secondary).
    - Media `MediaPicker` (image or video), with an alt field; for a video, a "Poster image" `MediaPicker` (`accept="image/*"`).
    - "Remove page header".
- Consumes: Task 2 page-top contract (`--pg-nav-offset`, `first`); Task 3 `ButtonLink`, `ChevronMedia`, `MediaPlaceholder`, `ItemList`.

- [ ] **Step 1: Write the failing tests**
  - **PageHeaderView:**
    - split with an image renders `<h1` with the title, `data-surface="deep"` and `chevron-frame`;
    - no media → no `<img`, and in edit mode the placeholder is shown;
    - a video renders `muted`, `loop` and the reduced-motion poster;
    - crumbs render a `Breadcrumb` nav;
    - exactly one `<h1`.
  - **Operations / store:**
    - `addHeader` on a doc without one adds `emptyHeader(meta.title)` and sets `headerSelected`;
    - `select("b-1")` clears `headerSelected`;
    - undo after `setHeaderProp("title", "X")` restores the title.
  - **Normalize:**
    - a header missing `crumbs` gets `[]`;
    - a header `"oops"` is dropped;
    - media without `src` is dropped.
  - **Templates:** the header title is the unit name; no section contains a `hero`.
  - **Translation:** a doc with `header: { lede: "Tre dager på Storefjell", … }` translates `header.lede`.
  - **Web:**
    - a doc with a header renders `pg-header` before `pg-sec` and no `data-first`;
    - without a header, the first section has `data-first`.
  - **HeaderPanel:**
    - choosing Full patches `variant`;
    - Buttons respects `max` 2.
- [ ] **Step 2: Run to see them fail** (editor `bun test`, admin `bun test`, web `bunx vitest run` for the named files)
- [ ] **Step 3: Implement, and delete the `hero` block**
- [ ] **Step 4: Run all four packages' tests for the touched files, `bun run check-types`, and `bun run build --filter=admin`** (`departments.ts` is `"use server"`). Expected: PASS, exit 0, `✓ Compiled`.
- [ ] **Step 5: Commit** — `feat(editor): page header replaces the hero block`

---

### Task 5: Text, Heading, Quote and Callout

**Files:**
- Rewrite: `packages/editor/src/blocks/text/{render,inspector}.tsx`, `blocks/quote/*`, `blocks/callout/*`
- Create: `packages/editor/src/blocks/heading/{index,render,inspector,thumb}.tsx`
- Modify: `editor/types.ts`, adding `HeadingBlock { eyebrow: string; id: string; intro: string; link?: { href: string; label: string }; size: "small" | "medium" | "large"; title: string; type: "heading" }`; `editor/operations.ts` (`emptyBlock` defaults); `blocks/index.ts`
- Modify: the CSS for `.pg-text*`, `.pg-quote*` and `.pg-callout*`, which is deleted from `blocks.css`
- Test: `blocks/text/render.test.tsx` (rewrite), `blocks/heading/render.test.tsx`, `blocks/quote/render.test.tsx`, `blocks/callout/render.test.tsx`

**Interfaces:**
- Produces: all four definitions set `v2: true`.
- **Text:**
  - Same `TextBlock` shape.
  - `h` → `<h2 class="type-display-sm">`, `h3` → `type-heading-card`, `p` → `type-body`.
  - Consecutive `li` items group into one `<ul class="list-disc pl-5 marker:text-ink-accent">`.
  - Links: `text-ink-accent underline underline-offset-4`.
  - Body width capped at `max-w-(--measure)`.
  - Sanitized HTML as today (`lib/sanitize.ts`).
- **Heading:**
  - Eyebrow `type-label text-ink-accent`.
  - Title as an `<h2>`: `small` → `type-heading-section`, `medium` → `type-display-sm`, `large` → `type-display-lg`.
  - Intro: `type-body text-ink-muted max-w-(--measure)`.
  - With a `link`: a "label →" link and a 3px `bg-marker` underline under the title, as in `apps/web/src/components/ui/section-heading.tsx`. The marker appears only with a link.
- **Quote:**
  - `<figure>` with a 4px `bg-action` left rule.
  - `<blockquote class="type-display-sm text-ink">`.
  - Optional figcaption: author `type-heading-card`, role `type-body-sm text-ink-muted`.
- **Callout:**
  - `<aside class="rounded-biso-md border border-edge bg-surface-raised p-5">`.
  - A tone label pill — Info / Tips / Viktig (`en`: Info / Tip / Important) — in the state tone (info → accent, tip → success, warn → warning). Use the state utilities in `globals.css`.
  - Title `type-heading-card`, body `type-body-sm`.
- Inline editing: text items, heading eyebrow/title/intro, quote text, callout title/body.

- [ ] **Step 1: Write the failing tests**
  - **Text:**
    - `[{type:"li",text:"a"},{type:"li",text:"b"}]` renders one `<ul` with two `<li`;
    - `h` renders `<h2 class="type-display-sm`.
  - **Heading:**
    - no link → no `bg-marker`;
    - with a link → `bg-marker` and an `<a` with the label;
    - `large` → `type-display-lg`;
    - never `<h1`.
  - **Quote:** with no author, renders no figcaption.
  - **Callout:** `tone:"warn"` renders the warning label.
  - All four render inside `<section data-surface="deep">` with no forbidden class. The guard test covers this; also assert `text-ink`.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.** Remove the legacy CSS for these four blocks.
- [ ] **Step 4: Run `bun test ./src` (the guard now scans these blocks) and check-types.**
- [ ] **Step 5: Commit** — `feat(editor): text, heading, quote and callout in the redesign's type`

---

### Task 6: Highlights, Facts, Stats and Divider

**Files:**
- Create: `blocks/highlights/*`, `blocks/facts/*`, `blocks/divider/*`
- Rewrite: `blocks/stats/*`
- Modify: `editor/types.ts`, `editor/operations.ts`, `blocks/index.ts`. Add these shapes:
  - `HighlightsBlock { id; items: { text: string }[]; type: "highlights" }`
  - `FactsBlock { id; items: { href?: string; label: string; text: string }[]; type: "facts" }` (NB: `text`, not `value`; `value` is a skipped field in the translator)
  - `DividerBlock { id; spacing: "small" | "medium" | "large"; type: "divider" }`
- Delete: `.pg-stats*` CSS from `blocks.css`
- Test: render tests for each, plus `apps/admin/src/lib/page-document-translation.test.ts` (a facts `text` is translated)

**Interfaces:**
- Produces: all four definitions use `v2: true`.
- **Highlights:** `<ul class="grid gap-4">`. Each `<li>` gets `type-body border-l-2 border-ink-accent pl-4`.
- **Facts:**
  - Container: `<dl class="divide-y divide-edge border-y border-edge">`.
  - Rows: `py-3`.
  - `<dt>`: `type-label text-ink-muted`.
  - `<dd>`: `type-heading-card text-ink`. With an `href`, the `dd` wraps an `<a>`.
- **Stats:**
  - Container: `<dl class="grid gap-6 @sm:grid-cols-2 @xl:grid-cols-3 border-t border-edge pt-6">`.
  - Figure: `type-data text-3xl text-ink-accent`.
  - Label: `type-body-sm text-ink-muted`.
- **Divider:** `<hr class="border-edge">` with `my-4` / `my-8` / `my-12`.
- **Inspectors:** use `ItemList` for highlights, facts and stats; divider gets a spacing button group.

- [ ] **Step 1: Write the failing tests**
  - **Facts:** two items render two `<dt>` and two `<dd>`; an item with an `href` renders an `<a`.
  - **Stats:** uses `@sm:grid-cols-2` and no viewport variant.
  - **Highlights:** renders `border-ink-accent`.
  - **Divider:** `large` renders `my-12`.
  - **Translator:** `sections[0].columns[0].blocks[0].items[0].text` is translated for a facts block.
- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the editor and admin tests, then check-types.**
- [ ] **Step 5: Commit** — `feat(editor): highlights, facts, stats and divider blocks`

---

### Task 7: Buttons and the call-to-action band

**Files:**
- Create: `blocks/buttons/*`, `blocks/ctaBand/*`
- Modify: `editor/types.ts`, `editor/operations.ts`, `blocks/index.ts`. Add these shapes:
  - `ButtonsBlock { align: "start" | "center"; id; items: LinkButton[]; type: "buttons" }`
  - `CtaBandBlock { buttons: LinkButton[]; eyebrow: string; id; text: string; title: string; type: "ctaBand" }`
- Delete the `cta` block:
  - its folder;
  - its type and `emptyBlock` case;
  - its AI enum and palette entries;
  - the `.pg-cta*` CSS;
  - the `cta/render.test.tsx` file and the `cta` assertions in `block-view.test.tsx` and `brand-surface.test.ts`;
  - `_primitives/block-section.tsx` and its siblings, if `cta` was their only user. Check with grep before deleting.
- Test: `blocks/buttons/render.test.tsx`, `blocks/ctaBand/render.test.tsx`

**Interfaces:**
- Produces: both definitions set `v2: true`.
- **Buttons:**
  - Up to 3 `ButtonLink`s in `flex flex-wrap gap-3`.
  - `center` alignment adds `justify-center`.
  - Inspector: `ItemList` with `max` 3, and an Align button group.
- **CTA band:**
  - Layout: `grid gap-6 @2xl:grid-cols-[1fr_auto] @2xl:items-end`.
  - Content: eyebrow `type-label text-ink-accent`, title `<h2 class="type-display-lg">`, text `type-body text-ink-muted`, then up to 2 `ButtonLink`s.
  - It does not paint its own background. The section does (normally Dark).
  - Inline editing: eyebrow, title, text.
  - Inspector: `ItemList` buttons with `max` 2.

- [ ] **Step 1: Write the failing tests**
  - **Buttons:** 3 items render 3 `<a`; `center` alignment renders `justify-center`.
  - **CTA band:** renders an `<h2`; empty `buttons` renders no `<a`; a `secondary` style renders `border-edge`.
  - **Removal check:** `allBlocks()` no longer contains `cta` or `hero`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement the blocks and delete `cta`.**
- [ ] **Step 4: Run `bun test ./src` and check-types.**
- [ ] **Step 5: Commit** — `feat(editor): buttons and call-to-action band replace the cta block`

---

### Task 8: Image and Gallery

**Files:**
- Rewrite: `blocks/image/*`, `blocks/gallery/*`. Keep `gallery/upload.ts` and its test, adapting it to the new image shape.
- Modify: `editor/types.ts`:
  - `ImageBlock { alt: string; caption: string; decorative?: boolean; fileId?: string; frame: "chevron" | "plain"; id; lean: "left" | "right"; ratio: FrameRatio; src?: string; type: "image" }` (replaces `aspect`)
  - `GalleryBlock { id; images: { alt?: string; fileId?: string; src: string }[]; layout: "collage" | "grid" | "row"; type: "gallery" }`
- Modify: `editor/operations.ts` defaults:
  - image: `frame: "chevron"`, `ratio: "16/9"`, `lean: "left"`, `alt: ""`, `caption: ""`;
  - gallery: `layout: "collage"`, `images: []`.
- Delete: the `.pg-image*` and `.pg-gallery*` CSS
- Test: `blocks/image/render.test.tsx` (rewrite), `blocks/gallery/render.test.tsx`

**Interfaces:**
- Produces: both definitions set `v2: true`.
- **Image:**
  - Renders `<figure>`, with `ChevronMedia` (`width` 1600) for `chevron`, or a `rounded-biso-md overflow-hidden` box for `plain`.
  - `alt` is `""` only when `decorative`.
  - Caption: `type-body-sm text-ink-muted mt-3`.
  - With no `src`, renders `MediaPlaceholder`.
- **Gallery:**
  - `collage`: up to 5 images. The first is large in a `grid-cols-[2fr_1fr_1fr] grid-rows-2` layout (first spans 2 rows), from `@2xl:`. Under that width it falls back to `grid-cols-2`, with the first image spanning both columns.
  - `grid`: `grid-cols-2 @lg:grid-cols-3`, chevron `4/3`.
  - `row`: a horizontal scroll strip (`flex gap-4 overflow-x-auto snap-x`) with fixed-width `4/5` chevrons.
  - Image `width` is 800, or 1600 for the collage's first image.
  - No images: the editor shows a placeholder, and the site renders nothing.
  - Edit-mode upload and remove controls stay, restyled with editor chrome classes.
- **Inspectors:**
  - Image: `MediaPicker` (`accept="image/*"`), Alt, a "Decorative image" checkbox, Frame (Chevron/Plain), Ratio (7 buttons), Lean (Left/Right), Caption.
  - Gallery: Layout button group, plus an `ItemList` of images (`MediaPicker` + alt).

- [ ] **Step 1: Write the failing tests**
  - Image:
    - chevron `16/9` renders `--ar:0.5625`;
    - `decorative` renders `alt=""`;
    - a missing `src` renders the placeholder and no `<img`.
  - Gallery:
    - collage with 5 images renders 5 `chevron-frame` elements and `@2xl:grid-cols-[2fr_1fr_1fr]`;
    - `row` renders `overflow-x-auto`;
    - 0 images with `edit=false` renders an empty string.
- [ ] **Step 2: Run the tests and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `bun test ./src` and check-types.**
- [ ] **Step 5: Commit** with the message `feat(editor): image and gallery in chevron frames`.

---

### Task 9: Video

**Files:**
- Rewrite: `blocks/video/*`
- Modify: `components/editor-shell/inspector/media-picker.tsx` (C11). It needs to know whether a picked file is a video when the Appwrite URL has no extension. Add an optional `kind?: "image" | "video"` preview hint prop, and set it from the uploaded `File.type` when the file is picked. `onPicked` gains a third arg `mime: string`.
- Modify: `editor/types.ts` — `VideoBlock { caption: string; fileId?: string; id; label?: string; poster?: string; posterFileId?: string; ratio: "16/9" | "21/9"; style: "featured" | "inline" | "loop"; type: "video"; url?: string }`
- Delete: the `.pg-video*` CSS
- Test: `blocks/video/render.test.tsx`, `inspector/media-picker.test.tsx` (new: an uploaded `video/mp4` file previews as a video)

**Interfaces:**
- Produces: definition `v2: true`.
- **`featured`:**
  - A `ChevronMedia` frame (ratio per block) shows the poster (`sizedImageSrc`, width 1600) and a centred play button: `size-20 rounded-biso-pill bg-action text-action-ink`, with an accessible label "Spill av video" / "Play video" (locale from the store). It sits above an optional `label` pill (`type-label`, bottom-left).
  - A click swaps in the player:
    - YouTube/Vimeo: `iframe` from `embedSrc(url, { autoplay: true })`, with `allow="autoplay; fullscreen; picture-in-picture"` and a `title`.
    - Uploaded: `<video controls autoPlay playsInline src>`.
  - No poster: a `bg-deep` frame with the play button.
- **`inline`:** the player is shown directly in a `rounded-biso-md overflow-hidden` 16:9 box (iframe or `<video controls preload="metadata" poster>`).
- **`loop`:** a muted autoplay loop with no controls, via `ChevronMedia kind="video" loop`. The reduced-motion poster applies.
- **Caption:** `type-body-sm text-ink-muted mt-3`.
- **No `url`:** placeholder in the editor; nothing on the site.
- **Inspector:**
  - Video `MediaPicker` (`accept="video/*"`, or a URL for YouTube/Vimeo).
  - Poster `MediaPicker` (`accept="image/*"`).
  - Style: Featured / Inline / Loop.
  - Ratio: 16:9 / 21:9.
  - Label, Caption.

- [ ] **Step 1: Write the failing tests**
  - featured + poster renders the poster `<img` and a `button` with an accessible label; no `<video` and no `<iframe` before the click.
  - loop renders `muted`, `loop` and `playsinline`.
  - inline + a YouTube URL renders an `<iframe` with `youtube-nocookie.com` or `youtube.com/embed`, matching what `embedSrc` produces.
  - No url with `edit=false` renders an empty string.
  - The media-picker preview for a picked `video/mp4` with an extensionless URL is a `<video`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `bun test ./src` and check-types.**
- [ ] **Step 5: Commit** — `feat(editor): featured, inline and looping video`

---

### Task 10: Palette groups, AI block list and the block gallery page

**Files:**
- Modify: `packages/editor/src/blocks/types.ts`:
  - `BlockDefinition.group: PaletteGroup`
  - `PaletteGroup = "text" | "media" | "structure" | "people" | "live" | "actions" | "extras"`
  - `BlockDefinition.hidden?: true` (registered, so existing docs render, but not offered)
- Modify: every `blocks/*/index.tsx` (set `group`; set `hidden: true` on `profileHeader`, `filterBar`, `campusSelector` and `twoCol`, which D9 cuts and stage 3 deletes)
- Modify: `blocks/registry.ts`. `BLOCK_LIBRARY` is now **derived** from the registry, so the palette and the definitions can no longer drift:
  - groups in this order: Text and story, Media, Structure, People, Live from BISO, Actions, Small extras;
  - items in registration order;
  - hidden definitions excluded.

  The palette also shows a "Page opening" group whose single item, "Page header", calls `addHeader()`. It isn't draggable.
- Modify: `components/editor-shell/palette/index.tsx`, `ai/tools/index.ts` (`BLOCK_TYPES` = every non-hidden registered type, kept in sync by a test), `ai/prompt.ts` (mention the page header and the new blocks; drop hero/cta)
- Create: `apps/web/src/app/(public)/design-system/page-blocks/page.tsx`. It's noindex, excluded from the sitemap and robots like `/design-system`, and renders `RenderedPage` with a fixture.
- Create: `apps/web/src/app/(public)/design-system/page-blocks/fixture.ts`. The fixture is a v2 `PageDoc` with:
  - a split header with an image;
  - one section per background (white, tinted, dark, photo) and one of each column layout;
  - every v2 block at least once;
  - one four-column section of narrow blocks.

  Images come from existing `apps/web/public` assets. Check what's there and use those; don't add binaries.
- Test: `blocks/registry.test.ts` (new), `ai/tools/*.test.ts`, and a web test that the fixture normalizes without loss and renders every v2 block type

**Interfaces:**
- Produces:
  - `paletteGroups(): { group: PaletteGroup; label: string; items: { type: BlockType; label: string; desc: string }[] }[]`
  - `BLOCK_TYPES` derived from it

- [ ] **Step 1: Write the failing tests**
  - `paletteGroups()` contains no hidden type.
  - Every registered non-hidden type is in exactly one group.
  - `BLOCK_TYPES` equals the set of non-hidden types.
  - The fixture renders `pg-header` and at least one element per v2 type, identified by each block root's `data-block` attribute. Add `data-block={type}` to `BlockView`'s output for v2 blocks if it isn't already there.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run `bun test ./src` (editor), `bunx vitest run` (web) and check-types.**
- [ ] **Step 5: Commit** with the message `feat: palette groups from the registry, and a block gallery page`.

---

### Task 11: Verification and visual check

**Files:** none new. Fixes go in the files their task owns.

- [ ] **Step 1: Automated checks**
  - Run: `bun run check-types`, the test suites of all four packages, and `bun x ultracite fix` on the touched paths.
  - Expected: everything exits 0.
  - Report pre-existing failures and lint with evidence, as stage 1's Task 10 did.
- [ ] **Step 2: Visual check of `/design-system/page-blocks`**
  - If a web dev server is already serving this checkout on :3000, use it. Otherwise start `bun run dev --filter=web` and stop it afterwards. No login is needed.
  - Take Playwright screenshots at 1440, 820 and 390 px, saved as `.playwright-mcp/stage2-blocks-{1440,820,390}.png`. Use full-page screenshots.
  - Check, and fix in the owning task's files:
    - no horizontal scroll at 390;
    - the four-column section stacks on phone and goes 2×2 on tablet;
    - dark and photo sections are legible;
    - the header clears the nav;
    - chevrons are at 13°;
    - no legacy look remains on v2 blocks.
- [ ] **Step 3: Builds**
  - Run `bun run build --filter=admin --filter=web` **last**, and only if no dev server of Markus's is running. Check with `lsof -nP -iTCP:3000,3001 -sTCP:LISTEN` and look for a process you didn't start.
  - If one is running, skip the builds and say so: a build replaces `.next` under a running dev server and stops it.
- [ ] **Step 4: Hand-over note**
  - Append a "Stage 2 done" section to the spec: date, what works, the screenshots, and deferrals.
  - Commit with the message `docs: record stage 2 completion`.
