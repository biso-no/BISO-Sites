import type { ContentTranslations, Locale } from "@repo/api/types/appwrite";

export type TranslationMap<T extends ContentTranslations = ContentTranslations> = Partial<
  Record<Locale, T>
>;

export function buildTranslationMap<T extends ContentTranslations = ContentTranslations>(
  references: T[] | undefined | null,
): TranslationMap<T> {
  if (!Array.isArray(references) || references.length === 0) {
    return {};
  }

  return references.reduce<TranslationMap<T>>((acc, reference) => {
    const locale = reference?.locale as Locale | undefined;
    if (locale) {
      acc[locale] = reference;
    }
    return acc;
  }, {});
}

export function ensureTranslationArray<T extends ContentTranslations = ContentTranslations>(
  references: T[] | undefined | null,
): T[] {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.filter((reference): reference is T => Boolean(reference));
}

function pickTranslation<T extends ContentTranslations = ContentTranslations>(
  record: { translations?: TranslationMap<T>; translation_refs?: T[] },
  locale?: Locale,
): T | undefined {
  const translations = record.translations ?? buildTranslationMap(record.translation_refs);
  if (!translations) return undefined;

  const fallbackOrder = locale
    ? [locale, Locale.EN, Locale.NO].filter((loc, index, array) => array.indexOf(loc) === index)
    : [Locale.EN, Locale.NO];

  for (const candidate of fallbackOrder) {
    const translation = translations[candidate];
    if (translation) {
      return translation;
    }
  }

  const firstAvailable = Object.values(translations).find(Boolean);
  return firstAvailable;
}
