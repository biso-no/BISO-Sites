import type { CampusBenefits } from "@repo/api/types/appwrite";

type SearchableBenefit = Pick<
  CampusBenefits,
  "description_en" | "description_nb" | "partner_name" | "title_en" | "title_nb"
>;

/**
 * Whether a benefit matches the member portal search. Migrated one-line rows
 * have no description and often no partner name, so any field may be null.
 */
export function matchesBenefitSearch(
  benefit: SearchableBenefit,
  searchQuery: string
): boolean {
  const query = searchQuery.toLowerCase();
  return [
    benefit.title_en,
    benefit.title_nb,
    benefit.partner_name,
    benefit.description_en,
    benefit.description_nb,
  ].some((value) => (value ?? "").toLowerCase().includes(query));
}
