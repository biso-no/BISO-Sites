"use client";

import { useMemo } from "react";
import { useCampus } from "@/components/context/campus";
import { CampusHero } from "./campus-hero";
import { CampusTabs } from "./campus-tabs";
import { FocusAreas } from "./overview/focus-areas";
import { UpcomingEvents } from "./overview/upcoming-events";
import { LatestNews } from "./overview/latest-news";
import { JobPostings } from "./overview/job-postings";
import { DepartmentsGrid } from "./overview/departments-grid";
import { StudentsTab } from "./students/students-tab";
import { PartnersTab } from "./partners/partners-tab";
import { TeamTab } from "./team/team-tab";
import type {
  ContentTranslations,
  Departments,
  CampusData,
  CampusMetadata,
  DepartmentBoard,
} from "@repo/api/types/appwrite";
import type { Locale } from "@/i18n/config";

interface CampusPageClientProps {
  events: ContentTranslations[];
  jobs: ContentTranslations[];
  news: ContentTranslations[];
  departments: Departments[];
  campusData: CampusData[];
  campusMetadata: Record<string, CampusMetadata>;
  locale: Locale;
}

export function CampusPageClient({
  events,
  jobs,
  news,
  departments,
  campusData,
  campusMetadata,
  locale,
}: CampusPageClientProps) {
  const { activeCampus, activeCampusId } = useCampus();

  // Get campus-specific metadata
  const activeCampusMetadata = useMemo(() => {
    if (!activeCampusId) return null;
    return (
      campusMetadata[activeCampusId] ||
      Object.values(campusMetadata).find(
        (m) => m.campus_name?.toLowerCase() === activeCampus?.name?.toLowerCase()
      ) ||
      null
    );
  }, [activeCampusId, activeCampus, campusMetadata]);

  // Get campus-specific data
  const activeCampusData = useMemo(() => {
    if (!activeCampus) return null;
    return (
      campusData.find(
        (cd) =>
          cd.$id === activeCampusId ||
          cd.name?.toLowerCase() === activeCampus.name?.toLowerCase()
      ) || null
    );
  }, [activeCampus, activeCampusId, campusData]);

  // Filter content by campus
  const campusSpecificEvents = useMemo(() => {
    if (!activeCampusId) return events;
    return events.filter(
      (event) => event.event_ref?.campus_id === activeCampusId
    );
  }, [events, activeCampusId]);

  const campusSpecificJobs = useMemo(() => {
    if (!activeCampusId) return jobs;
    return jobs.filter((job) => job.job_ref?.campus_id === activeCampusId);
  }, [jobs, activeCampusId]);

  const campusSpecificNews = useMemo(() => {
    if (!activeCampusId) return news;
    return news.filter((item) => item.news_ref?.campus_id === activeCampusId);
  }, [news, activeCampusId]);

  const campusSpecificDepartments = useMemo(() => {
    if (!activeCampusId) return departments;
    return departments.filter((dept) => dept.campus_id === activeCampusId);
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
    if (!activeCampusData?.departmentBoard) return [];
    return activeCampusData.departmentBoard.filter(
      (member): member is DepartmentBoard => !!member?.name
    );
  }, [activeCampusData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Full width, no container */}
      <CampusHero
        campusName={activeCampus?.name || null}
        campusMetadata={activeCampusMetadata}
        stats={stats}
        locale={locale}
      />

      {/* Tabbed Content - Inside container */}
      <div className="max-w-7xl mx-auto px-4">
        <CampusTabs
          locale={locale}
          children={{
            overview: (
              <div className="space-y-12 py-12">
                <FocusAreas
                  campusMetadata={activeCampusMetadata}
                  locale={locale}
                />
                <UpcomingEvents events={campusSpecificEvents} locale={locale} />
                <div className="grid lg:grid-cols-2 gap-8">
                  <LatestNews news={campusSpecificNews} locale={locale} />
                  <JobPostings jobs={campusSpecificJobs} locale={locale} />
                </div>
                <DepartmentsGrid
                  departments={campusSpecificDepartments}
                  locale={locale}
                  activeCampusId={activeCampusId}
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
                  fallbackTeam={fallbackTeam}
                  campusId={activeCampusId}
                  campusName={activeCampus?.name || null}
                  locale={locale}
                />
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}
