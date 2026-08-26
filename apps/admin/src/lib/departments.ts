/**
 * Department (unit) domain logic.
 *
 * Plain module, NOT "use server": these are synchronous helpers imported by
 * server-action files, which may only export async functions themselves.
 */

import {
  normalizeForCompare,
  stripClosedSuffix,
} from "./it/department-matching";

const WHITESPACE_TO_DASH = /\s+/g;
const NON_SLUG_CHARS = /[^a-z0-9-]/g;
const REPEATED_DASH = /-{2,}/g;
const EDGE_DASH = /^-+|-+$/g;
const MAX_SLUG_ATTEMPTS = 1000;

/**
 * Campus-agnostic URL slug for a department.
 *
 * "OSL Fadderullan" and "BRG Fadderullan" both yield "fadderullan" — the four
 * campus rows share one student-facing name, and `(slug, campus_id)` keeps them
 * distinct in the database.
 *
 * Built on `normalizeForCompare`, which already strips the OSL|BRG|TRD|STV
 * prefix and folds ø→o, æ→ae, å→a. Do not add a second normalizer.
 */
export function unitSlug(name: string): string {
  const slug = normalizeForCompare(stripClosedSuffix(name))
    .replace(WHITESPACE_TO_DASH, "-")
    .replace(NON_SLUG_CHARS, "")
    .replace(REPEATED_DASH, "-")
    .replace(EDGE_DASH, "");
  return slug || "unit";
}

/** Resolve a slug collision WITHIN one campus by suffixing -2, -3, … */
export function uniqueUnitSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let suffix = 2; suffix < MAX_SLUG_ATTEMPTS; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Could not find an available unit slug for "${base}"`);
}
