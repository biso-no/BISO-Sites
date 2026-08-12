/**
 * Shared readers for a single news article. The `news` row keeps its copy in
 * `translation_refs` (one row per locale, already narrowed by the query) and
 * the body is stored either as raw HTML or as Plate JSON — both shapes have to
 * flatten to plain text for lead paragraphs, reading time, and metadata.
 */

import type { ContentTranslations, News } from "@repo/api/types/appwrite";

const HTML_TAG = /<[^>]+>/g;
const COLLAPSE_WHITESPACE = /\s+/g;
const WORDS_PER_MINUTE = 220;
const LEAD_MAX_LENGTH = 200;
const AUTO_LEAD_MIN_LENGTH = 400;

export function pickTranslation(
  item: News | null | undefined
): ContentTranslations | null {
  if (!(item && Array.isArray(item.translation_refs))) {
    return null;
  }
  return (
    item.translation_refs.find(
      (entry): entry is ContentTranslations =>
        typeof entry === "object" && entry !== null && "title" in entry
    ) ?? null
  );
}

function collectPlateText(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectPlateText(child, out);
    }
    return;
  }
  if (typeof node !== "object" || node === null) {
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.text === "string") {
    out.push(record.text);
  }
  if (Array.isArray(record.children)) {
    collectPlateText(record.children, out);
  }
}

/** Flattens either storage format (HTML string or Plate JSON) to prose. */
export function toPlainText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parts: string[] = [];
      collectPlateText(JSON.parse(trimmed), parts);
      return parts.join(" ").replace(COLLAPSE_WHITESPACE, " ").trim();
    } catch {
      // Malformed JSON — fall through and treat it as text.
    }
  }

  return trimmed
    .replace(HTML_TAG, " ")
    .replace(COLLAPSE_WHITESPACE, " ")
    .trim();
}

export function readingMinutes(plainText: string): number {
  if (!plainText) {
    return 1;
  }
  const words = plainText.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function truncate(text: string): string {
  if (text.length <= LEAD_MAX_LENGTH) {
    return text;
  }
  const cut = text.slice(0, LEAD_MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

/** One sentence about the article, for metadata, share sheets, and JSON-LD. */
export function buildSummary(
  shortDescription: string | null | undefined,
  plainBody: string
): string {
  return shortDescription?.trim() || truncate(plainBody);
}

/**
 * The lead sits under the headline in the hero. Editors can write one
 * (`short_description`); when they haven't, the opening of the body stands in —
 * but only for an article long enough that the lead isn't the whole story.
 */
export function buildLead(
  shortDescription: string | null | undefined,
  plainBody: string
): string {
  const authored = shortDescription?.trim();
  if (authored) {
    return authored;
  }
  return plainBody.length >= AUTO_LEAD_MIN_LENGTH ? truncate(plainBody) : "";
}

export function formatArticleDate(
  iso: string,
  locale: "en" | "no",
  style: "long" | "short" = "long"
): string {
  return new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(new Date(iso));
}
