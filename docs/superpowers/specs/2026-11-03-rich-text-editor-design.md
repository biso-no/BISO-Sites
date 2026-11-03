# Rich text editor for the page editor: design

Date: 2026-11-03. Branch: `feat/rich-text-editor` (worktree `.claude/worktrees/rich-text-editor`).
Mockups shown and picked: `2026-11-03-rich-text-editor/mockups.html`. Markus picked **A** in both rows.

## Why

A Campus Management member added a section, then a Rich text block. They added a list item
and pasted text into it, and "suddenly 2–3 additional items were also included". Under that
report sits a broader complaint from Markus. The Rich text block's inspector is a stack of
small boxes, one per line, each with its own H2 / H3 / Paragraph / List item switcher. This
is awkward to write in, and pasting a real document into it is impossible.

The people writing pages are non-technical student volunteers. They write their content in
Word, then copy it over. Markus wants them to have **more freedom over how their content
looks**, because he believes that raises the quality of what gets published. They should get
a proper writing field, a toolbar that feels like Word, and paste that keeps the document's
structure.

## The bug (root cause, confirmed)

Reproduced in a standalone page in Chromium, using the same markup the canvas renders.

- On the canvas (the preview), `blocks/text/render.tsx` makes **each body item its own
  `contentEditable` element**. A list item is a `contentEditable` `<li>` inside the block's
  `<ul>`.
- Pasting a list (web pages, Google Docs and Word on the web all put real `<ul><li>` markup
  on the clipboard) into that `<li>` makes the browser nest the pasted list *inside* the one
  editable item: `<li contenteditable><ul><li>A</li><li>B</li><li>C</li></ul></li>`. The
  user sees 3 extra bullets. React and the store know nothing about them.
- On blur, `sanitizeRichText` (`lib/sanitize.ts`) unwraps every tag outside its allowlist.
  `ul` and `li` are not block-line tags there, so no `<br>` is inserted and the text is glued
  together. The store then saves **one** item: `Sustainability and academic developmentStudent welfareFinance`.
- Desktop Word fails differently. Its "lists" are `<p class=MsoListParagraph style='mso-list:…'>`
  with the bullet glyph as text, so the saved item comes out as
  `<span>·<span>&nbsp;&nbsp;</span></span>Sustainability…<br><span>·</span>Student welfare…`.
- The inspector `<textarea>` only takes plain text, so it cannot cause this. The reporter
  almost certainly pasted on the preview.

The redesign fixes this at the root. The block becomes one editing surface with a schema,
and a paste is parsed into that schema; the browser no longer inserts raw markup. **No
separate stopgap is planned** (see "Open with Markus").

## Goals

1. **One rich text field in the inspector** replaces the per-item `ItemList`. It shows text as
   it will look (WYSIWYG), with one toolbar row above it (mockup 1A).
2. **Editing on the canvas** treats the whole block as one writing area. A floating bar
   appears above any selected text (mockup 2A).
3. **Paste keeps structure.** Content pasted from Word (desktop Mac and Windows, and Word on
   the web), Google Docs or a web page becomes the right headings, lists and tables, keeps
   the inline formatting below, and drops everything else.
4. **Existing pages keep working** without anyone redoing them.
5. The reported bug can no longer happen.

## Non-goals

- The other "one box per paragraph" editors (`DescriptionBlockEditor` in news, events, jobs,
  shop and announcements). Markus agreed these may get the same treatment **later**, not now.
- Pasting images. Images have their own block.
- Free font choice and free font sizes.
- Comments, tracked changes and other Word review features.
- Restyling the editor chrome. Markus loves the current chrome. New controls must look like
  they were always there: paper tokens, `.pe-seg`-style buttons, 0.5px rules.

## Anti-goals (failure even if it "works")

- A published page that looks like a pasted Word document, with Calibri, 11pt, random colours
  and odd spacing, instead of a BISO page.
- Coloured text that becomes unreadable on a dark (`deep`) or photo section, or that ignores
  the department theme.
