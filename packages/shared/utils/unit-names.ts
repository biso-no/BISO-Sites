/**
 * Name handling for BISO units (`departments.Name`).
 *
 * A unit's stored name is the 24SevenOffice accounting name: campus-prefixed
 * ("OSL Fadderullan", "BRG Case Club") and sometimes carrying a "- nedlagt"
 * closure marker. That spelling is the join key against Microsoft Graph's
 * `department` attribute, so it must never be rewritten in place — but it is
 * the wrong thing to show a student, who already sees the campus as its own
 * badge. `unitDisplayName` is the public-facing projection; every other
 * consumer keeps using the raw name.
 *
 * This module is the single definition of the campus prefix and the closure
 * suffix. `apps/admin/src/lib/it/department-matching.ts` builds its comparison
 * normaliser on these exact primitives so the sync's matching and the public
 * site's labelling cannot drift apart.
 */

export const CAMPUS_PREFIXES = ["OSL", "BRG", "TRD", "STV"] as const;
export type CampusPrefix = (typeof CAMPUS_PREFIXES)[number];

/**
 * Leading campus prefix, e.g. the "OSL " of "OSL Fadderullan".
 *
 * Case-SENSITIVE on purpose. 24SO writes the prefix in caps, and the admin
 * sync's slug assignment is built on this regex — loosening it would silently
 * re-slug any unit whose name merely begins with a lowercase "osl ", changing
 * a live URL. A display-only lowercase prefix is not worth that risk.
 */
export const CAMPUS_PREFIX_REGEX = /^(OSL|BRG|TRD|STV)\s+/;

/** 24SO marks a dissolved unit by appending "- nedlagt" to its name. */
export const CLOSED_SUFFIX_REGEX = /\s*-\s*nedlagt\s*$/i;

const WHITESPACE_REGEX = /\s+/g;

export function extractCampusPrefix(name: string): CampusPrefix | null {
  const match = name.trim().match(CAMPUS_PREFIX_REGEX);
  return match ? (match[1] as CampusPrefix) : null;
}

export function stripCampusPrefix(name: string): string {
  return name.trim().replace(CAMPUS_PREFIX_REGEX, "");
}

export function isClosedName(name: string): boolean {
  return CLOSED_SUFFIX_REGEX.test(name);
}

export function stripClosedSuffix(name: string): string {
  return name.replace(CLOSED_SUFFIX_REGEX, "").trim();
}

/**
 * The name a student should read.
 *
 * Drops the campus prefix (the campus is rendered as its own badge next to the
 * name, so "Oslo · OSL Fadderullan" reads as a data leak) and the closure
 * marker, then collapses whitespace. Falls back to the trimmed original when
 * stripping would leave nothing — a unit literally named "OSL" must still
 * render something.
 */
export function unitDisplayName(name: string | null | undefined): string {
  if (typeof name !== "string") {
    return "";
  }
  const trimmed = name.trim().replace(WHITESPACE_REGEX, " ");
  const stripped = stripClosedSuffix(stripCampusPrefix(trimmed));
  return stripped || trimmed;
}
