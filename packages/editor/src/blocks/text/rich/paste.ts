import {
  nearestTextColour,
  parseCssColour,
  type TextColourToken,
  type TextSwatch,
  textSwatches,
} from "@repo/shared/utils/text-colours";
import { DROPPED_WITH_CONTENT } from "@/lib/rich-allowlist";
import { parseInert } from "@/lib/sanitize";
import { keepLineBreaks } from "./html";
import { effectiveDepths, flattenListItems } from "./list-item-parse";
import { isBlankText, rename, structureBlocks, unwrap } from "./structure";

// Clipboard HTML from Word (desktop and web), Google Docs and web pages,
// rewritten into plain semantic markup before Plate's HTML deserializer reads
// it. Plate keeps only what the rich text schema knows, so this pass only has
// to fix what Plate would misread: Word's paragraph "lists" and junk, heading
// levels, text colours (as swatch tokens), lines and tables
// (`structureBlocks`), a link's underline, line breaks, and whitespace at the
// end of a block.

/** Removed with their content. */
const REMOVED_TAGS: ReadonlySet<string> = new Set([
  "o:p",
  "meta",
  "link",
  "title",
  "xml",
  ...DROPPED_WITH_CONTENT,
]);

const WORD_LIST_ITEM = /mso-list:\s*(l\d+)\s+level(\d+)/;
const ORDERED_MARKER = /^\(?(\d+|[a-z]{1,3})[.)]/i;
const DIGITS = /^\d+$/;
const HEADING_TAG = /^H([1-6])$/;
const HEADINGS = "h1, h2, h3, h4, h5, h6";
/** The span Word writes a list item's bullet or number in. */
const WORD_MARKER = 'span[style*="mso-list:Ignore"]';
/** Blocks that hold text directly, and the ones that become paragraphs. */
const TEXT_BLOCKS = [
  "blockquote",
  "caption",
  "dd",
  "div",
  "dt",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "p",
  "td",
  "th",
];
const BLOCK_TAGS = [...TEXT_BLOCKS, "hr", "ol", "table", "ul"];
const BLOCK_NODE_NAMES: ReadonlySet<string> = new Set(
  BLOCK_TAGS.map((tag) => tag.toUpperCase())
);
const TEXT_BLOCK_SELECTOR = TEXT_BLOCKS.join(", ");
const BLOCK_SELECTOR = BLOCK_TAGS.join(", ");

/**
 * How many pictures the clipboard HTML holds: `img` elements, and the
 * `v:imagedata` Word writes. The rich text has no images, so a paste drops
 * them.
 */
export function pastedImageCount(html: string): number {
  const root = parseInert(html);
  // A namespaced tag is no CSS selector.
  return (
    root.querySelectorAll("img").length +
    root.getElementsByTagName("v:imagedata").length
  );
}

/**
 * Pasted HTML as markup Plate's deserializer reads the way the user meant.
 * Colours map to the nearest of `swatches`: the page theme's, BISO's by
 * default.
 */
export function normalizePastedHtml(
  html: string,
  swatches: readonly TextSwatch[] = textSwatches(null)
): string {
  const root = parseInert(html);
  removeJunk(root);
  for (const wrapper of root.querySelectorAll('b[id^="docs-internal-guid"]')) {
    unwrap(wrapper);
  }
  // Before the Word lists: a Title is an h1 by then, and no heading joins a
  // list run.
  markHeadings(root);
  keepHeadingNumbers(root);
  // Once every heading is one, so no heading text is coloured.
  mapPastedColours(root, swatches);
  convertWordLists(root);
  markWordWebListLevels(root);
  trimBlockEnds(root);
  structureBlocks(root);
  dropLinkUnderline(root);
  shiftHeadings(root);
  // Last, once every list is final.
  flattenListItems(root);
  keepLineBreaks(root);
  return root.innerHTML;
}

function removeJunk(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    const isRemoved =
      child.nodeType === Node.COMMENT_NODE ||
      (child.nodeType === Node.ELEMENT_NODE &&
        REMOVED_TAGS.has((child as Element).tagName.toLowerCase()));
    if (isRemoved) {
      child.parentNode?.removeChild(child);
    } else {
      removeJunk(child);
    }
  }
}

