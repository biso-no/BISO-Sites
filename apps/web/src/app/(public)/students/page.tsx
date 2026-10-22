import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "For Students | BISO",
  description:
    "Resources, events, and opportunities for students at BI Norwegian Business School.",
};

import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { getPublicBenefits } from "@/lib/data/benefits";
import { cachedPublicUnits } from "@/lib/data/units";
import { StudentsPageClient } from "./students-page-client";

// `students-page-client.tsx` filters this pool by `activeCampusId` and slices
// to 6 per campus, so a flat 12-row fetch (the paginated-surface default) can
// starve less-represented campuses down to a handful of events/jobs, or none.
// This restores the pre-pagination fetch size for this first-N consumer; the
// paginated `/events` and `/jobs` surfaces keep the `WEB_PAGE_SIZE` default.
const STUDENTS_PAGE_SIZE = 24;

// This page fetches all five surfaces up front with no Suspense boundary, so it
// is request-time by nature. `instant = false` lets it block; `connection()`
// below additionally exempts it from unstable-value validation, which
// `openVacancyQueries` trips via `new Date()`. Both are needed — the first
// permits blocking, the second permits the unstable read.
export const instant = false;

export default async function StudentsPage() {
  // Must precede the fetches: the prerender rejects `new Date()` inside
  // `listJobs` → `openVacancyQueries` (`blocking-prerender-current-time`).
  await connection();

  const locale = (await getLocale()) as Locale;

  const [eventsResult, jobs, units, benefits] = await Promise.all([
    listEvents({
      pageSize: STUDENTS_PAGE_SIZE,
      status: "published",
      locale,
      upcomingOnly: true,
    }),
    listJobs({ locale, pageSize: STUDENTS_PAGE_SIZE }),
    // Same cached unit directory /units and /campus read. Campus slicing
    // happens in the client below, so this deliberately fetches all campuses.
    cachedPublicUnits(locale).catch(() => []),
    // Throws on a backend failure; the fallback lives at the call site.
    getPublicBenefits().catch(() => []),
  ]);
  const events = eventsResult.rows;

  return (
    <StudentsPageClient
      benefits={benefits}
      events={events}
      jobs={jobs.rows as RecruitmentVacancy[]}
      locale={locale}
      units={units}
    />
  );
}
