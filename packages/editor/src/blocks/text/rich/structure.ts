import { LIST_TAGS } from "./list-item-parse";

// Blocks Plate has no parser for, rewritten into the ones it has. Plate reads
// a `div` or a definition as no block at all, so its words run into the next
// one's ("NameEmail"). A table stays a table, each cell one or more lines of
// text. Pasted HTML and stored HTML both go through this before Plate
// deserializes them.

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

/** One line of text each: a paragraph, unless it holds blocks itself. */
const LINE_CONTAINERS = "div, dt, dd";

/** Removed around their content. */
const WRAPPERS = "dl";

const CELLS = "td, th";

/**
 * A table inside one of these cannot stay a table: the page stores no table
 * in a list item, a quote, a cell, a caption, a paragraph or a heading.
 */
const NO_TABLE_INSIDE =
  "li, blockquote, td, th, caption, p, h1, h2, h3, h4, h5, h6";

/** What a flattened table loses around its content. */
const TABLE_WRAPPERS = "table, thead, tbody, tfoot, tr, colgroup, col";

/** A table's rows and the sections that hold them. */
const ROW_WRAPPERS = "thead, tbody, tfoot, tr";

export const isBlankText = (node: Node): boolean =>
  node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() === "";

export function rename(el: Element, tag: string): void {
  const renamed = el.ownerDocument.createElement(tag);
  renamed.append(...Array.from(el.childNodes));
  el.replaceWith(renamed);
}

/** Like `rename`, keeping the attributes: a cell's spans. */
function retag(el: Element, tag: string): void {
  const renamed = el.ownerDocument.createElement(tag);
  for (const { name, value } of Array.from(el.attributes)) {
    renamed.setAttribute(name, value);
  }
  renamed.append(...Array.from(el.childNodes));
  el.replaceWith(renamed);
}

export function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes));
}

/**
 * Whether `el` holds blocks: a child is a block, or an inline element that
 * holds blocks itself (`<a><span><p>a</p><p>b</p></span></a>`).
 */
const holdsBlocks = (el: Element): boolean =>
  Array.from(el.children).some(
    (child) => BLOCK_TAGS.has(child.tagName) || holdsBlocks(child)
  );

const isBlank = (el: Element): boolean => (el.textContent ?? "").trim() === "";

/** A paragraph, or unwrapped when it holds blocks itself. */
function asParagraph(el: Element): void {
  if (holdsBlocks(el)) {
    unwrap(el);
  } else {
    rename(el, "p");
  }
}

const childrenTagged = (el: Element, tag: string): Element[] =>
  Array.from(el.children).filter((child) => child.tagName === tag);

/**
 * The blocks Plate cannot read as ones it can. In order:
 * 0. A link around blocks, or an inline element around blocks in a list
 *    item, a quote or a heading, goes into each of them
 *    (`inlineIntoBlocks`).
 * 1. A table where the page stores none (`NO_TABLE_INSIDE`) is flattened:
 *    each cell a paragraph (or unwrapped when it holds blocks).
 * 2. Every other table is tidied to the stored shape (`tidyTable`).
 * 3. The blocks in each cell become lines of the cell (`cellLines`).
 * 4. A `div`, `dt` or `dd` becomes a paragraph (or is unwrapped when it
 *    holds blocks), a definition list's wrapper goes, and the paragraphs
 *    inside a list item or a quote are joined by line breaks.
 * Wherever a table goes, its caption is a line of its own just before it.
 */
export function structureBlocks(root: HTMLElement): void {
  inlineIntoBlocks(root);
  flattenMisplacedTables(root);
  for (const table of root.querySelectorAll("table")) {
    tidyTable(table);
  }
  for (const cell of root.querySelectorAll(CELLS)) {
    cellLines(cell);
  }
  for (const wrapper of root.querySelectorAll(WRAPPERS)) {
    unwrap(wrapper);
  }
  for (const container of root.querySelectorAll(LINE_CONTAINERS)) {
    asParagraph(container);
  }
  joinBlockParagraphs(root);
}

