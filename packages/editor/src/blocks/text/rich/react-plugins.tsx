import { AutoformatPlugin, type AutoformatRule } from "@platejs/autoformat";
import {
  BlockquotePlugin,
  BoldPlugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { toggleList } from "@platejs/list";
import { ListPlugin } from "@platejs/list/react";
import { type AnySlatePlugin, KEYS } from "platejs";
import {
  type AnyPlatePlugin,
  ParagraphPlugin,
  PlateElement,
  type PlateElementProps,
} from "platejs/react";
import { SAFE_HREF } from "@/lib/rich-allowlist";
import { ORDERED_LIST_STYLES } from "./list-item-parse";
import { RichPastePlugin } from "./paste-plugin";
import { LIST_TARGETS, linkHtmlParse, listItemHtmlParse } from "./plugins";

type BlockTag = "blockquote" | "h2" | "h3" | "p";

/** Plate's attributes without the `slate-<type>` class it adds. */
const plainAttributes = ({ attributes }: PlateElementProps) => ({
  ...attributes,
  className: undefined,
});

/**
 * A block as its plain tag, so the canvas wears the public classes. A list
 * block is its own `<ul>`/`<ol start>` + `<li>`, one per item as in Plate's
 * block list, and Plate's indent margin nests it. The list is the block's
 * tag, not a `belowNodes` wrapper inside it: a `<ul>` inside a `<p>` is
 * invalid HTML, and the public classes space top-level `ul + ul` like one
 * list. In a list a heading or quote shows as a plain item, as it is saved.
 */
const blockElement = (tag: BlockTag) =>
  function BlockElement(props: PlateElementProps) {
    const attributes = plainAttributes(props);
    const { listStart, listStyleType } = props.element;
    if (typeof listStyleType !== "string" || listStyleType === "") {
      return <PlateElement {...props} as={tag} attributes={attributes} />;
    }
    if (!ORDERED_LIST_STYLES.has(listStyleType)) {
      return (
        <PlateElement {...props} as="ul" attributes={attributes}>
          <li>{props.children}</li>
        </PlateElement>
      );
    }
    const start = typeof listStart === "number" ? listStart : undefined;
    return (
      <PlateElement {...props} as="ol" attributes={{ ...attributes, start }}>
        <li>{props.children}</li>
      </PlateElement>
    );
  };

const ParagraphElement = blockElement("p");
const H2Element = blockElement("h2");
const H3Element = blockElement("h3");
const BlockquoteElement = blockElement("blockquote");

/** A void: the rule is not editable; Slate's spacer follows it. */
function HrElement(props: PlateElementProps) {
  return (
    <PlateElement {...props} attributes={plainAttributes(props)}>
      <hr contentEditable={false} />
      {props.children}
    </PlateElement>
  );
}

/**
 * The stored `href` by the sanitisers' rule, not Plate's URL check, so the
 * field links what the page will link.
 */
function LinkElement(props: PlateElementProps) {
  const url = typeof props.element.url === "string" ? props.element.url : "";
  const href = SAFE_HREF.test(url.trim()) ? url.trim() : undefined;
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{ ...plainAttributes(props), href }}
    />
  );
}

/** Plate's own list wrapper (inline-styled) off: `blockElement` draws lists. */
const noListWrapper = () => undefined;

/**
 * `- ` or `* ` starts a bullet list, `1. ` or `1) ` a numbered one. `type`
 * is the block a rule must not already be inside; no block is a `list`.
 */
const LIST_RULES: AutoformatRule[] = [
  {
    format: (editor) => toggleList(editor, { listStyleType: KEYS.ul }),
    match: ["- ", "* "],
    mode: "block",
    type: KEYS.list,
  },
  {
    format: (editor) => toggleList(editor, { listStyleType: KEYS.ol }),
    match: ["1. ", "1) "],
    mode: "block",
    type: KEYS.list,
  },
];

/**
 * `richBasePlugins` one-for-one with the React plugins, plus autoformat and
 * the paste normaliser. `RichPastePlugin` comes last: Plate orders plugins
 * by priority, core plugins first, and each `insertData` override wraps the
 * ones before it. At the default priority the normaliser is outermost, so it
 * sees the clipboard before Plate's own HTML parser does.
 */
export const richReactPlugins: (AnyPlatePlugin | AnySlatePlugin)[] = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H2Plugin.withComponent(H2Element),
  H3Plugin.withComponent(H3Element),
  BlockquotePlugin.withComponent(BlockquoteElement),
  HorizontalRulePlugin.withComponent(HrElement),
  // Plate's defaults: mod+b, mod+i, mod+u.
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  LinkPlugin.withComponent(LinkElement).extend({
    parsers: { html: { deserializer: { parse: linkHtmlParse } } },
  }),
  IndentPlugin.configure({ inject: { targetPlugins: LIST_TARGETS } }),
  ListPlugin.configure({
    inject: { targetPlugins: LIST_TARGETS },
    render: { belowNodes: noListWrapper },
  }).extend({
    parsers: { html: { deserializer: { parse: listItemHtmlParse } } },
  }),
  AutoformatPlugin.configure({ options: { rules: LIST_RULES } }),
  RichPastePlugin,
];