/**
 * Word's own heading marks as heading tags: desktop Word's Title paragraph,
 * and Word on the web's `<p role="heading" aria-level="n">`.
 */
function markHeadings(root: HTMLElement): void {
  for (const title of root.querySelectorAll("p.MsoTitle")) {
    rename(title, "h1");
  }
  for (const heading of root.querySelectorAll('p[role="heading"]')) {
    const level = Number(heading.getAttribute("aria-level"));
    if (Number.isInteger(level) && level >= 1 && level <= 6) {
      rename(heading, `h${level}`);
    }
  }
}

/**
 * Word numbers a heading ("1. Introduction") with the same `mso-list` style
 * and marker span as a list item. The heading stays a heading, and its number
 * stays as text.
 */
function keepHeadingNumbers(root: HTMLElement): void {
  for (const heading of root.querySelectorAll(HEADINGS)) {
    const marker = heading.querySelector(WORD_MARKER);
    marker?.replaceWith(`${(marker.textContent ?? "").trim()} `);
  }
}

// ── Colour ──
// The writer's colours, not the source's look: a colour on an inline element
// takes the nearest swatch, or none. A colour on a block, in a heading or on
// a link is the source's layout, and so is the colour most of the text is in
// (Word's grey body, a web page's ink).

/** The elements a pasted colour maps on. */
const COLOUR_INLINES: ReadonlySet<string> = new Set([
  "B",
  "EM",
  "FONT",
  "I",
  "MARK",
  "S",
  "SMALL",
  "SPAN",
  "STRIKE",
  "STRONG",
  "SUB",
  "SUP",
  "U",
]);

/**
 * Text that keeps no colour and does not count towards the text colour. An
 * `<a>` with no href (Word's bookmarks) is no link.
 */
const UNCOLOURED_TEXT = `${HEADINGS}, a[href]`;

/** A `color` declaration (not `background-color`) and its value. */
const COLOUR_DECLARATION = /^\s*color\s*:(.*)$/is;
const IMPORTANT = /!\s*important\s*$/i;
const WHITE_SPACE = /\s/g;

/**
 * The colour `el` sets, as `#rrggbb`, from its last `color` declaration or a
 * `font`'s `color` attribute; null when it sets none `parseCssColour` reads
 * (`inherit`, a transparent one). The declarations, the attribute and a
 * stored `data-color` token are removed either way, so a token reaches
 * Plate only through these rules.
 */
function takeColour(el: Element): string | null {
  el.removeAttribute("data-color");
  let value: string | null = null;
  const style = el.getAttribute("style");
  if (style !== null) {
    const declarations = style.split(";");
    const kept = declarations.filter((declaration) => {
      const match = COLOUR_DECLARATION.exec(declaration);
      if (match) {
        value = (match[1] ?? "").replace(IMPORTANT, "");
      }
      return match === null;
    });
    if (kept.length < declarations.length) {
      el.setAttribute("style", kept.join(";"));
    }
  }
  // An inline style wins over the attribute, as in CSS.
  if (el.tagName === "FONT" && el.hasAttribute("color")) {
    value ??= el.getAttribute("color");
    el.removeAttribute("color");
  }
  return value === null ? null : parseCssColour(value);
}

/** What a source's grey body text maps to (`mapPastedColours`). */
const BODY_GREY: TextColourToken = "muted";

/** A text's characters that are not white space. */
const visibleLength = (node: Node): number =>
  (node.textContent ?? "").replace(WHITE_SPACE, "").length;

/** What the colour walk gathers. */
interface ColourWalk {
  /** The blocks that hold text, headings and links included. */
  blocks: Set<Element | null>;
  /** Each text the writer coloured, with its token. */
  coloured: [node: Text, token: TextColourToken][];
  /** How much of the text outside headings and links each token covers. */
  shares: Map<TextColourToken, number>;
  swatches: readonly TextSwatch[];
  /** The text outside headings and links. */
  total: number;
}

/**
 * A text that shows: its block noted, and its length and colour counted
 * where it is outside headings and links. White space takes no colour, so a
 * coloured run around blocks adds no span between them (a line of its own
 * in a cell).
 */
