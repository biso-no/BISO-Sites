import type { Metadata } from "next";
import { CampusIndex } from "@/components/campus/v2/campus-index";
import { CAMPUS_SLUGS, campusSlugToId } from "@/lib/campus-scope";
import { campusUnits } from "@/lib/data/campus-landing";
import { cachedShellCampuses } from "@/lib/data/public-content";

export const metadata: Metadata = {
  title: "Campuses | BISO",
  description:
    "Discover BISO's presence on every BI Norwegian Business School campus — Oslo, Bergen, Trondheim, and Stavanger.",
};

/**
 * v1 rendered a tabbed view of whichever campus the cookie held, so there was
 * no way to reach another campus's page from it. v2 is an index: five cards,
 * five links, one per `/campus/<slug>`.
 */
export default async function CampusPage() {
  const campuses = await cachedShellCampuses();
  const entries = await Promise.all(
    CAMPUS_SLUGS.map(async (slug) => {
      const id = campusSlugToId(slug);
      const campus = campuses.find((entry) => entry.$id === id);
      return {
        slug,
        name: campus?.name ?? slug,
        email: campus?.email ?? null,
        unitCount: id ? (await campusUnits(id)).length : 0,
      };
    })
  );

  return <CampusIndex campuses={entries} />;
}
