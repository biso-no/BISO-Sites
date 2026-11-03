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