function addText(
  walk: ColourWalk,
  node: Text,
  token: TextColourToken | null,
  inBody: boolean
): void {
  const length = visibleLength(node);
  if (length === 0) {
    return;
  }
  walk.blocks.add(node.parentElement?.closest(TEXT_BLOCK_SELECTOR) ?? null);
  if (!inBody) {
    return;
  }
  walk.total += length;
  if (token !== null) {
    walk.shares.set(token, (walk.shares.get(token) ?? 0) + length);
    walk.coloured.push([node, token]);
  }
}

/**
 * The colour `element`'s content is in, and whether it is outside headings
 * and links (`inBody`): its own colour where it sets one, as a token only
 * on an inline element outside them; else the colour around it.
 */
function colourInside(
  walk: ColourWalk,
  element: Element,
  around: TextColourToken | null,
  inBody: boolean
): [token: TextColourToken | null, inBody: boolean] {
  const hex = takeColour(element);
  if (element.matches(UNCOLOURED_TEXT)) {
    return [null, false];
  }
  if (hex === null) {
    return [around, inBody];
  }
  const own =
    inBody && COLOUR_INLINES.has(element.tagName)
      ? nearestTextColour(hex, walk.swatches)
      : null;
  return [own, inBody];
}

function walkColours(
  walk: ColourWalk,
  node: Node,
  token: TextColourToken | null,
  inBody: boolean
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      addText(walk, child as Text, token, inBody);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      walkColours(
        walk,
        child,
        ...colourInside(walk, child as Element, token, inBody)
      );
    }
  }
}

/**
 * Each text in the colour a browser paints it in, the colour of the
 * innermost element that sets one, on a `<span data-color>` of its own,
 * where that colour is the writer's: set on an inline element, near a swatch
 * (`nearestTextColour`) and outside headings and links. Where the text is in
 * two blocks or more, a colour on more than half of it outside headings and
 * links is the source's text colour and goes too. In one block, Muted is
 * the source's text colour and goes: Chrome and Safari wrap a one-paragraph
 * copy in the page's text colour, and the common body greys map to it. A
 * word or a line pasted in another colour keeps it. Every `color`
 * declaration goes.
 */
function mapPastedColours(
  root: HTMLElement,
  swatches: readonly TextSwatch[]
): void {
  const walk: ColourWalk = {
    blocks: new Set(),
    coloured: [],
    shares: new Map(),
    swatches,
    total: 0,
  };
  walkColours(walk, root, null, true);
  const judgesTextColour = walk.blocks.size >= 2;
  for (const [node, token] of walk.coloured) {
    const isTextColour = judgesTextColour
      ? (walk.shares.get(token) ?? 0) * 2 > walk.total
      : token === BODY_GREY;
    if (isTextColour) {
      continue;
    }
    const span = root.ownerDocument.createElement("span");
    span.setAttribute("data-color", token);
    node.replaceWith(span);
    span.append(node);
  }
}

// ── Desktop Word lists ──
// Word writes a list as one paragraph per item, with the level in its inline
// `mso-list` style and the bullet or number as text in a `mso-list:Ignore`
// span. Adjacent items become one nested `<ul>`/`<ol>`.

interface OpenWordList {
  item: HTMLElement;
  level: number;
  list: HTMLElement;
  tag: "ol" | "ul";
}

/** A Word list paragraph's level; never a heading's, which Word also numbers. */
const wordListLevel = (node: Node): number | undefined => {
  if (
    node.nodeType !== Node.ELEMENT_NODE ||
    HEADING_TAG.test((node as Element).tagName)
  ) {
    return;
  }
  const match = WORD_LIST_ITEM.exec(
    (node as Element).getAttribute("style") ?? ""
  );
  return match ? Number(match[2]) : undefined;
};

function convertWordLists(root: HTMLElement): void {
  const converted = new Set<Element>();
  for (const first of root.querySelectorAll('[style*="mso-list"]')) {
    if (converted.has(first) || wordListLevel(first) === undefined) {
      continue;
    }
    const { blanks, items } = wordListRun(first);
    first.before(buildWordList(items));
    for (const item of items) {
      converted.add(item);
      item.remove();
    }
    for (const blank of blanks) {
      blank.parentNode?.removeChild(blank);
    }
  }
}

/**
 * The list item and the list items right after it. Blank text between them
 * belongs to the run; anything else ends it.
 */
