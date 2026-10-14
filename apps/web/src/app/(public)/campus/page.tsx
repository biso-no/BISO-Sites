import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getCampusData, getCampusMetadata } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { getUserPreferences } from "@/lib/auth-utils";
import { cachedPublicUnits } from "@/lib/data/units";
import { CampusPageClient } from "./components/campus-page-client";

export const metadata: Metadata = {
  title: "Campuses | BISO",
  description:
    "Discover BISO's presence on every BI Norwegian Business School campus — Oslo, Bergen, Trondheim, and Stavanger.",
};

interface CampusPageProps {
  searchParams: Promise<{ campus?: string }>;
}

// This page fetches every surface up front with no Suspense boundary, so it is
// request-time by nature. `instant = false` lets it block; `connection()`
// below additionally exempts it from unstable-value validation. Both are
// needed — the first permits blocking, the second permits the unstable read.
export const instant = false;

export default async function CampusPage({ searchParams }: CampusPageProps) {
  // Must precede the fetches: the upcoming-events filter in `listEvents` is
  // built from `new Date()`, which the Cache Components prerender rejects as
  // an unstable value (`blocking-prerender-current-time`).
  await connection();

  const [sp, prefs, rawLocale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
  ]);
  const locale = rawLocale as Locale;

  // URL param wins (the client pushes ?campus= when the switcher changes),
  // then the campusId cookie / user prefs, then every campus.
  const campus = sp.campus ?? prefs?.campusId ?? "all";
  const activeCampusId = campus === "all" ? null : campus;

  // Scoping happens server-side: the list actions run `campusScopeIds`
  // internally, so the selected campus plus National content is fetched (and
  // the limits apply *after* scoping instead of truncating before it).
  const [eventsResult, jobs, news, units, campusData, campusMetadata] =
    await Promise.all([
      listEvents({ campus, status: "published", locale, upcomingOnly: true }),
      listJobs({ campus, locale }),
      listNews({ campus, status: "published", limit: 6, locale }),
      // The unit directory is the same cached read /units and /students use —
      // `departments` filtered by the public visibility rule, never
      // `content_translations`. An outage here must not take the campus page
      // down with it; the grid hides itself on an empty list.
      cachedPublicUnits(locale).catch(() => []),
      getCampusData(),
      getCampusMetadata(),
    ]);
  const events = eventsResult.rows.slice(0, 10);

  return (
    <CampusPageClient
      campusData={campusData}
      campusMetadata={campusMetadata}
      events={events}
      jobs={jobs.rows}
      locale={locale}
      news={news}
      serverCampusId={activeCampusId}
      units={units}
    />
  );
}
