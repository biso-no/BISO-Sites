import type { ColumnToSuggest } from "./ai-mapping.server";
import { type ImportField, matchHeaders } from "./field-aliases";
import { findHeaderRow } from "./header-row";
import { parseCampus, parseRoomSize } from "./normalize";
import { describeValueShape } from "./value-shape";

/** What the wizard's "Check the columns" step shows. */
export interface ImportColumns {
  detected: {
    campus: boolean;
    group: boolean;
    roomSizes: boolean;
  };
  /** Row index of the header row (0-based); -1 when the file has no rows. */
  headerRow: number;
  headers: string[];
  /** One field per column; columns nobody recognised are "ignore". */
  mapping: ImportField[];
  /** Number of filled rows below the header. */
  rowCount: number;
  /** The first rows below the header, for the admin's eyes only. */
  sample: string[][];
}

/** Columns read from the file, before the AI has had a say. */
export interface DetectedColumns {
  columns: ImportColumns;
  /** The header row was found by known column names (ruling R12). */
  foundByAliases: boolean;
  /** Indexes of columns the known names didn't recognise. */
  unknown: number[];
}

const SAMPLE_ROWS = 5;
const MIN_ALIAS_MATCHES = 2;
const MIN_DIGITS_THAT_LOOK_LIKE_DATA = 5;
const DIGIT = /\d/g;

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/** The filled rows below the header. */
export function dataRowsBelow(rows: string[][], headerRow: number): string[][] {
  return headerRow < 0
    ? []
    : rows.slice(headerRow + 1).filter((row) => !isBlankRow(row));
}

function columnValues(rows: string[][], index: number): string[] {
  return rows.map((row) => row[index]?.trim() ?? "");
}

function valuesOf(
  rows: string[][],
  mapping: ImportField[],
  field: ImportField
): string[] {
  return mapping.flatMap((mapped, index) =>
    mapped === field ? columnValues(rows, index) : []
  );
}

/** What the mapped columns hold, for the options the wizard offers. */
export function detectContents(
  rows: string[][],
  mapping: ImportField[]
): ImportColumns["detected"] {
  const categories = valuesOf(rows, mapping, "ticket_category");
  const campuses = [...valuesOf(rows, mapping, "campus"), ...categories];
  return {
    campus: campuses.some((value) => parseCampus(value) !== null),
    group: mapping.includes("group"),
    roomSizes: categories.some((value) => parseRoomSize(value) !== null),
  };
}

/** Finds the header row and maps every column the known names recognise. */
export function detectColumns(rows: string[][]): DetectedColumns {
  const headerRow = findHeaderRow(rows);
  if (headerRow === -1) {
    return {
      columns: {
        detected: { campus: false, group: false, roomSizes: false },
        headerRow,
        headers: [],
        mapping: [],
        rowCount: 0,
        sample: [],
      },
      foundByAliases: false,
      unknown: [],
    };
  }
  const data = dataRowsBelow(rows, headerRow);
  const width = Math.max(
    rows[headerRow]?.length ?? 0,
    ...data.map((row) => row.length)
  );
  const headers = Array.from(
    { length: width },
    (_, index) => rows[headerRow]?.[index]?.trim() ?? ""
  );
  const matched = matchHeaders(headers);
  const mapping = matched.map((field) => field ?? "ignore");
  return {
    columns: {
      detected: detectContents(data, mapping),
      headerRow,
      headers,
      mapping,
      rowCount: data.length,
      sample: data
        .slice(0, SAMPLE_ROWS)
        .map((row) => headers.map((_, index) => row[index]?.trim() ?? "")),
    },
    foundByAliases:
      matched.filter((field) => field !== null).length >= MIN_ALIAS_MATCHES,
    unknown: matched.flatMap((field, index) => (field === null ? [index] : [])),
  };
}

/** A header that may hold someone's email or phone instead of a column name. */
function looksLikeData(header: string): boolean {
  return (
    header.includes("@") ||
    (header.match(DIGIT)?.length ?? 0) >= MIN_DIGITS_THAT_LOOK_LIKE_DATA
  );
}

/**
 * What may go to the AI model (ruling R12): header names and value shapes of
 * the unrecognised columns, and only when the header row was found by known
 * column names. Otherwise the "header" may be a row of someone's details.
 */
export function columnsForAi(
  rows: string[][],
  detected: DetectedColumns
): ColumnToSuggest[] {
  const { columns } = detected;
  if (!detected.foundByAliases) {
    return [];
  }
  const data = dataRowsBelow(rows, columns.headerRow);
  return detected.unknown.flatMap((index) => {
    const header = columns.headers[index] ?? "";
    if (header === "" || looksLikeData(header)) {
      return [];
    }
    return [
      { header, index, shape: describeValueShape(columnValues(data, index)) },
    ];
  });
}

/** Fills unrecognised columns with the AI's guesses; "ignore" is no guess. */
export function withAiSuggestions(
  rows: string[][],
  detected: DetectedColumns,
  suggestions: Record<number, ImportField>
): ImportColumns {
  const unknown = new Set(detected.unknown);
  const mapping = detected.columns.mapping.map((field, index) => {
    const suggestion = suggestions[index];
    return unknown.has(index) && suggestion && suggestion !== "ignore"
      ? suggestion
      : field;
  });
  return {
    ...detected.columns,
    detected: detectContents(
      dataRowsBelow(rows, detected.columns.headerRow),
      mapping
    ),
    mapping,
  };
}
