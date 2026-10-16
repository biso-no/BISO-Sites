import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getLocale } from "@/app/actions/locale";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { UnitsV2 } from "@/components/units/v2/units-v2";
import { getUserPreferences } from "@/lib/auth-utils";
import { campusIdToSlug, resolveRequestCampus } from "@/lib/campus-scope";
import { cachedPublicUnits } from "@/lib/data/units";

export const metadata: Metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/units" },
  title: "BISO Units & Departments | BI Student Organisation",
  description:
    "Explore the student-run units and departments that make up BISO across BI Norwegian Business School campuses.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

async function UnitsDirectory({
  campus,
  searchParams,
  searchQuery,
}: {
  campus: string | null;
  searchParams: SearchParams;
  searchQuery: string;
}) {
  const locale = await getLocale();
  // `cachedPublicUnits` throws rather than caching a failed read, so the
  // fallback is ours — and it is `null`, not `[]`: the directory renders its
  // "unavailable" state instead of claiming there are no units.
  const units = await cachedPublicUnits(locale).catch(() => null);
  return (
    <UnitsV2
      campusId={campus}
      searchParams={searchParams}
      searchQuery={searchQuery}
      units={units}
    />
  );
}

export default async function UnitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [sp, prefs] = await Promise.all([searchParams, getUserPreferences()]);
  const remembered = prefs?.campusId;

  // URL > cookie > all, like every campus-scoped feed. `?campus_id=` is the
  // older spelling the campus overview and /students deep-linked with; it is
  // still honoured, server-side, so the first paint is already filtered.
  const campus = resolveRequestCampus(sp.campus ?? sp.campus_id, remembered);
  if (campus === undefined) {
    notFound();
  }

  // Fold the legacy parameter into the one the filters write, so a chip or a
  // search from a `?campus_id=` URL carries the campus forward exactly once.
  const { campus_id: _legacy, ...rest } = sp;
  const normalized: SearchParams =
    sp.campus === undefined && sp.campus_id !== undefined
      ? { ...rest, campus: campusIdToSlug(campus) ?? "all" }
      : rest;

  const searchQuery = (first(sp.q) ?? first(sp.search) ?? "").trim();

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <UnitsDirectory
        campus={campus}
        searchParams={normalized}
        searchQuery={searchQuery}
      />
    </Suspense>
  );
}
