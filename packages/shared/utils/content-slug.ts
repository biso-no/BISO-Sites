/**
 * Slug derivation for all BISO content.
 *
 * Shared by `admin`'s studio editors (shop, events, jobs, news), its page
 * editor, and `api`'s Tickster event sync. Every one of those used to carry its
 * own copy; they drifted, and all of them silently deleted Norwegian characters
 * (`Høstball` → `hstball`).
 */

/**
 * Characters with no Unicode decomposition, so NFD below can't reach them.
 * BISO content is Norwegian-first: æ/ø/å fold to their base letter rather than
 * the formal `ae`/`oe`/`aa`, which keeps URLs short and familiar.
 */
const CHAR_FOLDING: Record<string, string> = {
  æ: "a",
  ø: "o",
  đ: "d",
  ð: "d",
  ħ: "h",
  ı: "i",
  ł: "l",
  ŋ: "n",
  œ: "oe",
  ŧ: "t",
  ß: "ss",
  þ: "th",
};

const CHAR_FOLDING_RE = new RegExp(
  `[${Object.keys(CHAR_FOLDING).join("")}]`,
  "g"
);
const COMBINING_MARKS_RE = /[̀-ͯ]/g;
const NON_SLUG_RE = /[^a-z0-9\s-]/g;
const WHITESPACE_RE = /\s+/g;
const HYPHEN_RUN_RE = /-+/g;
const EDGE_HYPHENS_RE = /^-+|-+$/g;

/**
 * A URL-safe slug for a title.
 *
 * Accented and non-ASCII Latin letters fold to their ASCII base (`å`→`a`,
 * `é`→`e`) instead of being dropped; anything still outside `[a-z0-9-]` after
 * that — punctuation, emoji, CJK — is removed.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(CHAR_FOLDING_RE, (char) => CHAR_FOLDING[char] ?? char)
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(NON_SLUG_RE, "")
    .trim()
    .replace(WHITESPACE_RE, "-")
    .replace(HYPHEN_RUN_RE, "-")
    .replace(EDGE_HYPHENS_RE, "");
}

/**
 * The slug a title edit should produce, or `null` to leave the slug untouched.
 *
 * Auto-derivation follows the title on **every** keystroke, not just the first.
 * Every editor previously decided this from the slug being empty, which froze
 * the slug after one character: typing `T` made it truthy and no later
 * keystroke could get past the guard. `locked` is the only thing that stops it
 * — either the row was loaded with a saved slug (rewriting it would 404 live
 * links) or an editor typed one by hand.
 */
export function nextAutoSlug({
  locked,
  title,
}: {
  locked: boolean;
  title: string;
}): string | null {
  if (locked) {
    return null;
  }
  return generateSlug(title);
}

/**
 * `slug` if it's free, otherwise the first free `slug-{year}`,
 * `slug-{year}-2`, `slug-{year}-3`, …
 *
 * Recurring content (the same role posted every year) naturally reuses its
 * title, so a collision gets the year first and a counter only after that.
 */
export function uniqueSlug(
  slug: string,
  taken: ReadonlySet<string>,
  year: number
): string {
  if (!taken.has(slug)) {
    return slug;
  }
  const withYear = `${slug}-${year}`;
  if (!taken.has(withYear)) {
    return withYear;
  }
  let counter = 2;
  while (taken.has(`${withYear}-${counter}`)) {
    counter++;
  }
  return `${withYear}-${counter}`;
}
