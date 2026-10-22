import {
  BENEFIT_CATEGORIES,
  type BenefitCategoryKey,
} from "@repo/shared/utils/benefit-catalog";
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";

type SearchableBenefit = Pick<
  PublicBenefit,
  "category" | "description" | "partner" | "title"
>;

/**
 * Whether a benefit matches the member portal search. Descriptions and
 * partners are optional, so any field may be null.
 */
export function matchesBenefitSearch(
  benefit: SearchableBenefit,
  searchQuery: string
): boolean {
  const query = searchQuery.toLowerCase();
  return [
    benefit.title.en,
    benefit.title.nb,
    benefit.partner?.name,
    benefit.description.en,
    benefit.description.nb,
  ].some((value) => (value ?? "").toLowerCase().includes(query));
}

/** The studio categories that at least one benefit uses, in catalog order. */
export function presentBenefitCategories(
  benefits: readonly Pick<PublicBenefit, "category">[]
): BenefitCategoryKey[] {
  const used = new Set(benefits.map((benefit) => benefit.category));
  return BENEFIT_CATEGORIES.filter((key) => used.has(key));
}

/** Filter on the category key ("all" keeps everything) and the search text. */
export function filterBenefits<T extends SearchableBenefit>(
  benefits: readonly T[],
  category: string,
  searchQuery: string
): T[] {
  return benefits.filter(
    (benefit) =>
      (category === "all" || benefit.category === category) &&
      matchesBenefitSearch(benefit, searchQuery)
  );
}
