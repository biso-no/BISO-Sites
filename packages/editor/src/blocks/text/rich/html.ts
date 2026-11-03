import { getColSpan, getRowSpan } from "@platejs/table";
import {
  type AnySlatePlugin,
  createSlateEditor,
  type Descendant,
  deserializeHtml,
  ElementApi,
  type SlateEditor,
  type TElement,
  type TText,
  type Value,
} from "platejs";
import { keptCellSpan, keptColourToken, SAFE_HREF } from "@/lib/rich-allowlist";
import { parseInert, sanitizeRichBody } from "@/lib/sanitize";
import {
  effectiveDepths,
  flattenListItems,
  ORDERED_LIST_STYLES,
} from "./list-item-parse";
import { richBasePlugins, TABLE_CELL_TYPES } from "./plugins";
import { structureBlocks } from "./structure";

/**
 * A headless editor on the rich text schema, for conversion and paste.
 * `nodeId` gives every block an id, as the field's editor has: Plate's
 * merge-aware table transforms find a cell's place in the grid by it. Tests
 * of those transforms only; conversion stays id-free.
 */
export function createConversionEditor(
  extraPlugins: AnySlatePlugin[] = [],
  { nodeId = false }: { nodeId?: boolean } = {}
): SlateEditor {
  return createSlateEditor({
    // Plate adds a random `id` to every block unless NODE_ENV is "test";
    // the same HTML must always give the same value.
    nodeId,
    plugins: [...richBasePlugins, ...extraPlugins],
  });
}

const emptyValue = (): Value => [{ type: "p", children: [{ text: "" }] }];

/**
 * Deserialized nodes as top-level blocks. Plate wraps inline runs that sit
 * between blocks, but a body with no block at all (`a <b>b</b>`, or an `h1`
 * the sanitiser unwrapped) comes back all inline, and the normaliser would
 * delete every word of it.
 */
function asBlocks(editor: SlateEditor, nodes: Descendant[]): Value {
  const isBlock = (node: Descendant): boolean =>
    ElementApi.isElement(node) && !editor.api.isInline(node);
  if (nodes.length === 0) {
    return emptyValue();
  }
  return nodes.some(isBlock)
    ? (nodes as Value)
    : [{ type: "p", children: nodes }];
}

/**
 * The white space HTML keeps as text but Plate collapses, as its `\s`
 * matches it: everything JavaScript calls white space except space, tab,
 * LF, FF and CR. U+00A0 is the one a body is likely to hold.
 */
const KEPT_SPACES =
  "\v\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
const KEPT_SPACE = new RegExp(`[${KEPT_SPACES}]`, "g");
/** The noncharacters U+FDD0 to U+FDEF, which no text should hold. */
const FIRST_STAND_IN = 0xfd_d0;
const ANY_STAND_IN = /[\ufdd0-\ufdef]/;
const STAND_IN = /[\ufdd0-\ufdef]/g;

/** Each kept space in the text below `node` as its stand-in. */
function hideKeptSpaces(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType !== Node.TEXT_NODE) {
      hideKeptSpaces(child);
      continue;
    }
    const text = child.textContent ?? "";
    const hidden = text.replace(KEPT_SPACE, (space) =>
      String.fromCharCode(FIRST_STAND_IN + KEPT_SPACES.indexOf(space))
    );
    if (hidden !== text) {
      child.textContent = hidden;
    }
  }
}

/** The stand-ins in `nodes` as the spaces they stand for. */
function restoreKeptSpaces(nodes: Descendant[]): Descendant[] {
  return nodes.map((node) =>
    ElementApi.isElement(node)
      ? { ...node, children: restoreKeptSpaces(node.children) }
      : {
          ...node,
          text: node.text.replace(
            STAND_IN,
            (standIn) =>
              KEPT_SPACES[standIn.charCodeAt(0) - FIRST_STAND_IN] ?? standIn
          ),
        }
  );
}

/**
 * Each text and line break on a span of its own, in the colour of its
 * innermost coloured span, as a browser paints it. Plate gives a leaf its
 * innermost colour only up to an element: a span around a link colours
 * every text in it, over the spans inside. Runs after the sanitiser, so
 * every `data-color` left is a token.
 */
