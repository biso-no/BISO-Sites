# Page Editor Stage 3: The Redesign Look, Part B, and Safety: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the block library in the redesign's look.
- Live feeds: events, news, jobs, partners, units, shop.
- People: team (manual or live board) and contact.
- Structure: cards, timeline, steps, FAQ, tabs, marquee.
- Actions: signup, form, documents.

Close three security gaps that exist today: unsanitized rich text, a form endpoint that relays email to any address, and dead document links. Remove the cut blocks and all legacy block styling.

**Architecture:**
- **Blocks:** every remaining block becomes `v2: true`, built on the stage 2 primitives plus a few new ones (Pill, DateBlock, card grid, crest, person card).
- **Feed items:** they gain ids, links, images and ISO dates, so cards can link and show dates.
- **Feed kinds:** new kinds `products` and `board` reuse the existing feed plumbing.
- **Empty live blocks:** hidden on the site, both per block and per section.
- **Rich text:** sanitized on the server, both when saved and when rendered.
- **Form submissions:** the server resolves who receives them from the published page, never from the browser.

**Tech Stack:** TypeScript, React 19, Next.js 16, Tailwind v4, zustand + immer, Appwrite via `@repo/api`, `sanitize-html` (new), bun:test / vitest, happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-23-page-editor-redesign-design.md` (D9, D11, C8; the stage 1 and 2 "done" notes at its end).

**Research behind this plan:**
- `.superpowers/sdd/2026-10-23-page-editor-stage-2-look-a/` (ledger and reports).
- The stage 3 research summary, quoted in task bodies where needed.

## Global Constraints

Everything in stage 1 and stage 2's Global Constraints still applies. See `docs/superpowers/plans/2026-10-23-page-editor-stage-2-look-a.md`. That covers:
- v2 design rules and the guard test;
- container-query variants only;
- no `<h1>` in blocks;
- `<a>` not `next/link`;
- `safeHref` + `externalLinkProps` on every href;
- placeholders only when `edit` is true;
- the editor chrome look unchanged;
- no stylesheet leaks;
- D13;
- the `"use server"` rule;
- no `next build` while dev servers run (Markus's run on 3000–3003);
- the commit trailer:

  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01H48AWgSdxtsCEZGyPFzJyq`

Stage 3 additions:
- **Robustness:**
  - Every block render and inspector tolerates missing or unknown **enums and arrays**. Guard arrays with `Array.isArray(x) ? x : []` and fall back to the `emptyBlock` default.
  - `BlockView` already has a per-block error boundary from stage 2's fix wave. Don't remove it.
- **No invented content:**
  - A live block never shows placeholder items on the public site.
  - With no department, or with an empty feed, it renders nothing on the site and an explanatory placeholder in the editor.
- **No decorative icon tiles** (redesign rule). Blocks that used emoji or glyph "icons" drop them.
- **Fixture:** every block made v2 here is added to the gallery fixture at `apps/web/src/app/(public)/design-system/page-blocks/fixture.ts`. Its test fails otherwise. Live blocks get fixture feed data through a `feeds` snapshot passed to `RenderedPage`.

## Review Focus

- **Stored XSS.** A page saved with `<img src=x onerror=…>`, `<script>`, a `javascript:` link or event-handler attributes in a text block must render inert on biso.no. Covered by Task 1's tests, which include the save path and both web routes.
- **Email relay.** No request body can make `/api/form/submit` email an arbitrary address. Recipients and team grants come only from the published page's block config. Covered by Task 8's tests.
- **Empty live blocks.** An events, news, jobs, partners, products or board block with no data leaves no heading, no "No events" text and no padded empty band on the site. Covered by Tasks 3, 4, 5 and 11.
- **Feed links.** Every live card links to a real route (`/events/…`, `/news/…`, `/jobs/…`, unit pages, `/shop/…`), with the same URL shape the coded pages use. Covered by Task 2's tests against the route helpers.
- **Multi-step form.** Every step's answers are submitted. Radio and checkbox values are correct. Going Back keeps the answers. Covered by Task 8's tests.

---

### Task 0: Carried from stage 2's final review

