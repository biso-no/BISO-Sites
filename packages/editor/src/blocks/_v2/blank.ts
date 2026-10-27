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

/**
 * On the site, drops items whose listed text fields are all blank. The editor
 * keeps every item so its placeholders stay editable.
 */
export function withoutBlankItems<T>(
  items: T[],
  fields: (item: T) => unknown[],
  edit: boolean
): T[] {
  return edit ? items : items.filter((item) => !fields(item).every(isBlank));
}
