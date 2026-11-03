# Rich Text Stage 1: One Editing Surface and Paste — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Rich text block's one-box-per-line editing with a single Plate.js surface, on the canvas and in the inspector, that stores sanitised HTML, keeps old pages working, and turns pasted Word, Google Docs, web and plain text into the right headings, lists and marks. This ends the reported paste bug.

**Architecture:** `TextBlock.body` becomes a sanitised HTML string; legacy arrays stay readable everywhere. All Plate code lives in `packages/editor/src/blocks/text/rich/` and is reachable only through `React.lazy`, so the public site never loads it. A pure serializer turns Plate's indent-list value into nested `<ul>/<ol>` HTML. A paste normaliser turns each clipboard dialect into plain semantic HTML before Plate's own HTML parser reads it.

**Tech Stack:** Plate.js 52.3.x (`platejs`, `@platejs/basic-nodes`, `@platejs/list`, `@platejs/indent`, `@platejs/link`, `@platejs/autoformat`, `@platejs/floating`), React 19, zustand + immer store, `sanitize-html` (server), happy-dom + `bun:test`.

**Spec:** `docs/superpowers/specs/2026-11-03-rich-text-editor-design.md` (read its "Rulings during planning" section first).

## Global Constraints

- Bun only (`bun@1.3.1`). New dependencies are pinned in the root `package.json` `catalog` and referenced as `"catalog:"`.
- Work only in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/rich-text-editor`. Never `git push`, never touch the main checkout's branch.
- Must pass: `bun run check-types` (repo root), `cd packages/editor && bun test ./src`, `bun x ultracite fix`.
- Both sanitisers stay in lockstep: client `lib/sanitize.ts` and server `editor/sanitize-doc.ts` read one shared allowlist module. No `style` and no `class` attribute survives either.
- Stage 1 body allowlist: `p, h2, h3, blockquote, ul, ol, li, hr, br, strong, b, em, i, u, s, a, span`; attributes `a[href]` (safe href only, existing `SAFE_HREF` rule) and `ol[start]` (1–4 digits, ≥ 2).
- The public renderer must not import the editor library: no file outside `blocks/text/rich/` may statically import `platejs`, `@platejs/*` or anything in `blocks/text/rich/`.
- Legacy `body: TextBodyItem[]` renders exactly as today (same markup, same classes).
- The editor chrome keeps its current look: paper tokens (`--paper-2`, `--rule-2`, `--ink-2`, `--pg-ink`), 0.5px rules, `.pe-seg`-style buttons. Chrome strings stay English.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014NDgSPSV8Z43ZEbDoPijNN
  ```

## Review Focus

1. **Both editors mounted for one block** (inspector + canvas): typing in one must update the other without moving the typist's cursor and without an update loop → Task 7 test `focused field ignores the echo of its own change; unfocused field takes it`.
2. **Selecting a different text block while the inspector field is open** must load that block's text, not keep the previous block's → Task 9 test `inspector shows the newly selected block's text`.
3. **Undo after typing a sentence** must revert the burst as one step, and a long session must not exhaust the 100-step history one keystroke at a time → Task 4 tests.
4. **Opening a page with legacy blocks must not save anything.** Mounting a field on legacy-derived HTML must emit no change, or every old page would autosave on open → Task 7 test `mounting emits nothing`.
5. **Hostile or junk paste** (scripts, iframes, images, inline styles, Word's `<o:p>` and conditional comments) must leave text only, with no unsafe markup and no stray bullet glyphs → Task 6 test `web fixture drops scripts, frames, images and styles`.

---

### Task 1: Dependencies and the Plate confinement guard

**Files:**
- Modify: `package.json` (root `catalog`)
- Modify: `packages/editor/package.json`
- Create: `packages/editor/src/blocks/text/rich-confinement.test.ts`

**Interfaces:**
- Produces: the dependency set later tasks import; the guard every later task must keep green.

- [ ] **Step 1: Write the failing guard test**

`rich-confinement.test.ts` walks every `.ts`/`.tsx` file under `packages/editor/src` (use `node:fs` `readdirSync` recursively), skipping `blocks/text/rich/**` and `*.test.ts(x)`, and asserts for each file:

```ts
const STATIC_PLATE = /^\s*import\s+(?!type\b)[^;]*?from\s+["'](?:platejs|@platejs\/[^"']+)(?:\/[^"']*)?["']/m;
const STATIC_RICH = /^\s*import\s+(?!type\b)[^;]*?from\s+["'](?:\.\/rich\/|@\/blocks\/text\/rich\/)[^"']*["']/m;
test("no file outside blocks/text/rich statically imports Plate or the rich editor", () => {
  const offenders = files.filter((f) => STATIC_PLATE.test(read(f)) || STATIC_RICH.test(read(f)));
  expect(offenders).toEqual([]);
});
test("the guard sees the rich folder's own Plate imports", () => {
  // Proves the regex works: at least one file inside rich/ matches STATIC_PLATE.
  expect(richFiles.some((f) => STATIC_PLATE.test(read(f)))).toBe(true);
});
```

- [ ] **Step 2: Run it**

Run: `cd packages/editor && bun test src/blocks/text/rich-confinement.test.ts`
Expected: the first test PASSES, the second FAILS (no `rich/` folder yet). Mark the second test `test.todo` until Task 5 creates the folder, then make it a plain `test` in Task 5.

- [ ] **Step 3: Add dependencies**

Root `catalog`: add `"@platejs/autoformat": "^52.3.10"` and `"@platejs/floating": "^52.3.10"` (keep the block alphabetical). `packages/editor/package.json` `dependencies`: add `platejs`, `@platejs/autoformat`, `@platejs/basic-nodes`, `@platejs/floating`, `@platejs/indent`, `@platejs/link`, `@platejs/list`, all `"catalog:"`. Run `bun install` at the worktree root.

- [ ] **Step 4: Verify**

Run: `bun install && cd packages/editor && bun test src/blocks/text/rich-confinement.test.ts && cd ../.. && bun run check-types --filter=@repo/editor`
Expected: install succeeds, test passes (1 pass, 1 todo), types pass.

- [ ] **Step 5: Commit** — `chore(editor): add Plate dependencies and confinement guard`

---

### Task 2: The new body shape and legacy conversion

**Files:**
- Modify: `packages/editor/src/editor/types.ts:81-85` (`TextBlock`)
- Create: `packages/editor/src/blocks/text/body.ts`
- Test: `packages/editor/src/blocks/text/body.test.ts`
- Modify: `packages/editor/src/editor/operations.ts:54-62` (`emptyBlock("text")`) and any test that reads `emptyBlock("text").body` as an array

**Interfaces:**
- Produces:
  - `TextBlock.body: string | TextBodyItem[]`, with a doc comment: string = sanitised body HTML (current shape); array = legacy, read-only, still rendered.
  - `isLegacyBody(body: unknown): body is TextBodyItem[]`, which is `Array.isArray(body)`.
  - `legacyBodyToHtml(items: TextBodyItem[]): string`
  - `bodyToHtml(body: unknown): string`: string → itself; array → `legacyBodyToHtml(listOf(body))`; anything else → `""`.

- [ ] **Step 1: Write the failing tests**

```ts
test("maps legacy item types to tags, grouping consecutive list items", () => {
  expect(legacyBodyToHtml([
    { type: "h", text: "Title" }, { type: "h3", text: "Sub" }, { type: "p", text: "A <b>b</b>" },
    { type: "li", text: "one" }, { type: "li", text: "two" }, { type: "p", text: "after" }, { type: "li", text: "three" },
  ])).toBe("<h2>Title</h2><h3>Sub</h3><p>A <b>b</b></p><ul><li>one</li><li>two</li></ul><p>after</p><ul><li>three</li></ul>");
});
test("an unknown item type is a paragraph", () => {
  expect(legacyBodyToHtml([{ type: "zz" as never, text: "x" }])).toBe("<p>x</p>");
});
test("bodyToHtml passes strings through and tolerates junk", () => {
  expect(bodyToHtml("<p>x</p>")).toBe("<p>x</p>");
  expect(bodyToHtml([{ type: "p", text: "x" }, null, "s"])).toBe("<p>x</p>");
  expect(bodyToHtml(undefined)).toBe("");
});
test("a new text block starts in the new shape", () => {
  expect(emptyBlock("text")).toMatchObject({
    body: "<h2>Section heading</h2><p>Tell the story like you'd tell a friend.</p>",
  });
});
```

- [ ] **Step 2: Run them** — `cd packages/editor && bun test src/blocks/text/body.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `body.ts` (use `knownKey` and `listOf` from `@/blocks/_v2/`), the `TextBlock` type change, and the `emptyBlock("text")` body string. Fix the compile errors the type change surfaces with `Array.isArray` narrowing. Do not change how legacy arrays are rendered or sanitised yet.

- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor` and `bun run check-types` at the root. Expected: all pass. Tests that asserted the old `emptyBlock("text")` array are updated to the string.

- [ ] **Step 5: Commit** — `feat(editor): text block body as HTML string, legacy arrays still readable`

---

### Task 3: One allowlist, two sanitisers

**Files:**
- Create: `packages/editor/src/lib/rich-allowlist.ts`
- Modify: `packages/editor/src/lib/sanitize.ts`
- Modify: `packages/editor/src/editor/sanitize-doc.ts` (move `DROPPED_WITH_CONTENT` out; text-block branch around line 215)
- Test: `packages/editor/src/lib/rich-allowlist.test.ts`

**Interfaces:**
- Produces:
  - `rich-allowlist.ts` (plain TS, no DOM, no `sanitize-html`): `INLINE_TAGS` (exactly today's `b, strong, i, em, a, br, span`), `BODY_TAGS` (INLINE_TAGS plus `p, h2, h3, blockquote, ul, ol, li, hr, u, s`), `DROPPED_WITH_CONTENT` (moved verbatim from `sanitize-doc.ts`), `SAFE_HREF` (moved from `sanitize.ts`), `OL_START = /^[1-9]\d{0,3}$/` (a start of 1 is dropped as redundant).
  - Client: `sanitizeRichBody(html: string): string`. It uses DOM walking like `sanitizeRichText`, but with `BODY_TAGS`. Elements in `DROPPED_WITH_CONTENT` are removed together with their content. Other disallowed tags are unwrapped. There is no `<br>` insertion for `div`/`p` (that rule stays inline-mode only). It keeps `a[href]` when `SAFE_HREF` passes, keeps `ol[start]` when `OL_START` passes and the value is ≥ 2, and removes every other attribute.
  - Server: `sanitizeRichBodyHtml(html: string): string`, the same policy in `sanitize-html` config.
  - `sanitizeDoc`'s text-block branch: a string `body` → `sanitizeRichBodyHtml(body)`; an array → today's `body.map(sanitizeBodyItem)` (unchanged).
  - `sanitizeRichText` / `sanitizeRichHtml` (inline, legacy items) keep their exact current behaviour.

- [ ] **Step 1: Write the failing lockstep test**

Compare both sanitisers on each input after normalising through `parseInert(x).innerHTML`, so `<br>` and `<br />` read the same. Run it under happy-dom, the same way `blocks/text/render.dom.test.tsx` sets up `document` and `Node`.

```ts
const CASES: [string, string][] = [
  ['<ul><li>a<ul><li>b</li></ul></li></ul>', '<ul><li>a<ul><li>b</li></ul></li></ul>'],
  ['<ol start="3"><li>a</li></ol>', '<ol start="3"><li>a</li></ol>'],
  ['<ol start="1"><li>a</li></ol>', '<ol><li>a</li></ol>'],
  ['<ol start="x"><li>a</li></ol>', '<ol><li>a</li></ol>'],
  ['<p style="color:red" class="x" id="y">t</p>', '<p>t</p>'],
  ['<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
  ['<a href="https://biso.no" target="_blank">x</a>', '<a href="https://biso.no">x</a>'],
  ['<script>alert(1)</script><style>p{}</style><p>ok</p>', '<p>ok</p>'],
  ['<h1>Big</h1><table><tr><td>c</td></tr></table>', 'Bigc'],
  ['<img src=x onerror=alert(1)><p>t</p>', '<p>t</p>'],
  ['<p><u>u</u> <s>s</s></p><hr><blockquote>q</blockquote>', '<p><u>u</u> <s>s</s></p><hr><blockquote>q</blockquote>'],
];
test.each(CASES)("client and server agree on %s", (input, expected) => {
  expect(norm(sanitizeRichBody(input))).toBe(norm(expected));
  expect(norm(sanitizeRichBodyHtml(input))).toBe(norm(expected));
});
test("inline sanitisers are unchanged for legacy items", () => {
  expect(sanitizeRichText("a<p>b</p>")).toBe("a<br>b");
});
test("sanitizeDoc cleans a string body and leaves legacy arrays on the old path", () => {
  // One doc with a string-body text block (gets <script> removed) and an array-body block (gets sanitizeBodyItem).
});
```

Write the last test's doc fixture and assertions with the helpers `sanitize-doc.test.ts` already uses.

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/lib/rich-allowlist.test.ts`. Expected: FAIL (exports missing).

- [ ] **Step 3: Implement** the allowlist module and both sanitisers, and switch `sanitize-doc.ts` and `sanitize.ts` to import the moved constants.

- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor`. Expected: all pass, including the existing `sanitize.test.ts`, `sanitize-doc*.test.ts` and `render*.test.tsx`, unchanged.

- [ ] **Step 5: Commit** — `feat(editor): shared rich-text allowlist with body sanitisers on client and server`

---

### Task 4: Coalesced history for continuous typing

**Files:**
- Modify: `packages/editor/src/blocks/types.ts:34` (`PatchFn`)
- Modify: `packages/editor/src/editor/store.ts` (state, `setProp` at ~430, `undo`, `redo`, `pushHistory` at ~253)
- Modify: `packages/editor/src/components/editor-shell/inspector/index.tsx:40-46`
- Modify: `packages/editor/src/components/editor-shell/canvas/sortable-block.tsx:46-49`
- Test: `packages/editor/src/editor/store-coalesce.test.ts`

**Interfaces:**
- Produces:
  - `export interface PatchOptions { coalesce?: string }` in `blocks/types.ts`.
  - `export type PatchFn = (path: string, value: unknown, options?: PatchOptions) => void`
  - Store: `setProp(id: string, path: string, value: unknown, options?: PatchOptions): void` and state `lastCoalesce: { key: string; at: number } | null`, plus `const COALESCE_MS = 1000`.
  - Rule: with `options.coalesce`, skip `pushHistory` when `lastCoalesce?.key === options.coalesce && Date.now() - lastCoalesce.at < COALESCE_MS`, then set `lastCoalesce = { key, at: Date.now() }`. `pushHistory`, `undo` and `redo` set `lastCoalesce = null`, so any other edit breaks a burst.
  - Both `onPatch` wrappers forward `options`. `store.setHeaderProp` is still passed where a `PatchFn` is expected and ignores the third argument.

- [ ] **Step 1: Write the failing tests** (use `setSystemTime` from `bun:test`; reset the store between tests the way `store-tree.test.ts` does)

```ts
test("a burst of coalesced edits is one undo step", () => {
  setProp("b1", "body", "<p>a</p>", { coalesce: "b1:body" });
  setProp("b1", "body", "<p>ab</p>", { coalesce: "b1:body" });
  setProp("b1", "body", "<p>abc</p>", { coalesce: "b1:body" });
  expect(past.length).toBe(1);
  undo();
  expect(bodyOf("b1")).toBe(original);
});
test("a pause longer than 1000 ms starts a new step", () => { /* advance setSystemTime by 1001 ms between edits → past.length 2 */ });
test("another edit in between breaks the burst", () => { /* coalesced, plain setProp, coalesced → past.length 3 */ });
test("undo then typing starts a new step", () => { /* coalesced, undo, coalesced → past.length 1, future cleared */ });
test("different keys do not coalesce", () => { /* "b1:body" then "b2:body" → past.length 2 */ });
```

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/editor/store-coalesce.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the store and type changes, and forward `options` in both wrappers.
- [ ] **Step 4: Run** — `bun test ./src` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): coalesce continuous edits into one undo step`

