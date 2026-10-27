import { Window } from "happy-dom";

const window = new Window();

/**
 * Static markup parsed into a detached happy-dom element, for tests that
 * assert on exact class tokens (`classList.contains`) rather than on
 * substrings of the class attribute, which match `break-words` inside
 * `[&_p]:break-words` or `bg-action` inside `hover:bg-action`.
 */
export function parseHtml(html: string): Element {
  const host = window.document.createElement("div");
  host.innerHTML = html;
  return host as unknown as Element;
}

/** The element's class tokens. */
export function classesOf(element: Element | null | undefined): string[] {
  return element ? [...element.classList] : [];
}
