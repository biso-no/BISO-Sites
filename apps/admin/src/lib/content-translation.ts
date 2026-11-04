export type ContentLocale = "no" | "en";

export interface AutoTranslationOptions {
  enabled: boolean;
  sourceLocale: ContentLocale;
}

export interface TranslationField {
  format: "plain" | "html";
  key: string;
  value: string;
}

export type TranslationOperation =
  | "publish"
  | "save"
  | "save or publish"
  | "save or send"
  | "send";

const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  en: "English",
  no: "Norwegian",
};

export const getTargetLocale = (sourceLocale: ContentLocale): ContentLocale =>
  sourceLocale === "no" ? "en" : "no";

export const getTranslationActionLabel = (
  sourceLocale: ContentLocale
): string =>
  sourceLocale === "no" ? "Generate English" : "Generate Norwegian";

export const getAutoTranslationDescription = (
  sourceLocale: ContentLocale,
  operation: TranslationOperation
): string => {
  const targetLocale = getTargetLocale(sourceLocale);
  return `Translate ${LANGUAGE_NAMES[sourceLocale]} to ${LANGUAGE_NAMES[targetLocale]} after ${operation}`;
};

export const isCurrentTranslationSource = <Snapshot extends object>(
  submitted: Snapshot,
  current: Snapshot
): boolean =>
  (Object.keys(submitted) as (keyof Snapshot)[]).every(
    (key) => current[key] === submitted[key]
  );

/** A title, teaser and description, as events and job vacancies store them. */
export interface TitledTranslation {
  description: string;
  short_description: string;
  title: string;
}

/**
 * A translation draft keyed by the target locale, the shape the event and job
 * studios read: `title_en`, `short_description_en`, `description_en` for an
 * English draft, the `_no` keys for a Norwegian one.
 */
export const toTitledTranslationDraft = (
  sourceLocale: ContentLocale,
  translated: TitledTranslation
) =>
  getTargetLocale(sourceLocale) === "en"
    ? {
        description_en: translated.description,
        short_description_en: translated.short_description,
        title_en: translated.title,
      }
    : {
        description_no: translated.description,
        short_description_no: translated.short_description,
        title_no: translated.title,
      };
