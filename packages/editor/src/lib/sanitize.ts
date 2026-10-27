const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "a", "br", "span"]);
/** Browsers wrap each new line typed with Enter in one of these. */
const LINE_BLOCK_TAGS = new Set(["div", "p"]);
const SAFE_HREF = /^(?:https?:|mailto:|tel:|[/#?.])/i;

/**
 * The markup parsed into a document with no browsing context. Set as
 * innerHTML in the live document, it starts loading at once: an
 * `<img onerror>` ran its handler before the walk below could remove it,
 * though the string returned was clean. Nothing in an inert document loads
 * or runs.
 */
export function parseInert(html: string): HTMLElement {
  const host = document.implementation
    .createHTMLDocument("")
    .createElement("div");
  host.innerHTML = html;
  return host;
}

export function sanitizeRichText(html: string): string {
  const tmp = parseInert(html);
  cleanNode(tmp);
  return tmp.innerHTML;
}

function cleanNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    cleanChild(child);
  }
}

function cleanChild(child: Node): void {
  if (child.nodeType === Node.TEXT_NODE) {
    return;
  }

  if (child.nodeType !== Node.ELEMENT_NODE) {
    child.parentNode?.removeChild(child);
    return;
  }

  const el = child as Element;
  const tag = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    if (LINE_BLOCK_TAGS.has(tag) && el.previousSibling) {
      el.before(el.ownerDocument.createElement("br"));
    }
    cleanNode(el);
    unwrapElement(el);
    return;
  }

  stripAttributes(el, tag);
  cleanNode(el);
}

function stripAttributes(el: Element, tag: string): void {
  for (const attr of Array.from(el.attributes)) {
    if (
      tag === "a" &&
      attr.name === "href" &&
      SAFE_HREF.test(attr.value.trim())
    ) {
      continue;
    }
    el.removeAttribute(attr.name);
  }
}

function unwrapElement(el: Element): void {
  while (el.firstChild) {
    el.before(el.firstChild);
  }
  el.remove();
}
