/**
 * Which board the front page and the campus page show as "the leadership".
 *
 * Pure: the campus page's client tab and the server-rendered home section
 * both read this, so neither can drift from the other.
 */

import type { Locale } from "@repo/i18n/config";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";

/** `departments.$id` of each campus's management unit. */
export const MANAGEMENT_DEPARTMENT_IDS: Record<string, string> = {
  "1": "2", // Oslo
  "2": "301", // Bergen
  "3": "601", // Trondheim
  "4": "801", // Stavanger
  "5": "1002", // National (Operations Unit)
};

/** The management unit for a campus, or null for a campus the map lacks. */
export function managementDepartmentId(campusId: string): string | null {
  return MANAGEMENT_DEPARTMENT_IDS[campusId] ?? null;
}

/**
 * The campus whose leadership the front page shows: the selected one, or
 * National when the visitor has not picked a campus.
 */
export function leadershipCampusId(selectedCampusId: string | null): string {
  return selectedCampusId ?? NATIONAL_CAMPUS_ID;
}

/** How many people the front page shows before "see everyone". */
export const HOME_LEADERSHIP_LIMIT = 6;

export interface LeadershipMember {
  email: string | null;
  imageUrl: string | null;
  name: string;
  role: string | null;
}

/** A campus's focus areas in the visitor's language, the other as fallback. */
export function localizedFocusAreas(
  metadata: {
    focusAreas_en: string[] | null;
    focusAreas_nb: string[] | null;
  } | null,
  locale: Locale
): string[] {
  if (!metadata) {
    return [];
  }
  const preferred =
    locale === "en" ? metadata.focusAreas_en : metadata.focusAreas_nb;
  const secondary =
    locale === "en" ? metadata.focusAreas_nb : metadata.focusAreas_en;
  return (preferred?.length ? preferred : secondary) ?? [];
}
