import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { deserializeHtml, type Value } from "platejs";
import { legacyBodyToHtml } from "../body";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";

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

/** Tab pressed twice: a list item two levels below the one above it. */
const INDENT_JUMP: Value = [
  { type: "p", indent: 1, listStyleType: "disc", children: [{ text: "a" }] },
  { type: "p", indent: 3, listStyleType: "disc", children: [{ text: "b" }] },
  { type: "p", indent: 2, listStyleType: "disc", children: [{ text: "c" }] },
];

test("a list item is at most one level below the list it sits in", () => {
  expect(valueToHtml(INDENT_JUMP)).toBe(
    "<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>"
  );
});

/** What the editor's echo compare relies on (Task 7). */
const expectFixedPoint = (value: Value): void => {
  const once = valueToHtml(value);
  expect(valueToHtml(htmlToValue(once))).toBe(once);
};

test("serializing an indent jump is a fixed point", () => {
  expectFixedPoint(INDENT_JUMP);
});

test.each(ROUND_TRIP)("serializing is a fixed point: %s", (html) => {
  expectFixedPoint(htmlToValue(html));
});

test("an unknown block type, even a prototype key, is a paragraph", () => {
  expect(
    valueToHtml([{ type: "constructor", children: [{ text: "x" }] }])
  ).toBe("<p>x</p>");
});
