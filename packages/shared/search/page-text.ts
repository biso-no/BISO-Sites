import { toPlainText, truncateAtWord } from "../utils/content-text";

const DEFAULT_MAX_LENGTH = 4000;

const TEXT_KEYS = new Set([
  "title",
  "heading",
  "eyebrow",
  "lede",
  "label",
  "text",
  "body",
  "caption",
  "name",
  "role",
  "intro",
  "description",
  "topic",
  "q",
  "a",
  "question",
  "answer",
  "quote",
]);

function collect(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      collect(item, out);
    }
    return;
  }
  if (node === null || typeof node !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      if (TEXT_KEYS.has(key)) {
        out.push(value);
      }
    } else {
      collect(value, out);
    }
  }
}

/**
 * Plain searchable text from a block-editor page document. Kept free of
 * `@repo/editor` types (that package depends on this one), so it walks the
 * parsed JSON and reads only well-known text keys.
 */
export function pageDocText(
  doc: unknown,
  maxLength = DEFAULT_MAX_LENGTH
): string {
  const raw: string[] = [];
  collect(doc, raw);
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const value of raw) {
    const text = toPlainText(value);
    if (text && !seen.has(text)) {
      seen.add(text);
      parts.push(text);
    }
  }
  return truncateAtWord(parts.join(" "), maxLength);
}
