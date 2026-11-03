# Rich Text Stage 3: Copilot, Templates, Translation, Docs, Go-live — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Stage 2's parked residuals, then let the copilot read and write the whole rich text vocabulary and hear back when the page refuses a tool, make new unit pages start with HTML bodies, prove translation keeps formatting, document the feature for staff and developers, and hand Markus a go-live checklist with the stage verified.

**Architecture:** Task 1 fixes five residuals inside `blocks/text/rich/` and the store's burst rule, which moves to `editor/coalesce.ts` so the field and the page split undo steps at the same moment. The copilot's page-changing tools become client tools: the server streams the call, the browser applies it (`applyToolCall`) and sends the result back with `addToolOutput`, and `sendAutomaticallyWhen` continues the turn, capped at 12 steps on the client. The page state gives the model every text block's body. Templates write canonical HTML. Translation gets pin tests over the existing translator seam and the publish path's sanitiser. Docs follow `apps/docs/CLAUDE.md`.

**Tech Stack:** Plate.js 52.3.x inside `blocks/text/rich/`, React 19, zustand, AI SDK 7.0.148 (`ai`) and `@ai-sdk/react` 4.0.152, `sanitize-html`, happy-dom + `bun:test` (editor, admin, docs), vitest (`packages/shared`, `apps/web`), Fumadocs (`apps/docs`).

**Spec:** `docs/superpowers/specs/2026-11-03-rich-text-editor-design.md`. Read all of it, including "Rulings during planning", "Stage 1 done" and "Stage 2 done". The Stage 2 ledger, `.superpowers/sdd/2026-11-03-rich-text-stage-2-colour-tables-expand/progress.md`, holds the parked residuals (its "Final review: parked" lines); `final-fix-report.md` next to it explains the code Task 1 changes.

## Global Constraints