/** A block, or an inline element that holds blocks (`holdsBlocks`). */
const isBlockOrHolder = (node: Node): node is Element =>
  node.nodeType === Node.ELEMENT_NODE &&
  (BLOCK_TAGS.has(node.nodeName) || holdsBlocks(node as Element));

/**
 * Each run of `parent`'s children beside its blocks, and beside the inline
 * elements that hold blocks, in a copy of `inline`, unless the run is blank.
 */
function wrapRunsBeside(inline: Element, parent: Element): void {
  let run: Node[] = [];
  const wrapRun = () => {
    const [first] = run;
    if (first && run.some((node) => !isBlankText(node))) {
      const copy = inline.cloneNode(false) as Element;
      parent.insertBefore(copy, first);
      copy.append(...run);
    }
    run = [];
  };
  for (const child of Array.from(parent.childNodes)) {
    if (isBlockOrHolder(child)) {
      wrapRun();
    } else {
      run.push(child);
    }
  }
  wrapRun();
}

/**
 * A copy of `inline` around the content of `block`, or, where `block` holds
 * blocks itself, around each run of content beside them and into each of
 * them: a list's items, a table's cells, and through an inline element that
 * holds blocks, the blocks it holds.
 */
function pushInto(inline: Element, block: Element): void {
  if (!holdsBlocks(block)) {
    if (block.hasChildNodes()) {
      const copy = inline.cloneNode(false) as Element;
      copy.append(...Array.from(block.childNodes));
      block.append(copy);
    }
    return;
  }
  wrapRunsBeside(inline, block);
  for (const child of Array.from(block.children)) {
    if (isBlockOrHolder(child)) {
      pushInto(inline, child);
    }
  }
}

/** Blocks that hold lines of text, not blocks: list items, quotes, headings. */
const LINE_HOLDERS: ReadonlySet<string> = new Set([
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
]);

/** The block `el` sits in, through inline elements, or none. */
function blockAround(el: Element, root: HTMLElement): Element | null {
  for (let at = el.parentElement; at && at !== root; at = at.parentElement) {
    if (BLOCK_TAGS.has(at.tagName)) {
      return at;
    }
  }
  return null;
}

/**
 * Whether `el` is an inline element whose blocks Plate would run together:
 * a link anywhere, or any inline element in a list item, a quote or a
 * heading (`<li><span><p>a</p><p>b</p></span></li>`). Elsewhere Plate itself
 * puts a mark or a colour's span around blocks into each, and a cell's
 * blocks are its lines however deep they sit (`cellLines`).
 */
function runsBlocksTogether(el: Element, root: HTMLElement): boolean {
  if (BLOCK_TAGS.has(el.tagName)) {
    return false;
  }
  const around = blockAround(el, root);
  return (
    el.tagName === "A" || (around !== null && LINE_HOLDERS.has(around.tagName))
  );
}

/**
 * Each such inline element (`runsBlocksTogether`) around blocks put inside
 * them instead: around the content of each block, and of each cell of a
 * table, and around the text beside them. So a table in a link stays a
 * table, its cells linked, and blocks keep their lines apart: in a list
 * item or a quote they are joined by line breaks later
 * (`joinBlockParagraphs`). Innermost first, so an outer one finds the
 * blocks an inner one held.
 */
function inlineIntoBlocks(root: HTMLElement): void {
  const inlines = Array.from(root.querySelectorAll("*")).filter((el) =>
    runsBlocksTogether(el, root)
  );
  for (const inline of inlines.reverse()) {
    if (holdsBlocks(inline)) {
      pushInto(inline, inline);
      unwrap(inline);
    }
  }
}

/** Each caption of `table` as a paragraph just before it. */
function captionsBefore(table: Element): void {
  for (const caption of childrenTagged(table, "CAPTION")) {
    table.before(caption);
    asParagraph(caption);
  }
}

/**
 * Stage 1's rule for a table the page cannot store where it sits: its
 * wrappers go and each cell is a paragraph, in reading order. Innermost
 * first, so a table's cells are its own by the time it goes.
 */
