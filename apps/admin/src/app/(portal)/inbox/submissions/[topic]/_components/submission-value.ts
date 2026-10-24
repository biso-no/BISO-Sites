/**
 * One stored answer as text for the inbox. Answers are not always strings:
 * a single checkbox is a boolean and a multi-choice field is a list.
 */
export function formatSubmissionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatSubmissionValue(item)).join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nei";
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}
