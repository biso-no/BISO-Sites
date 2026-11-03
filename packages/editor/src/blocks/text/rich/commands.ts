import { unwrapLink, upsertLink } from "@platejs/link";
import { indentList, outdentList, toggleList } from "@platejs/list";
import {
  ElementApi,
  KEYS,
  type NodeEntry,
  type Path,
  PathApi,
  type SlateEditor,
  type TElement,
} from "platejs";
import { SAFE_HREF } from "@/lib/rich-allowlist";
import { isListItem } from "./html";
import { ORDERED_LIST_STYLES } from "./list-item-parse";

// What the toolbar, the bubble and the keys do to the editor. Plain functions
// on any Slate editor, so they run on the headless conversion editor in tests.

export type RichStyle = "h2" | "h3" | "p" | "blockquote";

/** The text styles, in the order the toolbar lists them. */
export const STYLE_LABELS: Record<RichStyle, string> = {
  h2: "Heading",
  h3: "Subheading",
  p: "Paragraph",
  blockquote: "Quote",
};

const isStyle = (type: unknown): type is RichStyle =>
  typeof type === "string" && Object.hasOwn(STYLE_LABELS, type);

export type RichMark = "bold" | "italic" | "underline" | "strikethrough";

/** The lowest blocks the selection touches, first to last. */
const selectedBlocks = (editor: SlateEditor): NodeEntry<TElement>[] =>
  editor.selection
    ? [...editor.api.nodes<TElement>({ block: true, mode: "lowest" })]
    : [];

/** A block the style select can change; not a rule (`hr`) or a link. */
const STYLED = {
  match: (node: unknown) => ElementApi.isElement(node) && isStyle(node.type),
  mode: "lowest",
} as const;

/** What makes a block a list item, all of it. */
const LIST_PROPS = [
  KEYS.listType,
  KEYS.indent,
  KEYS.listStart,
  KEYS.listRestart,
  KEYS.listRestartPolite,
];

/**
 * The style of the block at the selection. A list item reads as `p`, since
 * the page stores every list item as plain text; any other block does too.
 */
export function currentStyle(editor: SlateEditor): RichStyle {
  const node = selectedBlocks(editor)[0]?.[0];
  if (!node || isListItem(node)) {
    return "p";
  }
  return isStyle(node.type) ? node.type : "p";
}

/**
 * Gives every styled block in the selection `style`. Paragraph keeps a list
 * item in its list; a heading, subheading or quote takes it out, since the
 * page has no heading inside a list. A rule (`hr`) is left alone.
 */
export function setStyle(editor: SlateEditor, style: RichStyle): void {
  editor.tf.withoutNormalizing(() => {
    editor.tf.setNodes({ type: style }, STYLED);
    if (style !== "p") {
      editor.tf.unsetNodes(LIST_PROPS, STYLED);
    }
  });
}

export function isMarkActive(editor: SlateEditor, mark: RichMark): boolean {
  return editor.api.hasMark(mark);
}

export function toggleRichMark(editor: SlateEditor, mark: RichMark): void {
  editor.tf.toggleMark(mark);
}

/** The list kind of the block at the selection, or `null` outside a list. */
export function activeList(editor: SlateEditor): "disc" | "decimal" | null {
  const node = selectedBlocks(editor)[0]?.[0];
  if (!(node && isListItem(node))) {
    return null;
  }
  return ORDERED_LIST_STYLES.has(node.listStyleType) ? "decimal" : "disc";
}

/**
 * Makes the selected blocks a `kind` list, switches them to it from the
 * other kind, or (when they already are one) back into plain blocks. A
 * heading or quote becomes a paragraph first: the page stores list items as
 * plain text.
 */
export function toggleRichList(
  editor: SlateEditor,
  kind: "disc" | "decimal"
): void {
  editor.tf.withoutNormalizing(() => {
    editor.tf.setNodes({ type: KEYS.p }, STYLED);
    toggleList(editor, { listStyleType: kind });
  });
}