- An existing page that renders differently after this ships, before anyone touches it.
- Text that is lost or glued together on paste, which is the reported bug.

## What writers can do (agreed with Markus)

**Structure:** Heading (h2), Subheading (h3), Paragraph, Quote, bullet list, numbered list,
lists inside lists, table, and divider line.

**Inline:** bold, italic, underline, strikethrough, link, text colour.

**Text colour:** a small set of swatches taken from the page's theme, not a free colour
picker. When a department changes its theme, coloured text follows it and stays readable on
dark sections. The proposed set (my call; the builder finalises it with a contrast check on
both paper and deep surfaces): body text (default), accent, muted, and the BISO fixed hues
that pass contrast.

**Tables (Markus added these):** simple tables with an optional header row. Writers can add
and remove rows and columns. Cell text takes inline formatting.

## How it looks and behaves (agreed with Markus, mockups A + A)

### Inspector field (1A)

- The field replaces the "Content blocks" item list. It is one WYSIWYG area, tall enough to
  write in (about 230px minimum, growing with content up to a cap, then scrolling).
- One toolbar row sits above it: a **style dropdown** (Heading, Subheading, Paragraph, Quote),
  then B, I, U, colour, link, bullet list, numbered list, table, and **⋯** for strikethrough,
  divider and clear formatting. The row wraps if the 308px panel is too narrow; it must not
  scroll sideways.
- **⤢ Expand** opens the same field in a wide writing view over the editor, with the same
  toolbar, for long texts. Closing it returns to the panel. The canvas updates live behind it.
- Shortcuts: Cmd/Ctrl+B, I, U; Cmd/Ctrl+K for a link. Typing `- ` or `* ` starts a bullet
  list, and `1. ` starts a numbered list.

### Canvas editing (2A)

- Clicking into the block's text and typing behaves like Word: Enter makes a new paragraph or
  list item, Backspace at the start of a line joins it to the previous one, and Tab / Shift+Tab
  in a list nests and un-nests.
- Selecting text shows a small dark bar right above the selection, with the style dropdown,
  B, I, U, colour, link, bullet list and numbered list. It is hidden while nothing is selected
  (my call: no table button in the bubble).
- The panel and the canvas edit the same value. A change in one shows in the other
  immediately. This replaces today's "the canvas only saves on blur".

### Paste rules (both surfaces, one pipeline)

| From the clipboard | Becomes |
|---|---|
| Word "Title", "Heading 1", `<h1>` | Heading (h2), because the page title is the page's h1 |
| "Heading 2", `<h2>` | Subheading (h3) |
| "Heading 3"–"Heading 6", `<h3>`–`<h6>` | Subheading (h3) (my call) |
| Word `MsoListParagraph` + `mso-list` (desktop Word) | real `<ul>`/`<ol>`, with nesting from the `level` in `mso-list`; the bullet/number glyph text is removed |
| `<ul>`/`<ol>`/`<li>` (web, Docs, Word on the web) | bullet / numbered list, nesting kept |
| Bold / italic / underline / strikethrough, as tags **or** as inline styles (Google Docs uses `font-weight:700`, `font-style:italic`, `text-decoration`) | the same mark |
| `<a href>` with a safe href (existing rule) | link |
| Colour | the nearest theme swatch when it is close; otherwise dropped (my call) |
| `<table>` | table (header row kept when the source has one) |
| `<blockquote>` | Quote |
| Fonts, sizes, line heights, margins, backgrounds, classes, comments, Word's conditional comments, `<o:p>`, images | dropped |
| Plain text | blank-line-separated chunks become paragraphs; lines starting with `-`, `*` or `•` become a bullet list; `1.` / `1)` become a numbered list (my call) |

When a paste drops images, a short notice says images go in an Image block (my call).

## Existing pages (my call)

- No bulk data migration. Readers (canvas, public render, server sanitiser, translation,
  copilot) accept **both** shapes indefinitely: the legacy `body: TextBodyItem[]` and the new
  shape. Published pages that nobody re-saves keep rendering.
