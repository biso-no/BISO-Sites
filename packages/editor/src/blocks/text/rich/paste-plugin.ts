import { type TextSwatch, textSwatches } from "@repo/shared/utils/text-colours";
import {
  createTSlatePlugin,
  KEYS,
  NodeApi,
  type PluginConfig,
  RangeApi,
  type SlateEditor,
  type TElement,
} from "platejs";
import { isListItem, listDepths } from "./html";
import {
  normalizePastedHtml,
  pastedImageCount,
  plainTextHasStructure,
  plainTextToHtml,
} from "./paste";

const HTML = "text/html";
const PLAIN = "text/plain";
/** What Plate puts on the clipboard when copying inside an editor. */
const SLATE_FRAGMENT = "application/x-slate-fragment";

/**
 * The clipboard with its `text/html` replaced (or added). Every other
 * format, `files` and the rest of the `DataTransfer` pass through.
 */
function withHtml(data: DataTransfer, html: string): DataTransfer {
  const types = data.types.includes(HTML) ? data.types : [...data.types, HTML];
  return new Proxy(data, {
    get(target, key) {
      if (key === "types") {
        return types;
      }
      if (key === "getData") {
        return (format: string) =>
          format.toLowerCase() === HTML ? html : target.getData(format);
      }
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * The list items in the runs from block `from` to block `to`, set to the
 * depth the save writes them at (`listDepths`). A pasted sublist keeps its
 * source's levels (Google Docs' `aria-level="2"`), and the first pasted
 * item can merge into the block the caret was in, so the canvas would show
 * an item deeper than the page stores it.
 */
function settleListDepths(editor: SlateEditor, from: number, to: number) {
  const blocks = editor.children;
  const isItem = (index: number): boolean => {
    const block = blocks[index];
    return block !== undefined && isListItem(block);
  };
  let start = from;
  while (isItem(start - 1)) {
    start -= 1;
  }
  let end = to;
  while (isItem(end + 1)) {
    end += 1;
  }
  const depths = listDepths(blocks.slice(start, end + 1));
  editor.tf.withoutNormalizing(() => {
    for (const [offset, depth] of depths.entries()) {
      if (depth > 0 && blocks[start + offset]?.indent !== depth) {
        editor.tf.setNodes({ indent: depth }, { at: [start + offset] });
      }
    }
  });
}

/**
 * The empty line a table was pasted into, removed. Plate puts a pasted table
 * after the block the caret is in, and the save drops an empty line, so the
 * canvas would show one the page never stores. Only a table the paste added
 * counts: `nextBefore` is the block that followed the line before the paste,
 * so a paste that added nothing leaves the line before a table the page
 * already had.
 */
function dropEmptyLineBeforeTable(
  editor: SlateEditor,
  index: number,
  nextBefore: TElement | undefined
): void {
  const block = editor.children[index];
  const next = editor.children[index + 1];
  const isEmptyLine =
    block !== undefined &&
    block.type !== KEYS.table &&
    !isListItem(block) &&
    NodeApi.string(block) === "";
  if (isEmptyLine && next?.type === KEYS.table && next !== nextBefore) {
    editor.tf.removeNodes({ at: [index] });
  }
}

export type RichPasteConfig = PluginConfig<
  "richPaste",
  {
    /** What pasted colours map to: the page theme's swatches. */
    swatches: readonly TextSwatch[];
    /**
     * How many pastes dropped an image so far. The field shows its notice
     * when this goes up.
     */
    imageNotices: number;
  }
>;

/**
 * Paste through the normaliser. An in-editor copy is inserted as it is;
 * pasted HTML is normalised first, its colours mapped to the `swatches`
 * option; plain text with line breaks or a list marker becomes HTML, so it
 * reaches the same deserializer and its bullets and numbers become lists. A
 * single plain line is inserted as it is. Then the pasted list items are put
 * at the depths the save writes, and an empty line a table was pasted into
 * goes. A paste with an image in it (HTML or a file) counts one
 * `imageNotices`; the paste itself is unchanged.
 */
export const RichPastePlugin = createTSlatePlugin<RichPasteConfig>({
  key: "richPaste",
  options: { imageNotices: 0, swatches: textSwatches(null) },
}).overrideEditor(({ editor, getOption, setOption, tf: { insertData } }) => {
  const insertNormalised = (data: DataTransfer): void => {
    if (data.types.includes(SLATE_FRAGMENT)) {
      insertData(data);
      return;
    }
    const html = data.getData(HTML);
    if (html) {
      insertData(
        withHtml(data, normalizePastedHtml(html, getOption("swatches")))
      );
      return;
    }
    const text = data.getData(PLAIN);
    insertData(
      plainTextHasStructure(text) ? withHtml(data, plainTextToHtml(text)) : data
    );
  };
  /** Whether the paste holds a picture the text will not keep. */
  const dropsImage = (data: DataTransfer): boolean => {
    const html = data.types.includes(SLATE_FRAGMENT) ? "" : data.getData(HTML);
    return (
      (html !== "" && pastedImageCount(html) > 0) ||
      Array.from(data.files ?? []).some((file) =>
        file?.type.startsWith("image/")
      )
    );
  };
  return {
    transforms: {
      insertData(data: DataTransfer) {
        if (dropsImage(data)) {
          setOption("imageNotices", getOption("imageNotices") + 1);
        }
        const from = editor.selection
          ? (RangeApi.start(editor.selection).path[0] ?? 0)
          : 0;
        const nextBefore = editor.children[from + 1];
        insertNormalised(data);
        dropEmptyLineBeforeTable(editor, from, nextBefore);
        const to = editor.selection
          ? (editor.selection.focus.path[0] ?? from)
          : editor.children.length - 1;
        settleListDepths(editor, from, to);
      },
    },
  };
});
