// Plain data and pure rules, no DOM and no sanitize-html: the browser sanitiser
// (`lib/sanitize.ts`) and the server one (`editor/sanitize-doc.ts`) both read
// this, so the two cannot drift apart.

import {
  TEXT_COLOUR_TOKENS,
  type TextColourToken,
} from "@repo/shared/utils/text-colours";

/** What a legacy text item (`body[].text`) may hold. */
export const INLINE_TAGS: readonly string[] = [
  "b",
  "strong",
  "i",
  "em",
  "a",
  "br",
  "span",
];

/**
 * A table: an optional header row in `thead`, the other rows in `tbody`.
 * A caption, `tfoot` and `colgroup` are rewritten before a body is stored
 * (`rich/structure.ts`), so neither sanitiser keeps them.
 */
export const TABLE_TAGS: readonly string[] = [
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/** What a text block's HTML body may hold. */
export const BODY_TAGS: readonly string[] = [
  ...INLINE_TAGS,
  "p",
  "h2",
  "h3",
  "blockquote",
  "ul",
  "ol",
  "li",
  "hr",
  "u",
  "s",
  ...TABLE_TAGS,
];

/** The body tags that never hold content and are written without an end tag. */
export const VOID_BODY_TAGS: readonly string[] = ["br", "hr"];

/**
 * Removed together with their content: code, embedded documents, foreign
 * (SVG/MathML) markup, and the raw-text elements a browser parses
 * differently from htmlparser2.
 */
export const DROPPED_WITH_CONTENT: readonly string[] = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "textarea",
  "noscript",
  "template",
  "noembed",
  "noframes",
  "option",
  "xmp",
];

export const SAFE_HREF = /^(?:https?:|mailto:|tel:|[/#?.])/i;

/** `ol[start]`: one to four digits, no leading zero. A start of 1 is dropped as redundant. */
export const OL_START = /^[1-9]\d{0,3}$/;

/** `th`/`td` `colspan` and `rowspan`: 2 to 20, no leading zero. */
export const CELL_SPAN = /^(?:[2-9]|1\d|20)$/;

/** An attribute's value as a body tag keeps it, or `null` to drop it. */
export type AttributeRule = (value: string) => string | null;

/** `a[href]`: kept as written when `SAFE_HREF` accepts it trimmed. */
export function keptHref(value: string): string | null {
  return SAFE_HREF.test(value.trim()) ? value : null;
}

/** The `ol[start]` value worth keeping: valid and at least 2. */
export function keptOlStart(value: string): string | null {
  const trimmed = value.trim();
  return OL_START.test(trimmed) && Number(trimmed) >= 2 ? trimmed : null;
}

/**
 * A cell's `colspan` or `rowspan` worth keeping, trimmed: 2 to 20. A span of
 * 1 is redundant and goes, as does anything else.
 */
export function keptCellSpan(value: string): string | null {
  const trimmed = value.trim();
  return CELL_SPAN.test(trimmed) ? trimmed : null;
}

/**
 * `span[data-color]`: exactly one of the theme's colour tokens, once
 * trimmed. Case counts, so `ACCENT` is no token, and neither is a hex value.
 */
export function keptColourToken(value: string): TextColourToken | null {
  const trimmed = value.trim();
  return TEXT_COLOUR_TOKENS.find((token) => token === trimmed) ?? null;
}

/**
 * The attributes a body tag may keep, by tag, each with its rule. A tag not
 * listed keeps none. Both sanitisers apply these through `keptAttributes`.
 */
export const BODY_ATTRIBUTE_RULES: Readonly<
  Record<string, Readonly<Record<string, AttributeRule>>>
> = {
  a: { href: keptHref },
  ol: { start: keptOlStart },
  span: { "data-color": keptColourToken },
  th: { colspan: keptCellSpan, rowspan: keptCellSpan },
  td: { colspan: keptCellSpan, rowspan: keptCellSpan },
};

/** The attribute names `BODY_ATTRIBUTE_RULES` lets each tag keep. */
export const BODY_ATTRIBUTES: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    Object.entries(BODY_ATTRIBUTE_RULES).map(([tag, rules]) => [
      tag,
      Object.keys(rules),
    ])
  );

/**
 * What a body `tag` keeps of `attributes`: each value its rule keeps, under
 * the same name, in the rules' order. Everything else goes.
 */
export function keptAttributes(
  tag: string,
  attributes: Readonly<Record<string, string>>
): Record<string, string> {
  const kept: Record<string, string> = {};
  // Own keys only, so a tag such as `constructor` reads no prototype.
  const rules = Object.hasOwn(BODY_ATTRIBUTE_RULES, tag)
    ? BODY_ATTRIBUTE_RULES[tag]
    : {};
  for (const [name, rule] of Object.entries(rules)) {
    const value = Object.hasOwn(attributes, name)
      ? attributes[name]
      : undefined;
    const keptValue = value === undefined ? null : rule(value);
    if (keptValue !== null) {
      kept[name] = keptValue;
    }
  }
  return kept;
}