function colourInnermost(root: HTMLElement): void {
  const coloured: [node: ChildNode, colour: string][] = [];
  const visit = (node: Node, colour: string | null): void => {
    for (const child of Array.from(node.childNodes)) {
      const element =
        child.nodeType === Node.ELEMENT_NODE ? (child as Element) : null;
      if (element === null || element.tagName === "BR") {
        if (colour !== null) {
          coloured.push([child, colour]);
        }
        continue;
      }
      const own =
        element.tagName === "SPAN" ? element.getAttribute("data-color") : null;
      if (own !== null) {
        element.removeAttribute("data-color");
      }
      visit(element, own ?? colour);
    }
  };
  visit(root, null);
  for (const [node, colour] of coloured) {
    const span = root.ownerDocument.createElement("span");
    span.setAttribute("data-color", colour);
    node.replaceWith(span);
    span.append(node);
  }
}

/** The parents a `<br>` with no text beside it stays a line break in. */
const LINE_BREAK_PARENTS: ReadonlySet<string> = new Set(["P", "SPAN"]);

/**
 * Plate makes a `<br>` with no text beside it a paragraph of its own unless
 * its parent is a `p` or a `span`, so a line break with marks of its own
 * (`<strong><br></strong>`), or one between marked runs in a heading or a
 * list item, would split its block. Wrapped in a span, each stays a line
 * break, as a browser shows it. One between top-level blocks is left to be
 * an empty paragraph.
 */
export function keepLineBreaks(root: HTMLElement): void {
  for (const br of Array.from(root.querySelectorAll("br"))) {
    const parent = br.parentElement;
    if (parent && parent !== root && !LINE_BREAK_PARENTS.has(parent.tagName)) {
      const span = br.ownerDocument.createElement("span");
      br.replaceWith(span);
      span.append(br);
    }
  }
}

/**
 * Each cell's lines in one paragraph, as Plate's table normaliser would
 * wrap them. Done here it costs nothing; done by the normaliser, one cell at
 * a time, it runs the list normaliser after every wrap: 20 ms for a 4×4
 * table.
 */
function cellParagraphs(root: HTMLElement): void {
  for (const cell of Array.from(root.querySelectorAll("td, th"))) {
    const paragraph = cell.ownerDocument.createElement("p");
    paragraph.append(...Array.from(cell.childNodes));
    cell.append(paragraph);
  }
}

/**
 * Stored body HTML as a normalised Plate value; never `[]`. The structure
 * step runs before the sanitiser, which would unwrap a `div` or a cell and
 * run its words into the next one's. Plate then reads the body as a browser
 * shows it: each text in its innermost colour, each line break kept, and
 * each kept space (U+00A0 and the like) as a stand-in it does not collapse.
 * A body that already holds a stand-in has its spaces read as Plate reads
 * them.
 */
export function htmlToValue(html: string): Value {
  const editor = createConversionEditor();
  const source = parseInert(html);
  structureBlocks(source);
  const element = parseInert(sanitizeRichBody(source.innerHTML));
  flattenListItems(element);
  cellParagraphs(element);
  colourInnermost(element);
  keepLineBreaks(element);
  const keepSpaces = !ANY_STAND_IN.test(element.textContent ?? "");
  if (keepSpaces) {
    hideKeptSpaces(element);
  }
  const nodes = deserializeHtml(editor, { element });
  editor.tf.setValue(
    asBlocks(editor, keepSpaces ? restoreKeptSpaces(nodes) : nodes)
  );
  editor.tf.normalize({ force: true });
  return editor.children.length > 0 ? editor.children : emptyValue();
}

// ── Plate value → HTML. Pure: only Plate's types and its span reads are
// used below. ──

/** A `Map`, so a type such as `constructor` cannot hit a prototype key. */
const BLOCK_TAGS: ReadonlyMap<string, string> = new Map([
  ["blockquote", "blockquote"],
  ["h2", "h2"],
  ["h3", "h3"],
  ["p", "p"],
]);

/** Outermost first, inside the colour span. */
const MARKS: [mark: string, tag: string][] = [
  ["bold", "strong"],
  ["italic", "em"],
  ["underline", "u"],
  ["strikethrough", "s"],
];

const escapeText = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const escapeAttribute = (value: string): string =>
  escapeText(value).replaceAll('"', "&quot;");

const isText = (node: Descendant): node is TText =>
  typeof (node as TText).text === "string";

const textOf = (node: Descendant): string =>
  isText(node) ? node.text : node.children.map(textOf).join("");

/** Text in the tags its leaves share, outermost first in `open`. */
interface Run {
  close: string;
  open: string;
  text: string;
}

/** A link with its href as it is written. */
interface Link {
  children: Descendant[];
  href: string;
}

