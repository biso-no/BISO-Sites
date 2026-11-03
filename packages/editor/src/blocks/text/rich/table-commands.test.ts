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
  tabFromLastCell,
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

/** A span as Plate reads it. */
const spanOf = (cell: Record<string, unknown>, name: "col" | "row"): number => {
  const attributes = cell.attributes as Record<string, string> | undefined;
  return (
    Number(cell[`${name}Span`]) || Number(attributes?.[`${name}span`]) || 1
  );
};

/**
 * Why the table is no whole grid, or `null`: every row holds a cell, no span
 * reaches past the last row or into another cell, and every row is as wide
 * as the others with nothing missing.
 */
function gridFault(table: TTableElement): string | null {
  const taken: boolean[][] = table.children.map(() => []);
  for (const [row, node] of table.children.entries()) {
    const cells = (node.children ?? []) as Record<string, unknown>[];
    if (!cells.some((cell) => cell.type === "td" || cell.type === "th")) {
      return `row ${row} holds no cell`;
    }
    let column = 0;
    for (const cell of cells) {
      while (taken[row]?.[column]) {
        column += 1;
      }
      const rows = spanOf(cell, "row");
      const columns = spanOf(cell, "col");
      if (row + rows > table.children.length) {
        return `a row span past the end at row ${row}`;
      }
      for (let r = row; r < row + rows; r += 1) {
        for (let c = column; c < column + columns; c += 1) {
          const line = taken[r] ?? [];
          if (line[c]) {
            return `cells overlap at ${r},${c}`;
          }
          line[c] = true;
        }
      }
      column += columns;
    }
  }
  const widths = taken.map((line) => line.filter(Boolean).length);
  const holes = taken.some((line) => line.length !== widths[0]);
  return holes || new Set(widths).size > 1 ? `ragged ${widths}` : null;
}

/** The HTML, which must also be what a re-parse of it writes. */
const roundTripped = (editor: SlateEditor): string => {
  const out = html(editor);
  expect(valueToHtml(htmlToValue(out))).toBe(out);
  return out;
};

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
    expect(gridFault(firstTable(editor)), action).toBeNull();
    expect(texts(editor), action).toEqual(kept);
    roundTripped(editor);
  }
});

test.each([
  [
    "a short row gets empty cells",
    "<table><tbody><tr><td>a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>",
    "<table><tbody><tr><td>a</td><td></td></tr><tr><td>b</td><td>c</td></tr></tbody></table>",
  ],
  [
    "a header row gets empty header cells",
    "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>",
    "<table><thead><tr><th>h</th><th></th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>",
  ],
  [
    "a row span stops at the last row",
    '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td rowspan="2">d</td></tr></tbody></table>',
    "<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></tbody></table>",
  ],
  [
    "a column span stops at the table's width",
    '<table><tbody><tr><td colspan="3">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>',
    '<table><tbody><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>',
  ],
  [
    "a row with no cell goes, and the span across it is shorter",
    '<table><tbody><tr><td rowspan="3">a</td><td>b</td></tr><tr></tr><tr><td>c</td></tr></tbody></table>',
    '<table><tbody><tr><td rowspan="2">a</td><td>b</td></tr><tr><td>c</td></tr></tbody></table>',
  ],
  [
    "a column span stops at a cell a row span put there",
    '<table><tbody><tr><td>a</td><td rowspan="2">b</td></tr><tr><td colspan="2">c</td></tr></tbody></table>',
    '<table><tbody><tr><td>a</td><td rowspan="2">b</td></tr><tr><td>c</td></tr></tbody></table>',
  ],
])("a loaded table is a whole grid: %s", (_, source, out) => {
  const editor = editorWith(source, "a");
  expect(roundTripped(editor)).toBe(out);
  expect(gridFault(firstTable(editor))).toBeNull();
});

test("a row span past the last row breaks no row command", () => {
  const source =
    '<table><tbody><tr><td>a</td><td>b</td></tr><tr><td>c</td><td rowspan="2">d</td></tr></tbody></table>';
  const commands: [string, (editor: SlateEditor) => void][] = [
    ["Tab", (editor) => expect(tabFromLastCell(editor)).toBe(true)],
    ["rowBelow", (editor) => runTableAction(editor, "rowBelow")],
    ["deleteRow", (editor) => runTableAction(editor, "deleteRow")],
  ];
  for (const [name, command] of commands) {
    const editor = editorWith(source, "d");
    expect(() => command(editor), name).not.toThrow();
    expect(gridFault(firstTable(editor)), name).toBeNull();
    roundTripped(editor);
  }
});

