"use client";

import type { Jobs } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { JobPostings } from "@/app/(public)/campus/components/overview/job-postings";
import { UnitsGrid } from "@/app/(public)/campus/components/overview/units-grid";
import type { PublicUnit } from "@/lib/data/units";

interface CampusSectionsProps {
  activeCampusId: string | null;
  jobs: Array<Jobs | RecruitmentVacancy>;
  locale: Locale;
  units: PublicUnit[];
}

/**
 * The parts of the campus overview that moved to the front page: open roles
 * and the unit grid, both already campus-scoped by the page.
 */
export function CampusSections({
  activeCampusId,
  jobs,
  locale,
  units,
}: CampusSectionsProps) {
  if (jobs.length === 0 && units.length === 0) {
    return null;
  }
  return (
    <section className="bg-section/50 py-16">
      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6 lg:px-8">
        <JobPostings jobs={jobs} locale={locale} />
        <UnitsGrid
          activeCampusId={activeCampusId}
          locale={locale}
          units={units}
        />
      </div>
    </section>
  );
}
