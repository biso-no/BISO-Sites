import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseHorizontalRulePlugin,
  BaseItalicPlugin,
  BaseStrikethroughPlugin,
  BaseUnderlinePlugin,
} from "@platejs/basic-nodes";
import { BaseIndentPlugin } from "@platejs/indent";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import {
  BaseTablePlugin,
  computeCellIndices,
  getColSpan,
  getRowSpan,
} from "@platejs/table";
import {
  type AnySlatePlugin,
  createSlatePlugin,
  ElementApi,
  KEYS,
  NodeApi,
  type NodeEntry,
  type SlateEditor,
  type TElement,
} from "platejs";
import { keptColourToken, SAFE_HREF } from "@/lib/rich-allowlist";
import { parseListItem } from "./list-item-parse";
import { RichTableEdgesPlugin } from "./table-edges";
import { type GridCell, TABLE_CELL_TYPES, tableGrid } from "./table-grid";

/**
 * The blocks that can be indented and become list items. Shared with the
 * React plugin list.
 */
export const LIST_TARGETS = [KEYS.p, KEYS.h2, KEYS.h3, KEYS.blockquote];

/**
 * An `<a>` read with the sanitisers' `SAFE_HREF` rule. Plate's own check
 * rejects `tel:`, `?q=1` and `./x`, which both sanitisers keep, so such a
 * link would vanish on the next edit. Shared with the React plugin list.
 */
export const linkHtmlParse = ({
  element,
  type,
}: {
  element: HTMLElement;
  type: string;
}): { type: string; url: string } | undefined => {
  const url = element.getAttribute("href")?.trim() ?? "";
  return SAFE_HREF.test(url) ? { type, url } : undefined;
};

/** The `<li>` parse, shared with the React plugin list. */
export const listItemHtmlParse = ({ element }: { element: HTMLElement }) =>
  parseListItem(element);

/**
 * Text colour, stored as `<span data-color="TOKEN">` and held as the leaf's
 * `color`. A span is read with the sanitisers' rule: a token they would
 * drop gives no colour, and the span is plain text. Where coloured spans
 * nest, Plate gives each text its innermost colour, except through a link
 * (`htmlToValue` sees to that case).
 */
export const RichColourPlugin = createSlatePlugin({
  key: "color",
  node: { isLeaf: true },
  parsers: {
    html: {
      deserializer: {
        isLeaf: true,
        parse: ({ element }) => {
          const color = keptColourToken(
            element.getAttribute("data-color") ?? ""
          );
          return color === null ? undefined : { color };
        },
        rules: [{ validAttribute: "data-color", validNodeName: "SPAN" }],
      },
    },
  },
});

/** Table structure, which Plate's own table normaliser puts in order. */
const TABLE_TYPES: ReadonlySet<string> = new Set([
  KEYS.table,
  KEYS.tr,
  ...TABLE_CELL_TYPES,
]);

/** What makes a block a list item. A cell's line keeps none of it. */
const LIST_PROPS = [
  KEYS.listType,
  KEYS.indent,
  KEYS.listStart,
  KEYS.listRestart,
  KEYS.listRestartPolite,
  KEYS.listChecked,
];

/** Blocks the caret cannot get past at the end of the value. */
const NO_LAST_BLOCK: ReadonlySet<string> = new Set([KEYS.table, KEYS.hr]);

/**
 * An empty paragraph after a table or a divider at the end of the value.
 * Whether it changed anything.
 */
function endWithParagraph(editor: SlateEditor): boolean {
  const last = editor.children.at(-1);
  if (!(last && NO_LAST_BLOCK.has(last.type))) {
    return false;
  }
  editor.tf.insertNodes(
    { type: KEYS.p, children: [{ text: "" }] },
    { at: [editor.children.length] }
  );
  return true;
}

/**
 * A block in a cell as a plain paragraph: no heading, quote or list item,
 * and no divider. Whether it changed anything.
 */
function plainCellLine(
  editor: SlateEditor,
  [node, path]: NodeEntry<TElement>
): boolean {
  const parent = NodeApi.parent(editor, path);
  if (
    !(ElementApi.isElement(parent) && TABLE_CELL_TYPES.includes(parent.type))
  ) {
    return false;
  }
  if (node.type === KEYS.hr) {
    editor.tf.removeNodes({ at: path });
    return true;
  }
  const listProps = LIST_PROPS.filter((key) => key in node);
  if (node.type === KEYS.p && listProps.length === 0) {
    return false;
  }
  editor.tf.withoutNormalizing(() => {
    editor.tf.setNodes({ type: KEYS.p }, { at: path });
    editor.tf.unsetNodes(listProps, { at: path });
  });
  return true;
}

/** An empty cell, as the grid adds one. */
const emptyCell = (type: string): TElement => ({
  type,
  children: [{ type: KEYS.p, children: [{ text: "" }] }],
});