function wordListRun(first: Element): { blanks: Node[]; items: Element[] } {
  const items = [first];
  const blanks: Node[] = [];
  let pending: Node[] = [];
  for (let node = first.nextSibling; node; node = node.nextSibling) {
    if (isBlankText(node)) {
      pending.push(node);
    } else if (wordListLevel(node) === undefined) {
      break;
    } else {
      items.push(node as Element);
      blanks.push(...pending);
      pending = [];
    }
  }
  return { blanks, items };
}

/** The bullet or number Word wrote as text, taken out of the paragraph. */
function takeMarker(paragraph: Element): string {
  const marker = paragraph.querySelector(WORD_MARKER);
  if (!marker) {
    return "";
  }
  const text = marker.textContent ?? "";
  marker.remove();
  return text.trim();
}

/** A list's `start` worth writing: its first number, when that is 2 or more. */
const listStart = (number: string): number | undefined =>
  DIGITS.test(number) && Number(number) >= 2 ? Number(number) : undefined;

/**
 * The same stack walk as the serializer's, on the `effectiveDepths` of
 * Word's levels, so items that skip a level stay siblings.
 */
function buildWordList(paragraphs: Element[]): DocumentFragment {
  const doc = paragraphs[0]?.ownerDocument ?? document;
  const out = doc.createDocumentFragment();
  const stack: OpenWordList[] = [];
  const depths = effectiveDepths(
    paragraphs.map((paragraph) => wordListLevel(paragraph) ?? 1)
  );
  for (const [index, paragraph] of paragraphs.entries()) {
    const level = depths[index] ?? 1;
    const ordered = ORDERED_MARKER.exec(takeMarker(paragraph));
    const tag = ordered ? "ol" : "ul";
    while ((stack.at(-1)?.level ?? 0) > level) {
      stack.pop();
    }
    if (stack.at(-1)?.level === level && stack.at(-1)?.tag !== tag) {
      stack.pop();
    }
    const item = doc.createElement("li");
    item.append(...Array.from(paragraph.childNodes));
    const top = stack.at(-1);
    if (top?.level === level) {
      top.list.append(item);
      top.item = item;
      continue;
    }
    const list = doc.createElement(tag);
    const start = listStart(ordered?.[1] ?? "");
    if (start !== undefined) {
      list.setAttribute("start", String(start));
    }
    list.append(item);
    (top?.item ?? out).append(list);
    stack.push({ item, level, list, tag });
  }
  return out;
}

/** Word on the web gives each list item its level as `data-aria-level`. */
function markWordWebListLevels(root: HTMLElement): void {
  for (const item of root.querySelectorAll("li[data-aria-level]")) {
    if (!item.hasAttribute("aria-level")) {
      item.setAttribute(
        "aria-level",
        item.getAttribute("data-aria-level") ?? ""
      );
    }
  }
}

// ── Whitespace ──

/**
 * Whitespace at the end of a block's text, and before any block (a nested
 * list, a paragraph inside a coloured run), removed. A browser does not show
 * it, but Plate's whitespace collapse keeps it as a trailing space ("Student
 * welfare <ul>", "a <br>b" in a cell). This also removes the `&nbsp;` Word
 * on the web ends each paragraph with.
 */
function trimBlockEnds(root: HTMLElement): void {
  for (const block of root.querySelectorAll(TEXT_BLOCK_SELECTOR)) {
    trimTrailingText(block.lastChild);
  }
  for (const block of root.querySelectorAll(BLOCK_SELECTOR)) {
    trimTrailingText(block.previousSibling);
  }
}

/**
 * Trailing whitespace trimmed from `node` and the inline content before it,
 * up to the first text left. True once that text is found or a block or
 * line break stops the walk.
 */
