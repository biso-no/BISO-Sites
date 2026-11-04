import { afterAll, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  NodeApi,
  type Path,
  type Point,
  type SlateEditor,
  type TRange,
  type Value,
} from "platejs";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";
import { coversWholeValue, wholeValueSelected } from "./table-edges";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

const TABLE =
  "<table><tbody><tr><td>a1</td><td>a2</td></tr><tr><td>b1</td><td>b2</td></tr></tbody></table>";
const PAGE = `<p>before</p>${TABLE}<p>after</p>`;

/** A conversion editor holding `start`, with node ids as the field has. */
function editorOn(start: string | Value): SlateEditor {
  const editor = createConversionEditor([], { nodeId: true });
  editor.tf.setValue(typeof start === "string" ? htmlToValue(start) : start);
  editor.tf.normalize({ force: true });
  return editor;
}

const html = (editor: SlateEditor): string => valueToHtml(editor.children);

/** The path of the text that reads `text`. */
function textPath(editor: SlateEditor, text: string): Path {
  const [, path] =
    [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === text) ?? [];
  if (!path) {
    throw new Error(`no text "${text}"`);
  }
  return path;
}

const at = (editor: SlateEditor, text: string, offset: number): Point => ({
  offset,
  path: textPath(editor, text),
});

const caret = (editor: SlateEditor): Point | undefined =>
  editor.selection?.anchor;

// ── A caret at a cell's edge ──

test("Backspace at the start of a cell keeps its text out of the cell before", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a2", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(PAGE);
  expect(caret(editor)).toEqual(at(editor, "a2", 0));
});

test("Backspace at the start of the first cell keeps its text out of the paragraph before", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a1", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(PAGE);
  expect(caret(editor)).toEqual(at(editor, "a1", 0));
});

test("Backspace at the start of a row's first cell keeps the row", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "b1", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(PAGE);
});

test("Backspace at the start of a cell under a row span keeps the row", () => {
  const merged =
    '<table><tbody><tr><td rowspan="2">A</td><td>b</td></tr><tr><td>c</td></tr></tbody></table>';
  const editor = editorOn(merged);
  editor.tf.select(at(editor, "c", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(merged);
});

test("Backspace at the start of a table that opens the text leaves the table a table", () => {
  const editor = editorOn(TABLE);
  editor.tf.select(at(editor, "a1", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(TABLE);
  expect(editor.children[0]?.type).toBe("table");
});

test("Delete at the end of a cell keeps the next cell's text out of it", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a1", 2));
  editor.tf.deleteForward("character");
  expect(html(editor)).toBe(PAGE);
});

test("Delete at the end of the last cell keeps the paragraph after out of it", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "b2", 2));
  editor.tf.deleteForward("character");
  expect(html(editor)).toBe(PAGE);
});

test("a word deleted at a cell's start takes nothing from the cell before", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a2", 0));
  editor.tf.deleteBackward("word");
  editor.tf.select(at(editor, "a1", 2));
  editor.tf.deleteForward("word");
  expect(html(editor)).toBe(PAGE);
});

test("a delete longer than what is left of a cell stops at its edge", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a2", 1));
  editor.tf.delete({ distance: 3, reverse: true });
  editor.tf.select(at(editor, "b1", 1));
  editor.tf.delete({ distance: 3 });
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td>a1</td><td>2</td></tr><tr><td>b</td><td>b2</td></tr></tbody></table><p>after</p>"
  );
});

test("Backspace and Delete inside a cell still edit it", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "a2", 1));
  editor.tf.deleteBackward("character");
  editor.tf.select(at(editor, "b1", 0));
  editor.tf.deleteForward("character");
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td>a1</td><td>2</td></tr><tr><td>1</td><td>b2</td></tr></tbody></table><p>after</p>"
  );
});

// ── A caret beside a table ──

test("Delete at the end of the paragraph before a table moves into the first cell", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "before", 6));
  editor.tf.deleteForward("character");
  expect(html(editor)).toBe(PAGE);
  expect(caret(editor)).toEqual(at(editor, "a1", 0));
});

