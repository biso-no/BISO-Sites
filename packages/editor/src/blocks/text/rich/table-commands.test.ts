import { afterAll, beforeAll, expect, test } from "bun:test";
import { isTableRectangular } from "@platejs/table";
import { Window } from "happy-dom";
import { NodeApi, type SlateEditor, type TTableElement } from "platejs";
import { createConversionEditor, htmlToValue, valueToHtml } from "./html";
import {
  insertRichTable,
  inTableCell,
  runTableAction,
  type TableAction,
  tableState,
} from "./table-commands";

const previous = { Node: globalThis.Node, document: globalThis.document };

beforeAll(() => {
  const window = new Window();
  globalThis.document = window.document as unknown as Document;
  globalThis.Node = window.Node as unknown as typeof Node;
});

afterAll(() => {
  Object.assign(globalThis, previous);
});

/**
 * A conversion editor holding `html`, the caret at the end of the text
 * `caretAfter`. Node ids on: Plate's merge-aware row and column transforms
 * find each cell's place in the grid by its id.
 */
function editorWith(html: string, caretAfter: string): SlateEditor {
  const editor = createConversionEditor([], { nodeId: true });
  editor.tf.setValue(htmlToValue(html));
  const [, path] =
    [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === caretAfter) ?? [];
  if (!path) {
    throw new Error(`no text "${caretAfter}" in ${html}`);
  }
  editor.tf.select(editor.api.end(path));
  return editor;
}

const html = (editor: SlateEditor): string => valueToHtml(editor.children);

const firstTable = (editor: SlateEditor): TTableElement =>
  editor.children.find((node) => node.type === "table") as TTableElement;

const texts = (editor: SlateEditor): string[] =>
  [...NodeApi.texts(editor)].map(([leaf]) => leaf.text).filter(Boolean);

const EMPTY_ROW = "<tr><td></td><td></td><td></td></tr>";
const ONE_CELL = "<table><tbody><tr><td>x</td></tr></tbody></table>";

test("insertRichTable adds a 3×3 table with a header row, caret in the first header cell", () => {
  const editor = editorWith("<p>a</p>", "a");
  insertRichTable(editor);
  expect(html(editor)).toBe(
    `<p>a</p><table><thead><tr><th></th><th></th><th></th></tr></thead><tbody>${EMPTY_ROW}${EMPTY_ROW}</tbody></table>`
  );
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([1, 0, 0]);
  expect(editor.api.above({ match: { type: "th" } })).toBeDefined();
});

test("insertRichTable on an empty line puts the table in its place", () => {
  const editor = editorWith("<p>a</p>", "a");
  editor.tf.insertBreak();
  insertRichTable(editor);
  expect(editor.children.map((node) => node.type)).toEqual(["p", "table", "p"]);
  expect(editor.selection?.focus.path.slice(0, 3)).toEqual([1, 0, 0]);
});

test.each([
  [
    "rowBelow",
    "<table><tbody><tr><td>x</td></tr><tr><td></td></tr></tbody></table>",
  ],
  [
    "rowAbove",
    "<table><tbody><tr><td></td></tr><tr><td>x</td></tr></tbody></table>",
  ],
  ["columnRight", "<table><tbody><tr><td>x</td><td></td></tr></tbody></table>"],
  ["columnLeft", "<table><tbody><tr><td></td><td>x</td></tr></tbody></table>"],
  ["toggleHeader", "<table><thead><tr><th>x</th></tr></thead></table>"],
] as [TableAction, string][])("%s on a one-cell table", (action, out) => {
  const editor = editorWith(ONE_CELL, "x");
  runTableAction(editor, action);
  expect(html(editor)).toBe(out);
});

test("row above does nothing in the header row; a new column follows each row's kind", () => {
  const source =
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>";
  const editor = editorWith(source, "h");
  expect(tableState(editor)).toEqual({ headerRow: true, inHeaderRow: true });
  runTableAction(editor, "rowAbove");
  expect(html(editor)).toBe(source);

  runTableAction(editor, "columnRight");
  expect(html(editor)).toBe(
    "<table><thead><tr><th>h</th><th></th></tr></thead><tbody><tr><td>a</td><td></td></tr></tbody></table>"
  );

  const below = editorWith(source, "h");
  runTableAction(below, "rowBelow");
  expect(html(below)).toBe(
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td></td></tr><tr><td>a</td></tr></tbody></table>"
  );
});

