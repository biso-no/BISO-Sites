import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { ContentLocale } from "../types";

/** Frequent Norwegian Bokmål function words that are rare in English. */
const NORWEGIAN_MARKERS = [
  "og", "som", "til", "ikke", "være", "har", "med", "for", "det", "den",
  "av", "en", "et", "er", "på", "vi", "du", "din", "ditt", "vil", "kan",
  "skal", "eller", "men", "å", "om", "ved", "fra", "under", "mellom",
];

/** Frequent English function words that are rare in Norwegian. */
const ENGLISH_MARKERS = [
  "the", "and", "you", "will", "with", "for", "are", "have", "this", "that",
  "your", "our", "from", "they", "their", "which", "about", "would", "should",
  "been", "we", "of", "to", "in", "is", "as",
];

const NORWEGIAN_LETTERS = /[æøå]/gi;
const WORD_PATTERN = /[\p{L}]+/gu;
const MIN_WORDS_FOR_CONFIDENCE = 20;

export function otherLocale(locale: ContentLocale): ContentLocale {
  return locale === "no" ? "en" : "no";
}

export function detectLocale(text: string): {
  locale: ContentLocale;
  confidence: number;
} {
  const words = (text.toLowerCase().match(WORD_PATTERN) ?? []).filter(
    (word) => word.length > 0
  );
  if (words.length === 0) {
    return { confidence: 0, locale: "no" };
  }

  const norwegianSet = new Set(NORWEGIAN_MARKERS);
  const englishSet = new Set(ENGLISH_MARKERS);
  let norwegian = 0;
  let english = 0;

  for (const word of words) {
    if (norwegianSet.has(word)) {
      norwegian += 1;
    }
    // "for" and "we" appear in both lists; only count as English when the word
    // is not also a Norwegian marker, so shared words stay neutral.
    if (englishSet.has(word) && !norwegianSet.has(word)) {
      english += 1;
    }
  }

  // æ/ø/å are decisive: they essentially never occur in English copy.
  norwegian += (text.match(NORWEGIAN_LETTERS) ?? []).length * 2;

  const total = norwegian + english;
  if (total === 0) {
    return { confidence: 0, locale: "no" };
  }

  const locale: ContentLocale = norwegian >= english ? "no" : "en";
  const margin = Math.abs(norwegian - english) / total;
  // Short texts cannot be judged confidently no matter how lopsided the margin.
  const lengthFactor = Math.min(1, words.length / MIN_WORDS_FOR_CONFIDENCE);

  return { confidence: margin * lengthFactor, locale };
}

const translationSchema = z.object({
  translations: z.array(
    z.object({ key: z.string(), translated: z.string() })
  ),
});

const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  en: "English",
  no: "Norwegian Bokmål",
};

export interface TranslateFieldsInput {
  contentType: string;
  fields: Array<{ key: string; value: string }>;
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
}

/**
 * Mirrors translateContentFields() in
 * apps/admin/src/lib/content-translation.server.ts, minus the next/server
 * coupling. Kept local because the importer also needs language detection and
 * must run outside a Next.js request context.
 */
export async function translateFields({
  contentType,
  fields,
  sourceLocale,
  targetLocale,
}: TranslateFieldsInput): Promise<Record<string, string>> {
  if (sourceLocale === targetLocale) {
    throw new Error("Source and target locales must differ");
  }

  const result: Record<string, string> = Object.fromEntries(
    fields.map((field) => [field.key, ""])
  );
  const nonEmpty = fields.filter((field) => field.value.trim().length > 0);
  if (nonEmpty.length === 0) {
    return result;
  }

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    prompt: [
      `Translate the following ${contentType} fields from ${LANGUAGE_NAMES[sourceLocale]} to ${LANGUAGE_NAMES[targetLocale]}.`,
      "Preserve the HTML structure exactly: keep every <p>, <h3>, <ul> and <li> tag and their order.",
      "Translate only the visible text. Do not add, remove, reorder or summarise content.",
      "Return one entry per field, keyed by the given key.",
      "",
      ...nonEmpty.map((field) => `[${field.key}]\n${field.value}`),
    ].join("\n"),
    schema: translationSchema,
  });

  for (const entry of object.translations) {
    if (entry.key in result) {
      result[entry.key] = entry.translated;
    }
  }

  return result;
}
