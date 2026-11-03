// Server-only. sanitize-html brings htmlparser2 and postcss with it, so this
// module is for route pages (server components) and server actions, never a
// client module (`sanitize-doc-boundary.test.ts` enforces that). Imports stay
// relative: apps resolve this file through the package export, where the
// editor's `@/` alias does not exist.
import "server-only";
import sanitizeHtml, {
  type Attributes,
  type IOptions,
  type Transformer,
} from "sanitize-html";
import { safeHref } from "../blocks/_v2/links";
import {
  BODY_TAGS,
  DROPPED_WITH_CONTENT,
  INLINE_TAGS,
  keptOlStart,
  SAFE_HREF,
} from "../lib/rich-allowlist";
import { nestsDeeperThan, textLines } from "./nesting-scan";

/**
 * The tags a legacy text item (`body[].text`) may hold: `lib/sanitize.ts`'s
 * inline allowlist, which the editor applies in the browser on blur.
 * Everything else is unwrapped, its text kept. A string body uses
 * `BODY_TAGS` (see `BODY_OPTIONS`).
 */
const ALLOWED_TAGS = INLINE_TAGS;

/** Browsers wrap each new line typed with Enter in one of these. */
const LINE_BLOCK_TAGS = new Set(["div", "p"]);

/**
 * The same rule every v2 link follows. A safe value is kept as written, as
 * the browser sanitizer keeps it; an unsafe one leaves a bare `<a>`.
 */
const keepSafeHref: Transformer = (tagName, { href }) => {
  const attribs: Attributes = {};
  if (href !== undefined && safeHref(href) !== null) {
    attribs.href = href;
  }
  return { attribs, tagName };
};

/**
 * The body path's link rule: the browser sanitiser's `SAFE_HREF`, verbatim,
 * so a link the editor shows keeps its href on save and the reverse.
 */
const keepBodyHref: Transformer = (tagName, { href }) => {
  const attribs: Attributes = {};
  if (href !== undefined && SAFE_HREF.test(href.trim())) {
    attribs.href = href;
  }
  return { attribs, tagName };
};

/** `ol[start]` kept only when valid and at least 2, as the browser sanitiser does. */
const keepOlStart: Transformer = (tagName, { start }) => {
  const attribs: Attributes = {};
  const kept = start === undefined ? null : keptOlStart(start);
  if (kept !== null) {
    attribs.start = kept;
  }
  return { attribs, tagName };
};

const BODY_OPTIONS: IOptions = {
  allowedAttributes: { a: ["href"], ol: ["start"] },
  allowedTags: [...BODY_TAGS],
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {},
  allowProtocolRelative: true,
  disallowedTagsMode: "discard",
  nestingLimit: 100,
  nonTextTags: [...DROPPED_WITH_CONTENT],
  transformTags: { a: keepBodyHref, ol: keepOlStart },
};

const OPTIONS: IOptions = {
  allowedAttributes: { a: ["href"] },
  // div and p survive this pass only so `breakLines` can see where each line
  // starts; it removes every one of them.
  allowedTags: [...ALLOWED_TAGS, ...LINE_BLOCK_TAGS],
  // A second line of defence behind `safeHref` below.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {},
  allowProtocolRelative: true,
  disallowedTagsMode: "discard",
  // Deeper tags are discarded, their text kept. Bounds the work and the
  // output for a document built to be deep.
  nestingLimit: 100,
  nonTextTags: [...DROPPED_WITH_CONTENT],
  transformTags: { a: keepSafeHref },
};

/**
 * The output of the pass above has a closed grammar: a `<` only ever opens a
 * tag that pass wrote (text and attribute values have theirs escaped) and an
 * attribute value cannot hold a `>`. A token pattern is exact on it, and this
 * runs on nothing else.
 */
const TOKEN = /<(\/?)([a-z0-9]+)[^>]*>|[^<]+/g;

