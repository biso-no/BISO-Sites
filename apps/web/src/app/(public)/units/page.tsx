import type { Metadata } from "next";
import { Suspense } from "react";
import { getActiveCampus } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import { cachedPublicUnits } from "@/lib/data/units";
import { UnitsPageClient } from "./units-page-client";
import { UnitsSkeleton } from "./units-skeleton";

export const metadata: Metadata = {
  title: "BISO Units & Departments | BI Student Organisation",
  description:
    "Explore the student-run units and departments that make up BISO across BI Norwegian Business School campuses.",
};

/**
 * `?campus_id=` seeds the campus filter. Both entry points that deep-link here
 * — the campus overview grid and the /students hero — build that shape, so it
 * has to survive as a server-read initial value rather than being applied
 * after hydration, or the first paint shows all four campuses and then jumps.
 */
async function UnitsDirectory({ campusParam }: { campusParam: string | null }) {
  const locale = await getLocale();
  // A failed unit read must render the directory's own empty state, not take
  // the whole route down — `cachedPublicUnits` deliberately lets errors throw
  // so they are never cached, which makes catching them the caller's job.
  const [units, activeCampusId] = await Promise.all([
    cachedPublicUnits(locale).catch(() => null),
    getActiveCampus(),
  ]);

  return (
    <UnitsPageClient
      initialCampusId={campusParam ?? activeCampusId ?? null}
      units={units}
    />
  );
}

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const raw = resolved.campus_id;
  const campusParam = (Array.isArray(raw) ? raw[0] : raw) ?? null;

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <Suspense fallback={<UnitsSkeleton />}>
        <UnitsDirectory campusParam={campusParam} />
      </Suspense>
    </div>
  );
}
