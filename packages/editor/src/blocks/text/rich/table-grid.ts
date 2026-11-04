import { getColSpan, getRowSpan } from "@platejs/table";
import { type Descendant, ElementApi, KEYS, type TElement } from "platejs";
import { keptCellSpan } from "@/lib/rich-allowlist";

// A table as the grid a browser lays out, made whole: what the editor holds
// (`RichShapePlugin`) and what the page stores (`valueToHtml`). Pure: only
// Plate's types and its span reads.

/** The cell types. Shared with the plugins, the serializer and the commands. */
export const TABLE_CELL_TYPES: readonly string[] = [KEYS.td, KEYS.th];

export const isTableCell = (node: unknown): node is TElement =>
  ElementApi.isElement(node) && TABLE_CELL_TYPES.includes(node.type);

/** A span as the page writes it: 2 to 20, or 1 where the sanitisers drop it. */
export const writtenSpan = (span: number): number =>
  Number(keptCellSpan(String(span)) ?? 1);

/** A place in the grid: a cell of the table, or (`cell` null) one it lacks. */
export interface GridCell {
  /** The cell, or `null` for an empty one the grid adds. */
  cell: TElement | null;
  colSpan: number;
  /**
   * The cell's index in its row; for an added cell, the index it goes in
   * (before the row's next cell).
   */
  index: number;
  rowSpan: number;
  /** The column it starts in. */
  start: number;
  type: string;
}

export interface GridRow {
  cells: GridCell[];
  /** The row's index in the table. */
  index: number;
}

export interface TableGrid {
  rows: GridRow[];
  width: number;
}

/** Marks columns `from` to `to` (not included) in each of `lines`. */
function mark(lines: boolean[][], from: number, to: number): void {
  for (const line of lines) {
    for (let column = from; column < to; column += 1) {
      line[column] = true;
    }
  }
}

/** A row's cells with their indices; none for a row with no cell. */
const cellsOf = (row: Descendant): [TElement, number][] =>
  ElementApi.isElement(row) && row.type === KEYS.tr
    ? row.children.flatMap((cell, index): [TElement, number][] =>
        isTableCell(cell) ? [[cell, index]] : []
      )
    : [];

/**
 * The grid `table` makes, made whole:
 * - a row with no cell goes, and a row span that crossed it is one shorter;
 *   no row span reaches past the last row;
 * - a column span stops before a cell a row span from above put there, and
 *   reaches no further than the last column any cell starts in (the table's
 *   width);
 * - a row short of the width gets empty cells where it has none: `th` in a
 *   row of `th`, `td` otherwise.
 *
 * Spans are read as the page writes them (`writtenSpan`).
 */
export function tableGrid(table: TElement): TableGrid {
  const kept = table.children
    .map((row, index) => ({ cells: cellsOf(row), index }))
    .filter((row) => row.cells.length > 0);
  // A span counts the rows it covers that stay.
  const rowsCovered = (from: number, span: number): number =>
    kept.filter((row) => row.index >= from && row.index < from + span).length;
  const taken: boolean[][] = kept.map(() => []);
  const isFree = (row: number, column: number, rows: number): boolean =>
    taken.slice(row, row + rows).every((line) => !line[column]);

  const placed = kept.map((row, rowIndex) => {
    let column = 0;
    return row.cells.map(([cell, index]): GridCell => {
      while (taken[rowIndex]?.[column]) {
        column += 1;
      }
      const rowSpan = rowsCovered(row.index, writtenSpan(getRowSpan(cell)));
      const wanted = writtenSpan(getColSpan(cell));
      let colSpan = 1;
      while (colSpan < wanted && isFree(rowIndex, column + colSpan, rowSpan)) {
        colSpan += 1;
      }
      mark(taken.slice(rowIndex, rowIndex + rowSpan), column, column + colSpan);
      const start = column;
      column += colSpan;
      return { cell, colSpan, index, rowSpan, start, type: cell.type };
    });
  });

  const width = Math.max(0, ...placed.flat().map((cell) => cell.start + 1));
  const covered: boolean[][] = kept.map(() => []);
  for (const [rowIndex, cells] of placed.entries()) {
    for (const cell of cells) {
      cell.colSpan = Math.min(cell.colSpan, width - cell.start);
      mark(
        covered.slice(rowIndex, rowIndex + cell.rowSpan),
        cell.start,
        cell.start + cell.colSpan
      );
    }
  }

  const rows = placed.map((cells, rowIndex): GridRow => {
    const type = cells.every((cell) => cell.type === KEYS.th)
      ? KEYS.th
      : KEYS.td;
    const added: GridCell[] = [];
    for (let column = 0; column < width; column += 1) {
      if (!covered[rowIndex]?.[column]) {
        const next = cells.find((cell) => cell.start > column);
        const index = next ? next.index : (cells.at(-1)?.index ?? -1) + 1;
        added.push({
          cell: null,
          colSpan: 1,
          index,
          rowSpan: 1,
          start: column,
          type,
        });
      }
    }
    return {
      cells: [...cells, ...added].sort((a, b) => a.start - b.start),
      index: kept[rowIndex]?.index ?? rowIndex,
    };
  });
  return { rows, width };
}

/**
 * How many leading rows make the header: the longest run of rows whose cells
 * are all `th` that no cell's row span reaches past. A browser ends a row
 * span at the end of its row group, so a header that cut one would shift
 * the cells below it.
 */
export function headerRowCount(rows: GridRow[]): number {
  let leading = 0;
  while (rows[leading]?.cells.every((cell) => cell.type === KEYS.th)) {
    leading += 1;
  }
  const spansFit = (count: number): boolean =>
    rows
      .slice(0, count)
      .every((row, rowIndex) =>
        row.cells.every((cell) => rowIndex + cell.rowSpan <= count)
      );
  let count = leading;
  while (count > 0 && !spansFit(count)) {
    count -= 1;
  }
  return count;
}

/**
 * How many of `table`'s leading rows the page writes in its `<thead>`.
 * Shared with the canvas, which draws them there too, and the table bar.
 */
export const headerRows = (table: TElement): number =>
  headerRowCount(tableGrid(table).rows);
