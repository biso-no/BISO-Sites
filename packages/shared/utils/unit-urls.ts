/**
 * URL construction for department ("unit") pages.
 *
 * A department's public page is bound to the department by slug convention:
 * `pages.slug === "units/<campus-segment>/<department-slug>"`. This module is
 * the single definition of that convention — every producer (the admin action
 * that creates the page, the "View live" link) and every consumer (both public
 * routes) goes through it, so the write side and the read side cannot drift.
 *
 * NOTE: `apps/admin/src/lib/campus-constants.ts` holds a parallel campus map
 * keyed by Azure team name. That one exists to translate SG-App-Campus-* group
 * names; this one exists to build URLs. `apps/admin/src/lib/departments.test.ts`
 * asserts the two agree on ids and labels.
 */

export const CAMPUS_SEGMENTS: Record<
  string,
  { segment: string; label: string }
> = {
  "1": { segment: "oslo", label: "Oslo" },
  "2": { segment: "bergen", label: "Bergen" },
  "3": { segment: "trondheim", label: "Trondheim" },
  "4": { segment: "stavanger", label: "Stavanger" },
  "5": { segment: "national", label: "National" },
};

const SEGMENT_TO_CAMPUS_ID: Record<string, string> = Object.fromEntries(
  Object.entries(CAMPUS_SEGMENTS).map(([id, entry]) => [entry.segment, id])
);

export const UNIT_PAGE_SLUG_PREFIX = "units/";

export interface UnitTarget {
  campusId?: string | null;
  slug?: string | null;
}

export function campusIdToSegment(
  campusId: string | null | undefined
): string | null {
  if (!campusId) {
    return null;
  }
  return CAMPUS_SEGMENTS[campusId]?.segment ?? null;
}

export function campusSegmentToId(
  segment: string | null | undefined
): string | null {
  if (!segment) {
    return null;
  }
  return SEGMENT_TO_CAMPUS_ID[segment.toLowerCase()] ?? null;
}

export function campusIdToLabel(
  campusId: string | null | undefined
): string | null {
  if (!campusId) {
    return null;
  }
  return CAMPUS_SEGMENTS[campusId]?.label ?? null;
}

/** Storage slug of the `pages` row bound to a department. */
export function unitPageSlug(target: UnitTarget): string | null {
  const segment = campusIdToSegment(target.campusId);
  if (!(segment && target.slug)) {
    return null;
  }
  return `${UNIT_PAGE_SLUG_PREFIX}${segment}/${target.slug}`;
}

/** Public canonical path for a department. */
export function unitCanonicalPath(target: UnitTarget): string | null {
  const slug = unitPageSlug(target);
  return slug ? `/${slug}` : null;
}

/**
 * Case-INSENSITIVE, deliberately. Appwrite's `Query.equal` matches slugs
 * case-insensitively (the same property `resolveUnit` guards against when it
 * refuses to echo URL casing back as a canonical), so `Units/oslo/fadderullan`
 * resolves on the public route exactly like `units/oslo/fadderullan`. A
 * case-sensitive test here would disagree with the lookup it exists to
 * describe, letting a case variant slip past every guard built on it while
 * still serving the department's URL.
 *
 * Also trims surrounding whitespace before checking, matching
 * `resolveUniquePageSlug` (packages/api/page-builder.ts), which trims a
 * submitted slug before persisting it. Without this, a padded slug like
 * `" units/oslo/fadderullan"` would fail this check yet land at the exact
 * canonical unit slug once storage trims it — a guard/storage disagreement
 * that let a squatter reserve a department's address out from under it. This
 * function backs every producer and consumer of the convention (the admin
 * namespace guard and field lock, the sitemap filter, and both public
 * routes), so trimming here closes the gap everywhere at once.
 */
export function isUnitPageSlug(slug: string | null | undefined): boolean {
  return (
    typeof slug === "string" &&
    slug.trim().toLowerCase().startsWith(UNIT_PAGE_SLUG_PREFIX)
  );
}
