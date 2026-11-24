import { matchHeader } from "./field-aliases";

const MAX_HEADER_SCAN_ROWS = 10;
const MIN_ALIAS_MATCHES = 2;

function nonEmptyCount(row: string[]): number {
  return row.filter((cell) => cell.trim() !== "").length;
}

/**
 * Finds the header row: the first of the first 10 rows with at least two known
 * aliases, else the first row with at least two filled cells, else -1 when the
 * sheet has nothing usable.
 */
export function findHeaderRow(rows: string[][]): number {
  const scanned = rows.slice(0, MAX_HEADER_SCAN_ROWS);
  const byAlias = scanned.findIndex(
    (row) =>
      row.filter((cell) => matchHeader(cell) !== null).length >=
      MIN_ALIAS_MATCHES
  );
  if (byAlias !== -1) {
    return byAlias;
  }
  return rows.findIndex((row) => nonEmptyCount(row) >= MIN_ALIAS_MATCHES);
}
