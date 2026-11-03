// Linear passes over a text block's HTML body, with no parser and no DOM:
// what the server's body sanitiser runs before it hands markup to
// sanitize-html (`sanitize-doc.ts`). Imports stay relative, as there.
//
// htmlparser2 (under sanitize-html) keeps its open elements in an array it
// `unshift`s, so a parse is quadratic in nesting depth. `scanBody` measures
// the depth of one strict grammar only, the one the editor writes, and does
// not try to read markup the way htmlparser2 does. On that grammar there is
// nothing for the two to read differently (no raw text, comments, other
// quotes or foreign content), and the end tags htmlparser2 implies only ever
// close elements, so its stack is never deeper than the one counted here.
// Everything else is bounded by the sanitiser's cap on tag starts.

import {
  BODY_ATTRIBUTES,
  BODY_TAGS,
  DROPPED_WITH_CONTENT,
  VOID_BODY_TAGS,
} from "../lib/rich-allowlist";

/**
 * `canonical`: the whole input is in the grammar and at most `maxDepth`
 * deep. `too-deep`: the whole input is in the grammar and deeper. `other`:
 * anything else, however deep.
 */
export type BodyScan = "canonical" | "too-deep" | "other";

const LT = 0x3c;
const GT = 0x3e;
const SLASH = 0x2f;
const SPACE = 0x20;
const EQUALS = 0x3d;
const QUOTE = 0x22;

const VOID: ReadonlySet<string> = new Set(VOID_BODY_TAGS);
const CONTAINERS: ReadonlySet<string> = new Set(
  BODY_TAGS.filter((tag) => !VOID.has(tag))
);
const ATTRIBUTES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries(BODY_ATTRIBUTES).map(([tag, names]) => [tag, new Set(names)])
);

/** Lower-case letters, digits and `-`: what a name in the grammar is made of. */
const isNameChar = (c: number): boolean =>
  (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c === 0x2d;

/** The index just past the name that starts at `from`. */
function nameEnd(html: string, from: number): number {
  let at = from;
  while (isNameChar(html.charCodeAt(at))) {
    at += 1;
  }
  return at;
}

/** The index of the quote that ends the value starting at `from`, or -1. */
function valueEnd(html: string, from: number): number {
  for (let at = from; at < html.length; at += 1) {
    const c = html.charCodeAt(at);
    if (c === QUOTE) {
      return at;
    }
    if (c === LT || c === GT) {
      return -1;
    }
  }
  return -1;
}

/** The index past the attributes from `from`, or -1 when one is not allowed. */
function attributesEnd(html: string, tag: string, from: number): number {
  const allowed = ATTRIBUTES.get(tag);
  let at = from;
  while (html.charCodeAt(at) === SPACE) {
    const name = nameEnd(html, at + 1);
    const opensValue =
      html.charCodeAt(name) === EQUALS && html.charCodeAt(name + 1) === QUOTE;
    if (!(opensValue && allowed?.has(html.slice(at + 1, name)))) {
      return -1;
    }
    const quote = valueEnd(html, name + 2);
    if (quote === -1) {
      return -1;
    }
    at = quote + 1;
  }
  return at;
}

/**
 * The index past the start tag at `lt`, or -1 when it is not in the
 * grammar. An element it opens goes on `open`.
 */
function pastStartTag(html: string, lt: number, open: string[]): number {
  const name = nameEnd(html, lt + 1);
  const tag = html.slice(lt + 1, name);
  if (VOID.has(tag)) {
    return html.charCodeAt(name) === GT ? name + 1 : -1;
  }
  if (!CONTAINERS.has(tag)) {
    return -1;
  }
  const end = attributesEnd(html, tag, name);
  if (end === -1 || html.charCodeAt(end) !== GT) {
    return -1;
  }
  open.push(tag);
  return end + 1;
}

/**
 * The index past the end tag at `lt`, or -1 unless it closes the innermost
 * element on `open`, which it takes off.
 */
function pastEndTag(html: string, lt: number, open: string[]): number {
  const tag = open.at(-1);
  if (tag === undefined || !html.startsWith(tag, lt + 2)) {
    return -1;
  }
  const end = lt + 2 + tag.length;
  if (html.charCodeAt(end) !== GT) {
    return -1;
  }
  open.pop();
  return end + 1;
}

/**
 * Whether `html` is in the grammar the editor writes, and how deep:
 *
 *     body  := ( text | open | void | close )*   nothing left open at the end
 *     text  := characters other than "<" and ">"
 *     open  := "<" TAG ( " " NAME '="' VALUE '"' )* ">"
 *              TAG a non-void body tag, NAME one of BODY_ATTRIBUTES[TAG]
 *     void  := "<" VOID_BODY_TAG ">"
 *     close := "</" TAG ">"   TAG the innermost open element
 *     VALUE := characters other than '"', "<" and ">"
 *
 * Names are lower case, with exactly one space before each attribute. One
 * pass with an explicit stack, linear in the input. It reads to the end
 * past a depth over `maxDepth`, since only a whole input in the grammar is
 * `too-deep`.
 */
export function scanBody(html: string, maxDepth: number): BodyScan {
  const open: string[] = [];
  let tooDeep = false;
  let at = 0;
  while (at < html.length) {
    const c = html.charCodeAt(at);
    if (c === GT) {
      return "other";
    }
    if (c === LT) {
      const ends = html.charCodeAt(at + 1) === SLASH;
      at = ends ? pastEndTag(html, at, open) : pastStartTag(html, at, open);
      if (at === -1) {
        return "other";
      }
      tooDeep ||= open.length > maxDepth;
    } else {
      at += 1;
    }
  }
  if (open.length > 0) {
    return "other";
  }
  return tooDeep ? "too-deep" : "canonical";
}

/** Tags a line of text ends at. */
const BLOCK_BREAKS: ReadonlySet<string> = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "br",
  "caption",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);

