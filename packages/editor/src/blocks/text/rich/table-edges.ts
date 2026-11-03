import {
  createSlatePlugin,
  type DeleteTextOptions,
  getAt,
  KEYS,
  NodeApi,
  type NodeEntry,
  type Path,
  PathApi,
  type Point,
  PointApi,
  RangeApi,
  type SlateEditor,
  type TElement,
  type TRange,
} from "platejs";
import { isTableCell } from "./table-grid";

// What deleting does at a table's edges, as in Word: no text crosses into or
// out of a cell, and deleting text never removes a table.

type Delete = (options?: DeleteTextOptions) => void;

/** The first and the last point of the node at `path`, which is in the value. */
function edgesOf(editor: SlateEditor, path: Path): [Point, Point] {
  const start = editor.api.start(path);
  const end = editor.api.end(path);
  if (!(start && end)) {
    throw new Error(`No node at [${path.join(", ")}]`);
  }
  return [start, end];
}

/** The node's first point, or its last when `last`. */
const edgeOf = (editor: SlateEditor, path: Path, last: boolean): Point =>
  edgesOf(editor, path)[last ? 1 : 0];

const cellAt = (
  editor: SlateEditor,
  point: Point
): NodeEntry<TElement> | undefined =>
  editor.api.above<TElement>({ at: point, match: isTableCell });

const range = (from: Point, to: Point): TRange =>
  PointApi.isBefore(from, to)
    ? { anchor: from, focus: to }
    : { anchor: to, focus: from };

/** Whether no text lies between `a` and `b`: an inline's edge is its block's. */
const sameSpot = (editor: SlateEditor, a: Point, b: Point): boolean =>
  PointApi.equals(a, b) || editor.api.string(range(a, b)) === "";

/** The text between `from` and `to` deleted, if any: a delete that crosses no edge. */
function deleteBetween(
  remove: Delete,
  editor: SlateEditor,
  from: Point,
  to: Point
): void {
  if (!sameSpot(editor, from, to)) {
    remove({ at: range(from, to), hanging: true });
  }
}

/**
 * A caret's one-step delete (Backspace, Delete, a word or a line) that would
 * cross a table's edge. In a cell it stops at the cell's edge. Beside a
 * table it stops at its block's edge; from there the caret moves into the
 * table instead (the last cell's end, or the first cell's start), and an
 * empty line it leaves goes, unless it is the last line. Whether it handled
 * the delete.
 */
function deleteAtEdge(
  remove: Delete,
  editor: SlateEditor,
  point: Point,
  options: DeleteTextOptions
): boolean {
  const { distance = 1, reverse = false, unit = "character" } = options;
  const target = reverse
    ? editor.api.before(point, { distance, unit })
    : editor.api.after(point, { distance, unit });
  const cell = cellAt(editor, point);
  const targetCell = target ? cellAt(editor, target) : undefined;
  if (cell) {
    if (targetCell && PathApi.equals(targetCell[1], cell[1])) {
      return false;
    }
    deleteBetween(remove, editor, edgeOf(editor, cell[1], !reverse), point);
    return true;
  }
  const block = editor.api.block({ at: point });
  if (!(targetCell && block)) {
    return false;
  }
  const [node, path] = block;
  const edge = edgeOf(editor, path, !reverse);
  if (!sameSpot(editor, edge, point)) {
    deleteBetween(remove, editor, edge, point);
    return true;
  }
  if (options.at != null) {
    // A delete asked of a place, not of the caret: nothing to move.
    return true;
  }
  const table = editor.api.above({
    at: targetCell[1],
    match: { type: KEYS.table },
  });
  if (!table) {
    return true;
  }
  const tableRef = editor.api.pathRef(table[1]);
  const isLast = !NodeApi.has(editor, PathApi.next(path));
  if (NodeApi.string(node) === "" && !isLast) {
    editor.tf.removeNodes({ at: path });
  }
  const tablePath = tableRef.unref();
  if (tablePath) {
    editor.tf.select(edgeOf(editor, tablePath, reverse));
  }
  return true;
}

/** The tables `at` runs into, in order. */
const tablesIn = (editor: SlateEditor, at: TRange): NodeEntry<TElement>[] => [
  ...editor.api.nodes<TElement>({
    at,
    match: { type: KEYS.table },
    mode: "highest",
  }),
];

/**
 * What a delete of `at` removes when it runs into the tables `tables`: the
 * text it covers outside them, and in each cell of theirs it covers, the
 * text it covers there. In order.
 */
