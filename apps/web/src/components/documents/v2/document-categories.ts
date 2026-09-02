/**
 * The `documents.category` enum, as message keys.
 *
 * RD-027 left these English on the reasoning that they name BISO's own
 * governing documents and their Norwegian titles are BISO's to give. RD-032 is
 * the last package that could fix it, so they are translated —
 * `documents.categories.*` in both locales — with one caveat recorded in
 * STATUS: **these five are the keys most worth a human check**, because
 * "Lokale vedtekter" and "Næringslivsreglement" are my rendering of BISO's
 * document names, not BISO's own. Every other string in this sweep is generic
 * interface copy.
 *
 * The list itself stays in code: it is the enum the Appwrite column accepts,
 * and it drives the filter chips whether or not a translation exists.
 */
export const DOCUMENT_CATEGORIES = [
  "national-statutes",
  "campus-bylaws",
  "code-of-conduct",
  "business-regulations",
  "communication-guidelines",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** A category Appwrite has but the bundle does not falls back to its own key. */
export function isKnownCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}
