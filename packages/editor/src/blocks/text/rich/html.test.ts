import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  type Descendant,
  deserializeHtml,
  ElementApi,
  type TElement,
  type Value,
} from "platejs";
import { legacyBodyToHtml } from "../body";
import { toggleRichList } from "./commands";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";
import { effectiveDepths } from "./list-item-parse";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

const ROUND_TRIP = [
  "<h2>A</h2><p>B <strong>c</strong> <em>d</em> <u>e</u> <s>f</s></p>",
  "<p><strong><em>both</em></strong></p>",
  "<ul><li>a</li><li>b<ul><li>c</li></ul></li><li>d</li></ul>",
  '<ol><li>a</li></ol><p>x</p><ol start="2"><li>b</li><li>c</li></ol>',
  "<ul><li>a</li></ul><ol><li>b</li></ol>",
  "<blockquote>q</blockquote><hr>",
  "<p>line<br>break</p>",
  '<p><a href="https://biso.no">biso</a></p>',
  "<p>a &lt; b &amp; c</p>",
  '<p><span data-color="accent">a</span> <span data-color="red"><strong>b</strong></span></p>',
  '<h2><span data-color="muted">T</span></h2><ul><li><span data-color="green">x</span></li></ul>',
  '<p><a href="https://biso.no"><span data-color="amber">l</span></a></p>',
  "<table><thead><tr><th>Name</th><th>Role</th></tr></thead><tbody><tr><td>Ada</td><td><strong>Lead</strong></td></tr></tbody></table>",
  '<table><tbody><tr><td colspan="2">a</td></tr><tr><td rowspan="2">b</td><td>c</td></tr><tr><td>d</td></tr></tbody></table>',
  "<p>x</p><table><tbody><tr><td>a<br>b</td><td></td></tr></tbody></table><ul><li>y</li></ul>",
  '<table><tbody><tr><th>Row</th><td><a href="https://biso.no">l</a> <span data-color="red">r</span></td></tr></tbody></table>',
  "<table><thead><tr><th>Only header</th></tr></thead></table>",
];

test.each(ROUND_TRIP)("round-trips %s", (html) =>
  expect(valueToHtml(htmlToValue(html))).toBe(html));

test("colour sits outside the other marks", () => {
  expect(
    valueToHtml(
      htmlToValue('<p><strong><span data-color="red">b</span></strong></p>')
    )
  ).toBe('<p><span data-color="red"><strong>b</strong></span></p>');
});

// A browser paints each text in its innermost colour; so does the parse,
// through a link too, where Plate's own merge gives the outer one.
test.each([
  [
    '<p><span data-color="red">a<span data-color="green">b</span>c</span></p>',
    '<p><span data-color="red">a</span><span data-color="green">b</span><span data-color="red">c</span></p>',
  ],
  [
    '<p><span data-color="red"><a href="/x"><span data-color="green">t</span>u</a></span></p>',
    '<p><a href="/x"><span data-color="green">t</span><span data-color="red">u</span></a></p>',
  ],
  [
    '<p><span data-color="red"><strong>a<br>b</strong></span></p>',
    '<p><span data-color="red"><strong>a<br>b</strong></span></p>',
  ],
])("the innermost colour wins: %s", (html, out) => {
  expect(valueToHtml(htmlToValue(html))).toBe(out);
});

// Plate collapses these with other white space; HTML keeps them as text.
test("no-break and other kept spaces survive the parse", () => {
  const html = "<p>a  b %　c</p><ul><li> </li></ul>";
  expect(valueToHtml(htmlToValue(html))).toBe(html);
});

// Plate makes a lone `<br>` outside a `p` or `span` a paragraph of its own.
test.each([
  "<p>a<strong><br></strong>b</p>",
  '<h2><strong>a</strong><br><em>b</em></h2><ul><li><br></li><li><a href="/x"><br></a>c</li></ul>',
])("a line break on its own stays in its block: %s", (html) => {
  expect(valueToHtml(htmlToValue(html))).toBe(html);
});

