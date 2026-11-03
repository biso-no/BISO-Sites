import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { SlateEditor } from "platejs";
import {
  activeList,
  applyLink,
  clearFormatting,
  currentColour,
  currentStyle,
  handleListTab,
  insertDivider,
  isMarkActive,
  linkUrl,
  normalizeHref,
  setColour,
  setStyle,
  toggleRichList,
  toggleRichMark,
} from "./commands";
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

/** A conversion editor holding `html`, the whole value selected. */
function editorWith(html: string): SlateEditor {
  const editor = createConversionEditor();
  editor.tf.setValue(htmlToValue(html));
  editor.tf.select([]);
  return editor;
}

const html = (editor: SlateEditor): string => valueToHtml(editor.children);

test("setStyle turns a paragraph into a heading", () => {
  const editor = editorWith("<p>a</p>");
  setStyle(editor, "h2");
  expect(html(editor)).toBe("<h2>a</h2>");
  expect(currentStyle(editor)).toBe("h2");
});

test("a list item reads as a paragraph and Paragraph keeps it in the list", () => {
  const editor = editorWith("<ul><li>a</li></ul>");
  expect(currentStyle(editor)).toBe("p");
  setStyle(editor, "p");
  expect(html(editor)).toBe("<ul><li>a</li></ul>");
});

test("a list item reads as a paragraph whatever its block type", () => {
  const editor = editorWith("<p>a</p>");
  editor.tf.setNodes(
    { indent: 1, listStyleType: "disc", type: "h2" },
    { at: [0] }
  );
  expect(currentStyle(editor)).toBe("p");
});

test.each([
  ["h2", "<h2>a</h2>"],
  ["h3", "<h3>a</h3>"],
  ["blockquote", "<blockquote>a</blockquote>"],
] as const)("setStyle(%p) takes a list item out of the list", (style, out) => {
  const editor = editorWith('<ol start="3"><li>a</li></ol>');
  setStyle(editor, style);
  expect(html(editor)).toBe(out);
  expect(editor.children[0]).toEqual({
    children: [{ text: "a" }],
    type: style,
  });
});

test("a list made from a heading is a list of paragraphs", () => {
  const editor = editorWith("<h2>a</h2><blockquote>b</blockquote>");
  toggleRichList(editor, "disc");
  expect(html(editor)).toBe("<ul><li>a</li><li>b</li></ul>");
  expect(currentStyle(editor)).toBe("p");
  expect(editor.children.map((node) => node.type)).toEqual(["p", "p"]);
});

test("currentStyle reads an unknown block as a paragraph", () => {
  const editor = editorWith("<hr>");
  expect(currentStyle(editor)).toBe("p");
});

test("toggleRichList wraps and unwraps", () => {
  const editor = editorWith("<p>a</p><p>b</p>");
  toggleRichList(editor, "disc");
  expect(html(editor)).toBe("<ul><li>a</li><li>b</li></ul>");
  expect(activeList(editor)).toBe("disc");
  toggleRichList(editor, "disc");
  expect(html(editor)).toBe("<p>a</p><p>b</p>");
  expect(activeList(editor)).toBeNull();
});

test("toggleRichList switches a bullet list to a numbered one", () => {
  const editor = editorWith("<ul><li>a</li></ul>");
  toggleRichList(editor, "decimal");
  expect(html(editor)).toBe("<ol><li>a</li></ol>");
  expect(activeList(editor)).toBe("decimal");
});

test("Tab nests and Shift+Tab un-nests", () => {
  const editor = editorWith("<ul><li>a</li><li>b</li></ul>");
  editor.tf.select([1]);
  expect(handleListTab(editor, { shift: false })).toBe(true);
  expect(html(editor)).toBe("<ul><li>a<ul><li>b</li></ul></li></ul>");
  expect(handleListTab(editor, { shift: true })).toBe(true);
  expect(html(editor)).toBe("<ul><li>a</li><li>b</li></ul>");
});

test("Tab keeps a numbered item numbered", () => {
  const editor = editorWith("<ol><li>a</li><li>b</li></ol>");
  editor.tf.select([1]);
  handleListTab(editor, { shift: false });
  expect(html(editor)).toBe("<ol><li>a<ol><li>b</li></ol></li></ol>");
});

/** Each block's indent (0 when it has none). */
const indents = (editor: SlateEditor): number[] =>
  editor.children.map((node) =>
    typeof node.indent === "number" ? node.indent : 0
  );

/** The editor's nesting is what the page stores and reads back. */
const expectStoredNesting = (editor: SlateEditor): void =>
  expect(indents(editor)).toEqual(
    indents(editorWith(valueToHtml(editor.children)))
  );