---

### Task 5: Plate value ↔ HTML

**Files:**
- Create: `packages/editor/src/blocks/text/rich/plugins.ts`
- Create: `packages/editor/src/blocks/text/rich/list-item-parse.ts`
- Create: `packages/editor/src/blocks/text/rich/html.ts`
- Test: `packages/editor/src/blocks/text/rich/html.test.ts`
- Modify: `rich-confinement.test.ts` (turn the `todo` into a real test)

**Interfaces:**
- Consumes: `sanitizeRichBody` (Task 3), `SAFE_HREF` (Task 3), `legacyBodyToHtml` (Task 2).
- Produces:
  - `richBasePlugins`: the non-React plugin list. `BaseH2Plugin`, `BaseH3Plugin`, `BaseBlockquotePlugin`, `BaseHorizontalRulePlugin` and `BaseBoldPlugin`/`BaseItalicPlugin`/`BaseUnderlinePlugin`/`BaseStrikethroughPlugin` come from `@platejs/basic-nodes`. It also has `BaseLinkPlugin` (`@platejs/link`), `BaseIndentPlugin` (`@platejs/indent`, injected into `p`, `h2`, `h3`, `blockquote`), and `BaseListPlugin` (`@platejs/list`, same targets) extended so its `LI` HTML parse calls `parseListItem`. The paragraph is core's default. There is no h1/h4–h6 plugin.
  - `parseListItem(li: HTMLElement): { indent: number; listStyleType: "disc" | "decimal"; listRestartPolite?: number; type: "p" }`
    - `indent`: `aria-level`, else `data-indent`, else the count of `UL`/`OL` ancestors; minimum 1.
    - `listStyleType`: `data-list-style-type` (`"decimal"` stays, anything else becomes `"disc"`), else `"decimal"` when the closest `UL`/`OL` ancestor is `OL`, else `"disc"`.
    - `listRestartPolite`: set only when `li` is the first `LI` child of an `OL` whose `start` passes `OL_START` and is ≥ 2. Plate's normaliser then sets `listStart` from it (verified in `@platejs/list`: `getListExpectedListStart` honours `listRestartPolite` when there is no previous list).
  - `createConversionEditor(extraPlugins?: AnyPlugin[]): SlateEditor`, which is `createSlateEditor({ plugins: [...richBasePlugins, ...extra] })`.
  - `htmlToValue(html: string): Value`. Steps: `sanitizeRichBody`, then `deserializeHtml(editor, { element })`, then `editor.tf.setValue`, then `editor.tf.normalize({ force: true })`, then return `editor.children`. It never returns `[]`; empty input gives `[{ type: "p", children: [{ text: "" }] }]`.
  - `valueToHtml(value: Value): string`. A pure serializer that imports only types from Plate.

