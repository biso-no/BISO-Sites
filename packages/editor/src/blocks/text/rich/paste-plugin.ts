import { createSlatePlugin } from "platejs";
import {
  normalizePastedHtml,
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
 * Paste through the normaliser. An in-editor copy is inserted as it is;
 * pasted HTML is normalised first; plain text with line breaks or a list
 * marker becomes HTML, so it reaches the same deserializer and its bullets
 * and numbers become lists. A single plain line is inserted as it is.
 */
export const RichPastePlugin = createSlatePlugin({
  key: "richPaste",
}).overrideEditor(({ tf: { insertData } }) => ({
  transforms: {
    insertData(data: DataTransfer) {
      if (data.types.includes(SLATE_FRAGMENT)) {
        insertData(data);
        return;
      }
      const html = data.getData(HTML);
      if (html) {
        insertData(withHtml(data, normalizePastedHtml(html)));
        return;
      }
      const text = data.getData(PLAIN);
      insertData(
        plainTextHasStructure(text)
          ? withHtml(data, plainTextToHtml(text))
          : data
      );
    },
  },
}));
