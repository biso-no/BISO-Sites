/** Longest slug the `big_events.slug` column holds. */
export const BIG_EVENT_SLUG_MAX = 120;

const FALLBACK_SLUG = "big-event";
const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ALPHANUMERIC_RUN = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const NORWEGIAN_LETTERS: [RegExp, string][] = [
  [/æ/g, "ae"],
  [/ø/g, "o"],
  [/å/g, "a"],
];

/** `"Fadderullan Bergen 2027 – Ø"` → `"fadderullan-bergen-2027-o"`. ASCII only. */
export function slugifyBigEventName(name: string): string {
  let text = name.toLowerCase();
  for (const [letter, ascii] of NORWEGIAN_LETTERS) {
    text = text.replace(letter, ascii);
  }
  return text
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_ALPHANUMERIC_RUN, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, BIG_EVENT_SLUG_MAX)
    .replace(EDGE_DASHES, "");
}

/**
 * The slugs to try, in order: the base, then `base-2`, `base-3`… with the
 * base shortened where needed so every candidate fits the column.
 */
export function bigEventSlugCandidates(base: string, count: number): string[] {
  const root = base || FALLBACK_SLUG;
  const candidates = [root];
  for (let n = 2; n <= count; n++) {
    const suffix = `-${n}`;
    const head = root
      .slice(0, BIG_EVENT_SLUG_MAX - suffix.length)
      .replace(EDGE_DASHES, "");
    candidates.push(`${head}${suffix}`);
  }
  return candidates;
}
