import { DROPPED_WITH_CONTENT } from "@/lib/rich-allowlist";
import { parseInert } from "@/lib/sanitize";
import {
  effectiveDepths,
  flattenListItems,
  LIST_TAGS,
} from "./list-item-parse";

// Clipboard HTML from Word (desktop and web), Google Docs and web pages,
// rewritten into plain semantic markup before Plate's HTML deserializer reads
// it. Plate keeps only what the rich text schema knows, so this pass only has
// to fix what Plate would misread: Word's paragraph "lists" and junk, heading
// levels, a link's underline, and whitespace at the end of a block.

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
/** Blocks that hold text directly. */
const TEXT_BLOCKS = [
  "blockquote",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "p",
];
const BLOCK_NODE_NAMES: ReadonlySet<string> = new Set(
  [...TEXT_BLOCKS, "hr", "ol", "table", "ul"].map((tag) => tag.toUpperCase())
);

/** Pasted HTML as markup Plate's deserializer reads the way the user meant. */
export function normalizePastedHtml(html: string): string {
  const root = parseInert(html);
  removeJunk(root);
  for (const wrapper of root.querySelectorAll('b[id^="docs-internal-guid"]')) {
    unwrap(wrapper);
  }
  // Before the Word lists: a Title is an h1 by then, and no heading joins a
  // list run.
  markHeadings(root);
  keepHeadingNumbers(root);
  convertWordLists(root);
  markWordWebListLevels(root);
  trimBlockEnds(root);
  unwrapBlockParagraphs(root);
  dropLinkUnderline(root);
  shiftHeadings(root);
  // Last, once every list is final.
  flattenListItems(root);
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

const isBlankText = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";

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
 * Whitespace at the end of a block's text, and before a block inside it (a
 * nested list), removed. A browser does not show it, but Plate's whitespace
 * collapse keeps it as a trailing space ("Student welfare <ul>"). This also
 * removes the `&nbsp;` Word on the web ends each paragraph with.
 */
function trimBlockEnds(root: HTMLElement): void {
  for (const block of root.querySelectorAll(TEXT_BLOCKS.join(", "))) {
    trimTrailingText(block.lastChild);
    for (const child of block.children) {
      if (BLOCK_NODE_NAMES.has(child.nodeName)) {
        trimTrailingText(child.previousSibling);
      }
    }
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

// ── Paragraphs inside list items and quotes ──

const isBreakOrList = (node: Node): boolean =>
  node.nodeName === "BR" || LIST_TAGS.has(node.nodeName);

function contentSibling(
  node: Node,
  side: "nextSibling" | "previousSibling"
): Node | null {
  let sibling = node[side];
  while (sibling && isBlankText(sibling)) {
    sibling = sibling[side];
  }
  return sibling;
}

/**
 * Each `<p>` directly in an `<li>` or `<blockquote>` unwrapped, with a `<br>`
 * between it and the content beside it, so its words never run into the
 * next paragraph's. A nested list needs no break; an empty paragraph goes.
 */
function unwrapBlockParagraphs(root: HTMLElement): void {
  for (const paragraph of root.querySelectorAll("li > p, blockquote > p")) {
    if ((paragraph.textContent ?? "").trim() === "") {
      paragraph.remove();
      continue;
    }
    const before = contentSibling(paragraph, "previousSibling");
    if (before && !isBreakOrList(before)) {
      paragraph.before(paragraph.ownerDocument.createElement("br"));
    }
    // A paragraph after this one adds its own break.
    const after = contentSibling(paragraph, "nextSibling");
    if (after && !isBreakOrList(after) && after.nodeName !== "P") {
      paragraph.after(paragraph.ownerDocument.createElement("br"));
    }
    unwrap(paragraph);
  }
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

function rename(el: Element, tag: string): void {
  const renamed = el.ownerDocument.createElement(tag);
  renamed.append(...Array.from(el.childNodes));
  el.replaceWith(renamed);
}

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes));
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
 * Plain text as HTML: blank-line-separated chunks become paragraphs, and a
 * chunk whose every line starts with `-`, `*` or `•` (or `1.`, `1)`) becomes
 * a bullet (or numbered, from its first number) list.
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

function chunkToHtml(chunk: string): string {
  const lines = chunk.split("\n");
  const items = (marker: RegExp): string =>
    lines
      .map((line) => `<li>${escapeText(line.replace(marker, ""))}</li>`)
      .join("");
  if (lines.every((line) => BULLET_LINE.test(line))) {
    return `<ul>${items(BULLET_LINE)}</ul>`;
  }
  if (lines.every((line) => NUMBER_LINE.test(line))) {
    const start = listStart(NUMBER_LINE.exec(chunk)?.[1] ?? "");
    const startAttribute = start === undefined ? "" : ` start="${start}"`;
    return `<ol${startAttribute}>${items(NUMBER_LINE)}</ol>`;
  }
  return `<p>${lines.map(escapeText).join("<br>")}</p>`;
}
