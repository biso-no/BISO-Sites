const TAG = /<[^>]*>/g;
const NBSP = /&nbsp;/g;

/** True when a stored value shows nothing: not a string, or only whitespace. */
export function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/** True when rich text has no visible text once its tags are stripped. */
export function isBlankHtml(value: unknown): boolean {
  return (
    typeof value !== "string" ||
    value.replace(TAG, "").replace(NBSP, " ").trim() === ""
  );
}