test("Delete column in a ragged table keeps the other column", () => {
  const editor = editorWith(
    "<table><tbody><tr><td>a</td></tr><tr><td>b</td><td>c</td></tr></tbody></table>",
    "c"
  );
  expect(texts(editor)).toEqual(["a", "b", "c"]);
  runTableAction(editor, "deleteColumn");
  expect(roundTripped(editor)).toBe(
    "<table><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>"
  );
});

test.each([
  [
    "a row span crossing the column",
    '<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>',
    "B",
    "<table><tbody><tr><td>A</td></tr><tr><td>D</td></tr></tbody></table>",
  ],
  [
    "a merged header",
    '<table><thead><tr><th colspan="2">H</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    "a",
    "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>",
  ],
  [
    "a header cell spanning two header rows",
    '<table><thead><tr><th rowspan="2">H</th><th>i</th></tr><tr><th>j</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
    "i",
    "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>a</td></tr></tbody></table>",
  ],
  [
    "a 2×2 merge",
    '<table><tbody><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td><td colspan="2" rowspan="2">e</td></tr><tr><td>f</td></tr></tbody></table>',
    "a",
    '<table><tbody><tr><td>b</td><td>c</td></tr><tr><td colspan="2">e</td></tr></tbody></table>',
  ],
])("Delete column with %s leaves a whole grid", (_, source, caret, out) => {
  const editor = editorWith(source, caret);
  runTableAction(editor, "deleteColumn");
  expect(roundTripped(editor)).toBe(out);
  expect(gridFault(firstTable(editor))).toBeNull();
});

test("deleting every column leaves no table behind", () => {
  const editor = editorWith(
    `<p>p</p><table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr><tr><td>D</td><td>E</td></tr></tbody></table>`,
    "B"
  );
  runTableAction(editor, "deleteColumn");
  const [, cell] =
    [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === "D") ?? [];
  editor.tf.select(editor.api.end(cell ?? []));
  runTableAction(editor, "deleteColumn");
  expect(editor.children.some((node) => node.type === "table")).toBe(false);
  expect(html(editor)).toBe("<p>p</p>");
});

test("a word selected in a cell: Delete row and Delete column act on its cell", () => {
  const source =
    "<table><tbody><tr><td>aa</td><td>bb</td></tr><tr><td>cc</td><td>dd</td></tr></tbody></table>";
  const selectWord = (editor: SlateEditor) => {
    const [, path] =
      [...NodeApi.texts(editor)].find(([leaf]) => leaf.text === "aa") ?? [];
    editor.tf.select({
      anchor: { offset: 0, path: path ?? [] },
      focus: { offset: 2, path: path ?? [] },
    });
  };
  const row = editorWith(source, "aa");
  selectWord(row);
  runTableAction(row, "deleteRow");
  expect(html(row)).toBe(
    "<table><tbody><tr><td>cc</td><td>dd</td></tr></tbody></table>"
  );
  const column = editorWith(source, "aa");
  selectWord(column);
  runTableAction(column, "deleteColumn");
  expect(html(column)).toBe(
    "<table><tbody><tr><td>bb</td></tr><tr><td>dd</td></tr></tbody></table>"
  );
});

test("Header row follows the header the page draws", () => {
  // H spans into the body row, so the page draws no header.
  const spanning = editorWith(
    '<table><tbody><tr><th rowspan="2">H</th><th>i</th></tr><tr><td>a</td></tr></tbody></table>',
    "a"
  );
  expect(tableState(spanning)).toEqual({
    headerRow: false,
    inHeaderRow: false,
  });
  runTableAction(spanning, "toggleHeader");
  expect(roundTripped(spanning)).toBe(
    '<table><thead><tr><th rowspan="2">H</th><th>i</th></tr><tr><th>a</th></tr></thead></table>'
  );
  expect(tableState(spanning)).toEqual({ headerRow: true, inHeaderRow: true });
  runTableAction(spanning, "toggleHeader");
  expect(html(spanning)).toBe(
    '<table><tbody><tr><td rowspan="2">H</td><td>i</td></tr><tr><td>a</td></tr></tbody></table>'
  );
});

test("a new row never splits the header group", () => {
  const source =
    '<table><thead><tr><th rowspan="2">H</th><th>i</th></tr><tr><th>j</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>';
  const above = editorWith(source, "j");
  expect(tableState(above)).toEqual({ headerRow: true, inHeaderRow: true });
  runTableAction(above, "rowAbove");
  expect(html(above)).toBe(source);

  const below = editorWith(source, "i");
  runTableAction(below, "rowBelow");
  expect(roundTripped(below)).toBe(
    '<table><thead><tr><th rowspan="2">H</th><th>i</th></tr><tr><th>j</th></tr></thead><tbody><tr><td></td><td></td></tr><tr><td>a</td><td>b</td></tr></tbody></table>'
  );
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