/** A list item's depth; Plate's lists start at 1. */
const depthOf = (node: TElement): number =>
  typeof node.indent === "number" ? node.indent : 1;

/** The block at `path`, if there is one. */
const blockAt = (editor: SlateEditor, path: Path | undefined) =>
  path ? editor.api.node<TElement>(path)?.[0] : undefined;

/**
 * Whether the first selected item can go one level deeper: only under the
 * item just before it, and never more than one level below that item. Any
 * deeper and the page would store it shallower than the editor shows it.
 */
function canNest(editor: SlateEditor, [first, path]: NodeEntry<TElement>) {
  const previous = blockAt(editor, PathApi.previous(path));
  return Boolean(
    previous && isListItem(previous) && depthOf(first) <= depthOf(previous)
  );
}

/**
 * The items after the selection that sit under its first item: the run of
 * list items deeper than it. They come out one level with it.
 */
function subItems(
  editor: SlateEditor,
  firstDepth: number,
  lastPath: Path
): NodeEntry<TElement>[] {
  const items: NodeEntry<TElement>[] = [];
  let path = PathApi.next(lastPath);
  let node = blockAt(editor, path);
  while (node && isListItem(node) && depthOf(node) > firstDepth) {
    items.push([node, path]);
    path = PathApi.next(path);
    node = blockAt(editor, path);
  }
  return items;
}

/**
 * Tab nests the selected list items one level, Shift+Tab takes them, and
 * the sub-items of the first, one level out. `false` (nothing done) unless
 * every selected block is a list item, so Tab elsewhere leaves the key to
 * the browser. Where the first item cannot nest (see `canNest`) Tab still
 * returns `true` and changes nothing, so focus stays in the field. A nested
 * item keeps its kind: `indentList` would make it a bullet otherwise.
 */
export function handleListTab(
  editor: SlateEditor,
  { shift }: { shift: boolean }
): boolean {
  const entries = selectedBlocks(editor);
  const firstEntry = entries[0];
  const lastEntry = entries.at(-1);
  if (!(firstEntry && lastEntry)) {
    return false;
  }
  const [first] = firstEntry;
  if (!(isListItem(first) && entries.every(([node]) => isListItem(node)))) {
    return false;
  }
  if (!shift) {
    if (canNest(editor, firstEntry)) {
      indentList(editor, { listStyleType: first.listStyleType });
    }
    return true;
  }
  const following = subItems(editor, depthOf(first), lastEntry[1]);
  editor.tf.withoutNormalizing(() => {
    outdentList(editor);
    for (const [node, path] of following) {
      editor.tf.setNodes({ indent: depthOf(node) - 1 }, { at: path });
    }
  });
  return true;
}

/** A bare domain with an optional path: `biso.no`, `www.biso.no/events`. */
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/;

/**
 * The address a typed link stores, or `null` when the page would not keep
 * it. A bare domain gets `https://`; the result must pass `SAFE_HREF`, the
 * sanitisers' rule.
 */
export function normalizeHref(input: string): string | null {
  const trimmed = input.trim();
  const href = BARE_DOMAIN.test(trimmed) ? `https://${trimmed}` : trimmed;
  return SAFE_HREF.test(href) ? href : null;
}

/** The address of the first link in the selection, or `null`. */
export function linkUrl(editor: SlateEditor): string | null {
  if (!editor.selection) {
    return null;
  }
  const [entry] = editor.api.nodes<TElement>({ match: { type: KEYS.link } });
  const url = entry?.[0].url;
  return typeof url === "string" ? url : null;
}

/**
 * Links the selection to `url` (normalised), or changes the address of the
 * link at the caret; `null` removes the link. An address `normalizeHref`
 * refuses changes nothing. `SAFE_HREF` has already checked it, so Plate's
 * own URL check (which refuses `tel:` and `./x`) is skipped.
 */
export function applyLink(editor: SlateEditor, url: string | null): void {
  if (url === null) {
    unwrapLink(editor);
    return;
  }
  const href = normalizeHref(url);
  if (href !== null) {
    upsertLink(editor, { skipValidation: true, url: href });
  }
}
