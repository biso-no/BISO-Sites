/**
 * Description text handling for the job detail page.
 *
 * Kept out of the page component so the pure logic is testable — importing the
 * component pulls in the application form and, through it, `server-only`.
 */
const WHITESPACE = /\s+/g;
const HTML_TAG = /<[^>]*>/g;
const JSON_TEXT_NODE = /"text":"((?:[^"\\]|\\.)*)"/g;
const ENTITY = /&(nbsp|amp|lt|gt|quot|#39);/g;
const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
};
const MIN_COMPARABLE = 24;

function decodeJsonNodes(description: string): string {
  const parts: string[] = [];
  for (const match of description.matchAll(JSON_TEXT_NODE)) {
    try {
      parts.push(JSON.parse(`"${match[1]}"`) as string);
    } catch {
      // A node we cannot decode just does not contribute to the comparison.
    }
  }
  return parts.join(" ");
}

/**
 * The readable text of a description, in order.
 *
 * Stored job descriptions are HTML (`<p>…</p><p>…</p>`). The block editor also
 * emits Plate JSON, and `PlateContentRenderer` accepts either, so both shapes
 * are handled here rather than assuming the one currently in the table.
 * Tags become spaces so paragraph boundaries read as word boundaries.
 */
export function plainText(description: string): string {
  const head = description.trimStart();
  const source =
    head.startsWith("[") || head.startsWith("{")
      ? decodeJsonNodes(description)
      : description.replace(HTML_TAG, " ");
  return source
    .replace(ENTITY, (_match, name: string) => ENTITIES[name] ?? " ")
    .replace(WHITESPACE, " ")
    .trim();
}

/**
 * `short_description` is often an auto-truncation of the description's opening
 * rather than a written summary — several stored vacancies end mid-word
 * ("…Engasjerte i BISO media e"). v1 renders it as the hero lede directly above
 * the same paragraph in full, so the reader meets a broken fragment and then
 * immediately re-reads it.
 *
 * When the description opens with the same text, the lede carries nothing the
 * next paragraph does not, and is dropped. The trailing word is ignored because
 * it is the one the truncation cut. Anything that cannot be matched is shown
 * unchanged, so a genuinely distinct summary always survives — and no copy is
 * invented either way.
 */
export function ledeFor(
  short: string | null | undefined,
  description: string
): string | undefined {
  const trimmed = short?.replace(WHITESPACE, " ").trim();
  if (!trimmed) {
    return undefined;
  }
  const lastSpace = trimmed.lastIndexOf(" ");
  const comparable = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
  if (comparable.length < MIN_COMPARABLE) {
    return trimmed;
  }
  return plainText(description).startsWith(comparable) ? undefined : trimmed;
}
