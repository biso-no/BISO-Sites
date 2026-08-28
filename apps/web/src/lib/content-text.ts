/**
 * Plain-text readers for editor-authored copy.
 *
 * Body fields arrive in three shapes depending on where the row came from:
 * raw HTML (legacy/imported content), Plate JSON (the block editor), or plain
 * prose. Anything rendered as text — hero teasers, cards, metadata — has to
 * flatten all three, which means stripping tags *and* decoding the character
 * references an HTML body legitimately contains (`&#039;` → `'`).
 */

const HTML_TAG = /<[^>]+>/g;
const COLLAPSE_WHITESPACE = /\s+/g;
const NUMERIC_ENTITY = /&#(x[\da-f]+|\d+);/gi;
const NAMED_ENTITY = /&([a-z]+\d?);/gi;
// A sentence ends on terminal punctuation followed by whitespace or the string
// end — optionally through a closing quote/bracket ("…done." said X).
const SENTENCE_END = /[.!?…]["'”’)\]]?(?=\s|$)/g;
// Below this, a "sentence" is far more likely an abbreviation or an initial.
const MIN_SENTENCE_LENGTH = 24;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  laquo: "«",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
  rdquo: "”",
  rsquo: "’",
};

/** Resolves the character references an HTML body may carry. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(NUMERIC_ENTITY, (match, code: string) => {
      const codePoint = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0) {
        return match;
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        // Out of Unicode range — leave the reference untouched.
        return match;
      }
    })
    .replace(
      NAMED_ENTITY,
      (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match
    );
}

function collectPlateText(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectPlateText(child, out);
    }
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.text === "string") {
    out.push(record.text);
  }
  if (Array.isArray(record.children)) {
    collectPlateText(record.children, out);
  }
}

/** Flattens any storage format (HTML, Plate JSON, prose) to plain text. */
export function toPlainText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parts: string[] = [];
      collectPlateText(JSON.parse(trimmed), parts);
      // Plate text nodes are already decoded — running the entity pass here
      // would eat a literal "&amp;" an editor actually typed.
      return parts.join(" ").replace(COLLAPSE_WHITESPACE, " ").trim();
    } catch {
      // Malformed JSON — fall through and treat it as text.
    }
  }

  // Tags become a space, not nothing: "…run it.</p><p>BISO…" must not collapse
  // into "run it.BISO".
  return decodeHtmlEntities(trimmed.replace(HTML_TAG, " "))
    .replace(COLLAPSE_WHITESPACE, " ")
    .trim();
}

/** Cuts to `maxLength` on a word boundary, appending an ellipsis. */
export function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Cuts to whole sentences within `maxLength`. A complete sentence always beats
 * a mid-word chop, so the only fallback to word-boundary truncation is when no
 * usable boundary exists — either the opening sentence overflows the budget, or
 * the one boundary found is short enough to be an abbreviation ("Dr.") rather
 * than a sentence.
 */
export function toSentenceExcerpt(
  text: string,
  maxLength: number,
  minLength = MIN_SENTENCE_LENGTH
): string {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }

  let boundary = 0;
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = (match.index ?? 0) + match[0].length;
    if (end > maxLength) {
      break;
    }
    boundary = end;
  }

  if (boundary >= minLength) {
    return text.slice(0, boundary).trim();
  }
  return truncateAtWord(text, maxLength);
}

/**
 * The one-line teaser shown alongside a title in cards and the hero.
 *
 * Events and jobs carry an editor-written teaser (`short_description`); news
 * has no teaser field, so the opening of the body stands in — cut to whole
 * sentences so it reads as a lead rather than a severed paragraph.
 */
export function buildTeaser(
  shortDescription: string | null | undefined,
  body: string | null | undefined,
  maxLength: number
): string {
  const authored = toPlainText(shortDescription);
  if (authored) {
    return truncateAtWord(authored, maxLength);
  }
  return toSentenceExcerpt(toPlainText(body), maxLength);
}