function trimTrailingText(start: Node | null): boolean {
  for (let node = start; node; node = node.previousSibling) {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent = (node.textContent ?? "").trimEnd();
      if (node.textContent !== "") {
        return true;
      }
    } else if (
      node.nodeType !== Node.ELEMENT_NODE ||
      node.nodeName === "BR" ||
      BLOCK_NODE_NAMES.has(node.nodeName) ||
      trimTrailingText(node.lastChild)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Google Docs and Word on the web underline a link's text with an inline
 * style. That is the link's look, not an underline the writer chose.
 */
function dropLinkUnderline(root: HTMLElement): void {
  for (const link of root.querySelectorAll("a")) {
    for (const styled of link.querySelectorAll<HTMLElement>("[style]")) {
      styled.style.removeProperty("text-decoration");
    }
  }
}

/**
 * Heading levels made relative: the highest level pasted becomes `h2` (the
 * page title is the page's `h1`) and every lower level `h3`.
 */
function shiftHeadings(root: HTMLElement): void {
  const headings = Array.from(root.querySelectorAll(HEADINGS));
  const levelOf = (heading: Element): number =>
    Number(HEADING_TAG.exec(heading.tagName)?.[1]);
  const top = Math.min(...headings.map(levelOf));
  for (const heading of headings) {
    const tag = levelOf(heading) === top ? "H2" : "H3";
    if (heading.tagName !== tag) {
      rename(heading, tag.toLowerCase());
    }
  }
}

// ── Plain text ──

const BULLET_LINE = /^\s*[-*•]\s+/;
const NUMBER_LINE = /^\s*(\d+)[.)]\s+/;
const BLANK_LINE = /\n\s*\n/;

const escapeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * Whether plain text needs the HTML path: it has a line break, or it starts
 * with a list marker. Anything else is inserted as it is, so a single line
 * keeps its spaces (" world" after "hello").
 */
export function plainTextHasStructure(text: string): boolean {
  return (
    text.includes("\n") || BULLET_LINE.test(text) || NUMBER_LINE.test(text)
  );
}

/**
 * Plain text as HTML: blank lines separate chunks. Within a chunk, a run of
 * lines that start with `-`, `*` or `•` becomes a bullet list, a run that
 * starts with `1.` or `1)` a numbered one (from its first number) when its
 * numbers count on by one, and the lines between them one paragraph, joined
 * by line breaks. A numbered run that does not count on ("17. mai",
 * "24. mai") is paragraph text.
 */
export function plainTextToHtml(text: string): string {
  return text
    .replaceAll("\r\n", "\n")
    .split(BLANK_LINE)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk !== "")
    .map(chunkToHtml)
    .join("");
}

type LineKind = "ol" | "p" | "ul";

interface LineRun {
  kind: LineKind;
  lines: string[];
}

function lineKind(line: string): LineKind {
  if (BULLET_LINE.test(line)) {
    return "ul";
  }
  return NUMBER_LINE.test(line) ? "ol" : "p";
}

/** Adds `lines` to the last run when it is of `kind`, else starts a run. */
function addToRuns(runs: LineRun[], kind: LineKind, lines: string[]): void {
  const run = runs.at(-1);
  if (run?.kind === kind) {
    run.lines.push(...lines);
  } else {
    runs.push({ kind, lines: [...lines] });
  }
}

/** Whether numbered lines count on by one from the first line's number. */
function countsOn(lines: string[]): boolean {
  const numbers = lines.map((line) => Number(NUMBER_LINE.exec(line)?.[1]));
  const first = numbers[0] ?? 0;
  return numbers.every((number, i) => number === first + i);
}

/**
 * Each run of adjacent lines of one kind, in order. A numbered run that does
 * not count on joins the paragraph lines around it.
 */
function lineRuns(chunk: string): LineRun[] {
  const marked: LineRun[] = [];
  for (const line of chunk.split("\n")) {
    addToRuns(marked, lineKind(line), [line]);
  }
  const runs: LineRun[] = [];
  for (const { kind, lines } of marked) {
    addToRuns(runs, kind === "ol" && !countsOn(lines) ? "p" : kind, lines);
  }
  return runs;
}

function runToHtml({ kind, lines }: LineRun) {
  if (kind === "p") {
    return `<p>${lines.map(escapeText).join("<br>")}</p>`;
  }
  const marker = kind === "ul" ? BULLET_LINE : NUMBER_LINE;
  const items = lines
    .map((line) => `<li>${escapeText(line.replace(marker, ""))}</li>`)
    .join("");
  const start =
    kind === "ol"
      ? listStart(NUMBER_LINE.exec(lines[0] ?? "")?.[1] ?? "")
      : undefined;
  const startAttribute = start === undefined ? "" : ` start="${start}"`;
  return `<${kind}${startAttribute}>${items}</${kind}>`;
}

function chunkToHtml(chunk: string): string {
  return lineRuns(chunk).map(runToHtml).join("");
}
