import type { ListSearchParams } from "@repo/shared/utils/list-params";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { connection } from "next/server";
import { Suspense } from "react";
import { type JobSort, listJobFacets, listJobs } from "@/app/actions/jobs";
import { JobsHero } from "@/components/jobs/jobs-hero";
import { JobsListClient } from "@/components/jobs/jobs-list-client";
import { getUserPreferences } from "@/lib/auth-utils";
import { parseWebListParams } from "@/lib/list-params";

export const metadata = {
  title: "Join Our Team | BISO",
  description: "Discover open positions at BISO and apply today.",
};

interface JobsPageProps {
  searchParams: Promise<ListSearchParams>;
}

const asSort = (value: string | undefined): JobSort =>
  value === "deadline" ? "deadline" : "newest";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

async function JobsList({
  campus,
  category,
  department,
  locale,
  page,
  search,
  sort,
}: {
  campus: string | null;
  category: string | null;
  department: string | null;
  locale: string;
  page: number;
  search: string;
  sort: JobSort;
}) {
  // `openVacancyQueries` builds its deadline filter from `new Date()`, which the
  // Cache Components prerender rejects as an unstable value
  // (`blocking-prerender-current-time`). Marking this subtree request-time is
  // enough — it sits inside the page's <Suspense>, so the skeleton still
  // streams and the route itself stays non-blocking.
  await connection();

  const [result, facets] = await Promise.all([
    listJobs({ campus, category, department, locale, page, search, sort }),
    listJobFacets({ campus }),
  ]);

  return (
    <>
      <JobsHero
        departmentCount={facets.departments.length}
        totalPositions={result.total}
      />
      <JobsListClient
        capped={result.capped}
        categories={facets.categories}
        departments={facets.departments}
        initialJobs={result.rows}
        initialSearch={search}
        // Remounts on any filter change so the load-more list resets to the
        // new page 1 instead of appending onto the previous filter's rows.
        key={`${campus}|${category}|${department}|${search}|${sort}`}
        locale={locale}
        selectedCategory={category}
        selectedDepartment={department}
        sort={sort}
        total={result.total}
      />
    </>
  );
}

function JobsListSkeleton() {
  return (
    <>
      <div className="relative h-[60vh]">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {[...new Array(6)].map((_, i) => (
            <div className="space-y-4" key={i}>
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const [sp, prefs] = await Promise.all([searchParams, getUserPreferences()]);
  const { page, q } = parseWebListParams(sp);

  // URL param wins, then user prefs, then "all"
  const campus = first(sp.campus) ?? prefs?.campusId ?? null;
  const locale = prefs?.locale ?? "en";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <Suspense fallback={<JobsListSkeleton />} key={`${campus}|${q}|${page}`}>
        <JobsList
          campus={campus}
          category={first(sp.category) ?? null}
          department={first(sp.department) ?? null}
          locale={locale}
          page={page}
          search={q}
          sort={asSort(first(sp.sort))}
        />
      </Suspense>
    </div>
  );
}
