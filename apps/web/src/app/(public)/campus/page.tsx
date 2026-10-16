import type { Metadata } from "next";
import { getLocale } from "@/app/actions/locale";
import { CampusIndex } from "@/components/campus/v2/campus-index";
import { CAMPUS_SLUGS, campusSlugToId } from "@/lib/campus-scope";
import { cachedShellCampuses } from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";

export const metadata: Metadata = {
  title: "Campuses | BISO",
  description:
    "Discover BISO's presence on every BI Norwegian Business School campus — Oslo, Bergen, Trondheim, and Stavanger.",
};

/**
 * v1 rendered a tabbed view of whichever campus the cookie held, so there was
 * no way to reach another campus's page from it. v2 is an index: five cards,
 * five links, one per `/campus/<slug>`. What the tabs carried — the campus's
 * benefits, its partnership offer and its management board — lives on each
 * campus's own page now.
 *
 * Unit counts come from the same cached directory `/units` reads; a failed
 * read drops the counts for this render rather than printing "0 units".
 */
export default async function CampusPage() {
  const locale = await getLocale();
  const [campuses, units] = await Promise.all([
    cachedShellCampuses(),
    cachedPublicUnits(locale).catch(() => null),
  ]);

  const entries = CAMPUS_SLUGS.map((slug) => {
    const id = campusSlugToId(slug);
    const campus = campuses.find((entry) => entry.$id === id);
    return {
      slug,
      name: campus?.name ?? slug,
      email: campus?.email ?? null,
      unitCount: units
        ? units.filter((unit) => unit.campusId === id).length
        : null,
    };
  });

  return <CampusIndex campuses={entries} />;
}