/**
 * The raw-text elements the sanitisers drop with their content: their text
 * goes up to their own end tag, which is found case-insensitively.
 */
const RAW_TEXT_ENDS: ReadonlyMap<string, RegExp> = new Map(
  [
    "iframe",
    "noembed",
    "noframes",
    "noscript",
    "script",
    "style",
    "textarea",
    "xmp",
  ]
    .filter((tag) => DROPPED_WITH_CONTENT.includes(tag))
    .map((tag) => [tag, new RegExp(`</${tag}`, "gi")])
);

/** A tag's name runs up to whitespace, `/` or `>`. */
const TAG_NAME = /[^\t\n\f\r />]*/y;
const LETTER = /[a-z]/i;

/** What a `<` starts: where it ends, and the tag it opens or closes, if any. */
interface Markup {
  end: number;
  opens: boolean;
  tag: string | null;
}

/** The index just past the next `>` from `from`, or the end. */
function past(html: string, from: number): number {
  const gt = html.indexOf(">", from);
  return gt === -1 ? html.length : gt + 1;
}

/** The markup at `lt`, or `null` when the `<` is text. */
function markupAt(html: string, lt: number): Markup | null {
  const next = html[lt + 1] ?? "";
  if (html.startsWith("<!--", lt)) {
    // From the dashes, so `<!-->` and `<!--->` close themselves.
    const close = html.indexOf("-->", lt + 2);
    return {
      end: close === -1 ? html.length : close + 3,
      opens: false,
      tag: null,
    };
  }
  const ends = next === "/";
  const nameStart = ends ? lt + 2 : lt + 1;
  if (LETTER.test(html[nameStart] ?? "")) {
    TAG_NAME.lastIndex = nameStart;
    const tag = (TAG_NAME.exec(html)?.[0] ?? "").toLowerCase();
    return { end: past(html, nameStart), opens: !ends, tag };
  }
  // `<!…>`, `<?…>`, and a `</` that names no tag, as a browser skips it.
  if (ends || next === "!" || next === "?") {
    return { end: past(html, lt + 2), opens: false, tag: null };
  }
  return null;
}

/**
 * Where the text that follows the start tag of `tag` ends: at its end tag
 * (or the end) for a raw-text element, at once for any other.
 */
function rawTextEnd(html: string, tag: string, from: number): number {
  const end = RAW_TEXT_ENDS.get(tag);
  if (!end) {
    return from;
  }
  end.lastIndex = from;
  return end.exec(html)?.index ?? html.length;
}

/**
 * The text of `html` as source-text lines, split where a block starts or
 * ends and trimmed; empty lines go. Lenient, linear, and safe whatever it
 * reads, since its caller escapes the lines. Tags go, up to the next `>` or
 * the end, and so do comments, declarations and processing instructions.
 * A raw-text element the sanitisers drop with its content (`<script>`,
 * `<style>`) goes up to its own end tag. A `<` that starts none of these is
 * text, and entities are left as written.
 */
export function textLines(html: string): string[] {
  const lines: string[] = [];
  let line = "";
  const endLine = (): void => {
    const text = line.trim();
    if (text !== "") {
      lines.push(text);
    }
    line = "";
  };
  let at = 0;
  for (let lt = html.indexOf("<"); lt !== -1; lt = html.indexOf("<", at)) {
    line += html.slice(at, lt);
    const markup = markupAt(html, lt);
    if (markup === null) {
      line += "<";
      at = lt + 1;
      continue;
    }
    if (markup.tag !== null && BLOCK_BREAKS.has(markup.tag)) {
      endLine();
    }
    at =
      markup.opens && markup.tag !== null
        ? rawTextEnd(html, markup.tag, markup.end)
        : markup.end;
  }
  line += html.slice(at);
  endLine();
  return lines;
}