- Bun only (`bun@1.3.1`). No new dependencies.
- Work only in the worktree `/Users/markus/Documents/dev/BISO-Sites/.claude/worktrees/rich-text-editor`. Never `git push`. Never touch the main checkout or its branch. No deploys, no `appwrite push`, no production data writes.
- Must pass after every task: `bun run check-types` (repo root), `cd packages/editor && bun test ./src`, and `bun x ultracite fix <changed paths>` then `bun x ultracite check <changed paths>` on the files the task changes, not the whole repo (Stage 1 ruling). A task that touches `apps/admin`, `apps/docs`, `apps/web` or `packages/shared` also runs that workspace's tests (commands in Task 7).
- The test count never drops. Each task reports the editor suite's summary line before and after; the baseline at `5a3a5591` is `1746 pass, 0 fail, 131 files`. A task that touches another workspace reports that suite's count before and after too. Replacing a test is fine; the total must not go down.
- Both sanitisers stay in lockstep: `lib/sanitize.ts` (client) and `editor/sanitize-doc.ts` (server) read `lib/rich-allowlist.ts` for tags and attribute rules. Stage 3 adds no tag and no attribute. No `style` and no `class` survives either.
- Colour is stored only as `<span data-color="TOKEN">`, TOKEN one of `accent, muted, green, amber, red` (`packages/shared/utils/text-colour-tokens.ts`).
- Plate confinement: no file outside `blocks/text/rich/` statically imports `platejs`, `@platejs/*` or anything in `rich/` (`blocks/text/rich-confinement.test.ts`); `lazy-field.ts` and `canonical-body.ts` are the only ways in, both dynamic. The public renderer never imports Plate. The `apps/web` initial bundle must not grow by the editor.
- Invariants: `valueToHtml(htmlToValue(valueToHtml(v))) === valueToHtml(v)` (`rich/fixed-point.test.ts`, tables and colour included); `sanitizeRichBodyHtml` leaves `valueToHtml` output unchanged apart from U+00A0 as `&nbsp;`; `scanBody(valueToHtml(v), 100) === "canonical"` (the canonical fast path); legacy `body: TextBodyItem[]` renders exactly as today.
- Chrome: Markus loves the current editor chrome. Change no look. The one new glyph (Task 3's `✕`) sits in the existing `.pe-copilot-panel__tool-name` span. Chrome strings are English.
- Every `.tsx` under `packages/editor/src/blocks/` passes `blocks/_v2/v2-guard.test.ts`.
- Known failures that are not this branch's: admin `src/lib/content-translation.test.ts` (model-id mismatch, also on main); `canvas.test.tsx` and `topbar.test.tsx` when `src/components` runs alone. Record them, don't fix them.
- Commit messages end with an attribution line for the model you are (`Co-Authored-By: <your model name> <noreply@anthropic.com>`), then:
  ```
  Claude-Session: https://claude.ai/code/session_014NDgSPSV8Z43ZEbDoPijNN
  ```

## Review Focus

1. **A typing pause of exactly one second.** The store opens a new page step at `now - last >= 1000`; if the field splits its Slate batch at `> 1000`, one key undoes two page steps again → Task 1 (a) test `a pause of exactly one second splits the field and the page alike`.
2. **Pasting a table over a select-all of a text that opens with a table.** The caret's anchor is in a table, so the paste would go "after the table" and delete nothing → Task 1 (b) test `pasting a table over a select-all replaces the whole text, even one that opens with a table`.
3. **A copilot tool whose apply throws.** With client tools, a call that never gets an output leaves the chat waiting forever → Task 3 test `a tool that throws still answers the model, and changes nothing`.
4. **Sending a new message while a tool answer is still on its way** (a slow canonical write after the stream ended). The next request would carry a tool call with no result, which the SDK rejects → Task 3 tests `hasPendingToolCall` and `the input waits while a tool answer is pending`.
5. **A text body whose first 2,000 characters hold no end tag** (one long link). The preview must still be cut and never longer than the limit → Task 2 test `a body with no end tag before the limit is cut at the limit`.

---

### Task 1: Stage 2 residuals (a–e)

This task lands first, before every other task. One commit per fix, in order a, b, c, d, e; each goes red, then green, then commits.

**Files:**
- (a) Create: `packages/editor/src/editor/coalesce.ts`. Modify: `packages/editor/src/editor/store.ts` (`COALESCE_MS` and the burst test move out), `packages/editor/src/blocks/text/rich/react-plugins.tsx` (`RichKeysPlugin`), `packages/editor/src/blocks/text/rich/field.tsx`. Test: `packages/editor/src/editor/store-coalesce.test.ts`, `packages/editor/src/blocks/text/rich/field.dom.test.tsx`.
- (b) Modify: `packages/editor/src/blocks/text/rich/table-edges.ts`, `rich/paste-plugin.ts`. Test: `rich/table-edges.test.ts`, `rich/paste.test.ts`.
- (c) Modify: `rich/table-edges.ts`. Test: `rich/table-edges.test.ts`.
- (d) Modify: `rich/paste.ts` (`plainTextToHtml`). Test: `rich/paste.test.ts`.
- (e) Modify: `rich/structure.ts`. Test: `rich/html.test.ts`.

**Interfaces:**
- Produces:
  - `editor/coalesce.ts`: `export const COALESCE_MS = 1000;` and `export function opensNewStep(lastAt: number | null, now: number): boolean`, true when `lastAt === null || now - lastAt >= COALESCE_MS`. `store.ts`'s `setProp` continues a burst when the key matches and `!opensNewStep(s.lastCoalesce.at, now)`; same behaviour as today.
  - `RichKeysConfig` gains `pendingTake: (() => void) | null` (default `null`).
  - `table-edges.ts`: `export function coversWholeValue(editor: SlateEditor, at: TRange): boolean`, true when the range's edges (`RangeApi.edges`) equal the value's first and last points (`editor.api.start([])`, `editor.api.end([])`), in either direction.

**What each fix does:**
- **(a) Undo batches follow the page's steps.** In `RichKeysPlugin.overrideEditor`, keep `let lastChangeAt: number | null = null` per editor and override `apply(op)`. For an operation that is not `set_selection`, outside `historyStep`: when `opensNewStep(lastChangeAt, Date.now())`, call `editor.tf.setSplittingOnce(true)` before passing the operation on (Plate's history `apply` reads it and starts a new batch); then set `lastChangeAt` to that time. `asHistoryStep` sets `lastChangeAt = null` straight after `step()`, because the store's history-neutral write clears `lastCoalesce`, so the next typing is a new page step. So the field's batches open exactly where the page's steps open, and a field undo never spans two page steps.
  The field also takes a pending outside change before a history key: `onKeyDown` calls `getOption("pendingTake")?.()` for `mod+z` and `mod+shift+z` (by key) before it checks `emptyHistoryStep`. The field sets `pendingTake` to its `take` in an effect. A pending copilot change is then taken first (which clears the field's history, as every take does), and the key falls through to the page, whose undo reverts the copilot change before the typing. Without this, the field's own undo writes over the copilot body with no page step, and it is lost.
- **(b) Select-all replaces everything, tables too.** In `RichTableEdgesPlugin`:
  - `delete`: a range for which `coversWholeValue` is true skips the edge rules and goes to Slate's own delete (`remove`) over the forward range `{ anchor: start([]), focus: end([]) }`. When the value's first node is a table, an empty paragraph is first inserted at `[0]`, because Slate's delete keeps any block that holds its start point, so the table would survive. A caller's end-point ref (`insertFragment`, `splitNodes`) survives the merge.
  - `deleteFragment`: a selection for which `coversWholeValue` is true is selected forward, then passed to the original `deleteFragment`. Plate core's select-all reset (`withDeleteRules`) then empties the value. Today only a forward selection reaches it.
  - `insertText` (new override): over an expanded selection that covers the whole value, `editor.tf.delete()` runs first, then the original `insertText` on the collapsed caret. Without this, Plate's table `insertText` collapses a selection that spans cells and deletes nothing.
  - `RichPastePlugin.insertData`: before anything else, an expanded selection that covers the whole value is deleted with `editor.tf.delete()`. Otherwise `insertAfterTable` sees the anchor in a table and sends the paste after it.
- **(c) The line beside a table stays when it is the only one.** In `deleteAtEdge`, the empty line the caret leaves for a table is removed only when its other neighbour exists and is not a table. For Backspace, the other neighbour is the next sibling; for Delete, the previous one. That replaces today's "unless it is the last line", which is one case of the rule. The caret still moves into the table. New `insertBreak` override: with a collapsed selection at the table's first point (`editor.api.start(tablePath)` of the highest table above the caret), when the table has no previous sibling or its previous sibling is a table, insert an empty `p` at the table's path and select it. Otherwise call the original `insertBreak`.
- **(d) Numbered plain text across blank lines.** `plainTextToHtml` keeps each chunk's runs as `lineRuns` makes them, with one exception. When a chunk's first line run is numbered, and the previous chunk's last run is an `ol` whose last number is one less than the run's first number, and the run counts on by one, its lines join that `ol` and are not demoted to text. Every other rule is unchanged:
  - a lone numbered line that starts no continuation is a list only when it is number 1, so blank-line-separated dates stay text;
  - a single-line paste still passes through when `plainTextHasStructure` is false;
  - runs from different chunks never merge otherwise.
- **(e) `holdsBlocks` looks through inline wrappers.** `holdsBlocks(el)` is true when a child is a block, or a child is a non-block element that `holdsBlocks` (recursive). `wrapRunsBeside` ends a run at such an inline child as it does at a block. `pushInto` goes into it as it goes into a block. So `inlineIntoBlocks` pushes a link through a `span` into the paragraphs the span holds.

- [ ] **Step 1: Write the failing tests**

```ts
// store-coalesce.test.ts
test("opensNewStep: nothing before, or one second or more since, opens a step", () => {
  expect(opensNewStep(null, 5)).toBe(true);
  expect(opensNewStep(0, 999)).toBe(false);
  expect(opensNewStep(0, 1000)).toBe(true);
  expect(COALESCE_MS).toBe(1000);
});

// field.dom.test.tsx: StoreField, typeText, pressKey, UNDO, REDO, markFocused, settle, storeProp as in
// "mod+z after a pause undoes the typing…". Each test: setSystemTime(T0), setDoc(doc(section("s-1", "1", [["b1"]]))),
// mount StoreField, markFocused, before = shown(), original = storeProp("b1", "body"); setSystemTime() at the end.
test("each pause in typing is its own undo step, in the field and on the page", async () => { /*
  typeText "Hello" → past 1; setSystemTime(T0 + 2000); typeText " world" → past 2; setSystemTime(T0 + 4000);
  UNDO → shown `${before}Hello`, past 1, future 1;  UNDO → shown before, body === original, past 0, future 2;
  REDO → `${before}Hello`, past 1, future 1;  REDO → `${before}Hello world`, past 2, future 0 */ });
test("a pause of exactly one second splits the field and the page alike", async () => { /*
  typeText "Hello"; setSystemTime(T0 + 1000); typeText " world" → past 2; UNDO → `${before}Hello`, past 1.
  Then a fresh doc: typeText "Hello"; setSystemTime(T0 + 999); typeText " world" → past 1; UNDO → before, past 0 */ });
test("typing straight after a field undo is a step of its own", async () => { /*
  "Hello", +2 s, " world", UNDO → `${before}Hello`; typeText "!" (same time) → `${before}Hello!`, past 2;
  UNDO → `${before}Hello`, past 1;  UNDO → before, past 0 */ });
test("a copilot change the field has not taken stays reachable by undo and redo", async () => { /*
  typeText "Hello" (past 1); setSystemTime(T0 + 2000);
  useEditorStore.getState().setProp("b1", "body", "<p>Copilot</p>", { coalesce: "copilot:b1:body" }); await settle();
  → shown() still `${before}Hello` (focused), past 2;
  UNDO → storeProp body contains "Hello", not "Copilot"; shown `${before}Hello`; past 1, future 1;
  UNDO → body === original; shown before; past 0;
  REDO → body contains "Hello";  REDO → body === "<p>Copilot</p>", shown "Copilot", future 0 */ });

// table-edges.test.ts (editorOn, html, at, caret, TABLE, PAGE as in the file)
const REVERSED = (editor: SlateEditor) => ({ anchor: editor.api.end([]), focus: editor.api.start([]) });
test.each(["forward", "backward"])("select-all %s then Delete empties the text, tables and all", (way) => { /*
  editorOn(PAGE) and editorOn(`${TABLE}<p>after</p>`): select range([]) or REVERSED; deleteFragment() →
  html "" and editor.children.length 1 */ });
test.each(["forward", "backward"])("typing over a select-all %s leaves only what was typed", (way) => { /*
  PAGE and `${TABLE}<p>after</p>`: select; editor.tf.insertText("Z") → html "<p>Z</p>" */ });
test("a delete of the whole text from code removes a table that opens it", () => { /*
  editorOn(`${TABLE}<p>after</p>`); editor.tf.delete({ at: editor.api.range([]) }) → html "", children.length 1, type "p" */ });
test("a selection short of the whole text still keeps the table", () => { /*
  PAGE: anchor at(before, 1), focus end([]); insertText("Z") → html === `<p>bZ</p>${EMPTY_TABLE}`,
  EMPTY_TABLE being TABLE with every cell empty (today's cross-edge rule) */ });

// paste.test.ts (createConversionEditor([RichPastePlugin], { nodeId: true }), clipboard() as in the file)
test.each([
  ["<p>before</p><table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>", "<p>New</p>", "<p>New</p>"],
  ["<table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>", "<p>New</p>", "<p>New</p>"],
  ["<table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>",
   "<table><tr><td>x</td><td>y</td></tr></table>", "<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>"],
])("pasting a table over a select-all replaces the whole text, even one that opens with a table: %s", (start, pasted, out) => { /*
  setValue(htmlToValue(start)); select range([]); insertData(clipboard({ "text/html": pasted })) → valueToHtml === out.
  Repeat with the reversed range. */ });

// table-edges.test.ts: (c)
const TABLE_C = "<table><tbody><tr><td>c1</td></tr></tbody></table>";
test("Delete on an empty first line before a table keeps the line", () => { /*
  value [p "", ...table of TABLE]; select [0, 0]:0; deleteForward("character") →
  children types ["p", "table", "p"]; caret === at(editor, "a1", 0) */ });
test("Backspace and Delete on an empty line between two tables keep the line", () => { /*
  value [table TABLE, p "", table TABLE_C, p ""]; select [1, 0]:0; deleteBackward → types ["table", "p", "table", "p"],
  caret at(b2, 2); select [1, 0]:0 again; deleteForward → same types, caret at(c1, 0) */ });
test("Enter at the very start of a table that opens the text adds a line above it", () => { /*
  editorOn(TABLE); select at(a1, 0); insertBreak() → types ["p", "table", "p"], selection in [0];
  insertText("x") → html `<p>x</p>${TABLE}` */ });
test("Enter at the start of a table right after another table adds a line between them", () => { /*
  editorOn(`${TABLE}${TABLE_C}`); select at(c1, 0); insertBreak() → types ["table", "p", "table", "p"] */ });
test("Enter at the start of a table after a paragraph stays the table's own", () => { /*
  editorOn(`<p>x</p>${TABLE}`); select at(a1, 0); insertBreak() → children[1].type === "table", children.length === 3 */ });
// The existing "an empty line beside a table goes…" and "the last line after a table stays…" keep passing unchanged.

// paste.test.ts: add to the "plain text %p" table
["1. One\n\n2. Two\n\n3. Three", "<ol><li>One</li><li>Two</li><li>Three</li></ol>"],
["Agenda\n\n1. Welcome\n\n2. Budget", "<p>Agenda</p><ol><li>Welcome</li><li>Budget</li></ol>"],
["1. a\n2. b\n\n3. c", "<ol><li>a</li><li>b</li><li>c</li></ol>"],
["3. a\n4. b\n\n5. c", '<ol start="3"><li>a</li><li>b</li><li>c</li></ol>'],
["1. a\n2. b\n\n4. c", "<ol><li>a</li><li>b</li></ol><p>4. c</p>"],
["1. One\n\n2. Two\nmore", "<ol><li>One</li><li>Two</li></ol><p>more</p>"],
["1. One\n\nA paragraph\n\n2. Two", "<ol><li>One</li></ol><p>A paragraph</p><p>2. Two</p>"],
["Program\n\n17. mai: Frokost\n\n18. mai: Tur", "<p>Program</p><p>17. mai: Frokost</p><p>18. mai: Tur</p>"],

// html.test.ts: add to "a link around blocks goes into each: %s"
['<a href="/x"><span><p>a</p><p>b</p></span></a>', '<p><a href="/x">a</a></p><p><a href="/x">b</a></p>'],
['<a href="/x"><span data-color="red"><p>a</p><p>b</p></span></a>',
 '<p><a href="/x"><span data-color="red">a</span></a></p><p><a href="/x"><span data-color="red">b</span></a></p>'],
['<ul><li><a href="/x"><span><p>a</p><p>b</p></span></a></li></ul>', '<ul><li><a href="/x">a</a><br><a href="/x">b</a></li></ul>'],
// and to "blocks wrapped in an inline element stay lines apart: %s"
["<div><span><p>a</p><p>b</p></span></div>", "<p>a</p><p>b</p>"],
```

For the `a selection short of the whole text…` test, write `EMPTY_TABLE` out literally. If the received HTML differs only because Plate's selection rules reshape that range, take Plate's shape as the expectation. The test exists to show the whole-value rule does not fire for a range that falls short of the whole text.

- [ ] **Step 2: Run** `cd packages/editor && bun test src/editor/store-coalesce.test.ts src/blocks/text/rich`. Expected: the new tests FAIL. `opensNewStep` is not defined, the multi-pause and copilot undo tests fail, select-all keeps grids, the empty lines go, the numbered chunks split, and the link around a span glues "ab".
- [ ] **Step 3: Implement** (a) through (e) as described. Check `editor.tf.setSplittingOnce` and Plate's history `apply` in `node_modules/@platejs/slate/dist/index.js` (around `SPLITTING_ONCE`) before relying on it.
- [ ] **Step 4: Run** `bun test ./src` in `packages/editor` and root `bun run check-types`. Expected: PASS, with at least 1746 tests plus the new ones.
- [ ] **Step 5: Commit**, one per fix:
  - (a) `fix(editor): each typing pause is its own undo step in the field too`
  - (b) `fix(editor): select-all then type, paste or delete replaces the whole text`
  - (c) `fix(editor): the only line beside a table stays, and Enter opens one above it`
  - (d) `fix(editor): numbered plain text split by blank lines stays one list`
  - (e) `fix(editor): a link around a span of paragraphs keeps the lines apart`

---

### Task 2: What the copilot knows about text

**Files:**
- Modify: `packages/editor/src/ai/prompt.ts`, `packages/editor/src/ai/tools/index.ts` (`set_prop` description only), `packages/editor/src/editor/serialize.ts`
- Test: `packages/editor/src/ai/prompt.test.ts`, `packages/editor/src/editor/serialize.test.ts`, `packages/editor/src/blocks/text/rich/html.test.ts` (one test)

**Interfaces:**
- Produces:
  - `prompt.ts`: `export const PROMPT_BODY_EXAMPLE: string`, the example body the prompt shows. It must be exactly what the field writes (test below).
  - `serialize.ts`: `export const AI_BODY_CHARS = 2000;` and `export function bodyForAI(body: unknown): string`. `blockSummary` appends ` body=${bodyForAI(b.body)}` to every `text` block's line, selected or not.

**The prompt's text-block entry.** Replace the two `text:` lines in `buildSystemPrompt` with this copy, as written:
```
    text: body, one HTML string; set it whole with path \`body\`, never a path inside it
      (body.0.text is refused). The page state shows each text block's body: send the
      whole new body, keeping what the volunteer did not ask you to change. Write only:
      blocks: <h2> heading, <h3> subheading, <p>, <blockquote> quote, <hr> divider,
        <ul> or <ol> of <li> items (put a <ul> or <ol> inside an <li> to nest;
        <ol start="3"> counts from 3), and <table>: an optional header row
        <thead><tr><th>…</th></tr></thead>, then <tbody><tr><td>…</td></tr></tbody>;
        colspan and rowspan from 2 to 20 merge cells; a cell holds text, inline tags
        and <br>, never a list, heading or table
      inline: <strong>, <em>, <u>, <s>, <br>, <a href="…"> (the link rules below),
        and <span data-color="TOKEN"> for coloured text. TOKEN is accent (the page's
        accent colour, for emphasis), muted (quieter grey, for asides), green (good
        news), amber (caution) or red (warnings and deadlines). The colours come from
        the page theme and stay readable on dark sections. Use them sparingly, and
        never write a hex colour, a style or a class. No <h1>: the page header is the title.
      e.g. ${PROMPT_BODY_EXAMPLE}
```
`PROMPT_BODY_EXAMPLE` is:
```
<h2>Opening hours</h2><p>We are open <strong>every weekday</strong>. <span data-color="red">Closed on 17 May.</span></p><ul><li>Oslo<ul><li>Nydalen</li></ul></li></ul><table><thead><tr><th>Day</th><th>Hours</th></tr></thead><tbody><tr><td>Monday</td><td rowspan="2">10–16</td></tr><tr><td>Tuesday</td></tr></tbody></table>
```
If the fixed-point test shows the serializer writes it differently, change the constant to the serializer's output. The test pins equality, so the example always shows the stored form.

`set_prop`'s description gains one sentence: `A text block's body is one HTML string: set it whole with path 'body'.`

**`bodyForAI(body)`:**
- `html = bodyToHtml(body)` (`blocks/text/body.ts`; a legacy array shows as the HTML it renders, junk as `""`).
- Up to `AI_BODY_CHARS` characters, it returns `JSON.stringify(html)`.
- Past that, the preview is cut just after the last end tag (`</name>`) that ends within the first `AI_BODY_CHARS` characters, or at `AI_BODY_CHARS` when there is none. It returns `` `${JSON.stringify(preview)} (cut: the first ${preview.length} of ${html.length} characters; set_prop body replaces all of it, so ask the volunteer to select this block before you rewrite part of it)` ``.
- The selected block's full JSON further down still shows its whole body.

- [ ] **Step 1: Write the failing tests**

```ts
// prompt.test.ts
import { BODY_TAGS } from "@/lib/rich-allowlist";
import { TEXT_COLOUR_TOKENS } from "@repo/shared/utils/text-colour-tokens";
test("the copilot knows every tag a text body keeps", () => {
  const prompt = buildSystemPrompt("empty page");
  // b and i are read on input and written as strong and em.
  for (const tag of BODY_TAGS.filter((t) => t !== "b" && t !== "i")) {
    expect(prompt).toMatch(new RegExp(`<${tag}[ >]`));
  }
});
test("the copilot knows the colour tokens, the list start and the cell spans", () => {
  const prompt = buildSystemPrompt("empty page");
  expect(prompt).toContain('<span data-color="TOKEN">');
  for (const token of TEXT_COLOUR_TOKENS) expect(prompt).toContain(`${token} (`);
  expect(prompt).toContain('<ol start="3"> counts from 3');
  expect(prompt).toContain("colspan and rowspan from 2 to 20");
  expect(prompt).toContain("never write a hex colour, a style or a class");
  expect(prompt).toContain(PROMPT_BODY_EXAMPLE);
});
// The shape test's text line becomes "text: body, one HTML string; set it whole with path `body`";
// "the copilot sets a text block's body whole…" expects "set it whole with path `body`, never a path inside it".

// html.test.ts
test("the copilot's example body is what the field writes", () => {
  expect(valueToHtml(htmlToValue(PROMPT_BODY_EXAMPLE))).toBe(PROMPT_BODY_EXAMPLE);
  expect(scanBody(PROMPT_BODY_EXAMPLE, 100)).toBe("canonical");
});

// serialize.test.ts (doc/section/block fixtures)
test("the AI sees every text block's body, selected or not", () => { /*
  two text blocks b-1, b-2 (emptyBlock bodies), selection "b-2" → the b-1 line contains
  'body="<h2>Section heading</h2><p>Tell the story like you\'d tell a friend.</p>"' */ });
test("a legacy body is shown as the HTML it renders", () => { /*
  body [{ type: "h", text: "T" }, { type: "li", text: "a" }] → line contains 'body="<h2>T</h2><ul><li>a</li></ul>"' */ });
test("a long body is cut after an end tag, with a note saying so", () => { /*
  body = "<p>abcdefgh</p>".repeat(300) (4500 chars) → preview is the first 133 copies (1995 chars) ending "</p>",
  not the "<p>" of the 134th; line contains `(cut: the first 1995 of 4500 characters; set_prop body replaces all of it` */ });
test("a body with no end tag before the limit is cut at the limit", () => { /*
  body = `<p><a href="https://biso.no/${"x".repeat(3000)}">l</a></p>` → JSON preview decodes to 2000 chars, note says "first 2000 of" */ });
test("a body of exactly the limit is shown whole", () => { /* "x".repeat(1993) wrapped in <p></p> (2000) → no "(cut:" */ });
test("an empty or missing body shows as empty", () => { /* body "" and body undefined → 'body=""' */ });
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/ai src/editor/serialize.test.ts src/blocks/text/rich/html.test.ts`. Expected: FAIL, since the new names and copy don't exist yet.
- [ ] **Step 3: Implement** the prompt copy and `PROMPT_BODY_EXAMPLE`, the `set_prop` sentence, and `bodyForAI` in `blockSummary`. `serialize.ts` imports `bodyToHtml` from `../blocks/text/body`, which the public renderer already loads.
- [ ] **Step 4: Run** `bun test ./src` and root `bun run check-types`. Expected: PASS, no test-count drop.
- [ ] **Step 5: Commit**: `feat(editor): the copilot sees every text body and writes the whole rich text vocabulary`

---

### Task 3: The page's answer to each copilot tool reaches the model

The page-changing tools have a server `execute` today, so the server answers `"applied"` before the browser has tried. The model never sees a refusal: `body.0.text` refused, a missing section, a theme that fails contrast, a body the editor could not read back. The browser cannot overwrite that answer either. `addToolOutput` updates the part, but the server's `tool-output-available` chunk arrives next and replaces it, and the server's loop has already continued. So these tools become client tools. The server stops at their call, the browser answers, and the SDK sends the answer back. This is the pattern `apps/admin/.../assistant/assistant-widget.tsx` already uses.

**Files:**
- Create: `packages/editor/src/ai/tools/client-tools.ts`
- Modify: `packages/editor/src/ai/tools/index.ts`, `packages/editor/src/ai/prompt.ts` (one guideline), `packages/editor/src/components/editor-shell/copilot/chat-panel.tsx`, `apps/admin/src/app/api/page-editor/ai/chat/route.ts` (the `stopWhen` comment only)
- Test: `packages/editor/src/ai/tools/tools.test.ts`, `ai/tools/streaming.test.ts`, `ai/prompt.test.ts`, `components/editor-shell/copilot/chat-panel.test.ts`, `copilot/chat-panel-body.dom.test.ts`
- Create test: `packages/editor/src/components/editor-shell/copilot/copilot-panel.dom.test.tsx`

**Interfaces:**
- Consumes: `applyToolCall`, `whenBodiesCanonical`, `canonicalBodyHtml` (existing).
- Produces:
  - `client-tools.ts`: `export const CLIENT_TOOL_NAMES = ["insert_section", "insert_block", "set_theme", "remove_block", "set_prop", "bind_collection"] as const` and `export function isClientTool(name: string): boolean`. It imports nothing, so the browser chunk stays light.
  - `tools/index.ts`: those six tools have no `execute`. `list_blocks` and `generate_copy` keep theirs.
  - `chat-panel.tsx`:
    - `export function runToolCall(toolName: string, args: ToolArgs, canonical: (html: string) => Promise<string> = canonicalBodyHtml): Promise<ToolResult>`. It applies the call synchronously, in call order, through the same internal function `applyToolCall` uses. A `set_prop` of a text block's whole body then awaits that write's canonical step. It never rejects: a throw while applying resolves to `toolFailed(toolName, error)`. A canonical step that throws resolves to `canonicalFailed(id)`, and the raw body stays, as today. The third parameter is the seam tests use.
    - `export const toolFailed = (toolName: string, error: unknown): ToolResult` gives `{ status: "error", message: \`${toolName} failed and changed nothing (${error instanceof Error ? error.message : String(error)}).\` }`.
    - `export const canonicalFailed = (id: string): ToolResult` gives `{ status: "error", message: \`Block ${id}'s body was saved as sent, but the editor could not read it back, so the page may not show it as written. Do not send it again; tell the volunteer to reload the editor and check that text block.\` }`.
    - `export const COPILOT_MAX_STEPS = 12`.
    - `export function shouldContinue({ messages }: { messages: UIMessage[] }): boolean` returns `lastAssistantMessageIsCompleteWithToolCalls({ messages })` and fewer than `COPILOT_MAX_STEPS` parts of type `step-start` in the last message.
    - `export function hasPendingToolCall(messages: UIMessage[]): boolean` is true when the last message is the assistant's and one of its tool parts is in state `input-streaming` or `input-available`.
    - `export function toolGlyph(part: { output?: unknown; state: string }): "✓" | "✕" | "⟳"`. It gives `✕` for `output-error`, and for `output-available` whose output has `status: "error"`. It gives `✓` for other `output-available` parts and `⟳` otherwise.
  - `CopilotPanel`:
    - `useChat` gets `sendAutomaticallyWhen: shouldContinue`.
    - `onToolCall({ toolCall })` returns early for `toolCall.dynamic` or a name `isClientTool` rejects (the server answered those). Otherwise it calls `void runToolCall(name, input).then((output) => addToolOutput({ options: { body: { pageContext: turnContext.current } }, output, tool: name, toolCallId }))`, without awaiting, as the SDK asks.
    - `turnContext` is a ref set to the `pageContext` each `sendMessage` gets, in `handleSubmit` and the suggestion buttons. A continuation then carries the same snapshot the prompt describes; the SDK reuses the first request's body for its own continuations.
    - `isLoading` is `status === "submitted" || status === "streaming" || hasPendingToolCall(messages)`.
    - The tool line renders `toolGlyph(part)`.
  - `prompt.ts`: after "You can call multiple tools…", add the guideline: `- Every tool answers with a status. "applied" means the page changed. "error" means it did not, or for a body, that it may not show as written: read the message, fix the call if it says how, and otherwise tell the volunteer. Never report a change whose tool answered with an error.` Wrap it as the prompt wraps its lines, but keep that last sentence on one line, since the test pins it. The same goes for every phrase Task 2's prompt tests pin.
  - `route.ts`: the `stopWhen` comment says that the page's own tools end a request so the browser can answer, that the browser caps a whole turn at `COPILOT_MAX_STEPS`, and that this cap of 12 per request guards a run of server-only tools. No code change.

- [ ] **Step 1: Write the failing tests**

```ts
// tools.test.ts: replace the two set_theme execute tests (the refusal is covered in chat-panel.test.ts)
test("the tools the page applies are answered by the page, the rest by the server", () => {
  const names = Object.keys(pageEditorTools);
  for (const name of CLIENT_TOOL_NAMES) expect((pageEditorTools[name] as { execute?: unknown }).execute).toBeUndefined();
  for (const name of names.filter((n) => !isClientTool(n))) expect((pageEditorTools[name as keyof typeof pageEditorTools] as { execute?: unknown }).execute).toBeDefined();
  expect(names.filter((n) => !isClientTool(n)).sort()).toEqual(["generate_copy", "list_blocks"]);
});

// streaming.test.ts: replace "page editor tools are executable by streamText"
test("a page tool ends the server's turn with its call, for the page to answer", async () => { /*
  runCopilotTurn() → rendered ["text", "tool"]; the tool part is "tool-insert_block", state "input-available",
  input { type: "events" }; the model was called once (doStreamCalls.length === 1) */ });
test("the page's answer goes to the model, which then closes the turn", async () => { /*
  UI messages [user "Add an events feed", assistant with a step-start and the tool part in state
  "output-available", output { status: "error", message: "There is no section s-9." }] →
  streamText({ messages: await convertToModelMessages(messages), tools: pageEditorTools, … }) with a model whose one
  stream is the closing text → JSON.stringify(model.doStreamCalls[0].prompt) contains "There is no section s-9." */ });
// "the copilot's preamble reaches the client before the tool call" becomes rendered ["text", "tool"].

// prompt.test.ts
test("the copilot reads each tool's answer", () => {
  expect(buildSystemPrompt("empty page")).toContain("Never report a change whose tool answered with an error.");
});

// chat-panel.test.ts (store as in the file; no DOM)
test("runToolCall answers with the refusal of a path inside an HTML body", async () => { /*
  await runToolCall("set_prop", { id: "b-1", path: "body.0.text", value: "x" }) → status "error", message contains 'path "body"' */ });
test("runToolCall answers with an insert's error", async () => { /* sectionId "s-9" → status "error", "There is no section s-9." */ });
test("runToolCall applies calls in the order they come", async () => { /*
  const a = runToolCall("insert_section", { columns: "1-1" }); const b = runToolCall("insert_block", { sectionId: "new", columnIndex: 1, type: "stats" });
  await Promise.all([a, b]) → the new section's second column holds a stats block */ });
test("a tool that throws still answers the model, and changes nothing", async () => { /*
  spyOn(useEditorStore.getState(), "removeBlock").mockImplementation(() => { throw new Error("boom") }) — or replace the
  store action with setState for the test; restore after → await runToolCall("remove_block", { id: "b-1" }) toEqual
  toolFailed("remove_block", new Error("boom")); b-1 still in the doc */ });
test("a body the editor cannot read back is reported to the model", async () => { /*
  await runToolCall("set_prop", { id: "b-1", path: "body", value: "<p>x</p>" }, () => Promise.reject(new Error("chunk")))
  toEqual canonicalFailed("b-1"); bodyOf("b-1") === "<p>x</p>" */ });
test.each([
  ["a finished tool step", [userMsg, assistant([step(), tool("output-available")])], true],
  ["an errored tool", [userMsg, assistant([step(), tool("output-error")])], true],
  ["a tool still running", [userMsg, assistant([step(), tool("input-available")])], false],
  ["the user's turn", [userMsg], false],
  ["the step cap", [userMsg, assistant([...Array.from({ length: 12 }, () => [step(), tool("output-available")]).flat()])], false],
])("shouldContinue: %s", (_name, messages, expected) => expect(shouldContinue({ messages })).toBe(expected));
test("hasPendingToolCall is true while a call of the last message waits for its answer", () => { /*
  input-available → true; input-streaming → true; output-available → false; a pending part in an earlier message only → false */ });
test.each([
  [{ state: "output-available", output: { status: "applied" } }, "✓"],
  [{ state: "output-available", output: { status: "error" } }, "✕"],
  [{ state: "output-error" }, "✕"],
  [{ state: "input-available" }, "⟳"],
])("toolGlyph %o", (part, glyph) => expect(toolGlyph(part)).toBe(glyph));

// chat-panel-body.dom.test.ts
test("runToolCall answers once the canonical body is stored", async () => { /*
  await runToolCall("set_prop", { id: "b-1", path: "body", value: "<div>Hei</div>" }) → { status: "applied" },
  and bodyOf("b-1") is already "<p>Hei</p>" when it resolves */ });

// copilot-panel.dom.test.tsx: DOM set-up as in rich/toolbar.dom.test.tsx. Mock "@ai-sdk/react" before importing
// chat-panel, capturing the useChat options and returning { addToolOutput: spy, messages: shown, sendMessage: spy,
// status: "ready" }; restore the real module in afterAll, as blocks/text/wiring.test.tsx does for "./lazy-field".
test("the page's answer to its own tool goes back to the model with the turn's page state", async () => { /*
  render CopilotPanel; type "Hi" in "Ask the copilot…" and submit → sendMessage got ({ text: "Hi" }, { body: { pageContext: P } });
  chatOptions.onToolCall({ toolCall: { dynamic: false, input: { id: "b-1", path: "body.0.text", value: "x" }, toolCallId: "c1", toolName: "set_prop" } });
  await a tick → addToolOutput called once with { options: { body: { pageContext: P } }, output: { status: "error", message: stringContaining('path "body"') }, tool: "set_prop", toolCallId: "c1" } */ });
test("the server's own tools are left to the server", async () => { /* list_blocks call → addToolOutput not called */ });
test("the chat sends the answers on by itself, within the step cap", () => { /* chatOptions.sendAutomaticallyWhen === shouldContinue */ });
test("the input waits while a tool answer is pending", async () => { /*
  shown = [user, assistant with a tool part in "input-available"] → the input and Send are disabled;
  re-render with the part "output-available" → enabled */ });
test("a refused tool shows ✕ and an applied one ✓", async () => { /* two tool parts → the tool-name spans read "✕ set prop" and "✓ insert block" */ });
```

Write `userMsg`, `assistant`, `step` and `tool` as small local builders in `chat-panel.test.ts`, typed as `UIMessage` parts. The SDK's part shapes are in `node_modules/ai/src/ui/ui-messages.ts`.

- [ ] **Step 2: Run** `cd packages/editor && bun test src/ai src/components/editor-shell/copilot`. Expected: the new tests FAIL. `client-tools.ts`, `runToolCall` and the rest do not exist, the client tools still execute on the server, and the panel never calls `addToolOutput`.
- [ ] **Step 3: Implement** `client-tools.ts`, the six tools without `execute`, `runToolCall` and the helpers, the panel wiring, the prompt guideline and the route comment. Use `lastAssistantMessageIsCompleteWithToolCalls` from `ai`. Read `node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx` and `node_modules/ai/src/ui/chat.ts` (`addToolOutput`, `runAutomaticRequest`) before you wire it.
- [ ] **Step 4: Run** `bun test ./src` in `packages/editor`, root `bun run check-types`, and `bun run build --filter=admin`. The route is in a server file the type-check may not fully see. Expected: PASS, compiled.
- [ ] **Step 5: Commit**: `feat(editor): the page's answer to each copilot tool reaches the model`

---

### Task 4: New unit pages start with HTML text bodies

**Files:**
- Modify: `packages/editor/src/editor/templates.ts` (`text()` and its caller), `packages/wp-import/src/transform/html.ts` (header comment only)
- Test: `packages/editor/src/editor/templates.test.ts`

**Interfaces:**
- Produces: `text(heading: string, paragraph: string): Block`. Both arguments are plain text. The body is `` `<h2>${htmlText(heading)}</h2><p>${htmlText(paragraph)}</p>` ``. `unitPageTemplate` passes `copy.about(input.name)` unescaped, and the comment about the accounting-system name moves into `text()`.
- `packages/wp-import`: nothing in it writes a page's text block. It imports jobs, products and orders, and its `html.ts` writes description HTML for `DescriptionBlockEditor`. Add one sentence to the header comment of `src/transform/html.ts`: `Descriptions only: nothing in this package writes a page's text block (TextBlock.body), since pages are not imported.` No code change.

- [ ] **Step 1: Write the failing tests**

```ts
// templates.test.ts: heading() reads the body string's first <h2>; the escape test expects
// `<h2>Om Case &amp; Co &lt;img src=x onerror=alert(1)&gt;</h2><p>Fortell nye studenter hva dere gjør, når det skjer og hvorfor de bør bli med.</p>`
// (en: `<h2>About Case &amp; Co …</h2><p>Tell new students what you do, when it happens and why they should join.</p>`).
mock.module("server-only", () => ({}));
const { sanitizeRichBodyHtml } = await import("./sanitize-doc");
test("every template text body is the HTML the field writes", () => {
  for (const kind of ["unit", "project"] as const) {
    for (const locale of ["no", "en"] as const) {
      const { sections } = unitPageTemplate({ campusLabel: "Oslo", kind, locale, name: "Case & Co" });
      for (const block of flat(sections).filter((b) => b.type === "text")) {
        expect(typeof block.body).toBe("string");
        expect(scanBody(block.body as string, 100)).toBe("canonical");
        expect(sanitizeRichBodyHtml(block.body as string)).toBe(block.body);
      }
    }
  }
});
```

- [ ] **Step 2: Run** `cd packages/editor && bun test src/editor/templates.test.ts`. Expected: FAIL, because the bodies are still arrays.
- [ ] **Step 3: Implement** `text()` and the caller, and add the wp-import comment.
- [ ] **Step 4: Run** `bun test ./src`, root `bun run check-types`, and `cd apps/admin && bun test src/lib` (the admin seeds department pages with this template; the count must not drop). Expected: PASS, except the known `content-translation.test.ts` failure.
- [ ] **Step 5: Commit**: `feat(editor): new unit pages start with HTML text bodies`

---

### Task 5: Translation keeps a formatted body intact

The translator gets a text body as one field with `format: "html"`. `translatePublishedPage` in `_actions/pages.ts` runs the result through `sanitizePageDocHtml` before it saves. These tests pin both steps. They are expected to pass at once, because nothing here should lose `data-color`, `colspan`, `rowspan`, `start` or the table structure. If one fails, that is the defect the ruling asks for. Fix it where the test points. Check first that `sanitizePageDocHtml` runs on every save path of translated HTML. Then check that `translatePageDocument` passes the body whole and writes it back whole. Pin the fix with the failing test.

**Files:**
- Test: `apps/admin/src/lib/page-document-translation.test.ts`, `apps/admin/src/app/(portal)/_actions/pages-translation.cases.ts`
- Modify (only if a test fails): `apps/admin/src/lib/page-document-translation.ts`, `apps/admin/src/app/(portal)/_actions/pages.ts`

**Fixtures** (both files; the second is the first in English):
```ts
const RICH_NO =
  '<h2>Om oss</h2><p>Vi er <strong>studenter</strong> i <a href="https://biso.no">BISO</a>. <span data-color="accent">Velkommen!</span></p>' +
  '<ul><li>Ett<ul><li>To</li></ul></li></ul><ol start="3"><li>Tre</li></ol>' +
  '<table><thead><tr><th colspan="2">Kontakt</th></tr></thead><tbody><tr><td rowspan="2">Oslo</td><td><span data-color="red">Viktig</span></td></tr><tr><td><em>Bergen</em></td></tr></tbody></table>' +
  "<blockquote>Sitat</blockquote><hr><p><u>Under</u> og <s>over</s></p>";
const RICH_EN =
  '<h2>About us</h2><p>We are <strong>students</strong> at <a href="https://biso.no">BISO</a>. <span data-color="accent">Welcome!</span></p>' +
  '<ul><li>One<ul><li>Two</li></ul></li></ul><ol start="3"><li>Three</li></ol>' +
  '<table><thead><tr><th colspan="2">Contact</th></tr></thead><tbody><tr><td rowspan="2">Oslo</td><td><span data-color="red">Important</span></td></tr><tr><td><em>Bergen</em></td></tr></tbody></table>' +
  "<blockquote>Quote</blockquote><hr><p><u>Under</u> and <s>over</s></p>";
```

- [ ] **Step 1: Write the tests**

```ts
// page-document-translation.test.ts
mock.module("server-only", () => ({}));
const { sanitizePageDocHtml } = await import("@repo/editor/sanitize");
const richDoc = (body: string) => ({ meta: { department: "", slug: "x", status: "draft", title: "Om oss" },
  sections: [{ columns: [{ blocks: [{ body, id: "t-1", type: "text" }], id: "c-1" }], id: "s-1", layout: {} }],
  version: 2 }) as unknown as PageDoc;
const bodyIn = (doc: PageDoc) => (doc.sections[0].columns[0].blocks[0] as { body: string }).body;

describe("a formatted text body", () => {
  test("goes to the translator whole, as HTML, and comes back whole", async () => {
    const seen: TranslationField[] = [];
    const translated = await translatePageDocument(
      { document: richDoc(RICH_NO), sourceLocale: "no", targetLocale: "en" },
      async ({ fields }) => { seen.push(...fields);
        return Object.fromEntries(fields.map((f) => [f.key, f.value === RICH_NO ? RICH_EN : f.value])); });
    expect(seen.find((f) => f.value === RICH_NO)?.format).toBe("html");
    expect(bodyIn(translated)).toBe(RICH_EN);
  });
  test("keeps its lists, table, colours and links through the save's sanitiser", () => {
    expect(bodyIn(sanitizePageDocHtml(richDoc(RICH_EN)))).toBe(RICH_EN);
  });
  test("loses what a model adds around the formatting, and keeps the formatting", () => {
    const sloppy = RICH_EN.replace("<table>", '<table class="x">')
      .replace('<td rowspan="2">', '<td style="color:red" rowspan="2">')
      .replace("<h2>", '<h2 style="font-family:Calibri">');
    expect(bodyIn(sanitizePageDocHtml(richDoc(sloppy)))).toBe(RICH_EN);
  });
});

// pages-translation.cases.ts, in "page auto-translation: rich text"
test("a translated rich body keeps its lists, table, colours and links when it is saved", async () => { /*
  translatePageDocumentSpy.mockImplementationOnce → translatedDocument with one text block whose body is RICH_EN with a
  style attribute added on a cell; publishNorwegianWithTranslation(); await deferredTask?.() → the saved draft's
  sections[0].columns[0].blocks[0].body === RICH_EN */ });
```

- [ ] **Step 2: Run** `cd apps/admin && bun test src/lib/page-document-translation.test.ts && bun test src/app/\(portal\)/_actions/content-translation-actions.test.ts`. Expected: PASS. If anything fails, fix it as the task intro says, and re-run.
- [ ] **Step 3: Run** `bun test src/lib` in `apps/admin` and root `bun run check-types`. Expected: PASS, except the known `content-translation.test.ts` failure; admin `src/lib` count up by 3.
- [ ] **Step 4: Commit**: `test(admin): a formatted text body survives translation and the save`. If a fix was needed, use `fix(admin): …` naming what was lost.

---

### Task 6: Docs pages

Follow `apps/docs/CLAUDE.md` for front matter, the six-part task page shape, plain English and sentence case, labels named as on screen, no placeholders, and every claim checked against the code. The editor chrome is English, so name its labels in English.

**Files:**
- Modify: `apps/docs/content/docs/guide/pages-and-news/edit-a-page.mdx`
- Modify: `apps/docs/content/docs/developers/change-it/code-layout.mdx`, `apps/docs/content/docs/developers/change-it/common-changes.mdx`
- Modify: `apps/docs/content/docs/developers/reference/ai.mdx`, `apps/docs/content/docs/developers/reference/packages.mdx`. The PR check flags both for this branch: `ai.mdx` covers `packages/editor/src/ai/**` and the chat route, and `packages.mdx` covers `packages/editor/package.json` and `serialize.ts`.

**What each page must say:**
- **`edit-a-page.mdx`:**
  - A new step, `<Step title="Write in a Rich text block">`, after "Add blocks", for staff:
    - **The field and its toolbar.** The **Text** section has one writing field. The toolbar row holds **Text style** (Heading, Subheading, Paragraph, Quote), **B**, **I**, **U**, **A** (*Text colour*), the link button (*Link*), *Bullet list*, *Numbered list*, **⊞** (*Insert table*) and **⋯** (*More formatting*: **Strikethrough**, **Divider**, **Clear formatting**). It wraps onto two rows in a narrow panel.
    - **Shortcuts.** Ctrl/Cmd+B, I, U and K. `- ` or `* ` starts a bullet list and `1. ` a numbered one. Tab and Shift+Tab nest list items.
    - **On the page.** Click into the text and type. Select text to get the dark bar with Text style, B, I, U, colour, link and both lists; tables and ⋯ are only in the panel.
    - **⤢ Expand.** It opens the same field wide over the editor, with the same toolbar. The page updates behind it. **Close** or Esc returns, and choosing another block closes it.
    - **Colours.** **Default**, **Accent**, **Muted**, **Green**, **Amber** and **Red** come from the page's theme. They follow the department's colours and stay readable on dark sections. There is no free colour picker, and a link keeps its link colour.
    - **Tables.** ⊞ adds a 3 × 3 table with a header row. With the caret in a table, a second row of controls shows: **Row** (*Insert row above*, *Insert row below*, *Delete row*), **Column** (*Insert column left*, *Insert column right*, *Delete column*), **Header row** and **Delete table**. Tab moves to the next cell, and Tab in the last cell adds a row. In a cell, style, lists, ⊞ and **Divider** are off. Enter at the very start of a table that opens the text adds a line above it.
    - **Pasting** from Word (Mac, Windows, Word on the web), Google Docs or a web page keeps:
      - headings (the biggest becomes Heading, the rest Subheading);
      - paragraphs and quotes;
      - bullet and numbered lists, with nesting and numbering that carries on after a break;
      - tables, with the header row and merged cells;
      - bold, italic, underline, strikethrough and links;
      - colours, as the nearest of the six. Ordinary black or grey text, and colours on headings and links, come without colour.

      Fonts, sizes, spacing, backgrounds, highlights, comments and pictures are dropped. A dropped picture shows *Images aren't pasted into text — use an Image block.* In plain text, blank lines make paragraphs, lines starting with `-`, `*` or `•` make a bullet list, and numbered lines that count on make a numbered list. A single line like "17. mai" stays text.
    - **Undo.** Ctrl/Cmd+Z in the field undoes your typing one pause at a time; a pause of a second starts a new step. Then it carries on into the page's own undo. Ctrl/Cmd+Shift+Z redoes. A copilot change is its own step.
  - In "Add blocks", replace the line about Bold, Italic, Link and Remove formatting with a pointer to the new step. Add: the copilot can write and change Rich text, including lists, tables and colours, and it says when it couldn't make a change.
  - In "Arrange…", replace "This doesn't work while you're typing in a field" with what the code does now. In a Rich text field, undo continues into the page's (above). In other fields it undoes only that field's typing (`EditorShell`'s key handler skips inputs, text areas and other editable text). Click outside to undo page changes.
  - In "Write the other language", add: translation keeps Rich text formatting (lists, tables, colours, links).
  - In "What the student sees", add: a wide table scrolls sideways inside itself on a phone, and coloured text uses the department's colours.
  - In "Common mistakes", add: pasting pictures into text; colouring whole paragraphs; expecting Word's fonts and sizes.
  - In `covers`, add `packages/shared/utils/text-colours.ts` and `packages/shared/utils/text-colour-tokens.ts`.
- **`code-layout.mdx`:**
  - In "Where things live", add a row for the Rich text block: `packages/editor/src/blocks/text/` (render, inspector, body shapes in `body.ts`, Expand in `expand.tsx`) and `blocks/text/rich/` (the Plate field, HTML in and out in `html.ts`, paste in `paste.ts`, tables, toolbar and bubble).
  - Add a convention bullet, **Plate stays in `blocks/text/rich/`**. Nothing outside it imports `platejs`, `@platejs/*` or `rich/`; `lazy-field.ts` and `canonical-body.ts` reach in by dynamic import, so the public site never loads Plate; `blocks/text/rich-confinement.test.ts` enforces it.
  - In `covers`, add `packages/editor/src/blocks/text/lazy-field.ts`, `packages/editor/src/blocks/text/canonical-body.ts` and `packages/editor/src/blocks/text/rich-confinement.test.ts`.
- **`common-changes.mdx`:**
  - A new recipe, "Change what the Rich text block can hold" (a tag, an attribute or a colour), in order:
    1. `lib/rich-allowlist.ts`: tags in `BODY_TAGS`, attributes in `BODY_ATTRIBUTE_RULES`. Both sanitisers and `scanBody` read it, so they stay in lockstep; `lib/rich-allowlist.test.ts` runs every case through both.
    2. The Plate plugin in `rich/plugins.ts` and `rich/react-plugins.tsx`.
    3. The serializer in `rich/html.ts`: it writes the canonical form, which must stay a fixed point and canonical for `scanBody` (`rich/fixed-point.test.ts`).
    4. The paste normaliser `rich/paste.ts`, if it comes from the clipboard.
    5. The public look in `blocks/text/render-classes.ts` and `packages/ui/styles/globals.css`. For a colour, also `packages/shared/utils/text-colour-tokens.ts`, `text-colours.ts` and the `--ink-*` variables in `packages/ui/styles/biso-surface.css`.
    6. The copilot's prompt, `ai/prompt.ts`; `ai/prompt.test.ts` checks it against `BODY_TAGS`.
    7. The checks: the editor tests and the chunk check (Task 7).
  - Explain the body shape:
    - `TextBlock.body` is a sanitised HTML string, or a legacy `TextBodyItem[]` that still renders with the old markup and is never migrated;
    - the editor writes HTML on a block's first edit, and so do templates and the copilot;
    - `packages/wp-import` writes no page text blocks.
  - Explain the canonical fast path. `sanitizeRichBodyHtml` asks `scanBody` (`editor/body-scan.ts`) whether a body is canonical: canonical bodies are sanitised in linear time, other bodies under 10,000 tags go through sanitize-html with a nesting limit of 100, and anything larger becomes text paragraphs.
  - Update the "A block that renders HTML" bullet to match.
  - In `covers`, add `packages/editor/src/lib/rich-allowlist.ts`, `packages/editor/src/lib/sanitize.ts`, `packages/editor/src/editor/body-scan.ts`, `packages/editor/src/blocks/text/body.ts`, `packages/editor/src/blocks/text/rich/html.ts` and `packages/editor/src/editor/templates.ts`.
- **`ai.mdx`:**
  - A short section on the page editor copilot:
    - the tools that change the page run in the browser (`applyToolCall` in `chat-panel.tsx`), and each one's answer goes back to the model;
    - the chat continues by itself until the model stops calling tools, at most `COPILOT_MAX_STEPS` (12) steps a turn, while the route's `isStepCount(12)` is per request;
    - `list_blocks` and `generate_copy` run on the server;
    - a refusal reaches the model as `status: "error"`;
    - the page state holds every text block's body, cut at 2,000 characters.
  - In `covers`, add `packages/editor/src/components/editor-shell/copilot/chat-panel.tsx` and `packages/editor/src/editor/serialize.ts`.
- **`packages.mdx`:** the `@repo/editor` intro adds that the Rich text field is Plate.js, loaded only in edit mode. A new sharp edge: Plate stays in `src/blocks/text/rich/`, with the guard test.

- [ ] **Step 1: Write** the pages. Check every label against `rich/toolbar.tsx`, `table-bar.tsx`, `more-menu.tsx`, `colour-menu.tsx`, `commands.ts` (`STYLE_LABELS`), `inspector.tsx` and `expand.tsx`. Check every behaviour against the tests.
- [ ] **Step 2: Run** `cd apps/docs && bun test` and `bun run check-types --filter=docs`. Expected: PASS, docs count not dropped.
- [ ] **Step 3: Run** the PR check on the branch: `git -c core.quotepath=false diff --name-only "$(git merge-base main HEAD)...HEAD" > "$SCRATCH/changed.txt" && bun apps/docs/scripts/page-coverage/cli.ts --changed "$SCRATCH/changed.txt"`, with `SCRATCH` your scratchpad. Expected:
  - no dead-glob or malformed-`covers` warning;
  - no stale warning for the five pages above;
  - stale warnings left only for `developers/change-it/local-setup.mdx` and `developers/keep-it-running/deploying.mdx`. Both are flagged by the two catalog lines added to the root `package.json` (`@platejs/autoformat`, `@platejs/floating`). Read both pages' parts on the catalog and the deploy scripts: if they are still accurate, leave them, and Task 7 lists the two warnings as expected.
- [ ] **Step 4: Commit**: `docs: rich text in the page guide and the developer pages`

---

### Task 7: Go-live checklist, stage verification, spec note

**Files:**
- Create: `docs/superpowers/rich-text-go-live.md`
- Modify: `docs/superpowers/specs/2026-11-03-rich-text-editor-design.md` (append "Stage 3 done")
- Fixes go to whichever file a check points at.

- [ ] **Step 1: Write the go-live checklist** for Markus, in plain language, with three parts.
  - **Check by hand before deploying.** Each item says what to do and what you should see. It includes every owner hand check in the spec's Stage 1 and Stage 2 notes, plus:
    - a real Word paste on Mac and on Windows, and a Google Docs paste. Use one document with Heading 1 and 2, nested bullets, a numbered list broken by a paragraph, a red word, a link, a table with a header row and a merged cell, and a picture;
    - VoiceOver (Safari) and NVDA reading a table on biso.no;
    - coloured text on white, tinted, dark and photo sections, under BISO and one department theme;
    - Expand at a short window;
    - undo across the panel, the canvas and the copilot: type, pause, type, then Cmd+Z twice and Cmd+Shift+Z; type in the panel, then Cmd+Z on the canvas; ask the copilot to change the text, then Cmd+Z in the field;
    - select-all, then type, paste or Delete in a text that opens with a table;
    - the copilot writing a text with a table and colour, changing a text block that isn't selected, and saying it couldn't do something it was refused (a column that doesn't exist);
    - **Translate to EN** on a page with a list, a merged-cell table and colour;
    - a new unit page's "About …" text.
  - **Deploying:**
    - Deploy web and admin from the same commit, web first and admin straight after. The new web renders both body shapes; the old web shows an HTML body as nothing.
    - No schema change and no `appwrite push`: the body is a field inside the page document.
    - Existing pages render unchanged. Each text block converts when someone edits it.
    - After the deploy, open a few published pages with Rich text and compare.
    - The docs pages go out with the next docs deploy.
    - The PR docs check will still flag `local-setup.mdx` and `deploying.mdx` (root `package.json` catalog lines; checked, still accurate).
  - **Rolling back.** Check main's `blocks/text/render.tsx` and `inspector.tsx` (`git show main:…`) and describe what they do with a string body. Rolling back before anyone saves in the new editor is clean. After that, the old site and the old editor show those text blocks as empty, and editing one in the old editor replaces its text. The text itself stays in the page and shows again on redeploy. So fix forward; if you must roll back, roll back both and don't edit those pages until you redeploy.

  Commit: `docs(editor): rich text go-live checklist`.
- [ ] **Step 2: Lint** the branch's files only: `git diff --name-only --diff-filter=d $(git merge-base main HEAD)...HEAD -- '*.ts' '*.tsx' '*.css' '*.json' | xargs bun x ultracite fix`, then the same with `check`. Expected: no errors in those files.
- [ ] **Step 3: Types**: `bun run check-types --force` at the root. Expected: every task successful, none cached.
- [ ] **Step 4: Tests**:
  - `cd packages/editor && bun test ./src` (at least 1746 plus every test this plan adds, 0 fail)
  - `cd packages/shared && bun x vitest run`
  - `cd apps/web && bun x vitest run`
  - `cd apps/admin && bun test src/app/\(portal\)/_actions/content-translation-actions.test.ts && bun test src/lib`
  - `cd apps/docs && bun test`

  Expected: PASS, except the known admin `content-translation.test.ts` failure. Record it.
- [ ] **Step 5: Builds and the bundle split**: `bun run build --filter=admin --force`, `bun run build --filter=web --force` and `bun run build --filter=docs --force`. All three exit 0; if the docs build stops on a missing environment variable, record the message. Then check:
  - `comm -12 <(grep -rl "richPaste" apps/web/.next/static/chunks | sort) <(grep -rl "type-display-sm break-words hyphens-auto" apps/web/.next/static/chunks | sort)` prints nothing;
  - `grep -rl "richPaste" apps/web/.next/static/chunks | wc -l` is at least 1;
  - `grep -rlE 'data-color=("|)accent' apps/web/.next/static/css | wc -l` is at least 1.
- [ ] **Step 6: The docs check**: run Task 6 Step 3's command again. Expected: the same two warnings, and nothing else.
- [ ] **Step 7: Report** every command above with its raw output: the summary lines, the counts and the chunk check output.
- [ ] **Step 8: Spec note.** Append "Stage 3 done (date)" to the spec in plain language, with the same parts as the Stage 1 and Stage 2 notes:
  - what was built;
  - every judgment call made while building and its cost if wrong. Include the rulings this plan settled: client tools with a 12-step cap; bodies cut at 2,000 characters; the lone-number rule kept for chunks that start no list; Enter also opening a line between two tables; templates escaping inside `text()`; and wp-import writing no page text blocks, which corrects the spec's starting points;
  - what was deferred;
  - owner hand checks, which point to `docs/superpowers/rich-text-go-live.md`;
  - the verification numbers.
- [ ] **Step 9: Commit** each fix that Steps 2–6 needed on its own (`fix(…)`), then the spec note: `docs(editor): stage 3 notes`.
