/**
 * BI's directory names people "Last, First", tagged by account type:
 * "(Student) Heien, Markus" for students, "Heien, Markus (External)" for
 * external staff, plain "Heien, Markus" for employees. Appwrite copies that
 * name onto the account at its first BI sign-in, and onboarding prefills the
 * profile from the account.
 */

const WHITESPACE = /\s+/g;
const LEADING_TAG = /^\([^()]*\)\s*/;
const TRAILING_TAG = /\s*\([^()]*\)$/;
const WORD_START = /(^|[\s-])(\p{L})/gu;
const LOCALE = "nb";

/**
 * A name part BI wrote entirely in lowercase ("markus"), capitalized; any
 * other part is kept exactly as written, so particles like "van der Berg"
 * survive.
 */
function capitalizeIfLowercase(part: string): string {
  const allLowercase =
    part === part.toLocaleLowerCase(LOCALE) &&
    part !== part.toLocaleUpperCase(LOCALE);
  if (!allLowercase) {
    return part;
  }
  return part.replace(
    WORD_START,
    (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase(LOCALE)}`
  );
}

/**
 * A BI directory name as "First Last": the account-type tag dropped and the
 * two halves swapped. Only BI's "Last, First" shape is rewritten — exactly one
 * comma with a name on both sides, optionally tagged. Anything else comes back
 * unchanged, so a name someone typed themselves is never touched.
 */
export function normalizeBiDisplayName(name: string): string {
  const untagged = name
    .replace(WHITESPACE, " ")
    .trim()
    .replace(LEADING_TAG, "")
    .replace(TRAILING_TAG, "")
    .trim();
  const halves = untagged.split(",");
  if (halves.length !== 2) {
    return name;
  }
  const [last, first] = halves.map((half) => half.trim());
  if (!(last && first)) {
    return name;
  }
  return `${capitalizeIfLowercase(first)} ${capitalizeIfLowercase(last)}`;
}