- The legacy array converts to the new shape with a pure function: `h`→h2, `h3`→h3, `p`→p,
  and a run of consecutive `li` becomes one `<ul>`. Its output must render **identically** to
  today's `TextRender`, using the same classes and spacing.
- The editor writes the new shape the first time a legacy block is edited.

## Storage (my call; rationale given)

`body` becomes **one sanitised HTML string** (the legacy array is still accepted on read).

- Page translation already treats a string under `body` as translatable and detects HTML
  (`apps/admin/src/lib/page-document-translation.ts`: `TRANSLATABLE_FIELDS` has `body`, and the
  `HTML_PATTERN` → `format: "html"`). An HTML string translates with no new code. The builder
  must confirm that list, table and colour markup survive a round trip.
- The public site renders sanitised HTML with no editor library. The editor library stays out of the
  `apps/web` bundle (see Constraints).
- The copilot already sets `body` via `set_prop`. Only its description changes
  (`packages/editor/src/ai/prompt.ts` currently says `text: body [{type: h|h3|p|li, text}]`).

Colour is stored as a token name, never a hex value, for example `<span data-color="accent">`.
CSS maps each token to theme variables, and on a `data-surface="deep"` band the same token
maps to its deep-surface variant. The sanitisers allow only known token values.

## Tooling (Markus, 2026-11-03)

**Plate.js**, because it is already in the repo. Markus's condition: **the editor looks as it
does today and only behaves better.** Plate's existing shadcn-style toolbar and components in
`packages/ui` are therefore not used for the chrome. The toolbar, bubble and Expand view are
built new against the editor's paper tokens and `.pe-seg`-style buttons, matching the mockups.

Context: the root `catalog` pins `platejs` ^52 and about 25 `@platejs/*` packages, including
table, list, link and basic-styles. `PlateContentRenderer` renders news, events, jobs and shop
rich text on `apps/web`. `DescriptionBlockEditor` dropped Plate because its JSON output leaked
into push previews. That was a storage problem, not a library problem, and storing sanitised
HTML (above) avoids it. Plate's Word clipboard add-on (`@platejs/docx`, formerly `@udecode/plate-docx`; confirm it exists at the catalog's version) is not in the catalog
yet. Add it at the catalog's Plate version, and use it for the desktop-Word list format before
writing custom `mso-list` handling. The deferred `DescriptionBlockEditor` work builds on the
same setup later. The unused Plate editor code in `packages/ui` stays as it is (my call: out of
scope).

## Numbered lists (my call)

`ol[start]` is allowed in both sanitisers, so a Word list broken by a paragraph
("1. … / paragraph / 2. …") keeps counting. Nested numbered lists use the default markers
per level. Legal-style numbering such as "6.3" is a known limitation: the nesting is kept,
but those exact numbers are not.

## Constraints

- Bun only. Add dependencies to `packages/editor` with `catalog:` versions.
- `bun run check-types`, the editor's tests (`bun test`) and `bun x ultracite fix` must pass.
- **Both sanitisers stay in lockstep.** The client sanitiser `lib/sanitize.ts`
  (`sanitizeRichText`, DOM-based, run in the editor) and the server sanitiser
  `editor/sanitize-doc.ts` (`sanitizeRichHtml`, `sanitize-html`, run before public render)
  share one allowlist. That allowlist grows to `p, h2, h3, blockquote, ul, ol, li, table,
  thead, tbody, tr, th, td, hr, u, s`, `ol[start]`, plus `span[data-color=<known token>]`. Table span
  attributes are allowed only if the builder keeps merged cells. Nothing else survives, in
  particular no `style` and no `class`.
- The public renderer must not import the editor library. The editing surface loads only in edit mode,
  for example through a dynamic import behind `edit`. The `apps/web` bundle must not grow by
  the editor.
- Editing must not flood the page's undo history (`store.ts` keeps `past`/`future`
  snapshots) or autosave with one step per keystroke. Typing inside a field is undone by the
  field's own history first.
