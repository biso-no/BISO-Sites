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
import { type AnySlatePlugin, createSlatePlugin, KEYS } from "platejs";
import { keptColourToken, SAFE_HREF } from "@/lib/rich-allowlist";
import { parseListItem } from "./list-item-parse";

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
];