**Serializer rules (`valueToHtml`):**
- Blocks: `p`→`<p>`, `h2`, `h3`, `blockquote`, `hr`→`<hr>`. Any other element type is serialized as `<p>` with its inline content.
- Empty blocks (no text after trimming, and not `hr`) are dropped. An all-empty value returns `""`.
- Inline: escape `&`, `<`, `>` in text (and `"` in attributes). A `\n` in text becomes `<br>`. Marks nest in the fixed order `strong` > `em` > `u` > `s` (outermost first). A link element `{ type: "a", url }` becomes `<a href="…">` when `SAFE_HREF` passes, and is unwrapped otherwise. Adjacent leaves are emitted as-is; there is no mark merging.
- Lists (indent model to nested HTML). This is the algorithm the tests pin:
  ```
  stack = []                      // entries { tag: "ul"|"ol", indent }
  for node in value:
    if node.listStyleType:
      tag = ordered(node.listStyleType) ? "ol" : "ul"      // decimal, lower/upper-alpha, lower/upper-roman → ol
      level = node.indent ?? 1
      while stack.top && stack.top.indent > level: emit "</li></" + pop().tag + ">"
      if stack.top && stack.top.indent === level && stack.top.tag !== tag: emit "</li></" + pop().tag + ">"
      if stack.top && stack.top.indent === level: emit "</li><li>"
      else: emit "<" + tag + (tag === "ol" && node.listStart > 1 ? ` start="${node.listStart}"` : "") + "><li>"; push {tag, indent: level}
      emit inline(node)           // a heading or quote inside a list loses its block type
    else:
      close every open list, then emit the block
  close every open list at the end
  ```
  Close every open list = `while (stack.length) emit "</li></" + pop().tag + ">"`.
  Unlike other blocks, an empty list item is kept, as `<li></li>`.

