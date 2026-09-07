import type { Departments } from "@repo/api/types/appwrite";
import {
  campusIdToLabel,
  campusSegmentToId,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { cache } from "react";
import { getActiveCampus } from "@/app/actions/campus";
import {
  cachedDepartmentById,
  cachedDepartmentBySlugAndCampus,
  cachedDepartmentsBySlug,
} from "@/lib/data/public-content";

export type UnitResolution =
  /**
   * `canonical` is null only for a department that has no slug yet — reachable
   * exclusively through the legacy /units/<24SO id> URL. Such a department can
   * never own a bound page (the binding IS the slug), so consumers must skip
   * the page lookup and omit the canonical link element rather than
   * substituting a placeholder.
   */
  | { kind: "department"; department: Departments; canonical: string | null }
  | {
      kind: "chooser";
      slug: string;
      matches: Departments[];
      unavailableAt: string | null;
    }
  | { kind: "redirect"; to: string }
  | { kind: "notFound" };

/**
 * Keyed on the joined segment string rather than the `segments` array: React's
 * `cache()` keys non-primitive arguments by reference, and Next.js hands the
 * page body and generateMetadata two different array instances for the same
 * request (metadata reads the raw params array; the page body's comes through
 * `getDynamicParam`'s `encodeURIComponent` mapping, a fresh array every call).
 * Keying on the array itself would always miss, running this twice per
 * request — doubling the uncached `getActiveCampus()` cost for a signed-in
 * visitor with no campus cookie, and risking inconsistent output if a
 * `"use cache"` entry it reads revalidates between the two runs.
 */
const resolveUnitByKey = cache(async (key: string): Promise<UnitResolution> => {
  const segments = key.split("/");
  if (segments.length === 2) {
    return await resolveCanonical(segments[0] as string, segments[1] as string);
  }
  if (segments.length === 1) {
    return await resolveFiltered(segments[0] as string);
  }
  return { kind: "notFound" };
});

/**
 * Resolve either URL shape to a department.
 *
 *   /units/oslo/fadderullan  → explicit campus, cookie-independent, canonical
 *   /units/fadderullan       → follows the nav campus filter; chooser when the
 *                              filter is unset or the campus has no match
 *
 * Request-memoized (see `resolveUnitByKey`): the page body and
 * generateMetadata both call this and it must run once. Reads cookies via
 * getActiveCampus, so it is React `cache`, not `"use cache"`.
 *
 * Rejects any segment containing "/" before joining. Next.js decodes a
 * percent-encoded slash inside one path segment without re-splitting on it,
 * so requesting `/units/oslo%2Ffadderullan` arrives here as the
 * single-element `["oslo/fadderullan"]`, not two segments. Without this
 * guard, `resolveUnitByKey`'s join/split round trip would silently turn that
 * back into `["oslo", "fadderullan"]` and misroute a URL shape neither route
 * is meant to accept into `resolveCanonical`, rendering 200 instead of 404.
 * Checking here, before the join, keeps the round trip honest for the two
 * shapes it actually needs to carry.
 */
export const resolveUnit = (segments: string[]): Promise<UnitResolution> =>
  segments.some((segment) => segment.includes("/"))
    ? Promise.resolve<UnitResolution>({ kind: "notFound" })
    : resolveUnitByKey(segments.join("/"));

async function resolveCanonical(
  campusSegment: string,
  slug: string
): Promise<UnitResolution> {
  const campusId = campusSegmentToId(campusSegment);
  if (!campusId) {
    return { kind: "notFound" };
  }
  const department = await cachedDepartmentBySlugAndCampus(slug, campusId);
  if (!department) {
    return { kind: "notFound" };
  }
  // Built from the resolved campus id and the department's own slug, never
  // from the raw URL text: campusSegmentToId lowercases before lookup and
  // Appwrite's Query.equal is case-insensitive, so echoing the URL segments
  // verbatim would let e.g. /units/OSLO/Fadderullan self-canonicalize to
  // itself — a second indexable URL for identical content.
  const canonical = unitCanonicalPath({ campusId, slug: department.slug });
  if (!canonical) {
    return { kind: "notFound" };
  }
  return { kind: "department", department, canonical };
}

async function resolveFiltered(slug: string): Promise<UnitResolution> {
  const matches = await cachedDepartmentsBySlug(slug);

  if (matches.length === 0) {
    // Nothing matches the slug. It may be a legacy /units/<24SO id> link —
    // those ids are internal accounting identity students never saw, so this
    // is a courtesy redirect, not a supported contract. A dissolved
    // department has nowhere useful to send it, so it 404s directly rather
    // than 301-ing to a slug that 404s a second time.
    const legacy = await cachedDepartmentById(slug);
    if (!legacy?.active) {
      return { kind: "notFound" };
    }
    if (legacy.slug) {
      return { kind: "redirect", to: `/units/${legacy.slug}` };
    }
    // Active but not yet slugged: the 24SO sync is a manual button, so a
    // department created between runs — or one whose slug assignment failed
    // inside the sync's Promise.allSettled — legitimately has no slug. Both
    // department card link sites fall back to /units/<$id> precisely for this
    // case, so it must keep rendering the default tabbed view rather than
    // 404ing. There is nowhere to redirect and no canonical URL to advertise.
    return { kind: "department", department: legacy, canonical: null };
  }

  const activeCampusId = await getActiveCampus();
  const match = activeCampusId
    ? matches.find((d) => d.campus_id === activeCampusId)
    : soleMatch(matches);

  if (match) {
    const canonical = unitCanonicalPath({
      campusId: match.campus_id,
      slug: match.slug,
    });
    if (!canonical) {
      return { kind: "notFound" };
    }
    return { kind: "department", department: match, canonical };
  }

  return {
    kind: "chooser",
    slug,
    matches,
    unavailableAt: activeCampusId ? campusIdToLabel(activeCampusId) : null,
  };
}

/**
 * A slug shared by exactly one department isn't actually ambiguous — a unit
 * slug only collapses across campuses when the same unit genuinely exists at
 * several, so most departments have exactly one match. Only fall through to
 * the chooser when there is a real choice to make (2+ matches) or the
 * visitor's campus filter excludes the only match.
 */
function soleMatch(matches: Departments[]): Departments | undefined {
  return matches.length === 1 ? matches[0] : undefined;
}