test("an unknown colour is dropped, its text kept", () => {
  expect(
    valueToHtml([{ type: "p", children: [{ text: "x", color: "pink" }] }])
  ).toBe("<p>x</p>");
});

// Runs that print the same tags are one run, as a re-parse reads them, so
// the output is already a fixed point.
test.each<[name: string, children: Descendant[], html: string]>([
  [
    "same marks",
    [
      { text: "a", bold: true },
      { text: " b", bold: true },
    ],
    "<p><strong>a b</strong></p>",
  ],
  [
    "an unknown colour beside no colour",
    [
      { text: "a", bold: true, color: "pink" },
      { text: "b", bold: true },
    ],
    "<p><strong>ab</strong></p>",
  ],
  [
    "the same colour",
    [
      { text: "a", color: "red" },
      { text: "b", color: " red " },
    ],
    '<p><span data-color="red">ab</span></p>',
  ],
  [
    "an unsafe link between its neighbours",
    [
      { text: "a", italic: true },
      {
        type: "a",
        url: "javascript:x",
        children: [{ text: "b", italic: true }],
      },
      { text: "c", italic: true },
    ],
    "<p><em>abc</em></p>",
  ],
])("adjacent runs with the same tags are one run: %s", (_, children, html) => {
  expect(valueToHtml([{ type: "p", children }])).toBe(html);
  expect(valueToHtml(htmlToValue(html))).toBe(html);
});

test("split marks re-parse merged", () => {
  expect(
    valueToHtml(htmlToValue("<p><strong>a</strong><strong> b</strong></p>"))
  ).toBe("<p><strong>a b</strong></p>");
});

test("legacy bodies convert to canonical HTML", () => {
  const legacy = [
    { type: "h", text: "T" },
    { type: "li", text: "one" },
    { type: "li", text: "<b>two</b>" },
  ] as const;
  expect(valueToHtml(htmlToValue(legacyBodyToHtml([...legacy])))).toBe(
    "<h2>T</h2><ul><li>one</li><li><strong>two</strong></li></ul>"
  );
});

test("empty paragraphs are dropped; nothing is the empty string", () => {
  expect(valueToHtml(htmlToValue("<p></p><p>x</p><p> </p>"))).toBe("<p>x</p>");
  expect(valueToHtml(htmlToValue(""))).toBe("");
  expect(htmlToValue("")).toEqual([{ type: "p", children: [{ text: "" }] }]);
});

test("unsafe links lose the link, keep the text", () => {
  expect(valueToHtml(htmlToValue('<p><a href="javascript:x">t</a></p>'))).toBe(
    "<p>t</p>"
  );
});

// The list attributes below exist only in markup Plate deserializes unsanitised
// (paste). `htmlToValue` sanitises first, and the body allowlist keeps no
// `aria-level` or `data-*`, so these go through the conversion editor directly.
const deserialized = (html: string): string =>
  valueToHtml(
    deserializeHtml(createConversionEditor(), { element: html }) as Value
  );

test("aria-level drives nesting (Google Docs / Word on the web)", () => {
  expect(
    deserialized(
      '<ul><li aria-level="1">a</li></ul><ul><li aria-level="2">b</li></ul>'
    )
  ).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
});

test("data-indent and data-list-style-type, as Plate's paste transform writes them", () => {
  expect(
    deserialized(
      '<ul><li>a</li><li data-indent="2" data-list-style-type="decimal">b</li><li data-list-style-type="square">c</li></ul>'
    )
  ).toBe("<ul><li>a<ol><li>b</li></ol></li><li>c</li></ul>");
});

test("links both sanitisers keep survive the editor", () => {
  const html =
    '<p><a href="tel:+4712345678">t</a> <a href="?q=1">q</a> <a href="./x">d</a> <a href="mailto:a@biso.no">m</a></p>';
  expect(valueToHtml(htmlToValue(html))).toBe(html);
});

