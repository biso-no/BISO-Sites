import {
  type BenefitSection,
  isBenefitCategory,
  isBenefitSection,
  mapLegacyBenefitCategory,
} from "@repo/shared/utils/benefit-catalog";
import { benefitDateFromIso } from "@/lib/benefits/benefit-dates";
import { isFormattedDescription } from "@/lib/benefits/benefit-description";
import type { BenefitEditData } from "../../_actions/benefits";
import type { BenefitFormValues } from "../../_actions/schemas";
import { htmlToDescriptionBlocks } from "../../_components/description-blocks";

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
  /** The English description as stored, before it became plain text. */
  descriptionEnStored: string | null;
  descriptionNb: string;
  /** The Norwegian description as stored, before it became plain text. */
  descriptionNbStored: string | null;
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
    descriptionEnStored: null,
    descriptionNb: "",
    descriptionNbStored: null,
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

/**
 * The description as plain text for the panel's text box. Benefits saved by
 * the old editors hold HTML or Plate JSON: headings and paragraphs become
 * blank-line separated text, list items lines starting with "• ", and media
 * only their caption. The stored original is kept in `description*Stored`,
 * so an untouched description is saved back exactly as it was.
 */
export function editableDescription(value: string | null): string {
  const text = value ?? "";
  if (!isFormattedDescription(text)) {
    return text;
  }
  const parts: string[] = [];
  let inList = false;
  for (const block of htmlToDescriptionBlocks(text)) {
    const line = (block.type === "media" ? block.caption : block.text).trim();
    if (!line) {
      continue;
    }
    if (block.type === "l" && inList) {
      parts[parts.length - 1] += `\n• ${line}`;
    } else {
      parts.push(block.type === "l" ? `• ${line}` : line);
    }
    inList = block.type === "l";
  }
  return parts.join("\n\n");
}

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Old rows may carry a redemption type the panel no longer offers ("qr").
 * Its value must survive: a URL reads as a link, anything else as a code.
 */
function redemptionTypeFrom(
  type: string,
  value: string | null
): PanelValues["redemptionType"] {
  const known = REDEMPTION_TYPES.find((option) => option === type);
  if (known) {
    return known;
  }
  const stored = value?.trim();
  if (!stored) {
    return "none";
  }
  return isHttpsUrl(stored) ? "link" : "code";
}

export function panelValuesFromBenefit(data: BenefitEditData): PanelValues {
  const startDate = benefitDateFromIso(data.publish_start) ?? "";
  const endDate = benefitDateFromIso(data.publish_end) ?? "";
  return {
    campusId: data.campus_id,
    // Old rows may use a category name from before the shared list.
    category: data.category?.trim()
      ? mapLegacyBenefitCategory(data.category)
      : null,
    descriptionEn: editableDescription(data.description_en),
    descriptionEnStored: data.description_en,
    descriptionNb: editableDescription(data.description_nb),
    descriptionNbStored: data.description_nb,
    endDate,
    imageUrl: data.image_url ?? "",
    isFeatured: data.is_featured,
    partnerId: data.partner_id,
    redemptionType: redemptionTypeFrom(
      data.redemption_type,
      data.redemption_value
    ),
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

/**
 * A new member benefit started from a partner (`?partner=<id>`) opens with
 * that partner picked, as long as the panel can offer it.
 */
export function withPresetPartner(
  values: PanelValues,
  partnerId: string | null | undefined,
  partners: readonly { id: string }[]
): PanelValues {
  const offered =
    values.section === "member" &&
    Boolean(partnerId) &&
    partners.some((partner) => partner.id === partnerId);
  return offered ? { ...values, partnerId: partnerId ?? null } : values;
}

/** The `[id]` segment that opens an empty panel. */
export const NEW_BENEFIT_ID = "new";

/**
 * Remounts the panel whenever the URL names another item. Every new-benefit
 * URL is `new`, so its campus, section and preset partner are part of the
 * key too: going back or forward between two of them starts a fresh form.
 */
export function panelKey({
  campusId,
  newPartnerId,
  newSection,
  openId,
}: {
  campusId: string;
  newPartnerId?: string;
  newSection?: string;
  openId: string;
}): string {
  if (openId !== NEW_BENEFIT_ID) {
    return openId;
  }
  const section = isBenefitSection(newSection) ? newSection : "member";
  return [NEW_BENEFIT_ID, campusId, section, newPartnerId ?? ""].join(":");
}

/** Whether closing now would lose something the editor changed. */
export function isPanelDirty(
  values: PanelValues,
  initial: PanelValues
): boolean {
  return (Object.keys(initial) as (keyof PanelValues)[]).some(
    (key) => values[key] !== initial[key]
  );
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

/**
 * The stored description when the editor left that language alone, so HTML
 * from the old editors (lists, headings, media) is never flattened by a
 * save; plain text once it was changed.
 */
function descriptionToSave(text: string, stored: string | null): string | null {
  if (stored?.trim() && editableDescription(stored) === text) {
    return stored;
  }
  return blankToNull(text);
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
    description_en: descriptionToSave(
      values.descriptionEn,
      values.descriptionEnStored
    ),
    description_nb: descriptionToSave(
      values.descriptionNb,
      values.descriptionNbStored
    ),
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