function flattenMisplacedTables(root: HTMLElement): void {
  const misplaced = Array.from(root.querySelectorAll("table")).filter(
    (table) => {
      const holder = table.parentElement?.closest(NO_TABLE_INSIDE);
      return Boolean(holder && root.contains(holder));
    }
  );
  for (const table of misplaced.reverse()) {
    captionsBefore(table);
    for (const cell of table.querySelectorAll(CELLS)) {
      asParagraph(cell);
    }
    for (const wrapper of table.querySelectorAll(TABLE_WRAPPERS)) {
      unwrap(wrapper);
    }
    unwrap(table);
  }
}

/**
 * A table in the stored shape: no column groups; the caption a paragraph
 * before it; the header first, where a browser draws it wherever the source
 * has it; footer rows at the end of the last body (one is made when there is
 * none); every cell of the header a `th`; no row without a cell. A table
 * with no cell left is unwrapped.
 */
function tidyTable(table: Element): void {
  for (const column of table.querySelectorAll("colgroup, col")) {
    column.remove();
  }
  captionsBefore(table);
  table.prepend(...childrenTagged(table, "THEAD"));
  const footers = childrenTagged(table, "TFOOT");
  if (footers.length > 0) {
    let body = childrenTagged(table, "TBODY").at(-1);
    if (body === undefined) {
      body = table.ownerDocument.createElement("tbody");
      table.append(body);
    }
    for (const footer of footers) {
      body.append(...Array.from(footer.childNodes));
      footer.remove();
    }
  }
  for (const cell of table.querySelectorAll("thead td")) {
    retag(cell, "th");
  }
  for (const row of table.querySelectorAll("tr")) {
    if (row.querySelector(CELLS) === null) {
      row.remove();
    }
  }
  if (table.querySelector(CELLS) === null) {
    for (const wrapper of table.querySelectorAll(ROW_WRAPPERS)) {
      unwrap(wrapper);
    }
    unwrap(table);
  }
}

const blocksIn = (el: Element): Element[] =>
  Array.from(el.querySelectorAll("*")).filter((child) =>
    BLOCK_TAGS.has(child.tagName)
  );

/**
 * Each block in a cell unwrapped, with a `<br>` between it and the content
 * beside it, so the cell holds lines of text as the page stores it. An empty
 * block goes first, a divider with it, so it leaves no empty line. Then
 * inner blocks first: a block after another adds the break between them
 * before the first is unwrapped.
 */
function cellLines(cell: Element): void {
  for (const block of blocksIn(cell)) {
    if (isBlank(block)) {
      block.remove();
    }
  }
  for (const block of blocksIn(cell).reverse()) {
    breakAround(block, () => false);
    unwrap(block);
  }
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
 * A `<br>` before `block` and after it wherever content sits beside it, so
 * once unwrapped its words never run into the content beside them. No break
 * goes next to one already there, nor after it where `addsOwnBreak` says
 * the next sibling brings its own.
 */
function breakAround(block: Element, addsOwnBreak: (next: Node) => boolean) {
  const before = contentSibling(block, "previousSibling");
  if (before && !isBreakOrList(before)) {
    block.before(block.ownerDocument.createElement("br"));
  }
  const after = contentSibling(block, "nextSibling");
  if (after && !isBreakOrList(after) && !addsOwnBreak(after)) {
    block.after(block.ownerDocument.createElement("br"));
  }
}

/**
 * The paragraphs that become lines of the block holding them. A heading
 * holds some only where a table inside it was flattened, or an inline
 * element around them went into them (`inlineIntoBlocks`).
 */
const JOINED_PARAGRAPHS =
  "li > p, blockquote > p, h1 > p, h2 > p, h3 > p, h4 > p, h5 > p, h6 > p";

/**
 * Each `<p>` directly in an `<li>`, a `<blockquote>` or a heading unwrapped,
 * with a `<br>` between it and the content beside it, so its words never run
 * into the next paragraph's. A nested list needs no break; an empty
 * paragraph goes.
 */
function joinBlockParagraphs(root: HTMLElement): void {
  for (const paragraph of root.querySelectorAll(JOINED_PARAGRAPHS)) {
    if (isBlank(paragraph)) {
      paragraph.remove();
      continue;
    }
    // A paragraph after this one adds its own break.
    breakAround(paragraph, (next) => next.nodeName === "P");
    unwrap(paragraph);
  }
}
