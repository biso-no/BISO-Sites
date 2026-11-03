import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { createSlatePlugin, type Value } from "platejs";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";
import { normalizePastedHtml, plainTextToHtml } from "./paste";
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
function pastedEditor(data: DataTransfer, startHtml = "") {
  const editor = createConversionEditor([RichPastePlugin]);
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

test.each([
  "word-desktop",
  "google-docs",
  "word-web",
  "web-page",
])("%s pastes as the reference document", (name) => {
  expect(pasteInto(fixture(name))).toBe(EXPECTED);
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

test("paragraphs inside a list item or a quote are joined by line breaks", () => {
  expect(normalizePastedHtml("<ul><li><p>a</p><p>b</p></li></ul>")).toBe(
    "<ul><li>a<br>b</li></ul>"
  );
  expect(normalizePastedHtml("<blockquote><p>a</p><p>b</p></blockquote>")).toBe(
    "<blockquote>a<br>b</blockquote>"
  );
  expect(normalizePastedHtml("<ul><li><p>a</p>tail</li></ul>")).toBe(
    "<ul><li>a<br>tail</li></ul>"
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

// Line-per-block sources. Plate has no parser for div, td, th, dt or dd, so
// without the structure step their lines and cells ran together.
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
    "a Google Sheets 2×2 table",
    SHEETS_TABLE,
    '<p>Name</p><p>Email</p><p>Kari</p><p><a href="mailto:kari@biso.no">kari@biso.no</a></p>',
  ],
  [
    "a web table with a caption and header cells",
    WEB_TABLE,
    "<p>Board</p><p>Name</p><p>Email</p><p>Kari</p><p>kari@biso.no</p>",
  ],
  [
    "a definition list",
    "<dl><dt>Fadder</dt><dd>A student who shows new students around.</dd></dl>",
    "<p>Fadder</p><p>A student who shows new students around.</p>",
  ],
])("%s pastes one paragraph per line or cell", (_, html, out) => {
  expect(pasteInto(html)).toBe(out);
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
