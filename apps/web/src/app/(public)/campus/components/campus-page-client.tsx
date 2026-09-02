"use client";

import type {
  CampusData,
  CampusMetadata,
  ContentTranslations,
  DepartmentBoard,
  Events,
  Jobs,
  News,
} from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useCampus } from "@/components/context/campus";
import { campusScopeIds } from "@/lib/campus-scope";
import { CampusHero } from "./campus-hero";
import { CampusTabs } from "./campus-tabs";
import { DepartmentsGrid } from "./overview/departments-grid";
import { FocusAreas } from "./overview/focus-areas";
import { JobPostings } from "./overview/job-postings";
import { LatestNews } from "./overview/latest-news";
import { UpcomingEvents } from "./overview/upcoming-events";
import { PartnersTab } from "./partners/partners-tab";
import { StudentsTab } from "./students/students-tab";
import { TeamTab } from "./team/team-tab";

interface CampusPageClientProps {
  campusData: CampusData[];
  campusMetadata: Record<string, CampusMetadata>;
  departments: ContentTranslations[];
  events: Events[];
  jobs: Array<Jobs | RecruitmentVacancy>;
  locale: Locale;
  news: News[];
  /**
   * Campus the server fetched with (`null` = every campus). The switcher can
   * change the selection client-side, so we compare against this and push a
   * `?campus=` param to re-render the server component when they diverge.
   */
  serverCampusId: string | null;
}

export function CampusPageClient({
  events,
  jobs,
  news,
  departments,
  campusData,
  campusMetadata,
  locale,
  serverCampusId,
}: CampusPageClientProps) {
  const router = useRouter();
  const { activeCampus, activeCampusId, campuses, loading } = useCampus();

  // The campus switcher lives in a client context (cookie + localStorage), so
  // the selection can change without a server round trip. Mirror it into the
  // URL — the same pattern as `jobs-list-client` — so the server refetches
  // with the right campus scope instead of us filtering an already-truncated
  // list. Wait until the context has settled (campuses loaded) to avoid
  // navigating on the transient initial `null`.
  useEffect(() => {
    if (loading || campuses.length === 0) {
      return;
    }
    const desired = activeCampusId ?? "all";
    const current = serverCampusId ?? "all";
    if (desired === current) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (desired === "all") {
      params.delete("campus");
    } else {
      params.set("campus", desired);
    }
    const query = params.toString();
    router.replace(query ? `/campus?${query}` : "/campus");
  }, [activeCampusId, campuses.length, loading, router, serverCampusId]);

  // National content (`campus_id === "5"`) rides along with every campus —
  // `campusScopeIds` is the canonical rule, shared with the server queries.
  const campusScope = useMemo(
    () => campusScopeIds(activeCampusId),
    [activeCampusId]
  );

  // Get campus-specific metadata
  const activeCampusMetadata = useMemo(() => {
    if (!activeCampusId) {
      return null;
    }
    return (
      campusMetadata[activeCampusId] ||
      Object.values(campusMetadata).find(
        (m) =>
          m.campus_name?.toLowerCase() === activeCampus?.name?.toLowerCase()
      ) ||
      null
    );
  }, [activeCampusId, activeCampus, campusMetadata]);

  // Get campus-specific data
  const activeCampusData = useMemo(() => {
    if (!activeCampus) {
      return null;
    }
    return (
      campusData.find(
        (cd) =>
          cd.$id === activeCampusId ||
          cd.name?.toLowerCase() === activeCampus.name?.toLowerCase()
      ) || null
    );
  }, [activeCampus, activeCampusId, campusData]);

  // Server-side scoping already narrowed these lists; this is the belt-and-
  // braces pass for the frame between a switcher change and the refetch.
  const campusSpecificEvents = useMemo(() => {
    if (!campusScope) {
      return events;
    }
    return events.filter(
      (event) => !!event.campus_id && campusScope.includes(event.campus_id)
    );
  }, [events, campusScope]);

  const campusSpecificJobs = useMemo(() => {
    if (!campusScope) {
      return jobs;
    }
    return jobs.filter(
      (job) => !!job.campus_id && campusScope.includes(job.campus_id)
    );
  }, [jobs, campusScope]);

  const campusSpecificNews = useMemo(() => {
    if (!campusScope) {
      return news;
    }
    return news.filter(
      (item) => !!item.campus_id && campusScope.includes(item.campus_id)
    );
  }, [news, campusScope]);

  const campusSpecificDepartments = useMemo(() => {
    if (!activeCampusId) {
      return departments;
    }
    return departments.filter(
      (dept) => dept.department_ref?.campus_id === activeCampusId
    );
  }, [departments, activeCampusId]);

  // Calculate stats
  const stats = useMemo(
    () => ({
      departments: campusSpecificDepartments.length,
      events: campusSpecificEvents.length,
      jobs: campusSpecificJobs.length,
    }),
    [
      campusSpecificDepartments.length,
      campusSpecificEvents.length,
      campusSpecificJobs.length,
    ]
  );

  // Get fallback team from campus data
  const fallbackTeam = useMemo(() => {
    if (!activeCampusData?.departmentBoard) {
      return [];
    }
    return activeCampusData.departmentBoard.filter(
      (member): member is DepartmentBoard => !!member?.name
    );
  }, [activeCampusData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full width, no container */}
      <CampusHero
        campusMetadata={activeCampusMetadata}
        campusName={activeCampus?.name || null}
        locale={locale}
        stats={stats}
      />

      {/* Tabbed Content - Inside container */}
      <div className="mx-auto max-w-7xl px-4">
        <CampusTabs
          content={{
            overview: (
              <div className="space-y-12 py-12">
                <FocusAreas
                  campusMetadata={activeCampusMetadata}
                  locale={locale}
                />
                <UpcomingEvents events={campusSpecificEvents} locale={locale} />
                <div className="grid gap-8 lg:grid-cols-2">
                  <LatestNews locale={locale} news={campusSpecificNews} />
                  <JobPostings jobs={campusSpecificJobs} locale={locale} />
                </div>
                <DepartmentsGrid
                  activeCampusId={activeCampusId}
                  departments={campusSpecificDepartments}
                  locale={locale}
                />
              </div>
            ),
            students: (
              <div className="py-12">
                <StudentsTab campusData={activeCampusData} locale={locale} />
              </div>
            ),
            partners: (
              <div className="py-12">
                <PartnersTab
                  campusData={activeCampusData}
                  campusName={activeCampus?.name || null}
                  locale={locale}
                />
              </div>
            ),
            team: (
              <div className="py-12">
                <TeamTab
                  campusId={activeCampusId}
                  campusName={activeCampus?.name || null}
                  fallbackTeam={fallbackTeam}
                  locale={locale}
                />
              </div>
            ),
          }}
          locale={locale}
        />
      </div>
    </div>
  );
}
