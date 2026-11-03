import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { deserializeHtml, type Value } from "platejs";
import { legacyBodyToHtml } from "../body";
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
];

test.each(ROUND_TRIP)("round-trips %s", (html) =>
  expect(valueToHtml(htmlToValue(html))).toBe(html));

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
    "<p>a</p><p>c1</p><p>c2</p>",
  ],
])("line and cell blocks stay apart: %s", (html, out) =>
  expect(valueToHtml(htmlToValue(html))).toBe(out));

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