test("Backspace at the start of the paragraph after a table moves into the last cell", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "after", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(PAGE);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));
});

test("an empty line beside a table goes, and the caret moves into the table", () => {
  const value: Value = [
    { type: "p", children: [{ text: "x" }] },
    { type: "p", children: [{ text: "" }] },
    ...htmlToValue(TABLE).filter((node) => node.type === "table"),
    { type: "p", children: [{ text: "" }] },
    { type: "p", children: [{ text: "y" }] },
  ];
  const editor = editorOn(value);
  editor.tf.select({ offset: 0, path: [3, 0] });
  editor.tf.deleteBackward("character");
  expect(editor.children.map((node) => node.type)).toEqual([
    "p",
    "p",
    "table",
    "p",
  ]);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));

  editor.tf.select({ offset: 0, path: [1, 0] });
  editor.tf.deleteForward("character");
  expect(editor.children.map((node) => node.type)).toEqual(["p", "table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "a1", 0));
  expect(html(editor)).toBe(`<p>x</p>${TABLE}<p>y</p>`);
});

test("the last line after a table stays, and Backspace there moves into the table", () => {
  const editor = editorOn(TABLE);
  expect(editor.children.map((node) => node.type)).toEqual(["table", "p"]);
  editor.tf.select({ offset: 0, path: [1, 0] });
  editor.tf.deleteBackward("character");
  expect(editor.children.map((node) => node.type)).toEqual(["table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));
});

// The only line on a table's far side stays, so the text keeps a place to
// write before a table that opens it, or between two tables.
const TABLE_C = "<table><tbody><tr><td>c1</td></tr></tbody></table>";
const tableOf = (start: string): Value =>
  htmlToValue(start).filter((node) => node.type === "table");
const types = (editor: SlateEditor) => editor.children.map((node) => node.type);

test("Delete on an empty first line before a table keeps the line", () => {
  const editor = editorOn([
    { type: "p", children: [{ text: "" }] },
    ...tableOf(TABLE),
  ]);
  editor.tf.select({ offset: 0, path: [0, 0] });
  editor.tf.deleteForward("character");
  expect(types(editor)).toEqual(["p", "table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "a1", 0));
});

test("Backspace and Delete on an empty line between two tables keep the line", () => {
  const editor = editorOn([
    ...tableOf(TABLE),
    { type: "p", children: [{ text: "" }] },
    ...tableOf(TABLE_C),
    { type: "p", children: [{ text: "" }] },
  ]);
  editor.tf.select({ offset: 0, path: [1, 0] });
  editor.tf.deleteBackward("character");
  expect(types(editor)).toEqual(["table", "p", "table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));

  editor.tf.select({ offset: 0, path: [1, 0] });
  editor.tf.deleteForward("character");
  expect(types(editor)).toEqual(["table", "p", "table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "c1", 0));
});

test("Enter at the very start of a table that opens the text adds a line above it", () => {
  const editor = editorOn(TABLE);
  editor.tf.select(at(editor, "a1", 0));
  editor.tf.insertBreak();
  expect(types(editor)).toEqual(["p", "table", "p"]);
  expect(editor.selection?.anchor.path[0]).toBe(0);
  editor.tf.insertText("x");
  expect(html(editor)).toBe(`<p>x</p>${TABLE}`);
});

test("Enter at the start of a table right after another table adds a line between them", () => {
  const editor = editorOn(`${TABLE}${TABLE_C}`);
  editor.tf.select(at(editor, "c1", 0));
  editor.tf.insertBreak();
  expect(types(editor)).toEqual(["table", "p", "table", "p"]);
});

// A divider has no place to write either, so beside a table it counts as one.
const RULE_THEN_TABLE = `<p>x</p><hr><p></p>${TABLE}<p>z</p>`;

test("Delete on the only line between a divider and a table keeps the line", () => {
  const editor = editorOn(RULE_THEN_TABLE);
  expect(types(editor)).toEqual(["p", "hr", "p", "table", "p"]);
  editor.tf.select({ offset: 0, path: [2, 0] });
  editor.tf.deleteForward("character");
  expect(types(editor)).toEqual(["p", "hr", "p", "table", "p"]);
  expect(caret(editor)).toEqual(at(editor, "a1", 0));
  expect(html(editor)).toBe(`<p>x</p><hr>${TABLE}<p>z</p>`);
});

test("Backspace on the only line between a table and a divider keeps the line", () => {
  const editor = editorOn(`${TABLE}<p></p><hr><p>z</p>`);
  expect(types(editor)).toEqual(["table", "p", "hr", "p"]);
  editor.tf.select({ offset: 0, path: [1, 0] });
  editor.tf.deleteBackward("character");
  expect(types(editor)).toEqual(["table", "p", "hr", "p"]);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));
});

test("Enter at the start of a table right after a divider adds a line between them", () => {
  const editor = editorOn(`<p>x</p><hr>${TABLE}<p>z</p>`);
  editor.tf.select(at(editor, "a1", 0));
  editor.tf.insertBreak();
  expect(types(editor)).toEqual(["p", "hr", "p", "table", "p"]);
  expect(caret(editor)).toEqual({ offset: 0, path: [2, 0] });
  editor.tf.insertText("y");
  expect(html(editor)).toBe(`<p>x</p><hr><p>y</p>${TABLE}<p>z</p>`);
});

test("Enter at the start of a table after a paragraph stays the table's own", () => {
  const editor = editorOn(`<p>x</p>${TABLE}`);
  editor.tf.select(at(editor, "a1", 0));
  editor.tf.insertBreak();
  expect(editor.children[1]?.type).toBe("table");
  expect(editor.children).toHaveLength(3);
});

test("Backspace at the start of a list item after a table ends the list first", () => {
  const editor = editorOn(`${TABLE}<ul><li>item</li></ul>`);
  editor.tf.select(at(editor, "item", 0));
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(`${TABLE}<p>item</p>`);
  editor.tf.deleteBackward("character");
  expect(html(editor)).toBe(`${TABLE}<p>item</p>`);
  expect(caret(editor)).toEqual(at(editor, "b2", 2));
});

test("a delete longer than what is left of the line beside a table stops at the line's edge", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "after", 1));
  editor.tf.delete({ distance: 3, reverse: true });
  editor.tf.select(at(editor, "before", 5));
  editor.tf.delete({ distance: 3 });
  expect(html(editor)).toBe(`<p>befor</p>${TABLE}<p>fter</p>`);
});

// ── A selection across a table's edge ──
// Plate takes a selection that runs into a table from outside to the
// table's end, and holds one that starts in a table to that table.

test("typing over a selection from a paragraph into a cell keeps the table and clears its cells", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "before", 3),
    focus: at(editor, "b1", 1),
  });
  expect(editor.selection?.focus).toEqual(at(editor, "b2", 2));
  editor.tf.insertText("Z");
  expect(html(editor)).toBe(
    "<p>befZ</p><table><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table><p>after</p>"
  );
  expect(editor.children.map((node) => node.type)).toEqual(["p", "table", "p"]);
});

