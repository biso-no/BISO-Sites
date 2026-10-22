import {
  BENEFIT_ERRORS,
  BENEFIT_FIELD_ERRORS,
} from "@/lib/benefits/benefit-errors";

export type BenefitSaveError = string | Record<string, string[] | undefined>;

/** A message under `adminPortal.benefits` that explains a failure. */
export type BenefitErrorKey =
  | "board.reorderFailed"
  | "errors.benefitNotFound"
  | "errors.codeRequired"
  | "errors.companyNameRequired"
  | "errors.endBeforeStart"
  | "errors.imageInvalid"
  | "errors.legacyRedemption"
  | "errors.linkInvalid"
  | "errors.linkRequired"
  | "errors.logoNotFound"
  | "errors.logoRequired"
  | "errors.noCampusAccess"
  | "errors.partnerDeleteFailed"
  | "errors.partnerHasOffersOnOtherCampus"
  | "errors.partnerLogoInvalid"
  | "errors.partnerNameRequired"
  | "errors.partnerNotFound"
  | "errors.partnerWebsiteInvalid"
  | "errors.titleRequired";

const REASONS: ReadonlyMap<string, BenefitErrorKey> = new Map([
  [BENEFIT_ERRORS.benefitNotFound, "errors.benefitNotFound"],
  [BENEFIT_ERRORS.companyNameRequired, "errors.companyNameRequired"],
  [BENEFIT_ERRORS.legacyRedemption, "errors.legacyRedemption"],
  [BENEFIT_FIELD_ERRORS.linkInvalid, "errors.linkInvalid"],
  [BENEFIT_ERRORS.logoNotFound, "errors.logoNotFound"],
  [BENEFIT_ERRORS.logoRequired, "errors.logoRequired"],
  [BENEFIT_ERRORS.noCampusAccess, "errors.noCampusAccess"],
  [BENEFIT_ERRORS.partnerDeleteFailed, "errors.partnerDeleteFailed"],
  [
    BENEFIT_ERRORS.partnerHasOffersOnOtherCampus,
    "errors.partnerHasOffersOnOtherCampus",
  ],
  [BENEFIT_ERRORS.partnerLogoInvalid, "errors.partnerLogoInvalid"],
  [BENEFIT_ERRORS.partnerNameRequired, "errors.partnerNameRequired"],
  [BENEFIT_ERRORS.partnerNotFound, "errors.partnerNotFound"],
  [BENEFIT_ERRORS.partnerWebsiteInvalid, "errors.partnerWebsiteInvalid"],
  [BENEFIT_ERRORS.reorderOutOfDate, "board.reorderFailed"],
]);

const FIELD_MESSAGES: ReadonlyMap<string, BenefitErrorKey> = new Map([
  [BENEFIT_FIELD_ERRORS.codeRequired, "errors.codeRequired"],
  [BENEFIT_FIELD_ERRORS.endBeforeStart, "errors.endBeforeStart"],
  [BENEFIT_FIELD_ERRORS.linkInvalid, "errors.linkInvalid"],
  [BENEFIT_FIELD_ERRORS.linkRequired, "errors.linkRequired"],
  [BENEFIT_FIELD_ERRORS.titleRequired, "errors.titleRequired"],
]);

/** Every way the image can fail (not a URL, too long) has the same fix. */
const IMAGE_FIELD = "image_url";

function fieldKey(field: string, message: string): BenefitErrorKey | null {
  if (field === IMAGE_FIELD) {
    return "errors.imageInvalid";
  }
  return FIELD_MESSAGES.get(message) ?? null;
}

/**
 * The messages that explain a failure, one per known reason or failing
 * field. Reasons it does not know are left out: the server writes them in
 * English, for developers, and the panel never shows them.
 */
export function benefitErrorKeys(error: BenefitSaveError): BenefitErrorKey[] {
  if (typeof error === "string") {
    const key = REASONS.get(error.trim());
    return key ? [key] : [];
  }
  const keys: BenefitErrorKey[] = [];
  for (const [field, messages] of Object.entries(error)) {
    const key = (messages ?? [])
      .map((message) => fieldKey(field, message))
      .find((candidate) => candidate !== null);
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

/**
 * The detail shown under the panel's plain "could not save" message, in the
 * committee member's language. Null when there is nothing specific to say.
 */
export function describeBenefitSaveError(
  error: BenefitSaveError,
  translate: (key: BenefitErrorKey) => string
): string | null {
  const keys = benefitErrorKeys(error);
  return keys.length > 0 ? keys.map(translate).join(" ") : null;
}