test("Tab on the first item of a list keeps it where it is", () => {
  const editor = editorWith("<p>x</p><ul><li>a</li><li>b</li></ul>");
  editor.tf.select([1]);
  expect(handleListTab(editor, { shift: false })).toBe(true);
  expect(indents(editor)).toEqual([0, 1, 1]);
});

test("Tab on an item already nested under the one before keeps it there", () => {
  const editor = editorWith("<ul><li>a<ul><li>b</li></ul></li></ul>");
  editor.tf.select([1]);
  expect(handleListTab(editor, { shift: false })).toBe(true);
  expect(indents(editor)).toEqual([1, 2]);
});

test("Tab nests a selection of items under the item before it", () => {
  const editor = editorWith("<ul><li>a</li><li>b</li><li>c</li></ul>");
  editor.tf.select(editor.api.range([1], [2]));
  handleListTab(editor, { shift: false });
  expect(indents(editor)).toEqual([1, 2, 2]);
  expectStoredNesting(editor);
});

test("Shift+Tab takes an item's own sub-items out with it", () => {
  const editor = editorWith(
    "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>d</li></ul>"
  );
  expect(indents(editor)).toEqual([1, 2, 3, 1]);
  editor.tf.select([1]);
  expect(handleListTab(editor, { shift: true })).toBe(true);
  expect(indents(editor)).toEqual([1, 1, 2, 1]);
  expectStoredNesting(editor);
});

test("Shift+Tab on a(1) b(2) c(3) at b gives 1, 1, 2", () => {
  const editor = editorWith(
    "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>"
  );
  editor.tf.select([1]);
  handleListTab(editor, { shift: true });
  expect(indents(editor)).toEqual([1, 1, 2]);
  expectStoredNesting(editor);
});

test("Shift+Tab leaves a later sibling at its own level", () => {
  const editor = editorWith("<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>");
  editor.tf.select([1]);
  handleListTab(editor, { shift: true });
  expect(indents(editor)).toEqual([1, 1, 2]);
  expectStoredNesting(editor);
});

test("every Tab and Shift+Tab keeps the nesting the page stores", () => {
  const editor = editorWith(
    "<p>x</p><ul><li>a</li><li>b<ul><li>c</li><li>d</li></ul></li><li>e</li></ul>"
  );
  const moves: [number, boolean][] = [
    [2, false],
    [3, false],
    [3, false],
    [4, false],
    [2, true],
    [1, false],
    [5, false],
    [2, true],
    [1, true],
    [3, true],
  ];
  for (const [index, shift] of moves) {
    editor.tf.select([index]);
    handleListTab(editor, { shift });
    expectStoredNesting(editor);
  }
});

test("Tab outside a list does nothing", () => {
  const editor = editorWith("<p>a</p>");
  expect(handleListTab(editor, { shift: false })).toBe(false);
  expect(handleListTab(editor, { shift: true })).toBe(false);
  expect(editor.children).toEqual(htmlToValue("<p>a</p>"));
});

test("marks report and toggle", () => {
  const editor = editorWith("<p>a</p>");
  expect(isMarkActive(editor, "bold")).toBe(false);
  toggleRichMark(editor, "bold");
  expect(isMarkActive(editor, "bold")).toBe(true);
  expect(html(editor)).toBe("<p><strong>a</strong></p>");
  toggleRichMark(editor, "strikethrough");
  expect(html(editor)).toBe("<p><strong><s>a</s></strong></p>");
  toggleRichMark(editor, "bold");
  expect(html(editor)).toBe("<p><s>a</s></p>");
});

test.each([
  ["biso.no", "https://biso.no"],
  ["  www.biso.no/events?x=1  ", "https://www.biso.no/events?x=1"],
  ["https://biso.no/x", "https://biso.no/x"],
  ["mailto:it@biso.no", "mailto:it@biso.no"],
  ["tel:+4712345678", "tel:+4712345678"],
  ["/events", "/events"],
  ["#contact", "#contact"],
  ["javascript:alert(1)", null],
  ["it@biso.no", null],
  ["biso", null],
  ["", null],
  ["   ", null],
])("normalizeHref(%p)", (input, out) => expect(normalizeHref(input)).toBe(out));

test("applyLink links the selection and null removes it", () => {
  const editor = editorWith("<p>biso</p>");
  applyLink(editor, "biso.no");
  expect(html(editor)).toBe('<p><a href="https://biso.no">biso</a></p>');
  expect(linkUrl(editor)).toBe("https://biso.no");
  applyLink(editor, null);
  expect(html(editor)).toBe("<p>biso</p>");
  expect(linkUrl(editor)).toBeNull();
});

