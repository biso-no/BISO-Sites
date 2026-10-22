/**
 * The reasons the benefit and partner actions give, in English. They are
 * the contract between server and panel: the panel turns each one into the
 * committee member's language (`benefits/_lib/benefit-save-error.ts`), so
 * rewording one here keeps both sides in step.
 */
export const BENEFIT_ERRORS = {
  benefitNotFound: "Benefit not found",
  legacyRedemption:
    "This benefit uses an old redemption type. Open it in the editor and choose how students redeem it.",
  noCampusAccess: "Unauthorized: no write access to this campus",
  partnerDeleteFailed: "Could not delete the partner",
  partnerHasOffersOnOtherCampus: "This partner has offers on another campus",
  partnerLogoInvalid: "The logo must be an https:// address",
  partnerNameRequired: "Add the partner's name",
  partnerNotFound: "Partner not found",
  partnerWebsiteInvalid: "The website must start with https://",
  reorderOutOfDate: "Reorder list is out of date",
} as const;

/** Messages `benefitSchema` attaches to a field. */
export const BENEFIT_FIELD_ERRORS = {
  codeRequired: "Add the code",
  endBeforeStart: "The end date must be on or after the start date",
  linkInvalid: "The link must start with https://",
  linkRequired: "Add the link",
  titleRequired: "Add a title in Norwegian or English",
} as const;
