import type { Departments } from "@repo/api/types/appwrite";
import {
  campusIdToLabel,
  parseUnitSubPageSlug,
  unitCanonicalPath,
} from "@repo/shared/utils/unit-urls";
import { cache } from "react";
import { getActiveCampus } from "@/app/actions/campus";
import {
  cachedDepartmentById,
  cachedDepartmentsBySlug,
} from "@/lib/data/public-content";
import { findCanonicalUnit } from "@/lib/unit-page";

export type UnitResolution =
  /**
   * `canonical` is null only for a department that has no slug yet — reachable
   * exclusively through the legacy /units/<24SO id> URL. Such a department can
   * never own a bound page (the binding IS the slug), so consumers must skip
   * the page lookup and omit the canonical link element rather than
   * substituting a placeholder.
   */
  | { kind: "department"; department: Departments; canonical: string | null }
  /**
   * A department's page below its unit: `slug` is the storage slug,
   * `units/<campus>/<unit>/<name>`, built from the unit's canonical address.
   */
  | { kind: "subPage"; department: Departments; slug: string }
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
  if (segments.length === SUB_PAGE_SEGMENTS) {
    const [campus, unit, name] = segments as [string, string, string];
    return await resolveSubPage(campus, unit, name);
  }
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

/** `/units/<campus>/<unit>/<name>`: a department's page below its unit. */
const SUB_PAGE_SEGMENTS = 3;

/**
 * The unit, and the storage slug of its page called `name`. Only an address
 * the admin can write (`parseUnitSubPageSlug`) resolves; the page itself is
 * looked up and checked by the route.
 */
async function resolveSubPage(
  campusSegment: string,
  unitSlug: string,
  name: string
): Promise<UnitResolution> {
  const found = await findCanonicalUnit(campusSegment, unitSlug);
  const slug = found ? `${found.canonical.slice(1)}/${name}` : null;
  if (!(found && slug && parseUnitSubPageSlug(slug))) {
    return { kind: "notFound" };
  }
  return { kind: "subPage", department: found.department, slug };
}

async function resolveCanonical(
  campusSegment: string,
  slug: string
): Promise<UnitResolution> {
  const found = await findCanonicalUnit(campusSegment, slug);
  return found ? { kind: "department", ...found } : { kind: "notFound" };
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
