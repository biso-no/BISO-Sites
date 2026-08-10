import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { getCampusData, getCampusMetadata } from "@/app/actions/campus";

export const metadata: Metadata = {
  title: "Campuses | BISO",
  description:
    "Discover BISO's presence on every BI Norwegian Business School campus — Oslo, Bergen, Trondheim, and Stavanger.",
};

import { listEvents } from "@/app/actions/events";
import { listJobs } from "@/app/actions/jobs";
import { getLocale } from "@/app/actions/locale";
import { listNews } from "@/app/actions/news";
import { getDepartments } from "@/lib/actions/departments";
import { CampusPageClient } from "./components/campus-page-client";

export default async function CampusPage() {
  const locale = (await getLocale()) as Locale;

  const [events, jobs, news, departments, campusData, campusMetadata] =
    await Promise.all([
      listEvents({ status: "published", limit: 10, locale }),
      listJobs({ status: "published", limit: 10, locale }),
      listNews({ limit: 6, locale }),
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
    />
  );
}
