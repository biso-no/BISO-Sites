export interface BenefitMatch {
  anchor: boolean;
  containment: number;
  dice: number;
}

const STOPWORDS = new Set(
  "og i på pa hos til for med av en et ei du deg din ditt dine alle som fra om det den de er the at of and on in to a an rabatt discount biso bi hr media campus medlem medlemmer oslo oslos bergen bergens trondheim trondheims stavanger stavangers".split(
    " "
  )
);

const MIN_TOKEN_LENGTH = 2;
const MIN_PREFIX_LENGTH = 6;
const PREFIX_RATIO = 0.75;
const MERGE_DICE = 0.75;
const POSSIBLE_DICE = 0.4;
const MIN_CAPS_LETTERS = 3;
const MAX_PARTNER_WORDS = 4;

const SPACE_BEFORE_PERCENT = /\s+%/g;
const WHITESPACE = /\s+/g;
const NON_ALNUM = /[^\p{L}\p{N}]/gu;
const LETTER = /\p{L}/gu;
const STARTS_UPPER = /^[^\p{L}]*\p{Lu}/u;
const HAS_LOWER = /\p{Ll}/u;
const DASH = /-/;
const LAST_HOS = /^[\s\S]*\shos\s([\s\S]*)$/i;
const TRAILING_PAREN = /\s*\([^)]*\)\s*$/;
const TRAILING_PUNCT = /[\s.,;:!?]+$/;
const FORBIDDEN_PARTNER = /[,&]|\bog\b/i;
const TRAILING_AS = /\s+(?:as|a\/s)$/;

export function normalizeBenefitText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(SPACE_BEFORE_PERCENT, "%")
    .replace(WHITESPACE, " ")
    .trim();
}

export function benefitTokens(text: string): string[] {
  const tokens = normalizeBenefitText(text)
    .replace(NON_ALNUM, " ")
    .split(" ")
    .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t));
  return [...new Set(tokens)];
}

function tokensMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  if (a.length < MIN_PREFIX_LENGTH || b.length < MIN_PREFIX_LENGTH) {
    return false;
  }
  let prefix = 0;
  const max = Math.min(a.length, b.length);
  while (prefix < max && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return prefix >= MIN_PREFIX_LENGTH && prefix >= PREFIX_RATIO * max;
}

function countMatched(a: string[], b: string[]): number {
  const used = new Set<number>();
  let matched = 0;
  for (const token of a) {
    const index = b.findIndex(
      (other, i) => !used.has(i) && tokensMatch(token, other)
    );
    if (index !== -1) {
      used.add(index);
      matched += 1;
    }
  }
  return matched;
}

interface Anchors {
  lead: string[];
  real: string[];
}

function isAllCaps(segment: string): boolean {
  const letters = segment.match(LETTER) ?? [];
  return letters.length >= MIN_CAPS_LETTERS && !HAS_LOWER.test(segment);
}

function extractAnchors(text: string): Anchors {
  const real: string[] = [];
  const lead: string[] = [];
  const words = text.normalize("NFKC").split(WHITESPACE).filter(Boolean);
  const firstCapitalised =
    words.length > 0 && STARTS_UPPER.test(words[0] ?? "");
  words.forEach((word, wordIndex) => {
    for (const segment of word.split(DASH)) {
      const isReal =
        isAllCaps(segment) || (wordIndex > 0 && STARTS_UPPER.test(segment));
      if (isReal) {
        real.push(...benefitTokens(segment));
      } else if (wordIndex === 0 && firstCapitalised) {
        lead.push(...benefitTokens(segment));
      }
    }
  });
  return { lead, real };
}

function anchorsMatch(a: Anchors, b: Anchors): boolean {
  const aAll = new Set([...a.real, ...a.lead]);
  const bAll = new Set([...b.real, ...b.lead]);
  const aReal = new Set(a.real);
  const bReal = new Set(b.real);
  for (const token of aAll) {
    if (bAll.has(token) && (aReal.has(token) || bReal.has(token))) {
      return true;
    }
  }
  return false;
}

export function compareBenefitTexts(a: string, b: string): BenefitMatch {
  const tokensA = benefitTokens(a);
  const tokensB = benefitTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) {
    return { anchor: false, containment: 0, dice: 0 };
  }
  const matched = countMatched(tokensA, tokensB);
  return {
    anchor: anchorsMatch(extractAnchors(a), extractAnchors(b)),
    containment: matched / Math.min(tokensA.length, tokensB.length),
    dice: (2 * matched) / (tokensA.length + tokensB.length),
  };
}

export function isMergeMatch(match: BenefitMatch): boolean {
  return match.dice >= MERGE_DICE || match.anchor;
}

export function isPossibleMatch(match: BenefitMatch): boolean {
  return match.dice >= POSSIBLE_DICE || match.containment === 1;
}

export function suggestPartnerName(title: string): string | null {
  const found = LAST_HOS.exec(title.trim());
  if (!found) {
    return null;
  }
  const name = (found[1] ?? "")
    .replace(TRAILING_PAREN, "")
    .replace(TRAILING_PUNCT, "")
    .trim();
  if (!name || FORBIDDEN_PARTNER.test(name)) {
    return null;
  }
  if (name.split(WHITESPACE).length > MAX_PARTNER_WORDS) {
    return null;
  }
  return name;
}

export function partnerKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(WHITESPACE, " ")
    .trim()
    .replace(TRAILING_AS, "");
}
