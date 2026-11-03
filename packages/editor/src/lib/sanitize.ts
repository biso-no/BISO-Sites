import {
  BODY_TAGS,
  DROPPED_WITH_CONTENT,
  INLINE_TAGS,
  keptOlStart,
  SAFE_HREF,
} from "./rich-allowlist";

const ALLOWED_TAGS = new Set(INLINE_TAGS);
const BODY_ALLOWED_TAGS = new Set(BODY_TAGS);
const DROPPED_TAGS = new Set(DROPPED_WITH_CONTENT);
/** Browsers wrap each new line typed with Enter in one of these. */
const LINE_BLOCK_TAGS = new Set(["div", "p"]);

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
  cleanNode(tmp, false);
  return tmp.innerHTML;
}

/**
 * A text block's HTML body reduced to `BODY_TAGS`. Unlike the inline pass,
 * block tags stay and no `<br>` is inserted for a `div`/`p`; the elements in
 * `DROPPED_WITH_CONTENT` go with their content, other tags are unwrapped.
 */
export function sanitizeRichBody(html: string): string {
  const tmp = parseInert(html);
  cleanNode(tmp, true);
  return tmp.innerHTML;
}

function cleanNode(node: Node, body: boolean): void {
  for (const child of Array.from(node.childNodes)) {
    cleanChild(child, body);
  }
}

function cleanChild(child: Node, body: boolean): void {
  if (child.nodeType === Node.TEXT_NODE) {
    return;
  }

  if (child.nodeType !== Node.ELEMENT_NODE) {
    child.parentNode?.removeChild(child);
    return;
  }

  const el = child as Element;
  const tag = el.tagName.toLowerCase();

  if (body && DROPPED_TAGS.has(tag)) {
    el.remove();
    return;
  }

  if (!(body ? BODY_ALLOWED_TAGS : ALLOWED_TAGS).has(tag)) {
    if (!body && LINE_BLOCK_TAGS.has(tag) && el.previousSibling) {
      el.before(el.ownerDocument.createElement("br"));
    }
    cleanNode(el, body);
    unwrapElement(el);
    return;
  }

  stripAttributes(el, tag, body);
  cleanNode(el, body);
}

function stripAttributes(el: Element, tag: string, body: boolean): void {
  for (const attr of Array.from(el.attributes)) {
    if (
      body &&
      tag === "ol" &&
      attr.name === "start" &&
      keptOlStart(attr.value) !== null
    ) {
      el.setAttribute("start", keptOlStart(attr.value) as string);
      continue;
    }
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
