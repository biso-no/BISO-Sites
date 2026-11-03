// One linear pass over HTML source, with no parser and no DOM: what the
// server's body sanitiser runs before it hands markup to sanitize-html
// (`sanitize-doc.ts`). Imports stay relative, as there.
//
// htmlparser2 (under sanitize-html) keeps its open elements in an array it
// `unshift`s, so a parse is quadratic in nesting depth: under Node 50,000
// nested tags take a third of a second and 100,000 about four. This scan
// finds the depth first. It reads markup the way htmlparser2 12 does where
// a difference could hide a tag from it or show it one that is not there:
// comments, declarations, quoted attribute values, raw-text elements
// (`<script>`, `<style>`, …) outside SVG and MathML, and self-closing tags
// inside them. An end tag closes the innermost open element of its name, and
// a stray one closes nothing. The implied end tags it knows (`<li>` after
// `<li>`, a block after `<p>`) are htmlparser2's; the ones it leaves out
// make it count deeper. It skips htmlparser2's SVG tag-name casing, so
// contrived SVG could still read shallower here; the sanitiser's tag-count
// backstop bounds that case.

import { DROPPED_WITH_CONTENT } from "../lib/rich-allowlist";

/** htmlparser2's void elements, which never open. */
const VOID_TAGS: ReadonlySet<string> = new Set([
  "area",
  "base",
  "basefont",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "img",
  "input",
  "isindex",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Elements whose content is text up to their end tag, outside SVG/MathML. */
const RAW_TEXT_END: ReadonlyMap<string, RegExp> = new Map(
  [
    "iframe",
    "noembed",
    "noframes",
    "script",
    "style",
    "textarea",
    "title",
    "xmp",
  ].map((tag) => [tag, new RegExp(`</${tag}[\\t\\n\\f\\r />]`, "gi")])
);
/** Everything after it is text. */
const PLAINTEXT = "plaintext";

const P_ONLY: ReadonlySet<string> = new Set(["p"]);
const HEADINGS_AND_P: ReadonlySet<string> = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
]);
const DD_DT: ReadonlySet<string> = new Set(["dd", "dt"]);

/** Part of htmlparser2's `openImpliesClose`: what an open tag closes first. */
const IMPLIES_CLOSE: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["a", new Set(["a"])],
  ["dd", DD_DT],
  ["dt", DD_DT],
  ["li", new Set(["li"])],
  ["option", new Set(["option"])],
  ["optgroup", new Set(["optgroup", "option"])],
  ["tbody", new Set(["thead", "tbody"])],
  ["td", new Set(["thead", "th", "td"])],
  ["tfoot", new Set(["thead", "tbody"])],
  ["th", new Set(["th"])],
  ["tr", new Set(["tr", "th", "td"])],
  ...["h1", "h2", "h3", "h4", "h5", "h6"].map(
    (tag) => [tag, HEADINGS_AND_P] as const
  ),
  ...[
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",
  ].map((tag) => [tag, P_ONLY] as const),
]);

/** Elements inside SVG or MathML that hold HTML again. */
const HTML_INTEGRATION: ReadonlySet<string> = new Set([
  "annotation-xml",
  "desc",
  "mi",
  "mn",
  "mo",
  "ms",
  "mtext",
  "title",
]);

type Context = "html" | "math" | "svg";

const WHITESPACE = new Set([" ", "\n", "\t", "\f", "\r"]);
const LETTER = /^[a-z]$/i;
const COMMENT_END = /--!?>/g;

const endsTagName = (c: string): boolean =>
  c === "/" || c === ">" || WHITESPACE.has(c);

interface MarkupVisitor {
  close(name: string): void;
  /** Whether the open element is in SVG or MathML, where `<style>` holds tags. */
  context(): Context;
  /** `false` stops the scan. */
  open(name: string, selfClosing: boolean): boolean;
  /** Source text from `start` to `end`; `rawTextOf` names its raw-text element. */
  text(start: number, end: number, rawTextOf?: string): void;
}

/** The tag name as htmlparser2 reads it: lower case, and `image` is `img` in HTML. */
const tagName = (raw: string, context: Context): string => {
  const name = raw.toLowerCase();
  return name === "image" && context === "html" ? "img" : name;
};

