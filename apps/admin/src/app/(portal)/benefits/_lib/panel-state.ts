import {
  type BenefitSection,
  isBenefitCategory,
  isBenefitSection,
} from "@repo/shared/utils/benefit-catalog";
import { benefitDateFromIso } from "@/lib/benefits/benefit-dates";
import type { BenefitEditData } from "../../_actions/benefits";
import type { BenefitFormValues } from "../../_actions/schemas";

export type PanelAction =
  | "delete"
  | "hide"
  | "publish"
  | "saveChanges"
  | "saveDraft";

export interface PanelValues {
  campusId: string;
  category: string | null;
  descriptionEn: string;
  descriptionNb: string;
  endDate: string;
  imageUrl: string;
  isFeatured: boolean;
  partnerId: string | null;
  redemptionType: "code" | "link" | "none" | "onsite";
  redemptionValue: string;
  section: BenefitSection;
  startDate: string;
  status: "archived" | "draft" | "published";
  termsEn: string;
  termsNb: string;
  timing: "always" | "range";
  titleEn: string;
  titleNb: string;
}

export type PanelErrorKey =
  | "codeRequired"
  | "endBeforeStart"
  | "linkInvalid"
  | "linkRequired"
  | "titleRequired";

const REDEMPTION_TYPES = ["code", "link", "none", "onsite"] as const;
const STATUSES = ["archived", "draft", "published"] as const;

export function emptyPanelValues(
  section: BenefitSection,
  campusId: string
): PanelValues {
  return {
    campusId,
    category: null,
    descriptionEn: "",
    descriptionNb: "",
    endDate: "",
    imageUrl: "",
    isFeatured: false,
    partnerId: null,
    redemptionType: "none",
    redemptionValue: "",
    section,
    startDate: "",
    status: "draft",
    termsEn: "",
    termsNb: "",
    timing: "always",
    titleEn: "",
    titleNb: "",
  };
}

function pick<T extends string>(
  options: readonly T[],
  value: string,
  fallback: T
): T {
  return options.find((option) => option === value) ?? fallback;
}

export function panelValuesFromBenefit(data: BenefitEditData): PanelValues {
  const startDate = benefitDateFromIso(data.publish_start) ?? "";
  const endDate = benefitDateFromIso(data.publish_end) ?? "";
  return {
    campusId: data.campus_id,
    category: data.category,
    descriptionEn: data.description_en ?? "",
    descriptionNb: data.description_nb ?? "",
    endDate,
    imageUrl: data.image_url ?? "",
    isFeatured: data.is_featured,
    partnerId: data.partner_id,
    redemptionType: pick(REDEMPTION_TYPES, data.redemption_type, "none"),
    redemptionValue: data.redemption_value ?? "",
    section: isBenefitSection(data.section) ? data.section : "member",
    startDate,
    status: pick(STATUSES, data.status, "draft"),
    termsEn: data.terms_en ?? "",
    termsNb: data.terms_nb ?? "",
    timing: startDate || endDate ? "range" : "always",
    titleEn: data.title_en,
    titleNb: data.title_nb,
  };
}

export function panelFooterActions(
  status: PanelValues["status"],
  isNew: boolean
): PanelAction[] {
  if (isNew) {
    return ["saveDraft", "publish"];
  }
  if (status === "published") {
    return ["saveChanges", "hide", "delete"];
  }
  return ["saveDraft", "publish", "delete"];
}

export function validatePanel(
  values: PanelValues,
  action: PanelAction
): Partial<Record<"endDate" | "redemptionValue" | "titleNb", PanelErrorKey>> {
  const errors: Partial<
    Record<"endDate" | "redemptionValue" | "titleNb", PanelErrorKey>
  > = {};
  if (action === "hide") {
    return errors;
  }
  if (!(values.titleNb.trim() || values.titleEn.trim())) {
    errors.titleNb = "titleRequired";
  }
  if (values.section === "member") {
    const value = values.redemptionValue.trim();
    if (values.redemptionType === "code" && !value) {
      errors.redemptionValue = "codeRequired";
    } else if (values.redemptionType === "link") {
      if (!value) {
        errors.redemptionValue = "linkRequired";
      } else if (!value.startsWith("https://")) {
        errors.redemptionValue = "linkInvalid";
      }
    }
  }
  if (
    values.timing === "range" &&
    values.startDate &&
    values.endDate &&
    values.endDate < values.startDate
  ) {
    errors.endDate = "endBeforeStart";
  }
  return errors;
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function statusForAction(
  action: Exclude<PanelAction, "delete">,
  current: PanelValues["status"]
): PanelValues["status"] {
  switch (action) {
    case "hide":
      return "archived";
    case "publish":
      return "published";
    case "saveDraft":
      return "draft";
    default:
      return current;
  }
}

export function toBenefitFormValues(
  values: PanelValues,
  action: Exclude<PanelAction, "delete">
): BenefitFormValues {
  const usesValue =
    values.redemptionType === "code" || values.redemptionType === "link";
  const ranged = values.timing === "range";
  return {
    campus_id: values.campusId as BenefitFormValues["campus_id"],
    category:
      values.category && isBenefitCategory(values.category)
        ? values.category
        : null,
    description_en: blankToNull(values.descriptionEn),
    description_nb: blankToNull(values.descriptionNb),
    image_url: blankToNull(values.imageUrl),
    is_featured: values.isFeatured,
    partner_id: values.partnerId,
    publish_end: ranged ? blankToNull(values.endDate) : null,
    publish_start: ranged ? blankToNull(values.startDate) : null,
    redemption_type: values.redemptionType,
    redemption_value: usesValue ? blankToNull(values.redemptionValue) : null,
    section: values.section,
    status: statusForAction(action, values.status),
    terms_en: blankToNull(values.termsEn),
    terms_nb: blankToNull(values.termsNb),
    title_en: values.titleEn.trim(),
    title_nb: values.titleNb.trim(),
  };
}