- [ ] **Step 1: Write the failing tests** (happy-dom as in Task 3)

```ts
const ROUND_TRIP = [
  "<h2>A</h2><p>B <strong>c</strong> <em>d</em> <u>e</u> <s>f</s></p>",
  "<p><strong><em>both</em></strong></p>",
  "<ul><li>a</li><li>b<ul><li>c</li></ul></li><li>d</li></ul>",
  "<ol><li>a</li></ol><p>x</p><ol start=\"2\"><li>b</li><li>c</li></ol>",
  "<ul><li>a</li></ul><ol><li>b</li></ol>",
  "<blockquote>q</blockquote><hr>",
  "<p>line<br>break</p>",
  "<p><a href=\"https://biso.no\">biso</a></p>",
  "<p>a &lt; b &amp; c</p>",
];
test.each(ROUND_TRIP)("round-trips %s", (html) => expect(valueToHtml(htmlToValue(html))).toBe(html));
test("legacy bodies convert to canonical HTML", () => {
  const legacy = [{ type: "h", text: "T" }, { type: "li", text: "one" }, { type: "li", text: "<b>two</b>" }] as const;
  expect(valueToHtml(htmlToValue(legacyBodyToHtml([...legacy])))).toBe("<h2>T</h2><ul><li>one</li><li><strong>two</strong></li></ul>");
});
test("empty paragraphs are dropped; nothing is the empty string", () => {
  expect(valueToHtml(htmlToValue("<p></p><p>x</p><p> </p>"))).toBe("<p>x</p>");
  expect(valueToHtml(htmlToValue(""))).toBe("");
  expect(htmlToValue("")).toEqual([{ type: "p", children: [{ text: "" }] }]);
});
test("unsafe links lose the link, keep the text", () => {
  expect(valueToHtml(htmlToValue('<p><a href="javascript:x">t</a></p>'))).toBe("<p>t</p>");
});
test("aria-level drives nesting (Google Docs / Word on the web)", () => {
  expect(valueToHtml(htmlToValue('<ul><li aria-level="1">a</li></ul><ul><li aria-level="2">b</li></ul>')))
    .toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
});
```

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/blocks/text/rich/html.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three files. Check each Plate export name against `node_modules/@platejs/*/dist/index.d.ts`. These were verified present: `BaseH2Plugin`, `BaseH3Plugin`, `BaseBlockquotePlugin`, `BaseHorizontalRulePlugin`, `BaseBoldPlugin`, `BaseItalicPlugin`, `BaseUnderlinePlugin`, `BaseStrikethroughPlugin`, `BaseLinkPlugin`, `BaseIndentPlugin`, `BaseListPlugin`, `createSlateEditor`, `deserializeHtml`. Make the confinement guard's `todo` a real test.
- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor`. Expected: PASS, including both guard tests.
- [ ] **Step 5: Commit** — `feat(editor): Plate value and HTML conversion for rich text`

---

### Task 6: Paste normaliser, plain text, and the paste plugin

**Files:**
- Create: `packages/editor/src/blocks/text/rich/paste.ts`
- Create: `packages/editor/src/blocks/text/rich/paste-plugin.ts`
- Create: `packages/editor/src/blocks/text/rich/fixtures/{word-desktop,google-docs,word-web,web-page}.html`
- Test: `packages/editor/src/blocks/text/rich/paste.test.ts`

**Interfaces:**
- Consumes: `createConversionEditor`, `valueToHtml`, `htmlToValue` (Task 5); `parseInert` (`lib/sanitize.ts`).
- Produces:
  - `normalizePastedHtml(html: string): string`. It is DOM-based on `parseInert` and runs these steps in order:
    1. Remove comment nodes and the elements `o:p`, `style`, `meta`, `link`, `title`, `xml`, `script`.
    2. Unwrap `b[id^="docs-internal-guid"]`.
    3. `p.MsoTitle` becomes `h1`.
    4. Convert Word list runs (below).
    5. Unwrap a `p` that is the direct child of an `li`.
    6. Shift headings relatively: the smallest heading level present becomes `h2`, and every larger level becomes `h3`.
    7. Return `innerHTML`.
  - Word list runs. A run is a sequence of adjacent element siblings (whitespace text between them is ignored) whose `style` attribute matches `/mso-list:\s*(l\d+)\s+level(\d+)/`. For each paragraph, the marker is the text of its first `span[style*="mso-list:Ignore"]`, which is then removed. It is an ordered marker when it matches `/^\(?(\d+|[a-z]{1,3})[.)]/i`. Build nested `<ul>`/`<ol>` with the same stack algorithm as Task 5's serializer, keyed by `level`. An ordered list opened with a numeric marker n ≥ 2 gets `start="n"`. Replace the run with the built list.
  - `plainTextToHtml(text: string): string`. Normalise `\r\n` to `\n`. Split into chunks on blank lines. A chunk whose every line matches `/^\s*[-*•]\s+/` becomes `<ul>`, and one whose every line matches `/^\s*\d+[.)]\s+/` becomes `<ol>`, with the marker stripped and one `<li>` per line. Any other chunk becomes one `<p>` with `<br>` between its lines. Text is HTML-escaped.
  - `RichPastePlugin` (`createSlatePlugin({ key: "richPaste" }).overrideEditor(...)`) wraps `insertData(data)`:
    - If `data.types` includes `application/x-slate-fragment`, call the original unchanged.
    - Else if `text/html` is present, call the original with a `DataTransfer` adapter whose `getData("text/html")` returns `normalizePastedHtml(html)`.
    - Else if `text/plain` is present, call the original with an adapter whose `types` include `text/html` and whose `getData("text/html")` returns `plainTextToHtml(text)`.
    - Every other `getData`, `types` and `files` passes through.

**Fixtures.** Write each from published examples of that source's clipboard HTML. Each one is the same reference document, and each must contain the listed markers:
- `word-desktop.html`: a full Word HTML document with `xmlns:o`, `<style>` holding `@list l0:level1` rules, and `<!--[if !supportLists]-->` around `<span style='mso-list:Ignore'>`. The heading is `<h1>`, the subheading `<h2>`, the list paragraphs `class=MsoListParagraphCxSpFirst/Middle/Last style='mso-list:l0 level1 lfo1'` (with `level2` for the nested item), and `<o:p></o:p>` appears. One span carries `font-family:Calibri`, one `color:#C00000`. The numbered list's second run starts with marker `2.` after a normal paragraph.
- `google-docs.html`: `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-…">`, marks as spans with `font-weight:700`, `font-style:italic` and `text-decoration:underline`, `<li aria-level="1" dir="ltr"><p role="presentation">`, a nested list via `aria-level="2"`, and `<ol start="2">` for the resumed list.
- `word-web.html`: Word on the web markup, with `div.OutlineElement`, `p.Paragraph`, `span.TextRun`/`span.NormalTextRun`, one `<ul>` per list item with `<li aria-level="1">`/`"2"`, and `<ol start="2">` for the resumed list.
- `web-page.html`: semantic `h1`/`h2`, nested `ul`, `ol` plus a second `<ol start="2">`, `strong`, `em`, `u`, and `a`. It also contains `<img src="x.png">`, `<script>alert(1)</script>`, `<iframe src="https://example.com"></iframe>`, and `style=`/`class=` on several elements.

