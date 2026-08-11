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
