import type { CampusBenefits } from "@repo/api/types/appwrite";

/**
 * The title to list a benefit under. Editors may complete only one language,
 * so the Norwegian title stands in when the English one is blank.
 */
export function benefitDisplayTitle(
  benefit: Pick<CampusBenefits, "title_en" | "title_nb">
): string {
  return benefit.title_en.trim() || benefit.title_nb.trim();
}