**Files:** these fixes follow from the stage 2 review: `blocks/text/render.tsx` and the other v2 block roots that got `hyphens-auto`, `header/page-header-view.tsx`, `apps/admin/src/app/(editor)/pages/[id]/_components/initial-documents.ts`, `apps/web/src/app/(public)/design-system/page-blocks/page.tsx`, `blocks/video/*`, `blocks/_v2/media.ts`, `blocks/_v2/links.ts`, `components/editor-shell/inspector/button-fields.tsx`, and `blocks/heading/inspector.tsx`.

- [ ] **Step 1: Write the failing tests:**
  - `hyphens-auto` appears only on titles: heading h2, text `h`/`h3`, the CTA band title and the quote blockquote. Body copy (`p`, `li`, intros, callout body, facts, highlights, stats labels) keeps `break-words` / `[overflow-wrap:anywhere]` but has no `hyphens-auto`. This matches the coded site, which hyphenates only display roles.
  - A page created while its title is still the untitled placeholder seeds `emptyHeader("")`, so the site falls back to `meta.title`. In the editor, an empty header title shows `fallbackTitle` as greyed placeholder text.
  - The video block's Ratio control applies to Inline: the inline box uses the chosen ratio, not a fixed `aspect-video`.
  - `ratioValue` ignores prototype keys (`"constructor"` → 0.5625), using `knownKey`.
  - `safeHref` returns null for non-string input instead of throwing.
  - The heading inspector shows a note when an href is set but the link label is empty.
  - The gallery page's sample-content strip doesn't touch the breadcrumb at 390 px: it uses shorter copy on phones or `whitespace-nowrap` plus truncation. Prove this visually at 390.
- [ ] **Step 2: Run the tests and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the editor, admin and web suites and check-types.**
- [ ] **Step 5: Commit** with message `fix(editor): carried stage 2 polish (hyphenation, header seed, inline ratio, guards)`.

---

### Task 1: Server-side rich-text sanitization