- Public render: tables scroll sideways inside their own wrapper on phones, and the page
  itself never scrolls sideways. Long words and URLs keep today's wrapping rules
  (`ITEM_CLASS` in `render.tsx`).
- Accessibility: every toolbar button has an `aria-label` and `aria-pressed` where it
  toggles. The toolbar is keyboard reachable. The field has a label.
- The editor chrome stays English, as today.
- Documentation: update `apps/docs/content/docs/guide/pages-and-news/edit-a-page.mdx` (its
  `covers` includes the editor blocks), plus the developer pages that describe the text block,
  if any (`developers/change-it/common-changes.mdx`, `code-layout.mdx`).

## Places in the code this touches (starting points, not exhaustive)

- `packages/editor/src/blocks/text/{index,inspector,render}.tsx`: block definition, the
  inspector (replace the `ItemList`), the renderer (legacy and new shapes, editing surface).
- `packages/editor/src/editor/types.ts`: `TextBlock.body`.
- `packages/editor/src/lib/sanitize.ts`, `packages/editor/src/editor/sanitize-doc.ts`: the
  allowlists, plus `sanitizeBodyItem` / the text-block branch.
- `packages/editor/src/blocks/_v2/blank.ts` (`isBlankHtml`): a blank block still renders
  nothing on the public site.
- `packages/editor/src/editor/operations.ts` (`emptyBlock("text")`: heading + paragraph
  default) and `packages/editor/src/editor/templates.ts` (`text()` builds body items).
- `packages/editor/src/ai/prompt.ts` and `packages/editor/src/ai/tools/`: the copilot's view
  of the text block.
- `apps/admin/src/lib/page-document-translation.ts` and its cases in
  `apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts`.
- Fixtures that use the legacy shape and must keep rendering:
  `apps/web/src/app/(public)/design-system/page-blocks/fixture.ts`,
  `apps/web/src/app/(public)/design-system/winter-games/doc.ts`,
  `packages/wp-import` (emits legacy items).
- Theme tokens: `packages/shared/utils/page-theme.ts` (`themeTokens`), `packages/editor/src/theme/*.css`.

## Done means

1. The bug's reproduction (paste a three-item list into a list item on the canvas) yields three
   list items in the block, saved as such, with no glued text.
2. Paste fixtures for desktop Word (Mac and Windows), Word on the web, Google Docs and a plain
   web page map as the paste table says. They are covered by tests on the paste transform.
3. Every legacy fixture renders the same markup before and after; a legacy block, once edited,
   saves in the new shape and looks the same.
4. A page with lists, a table and coloured text translates and keeps its formatting.
5. The copilot can write a new-shape text block.
6. The public bundle has no editor-library code.
7. Coloured text is readable on paper, deep and photo sections under BISO and at least one
   custom department theme.

## Left to the builder

- The exact swatch set and token names (within "theme-derived, contrast-checked").
- Merged table cells: keep `colspan`/`rowspan` or flatten.
- Table controls (row/column add/remove, header toggle): where they appear when the cursor is
  in a table.
- How the two editor instances (inspector and canvas) sync without moving the cursor or
  fighting over focus.
- The "close enough" threshold for mapping pasted colours.
- The Expand view's exact size and look, within the existing chrome.
- Plan shape and stage order.

## Settled after review (my calls; Markus did not answer these two)

- **Paste fixtures:** built from published examples of each source's clipboard HTML: desktop
  Word's `MsoListParagraph`/`mso-list` paragraphs and conditional comments, Google Docs'
  `<b style="font-weight:normal" id="docs-internal-guid…">` wrapper and inline-style marks,
  Word on the web, and a plain web page. If Markus later supplies real captures, especially the
  Campus Management document from the report, they join the fixtures. Before go-live, Markus
  checks paste by hand from Word on Mac, plus Windows if anyone at BISO has it. That check goes
  on the go-live checklist.
- **No separate stopgap.** The plan orders the work so the first shippable stage already ends
  the reported bug: the one-surface canvas plus the paste pipeline, before the toolbar polish.

