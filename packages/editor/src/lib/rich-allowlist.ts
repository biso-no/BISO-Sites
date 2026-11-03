// Plain data, no DOM and no sanitize-html: the browser sanitiser
// (`lib/sanitize.ts`) and the server one (`editor/sanitize-doc.ts`) both read
// this, so the two cannot drift apart.

/** What a legacy text item (`body[].text`) may hold. */
export const INLINE_TAGS = ["b", "strong", "i", "em", "a", "br", "span"];

/** What a text block's HTML body may hold. */
export const BODY_TAGS = [
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
];

/**
 * Removed together with their content: code, embedded documents, foreign
 * (SVG/MathML) markup, and the raw-text elements a browser parses
 * differently from htmlparser2.
 */
export const DROPPED_WITH_CONTENT = [
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

/** The `ol[start]` value worth keeping: valid and at least 2. */
export function keptOlStart(value: string): string | null {
  const trimmed = value.trim();
  return OL_START.test(trimmed) && Number(trimmed) >= 2 ? trimmed : null;
}
