import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { textSwatches } from "@repo/shared/utils/text-colours";
import { Window } from "happy-dom";
import { createSlatePlugin, type Value } from "platejs";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";
import {
  normalizePastedHtml,
  pastedImageCount,
  plainTextToHtml,
} from "./paste";
import { RichPastePlugin } from "./paste-plugin";

const previous = {
  DOMParser: globalThis.DOMParser,
  Node: globalThis.Node,
  document: globalThis.document,
  window: globalThis.window,
};

beforeAll(() => {
  const window = new Window();
  globalThis.window = window as unknown as typeof globalThis.window;
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
  globalThis.DOMParser = window.DOMParser as unknown as typeof DOMParser;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

const FIXTURES = join(import.meta.dir, "fixtures");
const fixture = (name: string): string =>
  readFileSync(join(FIXTURES, `${name}.html`), "utf8");

/** The clipboard as Plate reads it: `types`, `getData` and `files`. */
const clipboard = (entries: Record<string, string>): DataTransfer =>
  ({
    files: [],
    getData: (type: string) => entries[type] ?? "",
    types: Object.keys(entries),
  }) as unknown as DataTransfer;

const SLATE_FRAGMENT = "application/x-slate-fragment";

/** The editor after pasting `data` at the end of `startHtml`. */
function pastedEditor(
  data: DataTransfer,
  startHtml = "",
  paste: typeof RichPastePlugin = RichPastePlugin
) {
  const editor = createConversionEditor([paste]);
  editor.tf.setValue(htmlToValue(startHtml));
  editor.tf.select(editor.api.end([]));
  editor.tf.insertData(data);
  return editor;
}

function pasteData(data: DataTransfer, startHtml = ""): string {
  return valueToHtml(pastedEditor(data, startHtml).children);
}

function pasteInto(
  html: string | null,
  plain?: string,
  startHtml = ""
): string {
  const entries: Record<string, string> = {};
  if (html !== null) {
    entries["text/html"] = html;
  }
  if (plain !== undefined) {
    entries["text/plain"] = plain;
  }
  return pasteData(clipboard(entries), startHtml);
}

const EXPECTED =
  "<h2>Campus Management</h2>" +
  "<p>Made up of student leaders who take on <strong>responsibility</strong> for the student experience.</p>" +
  "<h3>Core responsibilities</h3>" +
  "<ul><li>Sustainability and academic development</li><li>Student welfare<ul><li>Mental health</li></ul></li><li>Finance</li></ul>" +
  "<ol><li>Plan the semester</li></ol>" +
  "<p>Then, once the plan is approved:</p>" +
  '<ol start="2"><li>Run the events</li></ol>' +
  '<p>Read the <em>full</em> <u>handbook</u> at <a href="https://biso.no">biso.no</a>.</p>';

// Desktop Word's `color:#C00000` run is the one colour the reference
// document holds; every other source writes only body ink and link colours.
const EXPECTED_WORD = EXPECTED.replace(
  "for the student experience.",
  'for the <span data-color="red">student experience</span>.'
);

test.each([
  ["word-desktop", EXPECTED_WORD],
  ["google-docs", EXPECTED],
  ["word-web", EXPECTED],
  ["web-page", EXPECTED],
])("%s pastes as the reference document", (name, expected) => {
  const out = pasteInto(fixture(name));
  expect(out).toBe(expected);
  expect(valueToHtml(htmlToValue(out))).toBe(out);
});

// One three-row table in each source's markup: a bold first row (a header
// row on the web page), a mailto link, and a last row merged across.
const TABLE_EXPECTED =
  "<table><tbody><tr><td><strong>Campus</strong></td><td><strong>Contact</strong></td></tr>" +
  '<tr><td>Oslo</td><td><a href="mailto:oslo@biso.no">oslo@biso.no</a></td></tr>' +
  '<tr><td colspan="2">Bergen opens in spring</td></tr></tbody></table>';
const WEB_TABLE_EXPECTED =
  "<p>Contacts</p><table><thead><tr><th>Campus</th><th>Contact</th></tr></thead><tbody>" +
  '<tr><td>Oslo</td><td><a href="mailto:oslo@biso.no">oslo@biso.no</a></td></tr>' +
  '<tr><td colspan="2">Bergen opens in spring</td></tr></tbody></table>';

test.each([
  "word-desktop",
  "google-docs",
  "word-web",
])("%s table pastes as a real table", (name) => {
  const out = pasteInto(fixture(`${name}-table`));
  expect(out).toBe(TABLE_EXPECTED);
  expect(valueToHtml(htmlToValue(out))).toBe(out);
});

test("a web page table keeps its header row and caption", () => {
  const out = pasteInto(fixture("web-page-table"));
  expect(out).toBe(WEB_TABLE_EXPECTED);
  expect(valueToHtml(htmlToValue(out))).toBe(out);
});

test("a pasted cell's paragraphs are its lines", () => {
  expect(
    pasteInto(
      "<table><tr><td><p>a</p><p><b>b</b></p></td><td>c</td></tr></table>"
    )
  ).toBe(
    "<table><tbody><tr><td>a<br><strong>b</strong></td><td>c</td></tr></tbody></table>"
  );
});

/** An empty line with the caret in it, before or between existing tables. */
function editorAtEmptyLine(tablesAround: "before" | "between") {
  const [table] = htmlToValue(
    "<table><tbody><tr><td>t</td></tr></tbody></table>"
  );
  const line = { type: "p", children: [{ text: "" }] };
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(
    tablesAround === "before"
      ? [line, table as Value[number]]
      : [table as Value[number], line, structuredClone(table) as Value[number]]
  );
  const at = tablesAround === "before" ? 0 : 1;
  editor.tf.select(editor.api.start([at]));
  return { at, editor };
}

// A paste that adds nothing (an image, an empty mark, a blank paragraph)
// leaves the caret's empty line, and the caret, where they were.
test.each([
  ["before", '<img src="x.png" alt="Logo">'],
  ["before", "<b></b>"],
  ["before", "<p> </p>"],
  ["between", '<img src="x.png" alt="Logo">'],
])("a paste that adds nothing keeps the empty line %s tables: %s", (tablesAround, html) => {
  const { at, editor } = editorAtEmptyLine(
    tablesAround as "before" | "between"
  );
  const before = structuredClone(editor.children);
  editor.tf.insertData(clipboard({ "text/html": html }));
  expect(editor.children).toEqual(before);
  expect(editor.selection?.anchor.path).toEqual([at, 0]);
});

test("a table pasted into an empty line before a table replaces the line", () => {
  const { editor } = editorAtEmptyLine("before");
  editor.tf.insertData(
    clipboard({ "text/html": "<table><tr><td>new</td></tr></table>" })
  );
  expect(editor.children[0]?.type).toBe("table");
  expect(valueToHtml(editor.children)).toBe(
    "<table><tbody><tr><td>new</td></tr></tbody></table><table><tbody><tr><td>t</td></tr></tbody></table>"
  );
});

test("a pasted table into an empty field is just the table", () => {
  const editor = pastedEditor(
    clipboard({ "text/html": "<table><tr><td>a</td></tr></table>" })
  );
  expect(valueToHtml(editor.children)).toBe(
    "<table><tbody><tr><td>a</td></tr></tbody></table>"
  );
  expect(editor.children[0]?.type).toBe("table");
});

const IN_CELL =
  "<p>before</p><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table><p>after</p>";

/** A field's editor (node ids on) holding `IN_CELL`, the caret after "x". */
function editorInCell() {
  const editor = createConversionEditor([RichPastePlugin], { nodeId: true });
  editor.tf.setValue(htmlToValue(IN_CELL));
  editor.tf.normalize({ force: true });
  editor.tf.select(editor.api.end([1, 0, 0]));
  return editor;
}

// Paste never nests a table and never writes over cells.
test("text and a table pasted into a cell go after the table, whole", () => {
  const editor = editorInCell();
  const table = structuredClone(editor.children[1]);
  editor.tf.insertData(
    clipboard({
      "text/html":
        "<p>Intro</p><table><caption>Contacts</caption><thead><tr><th>Campus</th><th>Who</th></tr></thead>" +
        '<tbody><tr><td rowspan="2">Oslo</td><td>Ada</td></tr><tr><td>Bo</td></tr></tbody></table><p>Outro</p>',
    })
  );
  expect(valueToHtml(editor.children)).toBe(
    "<p>before</p><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>" +
      "<p>Intro</p><p>Contacts</p><table><thead><tr><th>Campus</th><th>Who</th></tr></thead>" +
      '<tbody><tr><td rowspan="2">Oslo</td><td>Ada</td></tr><tr><td>Bo</td></tr></tbody></table>' +
      "<p>Outro</p><p>after</p>"
  );
  expect(editor.children[1]).toEqual(table);
  expect(editor.selection?.anchor).toEqual(editor.api.end([5]));
});

test("a table alone pasted into a cell goes after the table", () => {
  const editor = editorInCell();
  const table = structuredClone(editor.children[1]);
  editor.tf.insertData(
    clipboard({ "text/html": "<table><tr><td>a</td><td>b</td></tr></table>" })
  );
  expect(valueToHtml(editor.children)).toBe(
    "<p>before</p><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>" +
      "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>after</p>"
  );
  expect(editor.children[1]).toEqual(table);
});

test("a table copied in the field and pasted into a cell goes after the table", () => {
  const editor = editorInCell();
  const [copied] = htmlToValue("<table><tr><td>a</td><td>b</td></tr></table>");
  editor.tf.insertFragment([copied as Value[number]]);
  expect(valueToHtml(editor.children)).toBe(
    "<p>before</p><table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>" +
      "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table><p>after</p>"
  );
});

test("a paste with no table into a cell stays in the cell, its blocks as lines", () => {
  const editor = editorInCell();
  editor.tf.insertData(
    clipboard({ "text/html": "<p><b>one</b></p><h2>two</h2>" })
  );
  expect(valueToHtml(editor.children)).toBe(
    "<p>before</p><table><tbody><tr><td>x<strong>one</strong><br>two</td><td>y</td></tr></tbody></table><p>after</p>"
  );
});

/** A field's editor (node ids on) holding `start`, all of it selected. */
function selectedAll(start: string, backward: boolean) {
  const editor = createConversionEditor([RichPastePlugin], { nodeId: true });
  editor.tf.setValue(htmlToValue(start));
  const all = editor.api.range([]);
  if (!all) {
    throw new Error("no text");
  }
  editor.tf.select(backward ? { anchor: all.focus, focus: all.anchor } : all);
  return editor;
}

const OPENS_WITH_TABLE =
  "<table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>";

// Select-all, either way, then a paste replaces everything, tables too, and
// leaves a plain line for it: no empty list item, no divider.
test.each([
  [
    "<p>before</p><table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>",
    "<p>New</p>",
    "<p>New</p>",
  ],
  [
    "<table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>",
    "<p>New</p>",
    "<p>New</p>",
  ],
  [
    "<table><tbody><tr><td>a</td></tr></tbody></table><p>after</p>",
    "<table><tr><td>x</td><td>y</td></tr></table>",
    "<table><tbody><tr><td>x</td><td>y</td></tr></tbody></table>",
  ],
  [
    "<ul><li>x</li></ul><p>y</p>",
    "<table><tr><td>t</td></tr></table>",
    "<table><tbody><tr><td>t</td></tr></tbody></table>",
  ],
  ["<hr><p>x</p>", "<p>New</p>", "<p>New</p>"],
])("pasting a table over a select-all replaces the whole text, even one that opens with a table: %s", (start, pasted, out) => {
  for (const backward of [false, true]) {
    const editor = selectedAll(start, backward);
    editor.tf.insertData(clipboard({ "text/html": pasted }));
    expect(valueToHtml(editor.children)).toBe(out);
  }
});

test("plain text with lines pasted over a select-all replaces the whole text", () => {
  for (const backward of [false, true]) {
    const editor = selectedAll(OPENS_WITH_TABLE, backward);
    editor.tf.insertData(clipboard({ "text/plain": "one\ntwo" }));
    expect(valueToHtml(editor.children)).toBe("<p>one<br>two</p>");
  }
});

test("a fragment inserted over a select-all replaces the whole text, even one that opens with a table", () => {
  for (const backward of [false, true]) {
    const editor = selectedAll(OPENS_WITH_TABLE, backward);
    const [copied] = htmlToValue("<table><tr><td>x</td></tr></table>");
    editor.tf.insertFragment([copied as Value[number]]);
    expect(valueToHtml(editor.children)).toBe(
      "<table><tbody><tr><td>x</td></tr></tbody></table>"
    );
  }
});

/** What a screenshot puts on the clipboard: an image file and no text. */
const screenshot = (): DataTransfer =>
  ({
    ...clipboard({}),
    files: [{ type: "image/png" }],
    types: ["Files"],
  }) as unknown as DataTransfer;

// A paste with nothing the text keeps leaves the text as it was.
test.each([
  [
    "an image alone in HTML",
    () => clipboard({ "text/html": '<p><img src="x.png"></p>' }),
    1,
  ],
  ["a screenshot", screenshot, 1],
  ["an empty clipboard", () => clipboard({}), 0],
])("a paste of %s over a select-all keeps the text", (_, data, notices) => {
  for (const start of ["<p>Keep me</p>", OPENS_WITH_TABLE]) {
    for (const backward of [false, true]) {
      const editor = selectedAll(start, backward);
      const kept = valueToHtml(editor.children);
      editor.tf.insertData(data());
      expect(valueToHtml(editor.children)).toBe(kept);
      expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(notices);
    }
  }
});

// Each fixture keeps the source markup it stands in for, so an edit cannot
// quietly turn it into easy HTML.
test.each([
  ["word-desktop", 'xmlns:o="urn:schemas-microsoft-com:office:office"'],
  ["word-desktop", "@list l0:level1"],
  ["word-desktop", "<!--[if !supportLists]-->"],
  ["word-desktop", "<span style='mso-list:Ignore'>·"],
  ["word-desktop", "class=MsoListParagraphCxSpFirst"],
  ["word-desktop", "class=MsoListParagraphCxSpMiddle"],
  ["word-desktop", "class=MsoListParagraphCxSpLast"],
  ["word-desktop", "mso-list:l0 level2 lfo1"],
  ["word-desktop", "<o:p></o:p>"],
  ["word-desktop", "font-family:Calibri"],
  ["word-desktop", "color:#C00000"],
  ["word-desktop", "<span\nstyle='mso-list:Ignore'>2."],
  ["google-docs", '<meta charset="utf-8">'],
  ["google-docs", '<b style="font-weight:normal;" id="docs-internal-guid-'],
  ["google-docs", "font-weight:700"],
  ["google-docs", "font-style:italic"],
  ["google-docs", "text-decoration:underline"],
  ["google-docs", 'dir="ltr"'],
  ["google-docs", 'aria-level="1"><p dir="ltr"'],
  ["google-docs", 'role="presentation"'],
  ["google-docs", 'aria-level="2"'],
  ["google-docs", 'start="2"'],
  ["word-web", 'class="OutlineElement'],
  ["word-web", 'class="Paragraph'],
  ["word-web", 'class="TextRun'],
  ["word-web", 'class="NormalTextRun'],
  ["word-web", 'class="EOP'],
  ["word-web", 'role="heading" aria-level="1"'],
  ["word-web", 'data-aria-level="1"'],
  ["word-web", 'data-aria-level="2"'],
  ["word-web", 'role="list" start="2"'],
  ["web-page", '<img src="x.png"'],
  ["web-page", "<script>alert(1)</script>"],
  ["web-page", '<iframe src="https://example.com"'],
  ["web-page", '<ol start="2"'],
  ["web-page", "<strong"],
  ["web-page", "<em"],
  ["web-page", "<u>"],
  ["web-page", 'class="'],
  ["web-page", 'style="'],
  ["word-desktop-table", "class=MsoTableGrid"],
  ["word-desktop-table", "<td width="],
  ["word-desktop-table", "valign=top"],
  ["word-desktop-table", "<p class=MsoNormal"],
  ["word-desktop-table", "<o:p></o:p>"],
  ["word-desktop-table", "<b>"],
  ["word-desktop-table", "colspan=2"],
  [
    "google-docs-table",
    '<b style="font-weight:normal;" id="docs-internal-guid-',
  ],
  [
    "google-docs-table",
    '<div dir="ltr" style="margin-left:0pt;" align="left">',
  ],
  ["google-docs-table", "<colgroup>"],
  ["google-docs-table", '<p dir="ltr"'],
  ["google-docs-table", "font-weight:700"],
  ["google-docs-table", "color:#000000"],
  ["google-docs-table", 'colspan="2"'],
  ["word-web-table", 'class="TableContainer'],
  ["word-web-table", 'class="Table '],
  ["word-web-table", 'class="TableCellElement'],
  ["word-web-table", 'class="TableCellContent'],
  ["word-web-table", 'class="OutlineElement'],
  ["word-web-table", 'class="Paragraph'],
  ["word-web-table", 'class="TextRun'],
  ["word-web-table", "font-weight: bold"],
  ["word-web-table", 'colspan="2"'],
  ["web-page-table", "<caption>Contacts</caption>"],
  ["web-page-table", '<thead><tr><th scope="col"'],
  ["web-page-table", 'class="'],
  ["web-page-table", 'style="'],
  ["web-page-table", "color: rgb(55, 65, 81)"],
  ["web-page-table", 'colspan="2"'],
])("the %s fixture holds %s", (name, marker) => {
  expect(fixture(name)).toContain(marker);
});

test("the reported bug: a pasted three-item list into an empty list item gives three items", () => {
  expect(
    pasteInto(
      "<ul><li>A</li><li>B</li><li>C</li></ul>",
      undefined,
      "<ul><li></li></ul>"
    )
  ).toBe("<ul><li>A</li><li>B</li><li>C</li></ul>");
});

test("web fixture drops scripts, frames, images and styles", () => {
  const out = pasteInto(fixture("web-page"));
  for (const bad of [
    "<script",
    "<iframe",
    "<img",
    "style=",
    "class=",
    "alert",
  ]) {
    expect(out).not.toContain(bad);
  }
});

const WORD_GLYPH = /[·§]|&nbsp;/;

test("no Word bullet glyphs survive", () => {
  expect(pasteInto(fixture("word-desktop"))).not.toMatch(WORD_GLYPH);
});

test.each([
  ["- a\n- b", "<ul><li>a</li><li>b</li></ul>"],
  ["• a\n* b", "<ul><li>a</li><li>b</li></ul>"],
  ["1. a\n2) b", "<ol><li>a</li><li>b</li></ol>"],
  ["p1\n\np2", "<p>p1</p><p>p2</p>"],
  ["line1\r\nline2", "<p>line1<br>line2</p>"],
  ["3. a\n4. b", '<ol start="3"><li>a</li><li>b</li></ol>'],
  // A numbered line on its own is a list only when it is number 1. (On its
  // own and with no line break, it goes in as it is: see below.)
  ["17. mai: Frokost\n", "<p>17. mai: Frokost</p>"],
  ["1. Plan", "<ol><li>Plan</li></ol>"],
  ["1) Plan", "<ol><li>Plan</li></ol>"],
  ["Program\n17. mai: Frokost", "<p>Program<br>17. mai: Frokost</p>"],
  ["Steps:\n1. Plan", "<p>Steps:</p><ol><li>Plan</li></ol>"],
  ["1. a", "<ol><li>a</li></ol>"],
  // Marker lines are a list wherever they sit in a chunk; the lines between
  // them stay a paragraph.
  [
    "Intro\n- a\n- b\nOutro",
    "<p>Intro</p><ul><li>a</li><li>b</li></ul><p>Outro</p>",
  ],
  [
    "Steps:\n3. c\n4. d",
    '<p>Steps:</p><ol start="3"><li>c</li><li>d</li></ol>',
  ],
  [
    "- a\nnote one\nnote two\n- b",
    "<ul><li>a</li></ul><p>note one<br>note two</p><ul><li>b</li></ul>",
  ],
  ["- a\n1. b", "<ul><li>a</li></ul><ol><li>b</li></ol>"],
  // A numbered run is a list only when it counts on by one; dates and other
  // numbered lines stay text, in the paragraph around them.
  [
    "Program\n17. mai: Frokost\n24. mai: Tur",
    "<p>Program<br>17. mai: Frokost<br>24. mai: Tur</p>",
  ],
  ["3. a\n4. b", '<ol start="3"><li>a</li><li>b</li></ol>'],
  ["1. a\n3. b", "<p>1. a<br>3. b</p>"],
  ["1. a\n2. b\n2. c", "<p>1. a<br>2. b<br>2. c</p>"],
  ["- a\n1. b\n2. c", "<ul><li>a</li></ul><ol><li>b</li><li>c</li></ol>"],
  // Numbered lines after a blank line carry on the list before it when they
  // count on from its last number; no other runs join across a blank line.
  [
    "1. One\n\n2. Two\n\n3. Three",
    "<ol><li>One</li><li>Two</li><li>Three</li></ol>",
  ],
  [
    "Agenda\n\n1. Welcome\n\n2. Budget",
    "<p>Agenda</p><ol><li>Welcome</li><li>Budget</li></ol>",
  ],
  ["1. a\n2. b\n\n3. c", "<ol><li>a</li><li>b</li><li>c</li></ol>"],
  ["3. a\n4. b\n\n5. c", '<ol start="3"><li>a</li><li>b</li><li>c</li></ol>'],
  ["1. a\n2. b\n\n4. c", "<ol><li>a</li><li>b</li></ol><p>4. c</p>"],
  ["1. One\n\n2. Two\nmore", "<ol><li>One</li><li>Two</li></ol><p>more</p>"],
  [
    "1. One\n\nA paragraph\n\n2. Two",
    "<ol><li>One</li></ol><p>A paragraph</p><p>2. Two</p>",
  ],
  [
    "Program\n\n17. mai: Frokost\n\n18. mai: Tur",
    "<p>Program</p><p>17. mai: Frokost</p><p>18. mai: Tur</p>",
  ],
])("plain text %p", (plain, html) => expect(pasteInto(null, plain)).toBe(html));

test("plain text that looks like markup stays text", () => {
  expect(pasteInto(null, "<b>x</b> & y\n- <i>z</i>")).toBe(
    "<p>&lt;b&gt;x&lt;/b&gt; &amp; y</p><ul><li>&lt;i&gt;z&lt;/i&gt;</li></ul>"
  );
});

test("plain text: list and paragraph lines mix, and several blank lines are one break", () => {
  expect(plainTextToHtml("Intro\n\n\n- a\n- b\n\n1. c\n2. d\nnot a list")).toBe(
    "<p>Intro</p><ul><li>a</li><li>b</li></ul><ol><li>c</li><li>d</li></ol><p>not a list</p>"
  );
});

test.each([
  ["<h2>A</h2><h3>B</h3>", "<h2>A</h2><h3>B</h3>"],
  ["<h1>A</h1><h2>B</h2><h4>C</h4>", "<h2>A</h2><h3>B</h3><h3>C</h3>"],
  ["<h3>A</h3>", "<h2>A</h2>"],
])("relative heading shift %s", (input, out) =>
  expect(normalizePastedHtml(input)).toBe(out));

test("comments, Word's XML and head elements go, with their content", () => {
  expect(
    normalizePastedHtml(
      "<!--[if gte mso 9]><xml><w:WordDocument>Normal</w:WordDocument></xml><![endif]-->" +
        '<meta charset="utf-8"><title>Doc</title><link rel=File-List href="x.xml"><style>p{}</style>' +
        "<xml><o:shapelayout>1</o:shapelayout></xml><p>a<o:p>&nbsp;</o:p></p><script>alert(1)</script>"
    )
  ).toBe("<p>a</p>");
});

test("what the body sanitiser drops with its content goes here too", () => {
  expect(
    pasteInto(
      "<p>a</p><noscript>Turn on JavaScript</noscript><svg><title>Logo</title></svg><textarea>draft</textarea>"
    )
  ).toBe("<p>a</p>");
});

test("Google Docs' wrapper is unwrapped", () => {
  expect(
    normalizePastedHtml(
      '<b style="font-weight:normal;" id="docs-internal-guid-1a2b"><p>a</p></b><b>bold</b>'
    )
  ).toBe("<p>a</p><b>bold</b>");
});

test("Word's Title paragraph is the top heading", () => {
  expect(
    normalizePastedHtml("<p class=MsoTitle>T</p><h1>A</h1><h2>B</h2>")
  ).toBe("<h2>T</h2><h2>A</h2><h3>B</h3>");
});

test("Word on the web's heading paragraphs are headings", () => {
  expect(
    normalizePastedHtml(
      '<p role="heading" aria-level="1">A</p><p role="heading" aria-level="2">B</p><p>c</p>'
    )
  ).toBe("<h2>A</h2><h3>B</h3><p>c</p>");
});

// A line break outside a `p` is in a span of its own (`keepLineBreaks`), so
// Plate reads it as a line break, as it does a stored body's.
test("paragraphs inside a list item or a quote are joined by line breaks", () => {
  expect(normalizePastedHtml("<ul><li><p>a</p><p>b</p></li></ul>")).toBe(
    "<ul><li>a<span><br></span>b</li></ul>"
  );
  expect(normalizePastedHtml("<blockquote><p>a</p><p>b</p></blockquote>")).toBe(
    "<blockquote>a<span><br></span>b</blockquote>"
  );
  expect(normalizePastedHtml("<ul><li><p>a</p>tail</li></ul>")).toBe(
    "<ul><li>a<span><br></span>tail</li></ul>"
  );
  expect(normalizePastedHtml("<ul><li><p>a</p><p><br></p></li></ul>")).toBe(
    "<ul><li>a</li></ul>"
  );
  expect(
    pasteInto(
      "<ul><li><p>a</p><p>b</p></li></ul><blockquote><p>c</p><p>d</p></blockquote>"
    )
  ).toBe("<ul><li>a<br>b</li></ul><blockquote>c<br>d</blockquote>");
});

// Line-per-block sources. Plate has no parser for div, dt or dd, so without
// the structure step their lines ran together.
const GMAIL =
  '<div dir="ltr"><div>Velkommen til semesteret.</div><div>Mvh Ola</div></div>';
const GMAIL_FIRST_LINE_BARE =
  '<div dir="ltr">Velkommen til semesteret.<div>Mvh Ola</div></div>';
const APPLE_NOTES =
  '<meta charset="UTF-8"><div style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0); font-style: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; text-align: start; text-indent: 0px; text-transform: none; white-space: normal; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none;"><b>Agenda</b></div><div style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0); font-style: normal;">First point</div><div style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0); font-style: normal;">Second point</div>';
const OUTLOOK_WEB =
  '<div class="elementToProof" style="font-family: Aptos, Aptos_EmbeddedFont, Aptos_MSFontService, Calibri, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0);">Hei alle,</div><div class="elementToProof" style="font-family: Aptos, Aptos_EmbeddedFont, Aptos_MSFontService, Calibri, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0);"><br></div><div class="elementToProof" style="font-family: Aptos, Aptos_EmbeddedFont, Aptos_MSFontService, Calibri, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0);">Møtet flyttes til <b>torsdag</b>.</div><div class="elementToProof" style="font-family: Aptos, Aptos_EmbeddedFont, Aptos_MSFontService, Calibri, Helvetica, sans-serif; font-size: 12pt; color: rgb(0, 0, 0);">Hilsen Kari</div>';
const SHEETS_TABLE =
  '<google-sheets-html-origin><style type="text/css"><!--td {border: 1px solid #cccccc;}br {mso-data-placement:same-cell;}--></style><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1" style="table-layout:fixed;font-size:10pt;font-family:Arial;width:0px;border-collapse:collapse;border:none" data-sheets-root="1"><colgroup><col width="100"><col width="160"></colgroup><tbody><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;">Name</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;">Email</td></tr><tr style="height:21px;"><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;">Kari</td><td style="overflow:hidden;padding:2px 3px 2px 3px;vertical-align:bottom;"><a class="in-cell-link" href="mailto:kari@biso.no" target="_blank">kari@biso.no</a></td></tr></tbody></table></google-sheets-html-origin>';
const WEB_TABLE =
  "<table>\n  <caption>Board</caption>\n  <thead>\n    <tr><th>Name </th><th>Email</th></tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>Kari</td>\n      <td>kari@biso.no\n      </td>\n    </tr>\n  </tbody>\n</table>";

test.each([
  ["Gmail", GMAIL, "<p>Velkommen til semesteret.</p><p>Mvh Ola</p>"],
  [
    "Gmail, first line bare",
    GMAIL_FIRST_LINE_BARE,
    "<p>Velkommen til semesteret.</p><p>Mvh Ola</p>",
  ],
  [
    "Apple Notes",
    APPLE_NOTES,
    "<p><strong>Agenda</strong></p><p>First point</p><p>Second point</p>",
  ],
  [
    "Outlook on the web",
    OUTLOOK_WEB,
    "<p>Hei alle,</p><p>Møtet flyttes til <strong>torsdag</strong>.</p><p>Hilsen Kari</p>",
  ],
  [
    "a definition list",
    "<dl><dt>Fadder</dt><dd>A student who shows new students around.</dd></dl>",
    "<p>Fadder</p><p>A student who shows new students around.</p>",
  ],
])("%s pastes one paragraph per line", (_, html, out) => {
  expect(pasteInto(html)).toBe(out);
});

test.each([
  [
    "a Google Sheets 2×2 table",
    SHEETS_TABLE,
    '<table><tbody><tr><td>Name</td><td>Email</td></tr><tr><td>Kari</td><td><a href="mailto:kari@biso.no">kari@biso.no</a></td></tr></tbody></table>',
  ],
  [
    "a web table with a caption and header cells",
    WEB_TABLE,
    "<p>Board</p><table><thead><tr><th>Name</th><th>Email</th></tr></thead><tbody><tr><td>Kari</td><td>kari@biso.no</td></tr></tbody></table>",
  ],
])("%s pastes as a table", (_, html, out) => {
  expect(pasteInto(html)).toBe(out);
});

test("paragraphs a span wraps inside a list item or a quote are joined by line breaks", () => {
  expect(
    pasteInto(
      '<ul><li><span style="color:#c00000"><p>alpha</p><p>beta</p></span></li></ul>'
    )
  ).toBe("<ul><li>alpha<br>beta</li></ul>");
  expect(
    pasteInto(
      '<blockquote><span style="font-weight:700"><p>alpha</p><p>beta</p></span></blockquote>'
    )
  ).toBe(
    "<blockquote><strong>alpha</strong><br><strong>beta</strong></blockquote>"
  );
});

test("lines inside a list item are joined by line breaks", () => {
  expect(pasteInto("<ul><li><div>a</div><div>b</div></li></ul>")).toBe(
    "<ul><li>a<br>b</li></ul>"
  );
  expect(pasteInto("<ul><li><div><p>a</p><p>b</p></div></li></ul>")).toBe(
    "<ul><li>a<br>b</li></ul>"
  );
});

test("a nested list stays out of the joined item text", () => {
  expect(
    pasteInto("<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>")
  ).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
});

// Plate collapses whitespace at the end of a block to one space but keeps it,
// so the source formatting of a web page would leave "welfare " behind.
test("whitespace at the end of a block's text goes", () => {
  expect(
    pasteInto(
      "<ul>\n  <li>a\n    <ul><li>b</li></ul>\n  </li>\n</ul>\n<p>c <b>d </b> </p>"
    )
  ).toBe("<ul><li>a<ul><li>b</li></ul></li></ul><p>c <strong>d</strong></p>");
});

// Desktop Word, one paragraph per item: the level comes from `mso-list`, and
// the number from the marker Word writes as text.
const wordItem = (marker: string, level: number, text: string): string =>
  `<p class=MsoListParagraph style='mso-list:l1\nlevel${level} lfo2'><span style='mso-list:Ignore'>${marker}<span>&nbsp;&nbsp; </span></span>${text}</p>`;

test("Word list runs keep their levels, styles and starting number", () => {
  expect(
    pasteInto(
      wordItem("3.", 1, "c") +
        wordItem("a)", 2, "c1") +
        wordItem("(b)", 2, "c2") +
        wordItem("·", 3, "deep") +
        wordItem("4.", 1, "d")
    )
  ).toBe(
    '<ol start="3"><li>c<ol><li>c1</li><li>c2<ul><li>deep</li></ul></li></ol></li><li>d</li></ol>'
  );
});

test("a Word level that skips one nests one level, in order", () => {
  expect(
    pasteInto(
      wordItem("·", 1, "a") + wordItem("·", 3, "deep") + wordItem("·", 2, "mid")
    )
  ).toBe("<ul><li>a<ul><li>deep</li><li>mid</li></ul></li></ul>");
  // One sublist, not two: "deep" is at depth 2 before Plate sees it.
  expect(
    normalizePastedHtml(
      wordItem("·", 1, "a") + wordItem("·", 3, "deep") + wordItem("·", 2, "mid")
    )
  ).toBe("<ul><li>a</li><ul><li>deep</li><li>mid</li></ul></ul>");
});

test("Word items that skip the same level are siblings", () => {
  expect(
    pasteInto(
      wordItem("·", 1, "a") + wordItem("·", 3, "b") + wordItem("·", 3, "c")
    )
  ).toBe("<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>");
});

test("two sublists of one Word item keep their order", () => {
  expect(
    pasteInto(
      wordItem("1.", 1, "c") + wordItem("a)", 2, "c1") + wordItem("·", 2, "c2")
    )
  ).toBe("<ol><li>c<ol><li>c1</li></ol><ul><li>c2</li></ul></li></ol>");
});

test("two sublists of one web list item keep their order", () => {
  expect(
    pasteInto("<ul><li>a<ul><li>x</li></ul><ol><li>y</li></ol></li></ul>")
  ).toBe("<ul><li>a<ul><li>x</li></ul><ol><li>y</li></ol></li></ul>");
});

// Word numbers headings with the same `mso-list` style and marker span as
// list paragraphs.
test("a numbered Word heading stays a heading and keeps its number", () => {
  expect(
    pasteInto(
      "<h1 style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>1.<span>&nbsp;&nbsp;</span></span>Introduction</h1>"
    )
  ).toBe("<h2>1. Introduction</h2>");
  expect(
    normalizePastedHtml(
      "<h1 style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>1.<span>&nbsp;&nbsp;</span></span>Introduction</h1>"
    )
  ).toBe("<h2>1. Introduction</h2>");
});

test("a numbered heading right after a list paragraph ends the run", () => {
  expect(
    pasteInto(
      `${wordItem("·", 1, "a")}<h2 style='mso-list:l1 level2 lfo2'><span style='mso-list:Ignore'>1.1<span>&nbsp;</span></span>Scope</h2>${wordItem("·", 1, "b")}`
    )
  ).toBe("<ul><li>a</li></ul><h2>1.1 Scope</h2><ul><li>b</li></ul>");
});

test("a numbered Word Title keeps its number", () => {
  expect(
    pasteInto(
      "<p class=MsoTitle style='mso-list:l2 level1 lfo3'><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span>Plan</p>"
    )
  ).toBe("<h2>1. Plan</h2>");
});

test("Word 2016+'s downlevel conditional around the glyph", () => {
  expect(
    pasteInto(
      "<p class=MsoListParagraph style='text-indent:-18.0pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt \"Times New Roman\"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]><span lang=EN-GB>One</span></p>"
    )
  ).toBe("<ul><li>One</li></ul>");
});

test("whitespace between Word list paragraphs is part of the run; text ends it", () => {
  expect(
    normalizePastedHtml(
      `${wordItem("1.", 1, "a")}\n  \n${wordItem("2.", 1, "b")}`
    )
  ).toBe("<ol><li>a</li><li>b</li></ol>");
  expect(
    normalizePastedHtml(`${wordItem("1.", 1, "a")}x${wordItem("2.", 1, "b")}`)
  ).toBe('<ol><li>a</li></ol>x<ol start="2"><li>b</li></ol>');
});

test.each([
  "aria-level",
  "data-aria-level",
])("%s nests list items", (attribute) => {
  expect(
    pasteInto(
      `<ul><li ${attribute}="1"><p>a</p></li></ul><ul><li ${attribute}="2"><p>b</p></li></ul>`
    )
  ).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
});

/** Each list item's `indent` in the editor value: what the canvas shows. */
const listIndents = (value: Value): unknown[] =>
  value
    .filter((node) => typeof node.listStyleType === "string")
    .map((node) => node.indent);

// The canvas draws an item at its `indent`; the save writes `effectiveDepths`
// of each run. A pasted list must already be at the depths it saves at.
test.each([
  "aria-level",
  "data-aria-level",
])("a %s sublist pasted with the paragraph above it sits at its saved depths", (attribute) => {
  const editor = pastedEditor(
    clipboard({
      "text/html": `<p>Intro</p><ul><li ${attribute}="2"><p>x</p></li><li ${attribute}="3"><p>y</p></li></ul>`,
    })
  );
  expect(listIndents(editor.children)).toEqual([1, 2]);
  expect(valueToHtml(editor.children)).toBe(
    "<p>Intro</p><ul><li>x<ul><li>y</li></ul></li></ul>"
  );
});

test("a sublist pasted at the end of a paragraph: the item left after the merge sits at its saved depth", () => {
  const editor = pastedEditor(
    clipboard({
      "text/html":
        '<ul><li aria-level="2"><p>x</p></li><li aria-level="3"><p>y</p></li></ul>',
    }),
    "<p>Intro</p>"
  );
  expect(listIndents(editor.children)).toEqual([1]);
  expect(valueToHtml(editor.children)).toBe("<p>Introx</p><ul><li>y</li></ul>");
});

test("a link's own underline is its look, not a mark", () => {
  expect(
    pasteInto(
      '<p><a href="https://biso.no"><span style="text-decoration:underline">x</span></a> <u>y</u></p>'
    )
  ).toBe('<p><a href="https://biso.no">x</a> <u>y</u></p>');
});

// ── Colour ──
// A pasted colour takes the nearest swatch, or none: a colour on a block, in
// a heading or on a link is the source's layout, and so is the colour most
// of the text is in.

const PURPLE_SWATCHES = textSwatches({ dark: "#3b1c6b", accent: "#fecd45" });

test.each([
  [
    '<p>a <span style="color:#C00000">b</span></p>',
    '<p>a <span data-color="red">b</span></p>',
  ],
  [
    '<p>a <font color="#0070c0">b</font></p>',
    '<p>a <span data-color="accent">b</span></p>',
  ],
  [
    '<p>a <span style="background-color:#c00000;-webkit-tap-highlight-color:transparent">b</span></p>',
    "<p>a b</p>",
  ],
  ['<p>a <span style="color:#7030a0">b</span></p>', "<p>a b</p>"],
  ['<p style="color:#c00000">a</p>', "<p>a</p>"],
  [
    '<h2><span style="color:#c00000">T</span></h2><p>x</p>',
    "<h2>T</h2><p>x</p>",
  ],
  [
    '<p><a href="https://biso.no"><span style="color:#0563c1">l</span></a> x</p>',
    '<p><a href="https://biso.no">l</a> x</p>',
  ],
  [
    '<p><span style="color:#c00000">a<span style="color:#00b050">b</span></span> c</p>',
    '<p><span data-color="red">a</span><span data-color="green">b</span> c</p>',
  ],
  // Word on the web writes `!important`; a browser copy writes `rgb()`.
  [
    '<p>a <span style="color: rgb(192, 0, 0) !important">b</span></p>',
    '<p>a <span data-color="red">b</span></p>',
  ],
  // Any inline element maps; one that is not a span gets a span inside.
  [
    '<p>a <b style="color:#c00000">b</b></p>',
    '<p>a <span data-color="red"><strong>b</strong></span></p>',
  ],
  ['<div style="color:#c00000">a</div>', "<p>a</p>"],
  ['<p>a <cite style="color:#c00000">b</cite></p>', "<p>a b</p>"],
  // Body ink is no colour.
  ['<p>a <span style="color:#000000">b</span></p>', "<p>a b</p>"],
])("pasted colour %s", (input, out) => {
  expect(pasteInto(input)).toBe(out);
});

// Each text is in the colour of the innermost element that sets one, as a
// browser paints it: body ink inside a coloured run is no colour, and a link
// inside one keeps none.
test.each([
  [
    '<p><span style="color:#c00000">a <span style="color:#000000">b</span></span> c d e</p>',
    '<p><span data-color="red">a </span>b c d e</p>',
  ],
  [
    '<p><span style="color:#c00000">see <a href="https://biso.no">here</a> now</span> and some more plain words</p>',
    '<p><span data-color="red">see </span><a href="https://biso.no">here</a><span data-color="red"> now</span> and some more plain words</p>',
  ],
])("the innermost colour %s", (input, out) => {
  expect(pasteInto(input)).toBe(out);
});

// Colour comes from CSS alone. A copy from a page that stores tokens carries
// the colour it paints in (a browser inlines it), which maps back.
test.each([
  ['<p><span data-color="red">a</span> b</p>', "<p>a b</p>"],
  [
    '<p><span data-color="red" style="color: rgb(179, 38, 30)">a</span> b</p>',
    '<p><span data-color="red">a</span> b</p>',
  ],
  [
    '<h2><span data-color="red" style="color: rgb(179, 38, 30)">T</span></h2><p>x</p>',
    "<h2>T</h2><p>x</p>",
  ],
])("a pasted colour token %s is read from its CSS colour", (input, out) => {
  expect(pasteInto(input)).toBe(out);
});

test("a colour on most of the paste is the source's text colour and is dropped", () => {
  expect(
    pasteInto(
      '<p><span style="color:#595959">all</span></p><p><span style="color:#595959">of it</span></p>'
    )
  ).toBe("<p>all</p><p>of it</p>");
});

test("grey body with one red word keeps only the red", () => {
  expect(
    pasteInto(
      '<p><span style="color:#595959">Most of the text is grey and </span><span style="color:#c00000">red</span></p><p><span style="color:#595959">so is this line</span></p>'
    )
  ).toBe(
    '<p>Most of the text is grey and <span data-color="red">red</span></p><p>so is this line</p>'
  );
});

test("a colour on exactly half of the text is the writer's", () => {
  expect(
    pasteInto('<p><span style="color:#c00000">ab</span></p><p>cd</p>')
  ).toBe('<p><span data-color="red">ab</span></p><p>cd</p>');
});

test("the text colour is dropped and the rest of the span's style kept", () => {
  expect(
    pasteInto(
      '<p><span style="color:#595959;font-weight:700">all bold</span></p><p><span style="color:#595959">x</span></p>'
    )
  ).toBe("<p><strong>all bold</strong></p><p>x</p>");
});

// A word or a line is all the writer's: the text colour rule needs at least
// two blocks of text to tell the source's colour from the writer's.
test.each([
  [
    '<span style="color:#c00000">red</span>',
    '<p><span data-color="red">red</span></p>',
  ],
  [
    '<p><span style="color:#c00000">A whole sentence in red.</span></p>',
    '<p><span data-color="red">A whole sentence in red.</span></p>',
  ],
  [
    '<ul><li><span style="color:#c00000">one red item</span></li></ul>',
    '<ul><li><span data-color="red">one red item</span></li></ul>',
  ],
])("a single block in one colour keeps it: %s", (input, out) => {
  expect(pasteInto(input)).toBe(out);
});

// Chrome and Safari wrap a one-paragraph copy in the page's text colour,
// and the common body greys map to Muted: that is the source's text.
test.each([
  "#4b5563",
  "#6b7280",
  "#444",
  "#555",
  "#595959",
  "#666",
  "#5f6368",
])("a single block in the body grey %s comes with no colour", (grey) => {
  expect(
    pasteInto(
      `<span style="color: ${grey}; font-family: Inter;">A whole paragraph copied from a web page.</span>`
    )
  ).toBe("<p>A whole paragraph copied from a web page.</p>");
  expect(
    pasteInto(
      `<p class=MsoNormal><span style="color:${grey}">A paragraph from Word in a grey.</span></p>`
    )
  ).toBe("<p>A paragraph from Word in a grey.</p>");
});

test("a single block's grey goes and its red word stays", () => {
  expect(
    pasteInto(
      '<span style="color: rgb(75, 85, 99)">Grey body with one <span style="color:#c00000">red</span> word.</span>'
    )
  ).toBe('<p>Grey body with one <span data-color="red">red</span> word.</p>');
});

test.each([
  [
    "two list items",
    '<ul><li><span style="color:#595959">one</span></li><li><span style="color:#595959">two</span></li></ul>',
    "<ul><li>one</li><li>two</li></ul>",
  ],
  [
    "two table cells",
    '<table><tr><td><span style="color:#595959">one</span></td><td><span style="color:#595959">two</span></td></tr></table>',
    "<table><tbody><tr><td>one</td><td>two</td></tr></tbody></table>",
  ],
])("a colour over most of %s is the source's text colour", (_, input, out) => {
  expect(pasteInto(input)).toBe(out);
});

// Only text takes a colour: white space between blocks inside a coloured
// run would otherwise be a line of its own in a cell.
test("white space in a coloured run adds no line to a cell", () => {
  expect(
    pasteInto(
      '<table><tr><td><span style="color:#c00000"><p>a</p>\n<p>b</p></span></td><td>plain words here</td></tr></table>'
    )
  ).toBe(
    '<table><tbody><tr><td><span data-color="red">a</span><br><span data-color="red">b</span></td><td>plain words here</td></tr></tbody></table>'
  );
});

// Word marks a bookmark with an `<a>` that has no href: not a link.
test("a colour inside a Word bookmark is kept", () => {
  expect(
    pasteInto(
      `<p><a name="_Hlk150000001"><span style='color:#C00000'>red</span></a> and plain words here</p>`
    )
  ).toBe('<p><span data-color="red">red</span> and plain words here</p>');
});

test("heading and link text do not count towards the text colour", () => {
  expect(
    pasteInto(
      '<h2>A heading longer than the text</h2><p><span style="color:#c00000">red</span> x <a href="https://biso.no">a long link text</a></p>'
    )
  ).toBe(
    '<h2>A heading longer than the text</h2><p>red x <a href="https://biso.no">a long link text</a></p>'
  );
});

test("colours map against the page's own theme", () => {
  expect(
    normalizePastedHtml(
      '<p>a <span style="color:#fecd45">b</span></p>',
      PURPLE_SWATCHES
    )
  ).toContain('data-color="accent"');
  expect(
    normalizePastedHtml('<p>a <span style="color:#fecd45">b</span></p>')
  ).not.toContain("data-color");
});

test("the paste plugin maps colours against its swatches option", () => {
  const html = '<p>a <span style="color:#fecd45">b</span></p>';
  expect(pasteInto(html)).toBe("<p>a b</p>");
  const configured = pastedEditor(
    clipboard({ "text/html": html }),
    "",
    RichPastePlugin.configure({ options: { swatches: PURPLE_SWATCHES } })
  );
  expect(valueToHtml(configured.children)).toBe(
    '<p>a <span data-color="accent">b</span></p>'
  );
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(htmlToValue(""));
  editor.tf.select(editor.api.end([]));
  editor.setOption(RichPastePlugin, "swatches", PURPLE_SWATCHES);
  editor.tf.insertData(clipboard({ "text/html": html }));
  expect(valueToHtml(editor.children)).toBe(
    '<p>a <span data-color="accent">b</span></p>'
  );
});

// Paste reads a line break as loading a stored body does (`keepLineBreaks`).
test("a line break between marked runs in a list item stays a line break", () => {
  expect(pasteInto("<ul><li><strong>a</strong><br><em>b</em></li></ul>")).toBe(
    "<ul><li><strong>a</strong><br><em>b</em></li></ul>"
  );
});

test("Word on the web's end-of-paragraph mark and Chrome's trailing newline add nothing", () => {
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(htmlToValue(""));
  editor.tf.select(editor.api.end([]));
  editor.tf.insertData(
    clipboard({
      "text/html":
        '<p>a<span class="EOP">&nbsp;</span></p><br class="Apple-interchange-newline">',
    })
  );
  expect(editor.children).toEqual([{ type: "p", children: [{ text: "a" }] }]);
});

/**
 * A plugin below `RichPastePlugin` that records what reaches Plate's own
 * paste. With `forward: false` it stops there: a headless editor has no
 * plain-text insert, and its stub only warns.
 */
function recordingEditor({ forward = true } = {}) {
  const seen: DataTransfer[] = [];
  const recorder = createSlatePlugin({ key: "recordPaste" }).overrideEditor(
    ({ tf: { insertData } }) => ({
      transforms: {
        insertData(data: DataTransfer) {
          seen.push(data);
          if (forward) {
            insertData(data);
          }
        },
      },
    })
  );
  const editor = createConversionEditor([recorder, RichPastePlugin]);
  editor.tf.setValue(htmlToValue(""));
  editor.tf.select(editor.api.end([]));
  return { editor, seen };
}

test("an in-editor copy (slate fragment) bypasses the normaliser", () => {
  const { editor, seen } = recordingEditor();
  const fragment = [{ type: "h3", children: [{ text: "from the fragment" }] }];
  const data = clipboard({
    [SLATE_FRAGMENT]: window.btoa(encodeURIComponent(JSON.stringify(fragment))),
    "text/html": "<h3>from the html</h3>",
  });
  editor.tf.insertData(data);
  expect(seen).toEqual([data]);
  expect(seen[0]).toBe(data);
  expect(valueToHtml(editor.children)).toBe("<h3>from the fragment</h3>");
});

test("HTML reaches Plate normalised; other formats and files pass through", () => {
  const { editor, seen } = recordingEditor();
  const files = { length: 1 } as unknown as FileList;
  const data = {
    ...clipboard({ "text/html": "<h3>A</h3>", "text/plain": "A" }),
    files,
  } as unknown as DataTransfer;
  editor.tf.insertData(data);
  const [received] = seen;
  expect(received?.getData("text/html")).toBe("<h2>A</h2>");
  expect(received?.getData("text/plain")).toBe("A");
  expect(received?.types).toEqual(["text/html", "text/plain"]);
  expect(received?.files).toBe(files);
});

test("plain text reaches Plate as HTML, with the text still there", () => {
  const { editor, seen } = recordingEditor();
  editor.tf.insertData(clipboard({ "text/plain": "- a" }));
  const [received] = seen;
  expect(received?.types).toEqual(["text/plain", "text/html"]);
  expect(received?.getData("text/html")).toBe("<ul><li>a</li></ul>");
  expect(received?.getData("text/plain")).toBe("- a");
  expect(valueToHtml(editor.children)).toBe("<ul><li>a</li></ul>");
});

// Plain text with no line break and no list marker goes to the editor as it
// is, so its spaces survive (" world" after "hello") and a bare URL still
// becomes a link.
test.each([
  "a < b",
  " world",
  "https://biso.no",
  "17. mai: Frokost",
])("single-line plain text %p passes through untouched", (text) => {
  const { editor, seen } = recordingEditor({ forward: false });
  const data = clipboard({ "text/plain": text });
  editor.tf.insertData(data);
  expect(seen).toEqual([data]);
  expect(seen[0]).toBe(data);
  expect(seen[0]?.types).toEqual(["text/plain"]);
});

test("a pasted bare URL becomes a link", () => {
  expect(pasteInto(null, "https://biso.no")).toBe(
    '<p><a href="https://biso.no">https://biso.no</a></p>'
  );
});

test.each([
  ['<p>a</p><img src="x.png"><p><img src="y.png"></p>', 2],
  [fixture("web-page"), 1],
  ["<p>no pictures</p>", 0],
  ['<p><v:imagedata src="x.png"></v:imagedata></p>', 1],
])("pastedImageCount %#", (html, n) => {
  expect(pastedImageCount(html)).toBe(n);
});

test("a paste that drops images counts one notice; text still pastes", () => {
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(htmlToValue(""));
  editor.tf.select(editor.api.end([]));
  expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(0);
  editor.tf.insertData(
    clipboard({ "text/html": '<p>a</p><img src="x.png"><img src="y.png">' })
  );
  expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(1);
  expect(valueToHtml(editor.children)).toBe("<p>a</p>");
  editor.tf.insertData(clipboard({ "text/html": "<p>b</p>" }));
  expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(1);
});

test("an image file on the clipboard counts a notice", () => {
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(htmlToValue(""));
  editor.tf.select(editor.api.end([]));
  const data = {
    ...clipboard({}),
    files: [{ type: "image/png" }],
  } as unknown as DataTransfer;
  editor.tf.insertData(data);
  expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(1);
  const text = {
    ...clipboard({}),
    files: [{ type: "text/plain" }],
  } as unknown as DataTransfer;
  editor.tf.insertData(text);
  expect(editor.getOption(RichPastePlugin, "imageNotices")).toBe(1);
});
