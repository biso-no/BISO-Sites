const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "a", "br", "span"]);

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

  if (!ALLOWED_TAGS.has(tag)) {
    unwrapElement(el);
    return;
  }

  stripAttributes(el, tag);
  cleanNode(el);
}

function stripAttributes(el: Element, tag: string): void {
  for (const attr of Array.from(el.attributes)) {
    if (tag === "a" && attr.name === "href") {
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
