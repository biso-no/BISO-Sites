# Rich Text Stage 2: Colour, Tables, ⋯ Menu, Expand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Stage 1's review residuals, then give the Rich text block theme-derived text colour, real tables, a ⋯ menu (strikethrough, divider, clear formatting), a wide Expand writing view, and a notice when a paste drops images.

**Architecture:** Tasks 1 and 2 land first: the server body sanitiser gets a strict linear "canonical" fast path in place of the htmlparser2 mirror, and five small Stage 1 fixes. Colour is a token (`<span data-color="accent">`) whose swatch values come from the page theme (`@repo/shared`), mapped to CSS variables that flip on `data-surface="deep"`. Tables use `@platejs/table` inside `blocks/text/rich/` and serialize to `<table><thead>…<tbody>…`, with `colspan`/`rowspan` kept. The shared allowlist gains one attribute-rule function, so the two sanitisers and the fast path cannot drift. The new toolbar controls, the table bar and the Expand view reuse the existing paper chrome.

**Tech Stack:** Plate.js 52.3.x (`platejs`, `@platejs/table` new to `packages/editor`, plus Stage 1's set), React 19, zustand store, `sanitize-html` (server), happy-dom + `bun:test` (editor), vitest (`packages/shared`, `apps/web`).

**Spec:** `docs/superpowers/specs/2026-11-03-rich-text-editor-design.md`. Read all of it, including "Rulings during planning" and "Stage 1 done". The mockups are in `docs/superpowers/specs/2026-11-03-rich-text-editor/mockups.html`, option A in both rows.

## Global Constraints

- Bun only (`bun@1.3.1`). New dependencies use `"catalog:"` (the root catalog already pins `@platejs/table` ^52.3.20).
- Work only in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/rich-text-editor`. Never `git push`. Never touch the main checkout or its branch.
- Must pass: `bun run check-types` (repo root), `cd packages/editor && bun test ./src`, and `bun x ultracite fix <changed paths>` on the files each task changes, not the whole repo (Stage 1 ruling). When a task touches `packages/shared` or `apps/web` tests, run their vitest suites too.
- Both sanitisers stay in lockstep. The client `lib/sanitize.ts` and the server `editor/sanitize-doc.ts` read one module, `lib/rich-allowlist.ts`, for tags and for attribute rules (`keptAttributes`, Task 4). No `style` and no `class` attribute survives either one.
- The Stage 2 body allowlist is Stage 1's tags plus `table, thead, tbody, tr, th, td`. Allowed attributes: `a[href]` (Stage 1 `SAFE_HREF`), `ol[start]` (2–9999), `span[data-color]` (exactly one of `accent, muted, green, amber, red`), and `th[colspan|rowspan]`, `td[colspan|rowspan]` (integers 2–20). A value of 1, or anything out of range, is dropped.
- Colour is stored only as `<span data-color="TOKEN">`, never as hex. The swatch values come from the page theme. There is no free colour picker.
- Plate confinement: no file outside `blocks/text/rich/` statically imports `platejs`, `@platejs/*` or anything in `rich/` (`rich-confinement.test.ts`, tightened in Task 2). The public renderer never imports Plate. The `apps/web` initial bundle must not grow by the editor.
- Invariants: `valueToHtml(htmlToValue(valueToHtml(v))) === valueToHtml(v)` for every value (seeded fuzz, Tasks 4–5). The server sanitiser leaves `valueToHtml` output unchanged, apart from writing U+00A0 as `&nbsp;`. Legacy `body: TextBodyItem[]` renders exactly as today.
- Chrome: paper tokens (`--paper`, `--paper-2`, `--rule-2`, `--ink-2`, `--ink-3`, `--pg-ink`), 0.5px rules, `.pe-rt-btn` / `.pe-seg`-style buttons, and the mockup's values. New controls must look as if they had always been there. Chrome strings are English.
- Every `.tsx` under `packages/editor/src/blocks/` must pass `blocks/_v2/v2-guard.test.ts`. That means no hex literals, no `shadow-*` or `rounded-*` utilities, no palette colours and no `text-white`. Colour literals belong in `.ts` or `.css` files. No `#001a35` anywhere under `packages/editor/src/blocks/` (`apps/web/src/app/styles.test.ts`).
- Docs pages wait for Stage 3, as in Stage 1. The PR docs-check warning is expected.
- Commit messages end with an attribution line for the model you are (`Co-Authored-By: <your model name> <noreply@anthropic.com>`), then:
  ```
  Claude-Session: https://claude.ai/code/session_014NDgSPSV8Z43ZEbDoPijNN
  ```

## Review Focus

1. **Pasted documents whose text colour sits on every run.** Chrome copies a web page with its computed colour inlined on each span, and Word users often set body text to "Text 1, lighter" (#595959). That colour must not turn every paragraph Muted or Accent → Task 6 tests `a colour on most of the paste is the source's text colour and is dropped` and `grey body with one red word keeps only the red`.
2. **Lists or paragraphs inside a table cell** (pasted, toggled, or typed with `- `). The cell must hold line-broken inline text, show no bullets on the canvas, and save the same → Task 5 test `a list made inside a cell is a plain line again`, and Task 8 tests that style, lists and table are disabled in a cell and that autoformat does nothing there.
3. **Merged cells from Word must survive row and column edits.** The table stays rectangular and keeps its text → Task 8 test `row and column edits keep a merged table rectangular`.
4. **A page undo that leaves the focused block untouched.** It must not leave the field ready to take a later outside change while the user types → Task 2 test `a page step that changes nothing here takes nothing later`.
5. **Escape inside a popover or the link input in the Expand view** must close only that popover, and removing the block must close the view → Task 9 tests `Escape in a popover keeps the wide view open` and `the wide view closes when its block goes`.

---

### Task 1: Canonical fast path in the server body sanitiser (residual a)

This task lands first, before every other task.

**Files:**
- Create: `packages/editor/src/editor/body-scan.ts`
- Test: `packages/editor/src/editor/body-scan.test.ts`
- Delete: `packages/editor/src/editor/nesting-scan.ts`, `packages/editor/src/editor/nesting-scan.test.ts`
- Modify: `packages/editor/src/editor/sanitize-doc.ts` (`sanitizeRichBodyHtml`; remove `MAX_BODY_TAG_STARTS` and the `nesting-scan` import)
- Modify: `packages/editor/src/lib/rich-allowlist.ts` (add `BODY_ATTRIBUTES`, `VOID_BODY_TAGS`)
- Modify: `packages/editor/src/editor/sanitize-doc.test.ts` (describe `sanitizeRichBodyHtml: long and deep bodies`)
- Modify: `packages/editor/src/lib/sanitize.ts` (doc comment on `sanitizeRichBody` only)

**Interfaces:**
- Produces:
  - `rich-allowlist.ts`: `BODY_ATTRIBUTES: Readonly<Record<string, readonly string[]>>`, set to `{ a: ["href"], ol: ["start"] }` for now. Tasks 4 and 5 add `span`, `th` and `td`. Also `VOID_BODY_TAGS: readonly string[] = ["br", "hr"]`. `sanitize-doc.ts`'s `BODY_OPTIONS.allowedAttributes` reads `BODY_ATTRIBUTES`.
  - `body-scan.ts`: `export type BodyScan = "canonical" | "too-deep" | "other"`, `export function scanBody(html: string, maxDepth: number): BodyScan`, and `export function textLines(html: string): string[]`.

**The canonical grammar (`scanBody`).** It is one left-to-right pass with an explicit stack, and it is linear in the input.
```
body   := ( text | open | void | close )*     and the stack is empty at the end
text   := one or more chars that are neither "<" nor ">"
open   := "<" TAG ( " " NAME '="' VALUE '"' )* ">"   TAG ∈ BODY_TAGS \ VOID_BODY_TAGS, NAME ∈ BODY_ATTRIBUTES[TAG]
void   := "<br>" | "<hr>"
close  := "</" TAG ">"                          TAG === the top of the stack (then pop)
VALUE  := chars other than '"', "<", ">"
```
Tag and attribute names are lower case and spelled exactly. There is exactly one space before each attribute. Anything else returns `"other"`, including a comment, a declaration, any other tag, `<br/>`, `</br>`, an unclosed tag at the end, or a stray `>`. When an `open` would push the stack past `maxDepth` and everything before it was canonical, the result is `"too-deep"`. Because `scanBody` reads only `BODY_TAGS` and `BODY_ATTRIBUTES`, Stage 2's new tags and attributes reach it without changes here.

**`textLines`** replaces the htmlparser2 mirror. It is lenient and linear, and it is safe by construction, because its output is escaped. It skips `<!--…-->` up to `-->` or the end of the input. It skips `<!…>` and `<?…>` up to `>`. A tag (`</?` + a letter, either case) runs up to the next `>`, or to the end of the input. A raw-text element in `DROPPED_WITH_CONTENT` (for example `script` or `style`) drops everything up to its own case-insensitive `</name`. A `<` that is not followed by a letter, `/`, `!` or `?` is text. A line ends at the open or close of any tag in Stage 1's `BLOCK_BREAKS` set (move that set into this file). Entities stay as written, and lines are trimmed and empty ones dropped.

**`sanitizeRichBodyHtml`:**
```
scan = scanBody(html, MAX_BODY_DEPTH)                     // 100
asText = scan === "too-deep" || (scan === "other" && hasMoreTagsThan(html, MAX_TAG_STARTS))   // 10,000
return sanitizeBody(asText ? asTextParagraphs(html) : html)
```
Canonical input of any size is sanitised normally. Non-canonical input under the cap goes through sanitize-html, whose `nestingLimit: 100` keeps the text and drops tags past depth 100. Over the cap, the body becomes text paragraphs, never escaped source.

- [ ] **Step 1: Write the failing tests**

```ts
// body-scan.test.ts
const CANONICAL = [
  '<h2>T</h2><p>a <strong>b</strong> <a href="https://biso.no?a=1&amp;b=2">l</a><br>c</p>',
  '<ul><li>x<ul><li>y</li></ul></li></ul><ol start="3"><li>z</li></ol><hr><blockquote>q &gt; r</blockquote>',
  "plain text, no tags",
  "",
];
test.each(CANONICAL)("accepts what the editor writes: %s", (html) => expect(scanBody(html, 100)).toBe("canonical"));
test.each([
  "<P>x</P>", "<a href='x'>y</a>", "<a href=x>y</a>", '<p class="x">y</p>', '<p href="x">y</p>',
  "<br/>", "a</br>b", "<!-- c -->", "<!doctype html><p>x</p>", "<script>x</script>", "<div>x</div>",
  "<p>a > b</p>", '<a href="<">x</a>', "<b><i>x</b></i>", "<p>x", "x</p>", "<p >x</p>", "<p\n>x</p>",
  '<a  href="x">y</a>',
])("rejects anything else: %s", (html) => expect(scanBody(html, 100)).toBe("other"));
test("depth is exact", () => {
  expect(scanBody(`${"<b>".repeat(100)}x${"</b>".repeat(100)}`, 100)).toBe("canonical");
  expect(scanBody(`${"<b>".repeat(101)}x${"</b>".repeat(101)}`, 100)).toBe("too-deep");
});
test("linear on any input", () => {
  for (const html of ["<p>a <strong>b</strong></p>".repeat(100_000), "<b>".repeat(200_000), "<b".repeat(200_000)]) {
    const started = performance.now();
    scanBody(html, 100);
    expect(performance.now() - started).toBeLessThan(100);
  }
});
test("text lines split at blocks and keep entities as written", () => {
  expect(textLines("<h2>T</h2><p>a <b>b</b> &amp; c<br>d</p><ul><li>e</li></ul> f")).toEqual(["T", "a b &amp; c", "d", "e", "f"]);
});
test("text lines drop raw text, comments and unterminated tags; a bare < is text", () => {
  expect(textLines("<p>a</p><SCRIPT>if (a < b) {}</SCRIPT><p>b</p>")).toEqual(["a", "b"]);
  expect(textLines("a<!-- <p> -->b")).toEqual(["ab"]);
  expect(textLines("<p>a < b</p><p>c<b")).toEqual(["a < b", "c"]);
});
```

In `sanitize-doc.test.ts`, describe `long and deep bodies`:
- Keep these unchanged: `a long flat body stays markup, past the inline path's 10,000 tags` (the 2,000-paragraph canonical body), `the legacy inline path keeps its 10,000-tag cap`, `100 levels of nesting stay markup`, `a body nested 150 deep is kept as text paragraphs with every word`, `end tags a browser would imply keep a long list shallow`, and `degrades 80,000 nested tags in under 200 ms`.
- Change `text kept from a deep body stays text` to a canonical inner text, `deep("a &amp; b &lt;i&gt; &lt;3<br>next")`, which must give `"<p>a &amp; b &lt;i&gt; &lt;3</p><p>next</p>"`.
- Add `a non-canonical deep body under the cap keeps its text and at most 100 levels`. Use `deep("a <3<script>alert(1)</script> b")`. The output contains `"a &lt;3"`, contains neither `<script` nor `alert`, has at most 100 `<b>`, and `scanBody(out, 100)` is `"canonical"`.
- Replace the eight `%s cannot hide the depth` cases with `%s is sanitised under the cap, fast`. Use the same eight `repeated.repeat(150)` inputs plus the re-reviewer's four: `"<button><select><b></button>".repeat(200)`, `"<head><body><b></head>".repeat(200)`, `"<rp><rt><b></rp>".repeat(200)`, and `` `<style>\x1c\x0fstyle>${"<b>".repeat(200)}` ``. For each, measure the time without a warm-up: it must be under 50 ms, `scanBody(out, 100)` must be `"canonical"`, and the output must not contain `<div`, `<textarea`, `<svg`, `<button`, `<select`, `<head`, `<rp` or `<style`. For the original eight, the output also contains `"w"`.
- Replace `past 50,000 tags even a flat body…` with two tests:
  - `a canonical body of any size stays markup`: `PARAGRAPH.repeat(9000)` is returned unchanged, in under 200 ms.
  - `a non-canonical body past 10,000 tags is kept as text paragraphs, never escaped`: `PARAGRAPH.replaceAll("<p>", "<P>").replaceAll("</p>", "</P>").repeat(2000)` gives `"<p>Short paragraph with bold and a link.</p>".repeat(2000)`.
- Add `the worst body under the cap stays bounded`: `"<button><select><b></button>".repeat(2499)` (9,996 tag starts) completes in under 150 ms. It took 14 ms under Bun when this plan was written; the old mirror's worst case was about 700 ms.

- [ ] **Step 2: Run** `cd packages/editor && bun test src/editor/body-scan.test.ts src/editor/sanitize-doc.test.ts`. Expected: FAIL, because `body-scan.ts` does not exist yet.
- [ ] **Step 3: Implement** `body-scan.ts`, the `rich-allowlist.ts` additions and the new `sanitizeRichBodyHtml`. Delete `nesting-scan.ts` and its test. Update `sanitizeRichBody`'s comment in `lib/sanitize.ts`, which still describes the depth rule.
- [ ] **Step 4: Run** `bun test ./src` in `packages/editor`, then `bun run check-types --filter=@repo/editor`. Expected: PASS.
- [ ] **Step 5: Commit**: `fix(editor): canonical bodies take a linear fast path; the htmlparser2 mirror goes`

---

### Task 2: Stage 1 editor residuals (b–f)

**Files:**
- Modify: `packages/editor/src/blocks/text/rich-confinement.test.ts` (f)
- Create: `packages/editor/src/blocks/text/canonical-body.ts`; Modify: `packages/editor/src/components/editor-shell/copilot/chat-panel.tsx`; Test: `packages/editor/src/components/editor-shell/copilot/chat-panel-body.dom.test.ts` (b)
- Modify: `packages/editor/src/blocks/text/rich/paste.ts`, test `rich/paste.test.ts` (c)
- Modify: `packages/editor/src/blocks/text/rich/field.tsx`, `rich/react-plugins.tsx`, test `rich/field.dom.test.tsx` (d, e)
- Modify: `packages/editor/src/editor/callbacks.tsx`, `components/editor-shell/index.tsx`, `blocks/text/render.tsx`, `blocks/text/inspector.tsx`, test `blocks/text/wiring.test.tsx` (e)

**Interfaces:**
- Produces:
  - `canonical-body.ts`: `canonicalBodyHtml(html: string): Promise<string>`, which runs `valueToHtml(htmlToValue(html))` through `await import("./rich/html")`, and `preloadRichHtml(): void`. This is the only way into `rich/` outside `lazy-field.ts`, and it is browser-only.
  - `chat-panel.tsx`: `export function whenBodiesCanonical(): Promise<void>`, which resolves once every pending canonical write has settled (tests use it).
  - `EditorCallbacks.pageHistory?: (step: "undo" | "redo") => void`. `EditorShell` supplies it in its provider value as `step === "undo" ? undo() : redo()`, and hosts never pass it.
  - `RichTextFieldProps.onPageHistory?: (step: "undo" | "redo") => void`. `TextRender`'s `EditBody` and `TextInspector` pass `useEditorCallbacks().pageHistory`.
  - `RichKeysConfig` gains the option `emptyHistory: ((step: "undo" | "redo") => void) | null` (default `null`).

**What each fix does:**
- **(f)** The guard also catches `from "./rich"` (no slash), `../rich/…` and `../…/rich…` paths, `export … from "platejs"` or `"@platejs/*"`, and a side-effect `import "platejs"` or `import "@platejs/…"`. `import type` and `export type` stay allowed, as do dynamic imports.
- **(b)** `applySetProp`: for a text block with `path === "body"` and a string value, write the raw value at once with `{ coalesce: \`copilot:${id}:body\` }`. Then call `canonicalBodyHtml(value)`. When it resolves, and only if the block's body still equals the raw value and the canonical form differs, call `setProp(id, "body", canonical, { coalesce: same key })`. Both writes are one undo step. A rejection leaves the raw value, which the server sanitises on save anyway. `CopilotPanel` calls `preloadRichHtml()` in a mount effect.
- **(c)** In `plainTextToHtml`, an `ol` line run becomes a list only when its numbers are consecutive from the first line's number. Otherwise its lines become paragraph text, and adjacent paragraph runs merge into one `<p>` joined by `<br>`.
- **(d)** While `linkOpen` is true, the field schedules no take, and a pending timer does not take when it fires. When `linkOpen` turns false with a prop pending, the field takes at once.
- **(e)** `RichKeysPlugin.onKeyDown` handles `mod+z` (by key) when `editor.history.undos` is empty and `mod+shift+z` when `editor.history.redos` is empty, but only if `emptyHistory` is set. It calls `preventDefault()`, calls `emptyHistory("undo" | "redo")` and returns `true`. Otherwise it returns `false`, and Slate's own history handles the key. The field sets `emptyHistory` to a wrapper that first sets a `forceTake` ref and then calls `onPageHistory`. The next `html` prop that differs from `lastHtml` is taken at once, even while the field is focused. `forceTake` is cleared when the field emits a change and when it blurs. The shell's window handler keeps its `isContentEditable` guard, so a key is never undone twice.

- [ ] **Step 1: Write the failing tests**

```ts
// rich-confinement.test.ts: extend the two test.each tables
test.each([
  'import { x } from "platejs";', 'import { y } from "@platejs/list/react";', 'import Z from "./rich/field";',
  'import Z from "./rich";', 'import { a } from "../rich/html";', 'import { a } from "../text/rich/html";',
  'export { b } from "platejs";', 'export * from "@platejs/table";', 'import "platejs";', 'import "@platejs/table/react";',
  'import {\n  a,\n  b,\n} from "platejs";',
])("the guard catches %s", (source) => expect(isGuarded(source)).toBe(true));
test.each([
  'import type { V } from "platejs";', 'export type { V } from "platejs";', 'const m = await import("./rich/field");',
  'import { x } from "./enrich";', '// import { x } from "platejs";',
])("the guard lets %s through", (source) => expect(isGuarded(source)).toBe(false));

// chat-panel-body.dom.test.ts: happy-dom globals as in rich/toolbar.dom.test.tsx; store set up as in chat-panel.test.ts
test("set_prop body is stored in the field's canonical form, in one undo step", async () => {
  const before = useEditorStore.getState().past.length;
  applyToolCall("set_prop", { id: "b-1", path: "body", value: "<div>Hei</div><div>du</div>" });
  expect(bodyOf("b-1")).toBe("<div>Hei</div><div>du</div>");
  await whenBodiesCanonical();
  expect(bodyOf("b-1")).toBe("<p>Hei</p><p>du</p>");
  expect(useEditorStore.getState().past.length).toBe(before + 1);
});
test("an edit made before the canonical form arrives wins", async () => {
  applyToolCall("set_prop", { id: "b-1", path: "body", value: "<div>a</div>" });
  useEditorStore.getState().setProp("b-1", "body", "<p>mine</p>");
  await whenBodiesCanonical();
  expect(bodyOf("b-1")).toBe("<p>mine</p>");
});

// paste.test.ts: add to the "plain text %p" table
["Program\n17. mai: Frokost\n24. mai: Tur", "<p>Program<br>17. mai: Frokost<br>24. mai: Tur</p>"],
["3. a\n4. b", '<ol start="3"><li>a</li><li>b</li></ol>'],
["1. a\n3. b", "<p>1. a<br>3. b</p>"],
["1. a\n2. b\n2. c", "<p>1. a<br>2. b<br>2. c</p>"],
["- a\n1. b\n2. c", "<ul><li>a</li></ul><ol><li>b</li><li>c</li></ol>"],

// field.dom.test.tsx (field()/mount()/advance() helpers; panel variant; RichKeysPlugin's linkOpen via editor.setOption)
test("an outside change waits while the link input is open, and is taken when it closes", async () => { /*
  render "<p>a</p>"; open link; render "<p>b</p>"; advance(TAKE_DELAY * 3) → text "a"; close link (settle) → text "b" */ });
