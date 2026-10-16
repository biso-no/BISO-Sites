/**
 * The campus prefix and closure suffix themselves live in
 * `@repo/shared/utils/unit-names` — the public site strips the same two things
 * to label a unit, and a second definition here would let the sync's matching
 * and the student-facing name drift apart. What stays local is the *comparison*
 * normaliser below, which additionally lowercases and folds diacritics; that is
 * a matching concern the display projection must not share.
 */
import {
  type CampusPrefix,
  extractCampusPrefix,
  stripCampusPrefix,
} from "@repo/shared/utils/unit-names";

// Re-exported so the sync's callers keep importing their whole matching
// vocabulary from one module.
export {
  type CampusPrefix,
  extractCampusPrefix,
  isClosedName,
  stripClosedSuffix,
} from "@repo/shared/utils/unit-names";

const DIACRITIC_MAP: Record<string, string> = {
  ø: "o",
  æ: "ae",
  å: "a",
};
const DIACRITIC_REGEX = /[øæå]/g;
const WHITESPACE_REGEX = /\s+/g;

export function normalizeForCompare(name: string): string {
  return stripCampusPrefix(name)
    .toLowerCase()
    .replace(DIACRITIC_REGEX, (char) => DIACRITIC_MAP[char] ?? char)
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

// Like normalizeForCompare but KEEPS the campus prefix, so comparisons stay
// campus-scoped (e.g. "OSL Foo" and "BRG Foo" are distinct). Used for closed-
// department matching, where a closure in one campus must not capture an active
// same-named unit in another.
export function normalizeWithCampus(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(DIACRITIC_REGEX, (char) => DIACRITIC_MAP[char] ?? char)
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

export interface CanonicalDepartment {
  active?: boolean; // false = inactive/closed in 24SO (undefined = active)
  campusId: string;
  name: string; // exact stored canonical name (the write target)
}

export function buildCampusPrefixToId(
  departments: CanonicalDepartment[]
): Map<CampusPrefix, string> {
  // For each prefix, count campusId occurrences and pick the most common.
  const tally = new Map<CampusPrefix, Map<string, number>>();
  for (const department of departments) {
    const prefix = extractCampusPrefix(department.name);
    if (!prefix) {
      continue;
    }
    const counts = tally.get(prefix) ?? new Map<string, number>();
    counts.set(department.campusId, (counts.get(department.campusId) ?? 0) + 1);
    tally.set(prefix, counts);
  }

  const result = new Map<CampusPrefix, string>();
  for (const [prefix, counts] of tally) {
    let bestId: string | null = null;
    let bestCount = -1;
    for (const [campusId, count] of counts) {
      if (count > bestCount) {
        bestId = campusId;
        bestCount = count;
      }
    }
    if (bestId) {
      result.set(prefix, bestId);
    }
  }
  return result;
}
