import { LIST_TAGS } from "./list-item-parse";

// Blocks Plate has no parser for, rewritten into the ones it has. Plate reads
// a `div`, a table cell or a definition as no block at all, so its words run
// into the next one's ("NameEmail"). Pasted HTML and stored HTML both go
// through this before Plate deserializes them.

/** Tags that make their parent a container of blocks rather than of text. */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "CAPTION",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

/**
 * One line of text each: a paragraph, unless it holds blocks itself. A
 * table's caption is one too: unwrapped, its words would join the source
 * whitespace after it ("Board ").
 */
const LINE_CONTAINERS = "div, td, th, caption, dt, dd";

/**
 * Removed around their content. Until tables arrive (Stage 2) each cell is a
 * paragraph of its own, in reading order.
 */
const WRAPPERS = "table, thead, tbody, tfoot, tr, colgroup, col, dl";

export const isBlankText = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";

export function rename(el: Element, tag: string): void {
  const renamed = el.ownerDocument.createElement(tag);
  renamed.append(...Array.from(el.childNodes));
  el.replaceWith(renamed);
}

export function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes));
}

const holdsBlocks = (el: Element): boolean =>
  Array.from(el.children).some((child) => BLOCK_TAGS.has(child.tagName));

/**
 * The blocks Plate cannot read as ones it can: a `div`, table cell or
 * caption, `dt` or `dd` becomes a paragraph (or is unwrapped when it holds
 * blocks), table and definition-list wrappers go, and the paragraphs inside
 * a list item or a quote are joined by line breaks.
 */
export function structureBlocks(root: HTMLElement): void {
  for (const wrapper of root.querySelectorAll(WRAPPERS)) {
    unwrap(wrapper);
  }
  for (const container of root.querySelectorAll(LINE_CONTAINERS)) {
    if (holdsBlocks(container)) {
      unwrap(container);
    } else {
      rename(container, "p");
    }
  }
  joinBlockParagraphs(root);
}

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
function joinBlockParagraphs(root: HTMLElement): void {
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