test("a take scheduled before the link input opened does not fire while it is open", async () => { /*
  render "<p>a</p>"; render "<p>b</p>"; advance(TAKE_DELAY - 1); open link; advance(10) → "a"; close → "b" */ });
test("mod+z with an empty field history steps the page back and shows the result at once", async () => { /*
  field with onPageHistory spy; isFocused stubbed true; keydown {key:"z", ctrlKey:true} on the editable →
  spy called once with "undo", event.defaultPrevented; render "<p>before</p>" (still focused) → text "before", no timer advance */ });
test("mod+shift+z with an empty redo history steps the page forward", async () => { /* spy called with "redo" */ });
test("mod+z after typing undoes the typing in the field, not the page", async () => { /*
  typeText "!" → keydown ctrl+z → spy not called, text back to "a" */ });
test("a page step that changes nothing here takes nothing later", async () => { /*
  ctrl+z (spy, no prop change); typeText "x" (emits); render an outside "<p>z</p>" while focused → text stays "ax" */ });
test("without onPageHistory, mod+z in an empty field changes nothing", async () => { /* no throw, text "a" */ });

// wiring.test.tsx: wrap both surfaces in EditorCallbacksContext.Provider with a pageHistory mock
test("both surfaces hand the field the shell's page history", () => { /* fieldOf(...).onPageHistory === pageHistory, for canvas and inspector */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text src/components/editor-shell/copilot`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** (f), then (b) through (e). The guard regexes are yours to write; the two tables above pin them.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: one commit per fix, in this order:
  - (f) `test(editor): the Plate guard sees every import spelling`
  - (b) `fix(editor): copilot bodies are stored as the field writes them`
  - (c) `fix(editor): pasted date lines stay text unless they count on`
  - (d) `fix(editor): an outside change waits for the link input`
  - (e) `feat(editor): mod+z in a field with no history steps the page`

---

### Task 3: The colour palette from the page theme

**Files:**
- Modify: `packages/shared/utils/page-theme.ts` (`TEXT_HUES`; three new tokens in `themeTokens`)
- Create: `packages/shared/utils/text-colours.ts`
- Test: `packages/shared/utils/text-colours.test.ts`, `packages/shared/utils/page-theme.test.ts`
- Modify: `packages/ui/styles/biso-surface.css`, `packages/ui/styles/globals.css`
- Test: `apps/web/src/app/styles.test.ts`

**Interfaces:**
- Produces (`page-theme.ts`):
  - `export const TEXT_HUES = { green: { paper: "#187244", deep: "#26b66d" }, amber: { paper: "#8a5a00", deep: "#dd9000" }, red: { paper: "#b3261e", deep: "#ff6f61" } } as const`. The deep values are BISO's navy variants, the ones `biso-surface.css` already uses for state colours on navy.
  - `themeTokens` adds `--biso-deep-ink-green`, `--biso-deep-ink-amber` and `--biso-deep-ink-red`. Each one is `nearestPassingShade(TEXT_HUES[hue].deep, <the lightest of dark, raised, sunken>, 4.5) ?? "#ffffff"`. The deep inks are derived per theme because the fixed BISO values fail on lighter department darks: `#ff6f61` on a dark at the 7:1 limit is about 2.6:1.
- Produces (`text-colours.ts`):
  - `TEXT_COLOUR_TOKENS = ["accent", "muted", "green", "amber", "red"] as const` and `type TextColourToken`.
  - `interface TextSwatch { deep: string; label: string; paper: string; token: TextColourToken }`. The labels are `Accent, Muted, Green, Amber, Red`.
  - `textSwatches(theme: PageTheme | null): TextSwatch[]`, in token order:
    - When `theme` is null or `isBisoTheme(theme)`, it returns BISO's CSS defaults, because the canvas and site paint no theme CSS for BISO: accent `#1668ae` / `#3aa3e1`, muted `#526475` / `#93a7bb`, then `TEXT_HUES`.
    - Otherwise accent is `themeTokens(theme)["--biso-blue"]` / `["--biso-sky"]`, muted is `#526475` / `["--biso-deep-ink-muted"]`, and each hue is `TEXT_HUES[hue].paper` / `[\`--biso-deep-ink-${hue}\`]`.
  - `parseCssColour(value: string): string | null` returns `#rrggbb`. It reads `#rgb`, `#rrggbb`, `rgb()` and `rgba()` with alpha 1 (channels clamped to 0–255). It also reads the 16 CSS basic keywords, case-insensitive and trimmed, and treats `windowtext` as black. Anything else, including alpha below 1, `transparent` and `inherit`, gives `null`.
  - `PASTE_COLOUR_MAX_DISTANCE = 0.12` and `nearestTextColour(hex: string, swatches: readonly TextSwatch[]): TextColourToken | null`.
    - Distance is Euclidean in OKLab. Each swatch counts by its nearer variant, paper or deep.
    - The body-ink candidates `#001a35`, `#000000` and `#ffffff` mean "no colour".
    - It returns `null` when a body-ink candidate is nearest or the best distance is above 0.12, and the token otherwise.
- CSS:
  - In `biso-surface.css`, the `:where(.biso-surface-v2)` definitions block gets `--biso-deep-ink-green: #26b66d;`, `--biso-deep-ink-amber: #dd9000;` and `--biso-deep-ink-red: #ff6f61;` next to `--biso-deep-ink-muted`. It also gets `--ink-green: #187244;`, `--ink-amber: #8a5a00;` and `--ink-red: #b3261e;` next to `--ink-muted`.
  - The `[data-surface="deep"]` block and the `.dark` block each get `--ink-green: var(--biso-deep-ink-green);` and the same for amber and red.
  - `globals.css`, `@layer components`, after the type rules: `.pg-rich [data-color="<token>"] { color: var(--ink-<token>); }` for each of the five tokens (`--ink-accent` and `--ink-muted` already exist).

- [ ] **Step 1: Write the failing tests**

```ts
// text-colours.test.ts (vitest)
const PURPLE = { dark: "#3b1c6b", accent: "#fecd45" };
it("BISO swatches are the CSS defaults", () => {
  expect(textSwatches(null)).toEqual(textSwatches(BISO_THEME));
  expect(textSwatches(null).map((s) => [s.token, s.label, s.paper, s.deep])).toEqual([
    ["accent", "Accent", "#1668ae", "#3aa3e1"], ["muted", "Muted", "#526475", "#93a7bb"],
    ["green", "Green", "#187244", "#26b66d"], ["amber", "Amber", "#8a5a00", "#dd9000"], ["red", "Red", "#b3261e", "#ff6f61"],
  ]);
});
it("a department theme moves the accent and the deep inks, not the fixed paper hues", () => { /*
  accent.paper === themeTokens(PURPLE)["--biso-blue"], accent.deep === "#fecd45", muted.deep === tokens muted,
  green.deep === tokens["--biso-deep-ink-green"], green.paper === "#187244" */ });
it.each([null, PURPLE])("every swatch passes 4.5:1 on paper and on deep under %o", (theme) => { /*
  paper vs "#ffffff" and "#eef1f5"; deep vs dark, raised, sunken (BISO: "#001a35", "#0b2747", "#00142a"; else themeTokens) */ });
it.each([
  ["#c00000", "red"], ["#ff0000", "red"], ["#0070c0", "accent"], ["#4472c4", "accent"], ["#00b050", "green"],
  ["#ed7d31", "amber"], ["#7f7f7f", "muted"], ["#000000", null], ["#002060", null], ["#7030a0", null],
  ["#ffff00", null], ["#ff66cc", null], ["#92d050", null], ["#ffffff", null],
])("nearestTextColour(%s) under BISO is %p", (hex, token) => expect(nearestTextColour(hex, textSwatches(null))).toBe(token));
it("the paste threshold is pinned", () => expect(PASTE_COLOUR_MAX_DISTANCE).toBe(0.12));
it.each([
  ["#C00000", "#c00000"], ["#c00", "#cc0000"], ["rgb(192, 0, 0)", "#c00000"], ["rgba(192,0,0,1)", "#c00000"],
  [" Red ", "#ff0000"], ["windowtext", "#000000"], ["rgba(192,0,0,0.5)", null], ["transparent", null], ["inherit", null],
])("parseCssColour(%p)", (value, hex) => expect(parseCssColour(value)).toBe(hex));

// page-theme.test.ts
it("BISO's deep text inks are the CSS defaults", () => { /* themeTokens(BISO_THEME) → "#26b66d", "#dd9000", "#ff6f61" */ });
// inside "themeTokens on a seeded sweep of passing themes":
it("keeps every deep text ink readable on the dark, raised and sunken", () => { /* each of the three tokens ≥ 4.5 on all three surfaces, every swept theme */ });

// styles.test.ts: NAMED_NAVY gains the three --biso-deep-ink-* tokens with their BISO literals;
// "reads the named tokens in the deep and both dark blocks" gains them (minimum 2 reads each);
it("each rich text colour token has a rule that reads its ink", () => { /* for t of TEXT_COLOUR_TOKENS:
  globals contains `.pg-rich [data-color="${t}"]` followed by `color: var(--ink-${t})` */ });
```

- [ ] **Step 2: Run** `cd packages/shared && bun run test utils/text-colours.test.ts utils/page-theme.test.ts`, then `cd apps/web && bun run test src/app/styles.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the two modules and the CSS. Use OKLab's standard sRGB→LMS→OKLab matrices. `toRgb` stays private to `page-theme.ts`, so `text-colours.ts` parses hex itself.
- [ ] **Step 4: Run** the same two suites, plus root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(shared): text colour swatches from the page theme, readable on deep bands`

---

### Task 4: Colour in stored HTML

**Files:**
- Modify: `packages/editor/src/lib/rich-allowlist.ts`, `lib/sanitize.ts`, `editor/sanitize-doc.ts`
- Modify: `packages/editor/src/blocks/text/rich/plugins.ts`, `rich/react-plugins.tsx`, `rich/html.ts`
- Test: `packages/editor/src/lib/rich-allowlist.test.ts`, `rich/html.test.ts`, `rich/field.dom.test.tsx`, `editor/body-scan.test.ts`
- Create: `packages/editor/src/blocks/text/rich/fixed-point.test.ts`

**Interfaces:**
- Consumes: `TEXT_COLOUR_TOKENS`, `TextColourToken` (Task 3); `BODY_ATTRIBUTES`, `scanBody` (Task 1).
- Produces:
  - `rich-allowlist.ts`:
    - `type AttributeRule = (value: string) => string | null`.
    - `BODY_ATTRIBUTE_RULES: Readonly<Record<string, Readonly<Record<string, AttributeRule>>>>`, set to `{ a: { href: keptHref }, ol: { start: keptOlStart }, span: { "data-color": keptColourToken } }`. Task 5 adds `th` and `td`.
    - `BODY_ATTRIBUTES` is now derived from it, as names per tag.
    - `keptHref(value)` returns `value` unchanged when `SAFE_HREF.test(value.trim())`, else `null`. That is Stage 1's rule.
    - `keptColourToken(value): TextColourToken | null` trims the value and requires an exact token.
    - `keptAttributes(tag: string, attributes: Readonly<Record<string, string>>): Record<string, string>` returns the attributes each rule keeps, under the same names.
  - Both sanitisers call `keptAttributes` for body tags. In the client, `stripAttributes` (body mode) replaces the element's attributes with `keptAttributes(...)`. In the server, `BODY_OPTIONS.transformTags` maps every tag in `BODY_ATTRIBUTE_RULES` to `(tagName, attribs) => ({ tagName, attribs: keptAttributes(tagName, attribs) })`. The legacy inline paths stay as they are.
  - `plugins.ts`: `RichColourPlugin` is a base leaf plugin with key `"color"`. Its HTML deserializer has `isLeaf: true`, matches `SPAN`, and parses `{ color: keptColourToken(data-color) }`, or nothing when the token is unknown. It is appended to `richBasePlugins`.
  - `react-plugins.tsx`: the matching React plugin, whose leaf renders `<span data-color={token}>` (a `PlateLeaf` with `as="span"`) and renders nothing extra for an unknown value.
  - `html.ts`: `leafToHtml` wraps a leaf whose `color` passes `keptColourToken` in `<span data-color="…">`. The span is the outermost tag, outside `strong > em > u > s`.

- [ ] **Step 1: Write the failing tests**

```ts
// rich-allowlist.test.ts: CASES additions (client and server agree)
['<p><span data-color="accent">a</span></p>', '<p><span data-color="accent">a</span></p>'],
['<p><span data-color=" red ">a</span></p>', '<p><span data-color="red">a</span></p>'],
['<p><span data-color="ACCENT">a</span><span data-color="#ff0000">b</span><span data-color="pink">c</span></p>', "<p><span>a</span><span>b</span><span>c</span></p>"],
['<p><span data-color="muted" style="color:red" class="x">a</span></p>', '<p><span data-color="muted">a</span></p>'],
['<p><b data-color="accent">a</b></p>', "<p><b>a</b></p>"],

// html.test.ts: ROUND_TRIP additions
'<p><span data-color="accent">a</span> <span data-color="red"><strong>b</strong></span></p>',
'<h2><span data-color="muted">T</span></h2><ul><li><span data-color="green">x</span></li></ul>',
'<p><a href="https://biso.no"><span data-color="amber">l</span></a></p>',
test("colour sits outside the other marks", () => {
  expect(valueToHtml(htmlToValue('<p><strong><span data-color="red">b</span></strong></p>'))).toBe('<p><span data-color="red"><strong>b</strong></span></p>');
});
test("an unknown colour is dropped, its text kept", () => {
  expect(valueToHtml([{ type: "p", children: [{ text: "x", color: "pink" }] }])).toBe("<p>x</p>");
});

// body-scan.test.ts: CANONICAL gains '<p><span data-color="accent">a</span></p>'; "rejects" gains '<b data-color="accent">a</b>'

// fixed-point.test.ts: seeded fuzz (Park–Miller 48271, seed 20_261_103, 2,000 values)
test("2,000 random values serialize to a fixed point the server leaves alone", () => {
  for (const value of randomValues(2000)) {
    const once = valueToHtml(value);
    expect({ once, again: valueToHtml(htmlToValue(once)) }).toEqual({ once, again: once });
    expect(sanitizeRichBodyHtml(once)).toBe(once.replaceAll("\u00a0", "&nbsp;"));
    expect(scanBody(once, 100)).toBe("canonical");
  }
});

// field.dom.test.tsx
test("a coloured run shows as its token span on the canvas", async () => { /* '<p><span data-color="red">x</span></p>' → editable has span[data-color="red"] with "x"; mounting emits nothing */ });
```

`randomValues(n)` builds each value from 1–6 top-level blocks: `p`, `h2`, `h3`, `blockquote`, `hr`, or a run of 1–4 list items. A list item has indent 1–3, `disc` or `decimal`, and a `listStart` of 1–5 on decimal. Inline content is 1–4 non-empty leaves. Their text is words drawn from `a`, `b`, `&`, `<`, `>`, `"` and U+00A0, joined by single spaces or a `\n`. The text must already be collapsed as HTML collapses it: no space at the start or end of a block, no two spaces in a row across leaves, and no space beside a `\n`. That collapse is HTML's rule, not the serializer's. The leaves carry random `bold`, `italic`, `underline` and `strikethrough`, and a random `color` drawn from the five tokens plus `"pink"`. Some leaves sit inside a link whose `url` is one of `https://biso.no`, `/events`, `mailto:it@biso.no` or `javascript:x`. Task 5 adds tables to the generator.

- [ ] **Step 2: Run** `cd packages/editor && bun test src/lib src/blocks/text/rich src/editor/body-scan.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the allowlist rules and both sanitisers' use of `keptAttributes`, then the plugin, the leaf and the serializer. Check Plate's `validAttribute` rule shape (`core/dist/index-*.d.ts`) before choosing how the deserializer matches. If Plate gives an outer span's colour precedence over an inner one, fix it in the parse; Task 6 pins the nested case.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): text colour stored as theme tokens, kept by both sanitisers`

---

### Task 5: Tables in stored HTML and on the site

**Files:**
- Modify: `packages/editor/package.json` (add `"@platejs/table": "catalog:"`; then `bun install`)
- Modify: `packages/editor/src/lib/rich-allowlist.ts`
- Modify: `packages/editor/src/blocks/text/rich/plugins.ts`, `rich/react-plugins.tsx`, `rich/html.ts`, `rich/structure.ts`
- Modify: `packages/editor/src/blocks/text/render-classes.ts`, `blocks/text/index.tsx` (description `"Headings, paragraphs, lists, tables"`)
- Modify: `packages/ui/styles/globals.css`, `packages/editor/src/theme/editor.css`
- Test: `lib/rich-allowlist.test.ts`, `rich/html.test.ts`, `rich/fixed-point.test.ts`, `editor/body-scan.test.ts`, `blocks/text/render.test.tsx`, `rich/field.dom.test.tsx`

**Interfaces:**
- Consumes: `BODY_ATTRIBUTE_RULES`, `keptAttributes` (Task 4).
- Produces:
  - `rich-allowlist.ts`:
    - `TABLE_TAGS = ["table", "thead", "tbody", "tr", "th", "td"]`, appended to `BODY_TAGS`.
    - `CELL_SPAN = /^(?:[2-9]|1\d|20)$/` and `keptCellSpan(value)`, which trims and returns the value or `null`.
    - `BODY_ATTRIBUTE_RULES.th` and `.td` are both `{ colspan: keptCellSpan, rowspan: keptCellSpan }`.
  - `plugins.ts`:
    - `BaseTablePlugin.configure({ options: { disableMarginLeft: true } })` and `RichShapePlugin`, both appended to `richBasePlugins`.
    - `RichShapePlugin` is a base plugin whose normaliser enforces three rules. A block inside a `td`/`th` is a plain `p`, so another type becomes `p` and `listStyleType`, `indent`, `listStart`, `listRestart` and `listRestartPolite` are unset. An `hr` inside a cell is removed. The value never ends with a `table` or an `hr`, so an empty `p` is appended after one; the serializer drops empty paragraphs.
    - `TABLE_CELL_TYPES = ["td", "th"]`.
  - `react-plugins.tsx`: `TablePlugin`, `TableRowPlugin`, `TableCellPlugin` and `TableCellHeaderPlugin` (`@platejs/table/react`), each with a plain element. A table renders as `<table><tbody>{rows}</tbody></table>`. Cells render `<td>`/`<th>` with `colSpan`/`rowSpan` from `getColSpan`/`getRowSpan` when the value is 2 or more. These come before `RichKeysPlugin`, and `RichShapePlugin` is in the list as a base plugin.
  - `html.ts`, the serializer's table rule:
    - A `table` node with no `tr` gives `""`. Otherwise:
      - It writes `<table>`.
      - When the first row's cells are all `th`, that row goes in `<thead><tr>…</tr></thead>`.
      - The other rows go in `<tbody>…</tbody>`, which is omitted when empty.
      - Then `</table>`.
    - Each cell is `<th>` or `<td>`, with ` colspan="n"` and then ` rowspan="n"` when `keptCellSpan(String(n))` passes. `n` is `cell.colSpan ?? Number(cell.attributes?.colspan) ?? 1`, and the same for rows.
    - A cell's content is its blocks' inline HTML, with empty ones skipped, joined by `<br>`. Empty cells and empty tables are kept.
    - A table closes any open list, as every non-list block does.
  - `structure.ts`, `structureBlocks(root)`, in this order:
    1. **Misplaced tables keep Stage 1's fallback.** A table with an ancestor `li`, `blockquote`, `td`, `th`, `caption`, `p` or `h1`–`h6` has its `table, thead, tbody, tfoot, tr, colgroup, col` unwrapped. Its cells become `p`, or are unwrapped when they hold blocks.
    2. **Tidy each remaining table.** Remove `colgroup` and `col`. A `caption` becomes a `<p>` just before the table. `tfoot` rows move to the end of the last `tbody` (create one if needed), and the `tfoot` goes. `td` inside `thead` becomes `th`. A `tr` with no cell is removed. A table with no cell left is unwrapped.
    3. **Cell content becomes lines.** Every block descendant of a `td`/`th` (`p, div, h1–h6, blockquote, ul, ol, li, pre`, …) is unwrapped, with a `<br>` between it and the content beside it, as `joinBlockParagraphs` does. An `hr` inside a cell is removed.
    4. Stage 1's rules with the cells taken out: `LINE_CONTAINERS = "div, dt, dd"`, `WRAPPERS = "dl"`, then `joinBlockParagraphs`.
  - Public look:
    - `RICH_CLASS` appends ` [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_:is(th,td)]:border [&_:is(th,td)]:border-edge [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-top [&_:is(th,td)_p]:[overflow-wrap:normal] [&_th]:font-bold [&_thead_th]:bg-surface-sunken`. There is no wrapper element: the table scrolls inside itself on phones. Cells keep normal wrapping, so a long URL scrolls the table instead of crushing a column.
    - In `globals.css`, `.pg-rich :is(th, td)` and `.pg-rich :is(th, td) p` join the `.type-body-sm` selector list. No declaration changes.
  - Panel look, in `editor.css` under the rich text section:
    - `.pe-rt-field table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }`
    - `.pe-rt-field :is(th, td) { min-width: 48px; padding: 3px 6px; text-align: left; vertical-align: top; border: 0.5px solid var(--rule-2); }`
    - `.pe-rt-field th { font-weight: 600; color: var(--pg-ink); background: var(--paper-2); }`

- [ ] **Step 1: Write the failing tests**

```ts
// rich-allowlist.test.ts: CASES; the Stage 1 case becomes
["<h1>Big</h1><table><tr><td>c</td></tr></table>", "Big<table><tbody><tr><td>c</td></tr></tbody></table>"],
["<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>", "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>"],
['<table><tbody><tr><td colspan="2" rowspan="3">a</td></tr></tbody></table>', '<table><tbody><tr><td colspan="2" rowspan="3">a</td></tr></tbody></table>'],
['<table><tbody><tr><td colspan="21" rowspan="1">a</td><td colspan="x">b</td><td rowspan="02">c</td></tr></tbody></table>', "<table><tbody><tr><td>a</td><td>b</td><td>c</td></tr></tbody></table>"],
['<table border="1" style="x" class="y"><tbody><tr><td width="5" scope="col" class="z">a</td></tr></tbody></table>', "<table><tbody><tr><td>a</td></tr></tbody></table>"],
["<table><tfoot><tr><td>f</td></tr></tfoot></table>", "<table><tbody><tr><td>f</td></tr></tbody></table>"],

// html.test.ts: ROUND_TRIP additions
"<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Ada</td><td><strong>Lead</strong></td></tr></tbody></table>",
'<table><tbody><tr><td colspan="2">a</td></tr><tr><td rowspan="2">b</td><td>c</td></tr><tr><td>d</td></tr></tbody></table>',
"<p>x</p><table><tbody><tr><td>a<br>b</td><td></td></tr></tbody></table><ul><li>y</li></ul>",
'<table><tbody><tr><th>Row</th><td><a href="https://biso.no">l</a> <span data-color="red">r</span></td></tr></tbody></table>',
"<table><thead><tr><th>Only header</th></tr></thead></table>",
test.each([
  ["<table><tr><th>h</th></tr><tr><td>a</td></tr></table>", "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>"],
  ["<table><thead><tr><td>h</td></tr></thead><tbody><tr><td>a</td></tr></tbody></table>", "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>"],
  ["<table><caption>Contacts</caption><colgroup><col></colgroup><tbody><tr><td>a</td></tr></tbody><tfoot><tr><td>sum</td></tr></tfoot></table>", "<p>Contacts</p><table><tbody><tr><td>a</td></tr><tr><td>sum</td></tr></tbody></table>"],
  ["<table><tbody><tr><td><p>a</p><p>b</p></td><td><ul><li>c</li><li>d</li></ul></td></tr></tbody></table>", "<table><tbody><tr><td>a<br>b</td><td>c<br>d</td></tr></tbody></table>"],
  ["<table><tbody><tr><td>a<table><tbody><tr><td>b</td><td>c</td></tr></tbody></table></td></tr></tbody></table>", "<table><tbody><tr><td>a<br>b<br>c</td></tr></tbody></table>"],
  ["<ul><li>x<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></li></ul>", "<ul><li>x<br>a<br>b</li></ul>"],
  ["<blockquote><table><tbody><tr><td>q</td></tr></tbody></table></blockquote>", "<blockquote>q</blockquote>"],
  ["<table></table><p>x</p>", "<p>x</p>"],
  ["<table><tbody><tr><td></td></tr></tbody></table>", "<table><tbody><tr><td></td></tr></tbody></table>"],
])("stored table %s is read as %s", (input, out) => expect(valueToHtml(htmlToValue(input))).toBe(out));
test("a list made inside a cell is a plain line again", () => {
  // conversion editor on "<table><tbody><tr><td>a</td></tr></tbody></table>", select the cell, toggleRichList(editor, "disc"), normalize
  // → the cell's block has no listStyleType; valueToHtml is unchanged
});
test("the value never ends with a table or a divider", () => {
  expect(htmlToValue("<p>a</p><hr>").at(-1)).toMatchObject({ type: "p" });
  expect(htmlToValue("<table><tbody><tr><td>a</td></tr></tbody></table>").at(-1)).toMatchObject({ type: "p" });
});

// fixed-point.test.ts: randomValues also emits tables: 1–4 rows × 1–4 cells, a th header row half the time,
// colSpan/rowSpan 1–3 on some cells, each cell 1–2 paragraphs of the same inline content. Same assertions.

// body-scan.test.ts: CANONICAL gains '<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td rowspan="2">a</td><td>b</td></tr></tbody></table>'

// render.test.tsx
test("a table body renders inside the rich wrapper as stored", () => { /* exact markup `<div class="${RICH_ATTR}"><table>…</table></div>` */ });
test("tables scroll inside themselves", () => { for (const c of ["[&_table]:block", "[&_table]:overflow-x-auto", "[&_table]:max-w-full"]) expect(RICH_CLASS).toContain(c); });

// field.dom.test.tsx
test("a stored table is a real table on the canvas", async () => { /* canvas variant, merged-cell table → table > tbody > tr > th, td[colspan="2"]; mounting emits nothing */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/lib src/blocks/text src/editor/body-scan.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the dependency, the allowlist, the plugins, the serializer, the structure step and the CSS. Check the export names against `node_modules/@platejs/table/dist/index.d.ts` and `dist/react/index.d.ts`; these were seen there: `BaseTablePlugin`, `TablePlugin`, `TableRowPlugin`, `TableCellPlugin`, `TableCellHeaderPlugin`, `getColSpan`, `getRowSpan`. Stage 1 tests that count blocks after a trailing `hr` now see the extra empty paragraph; update those counts.
- [ ] **Step 4: Run** `bun test ./src` (including `rich-confinement.test.ts` and `blocks/_v2/v2-guard.test.ts`) and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): tables in the rich text body, merged cells kept, scrolling on phones`

---

### Task 6: Paste keeps colours (nearest swatch) and tables

**Files:**
- Modify: `packages/editor/src/blocks/text/rich/paste.ts`, `rich/paste-plugin.ts`
- Create: `packages/editor/src/blocks/text/rich/fixtures/{word-desktop,google-docs,word-web,web-page}-table.html`
- Test: `packages/editor/src/blocks/text/rich/paste.test.ts`

**Interfaces:**
- Consumes: `textSwatches`, `nearestTextColour`, `parseCssColour`, `TextSwatch` (Task 3); the table structure step (Task 5).
- Produces:
  - `normalizePastedHtml(html: string, swatches: readonly TextSwatch[] = textSwatches(null)): string`. This adds one step, `mapPastedColours(root, swatches)`, which runs after `keepHeadingNumbers` and before `convertWordLists`.
  - `RichPastePlugin` becomes `createTSlatePlugin` with the option `swatches: readonly TextSwatch[]` (default `textSwatches(null)`), and passes it to `normalizePastedHtml`.

**Colour mapping rules (`mapPastedColours`):**
1. A colour comes from an element's `style` attribute declaration whose property is exactly `color` (so not `background-color` or `-webkit-tap-highlight-color`), with `!important` stripped, or from `font[color]`. `parseCssColour` reads it.
2. Only an inline element (`span, font, b, strong, i, em, u, s, strike, sub, sup, mark, small`) maps. A colour on a block element, on an element inside a heading (`h1`–`h6`), or on or inside an `a` is dropped. That colour is the source's layout, not the writer's choice.
3. The token is `nearestTextColour(hex, swatches)`. A `span` gets `data-color`. Any other inline element has its children wrapped in a new `<span data-color>`. A colour with no token is dropped.
4. If one token covers more than half of the pasted text's non-whitespace characters outside headings and links, it is the source's text colour, and every span carrying it is unwrapped.
5. The `color` declaration is removed in every case. The sanitiser drops `style` later anyway.

- [ ] **Step 1: Write the failing tests**

```ts
const PURPLE_SWATCHES = textSwatches({ dark: "#3b1c6b", accent: "#fecd45" });
test.each([
  ['<p>a <span style="color:#C00000">b</span></p>', '<p>a <span data-color="red">b</span></p>'],
  ['<p>a <font color="#0070c0">b</font></p>', '<p>a <span data-color="accent">b</span></p>'],
  ['<p>a <span style="background-color:#c00000;-webkit-tap-highlight-color:transparent">b</span></p>', "<p>a b</p>"],
  ['<p>a <span style="color:#7030a0">b</span></p>', "<p>a b</p>"],
  ['<p style="color:#c00000">a</p>', "<p>a</p>"],
  ['<h2><span style="color:#c00000">T</span></h2><p>x</p>', "<h2>T</h2><p>x</p>"],
  ['<p><a href="https://biso.no"><span style="color:#0563c1">l</span></a> x</p>', '<p><a href="https://biso.no">l</a> x</p>'],
  ['<p><span style="color:#c00000">a<span style="color:#00b050">b</span></span> c</p>', '<p><span data-color="red">a</span><span data-color="green">b</span> c</p>'],
])("pasted colour %s", (input, out) => expect(pasteInto(input)).toBe(out));
test("a colour on most of the paste is the source's text colour and is dropped", () => {
  expect(pasteInto('<p><span style="color:#595959">all</span></p><p><span style="color:#595959">of it</span></p>')).toBe("<p>all</p><p>of it</p>");
});
test("grey body with one red word keeps only the red", () => {
  expect(pasteInto('<p><span style="color:#595959">Most of the text is grey and </span><span style="color:#c00000">red</span></p>'))
    .toBe('<p>Most of the text is grey and <span data-color="red">red</span></p>');
});
test("colours map against the page's own theme", () => {
  expect(normalizePastedHtml('<p>a <span style="color:#fecd45">b</span></p>', PURPLE_SWATCHES)).toContain('data-color="accent"');
});
// The reference fixtures: word-desktop's `color:#C00000` run is now red; the other three are unchanged.
const EXPECTED_WORD = EXPECTED.replace("for the student experience.", 'for the <span data-color="red">student experience</span>.');
// "%s pastes as the reference document" expects EXPECTED_WORD for word-desktop and EXPECTED for the rest.

// Tables
const TABLE_EXPECTED =
  "<table><tbody><tr><td><strong>Campus</strong></td><td><strong>Contact</strong></td></tr>" +
  '<tr><td>Oslo</td><td><a href="mailto:oslo@biso.no">oslo@biso.no</a></td></tr>' +
  '<tr><td colspan="2">Bergen opens in spring</td></tr></tbody></table>';
const WEB_TABLE_EXPECTED =
  "<p>Contacts</p><table><thead><tr><th>Campus</th><th>Contact</th></tr></thead><tbody>" +
  '<tr><td>Oslo</td><td><a href="mailto:oslo@biso.no">oslo@biso.no</a></td></tr>' +
  '<tr><td colspan="2">Bergen opens in spring</td></tr></tbody></table>';
test.each(["word-desktop", "google-docs", "word-web"])("%s table pastes as a real table", (name) =>
  expect(pasteInto(fixture(`${name}-table`))).toBe(TABLE_EXPECTED));
test("a web page table keeps its header row and caption", () => expect(pasteInto(fixture("web-page-table"))).toBe(WEB_TABLE_EXPECTED));
test("a pasted table into an empty field is just the table", () => { /* pasteInto("<table><tr><td>a</td></tr></table>") === "<table><tbody><tr><td>a</td></tr></tbody></table>" */ });
```

The table fixtures are written from published examples of each source's clipboard HTML, like Stage 1's. Each holds the same three-row table: a bold first row (a `th` header row in the web page), a mailto link, and a merged last row. Each must contain these markers, which a fixture-marker test pins:
- `word-desktop-table.html`: `class=MsoTableGrid`, `<td width=` with `valign=top`, `<p class=MsoNormal>` inside cells, `<o:p></o:p>`, `<b>` for the first row, and `colspan=2`.
- `google-docs-table.html`: the `docs-internal-guid` `<b>` wrapper, `<div dir="ltr" style="margin-left:0pt;" align="left">`, a `<colgroup>`, cells holding `<p dir="ltr">` with spans that carry `font-weight:700` and `color:#000000`, and `colspan="2"`.
- `word-web-table.html`: `div.TableContainer`, `table.Table`, `td.TableCellElement` > `div.TableCellContent` > `div.OutlineElement` > `p.Paragraph` > `span.TextRun` (with `font-weight: bold` in the first row), and `colspan="2"`.
- `web-page-table.html`: `<caption>Contacts</caption>`, `<thead><tr><th scope="col">`, `class=`/`style=` on several elements, `color: rgb(55, 65, 81)` on the table, and `colspan="2"`.

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text/rich/paste.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `mapPastedColours`, the plugin option and the four fixtures. If a fixture disagrees with its expectation because of a real dialect difference, fix the normaliser, not the expectation (Stage 1 rule).
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): pasted colours map to the nearest swatch; pasted tables stay tables`

---

### Task 7: Toolbar colour button and ⋯ menu

**Files:**
- Create: `packages/editor/src/blocks/text/rich/popover.tsx`, `rich/colour-menu.tsx`, `rich/more-menu.tsx`, `rich/page-swatches.ts`
- Modify: `packages/editor/src/blocks/text/rich/commands.ts`, `rich/toolbar.tsx`, `rich/field.tsx`, `packages/editor/src/theme/editor.css`
- Test: `rich/commands.test.ts`, `rich/toolbar.dom.test.tsx`

**Interfaces:**
- Consumes: `textSwatches`, `TextSwatch`, `TextColourToken` (Task 3); `keptColourToken` (Task 4); `RichPastePlugin`'s `swatches` option (Task 6); `effectiveTheme` (`editor/effective-theme.ts`), `useMeta` (`editor/hooks.ts`), the store's `themePreview`, and `useEditorCallbacks().departments`.
- Produces:
  - `commands.ts`:
    - `currentColour(editor): TextColourToken | null`, read from `editor.api.marks()` through `keptColourToken`.
    - `setColour(editor, colour: TextColourToken | null): void`, which adds `{ color }` or removes the `color` mark.
    - `clearFormatting(editor): void`, which removes `bold, italic, underline, strikethrough, color` over the selection and keeps links.
    - `insertDivider(editor): void`. It inserts an `hr` after the caret's top-level block and puts the caret in the block after it, adding an empty `p` when there is none. An empty paragraph is replaced instead.
  - `page-swatches.ts`: `usePageSwatches(): TextSwatch[]`, which is `textSwatches(themePreview ?? effectiveTheme(meta, departments))`, memoised. It lives in `rich/` so the store stays out of the public bundle.
  - `popover.tsx`: `RichPopover({ label, button, children }: { label: string; button: (props: PopoverButtonProps) => ReactNode; children: (close: (focusEditor: boolean) => void) => ReactNode })`. It renders `.pe-rt-popwrap`, the toggle, and when open `<div role="group" aria-label={label} className="pe-rt-pop">`. The toggle carries `aria-haspopup="true"` and `aria-expanded`, and its mousedown is prevented. Opening it from the keyboard (`event.detail === 0`) focuses the first item. Escape inside the popover closes it, focuses the toggle, and calls `preventDefault` and `stopPropagation`. A mousedown outside it closes it.
  - `colour-menu.tsx`: `ColourMenu({ editor, swatches, current })`. The toggle is `aria-label="Text colour"`, showing the glyph `A` plus a 6px dot in the current swatch's paper colour, or a ring when there is none. The items are `Default` plus one per swatch: a 10px dot in its paper colour (a ring for Default), the label, and `aria-pressed` on the current one. Choosing an item calls `setColour`, closes the popover and focuses the editor.
  - `more-menu.tsx`: `MoreMenu({ editor, strikethrough, inCell }: { editor: PlateEditor; strikethrough: boolean; inCell: boolean })`. Task 7 always passes `inCell={false}`; Task 8 passes the real value. The toggle is `aria-label="More formatting"` with the glyph `⋯`. The items are `Strikethrough` (with `aria-pressed`), `Divider` and `Clear formatting`. Each runs its command, closes the menu and focuses the editor.
  - `toolbar.tsx`: `RichToolbar({ editor, tone, swatches }: { editor: PlateEditor; tone: "paper" | "ink"; swatches: readonly TextSwatch[] })`. The order follows the mockup: style select, separator, B, I, U, **Text colour**, Link, separator, Bullet list, Numbered list, then **More formatting** in the `paper` tone only. The bubble (`ink`) gets the colour button but no ⋯. `ToolbarState` gains `colour` and `strikethrough`.
  - `field.tsx`:
    - `const swatches = usePageSwatches()`, passed to both toolbars.
    - `editor.setOption(RichPastePlugin, "swatches", swatches)` in an effect.
    - The panel surface gets `style` with `--pe-rt-<token>: <paper>` for each swatch.
  - CSS (`editor.css`, rich text section). The values come from the mockup's `.b`, `.drop`, `.sw` and `.field`:
    - `.pe-rt-popwrap { position: relative; display: inline-flex; }`
    - `.pe-rt-pop { position: absolute; top: calc(100% + 4px); left: 0; z-index: 30; display: flex; flex-direction: column; gap: 1px; min-width: 132px; padding: 3px; background: var(--paper); border: 0.5px solid var(--rule-2); border-radius: 6px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12); }`
    - `.pe-rt-pop__item`: flex row, gap 6px, height 24px, padding `0 6px`, 11.5px text in `var(--ink-2)`, transparent, no border, radius 4px, `text-align: left`. On `:hover` and `[aria-pressed="true"]`: white background, `box-shadow: 0 0 0 0.5px var(--rule-2)`, `var(--pg-ink)`. When `:disabled`: opacity 0.4.
    - `.pe-rt-swatch`: a 10px circle with `box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.15)`. `.pe-rt-swatch--none` is transparent with `inset 0 0 0 1px var(--ink-4)`. `.pe-rt-colour__dot` is a 6px circle, `margin-left: 1px`.
    - `.pe-rt-field [data-color="<token>"] { color: var(--pe-rt-<token>); }` for each of the five tokens.

- [ ] **Step 1: Write the failing tests**

```ts
// commands.test.ts (conversion editor)
test("setColour colours the selection; null clears it", () => { /* "<p>ab</p>" select all → setColour("red") → '<p><span data-color="red">ab</span></p>' → setColour(null) → "<p>ab</p>" */ });
test("currentColour reads the colour at the selection", () => { /* '<p><span data-color="muted">a</span>b</p>': select "a" → "muted"; select "b" → null */ });
test("clearFormatting removes marks and colour and keeps the link", () => {
  /* '<p><a href="https://biso.no"><strong><span data-color="red">x</span></strong></a> <em>y</em> <s>z</s></p>' select all
     → '<p><a href="https://biso.no">x</a> y z</p>' */ });
