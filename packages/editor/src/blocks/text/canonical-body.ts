/**
 * Body HTML as the rich text field writes it, for HTML that arrives from
 * elsewhere (the copilot). Besides `lazy-field.ts` the only way into `rich/`
 * from outside it, and through the same kind of dynamic import, so the Plate
 * chunk stays out of every bundle that does not load it. Browser-only: the
 * parse needs a DOM.
 */
const loadRichHtml = () => import("./rich/html");

/** `valueToHtml(htmlToValue(html))`: the HTML the field would report. */
export async function canonicalBodyHtml(html: string): Promise<string> {
  const { htmlToValue, valueToHtml } = await loadRichHtml();
  return valueToHtml(htmlToValue(html));
}

/** Starts loading the rich chunk, so the first `canonicalBodyHtml` is quick. */
export function preloadRichHtml(): void {
  loadRichHtml().catch(() => undefined);
}
