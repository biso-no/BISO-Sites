import {
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_SECTION_LABELS,
  type BenefitSection,
  mapLegacyBenefitCategory,
} from "@repo/shared/utils/benefit-catalog";
import type { BenefitDisplayState } from "@repo/shared/utils/benefit-visibility";
import type { BoardBenefit } from "../../_actions/benefits";

/** The admin's UI locale. */
export type AdminLocale = "no" | "en";

/** The catalog's label key for a UI locale. */
export type LabelLocale = "nb" | "en";

export function labelLocale(locale: AdminLocale): LabelLocale {
  return locale === "en" ? "en" : "nb";
}

export function sectionLabel(
  section: BenefitSection,
  locale: AdminLocale
): string {
  return BENEFIT_SECTION_LABELS[section][labelLocale(locale)];
}

/** The category's label, or null when the benefit has none. */
export function categoryLabel(
  category: string | null,
  locale: AdminLocale
): string | null {
  if (!category?.trim()) {
    return null;
  }
  return BENEFIT_CATEGORY_LABELS[mapLegacyBenefitCategory(category)][
    labelLocale(locale)
  ];
}

/** The title in the UI language, falling back to the other one. */
export function benefitTitle(
  benefit: Pick<BoardBenefit, "title_en" | "title_nb">,
  locale: AdminLocale
): string {
  const nb = benefit.title_nb.trim();
  const en = benefit.title_en.trim();
  return locale === "en" ? en || nb : nb || en;
}

const DIMMED_STATES: ReadonlySet<BenefitDisplayState> = new Set([
  "expired",
  "ended",
  "hidden",
]);

/** Items students cannot see any more sit back on the board. */
export function isDimmedState(state: BenefitDisplayState): boolean {
  return DIMMED_STATES.has(state);
}

export function boardHref(campusId: string): string {
  return `/benefits?${new URLSearchParams({ campus: campusId })}`;
}

export function benefitHref(id: string, campusId: string): string {
  return `/benefits/${encodeURIComponent(id)}?${new URLSearchParams({ campus: campusId })}`;
}

export function newBenefitHref(
  campusId: string,
  section: BenefitSection
): string {
  return `/benefits/new?${new URLSearchParams({ campus: campusId, section })}`;
}

const WORD_SEPARATOR = /\s+/;
const STARTS_WITH_LETTER = /^\p{L}/u;

/**
 * "Løft studios" → "LS", "Dogtails" → "DO". Words that start with a digit or
 * sign are skipped, so "40 % på Fadderullan" reads "PF" rather than "4%".
 */
export function logoInitials(name: string): string {
  const words = name.trim().split(WORD_SEPARATOR).filter(Boolean);
  const lettered = words.filter((word) => STARTS_WITH_LETTER.test(word));
  const [first, second] = lettered.length > 0 ? lettered : words;
  if (!first) {
    return "";
  }
  const letters = second
    ? [Array.from(first)[0], Array.from(second)[0]]
    : Array.from(first).slice(0, 2);
  return letters.join("").toLocaleUpperCase("nb");
}

/** Deep STUDIO tones; white initials read clearly on each. */
const LOGO_COLORS = [
  "#2f5d3a",
  "#2a4a7a",
  "#6b1e1e",
  "#8a6420",
  "#3a342a",
] as const;

const HASH_MULTIPLIER = 31;
const HASH_MODULUS = 1_000_003;

/** A stable colour per name, so a partner keeps its colour across visits. */
export function logoColor(name: string): string {
  let hash = 0;
  for (const char of name) {
    // A multiplicative hash spreads similar names across the palette.
    hash = (hash * HASH_MULTIPLIER + (char.codePointAt(0) ?? 0)) % HASH_MODULUS;
  }
  return LOGO_COLORS[hash % LOGO_COLORS.length] ?? LOGO_COLORS[0];
}