test("a block inside a list item is unwrapped into the item itself", () => {
  expect(htmlToValue("<ul><li><p>x</p></li></ul>")).toEqual([
    { indent: 1, listStyleType: "disc", type: "p", children: [{ text: "x" }] },
  ]);
});

// Plate has no parser for these, so their lines and cells ran together.
test.each([
  ["<div>a</div><div>b</div>", "<p>a</p><p>b</p>"],
  ["<ul><li><p>a</p><p>b</p></li></ul>", "<ul><li>a<br>b</li></ul>"],
  [
    "<p>a</p><table><tr><td>c1</td><td>c2</td></tr></table>",
    "<p>a</p><table><tbody><tr><td>c1</td><td>c2</td></tr></tbody></table>",
  ],
])("line and cell blocks stay apart: %s", (html, out) =>
  expect(valueToHtml(htmlToValue(html))).toBe(out));

test.each([
  [
    "<table><tr><th>h</th></tr><tr><td>a</td></tr></table>",
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>",
  ],
  [
    "<table><thead><tr><td>h</td></tr></thead><tbody><tr><td>a</td></tr></tbody></table>",
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>",
  ],
  [
    "<table><caption>Contacts</caption><colgroup><col></colgroup><tbody><tr><td>a</td></tr></tbody><tfoot><tr><td>sum</td></tr></tfoot></table>",
    "<p>Contacts</p><table><tbody><tr><td>a</td></tr><tr><td>sum</td></tr></tbody></table>",
  ],
  [
    "<table><tbody><tr><td><p>a</p><p>b</p></td><td><ul><li>c</li><li>d</li></ul></td></tr></tbody></table>",
    "<table><tbody><tr><td>a<br>b</td><td>c<br>d</td></tr></tbody></table>",
  ],
  [
    "<table><tbody><tr><td>a<table><tbody><tr><td>b</td><td>c</td></tr></tbody></table></td></tr></tbody></table>",
    "<table><tbody><tr><td>a<br>b<br>c</td></tr></tbody></table>",
  ],
  [
    "<ul><li>x<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table></li></ul>",
    "<ul><li>x<br>a<br>b</li></ul>",
  ],
  [
    "<blockquote><table><tbody><tr><td>q</td></tr></tbody></table></blockquote>",
    "<blockquote>q</blockquote>",
  ],
  ["<table></table><p>x</p>", "<p>x</p>"],
  [
    "<table><tbody><tr><td></td></tr></tbody></table>",
    "<table><tbody><tr><td></td></tr></tbody></table>",
  ],
  [
    '<table><thead><tr><td colspan="2">h</td></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    '<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
  ],
  [
    "<table><tbody><tr><td><p></p><p>a</p><hr><p>b</p><p><br></p></td></tr></tbody></table>",
    "<table><tbody><tr><td>a<br>b</td></tr></tbody></table>",
  ],
  [
    "<table><tbody><tr><td><h2>H</h2><blockquote>q</blockquote></td></tr></tbody></table>",
    "<table><tbody><tr><td>H<br>q</td></tr></tbody></table>",
  ],
  [
    "<table><tbody><tr></tr><tr><td>a</td></tr></tbody></table>",
    "<table><tbody><tr><td>a</td></tr></tbody></table>",
  ],
])("stored table %s is read as %s", (input, out) =>
  expect(valueToHtml(htmlToValue(input))).toBe(out));

