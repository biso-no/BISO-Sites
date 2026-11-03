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
import { SAFE_HREF } from "@/lib/rich-allowlist";
import { parseInert, sanitizeRichBody } from "@/lib/sanitize";
import { LIST_TAGS, ORDERED_LIST_STYLES } from "./list-item-parse";
import { richBasePlugins } from "./plugins";

/** A headless editor on the rich text schema, for conversion and paste. */
export function createConversionEditor(
  extraPlugins: AnySlatePlugin[] = []
): SlateEditor {
  return createSlateEditor({
    // Plate adds a random `id` to every block unless NODE_ENV is "test";
    // the same HTML must always give the same value.
    nodeId: false,
    plugins: [...richBasePlugins, ...extraPlugins],
  });
}

const emptyValue = (): Value => [{ type: "p", children: [{ text: "" }] }];

const LI_BLOCK_TAGS = new Set(["BLOCKQUOTE", "H2", "H3", "HR", "P"]);

/**
 * Each `<li>`'s nested lists moved to just after it, and its block children
 * unwrapped, so every item deserializes as one flat block and keeps its
 * depth as its count of list ancestors. `BaseListPlugin` does the same to
 * pasted HTML, but `deserializeHtml` alone does not, and the nested item's
 * text would end up inside its parent item.
 */
function flattenListItems(root: HTMLElement): void {
  for (const li of Array.from(root.querySelectorAll("li"))) {
    let anchor: Element = li;
    for (const child of Array.from(li.children)) {
      if (LIST_TAGS.has(child.tagName)) {
        anchor.after(child);
        anchor = child;
      } else if (LI_BLOCK_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
      }
    }
  }
}

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

/** Stored body HTML as a normalised Plate value; never `[]`. */
export function htmlToValue(html: string): Value {
  const editor = createConversionEditor();
  const element = parseInert(sanitizeRichBody(html));
  flattenListItems(element);
  editor.tf.setValue(asBlocks(editor, deserializeHtml(editor, { element })));
  editor.tf.normalize({ force: true });
  return editor.children.length > 0 ? editor.children : emptyValue();
}

// ── Plate value → HTML. Pure: only Plate's types are used below. ──

/** A `Map`, so a type such as `constructor` cannot hit a prototype key. */
const BLOCK_TAGS: ReadonlyMap<string, string> = new Map([
  ["blockquote", "blockquote"],
  ["h2", "h2"],
  ["h3", "h3"],
  ["p", "p"],
]);

/** Outermost first. */
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

/**
 * An empty leaf (Slate keeps one beside a link) prints nothing, so a mark it
 * carries cannot leave an empty `<strong></strong>` behind.
 */
function leafToHtml(leaf: TText): string {
  if (leaf.text === "") {
    return "";
  }
  let open = "";
  let close = "";
  for (const [mark, tag] of MARKS) {
    if (leaf[mark]) {
      open += `<${tag}>`;
      close = `</${tag}>${close}`;
    }
  }
  return `${open}${escapeText(leaf.text).replaceAll("\n", "<br>")}${close}`;
}

function inlineToHtml(nodes: Descendant[]): string {
  let html = "";
  for (const node of nodes) {
    if (isText(node)) {
      html += leafToHtml(node);
      continue;
    }
    const inner = inlineToHtml(node.children);
    const url = typeof node.url === "string" ? node.url.trim() : "";
    const isLink = node.type === "a" && SAFE_HREF.test(url) && inner !== "";
    html += isLink ? `<a href="${escapeAttribute(url)}">${inner}</a>` : inner;
  }
  return html;
}

function blockToHtml(node: TElement): string {
  if (node.type === "hr") {
    return "<hr>";
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

/**
 * Plate's indent lists (flat blocks carrying `listStyleType` and `indent`)
 * back to nested `<ul>`/`<ol>`. Unlike other blocks, an empty list item is
 * kept. An item sits at most one level below the innermost open list, so an
 * indent jump (Tab twice) writes the same HTML a re-parse of it gives.
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

  for (const node of value) {
    const { indent, listStart, listStyleType } = node;
    if (typeof listStyleType !== "string" || listStyleType === "") {
      closeAll();
      html += blockToHtml(node);
      continue;
    }

    const tag = ORDERED_LIST_STYLES.has(listStyleType) ? "ol" : "ul";
    const openDepth = stack.at(-1)?.indent ?? 0;
    const level = Math.min(
      typeof indent === "number" ? indent : 1,
      openDepth + 1
    );
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