Reference document, as it must come out:

```ts
const EXPECTED =
  '<h2>Campus Management</h2>' +
  '<p>Made up of student leaders who take on <strong>responsibility</strong> for the student experience.</p>' +
  '<h3>Core responsibilities</h3>' +
  '<ul><li>Sustainability and academic development</li><li>Student welfare<ul><li>Mental health</li></ul></li><li>Finance</li></ul>' +
  '<ol><li>Plan the semester</li></ol>' +
  '<p>Then, once the plan is approved:</p>' +
  '<ol start="2"><li>Run the events</li></ol>' +
  '<p>Read the <em>full</em> <u>handbook</u> at <a href="https://biso.no">biso.no</a>.</p>';
```

- [ ] **Step 1: Write the failing tests.** `pasteInto(html: string | null, plain?: string, startHtml = "")` builds `createConversionEditor([RichPastePlugin])`, sets the value from `htmlToValue(startHtml)`, puts the selection at the end, calls `editor.tf.insertData(fake)`, and returns `valueToHtml(editor.children)`. `fake` is a minimal object with `types`, `getData` and an empty `files`.

```ts
test.each(["word-desktop", "google-docs", "word-web", "web-page"])("%s pastes as the reference document", (name) => {
  expect(pasteInto(fixture(name))).toBe(EXPECTED);
});
test("the reported bug: a pasted three-item list into an empty list item gives three items", () => {
  expect(pasteInto("<ul><li>A</li><li>B</li><li>C</li></ul>", undefined, "<ul><li></li></ul>"))
    .toBe("<ul><li>A</li><li>B</li><li>C</li></ul>");
});
test("web fixture drops scripts, frames, images and styles", () => {
  const out = pasteInto(fixture("web-page"));
  for (const bad of ["<script", "<iframe", "<img", "style=", "class=", "alert"]) expect(out).not.toContain(bad);
});
test("no Word bullet glyphs survive", () => {
  expect(pasteInto(fixture("word-desktop"))).not.toMatch(/[·§]|&nbsp;/);
});
test.each([
  ["- a\n- b", "<ul><li>a</li><li>b</li></ul>"],
  ["• a\n* b", "<ul><li>a</li><li>b</li></ul>"],
  ["1. a\n2) b", "<ol><li>a</li><li>b</li></ol>"],
  ["p1\n\np2", "<p>p1</p><p>p2</p>"],
  ["line1\r\nline2", "<p>line1<br>line2</p>"],
  ["a < b", "<p>a &lt; b</p>"],
])("plain text %p", (plain, html) => expect(pasteInto(null, plain)).toBe(html));
test.each([
  ["<h2>A</h2><h3>B</h3>", "<h2>A</h2><h3>B</h3>"],
  ["<h1>A</h1><h2>B</h2><h4>C</h4>", "<h2>A</h2><h3>B</h3><h3>C</h3>"],
  ["<h3>A</h3>", "<h2>A</h2>"],
])("relative heading shift %s", (input, out) => expect(normalizePastedHtml(input)).toBe(out));
test("an in-editor copy (slate fragment) bypasses the normaliser", () => {
  // fake with types ["application/x-slate-fragment", "text/html"]; spy on normalizePastedHtml via a module-level counter export or by
  // pasting HTML that the normaliser would change (an <h3> alone) and asserting the slate fragment content was inserted instead.
});
```

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/blocks/text/rich/paste.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `paste.ts`, `paste-plugin.ts`, and the four fixtures. If a fixture disagrees with `EXPECTED` because of a real dialect difference, fix the normaliser, not the expectation. If pasting into an empty block keeps that block's type, so the pasted `h2` lands as a `p`, then `RichPastePlugin` must replace an empty current block with the fragment's first block. The reference test pins this.
- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): normalise Word, Google Docs, web and plain-text paste`

---

### Task 7: The editing field component

**Files:**
- Create: `packages/editor/src/blocks/text/rich/react-plugins.tsx`
- Create: `packages/editor/src/blocks/text/render-classes.ts`
- Create: `packages/editor/src/blocks/text/rich/sync.ts`
- Create: `packages/editor/src/blocks/text/rich/field.tsx` (default export, for `lazy`)
- Test: `packages/editor/src/blocks/text/rich/sync.test.ts`, `packages/editor/src/blocks/text/rich/field.dom.test.tsx`

**Interfaces:**
- Consumes: `richBasePlugins`, `htmlToValue`, `valueToHtml` (Task 5); `RichPastePlugin` (Task 6).
- Produces:
  - `richReactPlugins`: mirrors `richBasePlugins` one-for-one with the `/react` exports, plus `RichPastePlugin`. Elements render plain tags via small components (`h2`, `h3`, `p`, `blockquote`, `hr`, and `a` with `href`). The list `render.belowNodes` wraps each list node in `<ul>`/`<ol start={listStart}>` + `<li>`, as `packages/ui/components/ui/block-list.tsx` does, but with no classes. Marks have shortcuts `mod+b`, `mod+i`, `mod+u`. `AutoformatPlugin` (`@platejs/autoformat`) turns `- ` or `* ` at the start of a block into a disc list, and `1. ` or `1) ` into a decimal list. (Task 8 adds the Tab handler.)
  - `packages/editor/src/blocks/text/render-classes.ts`: `export const RICH_CLASS`, the exact string given in Task 9's Interfaces. It is created here because the canvas variant needs it; Task 9 consumes it.
  - `sync.ts`:
    - `htmlToEmit(value: Value, lastHtml: string): string | null` returns `valueToHtml(value)`, or `null` when that equals `lastHtml`.
    - `shouldTakeProp(propCanonical: string, lastHtml: string, focused: boolean): boolean`, which is `propCanonical !== lastHtml && !focused`. The caller canonicalises the prop first, as `valueToHtml(htmlToValue(prop))`, so a legacy prop is compared in canonical form.
  - `export interface RichTextFieldProps { html: string; onChange: (html: string) => void; variant: "panel" | "canvas"; label: string; editorRef?: { current: unknown } }`
  - `export default function RichTextField(props: RichTextFieldProps)`:
    - `usePlateEditor({ plugins: richReactPlugins, value: htmlToValue(html) })`. `lastHtml` is a ref, initialised to `valueToHtml(htmlToValue(html))`, so mounting a legacy body emits nothing.
    - `onChange` calls `htmlToEmit` and, when it returns a value, sets `lastHtml` and calls `props.onChange`.
    - An effect on `html` canonicalises the prop. When `shouldTakeProp` is true, it sets `lastHtml` to the canonical value **first**, then calls `editor.tf.setValue(htmlToValue(html))`. Because `lastHtml` is already updated, the `onChange` that `setValue` triggers emits nothing.
    - `PlateContent` gets `aria-label={label}`. The `canvas` variant has `data-rich-edit="1"` and `className={RICH_CLASS}`; the `panel` variant has `className="pe-rt-field"`.
    - `editorRef.current = editor` when given (tests only).

- [ ] **Step 1: Write the failing tests**

```ts
// sync.test.ts
test("no emit when the HTML did not change", () => expect(htmlToEmit(htmlToValue("<p>a</p>"), "<p>a</p>")).toBeNull());
test("emit when it did", () => expect(htmlToEmit(htmlToValue("<p>ab</p>"), "<p>a</p>")).toBe("<p>ab</p>"));
test("a focused field never takes the prop", () => expect(shouldTakeProp("<p>b</p>", "<p>a</p>", true)).toBe(false));
test("an unfocused field takes a different prop", () => expect(shouldTakeProp("<p>b</p>", "<p>a</p>", false)).toBe(true));
test("its own echo is ignored", () => expect(shouldTakeProp("<p>a</p>", "<p>a</p>", false)).toBe(false));
// field.dom.test.tsx also covers: a legacy prop ("<p>A <b>b</b></p>") re-rendered unchanged triggers no setValue and no emit.

