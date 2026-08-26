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
  | { kind: "department"; department: Departments; canonical: string }
  | {
      kind: "chooser";
      slug: string;
      matches: Departments[];
      unavailableAt: string | null;
    }
  | { kind: "redirect"; to: string }
  | { kind: "notFound" };

/**
 * Resolve either URL shape to a department.
 *
 *   /units/oslo/fadderullan  → explicit campus, cookie-independent, canonical
 *   /units/fadderullan       → follows the nav campus filter; chooser when the
 *                              filter is unset or the campus has no match
 *
 * Request-memoized: the page body and generateMetadata both call this and it
 * must run once. Reads cookies via getActiveCampus, so it is React `cache`, not
 * `"use cache"`.
 */
export const resolveUnit = cache(
  async (segments: string[]): Promise<UnitResolution> => {
    if (segments.length === 2) {
      return await resolveCanonical(
        segments[0] as string,
        segments[1] as string
      );
    }
    if (segments.length === 1) {
      return await resolveFiltered(segments[0] as string);
    }
    return { kind: "notFound" };
  }
);

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
  return {
    kind: "department",
    department,
    canonical: `/units/${campusSegment}/${slug}`,
  };
}

async function resolveFiltered(slug: string): Promise<UnitResolution> {
  const matches = await cachedDepartmentsBySlug(slug);

  if (matches.length === 0) {
    // Nothing matches the slug. It may be a legacy /units/<24SO id> link —
    // those ids are internal accounting identity students never saw, so this
    // is a courtesy redirect, not a supported contract.
    const legacy = await cachedDepartmentById(slug);
    const to = legacy ? `/units/${legacy.slug ?? ""}` : null;
    if (legacy?.slug && to) {
      return { kind: "redirect", to };
    }
    return { kind: "notFound" };
  }

  const activeCampusId = await getActiveCampus();
  const match = activeCampusId
    ? matches.find((d) => d.campus_id === activeCampusId)
    : undefined;

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
