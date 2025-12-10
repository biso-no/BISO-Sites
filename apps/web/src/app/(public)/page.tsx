import { Suspense } from "react";
import { AboutSection } from "@/components/home/about-section";
import { EventsSection } from "@/components/home/events-section";
import { HeroSection } from "@/components/home/hero-section";
import { JoinUs } from "@/components/home/join-us";
import { NewsSection } from "@/components/home/news-section";
import {
  AboutSkeleton,
  EventsSkeleton,
  HeroSkeleton,
  NewsSkeleton,
} from "@/components/home/skeletons";
import { getCampuses } from "../actions/campus";
import { listEvents } from "../actions/events";
import { listJobs } from "../actions/jobs";
import { getLocale } from "../actions/locale";
import { listNews } from "../actions/news";
import { getUserPreferences } from "@/lib/auth-utils";

export default async function HomePage() {

  const prefs = await getUserPreferences();
  const campusId = prefs?.campusId;

  const locale = await getLocale();
    const [events, jobs, campuses, news] = await Promise.all([
    listEvents({ locale, status: "published", limit: 1000, campus: campusId ?? "all" }),
    listJobs({ locale, status: "published", limit: 1000 }),
    getCampuses({
      selectedCampusId: campusId ?? "all",
      includeDepartments: true,
      includeNational: false,
    }),
    listNews({
      campus: campusId ?? "all",
      locale,
      status: "published",
      limit: 3,
    })
  ]);
  const departments = campuses.reduce(
    (acc, campus) => acc + campus.departments.length,
    0
  );
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-section to-background">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection />
      </Suspense>

      <Suspense fallback={<AboutSkeleton />}>
        <AboutSection departmentsCount={departments} eventCount={events.length} jobCount={jobs.length} />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsSection events={events}/>
      </Suspense>

      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection news={news}/>
      </Suspense>

      <JoinUs />
    </div>
  );
}
