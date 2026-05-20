const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "a", "br", "span"]);

export function sanitizeRichText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  cleanNode(tmp);
  return tmp.innerHTML;
}

function cleanNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      continue;
    }

    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (ALLOWED_TAGS.has(tag)) {
        // Strip all attributes; keep only href on <a>
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          if (tag === "a" && attr.name === "href") {
            continue;
          }
          el.removeAttribute(attr.name);
        }
        cleanNode(el);
      } else {
        // Unwrap: replace element with its children
        while (el.firstChild) {
          el.before(el.firstChild);
        }
        el.remove();
      }
    } else {
      child.remove();
    }
  }
}
