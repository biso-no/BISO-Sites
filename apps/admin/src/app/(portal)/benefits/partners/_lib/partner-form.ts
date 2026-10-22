import type {
  PartnerInput,
  PartnerWithDeals,
} from "../../../_actions/benefit-partners";

/** What the partner sheet edits, as the fields hold it. */
export interface PartnerFormValues {
  campusId: string;
  descriptionEn: string;
  descriptionNb: string;
  logoUrl: string | null;
  name: string;
  website: string;
}

/** Keys under `adminPortal.benefits.errors`, shown under the field. */
export type PartnerFormErrors = Partial<{
  name: "partnerNameRequired";
  website: "partnerWebsiteInvalid";
}>;

const HAS_PROTOCOL = /^[a-z][a-z\d+.-]*:\/\//i;
const HTTPS = "https://";
const WWW = /^www\./;

/** The sheet's fields for a stored partner, or empty ones for a new one. */
export function partnerFormValues(
  partner: PartnerWithDeals | null,
  campusId: string
): PartnerFormValues {
  return {
    campusId: partner?.campus_id ?? campusId,
    descriptionEn: partner?.description_en ?? "",
    descriptionNb: partner?.description_nb ?? "",
    logoUrl: partner?.logo_url ?? null,
    name: partner?.name ?? "",
    website: partner?.website_url ?? "",
  };
}

export function isPartnerFormDirty(
  values: PartnerFormValues,
  initial: PartnerFormValues
): boolean {
  return (Object.keys(initial) as (keyof PartnerFormValues)[]).some(
    (key) => values[key] !== initial[key]
  );
}

/**
 * People type "loftstudios.no", not "https://loftstudios.no". A bare address
 * gets https:// in front; one that names its protocol is left as typed, so a
 * plain http:// address is still refused rather than quietly changed.
 */
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || HAS_PROTOCOL.test(trimmed)) {
    return trimmed;
  }
  return `${HTTPS}${trimmed}`;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** The same checks the server makes, so most mistakes never leave the sheet. */
export function validatePartnerForm(
  values: PartnerFormValues
): PartnerFormErrors {
  const errors: PartnerFormErrors = {};
  if (!values.name.trim()) {
    errors.name = "partnerNameRequired";
  }
  const website = normalizeWebsite(values.website);
  if (website && !isHttpsUrl(website)) {
    errors.website = "partnerWebsiteInvalid";
  }
  return errors;
}

/** Every field is sent: a blank one clears what was stored. */
export function toPartnerInput(values: PartnerFormValues): PartnerInput {
  return {
    campus_id: values.campusId,
    description_en: values.descriptionEn.trim() || null,
    description_nb: values.descriptionNb.trim() || null,
    logo_url: values.logoUrl,
    name: values.name.trim(),
    website_url: normalizeWebsite(values.website) || null,
  };
}

/** "https://www.loftstudios.no/om" → "loftstudios.no", as a card shows it. */
export function websiteHost(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).host.replace(WWW, "") || null;
  } catch {
    return null;
  }
}