test("insertDivider puts a rule after the block and the caret after it", () => {
  /* "<p>a</p><p>b</p>" caret in a → "<p>a</p><hr><p>b</p>", selection in block 2; "<p>a</p>" caret end → "<p>a</p><hr>", children types ["p","hr","p"], selection in block 2 */ });
test("insertDivider on an empty paragraph replaces it", () => { /* "<p>a</p><p></p>" caret in block 1 → "<p>a</p><hr>", types ["p","hr","p"] */ });

// toolbar.dom.test.tsx
// "toolbar exposes labelled controls in order" now expects:
// ["Text style","Bold","Italic","Underline","Text colour","Link","Bullet list","Numbered list","More formatting"]
test("Text colour opens the swatches; the current one is pressed", async () => { /*
  '<p><span data-color="accent">a</span></p>' select all → press Text colour → aria-expanded "true";
  group "Text colour" buttons: Default, Accent, Muted, Green, Amber, Red; Accent aria-pressed "true" */ });
test("a swatch colours the selection and closes the swatches", async () => { /* "<p>ab</p>" → Red → last emit '<p><span data-color="red">ab</span></p>'; no group; aria-expanded "false" */ });
test("Default removes the colour", async () => { /* from red → "<p>ab</p>" */ });
test("Escape closes the swatches and keeps the key", async () => { /* keydown Escape on a swatch → group gone, event.defaultPrevented, toggle focused */ });
test("a press outside closes the swatches", async () => { /* open Text colour; mousedown on document.body → group gone */ });
test("More formatting holds strikethrough, divider and clear formatting", async () => { /* press → group "More formatting" with buttons Strikethrough, Divider, Clear formatting, in that order */ });
test("Strikethrough toggles and shows its state", async () => { /* "<p>ab</p>" → '<p><s>ab</s></p>'; reopen → Strikethrough aria-pressed "true" */ });
test("Divider and Clear formatting run from the menu", async () => { /* "<p>a</p>" caret end → Divider → "<p>a</p><hr>"; clear as in commands.test */ });
test("the bubble has the colour button and no ⋯", async () => { /* canvas, expanded selection → bubble labels contain "Text colour", not "More formatting" */ });
test("the panel field paints colours with the page's swatches", async () => {
  /* editable.style.getPropertyValue("--pe-rt-red") === textSwatches(null).find((s) => s.token === "red")?.paper */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text/rich`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the commands, the popover, both menus, `usePageSwatches`, the toolbar and field wiring, and the CSS. Icons and glyphs stay 12–13px in `currentColor`, like Stage 1's `LinkIcon`.
- [ ] **Step 4: Run** `bun test ./src` (including `v2-guard.test.ts`) and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): text colour swatches and the ⋯ menu in the rich text toolbar`

---

### Task 8: Table controls

**Files:**
- Create: `packages/editor/src/blocks/text/rich/table-commands.ts`, `rich/table-bar.tsx`
- Modify: `packages/editor/src/blocks/text/rich/toolbar.tsx`, `rich/more-menu.tsx`, `rich/react-plugins.tsx`, `packages/editor/src/theme/editor.css`
- Test: `packages/editor/src/blocks/text/rich/table-commands.test.ts`, `rich/toolbar.dom.test.tsx`

**Interfaces:**
- Consumes: the table plugins and `TABLE_CELL_TYPES` (Task 5); `RichToolbar`, `MoreMenu` (Task 7).
- Produces (`table-commands.ts`):
  - `inTableCell(editor): boolean`.
  - `interface TableState { headerRow: boolean; inHeaderRow: boolean }` and `tableState(editor): TableState | null`, which is null outside a table.
  - `insertRichTable(editor): void`: a 3×3 table with a header row (`insertTable(editor, { colCount: 3, rowCount: 3, header: true }, { select: true })`), with the caret in the first header cell.
  - `type TableAction = "rowAbove" | "rowBelow" | "columnLeft" | "columnRight" | "deleteRow" | "deleteColumn" | "toggleHeader" | "deleteTable"` and `runTableAction(editor, action): void`, which uses Plate's `editor.tf.insert.tableRow/tableColumn` and `editor.tf.remove.tableRow/tableColumn/table`, merge-aware. Rules:
    - New rows are body rows (`header: false`).
    - `rowAbove` in the header row does nothing.
    - New columns get `th` in the header row and `td` elsewhere.
    - Deleting the last row or the last column deletes the table.
    - `toggleHeader` turns every cell of the first row into `td` when they are all `th`, and into `th` otherwise.
    - `deleteTable` leaves the caret in the block after the table.
- Produces (UI):
  - `table-bar.tsx`: `TableBar({ editor, state }: { editor: PlateEditor; state: TableState })`. It is a second line inside `.pe-rt-bar`: `<div role="group" aria-label="Table" className="pe-rt-table">`. It holds:
    - The visual label `Row` (aria-hidden), then icon buttons `Insert row above` (disabled when `inHeaderRow`), `Insert row below` and `Delete row`.
    - A separator.
    - `Column`, then `Insert column left`, `Insert column right` and `Delete column`.
    - A separator.
    - The text toggle `Header row` (`aria-pressed={state.headerRow}`) and the text button `Delete table`.
    - Each button has `aria-label` and `title` set to its name.
  - `toolbar.tsx`:
    - In the `paper` tone, `Insert table` (`⊞`) sits after `Numbered list` and before `More formatting`.
    - `<TableBar>` renders while `tableState` is non-null, in the `paper` tone only. The canvas bubble has no table controls.
    - While the caret is in a cell, the style select, both list buttons and `Insert table` are disabled, and `MoreMenu`'s `Divider` is disabled.
  - `react-plugins.tsx`:
    - `RichKeysPlugin`'s `tab` override becomes `inTableCell(editor) ? tab(options) : handleListTab(editor, { shift: options.reverse })`, where `tab` is the previous transform, the table's. The table plugins are registered before `RichKeysPlugin`.
    - Both autoformat `LIST_RULES` get `query: (editor) => !inTableCell(editor)`.
  - CSS:
    - `.pe-rt-table { display: flex; flex-basis: 100%; flex-wrap: wrap; gap: 2px; align-items: center; margin-top: 1px; padding-top: 3px; border-top: 0.5px solid var(--rule-2); }`
    - `.pe-rt-table__label { margin: 0 2px 0 4px; font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }`
    - The text buttons are `.pe-rt-btn` at 11.5px.

- [ ] **Step 1: Write the failing tests**

```ts
// table-commands.test.ts (conversion editor; if Plate's merge-aware transforms need node ids, give
// createConversionEditor an optional { nodeId: true } second argument for these tests only; htmlToValue stays id-free)
const EMPTY_ROW = "<tr><td></td><td></td><td></td></tr>";
test("insertRichTable adds a 3×3 table with a header row, caret in the first header cell", () => {
  /* "<p>a</p>" caret end → `<p>a</p><table><thead><tr><th></th><th></th><th></th></tr></thead><tbody>${EMPTY_ROW}${EMPTY_ROW}</tbody></table>`;
     the selection is inside a "th" */ });
test.each([
  ["rowBelow", "<table><tbody><tr><td>x</td></tr><tr><td></td></tr></tbody></table>"],
  ["rowAbove", "<table><tbody><tr><td></td></tr><tr><td>x</td></tr></tbody></table>"],
  ["columnRight", "<table><tbody><tr><td>x</td><td></td></tr></tbody></table>"],
  ["columnLeft", "<table><tbody><tr><td></td><td>x</td></tr></tbody></table>"],
  ["toggleHeader", "<table><thead><tr><th>x</th></tr></thead></table>"],
])("%s on a one-cell table", (action, out) => { /* "<table><tbody><tr><td>x</td></tr></tbody></table>", caret in x → runTableAction → out */ });
test("row above does nothing in the header row; a new column follows each row's kind", () => {
  /* "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>" caret in h:
     rowAbove → unchanged; columnRight → '<table><thead><tr><th>h</th><th></th></tr></thead><tbody><tr><td>a</td><td></td></tr></tbody></table>';
     rowBelow from h → the new row is td cells, the header stays first */ });
test("deleting the last row or column deletes the table", () => { /* "<p>a</p><table>…one cell…</table>" deleteRow → "<p>a</p>" */ });
test("row and column edits keep a merged table rectangular", () => {
  /* '<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>', caret in b:
     for each of rowBelow, columnRight, deleteColumn: isTableRectangular(table) and the text a, b, c (where not deleted) is kept */ });

// toolbar.dom.test.tsx
// labels in order now: [..., "Numbered list", "Insert table", "More formatting"]
test("Insert table adds a table with a header row", async () => { /* "<p>a</p>" caret end → press Insert table → last emit is insertRichTable's HTML (table-commands.test.ts) */ });
test("the table bar shows only while the caret is in a table", async () => { /* group "Table" present in a cell, absent in a paragraph */ });
test("in a cell, style, lists, table and divider are off", async () => { /* select/buttons disabled; More formatting → Divider disabled */ });
test("Header row reflects and toggles the first row", async () => { /* caret in a th → Header row aria-pressed "true"; press → first row becomes td, aria-pressed "false" */ });
test("Tab in a cell moves to the next cell and nests no list", async () => { /* keydown Tab → selection in cell 2; HTML unchanged */ });
test("typing '- ' in a cell starts no list", async () => { /* insertText("- ") in an empty cell → the cell's HTML is "- " */ });
test("the canvas bubble has no table controls", async () => { /* canvas, selection in a cell → no "Insert table", no group "Table" */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text/rich`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the table commands, the table bar, the toolbar states, Tab and the autoformat query, and the CSS.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): insert tables and edit rows, columns and the header row from the toolbar`

---

### Task 9: Expand writing view

**Files:**
- Create: `packages/editor/src/blocks/text/expand.tsx`
- Modify: `packages/editor/src/blocks/text/inspector.tsx`, `packages/editor/src/components/editor-shell/inspector/insp-parts.tsx`, `packages/editor/src/blocks/text/rich/field.tsx`, `packages/editor/src/theme/editor.css`
- Test: `packages/editor/src/blocks/text/inspector.dom.test.tsx`, `blocks/text/wiring.test.tsx`

**Interfaces:**
- Consumes: `RichTextField`, `useMounted` (`lazy-field.ts`); `bodyPatch`, `bodyToHtml` (`body.ts`); `pageHistory` (Task 2).
- Produces:
  - `InspSection` gains `action?: ReactNode`. When it is set, the header gets the extra class `pe-insp-section__h--action` (`display: flex; justify-content: space-between; align-items: center;`) and the action renders after the label. The 33 other uses are unchanged.
  - `RichTextFieldProps.autoFocus?: boolean`, passed to `PlateContent`.
  - `expand.tsx`: `TextExpandView({ block, onClose, onPatch, onPageHistory }: { block: TextBlock; onClose: () => void; onPatch: PatchFn; onPageHistory?: (step: "undo" | "redo") => void })`.
    - It renders inline, not in a portal, so theme variables and dark mode reach it as they reach `.pe-confirm`: `<div className="pe-rt-expand"><div role="dialog" aria-modal="true" aria-label="Text" className="pe-rt-expand__panel">`.
    - The panel holds a header (the label `Text` in the `.pe-insp-section__h` style, plus a `Close` button) and `<RichTextField autoFocus variant="panel" label="Text" html={bodyToHtml(block.body)} onChange={bodyPatch(block, onPatch)} onPageHistory={onPageHistory} />` inside `Suspense`.
    - `Escape` on the panel closes it unless the event's default was prevented. The link input and both popovers prevent it.
    - A click on the scrim does nothing.
  - `inspector.tsx`: an inner component keyed on `block.id` holds `expanded`. The section action is `<button type="button" className="pe-rt-expand-btn" aria-haspopup="dialog" aria-expanded={expanded}><span aria-hidden="true">⤢</span> Expand</button>`. While `expanded`, the panel field is not mounted. Its place shows `<div className="pe-rt-field" aria-hidden="true" />`, so the panel does not jump, and `TextExpandView` renders. On close, the panel field mounts again and focus returns to the Expand button. The canvas field stays mounted throughout, which is one Plate instance per mounted surface.
  - CSS:
    - `.pe-rt-expand-btn` (mockup `.exp`): `font-size: 11px; letter-spacing: 0; text-transform: none; color: var(--ink-2); padding: 1px 6px; background: var(--paper-2); border: 0.5px solid var(--rule-2); border-radius: 5px; cursor: pointer;`
    - `.pe-rt-expand`: `position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgba(26, 24, 20, 0.22);`. This is `.pe-confirm`'s scrim without the blur, so the canvas shows live behind it.
    - `.pe-rt-expand__panel`: `display: flex; flex-direction: column; gap: 8px; width: min(720px, calc(100vw - 32px)); max-height: calc(100vh - 64px); padding: 12px; background: var(--paper); border: 0.5px solid var(--rule-2); border-radius: 8px; box-shadow: 0 24px 80px -32px rgba(26, 24, 20, 0.45);`
    - `.pe-rt-expand__hd`: flex, `justify-content: space-between`, `align-items: center`.
    - `.pe-rt-expand .pe-rt-field { min-height: min(60vh, 520px); max-height: calc(100vh - 170px); font-size: 14px; line-height: 1.6; }`, with `h2` at 18px and `h3` at 15px inside it.

- [ ] **Step 1: Write the failing tests**

```ts
// inspector.dom.test.tsx (real lazy field)
test("Expand opens the same text in a wide view and parks the panel field", async () => { /*
  press Expand → dialog "Text" contains .pe-rt-bar and the block's text; exactly one .pe-rt-field[contenteditable] in the document;
  the inspector's own section holds no contenteditable */ });
test("Close and Escape return to the panel, focus on Expand", async () => { /* both paths → no dialog; panel field back; document.activeElement is the Expand button */ });
test("Escape in a popover keeps the wide view open", async () => { /* open Text colour inside the dialog, Escape → popover gone, dialog still there */ });
test("the wide view closes when its block goes", async () => { /* re-render the inspector with another block (id differs) → no dialog; unmount → no dialog */ });
// wiring.test.tsx
test("the wide view's field edits the whole body, coalesced per block", () => {
  /* render TextExpandView with the mocked field → props { autoFocus: true, label: "Text", variant: "panel" }; onChange("<p>w</p>") → onPatch("body", "<p>w</p>", { coalesce: "a:body" }) */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `InspSection.action`, `autoFocus`, `TextExpandView`, the inspector changes and the CSS.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): Expand opens the rich text field in a wide writing view`

---

### Task 10: Notice when a paste drops images

**Files:**
- Modify: `packages/editor/src/blocks/text/rich/paste.ts`, `rich/paste-plugin.ts`, `rich/field.tsx`, `packages/editor/src/theme/editor.css`
- Test: `rich/paste.test.ts`, `rich/field.dom.test.tsx`, `rich/toolbar.dom.test.tsx` (one assertion)

**Interfaces:**
- Produces:
  - `paste.ts`: `pastedImageCount(html: string): number`, the number of `img` elements plus `v:imagedata` elements in the parsed clipboard HTML.
  - `RichPastePlugin` gains the option `imageNotices: number` (default 0). `insertData` increments it once per paste in which `pastedImageCount(html) > 0`, or in which `data.files` holds a file whose `type` starts with `image/`. The paste itself is unchanged.
  - `field.tsx`:
    - `PlateContent` and a status region sit in `<div className="pe-rt-wrap">` (`position: relative`).
    - The region is always present and empty: `<div role="status" className="pe-rt-notice">`.
    - When `usePluginOption(RichPastePlugin, "imageNotices")` increases, the region's text is exactly `Images aren't pasted into text — use an Image block.` for `NOTICE_MS = 6000` ms. A new notice restarts the timer, and unmounting clears it.
  - CSS:
    - `.pe-rt-notice { position: absolute; right: 8px; bottom: 8px; left: 8px; padding: 5px 8px; font-size: 11.5px; color: var(--pg-ink); background: var(--paper-2); border: 0.5px solid var(--rule-2); border-radius: 5px; pointer-events: none; }`
    - `.pe-rt-notice:empty { display: none; }`

- [ ] **Step 1: Write the failing tests**

```ts
// paste.test.ts
test.each([
  ['<p>a</p><img src="x.png"><p><img src="y.png"></p>', 2],
  [fixture("web-page"), 1],
  ["<p>no pictures</p>", 0],
])("pastedImageCount %#", (html, n) => expect(pastedImageCount(html)).toBe(n));
test("a paste that drops images counts one notice; text still pastes", () => { /* editor option imageNotices 0 → 1; HTML pasted without the image */ });
test("an image file on the clipboard counts a notice", () => { /* clipboard with files: [{ type: "image/png" }] and no html → imageNotices 1 */ });

// field.dom.test.tsx (fake timers)
test("a dropped image shows a notice for six seconds", async () => { /*
  role=status region exists and is empty; bump imageNotices via editor.setOption → text "Images aren't pasted into text — use an Image block.";
  advance(5999) → still there; advance(1) → empty */ });
test("a second dropped image restarts the notice", async () => { /* bump; advance(4000); bump; advance(4000) → still shown; advance(2000) → empty */ });

// toolbar.dom.test.tsx: in "toolbar exposes labelled controls in order", the editable is now inside the
// bar wrapper's next sibling: bar.parentElement.nextElementSibling.querySelector("[contenteditable]") is not null.
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/blocks/text/rich`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the count, the plugin option, the region and the CSS.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(editor): a paste that drops images says where images go`

---

### Task 11: Stage verification

**Files:** none new. Fixes go to whichever file a check points at.

- [ ] **Step 1: Lint** only the files this branch changed: `git diff --name-only --diff-filter=d $(git merge-base main HEAD)...HEAD -- '*.ts' '*.tsx' '*.css' '*.json' | xargs bun x ultracite fix`, then the same with `check`. Expected: no errors in those files.
- [ ] **Step 2: Types**: `bun run check-types --force` at the root. Expected: every package passes, none cached.
- [ ] **Step 3: Tests**:
  - `cd packages/editor && bun test ./src`
  - `cd packages/shared && bun run test`
  - `cd apps/web && bun run test src/app/styles.test.ts`
  - `cd apps/admin && bun test src/app/\(portal\)/_actions/pages-translation && bun test src/lib`

  Expected: PASS. The known `content-translation.test.ts` model-id failure is pre-existing, so record it rather than fix it.
- [ ] **Step 4: Builds and the bundle split**: `bun run build --filter=admin` and `bun run build --filter=web`. Both must compile. Then check:
  - `comm -12 <(grep -rl "richPaste" apps/web/.next/static/chunks | sort) <(grep -rl "type-display-sm break-words hyphens-auto" apps/web/.next/static/chunks | sort)` prints nothing.
  - `grep -rl "richPaste" apps/web/.next/static/chunks | wc -l` is at least 1.
  - `grep -rlE 'data-color=("|)accent' apps/web/.next/static/css | wc -l` is at least 1, so the public CSS carries the colour rules.

  Paste the commands and their outputs into the report.
- [ ] **Step 5: Spec note.** Append a "Stage 2 done (date)" section to the spec in plain language, with the same parts as Stage 1's note:
  - what was built;
  - every judgment call made while building, and its cost if wrong;
  - what was deferred;
  - owner hand checks. These include: a wide table on a phone scrolls inside itself while the page does not; coloured text on paper, deep and photo sections under BISO and one department theme; pasting a Word table on Mac (and on Windows if available); the Expand view's look; and Cmd+Z in a field right after a copilot change.

  Commit with `docs(editor): stage 2 notes`.

---

## After Stage 2 (scope reminder)

- **Stage 3:**
  - the copilot prompt and tools learn tables and `data-color` (`packages/editor/src/ai/prompt.ts`), and a client tool's errors reach the model
  - `templates.ts` `text()` in the new shape
  - a translation round-trip test with lists, a table and colour (`apps/admin/src/lib/page-document-translation.ts`)
  - the docs pages (`edit-a-page.mdx`, the developer pages)
  - the go-live checklist, including Markus's manual Word paste check on Mac and Windows
