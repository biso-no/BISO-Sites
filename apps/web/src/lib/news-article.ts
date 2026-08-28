/**
 * Shared readers for a single news article. The `news` row keeps its copy in
 * `translation_refs` (one row per locale, already narrowed by the query); the
 * body flattening itself lives in `content-text` because events, jobs, and the
 * hero need the exact same treatment.
 */

import type { ContentTranslations, News } from "@repo/api/types/appwrite";
import { truncateAtWord } from "@/lib/content-text";

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

export function readingMinutes(plainText: string): number {
  if (!plainText) {
    return 1;
  }
  const words = plainText.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const truncate = (text: string) => truncateAtWord(text, LEAD_MAX_LENGTH);

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