/**
 * Unwraps every div and p, writing a `<br>` before one that follows anything
 * kept inside the same parent: the browser sanitizer's `previousSibling`
 * rule, so "one<div>two</div>" becomes "one<br>two" and a lone "<div>x</div>"
 * just "x". (A line block inside an unwrapped tag, "a<u><div>b</div></u>",
 * gets a break here and none in the browser, since the first pass has
 * already flattened the `<u>`; the editor never writes that shape.)
 *
 * Each open element records whether anything kept has been written inside
 * it yet. A write marks only the innermost element; an unwrapped line block
 * passes its mark to its parent as it closes, and a kept tag marks its
 * parent as it opens. A parent's mark is only read once its open child has
 * closed, so the walk stays linear however deep the markup.
 */
function breakLines(html: string): string {
  const walk: LineWalk = { out: "", wroteInside: [false] };
  for (const [token, closing, tag] of html.matchAll(TOKEN)) {
    if (tag === undefined) {
      write(walk, token);
    } else if (tag === "br") {
      // Written as a browser serializes it, not sanitize-html's "<br />".
      write(walk, "<br>");
    } else if (closing) {
      closeTag(walk, tag, token);
    } else {
      openTag(walk, tag, token);
    }
  }
  return walk.out;
}

interface LineWalk {
  out: string;
  /** One entry per open element, innermost last; the root first. */
  wroteInside: boolean[];
}

/** Marks the innermost open element as holding something kept. */
function mark(walk: LineWalk): void {
  walk.wroteInside[walk.wroteInside.length - 1] = true;
}

function write(walk: LineWalk, markup: string): void {
  walk.out += markup;
  mark(walk);
}

function openTag(walk: LineWalk, tag: string, token: string): void {
  if (!LINE_BLOCK_TAGS.has(tag)) {
    write(walk, token);
  } else if (walk.wroteInside.at(-1)) {
    write(walk, "<br>");
  }
  walk.wroteInside.push(false);
}

function closeTag(walk: LineWalk, tag: string, token: string): void {
  const childWrote = walk.wroteInside.length > 1 && walk.wroteInside.pop();
  if (!LINE_BLOCK_TAGS.has(tag)) {
    walk.out += token;
  } else if (childWrote) {
    // An unwrapped line block's content now sits in its parent.
    mark(walk);
  }
}

/** A no-break space, which a browser serializes as `&nbsp;`. */
const NBSP = "\u00a0";

/**
 * htmlparser2 keeps its open elements in an array it `unshift`s, so a parse
 * is quadratic in nesting depth, and `nestingLimit` only applies after it:
 * 80,000 nested tags took 1.4 s under Node and 0.4 s under Bun. Every tag
 * starts with a `<`, so counting them bounds the depth; at this many a parse
 * still takes a few milliseconds, and no legacy text item comes near it.
 */
const MAX_TAG_STARTS = 10_000;

/**
 * How deep a body may nest before it is kept as text (`nesting-scan.ts`
 * measures it without a parse). No body the editor writes comes near.
 */
const MAX_BODY_DEPTH = 100;

/**
 * A backstop behind the depth scan, should markup ever read shallower to it
 * than to htmlparser2: past this many tags a body is kept as text too. That
 * is some 8,000 short paragraphs; a parse that deep takes a third of a
 * second under Node.
 */
const MAX_BODY_TAG_STARTS = 50_000;

function hasMoreTagsThan(html: string, limit: number): boolean {
  let count = 0;
  for (let at = html.indexOf("<"); at !== -1; at = html.indexOf("<", at + 1)) {
    count += 1;
    if (count > limit) {
      return true;
    }
  }
  return false;
}

/** The input as text: inert, and showing its source to whoever fixes it. */
function escapeText(html: string): string {
  return html
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(NBSP, "&nbsp;");
}

/**
 * Text-block HTML reduced to the editor's allowlist, without a DOM: the
 * server-side twin of `lib/sanitize.ts`. Allowed tags keep only `href` on
 * `a`, and only when `safeHref` accepts it. Other tags are unwrapped, their
 * text kept, except the elements in `DROPPED_WITH_CONTENT`, which go with
 * everything inside them. Lines typed with Enter become `<br>`s. The output
 * is serialized as a browser would, so the editor's blur leaves it unchanged.
 * Markup with more than `MAX_TAG_STARTS` tags is not parsed at all: it comes
 * back as escaped text.
 */