/** The index just past `char` from `from`, or the end. */
function past(html: string, char: string, from: number): number {
  const at = html.indexOf(char, from);
  return at === -1 ? html.length : at + 1;
}

/** The index past a `<!…>`: a comment, CDATA, a doctype or a bogus comment. */
function pastDeclaration(html: string, lt: number): number {
  if (html.startsWith("<!--", lt)) {
    const body = lt + 4;
    // `<!-->` and `<!--->` are closed, empty comments.
    if (html[body] === ">") {
      return body + 1;
    }
    if (html.startsWith("->", body)) {
      return body + 2;
    }
    COMMENT_END.lastIndex = body;
    const end = COMMENT_END.exec(html);
    return end ? end.index + end[0].length : html.length;
  }
  if (html.startsWith("<![CDATA[", lt)) {
    const end = html.indexOf("]]>", lt + 9);
    return end === -1 ? html.length : end + 3;
  }
  return past(html, ">", lt + 2);
}

type AttributeState =
  | "afterName"
  | "beforeName"
  | "beforeValue"
  | "name"
  | "selfClosing"
  | "unquoted";
type AttributeStep = AttributeState | "end" | "endSelfClosing";

/**
 * htmlparser2's attribute states one for one: each gives the state after
 * `c`, `end` once `>` closes the tag. A quoted value is skipped by the
 * caller, so a `>` or `<` inside one is never read here.
 */
const ATTRIBUTE_STATES: Record<
  AttributeState,
  (c: string, space: boolean) => AttributeStep
> = {
  afterName: (c, space) => {
    if (c === "=") {
      return "beforeValue";
    }
    if (c === "/" || c === ">") {
      return step("beforeName", c);
    }
    return space ? "afterName" : "name";
  },
  beforeName: (c, space) => {
    if (c === ">") {
      return "end";
    }
    if (c === "/") {
      return "selfClosing";
    }
    return space ? "beforeName" : "name";
  },
  beforeValue: (c, space) => (space ? "beforeValue" : step("unquoted", c)),
  name: (c) => {
    if (c === "=") {
      return "beforeValue";
    }
    return endsTagName(c) ? step("afterName", c) : "name";
  },
  selfClosing: (c, space) => {
    if (c === ">") {
      return "endSelfClosing";
    }
    return space ? "selfClosing" : step("beforeName", c);
  },
  // Only whitespace or `>` ends an unquoted value; a `/` is part of it.
  unquoted: (c, space) =>
    space || c === ">" ? step("beforeName", c) : "unquoted",
};

function step(state: AttributeState, c: string): AttributeStep {
  return ATTRIBUTE_STATES[state](c, WHITESPACE.has(c));
}

/** An open tag from its name's first letter, or `null` when it never ends. */
function readOpenTag(
  html: string,
  from: number
): { end: number; name: string; selfClosing: boolean } | null {
  let at = from;
  while (at < html.length && !endsTagName(html[at] ?? "")) {
    at += 1;
  }
  const name = html.slice(from, at);
  let state: AttributeState = "beforeName";
  while (at < html.length) {
    const c = html[at] ?? "";
    if (state === "beforeValue" && (c === '"' || c === "'")) {
      const close = html.indexOf(c, at + 1);
      if (close === -1) {
        return null;
      }
      state = "beforeName";
      at = close + 1;
      continue;
    }
    const next = step(state, c);
    if (next === "end" || next === "endSelfClosing") {
      return { end: at + 1, name, selfClosing: next === "endSelfClosing" };
    }
    state = next;
    at += 1;
  }
  return null;
}

/** The index past `</…`: an end tag (reported to `visit`) or a bogus comment. */
function pastEndTag(html: string, lt: number, visit: MarkupVisitor): number {
  const first = html[lt + 2] ?? "";
  if (first === ">") {
    return lt + 3;
  }
  if (!LETTER.test(first)) {
    return past(html, ">", lt + 2);
  }
  let at = lt + 2;
  while (at < html.length && !endsTagName(html[at] ?? "")) {
    at += 1;
  }
  visit.close(tagName(html.slice(lt + 2, at), visit.context()));
  // Everything up to `>` belongs to the end tag, quotes or not.
  return past(html, ">", at);
}

