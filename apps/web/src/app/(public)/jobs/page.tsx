import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Suspense } from "react";
import { listJobs } from "@/app/actions/jobs";
import { JobsHero } from "@/components/jobs/jobs-hero";
import { JobsListClient } from "@/components/jobs/jobs-list-client";
import { getUserPreferences } from "@/lib/auth-utils";

export const metadata = {
  title: "Join Our Team | BISO",
  description: "Discover open positions at BISO and apply today.",
};

interface JobsPageProps {
  searchParams: Promise<{
    campus?: string;
    department?: string;
    type?: string;
    q?: string;
    paid?: string;
    sort?: string;
  }>;
}

async function JobsList({
  campus,
  department,
  locale,
  search,
}: {
  campus: string | null;
  department?: string | null;
  locale: string;
  search?: string;
}) {
  const jobs = await listJobs({
    campus,
    department,
    locale,
    limit: 100,
    search,
  });

  const paidPositions = jobs.filter((j) => j.metadata.paid === true).length;
  const departmentCount =
    new Set(jobs.map((j) => j.department_id).filter(Boolean)).size || 4;

  return (
    <>
      <JobsHero
        departmentCount={departmentCount}
        paidPositions={paidPositions}
        totalPositions={jobs.length}
      />
      <JobsListClient
        initialDepartment={department ?? null}
        initialSearch={search ?? ""}
        jobs={jobs}
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

  // URL param wins, then user prefs, then "all"
  const campus = sp.campus ?? prefs?.campusId ?? null;
  const locale = prefs?.locale ?? "en";

  return (
    <div className="min-h-screen bg-linear-to-b from-section to-background">
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsList
          campus={campus}
          department={sp.department ?? null}
          locale={locale}
          search={sp.q}
        />
      </Suspense>
    </div>
  );
}
