const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "a", "br", "span"]);

/**
 * Elements removed together with their contents.
 *
 * Everything else that is not allowed gets *unwrapped* — the tag goes, the text
 * inside it stays, which is right for a stray `<div>` or `<h1>`. It is wrong
 * for these: unwrapping `<script>alert(1)</script>` leaves `alert(1)` sitting
 * in the article as visible text. Their content is markup or code, never prose,
 * so it goes with them.
 */
const DROPPED_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "form",
  "input",
  "textarea",
  "select",
  "button",
]);

/**
 * Schemes an `<a href>` may use.
 *
 * `href` is the only attribute this sanitizer preserves, so it is also the only
 * way anything executable can survive the pass — without a scheme check,
 * `<a href="javascript:...">` comes through untouched. Relative and in-page
 * hrefs are allowed because internal links are the common case.
 */
const SAFE_HREF_SCHEME = /^(?:https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;

const SPACE = 0x20;
const NBSP = 0xa0;
const OGHAM_SPACE = 0x16_80;
const EN_QUAD = 0x20_00;
const HAIR_SPACE = 0x20_0a;
const LINE_SEPARATOR = 0x20_28;
const PARAGRAPH_SEPARATOR = 0x20_29;
const NARROW_NBSP = 0x20_2f;
const MEDIUM_MATHEMATICAL_SPACE = 0x20_5f;
const IDEOGRAPHIC_SPACE = 0x30_00;

/**
 * True for characters a browser ignores while resolving a URL.
 *
 * These have to be removed before the scheme is tested: a tab or newline
 * spliced into `java<TAB>script:alert(1)` defeats a naive prefix match here
 * while still executing in the browser. Written as code-point comparisons
 * rather than a regex character class so the control characters never appear
 * literally in this file.
 */
function isIgnoredInUrl(codePoint: number): boolean {
  if (codePoint <= SPACE) {
    return true;
  }
  if (codePoint >= EN_QUAD && codePoint <= HAIR_SPACE) {
    return true;
  }
  return (
    codePoint === NBSP ||
    codePoint === OGHAM_SPACE ||
    codePoint === LINE_SEPARATOR ||
    codePoint === PARAGRAPH_SEPARATOR ||
    codePoint === NARROW_NBSP ||
    codePoint === MEDIUM_MATHEMATICAL_SPACE ||
    codePoint === IDEOGRAPHIC_SPACE
  );
}

function isSafeHref(value: string): boolean {
  let normalized = "";
  for (const character of value) {
    if (!isIgnoredInUrl(character.codePointAt(0) ?? 0)) {
      normalized += character;
    }
  }
  return SAFE_HREF_SCHEME.test(normalized);
}

export function sanitizeRichText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
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

  if (DROPPED_TAGS.has(tag)) {
    el.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    unwrapElement(el);
    return;
  }

  stripAttributes(el, tag);
  cleanNode(el);
}

function stripAttributes(el: Element, tag: string): void {
  for (const attr of Array.from(el.attributes)) {
    if (tag === "a" && attr.name === "href" && isSafeHref(attr.value)) {
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
