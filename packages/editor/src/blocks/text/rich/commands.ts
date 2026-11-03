import { unwrapLink, upsertLink } from "@platejs/link";
import { indentList, outdentList, toggleList } from "@platejs/list";
import {
  ElementApi,
  KEYS,
  type NodeEntry,
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

/** The style of the block at the selection; any other block reads as `p`. */
export function currentStyle(editor: SlateEditor): RichStyle {
  const type = selectedBlocks(editor)[0]?.[0].type;
  return isStyle(type) ? type : "p";
}

/**
 * Gives every styled block in the selection `style`. Only the type changes,
 * so a list item stays a list item; a rule (`hr`) is left alone.
 */
export function setStyle(editor: SlateEditor, style: RichStyle): void {
  editor.tf.setNodes(
    { type: style },
    {
      match: (node) => ElementApi.isElement(node) && isStyle(node.type),
      mode: "lowest",
    }
  );
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
 * other kind, or (when they already are one) back into plain blocks.
 */
export function toggleRichList(
  editor: SlateEditor,
  kind: "disc" | "decimal"
): void {
  toggleList(editor, { listStyleType: kind });
}

/**
 * Tab nests the selected list items one level, Shift+Tab takes them one
 * level out. `false` (nothing done) unless every selected block is a list
 * item, so Tab elsewhere leaves the key to the browser. A nested item keeps
 * its kind: `indentList` would make it a bullet otherwise.
 */
export function handleListTab(
  editor: SlateEditor,
  { shift }: { shift: boolean }
): boolean {
  const blocks = selectedBlocks(editor).map(([node]) => node);
  const [first] = blocks;
  if (!(first && isListItem(first) && blocks.every(isListItem))) {
    return false;
  }
  if (shift) {
    outdentList(editor);
  } else {
    indentList(editor, { listStyleType: first.listStyleType });
  }
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