test("deleting a selection from the paragraph after up into a cell keeps the table", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "after", 2),
    focus: at(editor, "b1", 1),
  });
  // Plate takes it past the table, to the end of the paragraph before.
  expect(editor.selection?.focus).toEqual(at(editor, "before", 6));
  editor.tf.deleteFragment({ direction: "backward" });
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table><p>ter</p>"
  );
  expect(editor.selection).toEqual({
    anchor: at(editor, "before", 6),
    focus: at(editor, "before", 6),
  });
});

test("a selection from a cell out of a table stays in the table", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "b2", 1),
    focus: at(editor, "after", 2),
  });
  editor.tf.insertText("Z");
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td>a1</td><td>a2</td></tr><tr><td>b1</td><td>bZ</td></tr></tbody></table><p>after</p>"
  );
});

test("out of a table that opens the text, typing clears the rest of the cell and what it covers after", () => {
  const editor = editorOn(`${TABLE}<p>after</p>`);
  editor.tf.select({
    anchor: at(editor, "b2", 1),
    focus: at(editor, "after", 2),
  });
  editor.tf.insertText("Z");
  expect(html(editor)).toBe(
    "<table><tbody><tr><td>a1</td><td>a2</td></tr><tr><td>b1</td><td>bZ</td></tr></tbody></table><p>ter</p>"
  );
});