/**
 * A leaf's text in its tags: the colour span (a token the sanitisers keep,
 * or none), then `strong > em > u > s`.
 */
function leafRun(leaf: TText): Run {
  let open = "";
  let close = "";
  const wrap = (start: string, end: string): void => {
    open += start;
    close = `${end}${close}`;
  };
  const color =
    typeof leaf.color === "string" ? keptColourToken(leaf.color) : null;
  if (color !== null) {
    wrap(`<span data-color="${color}">`, "</span>");
  }
  for (const [mark, tag] of MARKS) {
    if (leaf[mark]) {
      wrap(`<${tag}>`, `</${tag}>`);
    }
  }
  return { close, open, text: leaf.text };
}

/** The href a node is written with, or `null` when it is written as its text. */
function linkHref(node: TElement): string | null {
  const url = typeof node.url === "string" ? node.url.trim() : "";
  return node.type === "a" && SAFE_HREF.test(url) && textOf(node) !== ""
    ? url
    : null;
}

/**
 * The runs and links `nodes` are written as, in order. An empty leaf (Slate
 * keeps one beside a link) is nothing, so a mark it carries cannot leave an
 * empty `<strong></strong>` behind. A link without a safe href or any text,
 * and any inline inside a link, adds only its leaves.
 */
function inlinePieces(
  nodes: Descendant[],
  inLink: boolean,
  pieces: (Run | Link)[] = []
): (Run | Link)[] {
  for (const node of nodes) {
    if (isText(node)) {
      if (node.text !== "") {
        pieces.push(leafRun(node));
      }
      continue;
    }
    const href = inLink ? null : linkHref(node);
    if (href === null) {
      inlinePieces(node.children, inLink, pieces);
    } else {
      pieces.push({ children: node.children, href });
    }
  }
  return pieces;
}

/**
 * Inline nodes as HTML. Adjacent runs in the same tags are written as one,
 * as a re-parse reads them (a colour no sanitiser keeps and a link written
 * as text add no tags), so the output is already a fixed point.
 */
function inlineToHtml(nodes: Descendant[], inLink = false): string {
  const merged: (Run | Link)[] = [];
  for (const piece of inlinePieces(nodes, inLink)) {
    const last = merged.at(-1);
    if (last && "text" in last && "text" in piece && last.open === piece.open) {
      last.text += piece.text;
    } else {
      merged.push(piece);
    }
  }
  return merged
    .map((piece) =>
      "text" in piece
        ? `${piece.open}${escapeText(piece.text).replaceAll("\n", "<br>")}${piece.close}`
        : `<a href="${escapeAttribute(piece.href)}">${inlineToHtml(piece.children, true)}</a>`
    )
    .join("");
}

const isRow = (node: Descendant): node is TElement =>
  !isText(node) && node.type === "tr";

const isCell = (node: Descendant): node is TElement =>
  !isText(node) && TABLE_CELL_TYPES.includes(node.type);

/** A span as it is written: 2 to 20, or 1 where the sanitisers drop it. */
const writtenSpan = (span: number): number =>
  Number(keptCellSpan(String(span)) ?? 1);

function spanAttribute(name: string, span: number): string {
  const written = writtenSpan(span);
  return written > 1 ? ` ${name}="${written}"` : "";
}

/**
 * A cell with its spans, by Plate's own reading of them (a merge writes
 * `colSpan`, a parse `attributes.colspan`). Its lines are its blocks' inline
 * HTML joined by `<br>`; an empty line goes, an empty cell stays.
 */
function cellToHtml(cell: TElement): string {
  const tag = cell.type === "th" ? "th" : "td";
  const spans =
    spanAttribute("colspan", getColSpan(cell)) +
    spanAttribute("rowspan", getRowSpan(cell));
  const lines = cell.children
    .filter((line) => textOf(line).trim() !== "")
    .map((line) => inlineToHtml(isText(line) ? [line] : line.children));
  return `<${tag}${spans}>${lines.join("<br>")}</${tag}>`;
}

const rowToHtml = (cells: TElement[]): string =>
  `<tr>${cells.map(cellToHtml).join("")}</tr>`;

/**
 * How many leading rows make the header: the longest run of rows whose cells
 * are all `th` that no cell's row span reaches past. A browser ends a row
 * span at the end of its row group, so a header that cut one would shift
 * the cells below it.
 */
