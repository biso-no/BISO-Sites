import type { CampusBenefits } from "@repo/api/types/appwrite";

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
