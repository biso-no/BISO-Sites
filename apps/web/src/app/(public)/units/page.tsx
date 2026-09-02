import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { UnitsV2 } from "@/components/units/v2/units-v2";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { activeUnits } from "@/lib/data/campus-landing";

export const metadata: Metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/units" },
  title: "BISO Units & Departments | BI Student Organisation",
  description:
    "Explore the student-run units and departments that make up BISO across BI Norwegian Business School campuses.",
};

async function UnitsContentV2({
  campus,
  searchParams,
  searchQuery,
}: {
  campus: string | null;
  searchParams: Record<string, string | string[] | undefined>;
  searchQuery: string;
}) {
  // Read straight from `departments`. `getDepartments()` goes through
  // `content_translations`, which holds **zero** department rows — which is why
  // this page rendered "0 units" while 141 active ones sat in the table.
  const units = await activeUnits(campus);
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, prefs] = await Promise.all([searchParams, getUserPreferences()]);
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <UnitsContentV2
        campus={campus}
        searchParams={sp}
        searchQuery={typeof sp.search === "string" ? sp.search : ""}
      />
    </Suspense>
  );
}
