import "server-only";

import { readSheet } from "read-excel-file/node";
import { cellToString } from "./cells";

export type ImportFileInput =
  | { kind: "xlsx"; data: ArrayBuffer }
  | { kind: "csv" | "paste"; text: string };

const BOM = "﻿";
const NEWLINE = /\r\n|\r|\n/;

function detectCsvDelimiter(text: string): ";" | "," {
  const firstLine = text.split(NEWLINE, 1)[0] ?? "";
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;
  for (const char of firstLine) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === ";") {
      semicolons += 1;
    } else if (!inQuotes && char === ",") {
      commas += 1;
    }
  }
  return semicolons > commas ? ";" : ",";
}

/** Reads a quoted field starting after its opening quote; returns the text and the index after the closing quote. */
function readQuoted(text: string, start: number): [string, number] {
  let value = "";
  let i = start;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char !== '"') {
      value += char;
      i += 1;
    } else if (text.charAt(i + 1) === '"') {
      value += '"';
      i += 2;
    } else {
      return [value, i + 1];
    }
  }
  return [value, i];
}

/** Delimited-text parser with quoted fields, escaped quotes and embedded newlines. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";

  const endField = () => {
    row.push(cellToString(field));
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char === '"') {
      const [quoted, next] = readQuoted(text, i + 1);
      field += quoted;
      i = next;
    } else if (char === delimiter) {
      endField();
      i += 1;
    } else if (char === "\n" || char === "\r") {
      i += char === "\r" && text.charAt(i + 1) === "\n" ? 2 : 1;
      endRow();
    } else {
      field += char;
      i += 1;
    }
  }
  if (field !== "" || row.length > 0) {
    endRow();
  }
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

/** Reads an uploaded or pasted spreadsheet into rows of trimmed strings. */
export async function parseImportFile(
  input: ImportFileInput
): Promise<string[][]> {
  if (input.kind === "xlsx") {
    const rows = await readSheet(input.data);
    return rows.map((row) => row.map(cellToString));
  }
  const text = input.text.startsWith(BOM) ? input.text.slice(1) : input.text;
  if (input.kind === "paste") {
    return parseDelimited(text, "\t");
  }
  return parseDelimited(text, detectCsvDelimiter(text));
}
