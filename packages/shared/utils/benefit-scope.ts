/**
 * Campus benefit scope resolver.
 *
 * Resolves which campus_id values should be included when querying benefits.
 * When a specific campus is selected, benefits for that campus AND National
 * (campus_id "5") are always returned together.
 *
 * Shared between the web app (member portal server actions) and the admin app
 * (benefit management views) so the "selected campus + National" rule is
 * consistent everywhere.
 */

/** The campus_id for National (always included alongside a concrete campus) */
export const NATIONAL_CAMPUS_ID = "5";

/**
 * Given the currently selected campus_id, returns the array of campus_id
 * values that should be used to query benefits.
 *
 * - Concrete campus (e.g. "1" for Oslo) → ["1", "5"] (campus + National)
 * - No campus selected (null/undefined) → ["5"] (National only)
 * - National itself selected ("5") → ["5"]
 */
export function resolveBenefitCampusIds(
  selectedCampusId?: string | null
): string[] {
  if (!selectedCampusId || selectedCampusId === NATIONAL_CAMPUS_ID) {
    return [NATIONAL_CAMPUS_ID];
  }
  return [selectedCampusId, NATIONAL_CAMPUS_ID];
}

/**
 * Benefit category constants used across admin and web apps.
 * Values match the `category` column in the campus_benefits table.
 */
export const BENEFIT_CATEGORIES = [
  "Food & Drink",
  "Entertainment",
  "Career",
  "Health & Fitness",
  "Software",
  "Travel",
  "Education",
  "Lifestyle",
  "Finance",
  "Other",
] as const;

export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number];