test("a delete of part of a table clears the text it covers in each cell, and no more", () => {
  const editor = editorOn(PAGE);
  editor.tf.delete({
    at: { anchor: at(editor, "before", 3), focus: at(editor, "b1", 1) },
  });
  expect(html(editor)).toBe(
    "<p>bef</p><table><tbody><tr><td></td><td></td></tr><tr><td>1</td><td>b2</td></tr></tbody></table><p>after</p>"
  );
});

test("a delete from one table into another keeps both and clears the lines between", () => {
  const second =
    "<table><tbody><tr><td>c1</td><td>c2</td></tr></tbody></table>";
  const editor = editorOn(`${TABLE}<p>mid</p><p>dle</p>${second}`);
  editor.tf.delete({
    at: { anchor: at(editor, "b2", 1), focus: at(editor, "c1", 1) },
  });
  expect(html(editor)).toBe(
    "<table><tbody><tr><td>a1</td><td>a2</td></tr><tr><td>b1</td><td>b</td></tr></tbody></table><table><tbody><tr><td>1</td><td>c2</td></tr></tbody></table>"
  );
  expect(editor.children.map((node) => node.type)).toEqual([
    "table",
    "p",
    "table",
    "p",
  ]);
});

test("a selection over a whole table clears its cells and keeps it", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "before", 3),
    focus: at(editor, "after", 2),
  });
  editor.tf.deleteFragment();
  expect(html(editor)).toBe(
    "<p>bef</p><table><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table><p>ter</p>"
  );
});

test("Enter over a selection across two cells keeps both cells", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "a1", 1),
    focus: at(editor, "a2", 1),
  });
  editor.tf.insertBreak();
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td>a</td><td>2</td></tr><tr><td>b1</td><td>b2</td></tr></tbody></table><p>after</p>"
  );
});

test("a selection across cells of one table keeps Plate's own delete, which clears them", () => {
  const editor = editorOn(PAGE);
  editor.tf.select({
    anchor: at(editor, "a1", 1),
    focus: at(editor, "b1", 1),
  });
  editor.tf.deleteFragment();
  expect(html(editor)).toBe(
    "<p>before</p><table><tbody><tr><td></td><td>a2</td></tr><tr><td></td><td>b2</td></tr></tbody></table><p>after</p>"
  );
});

test("deleting the whole text selected empties it, tables and all", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(editor.api.range([]));
  editor.tf.deleteFragment();
  expect(html(editor)).toBe("");
});

// ── The whole text selected ──
// Select-all, either way, then Delete, typing or a paste (paste.test.ts)
// replaces everything, tables too.

const OPENS_WITH_TABLE = `${TABLE}<p>after</p>`;
const OPENS_WITH_RULE = "<hr><p>x</p>";
const OPENS_WITH_LIST = "<ul><li>x</li></ul><p>y</p>";

/** The whole text selected backward: from its end to its start. */
const REVERSED = (editor: SlateEditor): TRange => {
  const all = editor.api.range([]);
  if (!all) {
    throw new Error("no text");
  }
  return { anchor: all.focus, focus: all.anchor };
};

const selectAll = (editor: SlateEditor, way: string) =>
  editor.tf.select(way === "forward" ? editor.api.range([]) : REVERSED(editor));