/** The index past an open tag and, for a raw-text element, its text. */
function pastOpenTag(html: string, lt: number, visit: MarkupVisitor): number {
  const tag = readOpenTag(html, lt + 1);
  if (!tag) {
    return html.length;
  }
  const context = visit.context();
  const name = tagName(tag.name, context);
  // Decided before the tag opens, as htmlparser2's tokenizer does.
  const rawText = context === "html";
  if (!visit.open(name, tag.selfClosing)) {
    return -1;
  }
  if (rawText && name === PLAINTEXT) {
    visit.text(tag.end, html.length, name);
    return html.length;
  }
  const rawTextEnd = rawText ? RAW_TEXT_END.get(name) : undefined;
  if (!rawTextEnd) {
    return tag.end;
  }
  rawTextEnd.lastIndex = tag.end;
  const end = rawTextEnd.exec(html)?.index ?? html.length;
  visit.text(tag.end, end, name);
  return end;
}

/** Walks `html` once, reporting tags and text to `visit`. */
function scanMarkup(html: string, visit: MarkupVisitor): void {
  let at = 0;
  while (at < html.length) {
    const lt = html.indexOf("<", at);
    if (lt === -1) {
      visit.text(at, html.length);
      return;
    }
    if (lt > at) {
      visit.text(at, lt);
    }
    const next = html[lt + 1] ?? "";
    if (LETTER.test(next)) {
      at = pastOpenTag(html, lt, visit);
      if (at === -1) {
        return;
      }
    } else if (next === "/") {
      at = pastEndTag(html, lt, visit);
    } else if (next === "!") {
      at = pastDeclaration(html, lt);
    } else if (next === "?") {
      at = past(html, ">", lt + 2);
    } else {
      // A `<` that opens nothing is text.
      visit.text(lt, lt + 1);
      at = lt + 1;
    }
  }
}

interface OpenElement {
  /** The context of what is inside it. */
  context: Context;
  name: string;
}

function contextInside(name: string, outside: Context): Context {
  if (name === "svg" || name === "math") {
    return name;
  }
  if (
    HTML_INTEGRATION.has(name) ||
    (name === "foreignobject" && outside === "svg")
  ) {
    return "html";
  }
  return outside;
}

/**
 * Whether `html` nests more than `limit` elements deep, as htmlparser2 would
 * build them. Stops at the first element past `limit`, so its own work stays
 * linear: the stack it searches never holds more than `limit + 1`.
 */
export function nestsDeeperThan(html: string, limit: number): boolean {
  const open: OpenElement[] = [];
  let deeper = false;
  const context = (): Context => open.at(-1)?.context ?? "html";
  scanMarkup(html, {
    close(name) {
      if (VOID_TAGS.has(name)) {
        return;
      }
      for (let at = open.length - 1; at >= 0; at -= 1) {
        if (open[at]?.name === name) {
          open.length = at;
          return;
        }
      }
    },
    context,
    open(name, selfClosing) {
      const closes = IMPLIES_CLOSE.get(name);
      while (closes?.has(open.at(-1)?.name ?? "")) {
        open.pop();
      }
      if (VOID_TAGS.has(name)) {
        return true;
      }
      open.push({ context: contextInside(name, context()), name });
      // In SVG and MathML a self-closing tag closes at once.
      if (selfClosing && context() !== "html") {
        open.pop();
      }
      deeper = open.length > limit;
      return !deeper;
    },
    text() {
      // Text holds no elements.
    },
  });
  return deeper;
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

const DROPPED: ReadonlySet<string> = new Set(DROPPED_WITH_CONTENT);

/**
 * The text of `html` as source-text lines, split where a block starts or
 * ends and trimmed; empty lines go. Tags are gone; entities are left as
 * written, and the text of a raw-text element that the sanitisers drop with
 * its content (`<script>`, `<style>`) goes with it. Linear, at any depth.
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
  scanMarkup(html, {
    close(name) {
      if (BLOCK_BREAKS.has(name)) {
        endLine();
      }
    },
    context: () => "html",
    open(name) {
      if (BLOCK_BREAKS.has(name)) {
        endLine();
      }
      return true;
    },
    text(start, end, rawTextOf) {
      if (!(rawTextOf && DROPPED.has(rawTextOf))) {
        line += html.slice(start, end);
      }
    },
  });
  endLine();
  return lines;
}