test("toggleHeader turns an all-th first row back into td", () => {
  const editor = editorWith(
    "<table><thead><tr><th>h</th><th>i</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>",
    "a"
  );
  expect(tableState(editor)).toEqual({ headerRow: true, inHeaderRow: false });
  runTableAction(editor, "toggleHeader");
  expect(html(editor)).toBe(
    "<table><tbody><tr><td>h</td><td>i</td></tr><tr><td>a</td><td>b</td></tr></tbody></table>"
  );
  expect(tableState(editor)).toEqual({ headerRow: false, inHeaderRow: false });

  // A first row with one th among td cells becomes all th.
  const mixed = editorWith(
    "<table><tbody><tr><th>h</th><td>i</td></tr></tbody></table>",
    "i"
  );
  runTableAction(mixed, "toggleHeader");
  expect(html(mixed)).toBe(
    "<table><thead><tr><th>h</th><th>i</th></tr></thead></table>"
  );
});

test("deleting the last row or column deletes the table", () => {
  for (const action of ["deleteRow", "deleteColumn"] as const) {
    const editor = editorWith(`<p>a</p>${ONE_CELL}`, "x");
    runTableAction(editor, action);
    expect(html(editor)).toBe("<p>a</p>");
    expect(editor.selection?.focus.path[0]).toBe(1);
  }
  // A cell that spans every column is the last column too.
  const spanning = editorWith(
    '<table><tbody><tr><td colspan="2">x</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>',
    "x"
  );
  runTableAction(spanning, "deleteColumn");
  expect(html(spanning)).toBe("");
});

test("deleteRow and deleteColumn remove the caret's row or column", () => {
  const source =
    "<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>";
  const row = editorWith(source, "a");
  runTableAction(row, "deleteRow");
  expect(html(row)).toBe(
    "<table><tbody><tr><td>c</td><td>d</td></tr></tbody></table>"
  );
  const column = editorWith(source, "a");
  runTableAction(column, "deleteColumn");
  expect(html(column)).toBe(
    "<table><tbody><tr><td>b</td></tr><tr><td>d</td></tr></tbody></table>"
  );
});

test("deleteTable leaves the caret in the block after the table", () => {
  const editor = editorWith(`<p>a</p>${ONE_CELL}<p>b</p>`, "x");
  runTableAction(editor, "deleteTable");
  expect(html(editor)).toBe("<p>a</p><p>b</p>");
  expect(editor.selection?.focus).toEqual({ offset: 0, path: [1, 0] });

  // At the end of the value, the line the value always keeps below a table.
  const last = editorWith(`<p>a</p>${ONE_CELL}`, "x");
  runTableAction(last, "deleteTable");
  expect(last.children).toHaveLength(2);
  expect(last.selection?.focus.path).toEqual([1, 0]);
  expect(last.children[1]?.type).toBe("p");
});

test("row and column edits keep a merged table rectangular", () => {
  const source =
    '<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>';
  for (const [action, kept] of [
    ["rowBelow", ["a", "b", "c"]],
    ["columnRight", ["a", "b", "c"]],
    ["deleteColumn", ["a", "c"]],
  ] as [TableAction, string[]][]) {
    const editor = editorWith(source, "b");
    runTableAction(editor, action);
    expect(isTableRectangular(firstTable(editor)), action).toBe(true);
    expect(texts(editor), action).toEqual(kept);
  }
});

test("inTableCell and tableState read the caret", () => {
  const editor = editorWith(`<p>a</p>${ONE_CELL}`, "a");
  expect(inTableCell(editor)).toBe(false);
  expect(tableState(editor)).toBeNull();
  const [, cellText] =
    [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === "x") ?? [];
  editor.tf.select(editor.api.end(cellText ?? []));
  expect(inTableCell(editor)).toBe(true);
  expect(tableState(editor)).toEqual({ headerRow: false, inHeaderRow: false });

  editor.tf.deselect();
  expect(inTableCell(editor)).toBe(false);
  expect(tableState(editor)).toBeNull();
});