// field.dom.test.tsx — happy-dom window + createRoot/act as in components/editor-shell/shell-saves.dom.test.tsx
test("renders the stored HTML as editable content", async () => { /* mount html="<h2>T</h2><ul><li>x</li></ul>" → host contains an h2 "T" and an li "x" */ });
test("mounting emits nothing", async () => { /* mount legacyBodyToHtml(...) with onChange spy → 0 calls after act */ });
test("typing emits the new HTML", async () => { /* act(() => editor.tf.insertText("!")) via editorRef → onChange called once with "<p>a!</p>" */ });
test("focused field ignores the echo of its own change; unfocused field takes it", async () => {
  // mount two fields A and B on "<p>a</p>"; type in A (editorRef) and re-render both with A's emitted html:
  // A's selection is unchanged (editor.selection deep-equals before), B's DOM shows "a!".
});
test("autoformat: '- ' starts a bullet list", async () => { /* insertText("- ") in an empty paragraph → onChange "<ul><li></li></ul>" */ });
```

If Plate cannot be focused in happy-dom, drive `focused` through a `ReactEditor`-free stub, `editor.api.isFocused = () => true`, and say so in a comment.

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/blocks/text/rich/`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `react-plugins.tsx`, `sync.ts` and `field.tsx`.
- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): rich text editing field on Plate`

---

### Task 8: Toolbar, link editor and canvas bubble

**Files:**
- Create: `packages/editor/src/blocks/text/rich/commands.ts`
- Create: `packages/editor/src/blocks/text/rich/toolbar.tsx`
- Create: `packages/editor/src/blocks/text/rich/bubble.tsx`
- Modify: `packages/editor/src/blocks/text/rich/field.tsx` (panel: toolbar above the field; canvas: bubble)
- Modify: `packages/editor/src/blocks/text/rich/react-plugins.tsx` (a key handler: Tab / Shift+Tab call `handleListTab` and `preventDefault` when it returns `true`; `mod+k` opens the link input)
- Modify: `packages/editor/src/theme/editor.css` (append a `/* === Rich text field === */` section)
- Test: `packages/editor/src/blocks/text/rich/commands.test.ts`, `packages/editor/src/blocks/text/rich/toolbar.dom.test.tsx`

**Interfaces:**
- Consumes: `createConversionEditor`, `htmlToValue`, `valueToHtml`; `SAFE_HREF`.
- Produces (`commands.ts`, all `(editor: SlateEditor, …)`):
  - `type RichStyle = "h2" | "h3" | "p" | "blockquote"` and `STYLE_LABELS: Record<RichStyle, string>` = `{ h2: "Heading", h3: "Subheading", p: "Paragraph", blockquote: "Quote" }`.
  - `currentStyle(editor): RichStyle` (the block at the selection; unknown types read as `"p"`) and `setStyle(editor, style: RichStyle): void`, which changes the block type and keeps list props.
  - `type RichMark = "bold" | "italic" | "underline" | "strikethrough"`, with `isMarkActive(editor, mark): boolean` and `toggleRichMark(editor, mark): void`.
  - `activeList(editor): "disc" | "decimal" | null` and `toggleRichList(editor, kind: "disc" | "decimal"): void`, which uses `toggleList` from `@platejs/list`.
  - `handleListTab(editor, opts: { shift: boolean }): boolean` uses `indentList`/`outdentList` and returns `false` outside a list.
  - `normalizeHref(input: string): string | null`. Trim the input. Prefix `https://` when it has no scheme and looks like a domain (`/^[\w-]+(\.[\w-]+)+(\/\S*)?$/`). Return `null` unless the result passes `SAFE_HREF`.
  - `applyLink(editor, url: string | null): void` uses `upsertLink` with the normalized URL, or `unwrapLink` when the URL is `null`.
  - `toolbar.tsx`: `export function RichToolbar({ editor, tone }: { editor: PlateEditor; tone: "paper" | "ink" })`. The items, in order:
    - a `<select aria-label="Text style">` over `STYLE_LABELS`
    - separator
    - Bold, Italic and Underline buttons (`aria-label` and `aria-pressed`)
    - a Link button (`aria-label="Link"`, which opens an inline URL input with Apply / Remove; `mod+k` opens it too)
    - separator
    - Bullet list and Numbered list buttons (`aria-pressed`)

    Buttons call `preventDefault` on `onMouseDown`, so the editor keeps its selection.
  - `bubble.tsx`: `export function RichBubble({ editor })`, built on `useFloatingToolbarState` / `useFloatingToolbar` (`@platejs/floating`). It shows `<RichToolbar tone="ink">` above an expanded selection while the editor is focused, and is hidden otherwise.
  - CSS (values from the mockup `docs/superpowers/specs/2026-11-03-rich-text-editor/mockups.html`, option A):
    - `.pe-rt-bar`: flex, wrap, gap 2px, padding 3px, `var(--paper-2)` background, `0.5px solid var(--rule-2)` border with no bottom border, radius `6px 6px 0 0`.
    - `.pe-rt-btn`: min 22×22px, font-size 12px, `var(--ink-2)`. When pressed (`[aria-pressed="true"]`): white background, `box-shadow: 0 0 0 0.5px var(--rule-2)`, `var(--pg-ink)`.
    - `.pe-rt-sep`: 0.5px × 16px, `var(--rule-2)`.
    - `.pe-rt-select`: 22px tall, 11.5px text, white background.
    - `.pe-rt-field`: white, `0.5px solid var(--rule-2)` border, radius `0 0 6px 6px`, padding `10px 12px`, min-height 230px, max-height 480px with `overflow:auto`, 12.5px/1.5 text in `var(--ink-2)`. Inside it: `h2` 15px/600 and `h3` 13px/600, both `var(--pg-ink)`; `ul`/`ol` padding-left 18px; `blockquote` with a `2px solid var(--rule-2)` left border and padding-left 8px; `a` in `var(--sky)`, underlined.
    - `.pe-rt-bubble`: `var(--pg-ink)` background, radius 7px, padding 3px, `0 6px 18px rgba(0,0,0,.18)` shadow, button text `var(--paper-2)`. Pressed buttons use a `var(--ink-2)` background.

