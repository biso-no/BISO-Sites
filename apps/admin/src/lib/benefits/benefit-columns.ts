import type { BenefitFormValues } from "@/app/(portal)/_actions/schemas";
import { benefitEndIso, benefitStartIso } from "./benefit-dates";

export const BENEFIT_SECRET_TYPES = ["code", "link"] as const;

export interface BenefitPartnerSnapshot {
  id: string;
  logo_url: string | null;
  name: string;
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Non-member sections carry no partner, redemption, category or media. */
export function normalizeBenefitValues(
  values: BenefitFormValues
): BenefitFormValues {
  if (values.section === "member") {
    return values;
  }
  return {
    ...values,
    category: null,
    description_en: null,
    description_nb: null,
    image_url: null,
    is_featured: false,
    partner_id: null,
    redemption_type: "none",
    redemption_value: null,
    terms_en: null,
    terms_nb: null,
  };
}

export function benefitSecretValue(values: BenefitFormValues): string | null {
  if (!BENEFIT_SECRET_TYPES.some((type) => type === values.redemption_type)) {
    return null;
  }
  return blankToNull(values.redemption_value);
}

export function benefitRowPermissions(status: string): string[] {
  return status === "published" ? ['read("any")'] : [];
}

export function buildBenefitColumns(
  values: BenefitFormValues,
  partner: BenefitPartnerSnapshot | null,
  sortOrder: number
): Record<string, unknown> {
  const v = normalizeBenefitValues(values);
  const snapshot = v.section === "member" ? partner : null;
  const titleNb = v.title_nb.trim();
  const titleEn = v.title_en.trim();
  return {
    campus: v.campus_id,
    campus_id: v.campus_id,
    category: v.section === "member" ? (v.category ?? "other") : null,
    department: null,
    description_en: blankToNull(v.description_en),
    description_nb: blankToNull(v.description_nb),
    image_url: blankToNull(v.image_url),
    is_featured: v.is_featured,
    partner_id: snapshot?.id ?? null,
    partner_logo_url: snapshot?.logo_url ?? null,
    partner_name: snapshot?.name ?? null,
    publish_end: benefitEndIso(v.publish_end),
    publish_start: benefitStartIso(v.publish_start),
    redemption_type: v.redemption_type,
    redemption_value: benefitSecretValue(v),
    section: v.section,
    sort_order: sortOrder,
    status: v.status,
    terms_en: blankToNull(v.terms_en),
    terms_nb: blankToNull(v.terms_nb),
    title_en: titleEn || titleNb,
    title_nb: titleNb || titleEn,
  };
}