**Files:**
- Modify: root `package.json` catalog. Add `sanitize-html` and `@types/sanitize-html` at current stable versions.
- Modify: `packages/editor/package.json`:
  - add `sanitize-html` (dependency) and `@types/sanitize-html` (devDependency);
  - declare `happy-dom` as a devDependency (it's used by tests but undeclared);
  - add the export `"./sanitize": "./src/editor/sanitize-doc.ts"`.
- Create: `packages/editor/src/editor/sanitize-doc.ts` (server-safe; never imported by client modules)
- Modify:
  - `apps/admin/src/app/(portal)/_actions/pages.ts`: `savePageEditorDoc` and the translation-draft save path sanitize before `savePageDraft` / `savePageTranslationDraft`.
  - `apps/admin/src/app/(portal)/_actions/departments.ts`: `createUnitPage`.
- Modify:
  - `apps/web/src/app/(public)/[...slug]/page.tsx` and `apps/web/src/app/(public)/units/[...segments]/page.tsx`: sanitize the normalized doc before `RenderedPage`.
  - `apps/web/src/app/(public)/projects/[slug]/page.tsx`, if it renders editor pages by then. Grep `RenderedPage` usages.
- Test: `packages/editor/src/editor/sanitize-doc.test.ts`, admin pages-action test, web route tests

**Interfaces:**
- Produces:
  - `sanitizeRichHtml(html: string): string`. It mirrors `packages/editor/src/lib/sanitize.ts`'s allowlist:
    - Allowed tags: `b`, `strong`, `i`, `em`, `a`, `br`, `span`.
    - Attributes: only `href` on `a`.
    - `href` must pass `safeHref` from `blocks/_v2/links.ts`, otherwise the attribute is dropped.
    - Disallowed tags are discarded but their text is kept. `script`, `style`, `iframe`, `object`, `embed`, `svg` and `math` are removed with their content.
    - `p` and `div` become `<br>`-separated text, matching the browser sanitizer.
  - `sanitizePageDocHtml(doc: PageDoc): PageDoc`. It returns a copy in which every `text` block's `body[].text` (in `sections` and the header-free tree) is sanitized. It is pure and never mutates its input.

- [ ] **Step 1: Write the failing tests.** `sanitizeRichHtml` must neutralize each of:
  - `<img src=x onerror=alert(1)>` → no `<img`
  - `<script>alert(1)</script>hei` → `hei`
  - `<a href="javascript:alert(1)">x</a>` → `<a>x</a>` or `x`
  - `<span onclick="x">y</span>` → `<span>y</span>`
  - `<svg onload=x>` → nothing
  - `<b>fet</b> <a href="/om-oss">lenke</a>` → unchanged

  `sanitizePageDocHtml` must sanitize a text block nested in column 2 of section 2 and leave other blocks identical. Admin test: `savePageEditorDoc` persists the sanitized HTML (mock `savePageDraft` and assert its argument). Web test: the route passes sanitized HTML to `RenderedPage`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Install with `bun install` after editing the manifests.
- [ ] **Step 4: Run the tests and `bun run check-types`.** Then confirm that no client module imports `@repo/editor/sanitize`: grep, plus a test that scans `packages/editor/src` for `sanitize-doc` imports outside the server-only callers.
- [ ] **Step 5: Commit** with the message `fix(security): sanitize page rich text on save and render`.

---

### Task 2: Richer feed items and the remaining v2 primitives

**Files:**
- Modify: `packages/shared/utils/page-feeds.ts` (readers and item types). Also both route libraries if their response shapes change, at `apps/web/src/app/api/pages/_lib/feed.ts` and `apps/admin/src/app/api/pages/_lib/feed.ts`.
- Create: `packages/editor/src/blocks/_v2/pill.tsx`, `date-block.tsx`, `card-grid.ts`, `crest.tsx`, `person-card.tsx`, and export them from `_v2/index.ts`
- Test: `packages/shared/utils/page-feeds.test.ts` (or its existing test file), `_v2/*.test.tsx`

**Interfaces:**
- Feed items gain these fields. Keep the existing pre-formatted fields for compatibility.
  - `PageEventItem`: `id`, `href` (the event detail route; use the same helper or pattern the coded events feed uses; grep `apps/web/src/components/events/v2` for how links are built), `startsAt` (ISO), `image?` (resolved URL via `resolveStorageFileUrl`), `category?`, `memberOnly?`, `ticketUrl?`.
  - `PageNewsItem`: `id`, `href` (news detail route), `publishedAtIso`, `image?`.
  - `PageJobItem`: `id`, `href` (job detail route), `deadlineIso?`, `paid?`, `employmentType?`.
  - `PageDepartmentItem`: `href` (`unitCanonicalPath`), `logoUrl?` (resolved), `campusLabel?`.
  - Partners are unchanged.
- Readers also accept `limit?: number` (default `FEED_LIMIT` 6, max 12).
- Primitives (all v2-guard clean: no `font-medium`, no gradients, no `text-white`, container variants only):
  - `Pill({ children, tone = "neutral", uppercase })`. Tones are neutral, accent, success, warning, danger and marker, with the classes from `apps/web/src/components/ui/pill.tsx` except that `font-medium` becomes `font-semibold`.
  - `DateBlock({ iso, locale })` renders `<time dateTime>` with the month (`type-label text-ink-muted`) and day (`type-data text-xl`) in Europe/Oslo time, framed by `rounded-biso-sm border border-edge`. Invalid input renders nothing.
  - `cardGridClass(columns: 2 | 3 | 4): string` returns `grid gap-5 grid-cols-1 @md:grid-cols-2` plus `@3xl:grid-cols-3` for 3 or `@3xl:grid-cols-4` for 4.
  - `Crest({ logoUrl, name })` shows the logo in `rounded-biso-md bg-surface-sunken`. Without a logo it shows initials on `bg-surface-sunken text-ink-accent` (no gradient).
  - `PersonCard({ email, imageSrc, name, phone, role })` mirrors `apps/web/src/components/ui/person-card.tsx` with token classes, and builds `mailto:`/`tel:` links through `safeHref`.

- [ ] **Step 1: Write the failing tests.**
  - The events reader maps a row with `slug`, `image` and `start_date` to an item with `href`, `image` and an ISO `startsAt`, and honours `limit`.
  - `DateBlock` renders `dateTime="2027-02-11"` for `2027-02-11T09:00:00+01:00`.
  - `cardGridClass(4)` contains no viewport variant.
  - `PersonCard` with an `email` renders `href="mailto:…"`, and with a `javascript:` email renders no link.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and check-types.**
- [ ] **Step 5: Commit** with the message `feat: linkable feed items and the remaining v2 primitives`.

---

### Task 3: Events, News and Jobs

**Files:**
- Rewrite: `blocks/events/*`, `blocks/news/*`, `blocks/jobs/*` (`v2: true`)
- Modify: `editor/types.ts` (shapes below), `editor/operations.ts` (defaults), `editor/page-feeds.ts` (pass `limit` in the request key)
- Create: `components/editor-shell/inspector/source-picker.tsx`
- Delete: their legacy CSS in `blocks.css`
- Test: render tests per block, `source-picker.test.tsx`, `page-feeds.test.ts`

**Interfaces:**
- Shapes:
  - `EventsBlock { heading: string; id; limit: 3 | 6; seeAll: boolean; source: string; type: "events" }`. The `items` placeholder list is removed.
  - `NewsBlock` and `JobsBlock` follow the same pattern: `{ heading, limit, seeAll, source }`.
- `SourcePicker({ value, onChange })` is a select of "This page's department" (`auto`) plus every department from `useEditorCallbacks().departments` (name, campus). It replaces the free-text "Dept ID".
- Render:
  - The heading is an `<h2 class="type-heading-section">`. When `seeAll` is on, it gets a "Se alle →"/"See all →" link (`/events`, `/news`, `/jobs`) and the sun marker, as in the Heading block.
  - Cards sit in a `<ul class={cardGridClass(3)}>` and mirror the web v2 cards (`events/v2/event-card-v2.tsx`, `news/v2/news-v2.tsx`, `jobs/v2/job-card.tsx`).
  - Images use `ChevronMedia` 16/9, titles use `type-heading-card`, events use `DateBlock`, and pills use the new `Pill`.
  - Every card is a link via `href`.
- **Site**, when the feed resolved to `[]`, the department is missing, or the feed is unresolved (`null`): render nothing.
- **Editor:** show a placeholder in edit chrome style that names the reason: "No upcoming events for <dept>", "Choose a department", or "Loading…".
- `limit` slices the items, and it is part of the feed request so the reader fetches enough.

- [ ] **Step 1: Write the failing tests.**
  - An events block with 2 feed items renders 2 `<li>`, each with an `<a href="/events/…">` and a `<time dateTime`.
  - With an empty feed and `edit=false` it renders `""`.
  - With `edit=true` it renders the placeholder text.
  - News and jobs get the same three cases.
  - `SourcePicker` lists departments from callbacks.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests and check-types.**
- [ ] **Step 5: Commit** with the message `feat(editor): live events, news and jobs as redesign cards`.

---

### Task 4: Partners, Units and Shop

**Files:**
- Rewrite: `blocks/partners/*`, `blocks/departmentGrid/*` (keep the type name; palette label "Units"), `blocks/productGrid/*` (palette label "Shop")
- Modify: `editor/page-feeds.ts` (new kind `products`; department-feed request params `campus` and `category` in the key), `editor/types.ts`, `editor/operations.ts`
- Modify:
  - `packages/shared/utils/page-feeds.ts`: add `readPageProductsFeed(departmentId, locale, limit)`, mirroring `cachedUnitProducts` in `apps/web/src/lib/data/units.ts:312-343`:
    - filter: published, listed only, translation locale;
    - item `{ href: "/shop/<slug|id>", id, image?, memberOnly, memberPrice?, price, soldOut, title }`.
  - `apps/web/src/lib/data/public-content.ts`: add `cachedPageProductsFeed`.
  - `apps/web/src/lib/data/page-feeds.ts`: add the `readFeed` case. The exhaustive switch forces it.
  - Create the route `apps/web/src/app/api/pages/products/route.ts` and `apps/admin/src/app/api/pages/products/route.ts`, matching the existing feed routes.
- Delete: their legacy CSS
- Test: render tests, reader test, route tests

**Interfaces:**
- **Partners:** `{ heading?, items?: { href?, logo?: { fileId?, mime?, src }; name }[], source: "auto" | "manual" }`.
  - Render: a grid of `ChevronMedia` 16/9 logos (`object-contain p-4`, `border border-edge bg-surface-raised`), linked via `safeHref`, after `apps/web/src/components/home/v2/partner-grid.tsx`.
  - The manual inspector uses `ItemList` with a logo `MediaPicker` (`accept="image/*"`).
- **Units:** `{ category?: string; heading?; limit: number; scope: "campus" | "all" }`.
  - `campus` uses the page's `meta.campus`. The category comes from `packages/shared/utils/unit-categories.ts`.
  - Cards: `Crest`, name, campus label, with links via `href`. Mirrors `apps/web/src/components/units/v2/unit-card.tsx`.
  - `showFilters` and `variant` are removed.
- **Shop:** `{ heading?; limit: 4 | 8; source: string }` (department, like the events source).
  - Cards mirror `UnitShop` (`apps/web/src/app/(public)/units/[...segments]/_components/unit-feeds.tsx:110-176`).
  - The `tag` prop is removed.
- All three follow Task 3's rule: nothing on the site when empty, a placeholder in the editor.

- [ ] **Steps 1–5: Run the TDD cycle.** Tests:
  - A partner with a `javascript:` href is not linked.
  - Units scope `campus` puts the campus in the request key.
  - The products reader maps price, member price and sold-out.
  - Shop with an empty feed renders `""` on the site.

  Commit with the message `feat(editor): partners, units and shop blocks with live data`.

---

### Task 5: Team (manual or live board) and Contact

**Files:**
- Rewrite: `blocks/team/*`, `blocks/contact/*`
- Modify: `editor/page-feeds.ts` (new kind `board`, keyed by department), `editor/types.ts`, `editor/operations.ts`
- Modify:
  - `apps/web/src/lib/data/page-feeds.ts`: add a `board` case that resolves the department's `campus_id` from the department row, then calls `cachedUnitBoard(campusId, departmentId)`. Cap the result at 24 members and keep photos.
  - Create the route `apps/web/src/app/api/pages/board/route.ts`.
  - Create the route `apps/admin/src/app/api/pages/board/route.ts`, which calls `apps/api`'s `/api/campus/{campusId}/{departmentId}/board` via `NEXT_PUBLIC_API_BASE_URL`, following the existing admin pattern. Require admin auth, like the other admin feed routes.
- Delete: their legacy CSS
- Test: render tests, the board readFeed test (mock `cachedUnitBoard`), route tests

**Interfaces:**
- **Team:** `{ heading?; members: { email?, name, phone?, photo?: { fileId?, mime?, src }, role }[]; showContact: boolean; source: "manual" | "board" }`.
  - Render: a `cardGridClass(4)` grid of `PersonCard`s.
  - `showContact` controls whether email and phone links show.
  - When `source` is `board`, members come from the feed. On the site, an empty or failed feed renders nothing.
  - The manual inspector uses `ItemList` with name, role, email, phone and a photo `MediaPicker`.
  - The hue and initials fields are removed.
- **Contact:** `{ address, email, heading, hours, instagram, phone }`.
  - Render: a facts-style `dl` with `mailto:`/`tel:` links via `safeHref`. Instagram links to `https://www.instagram.com/<handle>/` (strip `@`).
  - It renders nothing on the site when every field is empty.
  - The `members` and `variant: "directory"` options are removed (people live in Team).

- [ ] **Steps 1–5: Run the TDD cycle.** Tests:
  - The board source with feed members renders their names.
  - The board source with an empty feed renders `""` on the site.
  - `showContact: false` renders no `mailto:`.
  - Contact `instagram: "@bisowintergames"` links to `https://www.instagram.com/bisowintergames/`.
  - Contact with all fields empty renders `""` on the site.

  Commit with the message `feat(editor): team with a live board option, and contact`.

---

### Task 6: Cards (merging four blocks), Timeline and Steps

**Files:**
- Create: `blocks/cards/*` (`v2: true`)
- Delete:
  - `blocks/featureGrid/`, `blocks/featuredCards/`, `blocks/linkTileGrid/`, `blocks/scrollRow/`, along with their types, `emptyBlock` cases and legacy CSS;
  - the `left`/`right` entries in `apps/admin/src/lib/page-document-translation.ts` `TRANSLATABLE_FIELDS`, but only if nothing else uses those keys (grep first).
- Rewrite: `blocks/timeline/*`, `blocks/stepGrid/*` (palette label "Steps")
- Test: render tests

**Interfaces:**
- **Cards:** `{ columns: 2 | 3 | 4; items: { body, eyebrow?, href?, image?: { alt?, fileId?, mime?, src }, title }[]; layout: "grid" | "row"; style: "bordered" | "plain" }`.
  - `grid` uses `cardGridClass(columns)`.
  - `row` is a horizontal snap scroller with fixed-width cards.
  - Bordered cards use `rounded-biso-md border border-edge p-5 hover:border-ink-accent`, with no lift.
  - Optional image uses `ChevronMedia` 16/9.
  - With an `href`, the whole card is an `<a>`.
  - No icons (redesign rule; D9's "icon" is dropped). Record this in the hand-over.
- **Timeline:** `{ heading?; items: { label: string; text: string; title?: string }[] }`.
  - Render a vertical list with a 2px `border-ink-accent` rail, `label` in `type-data`, `title` in `type-heading-card` and `text` in `type-body`.
  - Use it for programmes ("Dag 1 · 10:00") and histories ("2019").
  - Migrate the default `year` → `label`; normalization isn't required (D2).
- **Steps:** `{ heading?; items: { body, title }[] }`.
  - Render an ordered list in `cardGridClass(3)`.
  - The number comes from the index, in `type-display-sm text-ink-accent`.
  - Drop the stored `number`.

- [ ] **Steps 1–5: Run the TDD cycle.** Tests:
  - Cards: `layout: "row"` renders `overflow-x-auto`.
  - Cards: an item with an `href` renders an `<a>`, and one with a `javascript:` href doesn't.
  - Cards: there's no icon glyph.
  - Timeline renders 3 items with labels.
  - Steps numbers from 1.
  - `allBlocks()` contains no `featureGrid`/`featuredCards`/`linkTileGrid`/`scrollRow`.

  Commit with the message `feat(editor): cards replace four grid blocks; timeline and steps`.

---

### Task 7: FAQ, Tabs and Marquee

**Files:**
- Rewrite: `blocks/faq/*`, `blocks/tabs/*`, `blocks/marquee/*` (`v2: true`); delete their legacy CSS
- Test: render tests plus happy-dom interaction tests

**Interfaces:**
- **FAQ:** `{ heading?; items: { a, q }[] }`. The `variant` prop is removed.
  - Each item is a `<details>` with `<summary class="type-heading-card">` and an answer in `type-body`, separated by `divide-y divide-edge`.
  - Native disclosure gives keyboard support and works without JS.
  - In edit mode every item is rendered open, and q/a use `EditableText`.
- **Tabs:** `{ tabs: { body, label }[] }`. The `variant` prop is removed.
  - Follow the WAI-ARIA tabs pattern: `role="tablist"`/`tab`/`tabpanel`, `aria-selected`, `aria-controls` with ids derived from the block id, and arrow-key roving focus.
  - The underline indicator is `border-b-2 border-action`.
- **Marquee:** `{ text }`.
  - A full-bleed band in `type-display-sm uppercase` text, split on `·`.
  - The CSS animation lives in `sections.css`, scoped to `.pg-marquee`.
  - It is static under `prefers-reduced-motion: reduce`.
  - The duplicate track gets `aria-hidden`.
  - In edit mode it is static and editable via `EditableText`.

- [ ] **Steps 1–5: Run the TDD cycle.** Tests:
  - FAQ renders `<details>`/`<summary>`.
  - Clicking a summary toggles `open` (happy-dom).
  - Tabs: ArrowRight moves `aria-selected` to the next tab, and panels are labelled.
  - Marquee's reduced-motion CSS rule exists, and the second track has `aria-hidden="true"`.

  Commit with the message `feat(editor): accessible faq, tabs and a calmer marquee`.

---

### Task 8: Signup, Form and a safe submit endpoint

**Files:**
- Modify: `apps/web/src/app/api/form/submit/route.ts`
- Create: `apps/web/src/lib/form-submit.ts`, holding the pure resolution and validation helpers
- Rewrite: `blocks/signup/*`, `blocks/multiStepForm/*` (`v2: true`)
- Modify: `editor/types.ts`, `editor/operations.ts`
- Test: `apps/web/src/lib/form-submit.test.ts`, route test, render and interaction tests

**Interfaces:**
- **Request body** (the only accepted shape): `{ blockId: string; data: Record<string, string | string[] | boolean>; locale: "no" | "en"; slug: string }`.
- **What the server does:**
  1. Loads the published page with `cachedPublishedPage(slug, locale)` and normalizes it.
  2. Finds the block by id; it must be `signup` or `multiStepForm`.
  3. Reads `submitMode`, `recipientEmail`, `topic`, `accessTeamId` and the field definitions **from the block**.
  4. Drops any `data` keys that aren't defined fields.
  5. Clamps values to 2,000 characters each and the JSON to 16,384.
  6. Clamps `topic` to 100.
  7. Rate-limits by IP with `createRateLimiter` (`apps/web/src/lib/rate-limit.ts`) at 5 per minute.
- **Delivery:**
  - Email mode sends through `sendEmail` from `@repo/connectors/email`, as `apps/web/src/app/actions/varsling.ts` does. It sends only to a `recipientEmail` ending in `@biso.no`; anything else is a 400 and is logged.
  - Database mode writes `form_submissions`. The team grant comes from the block's `accessTeamId` and `campus_id` from the page's campus.
- **Responses:** `{ success: boolean; error?: string }`.
- **`resolveSubmission(doc, blockId, data)`** is a pure helper returning `{ ok: true, submission } | { ok: false, reason }`.
- **Signup:** `{ heading, placeholder, recipientEmail?, submitMode, topic }`. It is an email field plus a `ButtonLink`-styled submit button, with success and error states shown inline.
- **Form:** `{ heading?; recipientEmail?; steps: { fields: FormField[]; title }[]; submitMode; topic; accessTeamId? }`.
  - Answers are controlled state across steps, so Back keeps them.
  - Radio and checkbox render their `options`. Checkbox values are booleans or string arrays.
  - Required fields are validated per step.
  - Submit sends all steps.
  - Errors and success show inline.
  - The inspector gets an options editor for select, radio and checkbox fields (`ItemList`), and a recipient-email note that only `@biso.no` addresses work.
  - `submitTarget` and `adminLabel` are removed.

- [ ] **Step 1: Write the failing tests.**
  - `resolveSubmission` rejects an unknown block, rejects a block that isn't a form, strips unknown keys, and never takes the recipient from `data`.
  - The route rejects `recipientEmail` in the body: the field is ignored, the block's value is used, and a non-`@biso.no` recipient returns 400 without sending.
  - Form (happy-dom): fill step 1, go Next, fill step 2, go Back, and step 1's values are still there. On submit, the POST body contains both steps' fields.
  - A radio group submits the chosen option.
- [ ] **Steps 2–5: Run them red, implement, run them green, and commit.** Commit message: `fix(security): form submissions resolve recipients from the page; multi-step form keeps every answer`.

---

### Task 9: Documents

**Files:**
- Rewrite: `blocks/documents/*` (`v2: true`)
- Modify: `apps/admin/src/lib/upload-buckets.ts`, `upload-client.ts` and the editor host `uploadFile` (`page-editor-client.tsx`), so the `media` bucket also accepts documents.
  - Allowed: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, CSV, TXT.
  - Limit: 25 MB for documents.
  - Images and video keep their limits, and chunked upload stays as it is.
- Test: render tests, upload-bucket tests

**Interfaces:**
- `DocumentsBlock { heading?; items: { fileId?, mime?, size?: number, src: string, title }[] }`.
- **Render:**
  - A `divide-y divide-edge` list. Each row has the title (`type-heading-card`), a file-type and size line (`type-body-sm text-ink-muted`, e.g. "PDF · 1,2 MB"), and a download link.
  - The download href is `getStorageFileDownloadUrl` for Appwrite files, and `src` via `safeHref` otherwise.
  - With no items, it renders nothing on the site.
- **Inspector:** an `ItemList` with a `MediaPicker` that accepts the document types; title defaults to the file name, and size comes from the upload.

- [ ] **Steps 1–5: Run the TDD cycle.** Tests:
  - A PDF item renders a link to `/storage/buckets/media/files/<id>/download`.
  - Size formats as "1,2 MB".
  - The upload allowlist accepts `application/pdf` up to 25 MB and rejects `application/x-msdownload`.

  Commit message: `feat(editor): documents block uploads files and links real downloads`.

---

### Task 10: Remove cut blocks and all legacy block styling

**Files:**
- Delete: `blocks/profileHeader/`, `blocks/filterBar/`, `blocks/campusSelector/`, `blocks/twoCol/`, plus their types, `emptyBlock` cases and registry test entries.
- Delete: `packages/editor/src/theme/blocks.css`.
  - Move its surviving container rule (`.pg-page, .pe-frame { container: pg-page / inline-size; … }`) into `sections.css`, and update `theme/sections-css.test.ts` to match.
- Delete:
  - `LayoutFrame` in `blocks/block-view.tsx`, since every block is now `v2`. Keep the error boundary and the `data-block` wrapper.
  - `legacyBackground` (`editor/sections.ts`) and its callers.
  - `blocks/_primitives/` (`resolve-layout.ts`, `layout-types.ts` and their tests).
  - The `background` prop on `BlockDefinition.Render`.
  - `Block`'s `layout?: BlockLayout`.
  - The legacy binding in `tokens.css` (`.biso-surface:is(.pg-page, .pe-frame), .pg-section {…}` and the `--pg-*`, `--lift*` and `--inverted-*` variables).

  Keep the `:root` ramp that the editor chrome (`editor.css`) and inspector inline styles use. Grep each variable before removing it.
- Delete: `BlockDefinition.v2` and the `hidden` flag, if every block is v2 and none is hidden. Update the guard test to scan **every** block folder.
- Rewrite: `theme/brand-surface.test.ts` and `theme/section-layout.test.ts` (and `blocks/block-view.test.tsx`), so they guard what still exists: no leaks, no legacy class names, and every block uses v2.
- Test: the rewritten tests; `bun test ./src` must pass.

- [ ] **Steps 1–5:**
  1. Write the new guard expectations: every `blocks/*/` folder is scanned, there are no `pg-<block>` legacy classes, and `blocks.css` doesn't exist.
  2. Watch them fail.
  3. Delete and move code.
  4. Run them green and run check-types.
  5. Commit with the message `refactor(editor): every block is redesign-native; legacy styling removed`.

---

### Task 11: Empty live blocks leave no empty bands

**Files:**
- Create: `packages/editor/src/editor/prune-feeds.ts`, exported via `@repo/editor/serialize` (pure)
- Modify: `apps/web/src/app/(public)/[...slug]/page.tsx`, `units/[...segments]/page.tsx` (prune after `resolvePageFeeds`, before render)
- Modify: `packages/editor/src/theme/sections.css`. Add a `:has()` rule that hides a `.pg-sec` whose every `.pg-col__item` is empty or hidden. This covers client-resolved cases, the canvas excluded.
- Test: `prune-feeds.test.ts`, `sections-css.test.ts`, web route test

**Interfaces:**
- `pruneEmptyFeedBlocks(doc: PageDoc, feeds: PageFeedSnapshot, locale): PageDoc` drops every block whose feed request (`collectPageFeedRequests` keys) resolved to `[]`, and every live block with no resolvable department. Sections left empty then disappear, because `SectionView` returns null. The nav clearance `first` index is computed on the pruned doc.

- [ ] **Steps 1–5:** Run the TDD cycle. Test cases:
  - A doc whose only events block has an empty feed loses that section.
  - A section with text plus an empty events block keeps the text.
  - An unresolved feed (key absent) is kept, because the client may still fill it.
  - The CSS rule exists and is scoped to the site, not `.pe-frame`.

  Commit with the message `feat: empty live blocks leave no empty bands on the site`.

---

### Task 12: Gallery fixture, verification and visual check

**Files:** `apps/web/src/app/(public)/design-system/page-blocks/{fixture.ts,page.tsx}`, plus fixes in each owning task's files.

- [ ] **Step 1:** Extend the fixture with every new v2 block, using realistic Norwegian sample content in keeping with the page's sample-content notice. Pass a `feeds` snapshot with fixture items for events, news, jobs, partners, units, products and board, so the live blocks render. Include one empty feed to show it collapses.
- [ ] **Step 2:** Run check-types and every suite: editor, admin, web, api. Run ultracite on the touched paths.
- [ ] **Step 3: Visual check.** Use Markus's dev server on :3000 (don't build). Take screenshots at 1440, 820 and 390 into `.playwright-mcp/stage3-*.png`.
  - Check: no horizontal scroll, cards stack properly, dark and photo sections stay legible, FAQ and tabs work, the marquee is calm, and the form steps work.
  - Fix anything in its owning task's files.
- [ ] **Step 4:** Append a "Stage 3 done" note to the spec. Note that builds are still owed and that icons were dropped from cards. Commit with the message `docs: record stage 3 completion`.
