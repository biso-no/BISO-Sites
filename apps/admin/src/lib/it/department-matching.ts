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
const AMPERSAND_REGEX = /&/g;
const TRAILING_DOT_SPACE_REGEX = /[.\s]+$/;

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

// Similarity-only normalization: additionally fold "&" to the Norwegian "og"
// so "X & Y" and "X og Y" score as near-identical. Never used for the
// deterministic exact/truncation comparisons.
function normalizeForSimilarity(name: string): string {
  return normalizeForCompare(name).replace(AMPERSAND_REGEX, "og");
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const compact = value.replace(WHITESPACE_REGEX, "");
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function diceCoefficient(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  if (aGrams.size === 0 || bGrams.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const [gram, countA] of aGrams) {
    const countB = bGrams.get(gram) ?? 0;
    intersection += Math.min(countA, countB);
  }
  const total =
    [...aGrams.values()].reduce((sum, n) => sum + n, 0) +
    [...bGrams.values()].reduce((sum, n) => sum + n, 0);
  return (2 * intersection) / total;
}

const CLOSED_REGEX = /\s*-\s*nedlagt\s*$/i;

export interface CanonicalDepartment {
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

export type RemediationTier =
  | "safe-exact"
  | "safe-truncation"
  | "review-suggested"
  | "review-no-match"
  | "closed";

export interface ClassifierContext {
  campusPrefixToId: Map<CampusPrefix, string>;
  canonical: CanonicalDepartment[];
  minPrefixLength: number; // e.g. 20
  reviewThreshold: number; // e.g. 0.8
  tieMargin: number; // e.g. 0.1
}

export interface DepartmentClassification {
  score: number | null;
  suggestedCampusId: string | null;
  suggestedDepartment: string | null;
  tier: RemediationTier;
}

function expectedCampusId(
  department: CanonicalDepartment,
  context: ClassifierContext
): string {
  const prefix = extractCampusPrefix(department.name);
  const mapped = prefix ? context.campusPrefixToId.get(prefix) : undefined;
  return mapped ?? department.campusId;
}

function sameCampus(
  value: string,
  department: CanonicalDepartment,
  context: ClassifierContext
): boolean {
  const valuePrefix = extractCampusPrefix(value);
  if (!valuePrefix) {
    return true; // value has no prefix signal; don't block on campus here
  }
  return (
    context.campusPrefixToId.get(valuePrefix) ===
    expectedCampusId(department, context)
  );
}

export function classifyDepartmentValue(
  rawValue: string,
  context: ClassifierContext
): DepartmentClassification {
  const value = rawValue.trim();
  if (!value) {
    return {
      tier: "review-no-match",
      suggestedDepartment: null,
      suggestedCampusId: null,
      score: null,
    };
  }

  const normalizedValue = normalizeForCompare(value);

  // 1. Closed: value corresponds to a "- nedlagt" department's base name.
  for (const department of context.canonical) {
    if (
      isClosedName(department.name) &&
      normalizeForCompare(stripClosedSuffix(department.name)) ===
        normalizedValue
    ) {
      return {
        tier: "closed",
        suggestedDepartment: null,
        suggestedCampusId: null,
        score: null,
      };
    }
  }

  const active = context.canonical.filter((d) => !isClosedName(d.name));

  // 2. Safe-exact: case/whitespace-insensitive equality to exactly one canonical.
  // Use direct lowercase+trim comparison (not normalizeForCompare) so that a
  // lowercase prefix in the value ("brg marked") still matches the canonical
  // ("BRG Marked") — normalizeForCompare strips the uppercase prefix from the
  // canonical but not from a lowercase value, causing false non-matches.
  const valueLower = value.toLowerCase();
  const exactMatches = active.filter(
    (d) =>
      d.name.toLowerCase().trim() === valueLower &&
      sameCampus(value, d, context)
  );
  if (exactMatches.length === 1) {
    const department = exactMatches[0];
    return {
      tier: "safe-exact",
      suggestedDepartment: department.name,
      suggestedCampusId: expectedCampusId(department, context),
      score: 1,
    };
  }

  // 3. Safe-truncation: a canonical (trailing "."/space stripped) is a prefix of
  // the value, campus agrees, canonical long enough, and exactly one qualifies.
  const truncationMatches = active.filter((d) => {
    const stripped = d.name.replace(TRAILING_DOT_SPACE_REGEX, "").trim();
    return (
      stripped.length >= context.minPrefixLength &&
      value.toLowerCase().startsWith(stripped.toLowerCase()) &&
      sameCampus(value, d, context)
    );
  });
  if (truncationMatches.length === 1) {
    const department = truncationMatches[0];
    return {
      tier: "safe-truncation",
      suggestedDepartment: department.name,
      suggestedCampusId: expectedCampusId(department, context),
      score: 0.97, // sentinel: high-confidence near-exact, below 1.0 but above any review score
    };
  }

  // 4 & 5. Similarity ranking (campus-scoped when the value has a prefix).
  // For Dice scoring, also fold "&" -> "og" so Norwegian "og"/"&" typos score
  // higher than the base normalizeForCompare (which does not handle "&").
  const valueSim = normalizeForSimilarity(value);
  const valuePrefix = extractCampusPrefix(value);
  const candidates = active.filter((d) =>
    valuePrefix ? sameCampus(value, d, context) : true
  );
  const scored = candidates
    .map((d) => ({
      department: d,
      score: diceCoefficient(valueSim, normalizeForSimilarity(d.name)),
    }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const second = scored[1];

  // If a truncation/exact attempt was ambiguous (>1 match), force review.
  const wasAmbiguous = exactMatches.length > 1 || truncationMatches.length > 1;

  // A best candidate above threshold becomes a suggestion when it is either a
  // clear winner (margin over the runner-up) or the resolution of an ambiguous
  // exact/truncation match that a human must confirm.
  const isViable =
    best &&
    best.score >= context.reviewThreshold &&
    (wasAmbiguous || !second || best.score - second.score >= context.tieMargin);

  if (isViable) {
    return {
      tier: "review-suggested",
      suggestedDepartment: best.department.name,
      suggestedCampusId: expectedCampusId(best.department, context),
      score: best.score,
    };
  }

  return {
    tier: "review-no-match",
    suggestedDepartment: best?.department.name ?? null,
    suggestedCampusId: best ? expectedCampusId(best.department, context) : null,
    score: best?.score ?? null,
  };
}
