import type { Segment } from "./response";

/** Control characters: cannot occur in page content, unlike "<em>". */
export const HIGHLIGHT_PRE = "\u0001";
export const HIGHLIGHT_POST = "\u0002";

/** Splits a Meilisearch formatted string into match / non-match segments. */
export function toSegments(formatted: string): Segment[] {
  const segments: Segment[] = [];
  let match = false;
  let buffer = "";

  const flush = () => {
    if (buffer === "") {
      return;
    }
    const last = segments.at(-1);
    if (last && last.match === match) {
      last.text += buffer;
    } else {
      segments.push({ text: buffer, match });
    }
    buffer = "";
  };

  for (const char of formatted) {
    if (char === HIGHLIGHT_PRE) {
      flush();
      match = true;
    } else if (char === HIGHLIGHT_POST) {
      flush();
      match = false;
    } else {
      buffer += char;
    }
  }
  flush();
  return segments;
}

export function hasMatch(segments: Segment[]): boolean {
  return segments.some((s) => s.match);
}
