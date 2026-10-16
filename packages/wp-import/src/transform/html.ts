/**
 * Produces exactly the HTML that `descriptionBlocksToHtml()` in
 * apps/admin/src/app/(portal)/_components/description-blocks.ts emits, so that
 * imported descriptions round-trip cleanly through `htmlToDescriptionBlocks()`.
 * That parser only recognises top-level <figure>, <h1-6>, <p> and <li>; anything
 * else is silently dropped, which is why unsupported containers are rescued into
 * paragraphs here rather than passed through.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  lt: "<",
  laquo: "«",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  raquo: "»",
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const BLOCK_PATTERN =
  /<(h[1-6]|p|li|div|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const TAG_PATTERN = /<[^>]*>/g;
const WHITESPACE_PATTERN = /\s+/g;
const PARAGRAPH_SPLIT_PATTERN = /\n\s*\n/;

export function decodeEntities(value: string): string {
  return value.replace(ENTITY_PATTERN, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toPlainText(value: string): string {
  return decodeEntities(value.replace(TAG_PATTERN, " "))
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

interface Block {
  tag: "h" | "l" | "p";
  text: string;
}

function blockTag(rawTag: string): "h" | "l" | "p" {
  const lower = rawTag.toLowerCase();
  if (lower.startsWith("h")) {
    return "h";
  }
  return lower === "li" ? "l" : "p";
}

function parseBlocks(rawHtml: string): Block[] {
  const blocks: Block[] = [];

  // matchAll() is required here rather than a BLOCK_PATTERN.exec() loop: this
  // function recurses, and a shared module-level regex with the /g flag would
  // have its lastIndex reset by the inner call, making the outer loop re-match
  // the same block forever. matchAll clones the regex internally, so each
  // recursion level iterates independently and lastIndex is never mutated.
  for (const match of rawHtml.matchAll(BLOCK_PATTERN)) {
    const [, rawTag, inner] = match;
    // A container may itself hold block children (e.g. <div><p>x</p></div>).
    // Recurse so the inner blocks keep their own semantics.
    const nested = parseBlocks(inner ?? "");
    if (nested.length > 0) {
      blocks.push(...nested);
    } else {
      const text = toPlainText(inner ?? "");
      if (text) {
        blocks.push({ tag: blockTag(rawTag ?? "p"), text });
      }
    }
  }

  return blocks;
}

function serialize(blocks: Block[]): string {
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      parts.push(`<ul>${listItems.join("")}</ul>`);
      listItems = [];
    }
  };

  for (const block of blocks) {
    const text = escapeHtml(block.text.trim());
    if (!text) {
      continue;
    }
    if (block.tag === "l") {
      listItems.push(`<li>${text}</li>`);
      continue;
    }
    flushList();
    parts.push(block.tag === "h" ? `<h3>${text}</h3>` : `<p>${text}</p>`);
  }

  flushList();
  return parts.join("");
}

/** Truncate on a block boundary so output is never malformed HTML. */
function truncateBlocks(
  blocks: Block[],
  maxLength: number
): { blocks: Block[]; truncated: boolean } {
  const kept: Block[] = [];
  for (const block of blocks) {
    const candidate = [...kept, block];
    if (serialize(candidate).length > maxLength) {
      return { blocks: kept, truncated: true };
    }
    kept.push(block);
  }
  return { blocks: kept, truncated: false };
}

export function normalizeDescriptionHtml(
  rawHtml: string,
  maxLength = 8000
): { html: string; truncated: boolean } {
  let blocks = parseBlocks(rawHtml);

  if (blocks.length === 0) {
    // Plain-text source (the /custom/v1/jobs `content` field is plain text with
    // blank-line paragraph breaks).
    const text = decodeEntities(rawHtml.replace(TAG_PATTERN, " "));
    blocks = text
      .split(PARAGRAPH_SPLIT_PATTERN)
      .map((part) => part.replace(WHITESPACE_PATTERN, " ").trim())
      .filter((part) => part.length > 0)
      .map((part) => ({ tag: "p" as const, text: part }));
  }

  const limited = truncateBlocks(blocks, maxLength);
  const html = serialize(limited.blocks);

  return {
    html: html || "<p></p>",
    truncated: limited.truncated,
  };
}

export function plainTextExcerpt(rawHtml: string, maxLength: number): string {
  const text = toPlainText(rawHtml);
  if (text.length <= maxLength) {
    return text;
  }
  const clipped = text.slice(0, maxLength - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}
