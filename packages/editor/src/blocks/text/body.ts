import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { TextBodyItem } from "@/editor/types";

const LEGACY_TAG = { h: "h2", h3: "h3", p: "p", li: "li" } as const;

/** True for the legacy array body (read-only, still rendered). */
export function isLegacyBody(body: unknown): body is TextBodyItem[] {
  return Array.isArray(body);
}

/** Legacy items to body HTML; consecutive `li` items share one `<ul>`. */
export function legacyBodyToHtml(items: TextBodyItem[]): string {
  let html = "";
  let inList = false;
  for (const item of items) {
    const tag = LEGACY_TAG[knownKey(LEGACY_TAG, item.type, "p")];
    const isItem = tag === "li";
    if (isItem && !inList) {
      html += "<ul>";
    } else if (!isItem && inList) {
      html += "</ul>";
    }
    inList = isItem;
    html += `<${tag}>${item.text}</${tag}>`;
  }
  return inList ? `${html}</ul>` : html;
}

/** Any stored body as HTML; junk becomes an empty string. */
export function bodyToHtml(body: unknown): string {
  if (typeof body === "string") {
    return body;
  }
  return isLegacyBody(body) ? legacyBodyToHtml(listOf<TextBodyItem>(body)) : "";
}