test.each([
  "forward",
  "backward",
])("select-all %s then Delete empties the text, tables and all", (way) => {
  for (const start of [PAGE, OPENS_WITH_TABLE]) {
    const editor = editorOn(start);
    selectAll(editor, way);
    // Backspace deletes a selection backward, Delete forward.
    editor.tf.deleteFragment(
      way === "backward" ? { direction: "backward" } : undefined
    );
    expect(html(editor)).toBe("");
    expect(editor.children).toHaveLength(1);
  }
});

test.each([
  "forward",
  "backward",
])("typing over a select-all %s leaves only what was typed", (way) => {
  for (const start of [
    PAGE,
    OPENS_WITH_TABLE,
    OPENS_WITH_RULE,
    OPENS_WITH_LIST,
  ]) {
    const editor = editorOn(start);
    selectAll(editor, way);
    editor.tf.insertText("Z");
    expect(html(editor)).toBe("<p>Z</p>");
  }
});

test.each([
  "forward",
  "backward",
])("Enter over a select-all %s leaves two empty lines", (way) => {
  for (const start of [
    PAGE,
    OPENS_WITH_TABLE,
    OPENS_WITH_RULE,
    OPENS_WITH_LIST,
  ]) {
    const editor = editorOn(start);
    selectAll(editor, way);
    editor.tf.insertBreak();
    expect(html(editor)).toBe("");
    expect(types(editor)).toEqual(["p", "p"]);
    expect(caret(editor)).toEqual({ offset: 0, path: [1, 0] });
  }
});

test("a delete of the whole text from code removes a table that opens it", () => {
  const editor = editorOn(OPENS_WITH_TABLE);
  editor.tf.delete({ at: editor.api.range([]) });
  expect(html(editor)).toBe("");
  expect(editor.children).toHaveLength(1);
  expect(editor.children[0]?.type).toBe("p");
});

test("a selection short of the whole text still keeps the table", () => {
  const editor = editorOn(PAGE);
  const end = editor.api.end([]);
  if (!end) {
    throw new Error("no text");
  }
  editor.tf.select({ anchor: at(editor, "before", 1), focus: end });
  editor.tf.insertText("Z");
  expect(html(editor)).toBe(
    "<p>bZ</p><table><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table>"
  );
  expect(editor.children.map((node) => node.type)).toContain("table");
});

// ── Select-all from a table ──
// From a cell, Plate's select-all selects the table. A second one selects
// the whole text, as in Word, and then replaces everything as above.

/** The text `start`, with the caret in a1 and select-all pressed `times`. */
function selectAllFromCell(start: string, times: number): SlateEditor {
  const editor = editorOn(start);
  editor.tf.select(at(editor, "a1", 1));
  for (let i = 0; i < times; i += 1) {
    editor.tf.selectAll();
  }
  return editor;
}

test("a single select-all from a cell still selects just the table", () => {
  for (const start of [PAGE, OPENS_WITH_TABLE]) {
    const editor = selectAllFromCell(start, 1);
    const table = editor.api.range(start === PAGE ? [1] : [0]);
    expect(table).toBeDefined();
    expect(editor.selection).toEqual(table ?? null);
    expect(wholeValueSelected(editor)).toBe(false);
  }
});

test("a second select-all from a cell selects the whole text", () => {
  for (const start of [PAGE, OPENS_WITH_TABLE]) {
    const editor = selectAllFromCell(start, 2);
    const { selection } = editor;
    expect(selection && coversWholeValue(editor, selection)).toBe(true);
  }
});

test("typing over a second select-all from a cell leaves only what was typed", () => {
  for (const start of [PAGE, OPENS_WITH_TABLE]) {
    const editor = selectAllFromCell(start, 2);
    editor.tf.insertText("Z");
    expect(html(editor)).toBe("<p>Z</p>");
  }
});

test("select-all outside a table stays the browser's", () => {
  const editor = editorOn(PAGE);
  editor.tf.select(at(editor, "before", 1));
  expect(editor.tf.selectAll()).toBe(false);
  expect(caret(editor)).toEqual(at(editor, "before", 1));
});
