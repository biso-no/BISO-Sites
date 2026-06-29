import type { ContentTranslations } from "@repo/api/types/appwrite";

interface TranslatableRow {
  translation_refs?: unknown;
}

/**
 * Pick the content translation to render for a localized row.
 *
 * When a `locale` is provided the matching translation is preferred; otherwise
 * (and as a fallback when no locale match exists) the first translation that
 * looks like a `ContentTranslations` row is returned. The data layer already
 * filters `translation_refs` to the active locale for most reads, so the
 * locale-less call mirrors the previous per-component behavior exactly.
 */
export function getPrimaryTranslation(
  row: TranslatableRow,
  locale?: string
): ContentTranslations | null {
  if (!Array.isArray(row.translation_refs)) {
    return null;
  }

  const translations = row.translation_refs.filter(
    (translation): translation is ContentTranslations =>
      typeof translation === "object" &&
      translation !== null &&
      "title" in translation
  );

  if (translations.length === 0) {
    return null;
  }

  if (locale) {
    const localized = translations.find(
      (translation) => translation.locale === locale
    );
    if (localized) {
      return localized;
    }
  }

  return translations[0] ?? null;
}
