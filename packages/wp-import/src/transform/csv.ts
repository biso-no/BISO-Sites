const NEEDS_QUOTING = /[",\n]/;

function splitRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (inQuotes) {
      if (char === '"') {
        if (row[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields;
}

/** Split on newlines that are not inside a quoted field. */
function splitRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === "\n" && !inQuotes) {
      rows.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    rows.push(current);
  }

  return rows.map((row) => row.replace(/\r$/, "")).filter((row) => row !== "");
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = splitRows(text);
  const header = rows.shift();
  if (!header) {
    return [];
  }
  const columns = splitRow(header);

  return rows.map((row) => {
    const values = splitRow(row);
    const record: Record<string, string> = {};
    for (const [index, column] of columns.entries()) {
      record[column] = values[index] ?? "";
    }
    return record;
  });
}

function escapeField(value: string): string {
  return NEEDS_QUOTING.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function toCsv(
  rows: Array<Record<string, string>>,
  columns: string[]
): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeField(row[c] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}
