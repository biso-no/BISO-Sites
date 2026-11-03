import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { SlateEditor } from "platejs";
import {
  activeList,
  applyLink,
  currentStyle,
  handleListTab,
  isMarkActive,
  linkUrl,
  normalizeHref,
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

test("setStyle keeps list props", () => {
  const editor = editorWith("<ul><li>a</li></ul>");
  setStyle(editor, "h3");
  expect(editor.children[0]).toMatchObject({
    indent: 1,
    listStyleType: "disc",
    type: "h3",
  });
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