## Rulings during planning (2026-11-03)

- **No `@platejs/docx`.** Its 52.3.10 source takes a list's style from the bullet or number
  text and its level from `mso-list`, but never carries the number itself. Numbered lists could
  therefore not keep counting after an interruption, as agreed above. The paste normaliser
  instead turns desktop Word's `mso-list` paragraphs into real nested `<ul>`/`<ol start>`
  markup, which is a small, tested transform. All four sources then go through one HTML path.
  `@platejs/juice` is also unnecessary, because Word puts `mso-list` inline on each paragraph.
- **Heading levels on paste are relative.** The highest heading level in the pasted content
  becomes Heading (h2), and every lower level becomes Subheading (h3). For a Word document
  with Heading 1 and Heading 2 this matches the table above. Content copied from a BISO page,
  which starts at h2, then keeps its levels instead of dropping one.
- **Stages.**
  - Stage 1 is the shippable bug fix: storage shape, both sanitisers, the one-surface canvas
    and panel field, a toolbar and bubble with style / B / I / U / link / lists, and the paste
    pipeline. Stage 1 also adds the strikethrough mark and the divider line, so they survive
    paste, but their buttons come in Stage 2.
  - Stage 2 adds colour swatches, tables, the ⋯ menu, Expand, and the notice about dropped
    images.
  - Stage 3 covers the copilot prompt, templates, the translation round-trip test, the docs
    pages, the bundle check, and the go-live checklist.
- **The canvas surface does not use `data-edit="1"`.** The existing canvas `FormatBar` calls
  `execCommand` on any `[data-edit='1']` element, which would bypass Plate. The rich surface
  uses `data-rich-edit="1"` and gets its own bubble.

## Stage 1 done (2026-11-03)

### What was built

- `body` on a Text block is now a sanitised HTML string; legacy `TextBodyItem[]` still loads and renders with the old markup (`blocks/text/body.ts`).
- One shared allowlist (`lib/rich-allowlist.ts`) drives both sanitisers: client `lib/sanitize.ts` and server `editor/sanitize-doc.ts`. No `style` or `class` survives either.
- A Plate editing surface in `blocks/text/rich/`: HTML to and from Plate values (`html.ts`, `list-item-parse.ts` with the shared `effectiveDepths`), paste normaliser for Word, Google Docs and web pages plus plain-text lists (`paste.ts`, `paste-plugin.ts`), toolbar, selection bubble and link editor, Tab/Shift+Tab list depth, mod+k.
- The field (`field.tsx`, `sync.ts`) is used on both the panel and the canvas, loaded lazily (`lazy-field.ts`) and mounted only after client mount. The public renderer never imports it (confinement guard test).
- Store patches accept `coalesce`, so typing bursts become one undo step.
- Verification: `bun run check-types` passes, editor `bun test ./src` 1306 pass, admin and web builds compile. The `richPaste` key sits in one chunk and that chunk does not hold the legacy renderer's class string.

### Rulings made while building (cost if wrong)

