import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { createSlatePlugin } from "platejs";
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

function pasteData(data: DataTransfer, startHtml = ""): string {
  const editor = createConversionEditor([RichPastePlugin]);
  editor.tf.setValue(htmlToValue(startHtml));
  editor.tf.select(editor.api.end([]));
  editor.tf.insertData(data);
  return valueToHtml(editor.children);
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
  ["a < b", "<p>a &lt; b</p>"],
])("plain text %p", (plain, html) => expect(pasteInto(null, plain)).toBe(html));

test("plain text that looks like markup stays text", () => {
  expect(pasteInto(null, "<b>x</b> & y\n- <i>z</i>")).toBe(
    "<p>&lt;b&gt;x&lt;/b&gt; &amp; y<br>- &lt;i&gt;z&lt;/i&gt;</p>"
  );
});

test("plain text: list and paragraph chunks mix, and several blank lines are one break", () => {
  expect(plainTextToHtml("Intro\n\n\n- a\n- b\n\n1. c\n2. d\nnot a list")).toBe(
    "<p>Intro</p><ul><li>a</li><li>b</li></ul><p>1. c<br>2. d<br>not a list</p>"
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
    normalizePastedHtml(
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

test("Word on the web's data-aria-level nests list items", () => {
  expect(
    pasteInto(
      '<ul><li data-aria-level="1"><p>a</p></li></ul><ul><li data-aria-level="2"><p>b</p></li></ul>'
    )
  ).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
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

/** A plugin below `RichPastePlugin` that records what reaches Plate's own paste. */
function recordingEditor() {
  const seen: DataTransfer[] = [];
  const recorder = createSlatePlugin({ key: "recordPaste" }).overrideEditor(
    ({ tf: { insertData } }) => ({
      transforms: {
        insertData(data: DataTransfer) {
          seen.push(data);
          insertData(data);
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