// A caption is its table's title: a line of its own just before it, wherever
// the table sits, never words run into the text beside it.
test.each([
  [
    "<p>x</p><table><caption>Board</caption><tbody><tr><td>a</td></tr></tbody></table>",
    "<p>x</p><p>Board</p><table><tbody><tr><td>a</td></tr></tbody></table>",
  ],
  [
    "<ul><li>x<table><caption>Board</caption><tbody><tr><td>a</td></tr></tbody></table></li></ul>",
    "<ul><li>x<br>Board<br>a</li></ul>",
  ],
  [
    "<blockquote>x<table><caption>Board</caption><tbody><tr><td>q</td></tr></tbody></table></blockquote>",
    "<blockquote>x<br>Board<br>q</blockquote>",
  ],
  [
    "<table><tbody><tr><td>a<table><caption>Board</caption><tbody><tr><td>b</td></tr></tbody></table></td></tr></tbody></table>",
    "<table><tbody><tr><td>a<br>Board<br>b</td></tr></tbody></table>",
  ],
  [
    "<table><caption><p>Board</p><p>2026</p></caption><tbody><tr><td>a</td></tr></tbody></table>",
    "<p>Board</p><p>2026</p><table><tbody><tr><td>a</td></tr></tbody></table>",
  ],
  [
    "<h2>T<table><caption>Board</caption><tbody><tr><td>a</td><td>b</td></tr></tbody></table></h2>",
    "<h2>T<br>Board<br>a<br>b</h2>",
  ],
])("a caption is a line before its table: %s", (input, out) =>
  expect(valueToHtml(htmlToValue(input))).toBe(out));

test("a list made inside a cell is a plain line again", () => {
  const html = "<table><tbody><tr><td>a</td></tr></tbody></table>";
  const editor = createConversionEditor();
  editor.tf.setValue(htmlToValue(html));
  editor.tf.select(editor.api.start([0, 0, 0]));
  toggleRichList(editor, "disc");
  editor.tf.normalize({ force: true });

  const [cellBlock] = editor.api.nodes<TElement>({
    at: [0, 0, 0],
    match: (node) => ElementApi.isElement(node) && node.type === "p",
  });
  expect(cellBlock?.[0]).toEqual({ type: "p", children: [{ text: "a" }] });
  expect(valueToHtml(editor.children)).toBe(html);
});

