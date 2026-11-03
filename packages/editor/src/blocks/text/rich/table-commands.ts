import {
  BaseTablePlugin,
  getColSpan,
  getRowSpan,
  getTableColumnCount,
  insertTable,
} from "@platejs/table";
import {
  type Descendant,
  ElementApi,
  KEYS,
  NodeApi,
  type NodeEntry,
  type Path,
  type SlateEditor,
  type TElement,
  type TTableElement,
} from "platejs";
import { isListItem } from "./html";
import { TABLE_CELL_TYPES } from "./plugins";

// What the table bar, ⊞ and the keys do to a table. Plain functions on any
// Slate editor with the table plugin, so they run on the headless conversion
// editor in tests. Rows and columns go through Plate's merge-aware
// transforms, which keep a table with merged cells rectangular.

const isCell = (node: unknown): node is TElement =>
  ElementApi.isElement(node) && TABLE_CELL_TYPES.includes(node.type);

/** The first cell in the selection, in its table. */
function selectedCell(
  editor: SlateEditor
): { cell: NodeEntry<TElement>; table: NodeEntry<TTableElement> } | undefined {
  const cell = editor.api.node<TElement>({ match: isCell });
  const table = cell
    ? editor.api.above<TTableElement>({
        at: cell[1],
        match: { type: KEYS.table },
      })
    : undefined;
  return cell && table ? { cell, table } : undefined;
}

/** Whether the selection is in a table cell. */
export function inTableCell(editor: SlateEditor): boolean {
  return editor.selection !== null && editor.api.some({ match: isCell });
}

/** A row node's children; none for anything else. */
const rowChildren = (row: Descendant | undefined): Descendant[] =>
  ElementApi.isElement(row) ? row.children : [];

/** The header row: the first row, when every one of its cells is a `th`. */
const hasHeaderRow = (table: TTableElement): boolean => {
  const cells = rowChildren(table.children[0]);
  return cells.length > 0 && cells.every((cell) => cell.type === KEYS.th);
};

export interface TableState {
  /** The first row is a header row. */
  headerRow: boolean;
  /** The caret is in the header row. */
  inHeaderRow: boolean;
}

/** The table at the selection, as the table bar shows it; `null` outside one. */
export function tableState(editor: SlateEditor): TableState | null {
  const at = selectedCell(editor);
  if (!at) {
    return null;
  }
  const headerRow = hasHeaderRow(at.table[0]);
  return { headerRow, inHeaderRow: headerRow && rowIndex(at.cell[1]) === 0 };
}

/** A cell's row: the index of its `tr` in the table. */
const rowIndex = (cellPath: Path): number => cellPath.at(-2) ?? 0;

const isEmptyParagraph = (node: TElement | undefined): boolean =>
  node?.type === KEYS.p && !isListItem(node) && NodeApi.string(node) === "";

/** Three columns and three rows, the first a header row. */
const NEW_TABLE = { colCount: 3, header: true, rowCount: 3 };

/**
 * A 3×3 table with a header row after the block at the caret, with the caret
 * in its first header cell. An empty line at the caret becomes the table.
 */
export function insertRichTable(editor: SlateEditor): void {
  const index = editor.selection?.focus.path[0];
  const block = index === undefined ? undefined : editor.children[index];
  if (index === undefined || !isEmptyParagraph(block)) {
    insertTable(editor, NEW_TABLE, { select: true });
    return;
  }
  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at: [index] });
    insertTable(editor, NEW_TABLE, { at: [index], select: true });
  });
}

export type TableAction =
  | "rowAbove"
  | "rowBelow"
  | "columnLeft"
  | "columnRight"
  | "deleteRow"
  | "deleteColumn"
  | "toggleHeader"
  | "deleteTable";

/** Removes the table, with the caret at the start of the block after it. */
function deleteTable(editor: SlateEditor, tablePath: Path): void {
  editor.tf.withoutNormalizing(() => {
    editor.tf.removeNodes({ at: tablePath });
    if (!editor.api.node(tablePath)) {
      editor.tf.insertNodes(
        { type: KEYS.p, children: [{ text: "" }] },
        { at: tablePath }
      );
    }
  });
  editor.tf.select(editor.api.start(tablePath));
}

/**
 * Every cell of the first row a `td` when they are all `th`, and a `th`
 * otherwise.
 */
function toggleHeader(
  editor: SlateEditor,
  [table, path]: NodeEntry<TTableElement>
) {
  const type = hasHeaderRow(table) ? KEYS.td : KEYS.th;
  editor.tf.withoutNormalizing(() => {
    for (const [index, cell] of rowChildren(table.children[0]).entries()) {
      if (isCell(cell)) {
        editor.tf.setNodes({ type }, { at: [...path, 0, index] });
      }
    }
  });
}

/**
 * Runs a table bar command at the selection's first cell. A new row is a body
 * row, and never goes above the header row; a new column takes each row's
 * kind (`th` in the header row, `td` elsewhere). Deleting a table's last row
 * or last column deletes the table.
 */
export function runTableAction(editor: SlateEditor, action: TableAction): void {
  const at = selectedCell(editor);
  if (!at) {
    return;
  }
  const { cell, table } = at;
  const tf = editor.getTransforms(BaseTablePlugin);
  switch (action) {
    case "rowAbove":
      if (!(hasHeaderRow(table[0]) && rowIndex(cell[1]) === 0)) {
        tf.insert.tableRow({ before: true, header: false });
      }
      return;
    case "rowBelow":
      tf.insert.tableRow({ header: false });
      return;
    case "columnLeft":
      tf.insert.tableColumn({ before: true });
      return;
    case "columnRight":
      tf.insert.tableColumn();
      return;
    case "deleteRow":
      if (
        rowIndex(cell[1]) === 0 &&
        getRowSpan(cell[0]) >= table[0].children.length
      ) {
        deleteTable(editor, table[1]);
      } else {
        tf.remove.tableRow();
      }
      return;
    case "deleteColumn":
      if (getColSpan(cell[0]) >= getTableColumnCount(table[0])) {
        deleteTable(editor, table[1]);
      } else {
        tf.remove.tableColumn();
      }
      return;
    case "toggleHeader":
      toggleHeader(editor, table);
      return;
    case "deleteTable":
      deleteTable(editor, table[1]);
      return;
    default:
      return;
  }
}

/**
 * Tab in a table's last cell: a new body row at the end, with the caret in
 * its first cell. Whether the caret was in the last cell.
 */
export function tabFromLastCell(editor: SlateEditor): boolean {
  const at = selectedCell(editor);
  if (!(at && editor.api.isCollapsed())) {
    return false;
  }
  const [table, tablePath] = at.table;
  const lastRow = table.children.length - 1;
  const [, cellPath] = at.cell;
  const isLast =
    rowIndex(cellPath) === lastRow &&
    cellPath.at(-1) === rowChildren(table.children[lastRow]).length - 1;
  if (!isLast) {
    return false;
  }
  editor.getTransforms(BaseTablePlugin).insert.tableRow({ header: false });
  editor.tf.select(editor.api.start([...tablePath, lastRow + 1]));
  return true;
}
