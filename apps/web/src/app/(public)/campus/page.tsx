import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { listNews } from "@/app/actions/news";
import { getDepartments } from "@/lib/actions/departments";
import { getCampusData, getCampusMetadata } from "@/app/actions/campus";
import { getLocale } from "@/app/actions/locale";
import type { Locale } from "@/i18n/config";
import { CampusPageClient } from "./components/campus-page-client";

export const revalidate = 0;

export default async function CampusPage() {
  const locale = (await getLocale()) as Locale;

  const [events, jobs, news, departments, campusData, campusMetadata] =
    await Promise.all([
      listEvents({ status: "published", limit: 10, locale }),
      listJobs({ status: "published", limit: 10, locale }),
      listNews({ limit: 6, locale }),
      getDepartments({ isActive: true }),
      getCampusData(),
      getCampusMetadata(),
    ]);

  return (
    <CampusPageClient
      events={events}
      jobs={jobs}
      news={news}
      departments={departments}
      campusData={campusData}
      campusMetadata={campusMetadata}
      locale={locale}
    />
  );
}
