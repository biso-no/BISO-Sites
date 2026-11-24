/**
 * Turns any spreadsheet cell value into a trimmed string. Numbers become plain
 * digits (never exponent notation) so phone numbers and references survive
 * Excel storing them as numbers.
 */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }
    return Number.isSafeInteger(value)
      ? String(value)
      : value.toLocaleString("fullwide", {
          useGrouping: false,
          maximumFractionDigits: 20,
        });
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}
