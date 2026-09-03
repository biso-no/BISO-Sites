import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { JobsV2 } from "@/components/jobs/v2/jobs-v2";
import { FeedSkeleton } from "@/components/ui/loading-shell";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";

export const metadata = {
  // A campus-scoped feed is a filtered view of the same collection, so it
  // points its canonical at the unscoped URL rather than competing with it.
  alternates: { canonical: "/jobs" },
  title: "Join Our Team | BISO",
  description: "Discover open positions at BISO and apply today.",
};

interface JobsPageProps {
  searchParams: Promise<{
    campus?: string;
    /** Organisational category of the owning unit (`departments.type`). */
    category?: string;
    department?: string;
    /** Employment type (part-time, volunteer, …) — not the unit category. */
    type?: string;
    q?: string;
    paid?: string;
    sort?: string;
  }>;
}

async function JobsListV2({
  campus,
  department,
  locale,
  search,
  searchParams,
}: {
  campus: string | null;
  department?: string | null;
  locale: string;
  search?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const jobs = await listJobs({
    campus,
    department,
    locale,
    limit: 100,
    search,
  });
  return (
    <JobsV2
      campusId={campus}
      jobs={jobs}
      locale={locale}
      searchParams={searchParams}
    />
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const [sp, prefs, locale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);

  // Locale comes from `getLocale()`, not from user preferences.
  // `getUserPreferences()` returns no locale when the visitor has never set
  // one, and the `?? "en"` fallback beneath it disagreed with `DEFAULT_LOCALE`,
  // which is `"no"` — so a first visit rendered Norwegian chrome over English
  // content. The chrome reads `getLocale()`; the data must read the same thing.
  // URL beats cookie beats "all". This route already accepted `?campus=1`;
  // `resolveRequestCampus` keeps that working and adds slugs (`?campus=oslo`),
  // and now 404s an unrecognised value instead of passing it to the query,
  // where it silently matched nothing.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  return (
    <Suspense fallback={<FeedSkeleton />}>
      <JobsListV2
        campus={campus}
        department={sp.department ?? null}
        locale={locale}
        search={sp.q}
        searchParams={sp}
      />
    </Suspense>
  );
}
