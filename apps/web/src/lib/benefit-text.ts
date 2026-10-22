import type { CampusBenefits } from "@repo/api/types/appwrite";
import {
  BENEFIT_CATEGORY_LABELS,
  isBenefitCategory,
} from "@repo/shared/utils/benefit-catalog";
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";

type BenefitTextFields = Pick<
  CampusBenefits,
  | "description_en"
  | "description_nb"
  | "teaser_en"
  | "teaser_nb"
  | "title_en"
  | "title_nb"
>;

export interface BenefitText {
  /** HTML from the admin editor; empty when the benefit has no description. */
  description: string;
  teaser: string;
  title: string;
}

const firstFilled = (...values: (string | null | undefined)[]): string =>
  values.find((value) => value?.trim()) ?? "";

/**
 * A benefit's copy in the visitor's language, falling back to the other
 * language field by field. Editors may complete only one language, and a
 * blank card helps nobody.
 */
export function localizedBenefitText(
  benefit: BenefitTextFields,
  locale: string
): BenefitText {
  const english = locale === "en";
  return {
    description: english
      ? firstFilled(benefit.description_en, benefit.description_nb)
      : firstFilled(benefit.description_nb, benefit.description_en),
    teaser: english
      ? firstFilled(benefit.teaser_en, benefit.teaser_nb)
      : firstFilled(benefit.teaser_nb, benefit.teaser_en),
    title: english
      ? firstFilled(benefit.title_en, benefit.title_nb)
      : firstFilled(benefit.title_nb, benefit.title_en),
  };
}

/** The one-line pitch for a preview card: the teaser, else the title. */
export function benefitHeadline(
  benefit: BenefitTextFields,
  locale: string
): string {
  const text = localizedBenefitText(benefit, locale);
  return text.teaser || text.title;
}

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
