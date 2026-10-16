import { DOCUMENT_CATEGORIES } from "@/lib/documents";

/**
 * The `documents.category` enum, as message keys (`documents.categories.*` in
 * both locales).
 *
 * RD-027 left these English on the reasoning that they name BISO's own
 * governing documents, RD-032 translated them, and the Branding Committee's
 * batch D supplied the Norwegian names the bundle now carries.
 *
 * The list itself is `DOCUMENT_CATEGORIES` in `lib/documents.ts`: the enum the
 * Appwrite column accepts, in display order, and the `?category=` values the
 * page accepts. It drives the filter chips whether or not a translation exists.
 */
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** A category Appwrite has but the bundle does not falls back to its own key. */
export function isKnownCategory(value: string): value is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}