- [ ] **Step 1: Write the failing tests**

```ts
// commands.test.ts (conversion editor, selection set with editor.tf.select)
test("setStyle turns a paragraph into a heading", () => { /* "<p>a</p>" + setStyle("h2") → "<h2>a</h2>" */ });
test("toggleRichList wraps and unwraps", () => { /* "<p>a</p><p>b</p>" select both → disc → "<ul><li>a</li><li>b</li></ul>" → disc again → "<p>a</p><p>b</p>" */ });
test("Tab nests and Shift+Tab un-nests", () => { /* "<ul><li>a</li><li>b</li></ul>" select b → handleListTab({shift:false}) → "<ul><li>a<ul><li>b</li></ul></li></ul>"; shift → back */ });
test("Tab outside a list does nothing", () => { /* "<p>a</p>" → false, unchanged */ });
test.each([
  ["biso.no", "https://biso.no"], ["https://biso.no/x", "https://biso.no/x"], ["mailto:it@biso.no", "mailto:it@biso.no"],
  ["/events", "/events"], ["javascript:alert(1)", null], ["", null],
])("normalizeHref(%p)", (input, out) => expect(normalizeHref(input)).toBe(out));
test("applyLink links the selection and null removes it", () => { /* "<p>biso</p>" select all → applyLink("biso.no") → '<p><a href="https://biso.no">biso</a></p>' → applyLink(null) → "<p>biso</p>" */ });

// toolbar.dom.test.tsx
test("toolbar exposes labelled controls in order", () => { /* labels: Text style, Bold, Italic, Underline, Link, Bullet list, Numbered list */ });
test("Bold reflects and toggles the mark", async () => { /* select "a" in "<p><strong>a</strong></p>" → Bold aria-pressed="true"; click → "<p>a</p>" */ });
```

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/blocks/text/rich/`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `commands.ts`, `toolbar.tsx`, `bubble.tsx` and the CSS, and wire them into `field.tsx`: the panel gets `<RichToolbar tone="paper">` above `PlateContent`, and the canvas gets `<RichBubble>`.
- [ ] **Step 4: Run** — `bun test ./src` in `packages/editor` and root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): rich text toolbar, link editor and selection bubble`

---

### Task 9: Wire the block (render, inspector, lazy loading, public styles)

**Files:**
- Modify: `packages/editor/src/blocks/text/render.tsx`
- Modify: `packages/editor/src/blocks/text/inspector.tsx`
- Modify: `packages/editor/src/blocks/text/index.tsx` (description `"Headings, paragraphs, lists"`; `aiHint` unchanged until Stage 3)
- Modify: `packages/ui/styles/globals.css` (the `@layer components` groups at ~341, ~384, ~406, ~414)
- Test: `packages/editor/src/blocks/text/render.test.tsx`, `render.dom.test.tsx` (extend), `packages/editor/src/blocks/text/inspector.dom.test.tsx` (new)

