import type { Value } from "platejs";
import { valueToHtml } from "./html";

/**
 * The HTML a change should report, or `null` when it is the HTML the field
 * last reported or took (a selection move, or the change `setValue` causes).
 */
export function htmlToEmit(value: Value, lastHtml: string): string | null {
  const html = valueToHtml(value);
  return html === lastHtml ? null : html;
}

/**
 * Whether the field replaces its value with the `html` prop. The caller
 * canonicalises the prop first (`valueToHtml(htmlToValue(prop))`), so a
 * legacy body compares in the form the field reports. Its own echo matches
 * `lastHtml`; a focused field never takes the prop, so typing ahead of it
 * keeps the caret and the text.
 */
export function shouldTakeProp(
  propCanonical: string,
  lastHtml: string,
  focused: boolean
): boolean {
  return propCanonical !== lastHtml && !focused;
}
