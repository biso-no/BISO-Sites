import {
  BaseTablePlugin,
  getColSpan,
  getRowSpan,
  insertTable,
} from "@platejs/table";
import {
  type Descendant,
  ElementApi,
  KEYS,
  NodeApi,
  type NodeEntry,
  type Path,
  PathApi,
  type Point,
  type SlateEditor,
  type TElement,
  type TTableElement,
} from "platejs";
import { isListItem } from "./html";
import { headerRows, isTableCell, tableGrid } from "./table-grid";

// What the table bar, ⊞ and the keys do to a table. Plain functions on any
// Slate editor with the table plugin, so they run on the headless conversion
// editor in tests. Rows and columns go through Plate's merge-aware
// transforms; `RichShapePlugin` then holds the table to a whole grid, so the
// commands always start from one, and the width read here is the grid's.

/** A cell, in its table. */
interface CellAt {
  cell: NodeEntry<TElement>;
  table: NodeEntry<TTableElement>;
}

/** The first cell in the selection, in its table. */
function selectedCell(editor: SlateEditor): CellAt | undefined {
  const cell = editor.api.node<TElement>({ match: isTableCell });
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
  return editor.selection !== null && editor.api.some({ match: isTableCell });
}

/** The cell `point` is in, if any. */
const cellPathAt = (editor: SlateEditor, point: Point): Path | undefined =>
  editor.api.above({ at: point, match: isTableCell })?.[1];

/** Whether the selection is a caret in a cell, or a range inside one. */
function inOneCell(editor: SlateEditor): boolean {
  const { selection } = editor;
  if (!selection) {
    return false;
  }
  const anchor = cellPathAt(editor, selection.anchor);
  const focus = cellPathAt(editor, selection.focus);
  return Boolean(anchor && focus && PathApi.equals(anchor, focus));
}

export interface TableState {
  /** The page draws a header row: the table has a header group. */
  headerRow: boolean;
  /** The caret is in the header group. */
  inHeaderRow: boolean;
}

/** A cell's row: the index of its `tr` in the table. */
const rowIndex = (cellPath: Path): number => cellPath.at(-2) ?? 0;

/** A row node's children; none for anything else. */
const rowChildren = (row: Descendant | undefined): Descendant[] =>
  ElementApi.isElement(row) ? row.children : [];

/** The table at the selection, as the table bar shows it; `null` outside one. */
export function tableState(editor: SlateEditor): TableState | null {
  const at = selectedCell(editor);
  if (!at) {
    return null;
  }
  const head = headerRows(at.table[0]);
  return { headerRow: head > 0, inHeaderRow: rowIndex(at.cell[1]) < head };
}

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
 * The fewest leading rows that can be a header: the first, and every row a
 * row span from them reaches into.
 */
function headerReach(table: TTableElement): number {
  const { rows } = tableGrid(table);
  let reach = 1;
  for (const [index, row] of rows.entries()) {
    if (index >= reach) {
      break;
    }
    for (const cell of row.cells) {
      reach = Math.max(reach, index + cell.rowSpan);
    }
  }
  return reach;
}

/**
 * The page's header row off or on. With a header group, its cells become
 * `td`. Without one, the first row's become `th`, with the rows its row spans
 * reach into, so the page can draw them as a header.
 */
function toggleHeader(
  editor: SlateEditor,
  [table, path]: NodeEntry<TTableElement>
) {
  const head = headerRows(table);
  const type = head > 0 ? KEYS.td : KEYS.th;
  const rows = head > 0 ? head : headerReach(table);
  editor.tf.withoutNormalizing(() => {
    for (const [index, row] of table.children.slice(0, rows).entries()) {
      for (const [cellIndex, cell] of rowChildren(row).entries()) {
        if (isTableCell(cell)) {
          editor.tf.setNodes({ type }, { at: [...path, index, cellIndex] });
        }
      }
    }
  });
}

/**
 * Runs a table bar command at the selection's first cell; a selection inside
 * one cell first becomes a caret at its focus, so Delete row and Delete
 * column act on the cell's row and column. A new row is a body row: above
 * the header group it goes nowhere, and from inside it it goes after the
 * group. A new column takes each row's kind (`th` in a row of `th`, `td`
 * elsewhere). Deleting a table's last row or last column deletes the table.
 */
export function runTableAction(editor: SlateEditor, action: TableAction): void {
  if (editor.api.isExpanded() && inOneCell(editor)) {
    editor.tf.collapse({ edge: "focus" });
  }
  const at = selectedCell(editor);
  if (!at) {
    return;
  }
  // One step for the grid: Plate's transforms take several operations
  // (a span grows, then a row goes in), and the table is held to a whole
  // grid only once they are all done.
  editor.tf.withoutNormalizing(() => runAt(editor, action, at));
}

/** `runTableAction` at that cell. */
function runAt(
  editor: SlateEditor,
  action: TableAction,
  { cell, table }: CellAt
): void {
  const row = rowIndex(cell[1]);
  const head = headerRows(table[0]);
  const tf = editor.getTransforms(BaseTablePlugin);
  switch (action) {
    case "rowAbove":
      if (row >= head) {
        tf.insert.tableRow({ before: true, header: false });
      }
      return;
    case "rowBelow":
      tf.insert.tableRow(
        row < head
          ? { fromRow: [...table[1], head - 1], header: false }
          : { header: false }
      );
      return;
    case "columnLeft":
      tf.insert.tableColumn({ before: true });
      return;
    case "columnRight":
      tf.insert.tableColumn();
      return;
    case "deleteRow":
      if (row === 0 && getRowSpan(cell[0]) >= table[0].children.length) {
        deleteTable(editor, table[1]);
      } else {
        tf.remove.tableRow();
      }
      return;
    case "deleteColumn":
      if (getColSpan(cell[0]) >= tableGrid(table[0]).width) {
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
 * Tab in a table's last cell (a caret, or a range inside it): a new body row
 * at the end, with the caret in its first cell. Whether it was the last cell.
 */
export function tabFromLastCell(editor: SlateEditor): boolean {
  const at = selectedCell(editor);
  if (!(at && inOneCell(editor))) {
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
  editor.tf.withoutNormalizing(() => {
    editor.getTransforms(BaseTablePlugin).insert.tableRow({ header: false });
    editor.tf.select(editor.api.start([...tablePath, lastRow + 1]));
  });
  return true;
}