function pieces(
  editor: SlateEditor,
  at: TRange,
  tables: NodeEntry<TElement>[]
): [Point, Point][] {
  const [start, end] = RangeApi.edges(at);
  const found: [Point, Point][] = [];
  let cursor: Point | undefined = start;
  for (const [, path] of tables) {
    const [tableStart, tableEnd] = edgesOf(editor, path);
    const before = editor.api.before(tableStart);
    if (cursor && before && PointApi.isBefore(cursor, tableStart)) {
      found.push([cursor, before]);
    }
    const from =
      cursor && PointApi.isAfter(cursor, tableStart) ? cursor : tableStart;
    const to = PointApi.isBefore(end, tableEnd) ? end : tableEnd;
    for (const [, cellPath] of editor.api.nodes<TElement>({
      at: { anchor: from, focus: to },
      match: isTableCell,
    })) {
      const [cellStart, cellEnd] = edgesOf(editor, cellPath);
      found.push([
        PointApi.isAfter(from, cellStart) ? from : cellStart,
        PointApi.isBefore(to, cellEnd) ? to : cellEnd,
      ]);
    }
    cursor = editor.api.after(tableEnd);
  }
  if (cursor && PointApi.isBefore(cursor, end)) {
    found.push([cursor, end]);
  }
  return found;
}

/**
 * A delete of a range that runs into a table, unless it lies in one cell:
 * each piece (`pieces`) deleted on its own, the last first so the others'
 * places hold, and the caret, when it was the selection's, at the start.
 * Whether it handled the delete.
 */
function deleteAcross(
  remove: Delete,
  editor: SlateEditor,
  at: TRange,
  options: DeleteTextOptions
): boolean {
  let target = at;
  if (
    !(
      options.hanging ||
      PointApi.equals(RangeApi.end(at), edgeOf(editor, [], true))
    )
  ) {
    target = editor.api.unhangRange(at, { voids: options.voids });
  }
  const tables = tablesIn(editor, target);
  if (tables.length === 0) {
    return false;
  }
  const [start, end] = RangeApi.edges(target);
  const startCell = cellAt(editor, start);
  const endCell = cellAt(editor, end);
  if (startCell && endCell && PathApi.equals(startCell[1], endCell[1])) {
    return false;
  }
  editor.tf.withoutNormalizing(() => {
    for (const [from, to] of pieces(editor, target, tables).reverse()) {
      deleteBetween(remove, editor, from, to);
    }
    if (options.at == null) {
      editor.tf.select(start);
    }
  });
  return true;
}

/** Whether both ends of `at` are in one table: Plate clears its grid. */
function inOneTable(editor: SlateEditor, at: TRange): boolean {
  const [start, end] = RangeApi.edges(at);
  const tableOf = (point: Point) =>
    editor.api.above({ at: point, match: { type: KEYS.table } })?.[1];
  const startTable = tableOf(start);
  const endTable = tableOf(end);
  return Boolean(
    startTable && endTable && PathApi.equals(startTable, endTable)
  );
}

/** A delete's place as a caret, a range, or neither (a path: a node goes). */
function placeOf(
  editor: SlateEditor,
  options: DeleteTextOptions
): Point | TRange | null {
  const at =
    getAt<Point | TRange | number[]>(editor, options.at) ?? editor.selection;
  if (!at || PathApi.isPath(at)) {
    return null;
  }
  if (PointApi.isPoint(at)) {
    return at;
  }
  return RangeApi.isCollapsed(at) ? at.anchor : at;
}

/**
 * Deleting at a table's edges, wherever a delete comes from: Backspace and
 * Delete (`deleteAtEdge`), and a selection deleted, typed over, pasted over
 * or broken with Enter (`deleteAcross`). A selection that runs into a table
 * deletes what it covers outside it and clears the text it covers in the
 * cells; the table and its cells stay, as they do under a selection that
 * holds the whole table. Only the table bar removes a table, and Plate's
 * reset when the whole text is selected and deleted. A selection in one
 * table keeps Plate's own handling, which clears the cells of its grid.
 * Plate also holds a selection that starts in a table to that table, and
 * takes one that runs into a table from outside to the table's end.
 */
export const RichTableEdgesPlugin = createSlatePlugin({
  key: "richTableEdges",
}).overrideEditor(({ editor, tf: { delete: remove, deleteFragment } }) => ({
  transforms: {
    delete(options = {}) {
      const place = placeOf(editor, options);
      let handled = false;
      if (place && PointApi.isPoint(place)) {
        handled =
          !editor.api.void({ at: place }) &&
          deleteAtEdge(remove, editor, place, options);
      } else if (place) {
        handled = deleteAcross(remove, editor, place, options);
      }
      if (!handled) {
        remove(options);
      }
    },
    deleteFragment(options) {
      const { selection } = editor;
      const runsIntoTable =
        selection !== null &&
        RangeApi.isExpanded(selection) &&
        !RangeApi.equals(selection, {
          anchor: edgeOf(editor, [], false),
          focus: edgeOf(editor, [], true),
        }) &&
        !inOneTable(editor, selection) &&
        tablesIn(editor, selection).length > 0;
      if (runsIntoTable) {
        editor.tf.delete({ reverse: options?.direction === "backward" });
        return;
      }
      deleteFragment(options);
    },
  },
}));