/** The props that give `cell` the spans `to` has: none for a span of 1. */
function spanProps(cell: TElement, to: GridCell): Record<string, unknown> {
  const {
    colspan: _colspan,
    rowspan: _rowspan,
    ...attributes
  } = (cell.attributes as Record<string, unknown> | undefined) ?? {};
  return {
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    colSpan: to.colSpan > 1 ? to.colSpan : undefined,
    rowSpan: to.rowSpan > 1 ? to.rowSpan : undefined,
  };
}

/**
 * A table held to its whole grid (`tableGrid`): rows with no cell go, spans
 * shrink to fit, and short rows get empty cells. A table with no cell goes.
 * Whether it changed anything.
 */
function wholeTable(
  editor: SlateEditor,
  [table, path]: NodeEntry<TElement>
): boolean {
  const { rows } = tableGrid(table);
  if (rows.length === 0) {
    editor.tf.removeNodes({ at: path });
    return true;
  }
  const kept = new Set(rows.map((row) => row.index));
  const gone = table.children.flatMap((row, index) =>
    ElementApi.isElement(row) && row.type === KEYS.tr && !kept.has(index)
      ? [index]
      : []
  );
  const respan = rows.flatMap((row) =>
    row.cells.filter(
      (cell) =>
        cell.cell !== null &&
        (getColSpan(cell.cell) !== cell.colSpan ||
          getRowSpan(cell.cell) !== cell.rowSpan)
    )
  );
  const added = rows.some((row) => row.cells.some((cell) => !cell.cell));
  if (gone.length === 0 && respan.length === 0 && !added) {
    return false;
  }
  const rowPath = (index: number): number[] => [
    ...path,
    index - gone.filter((goneIndex) => goneIndex < index).length,
  ];
  editor.tf.withoutNormalizing(() => {
    for (const index of [...gone].reverse()) {
      editor.tf.removeNodes({ at: [...path, index] });
    }
    for (const row of rows) {
      for (const cell of row.cells) {
        if (cell.cell && respan.includes(cell)) {
          editor.tf.setNodes(spanProps(cell.cell, cell), {
            at: [...rowPath(row.index), cell.index],
          });
        }
      }
      // From the right, so each index still holds.
      for (const cell of row.cells.filter((c) => !c.cell).reverse()) {
        editor.tf.insertNodes(emptyCell(cell.type), {
          at: [...rowPath(row.index), cell.index],
        });
      }
    }
  });
  // Plate keeps each cell's place in the grid; a span alone does not redo it.
  const node = editor.api.node<TElement>(path)?.[0];
  if (node) {
    computeCellIndices(editor, { tableNode: node });
  }
  return true;
}

/**
 * The shape the page can store, kept as the value changes:
 * - a block in a cell is a plain paragraph, one line of the cell, as the
 *   serializer writes it: a heading, quote or list item there becomes one,
 *   and a divider goes. Rows, cells and a table inside a cell are left to
 *   Plate's own table normaliser;
 * - the value never ends with a table or a divider, so there is always a
 *   line to type below one. That empty paragraph is never saved;
 * - a table is a whole grid (`wholeTable`), after every change: a row or
 *   column command can leave a row with no cell or a span past the edge.
 */
export const RichShapePlugin = createSlatePlugin({
  key: "richShape",
}).overrideEditor(({ editor, tf: { normalizeNode } }) => ({
  transforms: {
    normalizeNode(entry, options) {
      const [node, path] = entry;
      const isLine =
        path.length > 0 &&
        ElementApi.isElement(node) &&
        !(TABLE_TYPES.has(node.type) || editor.api.isInline(node));
      const isTable = ElementApi.isElement(node) && node.type === KEYS.table;
      let changed = false;
      if (path.length === 0) {
        changed = endWithParagraph(editor);
      } else if (isTable) {
        changed = wholeTable(editor, [node, path]);
      } else if (isLine) {
        changed = plainCellLine(editor, [node, path]);
      }
      if (!changed) {
        normalizeNode(entry, options);
      }
    },
  },
}));

/**
 * The rich text schema without React: what conversion and paste run on.
 * The paragraph is core's default; there is no h1 or h4–h6.
 */
export const richBasePlugins: AnySlatePlugin[] = [
  BaseH2Plugin,
  BaseH3Plugin,
  BaseBlockquotePlugin,
  BaseHorizontalRulePlugin,
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseStrikethroughPlugin,
  BaseLinkPlugin.extend({
    parsers: { html: { deserializer: { parse: linkHtmlParse } } },
  }),
  BaseIndentPlugin.configure({ inject: { targetPlugins: LIST_TARGETS } }),
  BaseListPlugin.configure({
    inject: { targetPlugins: LIST_TARGETS },
  }).extend({
    parsers: { html: { deserializer: { parse: listItemHtmlParse } } },
  }),
  RichColourPlugin,
  // Tables sit flush with the text; there is no margin control.
  BaseTablePlugin.configure({ options: { disableMarginLeft: true } }),
  RichShapePlugin,
  // After the table plugin, so its deletes wrap the table's own.
  RichTableEdgesPlugin,
];