export function sanitizeRichHtml(html: string): string {
  if (hasMoreTagsThan(html, MAX_TAG_STARTS)) {
    return escapeText(html);
  }
  return breakLines(sanitizeHtml(html, OPTIONS)).replaceAll(NBSP, "&nbsp;");
}

/**
 * A text block's HTML body reduced to `BODY_TAGS`: the server-side twin of
 * `sanitizeRichBody` in `lib/sanitize.ts`. Void tags are written as a browser
 * serializes them.
 *
 * A body nested more than `MAX_BODY_DEPTH` deep, or with more than
 * `MAX_BODY_TAG_STARTS` tags, is never parsed: it keeps its text, one
 * paragraph per line, and loses its formatting. The browser sanitiser has no
 * such limit, since a DOM parses deep markup in linear time; what is stored
 * is this function's output, so this is the rule that counts.
 */
export function sanitizeRichBodyHtml(html: string): string {
  const unsafeToParse =
    hasMoreTagsThan(html, MAX_BODY_TAG_STARTS) ||
    nestsDeeperThan(html, MAX_BODY_DEPTH);
  return sanitizeBody(unsafeToParse ? asTextParagraphs(html) : html);
}

function sanitizeBody(html: string): string {
  return sanitizeHtml(html, BODY_OPTIONS)
    .replaceAll("<br />", "<br>")
    .replaceAll("<hr />", "<hr>")
    .replaceAll(NBSP, "&nbsp;");
}

/**
 * The body's text as flat `<p>`s, every `<` in it escaped, so the parse that
 * follows sees one level and settles its entities.
 */
function asTextParagraphs(html: string): string {
  return textLines(html)
    .map(
      (line) => `<p>${line.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`
    )
    .join("");
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function sanitizeBodyItem(item: unknown): unknown {
  if (!isRecord(item)) {
    return item;
  }
  // The renderer hands `text` to `__html`, which stringifies whatever it
  // gets: an array holding a string would reach the page as raw markup.
  return {
    ...item,
    text: typeof item.text === "string" ? sanitizeRichHtml(item.text) : "",
  };
}

function sanitizeBlock(block: unknown): unknown {
  if (!(isRecord(block) && block.type === "text")) {
    return block;
  }
  if (typeof block.body === "string") {
    return { ...block, body: sanitizeRichBodyHtml(block.body) };
  }
  if (!Array.isArray(block.body)) {
    return block;
  }
  return { ...block, body: block.body.map(sanitizeBodyItem) };
}

function sanitizeColumn(column: unknown): unknown {
  if (!(isRecord(column) && Array.isArray(column.blocks))) {
    return column;
  }
  return { ...column, blocks: column.blocks.map(sanitizeBlock) };
}

function sanitizeSection(section: unknown): unknown {
  if (!(isRecord(section) && Array.isArray(section.columns))) {
    return section;
  }
  return { ...section, columns: section.columns.map(sanitizeColumn) };
}

/**
 * A copy of the document with every text block's `body[].text` run through
 * `sanitizeRichHtml`, wherever it sits in `sections`. Only text blocks hold
 * HTML; the header and every other prop are plain text, rendered escaped.
 * Pure: the input is never mutated, and everything that needs no change
 * (other blocks, the header, meta, layouts) is shared with it, not cloned.
 *
 * Stored documents are untrusted, so the walk tolerates any shape: what is
 * not a list or an object where one is expected is passed through for
 * `normalizePageDoc` and the renderer to drop. Generic so both the editor's
 * `PageDoc` and `@repo/api/page-builder`'s looser one pass through typed.
 */
export function sanitizePageDocHtml<T extends { sections?: unknown }>(
  doc: T
): T {
  const { sections } = doc;
  if (!Array.isArray(sections)) {
    return { ...doc };
  }
  return { ...doc, sections: sections.map(sanitizeSection) };
}