test("a cell holds plain lines: no heading, list item or divider", () => {
  const editor = createConversionEditor();
  editor.tf.setValue([
    {
      type: "table",
      children: [
        {
          type: "tr",
          children: [
            {
              type: "td",
              children: [
                { type: "h2", children: [{ text: "a" }] },
                { type: "hr", children: [{ text: "" }] },
                {
                  type: "blockquote",
                  indent: 2,
                  listStart: 3,
                  listStyleType: "decimal",
                  children: [{ text: "b" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  editor.tf.normalize({ force: true });
  expect(editor.children[0]).toEqual({
    type: "table",
    children: [
      {
        type: "tr",
        children: [
          {
            type: "td",
            children: [
              { type: "p", children: [{ text: "a" }] },
              { type: "p", children: [{ text: "b" }] },
            ],
          },
        ],
      },
    ],
  });
});

const line = (text: string): TElement => ({ type: "p", children: [{ text }] });

test("cells write the spans Plate holds, as numbers or attributes, 2 to 20", () => {
  expect(
    valueToHtml([
      {
        type: "table",
        children: [
          {
            type: "tr",
            children: [
              { type: "th", colSpan: 2, children: [line("a")] },
              {
                type: "th",
                attributes: { rowspan: "3" },
                children: [line("b")],
              },
            ],
          },
          { type: "tr", children: [{ text: "" }] },
          {
            type: "tr",
            children: [
              { type: "td", colSpan: 21, rowSpan: 1, children: [line("c")] },
              {
                type: "td",
                children: [line(""), line("d"), line(" "), line("e")],
              },
            ],
          },
        ],
      },
    ])
  ).toBe(
    '<table><tbody><tr><th colspan="2">a</th><th rowspan="3">b</th></tr><tr><td>c</td><td>d<br>e</td></tr></tbody></table>'
  );
});

test("a table with no cell writes nothing; one with empty cells is kept", () => {
  expect(
    valueToHtml([
      { type: "table", children: [{ text: "" }] },
      { type: "table", children: [{ type: "tr", children: [{ text: "" }] }] },
    ])
  ).toBe("");
  expect(
    valueToHtml([
      {
        type: "table",
        children: [
          { type: "tr", children: [{ type: "td", children: [line("")] }] },
        ],
      },
    ])
  ).toBe("<table><tbody><tr><td></td></tr></tbody></table>");
});

test("a table ends the list before it", () => {
  expect(
    valueToHtml([
      {
        type: "p",
        indent: 1,
        listStyleType: "disc",
        children: [{ text: "a" }],
      },
      {
        type: "table",
        children: [
          { type: "tr", children: [{ type: "td", children: [line("b")] }] },
        ],
      },
    ])
  ).toBe(
    "<ul><li>a</li></ul><table><tbody><tr><td>b</td></tr></tbody></table>"
  );
});

// A browser ends a row span at the end of its row group, so the header group
// never cuts one: it is the longest run of leading all-`th` rows that no
// cell's span reaches past.
test.each([
  [
    "a two-row header",
    '<table><thead><tr><th rowspan="2">Name</th><th colspan="2">Contact</th></tr><tr><th>Email</th><th>Phone</th></tr></thead><tbody><tr><td>Ada</td><td>a@biso.no</td><td>123</td></tr></tbody></table>',
    '<table><thead><tr><th rowspan="2">Name</th><th colspan="2">Contact</th></tr><tr><th>Email</th><th>Phone</th></tr></thead><tbody><tr><td>Ada</td><td>a@biso.no</td><td>123</td></tr></tbody></table>',
  ],
  [
    "a header cell spanning into the body",
    '<table><tr><th rowspan="2">h</th><th>x</th></tr><tr><td>y</td></tr></table>',
    '<table><tbody><tr><th rowspan="2">h</th><th>x</th></tr><tr><td>y</td></tr></tbody></table>',
  ],
  [
    "two plain header rows",
    "<table><tr><th>a</th></tr><tr><th>b</th></tr><tr><td>c</td></tr></table>",
    "<table><thead><tr><th>a</th></tr><tr><th>b</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>",
  ],
  [
    "a body row of th with a row span",
    '<table><tbody><tr><th rowspan="2">a</th><th>b</th></tr><tr><td>c</td></tr></tbody></table>',
    '<table><tbody><tr><th rowspan="2">a</th><th>b</th></tr><tr><td>c</td></tr></tbody></table>',
  ],
  [
    "a second header row spanning into the body",
    '<table><thead><tr><th>a</th></tr><tr><th rowspan="2">b</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>',
    '<table><thead><tr><th>a</th></tr></thead><tbody><tr><th rowspan="2">b</th></tr><tr><td>c</td></tr></tbody></table>',
  ],
  [
    "a header after the body in the source",
    "<table><tbody><tr><td>a</td></tr></tbody><thead><tr><th>h</th></tr></thead></table>",
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>",
  ],
])("the header group keeps its row spans: %s", (_, input, out) => {
  expect(valueToHtml(htmlToValue(input))).toBe(out);
  expect(valueToHtml(htmlToValue(out))).toBe(out);
});

test("a span the page drops does not keep a row out of the header", () => {
  const value: Value = [
    {
      type: "table",
      children: [
        {
          type: "tr",
          children: [{ type: "th", rowSpan: 25, children: [line("a")] }],
        },
        { type: "tr", children: [{ type: "td", children: [line("b")] }] },
      ],
    },
  ];
  const html =
    "<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>";
  expect(valueToHtml(value)).toBe(html);
  expect(valueToHtml(htmlToValue(html))).toBe(html);
});

test("the value never ends with a table or a divider", () => {
  expect(htmlToValue("<p>a</p><hr>").at(-1)).toMatchObject({ type: "p" });
  expect(
    htmlToValue("<table><tbody><tr><td>a</td></tr></tbody></table>").at(-1)
  ).toMatchObject({ type: "p" });
});

test("empty leaves and empty links print nothing", () => {
  expect(
    valueToHtml([
      {
        type: "p",
        children: [
          { text: "", bold: true },
          { type: "a", url: "https://biso.no", children: [{ text: "l" }] },
          { type: "a", url: "https://biso.no", children: [{ text: "" }] },
          { text: "" },
        ],
      },
    ])
  ).toBe('<p><a href="https://biso.no">l</a></p>');
});

test("top-level text with no block keeps its words, in a paragraph", () => {
  expect(valueToHtml(htmlToValue("bare <b>text</b>"))).toBe(
    "<p>bare <strong>text</strong></p>"
  );
});

test("conversion is deterministic outside tests: no node ids", () => {
  // Plate turns on random node ids unless NODE_ENV is "test".
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const html = "<h2>A</h2><ul><li>b</li></ul>";
    const value = htmlToValue(html);
    expect(value.some((block) => "id" in block)).toBe(false);
    expect(htmlToValue(html)).toEqual(value);
    expect(htmlToValue("")).toEqual([{ type: "p", children: [{ text: "" }] }]);
  } finally {
    process.env.NODE_ENV = nodeEnv;
  }
});

test("alpha and roman list styles are ordered, as the serializer reads them", () => {
  expect(
    deserialized('<ol><li data-list-style-type="lower-alpha">a</li></ol>')
  ).toBe("<ol><li>a</li></ol>");
});

test.each([
  [
    [1, 3, 3],
    [1, 2, 2],
  ],
  [
    [1, 3, 2],
    [1, 2, 2],
  ],
  [
    [1, 2, 3, 1, 3],
    [1, 2, 3, 1, 2],
  ],
  [
    [2, 2],
    [1, 1],
  ],
  [
    [1, 2, 1, 2],
    [1, 2, 1, 2],
  ],
  [
    [3, 1, 2],
    [1, 1, 2],
  ],
])("effective depths of %p are %p", (levels, depths) => {
  expect(effectiveDepths(levels)).toEqual(depths);
});

/** Bullets a, b, c… at these indents. */
const bullets = (...indents: number[]): Value =>
  indents.map((indent, i) => ({
    type: "p",
    indent,
    listStyleType: "disc",
    children: [{ text: "abc"[i] ?? "" }],
  }));

/** Tab pressed twice: list items two levels below the one above them. */
const INDENT_JUMPS: [name: string, value: Value][] = [
  ["1, 3, 3", bullets(1, 3, 3)],
  ["1, 3, 2", bullets(1, 3, 2)],
];

test.each(INDENT_JUMPS)("an indent jump nests one level: %s", (_, value) => {
  expect(valueToHtml(value)).toBe(
    "<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>"
  );
});

test("a paragraph ends a list run, so its depths start again", () => {
  expect(
    valueToHtml([
      ...bullets(2),
      { type: "p", children: [{ text: "x" }] },
      ...bullets(1, 3),
    ])
  ).toBe("<ul><li>a</li></ul><p>x</p><ul><li>a<ul><li>b</li></ul></li></ul>");
});

/** What the editor's echo compare relies on (Task 7). */
const expectFixedPoint = (value: Value): void => {
  const once = valueToHtml(value);
  expect(valueToHtml(htmlToValue(once))).toBe(once);
};

test.each(
  INDENT_JUMPS
)("serializing an indent jump is a fixed point: %s", (_, value) => {
  expectFixedPoint(value);
});

test.each(ROUND_TRIP)("serializing is a fixed point: %s", (html) => {
  expectFixedPoint(htmlToValue(html));
});

test("an unknown block type, even a prototype key, is a paragraph", () => {
  expect(
    valueToHtml([{ type: "constructor", children: [{ text: "x" }] }])
  ).toBe("<p>x</p>");
});