test("applyLink changes the address of the link at the caret", () => {
  const editor = editorWith('<p><a href="https://biso.no">biso</a></p>');
  editor.tf.select(editor.api.start([0, 1]));
  applyLink(editor, "/events");
  expect(html(editor)).toBe('<p><a href="/events">biso</a></p>');
});

test("applyLink keeps an address Plate's own check would refuse", () => {
  const editor = editorWith("<p>call</p>");
  applyLink(editor, "tel:+4712345678");
  expect(html(editor)).toBe('<p><a href="tel:+4712345678">call</a></p>');
});

test("applyLink ignores an unsafe address", () => {
  const editor = editorWith("<p>biso</p>");
  applyLink(editor, "javascript:alert(1)");
  expect(html(editor)).toBe("<p>biso</p>");
});

test("applyLink at a caret outside a link inserts the address as linked text", () => {
  const editor = editorWith("<p>see </p>");
  editor.tf.select(editor.api.end([0]));
  applyLink(editor, "biso.no");
  expect(html(editor)).toBe(
    '<p>see <a href="https://biso.no">https://biso.no</a></p>'
  );
  const links = [...editor.api.nodes({ at: [], match: { type: "a" } })];
  expect(links.map(([node]) => editor.api.string(node))).toEqual([
    "https://biso.no",
  ]);
});

test("applyLink without a selection changes nothing", () => {
  const editor = editorWith('<p>a <a href="/x">b</a></p>');
  editor.tf.deselect();
  const before = structuredClone(editor.children);
  expect(() => applyLink(editor, "biso.no")).not.toThrow();
  expect(() => applyLink(editor, null)).not.toThrow();
  expect(editor.children).toEqual(before);
  expect(linkUrl(editor)).toBeNull();
});

test("setColour colours the selection; null clears it", () => {
  const editor = editorWith("<p>ab</p>");
  setColour(editor, "red");
  expect(html(editor)).toBe('<p><span data-color="red">ab</span></p>');
  setColour(editor, null);
  expect(html(editor)).toBe("<p>ab</p>");
});

test("currentColour reads the colour at the selection", () => {
  const editor = editorWith('<p><span data-color="muted">a</span>b</p>');
  editor.tf.select({
    anchor: { offset: 0, path: [0, 0] },
    focus: { offset: 1, path: [0, 0] },
  });
  expect(currentColour(editor)).toBe("muted");
  editor.tf.select({
    anchor: { offset: 0, path: [0, 1] },
    focus: { offset: 1, path: [0, 1] },
  });
  expect(currentColour(editor)).toBeNull();
});

test("currentColour reads an unknown colour as none", () => {
  const editor = editorWith("<p>a</p>");
  editor.tf.setNodes({ color: "#ff0000" }, { at: [0, 0] });
  editor.tf.select([]);
  expect(currentColour(editor)).toBeNull();
});

test("clearFormatting removes marks and colour and keeps the link", () => {
  const editor = editorWith(
    '<p><a href="https://biso.no"><strong><span data-color="red">x</span></strong></a> <em>y</em> <s>z</s></p>'
  );
  clearFormatting(editor);
  expect(html(editor)).toBe('<p><a href="https://biso.no">x</a> y z</p>');
});

/** The top-level block the selection's focus is in. */
const focusBlock = (editor: SlateEditor): number | undefined =>
  editor.selection?.focus.path[0];

test("insertDivider puts a rule after the block and the caret after it", () => {
  const editor = editorWith("<p>a</p><p>b</p>");
  editor.tf.select(editor.api.end([0]));
  insertDivider(editor);
  expect(html(editor)).toBe("<p>a</p><hr><p>b</p>");
  expect(focusBlock(editor)).toBe(2);

  const last = editorWith("<p>a</p>");
  last.tf.select(last.api.end([0]));
  insertDivider(last);
  expect(html(last)).toBe("<p>a</p><hr>");
  expect(last.children.map((node) => node.type)).toEqual(["p", "hr", "p"]);
  expect(focusBlock(last)).toBe(2);
});

test("insertDivider on an empty paragraph replaces it", () => {
  const editor = editorWith("<p>a</p><p></p>");
  editor.tf.select(editor.api.start([1]));
  insertDivider(editor);
  expect(html(editor)).toBe("<p>a</p><hr>");
  expect(editor.children.map((node) => node.type)).toEqual(["p", "hr", "p"]);
  expect(focusBlock(editor)).toBe(2);
});