**Interfaces:**
- Consumes: `bodyToHtml`, `isLegacyBody` (Task 2); `sanitizeRichBody` (Task 3); `PatchOptions` (Task 4); `RichTextField` default export and `RICH_CLASS` (Task 7).
- Produces:
  - `RICH_CLASS`, the value Task 7's `render-classes.ts` holds. The classes are `"pg-rich max-w-(--measure) text-ink [&>*+*]:mt-4 [&>ul+ul]:mt-2 [&>ol+ol]:mt-2 [&_:is(h2,h3)]:break-words [&_:is(h2,h3)]:hyphens-auto [&_:is(p,li,blockquote)]:[overflow-wrap:anywhere]"` plus `" [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ol]:list-decimal [&_:is(ul,ol)]:space-y-2 [&_:is(ul,ol)]:pl-5 [&_li]:marker:text-ink-accent [&_li>:is(ul,ol)]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-ink-accent [&_blockquote]:pl-4 [&_hr]:border-current [&_hr]:opacity-20"`. Margins are used instead of a flex gap so that Plate's one-`<ul>`-per-item markup on the canvas spaces like a single list.
  - `globals.css`: add `.pg-rich > h2` to both `.type-display-sm` selector lists, `.pg-rich > h3` to `.type-heading-card`, and `.pg-rich :is(p, li, blockquote)` to `.type-body`. Do not change any declaration.
  - `render.tsx`. `TextRender` keeps today's code for legacy bodies, moved unchanged into `LegacyBody`.
    - **View mode, string body:** return `null` when `isBlankHtml(body)` is true. Otherwise render `<div className={RICH_CLASS} dangerouslySetInnerHTML={{ __html }} />`, where `__html` is `sanitizeRichBody(body)` inside the editor (`useInEditor()` and a `document`), else `body`. Memoize it on the string, as today.
    - **Edit mode, any shape:** render `<Suspense fallback={<static view of bodyToHtml(body)>}>` around `<RichTextField variant="canvas" label="Rich text" html={bodyToHtml(block.body)} onChange={(h) => onPatch("body", h, { coalesce: `${block.id}:body` })} />`. `RichTextField` is `lazy(() => import("./rich/field"))`.
  - `inspector.tsx`: `<InspSection label="Text">` holding `<Suspense fallback={<div className="pe-rt-field" />}>` around `<RichTextField key={block.id} variant="panel" label="Text" html={bodyToHtml(block.body)} onChange={(h) => onPatch("body", h, { coalesce: `${block.id}:body` })} />`. It uses the same `lazy` import. `ItemList`, `Segmented` and `TYPE_LABELS` are removed from this file.

- [ ] **Step 1: Write the failing tests**

```ts
// render.test.tsx — every existing legacy test stays and must pass unchanged (this is the "renders identically" proof).
test("a string body renders its HTML inside the rich wrapper", () => {
  const html = renderToStaticMarkup(<TextRender block={{ id: "t", type: "text", body: "<h2>T</h2><ul><li>x</li></ul>" }} edit={false} onPatch={noop} />);
  expect(html).toBe(`<div class="${RICH_CLASS}"><h2>T</h2><ul><li>x</li></ul></div>`);
});
test("a blank string body renders nothing on the site", () => {
  expect(renderToStaticMarkup(<TextRender block={{ id: "t", type: "text", body: "<p> </p>" }} edit={false} onPatch={noop} />)).toBe("");
});
// render.dom.test.tsx — in the editor, a string body is sanitised before it runs:
test("an unclean string body is sanitised in the editor", () => { /* body '<img src=x onerror=alert(1)><p>hei</p>' under EditorCallbacksContext → no <img> */ });
// inspector.dom.test.tsx — createRoot + act; await the lazy import inside act(async …)
test("inspector shows the newly selected block's text", async () => {
  // mount TextInspector for block A (body "<p>Alpha</p>"), then re-render with block B (id differs, body "<p>Beta</p>") → host text contains "Beta", not "Alpha"
});
test("inspector field has the Text label and the toolbar", async () => { /* aria-label "Text" and a "Text style" select present */ });
```

- [ ] **Step 2: Run** — `cd packages/editor && bun test src/blocks/text/`. Expected: the new tests FAIL; the legacy ones pass.
- [ ] **Step 3: Implement** `render-classes.ts`, `render.tsx`, `inspector.tsx`, `index.tsx` and `globals.css`.
- [ ] **Step 4: Run the whole suite** — `bun test ./src` in `packages/editor` (including `rich-confinement.test.ts` and `no-dynamic-classes.test.ts`), then root `bun run check-types`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(editor): rich text block edits on one Plate surface with lazy loading`

---

### Task 10: Stage verification

**Files:** none new. Fixes go to whichever file the checks point at.

- [ ] **Step 1:** `bun x ultracite fix` at the worktree root, then `bun x ultracite check`. Expected: no errors in changed files.
- [ ] **Step 2:** `bun run check-types` at the root. Expected: every package passes.
- [ ] **Step 3:** `cd packages/editor && bun test ./src`, plus the admin suites that load page docs: `cd apps/admin && bun test src/app/\(portal\)/_actions/pages-translation` and `bun test src/lib`. Expected: PASS. A translation case that builds text blocks keeps passing on legacy arrays.
- [ ] **Step 4:** `bun run build --filter=admin` and `bun run build --filter=web`. Expected: both compile. Then prove the editing code is split into its own chunk. Run `comm -12 <(grep -rl "richPaste" apps/web/.next/static/chunks | sort) <(grep -rl "pg-rich" apps/web/.next/static/chunks | sort)`. Expected: empty output, meaning no chunk holds both the paste plugin key and the public renderer's class. Also expect `grep -rl "richPaste" apps/web/.next/static/chunks` to list at least one file. The split chunk exists, but it loads only in edit mode.
- [ ] **Step 5:** Append a "Stage 1 done (date)" note to the spec. It lists what was built, every judgment call made while building, and anything deferred. Commit with `docs(editor): stage 1 notes`.

---

## After Stage 1 (scope reminder for the next plans)

- **Stage 2:**
  - colour swatches (theme tokens, `span[data-color]`, deep-surface variants, nearest-swatch paste mapping)
  - tables (`TablePlugin`, allowlist and serializer, phone scroll)
  - the ⋯ menu (strikethrough, divider, clear formatting)
  - Expand view
  - the notice when pasted images are dropped
- **Stage 3:**
  - copilot prompt and tools (`packages/editor/src/ai/prompt.ts`), so the copilot writes `body` as one HTML string and never uses `body.N.text` paths on a string body
  - `templates.ts` `text()` in the new shape
  - a translation round-trip test with lists, a table and colour
  - docs (`apps/docs/content/docs/guide/pages-and-news/edit-a-page.mdx`, developer pages)
  - the go-live checklist, including Markus's manual Word paste check on Mac and Windows
