// Text the background check sends to the model or stores for approvers: on
// one line and capped, so it can't add lines of its own or overflow a column.

const WHITESPACE_RUN = /\s+/g;

/** One line, at most `max` characters, ending in an ellipsis when cut. */
export function oneLine(value: string | null | undefined, max: number): string {
  const text = (value ?? "").replace(WHITESPACE_RUN, " ").trim();
  const chars = Array.from(text);
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : text;
}
