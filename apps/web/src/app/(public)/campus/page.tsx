import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { getCampusData, getCampusMetadata } from "@/app/actions/campus";
import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { getDepartments } from "@/lib/actions/departments";
import { getUserPreferences } from "@/lib/auth-utils";
import { CampusPageClient } from "./components/campus-page-client";

export const metadata: Metadata = {
  title: "Campuses | BISO",
  description:
    "Discover BISO's presence on every BI Norwegian Business School campus — Oslo, Bergen, Trondheim, and Stavanger.",
};

interface CampusPageProps {
  searchParams: Promise<{ campus?: string }>;
}

export default async function CampusPage({ searchParams }: CampusPageProps) {
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
  const [events, jobs, news, departments, campusData, campusMetadata] =
    await Promise.all([
      listEvents({ campus, status: "published", limit: 10, locale }),
      listJobs({ campus, status: "published", limit: 10, locale }),
      listNews({ campus, status: "published", limit: 6, locale }),
      getDepartments({ isActive: true, locale }),
      getCampusData(),
      getCampusMetadata(),
    ]);

  return (
    <CampusPageClient
      campusData={campusData}
      campusMetadata={campusMetadata}
      departments={departments}
      events={events}
      jobs={jobs}
      locale={locale}
      news={news}
      serverCampusId={activeCampusId}
    />
  );
}
