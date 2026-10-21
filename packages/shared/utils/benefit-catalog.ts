export const NATIONAL_CAMPUS_ID = "5";
export const CAMPUS_IDS = ["1", "2", "3", "4"] as const;
export type CampusId = (typeof CAMPUS_IDS)[number];

interface BilingualLabel {
  en: string;
  nb: string;
}

export const BENEFIT_SECTIONS = [
  "member",
  "career",
  "social",
  "safety",
  "business",
] as const;
export type BenefitSection = (typeof BENEFIT_SECTIONS)[number];

export const BENEFIT_SECTION_LABELS: Record<BenefitSection, BilingualLabel> = {
  member: { nb: "Medlemsfordeler", en: "Member benefits" },
  career: { nb: "Karrierefordeler", en: "Career advantages" },
  social: { nb: "Sosialt nettverk", en: "Social network" },
  safety: { nb: "Trygghet og støtte", en: "Safety & support" },
  business: { nb: "For bedrifter", en: "For companies" },
};

export const BENEFIT_CATEGORIES = [
  "food_drink",
  "health_fitness",
  "nightlife",
  "shopping",
  "travel",
  "software",
  "events",
  "other",
] as const;
export type BenefitCategoryKey = (typeof BENEFIT_CATEGORIES)[number];

export const BENEFIT_CATEGORY_LABELS: Record<
  BenefitCategoryKey,
  BilingualLabel
> = {
  food_drink: { nb: "Mat og drikke", en: "Food & drink" },
  health_fitness: { nb: "Trening og helse", en: "Health & fitness" },
  nightlife: { nb: "Uteliv", en: "Nightlife" },
  shopping: { nb: "Shopping", en: "Shopping" },
  travel: { nb: "Reise", en: "Travel" },
  software: { nb: "Programvare", en: "Software" },
  events: { nb: "Arrangementer", en: "Events" },
  other: { nb: "Annet", en: "Other" },
};

export function isBenefitSection(value: unknown): value is BenefitSection {
  return (
    typeof value === "string" &&
    (BENEFIT_SECTIONS as readonly string[]).includes(value)
  );
}

export function isBenefitCategory(value: unknown): value is BenefitCategoryKey {
  return (
    typeof value === "string" &&
    (BENEFIT_CATEGORIES as readonly string[]).includes(value)
  );
}

/** A Map, so inherited keys such as "constructor" never count as categories. */
const LEGACY_CATEGORY_MAP = new Map<string, BenefitCategoryKey>([
  ["health", "health_fitness"],
  ["health & fitness", "health_fitness"],
  ["food & drink", "food_drink"],
  ["entertainment", "events"],
  ["travel", "travel"],
  ["software", "software"],
]);

export function mapLegacyBenefitCategory(
  value: string | null | undefined
): BenefitCategoryKey {
  const normalized = (value ?? "").trim().toLowerCase();
  if (isBenefitCategory(normalized)) {
    return normalized;
  }
  return LEGACY_CATEGORY_MAP.get(normalized) ?? "other";
}
