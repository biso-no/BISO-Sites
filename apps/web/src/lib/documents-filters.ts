import { DOCUMENT_CATEGORIES } from "./documents";

export interface DocumentsFilters {
  /** Campus id, or null for every campus. */
  campusId: string | null;
  /** A document category, or "all". */
  category: string;
}

type SearchParam = string | string[] | undefined;

const first = (value: SearchParam): string | null =>
  (Array.isArray(value) ? value[0] : value) ?? null;

/**
 * Filters for the public documents page, from the URL first and the
 * visitor's selected campus second, so other pages can link to one
 * category or one campus.
 */
export function resolveDocumentsFilters(
  searchParams: { campus?: SearchParam; category?: SearchParam },
  selectedCampusId: string | null | undefined
): DocumentsFilters {
  const category = first(searchParams.category);
  const campus = first(searchParams.campus);
  return {
    campusId: campus === "all" ? null : (campus ?? selectedCampusId ?? null),
    category:
      category && (DOCUMENT_CATEGORIES as readonly string[]).includes(category)
        ? category
        : "all",
  };
}
