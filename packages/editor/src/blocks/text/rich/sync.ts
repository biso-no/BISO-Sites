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
 * Whether the field takes the `html` prop now. Its own echo is the exact
 * string it last reported or took (`lastHtml`); a focused field leaves the
 * prop until focus leaves it, so typing ahead of it keeps the caret and the
 * text. The field asks this of the raw prop before parsing anything. Taking the prop
 * compares its canonical form (`valueToHtml(htmlToValue(prop))`) once more,
 * so a legacy body that canonicalises to the field's text changes nothing.
 */
export function shouldTakeProp(
  prop: string,
  lastHtml: string,
  focused: boolean
): boolean {
  return prop !== lastHtml && !focused;
}