- Chunk check uses the legacy class string, not `pg-rich` (shared by the lazy field). If wrong, the check passes with Plate in the public chunk; the confinement test is the main proof.
- T7 carried RICH_CLASS verbatim from T9. Cost: a class mismatch caught by T9's exact-markup test.
- Subagent commits keep the author model's trailer. Cost: cosmetic.
- Implementers lint only their changed paths. Cost: pre-existing lint drift untouched.
- aria-level pin runs through the paste path, not `htmlToValue`. Cost: none after sanitising.
- Extra `htmlToValue` steps (lift nested lists, wrap blockless body, link parse via `SAFE_HREF`) accepted. Cost: small surface, tested.
- All ordered list styles map to "decimal". Cost: alpha/roman markers show as numbers.
- Serializer clamps depth via one shared `effectiveDepths`. Cost: odd Word level jumps nest one level differently from Word.
- Admin editor renders the lazy field only after client mount. Cost: SSR crash if wrong; the admin build passed.
- List blocks render as own `<ul>/<ol start><li>`. Cost: none known.
- Canvas list indent is 1.25rem per level, matching the site; list-style set inside `.pe-rt-field`. Cost: slight canvas offset.
- DOM tests stub `editor.api.isFocused`. Cost: real focus behaviour verified by hand.
- Docs update stays in Stage 3. Cost: expected PR docs-check warning.
- Sibling `<p>` in `<li>`/`<blockquote>` join with `<br>`. Cost: multi-paragraph quotes show line breaks.
- Word-web fixture uses `data-aria-level`; both forms handled. Cost: none.
- Extra normaliser steps (trim trailing whitespace, drop link-underline span, drop DROPPED_WITH_CONTENT) accepted. Cost: small.
- Numbered Word headings stay headings and keep their number as text. Cost: headings show "1. " prefixes.
- Pasting into a non-empty list item merges the first pasted item; adjacent same-kind Word lists merge. Accepted.
- Plain text converts to HTML only with a newline or a list-marker first line, else default insert. Cost: a single "- item" line becomes a list.
- Numbered plain-text runs keep their start number (>= 2). Cost: none.
- Field skips canonicalising when html equals last html or the editor is focused; unfocused field takes a changed prop 300 ms after the last change. Cost: other surface lags up to 300 ms.
- Taking a prop clears the field's undo history. Cost: field-level mod+z cannot undo across surfaces.
- Tab never nests deeper than previous item + 1 and does nothing on a first item. Cost: cannot pre-indent a first bullet.
- Panel nested-list step is 20px (mockup said 18px). Cosmetic.
- Heading/Subheading/Quote on a list item leaves the list; list on a heading/quote makes a paragraph item. Cost: no "bulleted heading".
- Shift+Tab outdents the item and its deeper followers. Cost: none known.
- Toolbar/bubble take a pending prop on mousedown when unfocused. Cost: none.
- No whole-run depth normaliser. Cost: canvas can sit one level deeper than saved until reload after heading-ising or deleting a parent item.

### Deferred minors

- Tests: guard regexes lack fixture strings and miss `from "./rich"`, `../rich/x`, `export … from "platejs"`, side-effect imports; lockstep cases lack entity-encoded javascript:, uppercase tags, bare `<a>`, nested svg, `ol[start]` edges; no empty-array test for `legacyBodyToHtml`; no tests for setDoc/redo breaking a coalesce burst; weak undo fixture; DOM-globals block copied in six test files (shared helper wanted); RichBubble act() warnings; `test-support.ts` in `src/` imports react-dom/client.
- Behaviour: `legacyBodyToHtml` does not escape text (callers sanitise); `templates.ts` `text()` still builds legacy arrays (Stage 3); `MAX_TAG_STARTS` (10,000 `<`) turns an oversized body into escaped text, so a big Word paste needs triage; `flattenListItems` joins `<li>` paragraphs and reorders sublists on hand-written HTML; `listRestart` dropped; adjacent Word lists with different ids merge and renumber; any `application/x-slate-fragment` skips the normaliser (stored HTML stays safe); trailing-newline single line loses a leading space; heading-number handling replaces only the first marker span; multi-item Shift+Tab uses the first item's depth; `setStyle` list-exit strands sub-items; canvas mod+k on a caret is not preventDefault'ed (Ctrl+K opens browser search on Windows/Linux); bubble link placeholder is faint; `indentList` applies the first item's style to all; `selectedBlocks` spreads per change.

### Owner hand checks

- Paste from Word desktop and Word on the web, by hand on Mac and Windows.
- Google Docs list-formatted heading (`<li><h1 role=presentation>`) pastes as a list item, not a heading.
- Real-browser focus behaviour of the bubble and link input (tests stub `isFocused`).
- Canvas look: list indent, spacing and toolbar against the mockups.
- Known unrelated noise: `apps/admin/src/lib/content-translation.test.ts` fails (expects model `gpt-5.6-luna`, gets `claude-haiku-5-5`); not touched by this branch.
