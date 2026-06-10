const CAMPUS_PREFIXES = ["OSL", "BRG", "TRD", "STV"] as const;
export type CampusPrefix = (typeof CAMPUS_PREFIXES)[number];

const DIACRITIC_MAP: Record<string, string> = {
  ø: "o",
  æ: "ae",
  å: "a",
};
const DIACRITIC_REGEX = /[øæå]/g;
const WHITESPACE_REGEX = /\s+/g;
const LEADING_PREFIX_REGEX = /^(OSL|BRG|TRD|STV)\s+/;

export function extractCampusPrefix(name: string): CampusPrefix | null {
  const match = name.trim().match(LEADING_PREFIX_REGEX);
  return match ? (match[1] as CampusPrefix) : null;
}

export function normalizeForCompare(name: string): string {
  return name
    .trim()
    .replace(LEADING_PREFIX_REGEX, "")
    .toLowerCase()
    .replace(DIACRITIC_REGEX, (char) => DIACRITIC_MAP[char] ?? char)
    .replace(WHITESPACE_REGEX, " ")
    .trim();
}

const CLOSED_REGEX = /\s*-\s*nedlagt\s*$/i;

export interface CanonicalDepartment {
  active?: boolean; // false = inactive/closed in 24SO (undefined = active)
  campusId: string;
  name: string; // exact stored canonical name (the write target)
}

export function isClosedName(name: string): boolean {
  return CLOSED_REGEX.test(name);
}

export function stripClosedSuffix(name: string): string {
  return name.replace(CLOSED_REGEX, "").trim();
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
