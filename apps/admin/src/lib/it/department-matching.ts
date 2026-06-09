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