function headerRowCount(rows: TElement[][]): number {
  let leading = 0;
  while (rows[leading]?.every((cell) => cell.type === "th")) {
    leading += 1;
  }
  const spansFit = (count: number): boolean =>
    rows
      .slice(0, count)
      .every((cells, row) =>
        cells.every((cell) => row + writtenSpan(getRowSpan(cell)) <= count)
      );
  let count = leading;
  while (count > 0 && !spansFit(count)) {
    count -= 1;
  }
  return count;
}

/**
 * How many of `table`'s leading rows the page writes in its `<thead>`, by
 * `headerRowCount`. Shared with the canvas, which draws them there too.
 */
export const headerRows = (table: TElement): number =>
  headerRowCount(
    table.children.filter(isRow).map((row) => row.children.filter(isCell))
  );

/**
 * A table: its header group (`headerRowCount`) in `<thead>`, the other rows
 * in `<tbody>`. A row with no cell is nothing, and so is a table with no row.
 */
function tableToHtml(table: TElement): string {
  const rows = table.children
    .filter(isRow)
    .map((row) => row.children.filter(isCell))
    .filter((cells) => cells.length > 0);
  if (rows.length === 0) {
    return "";
  }
  const headerRows = headerRowCount(rows);
  const head = rows.slice(0, headerRows);
  const body = rows.slice(headerRows);
  const headHtml =
    head.length > 0 ? `<thead>${head.map(rowToHtml).join("")}</thead>` : "";
  const bodyHtml =
    body.length > 0 ? `<tbody>${body.map(rowToHtml).join("")}</tbody>` : "";
  return `<table>${headHtml}${bodyHtml}</table>`;
}

function blockToHtml(node: TElement): string {
  if (node.type === "hr") {
    return "<hr>";
  }
  if (node.type === "table") {
    return tableToHtml(node);
  }
  if (textOf(node).trim() === "") {
    return "";
  }
  const tag = BLOCK_TAGS.get(node.type) ?? "p";
  return `<${tag}>${inlineToHtml(node.children)}</${tag}>`;
}

interface OpenList {
  indent: number;
  tag: "ol" | "ul";
}

/** A block Plate's list plugin made a list item. Shared with the commands. */
export const isListItem = (
  node: TElement
): node is TElement & { listStyleType: string } =>
  typeof node.listStyleType === "string" && node.listStyleType !== "";

/**
 * Each block's list depth, by `effectiveDepths` over each run of adjacent
 * list items (any other block ends a run); 0 for a block that is no list item.
 * Shared with the paste plugin.
 */
export function listDepths(value: Value): number[] {
  const depths: number[] = [];
  let run: number[] = [];
  const endRun = (): void => {
    depths.push(...effectiveDepths(run));
    run = [];
  };
  for (const node of value) {
    if (isListItem(node)) {
      run.push(typeof node.indent === "number" ? node.indent : 1);
    } else {
      endRun();
      depths.push(0);
    }
  }
  endRun();
  return depths;
}

/**
 * Plate's indent lists (flat blocks carrying `listStyleType` and `indent`)
 * back to nested `<ul>`/`<ol>`. Unlike other blocks, an empty list item is
 * kept. Items nest by `effectiveDepths`, so an indent jump (Tab twice) goes
 * one level down and writes the same HTML a re-parse of it gives.
 */
export function valueToHtml(value: Value): string {
  const stack: OpenList[] = [];
  let html = "";
  const closeList = (): void => {
    html += `</li></${stack.pop()?.tag}>`;
  };
  const closeDeeperThan = (level: number): void => {
    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) > level) {
      closeList();
    }
  };
  const closeAll = (): void => {
    while (stack.length > 0) {
      closeList();
    }
  };

  const depths = listDepths(value);
  for (const [index, node] of value.entries()) {
    if (!isListItem(node)) {
      closeAll();
      html += blockToHtml(node);
      continue;
    }

    const { listStart, listStyleType } = node;
    const tag = ORDERED_LIST_STYLES.has(listStyleType) ? "ol" : "ul";
    const level = depths[index] ?? 1;
    closeDeeperThan(level);
    if (stack.at(-1)?.indent === level && stack.at(-1)?.tag !== tag) {
      closeList();
    }
    if (stack.at(-1)?.indent === level) {
      html += "</li><li>";
    } else {
      const start =
        tag === "ol" && typeof listStart === "number" && listStart > 1
          ? ` start="${listStart}"`
          : "";
      html += `<${tag}${start}><li>`;
      stack.push({ indent: level, tag });
    }
    // A heading or quote inside a list loses its block type.
    html += inlineToHtml(node.children);
  }

  closeAll();
  return html;
}
