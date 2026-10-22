import {
  BENEFIT_CATEGORY_LABELS,
  isBenefitCategory,
} from "@repo/shared/utils/benefit-catalog";
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";

const firstFilled = (...values: (string | null | undefined)[]): string =>
  values.find((value) => value?.trim()) ?? "";

/**
 * The category chip text: a studio category key (migrated rows) in the
 * visitor's language, a legacy value as stored, empty when there is none.
 */
export function benefitCategoryLabel(
  category: string | null | undefined,
  locale: string
): string {
  if (!isBenefitCategory(category)) {
    return category ?? "";
  }
  const label = BENEFIT_CATEGORY_LABELS[category];
  return locale === "no" ? label.nb : label.en;
}

export interface PublicBenefitText {
  /** Stored HTML, Plate JSON or plain text; empty when there is none. */
  description: string;
  /** Empty when the benefit has no terms. */
  terms: string;
  title: string;
}

/**
 * A public benefit's copy in the visitor's language (`no` reads the `nb`
 * fields), falling back to the other language field by field.
 */
export function localizedPublicBenefitText(
  benefit: Pick<PublicBenefit, "description" | "terms" | "title">,
  locale: string
): PublicBenefitText {
  const english = locale === "en";
  return {
    description: english
      ? firstFilled(benefit.description.en, benefit.description.nb)
      : firstFilled(benefit.description.nb, benefit.description.en),
    terms: english
      ? firstFilled(benefit.terms.en, benefit.terms.nb)
      : firstFilled(benefit.terms.nb, benefit.terms.en),
    title: english
      ? firstFilled(benefit.title.en, benefit.title.nb)
      : firstFilled(benefit.title.nb, benefit.title.en),
  };
}
