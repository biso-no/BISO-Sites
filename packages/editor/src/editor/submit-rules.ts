/**
 * Rules for form submissions that the site's endpoint and the editor's
 * inspector must agree on: the one place that says which recipients work and
 * how an option's stored value is derived.
 */

/** Longest answer, in characters, the endpoint keeps. */
export const MAX_VALUE_LENGTH = 2000;

/** One ASCII mailbox at exactly `biso.no`. Case-insensitive; no trimming. */
const BISO_ADDRESS = /^[a-z0-9._+-]+@biso\.no$/i;

export function isBisoRecipient(value: unknown): value is string {
  return typeof value === "string" && BISO_ADDRESS.test(value);
}

/** Appwrite's rule for a custom id (teams included). */
const APPWRITE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

export function isAppwriteId(value: unknown): value is string {
  return typeof value === "string" && APPWRITE_ID.test(value);
}

const TRANSLITERATIONS: Record<string, string> = {
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ł: "l",
  ß: "ss",
};
const COMBINING_MARKS = /\p{M}/gu;
const NOT_ALNUM = /[^a-z0-9]+/g;
const EDGE_UNDERSCORES = /^_+|_+$/g;
const TRANSLITERATED = /[æœøđłß]/g;

/**
 * An ASCII value for an option from its label: "Ål" is `al`, "Øl" is `ol`,
 * so two labels that only differ in non-ASCII letters stay distinct.
 */
export function optionValueFromLabel(label: string): string {
  const base = label
    .toLowerCase()
    .replace(TRANSLITERATED, (char) => TRANSLITERATIONS[char] ?? char)
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(NOT_ALNUM, "_")
    .replace(EDGE_UNDERSCORES, "");
  return base || "option";
}

/** `value`, or `value-2`, `value-3`, … when `taken` already holds it. */
export function uniqueValue(value: string, taken: readonly string[]): string {
  if (!taken.includes(value)) {
    return value;
  }
  let n = 2;
  while (taken.includes(`${value}-${n}`)) {
    n += 1;
  }
  return `${value}-${n}`;
}
