import type { CampusMetadata } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CampusSections } from "@/components/home/campus-sections";
import { EventsSection } from "@/components/home/events-section";
import { HeroSection } from "@/components/home/hero-section";
import { JoinUs } from "@/components/home/join-us";
import { LeadershipSection } from "@/components/home/leadership-section";
import { NewsSection } from "@/components/home/news-section";
import { OverviewSection } from "@/components/home/overview-section";
import { Partners } from "@/components/home/partners";
import {
  EventsSkeleton,
  HeroSkeleton,
  LeadershipSkeleton,
  NewsSkeleton,
  OverviewSkeleton,
} from "@/components/home/skeletons";
import { getUserPreferences } from "@/lib/auth-utils";
import {
  leadershipCampusId,
  localizedFocusAreas,
  managementDepartmentId,
} from "@/lib/campus-leadership";
import { NATIONAL_CAMPUS_ID } from "@/lib/campus-scope";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import { getMembershipTextItems } from "@/lib/data/membership-texts";
import {
  cachedCampuses,
  cachedCampusMetadata,
  cachedHomeCounts,
  cachedOpenJobs,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedNews,
} from "@/lib/data/public-content";
import { cachedPublicUnits } from "@/lib/data/units";
import { listEvents } from "../actions/events";
import { getLocale } from "../actions/locale";
import { listNews } from "../actions/news";

export const metadata: Metadata = {
  title: "BISO – BI Student Organisation",
  description:
    "BI Student Organisation (BISO) is the student association at BI Norwegian Business School — events, volunteer opportunities, student benefits, and campus life across Oslo, Bergen, Trondheim, and Stavanger.",
};

// Enough for the homepage grid — the full listing lives on /events.
const HOME_EVENTS_LIMIT = 12;
const HOME_NEWS_LIMIT = 3;
const HERO_EVENTS_LIMIT = 3;
const HERO_NEWS_LIMIT = 2;
const HOME_JOBS_LIMIT = 3;

// Split feeds: anonymous visitors (all bot/monitor traffic) share the
// "use cache" guest result; session holders read per-request so their own
// campus/locale selection applies without waiting for the cache to catch up.
// Both feeds include members-only events: that flag limits who can join an
// event, not who can see it.
// `upcomingOnly` is now a precise server-side query (`queryEvents`'s
// three-armed `Query.or` over end_date/start_date), not a post-fetch filter —
// so this multiplier is no longer compensating for rows lost after the fetch.
// Kept as-is (asking for more than we render, then slicing) rather than
// removed, since this task is fixing the pagination/search regressions, not
// re-tuning the home page's fetch sizing.
const UPCOMING_OVERFETCH = 4;

function homeEvents(
  hasSession: boolean,
  locale: Locale,
  campusKey: string | null,
  limit: number
) {
  const fetchLimit = limit * UPCOMING_OVERFETCH;
  if (hasSession) {
    return listEvents({
      campus: campusKey ?? "all",
      locale,
      pageSize: fetchLimit,
      status: "published",
      upcomingOnly: true,
    }).then((result) => result.rows.slice(0, limit));
  }
  return cachedPublishedEvents(locale, campusKey, fetchLimit)
    .then((events) => events.slice(0, limit))
    .catch(() => []);
}

function homeNews(
  hasSession: boolean,
  locale: Locale,
  campusKey: string | null,
  limit: number
) {
  if (hasSession) {
    return listNews({
      campus: campusKey ?? "all",
      limit,
      locale,
      status: "published",
    });
  }
  return cachedPublishedNews(locale, campusKey, limit).catch(() => []);
}

export default async function HomePage() {
  const [prefs, locale, cookieStore] = await Promise.all([
    getUserPreferences(),
    getLocale(),
    cookies(),
  ]);
  const campusId = prefs?.campusId;
  const campusKey = campusId && campusId !== "all" ? campusId : null;
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE));

  // The hero is campus-scoped like every other feed: the switcher filters the
  // whole site, so a visitor on Bergen must not be shown Oslo content. National
  // rows ride along with any selected campus (see `campusScopeIds`).
  // Partners/counts are not member-scoped and stay cached for
  // everyone. Failures fall back per-slice so a transient Appwrite error
  // renders an emptier homepage instead of a 500 — and is never cached.
  // The campus overview that used to live only on /campus: focus areas,
  // leadership, open roles and the unit grid, all scoped like the feeds and
  // all read through the guest cache. The leadership section fetches its own
  // board inside Suspense, so a slow directory never holds the page.
  const boardCampusId = leadershipCampusId(campusKey);
  const [
    heroEvents,
    heroNews,
    events,
    news,
    counts,
    partners,
    campuses,
    campusMetadata,
    jobs,
    units,
    joinItems,
  ] = await Promise.all([
    homeEvents(hasSession, locale, campusKey, HERO_EVENTS_LIMIT),
    homeNews(hasSession, locale, campusKey, HERO_NEWS_LIMIT),
    homeEvents(hasSession, locale, campusKey, HOME_EVENTS_LIMIT),
    homeNews(hasSession, locale, campusKey, HOME_NEWS_LIMIT),
    cachedHomeCounts(campusKey, locale).catch(() => ({
      departmentCount: 0,
      eventCount: 0,
      jobCount: 0,
    })),
    cachedPartners().catch(() => []),
    cachedCampuses(null, true, false).catch(() => []),
    cachedCampusMetadata().catch((): Record<string, CampusMetadata> => ({})),
    cachedOpenJobs(campusKey, locale, HOME_JOBS_LIMIT).catch(() => []),
    cachedPublicUnits(locale).catch(() => []),
    getMembershipTextItems("home_join", locale),
  ]);

  // National is a scope, not a place: its copy is the no-campus copy.
  const campusName =
    campusKey && campusKey !== NATIONAL_CAMPUS_ID
      ? (campuses.find((campus) => campus.$id === campusKey)?.name ?? null)
      : null;
  const campusUnits = campusKey
    ? units.filter((unit) => unit.campusId === campusKey)
    : units;
  const managementUnitId = managementDepartmentId(boardCampusId);
  const teamHref =
    units.find((unit) => unit.id === managementUnitId)?.href ?? null;

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-section to-background">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection
          campusName={campusName}
          events={heroEvents}
          news={heroNews}
        />
      </Suspense>

      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewSection
          campusName={campusName}
          departmentsCount={counts.departmentCount}
          eventCount={counts.eventCount}
          focusAreas={localizedFocusAreas(
            campusMetadata[boardCampusId] ?? null,
            locale
          )}
          jobCount={counts.jobCount}
          locale={locale}
        />
      </Suspense>

      <Suspense fallback={<LeadershipSkeleton />}>
        <LeadershipSection
          campusId={boardCampusId}
          campusName={campusName}
          teamHref={teamHref}
        />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsSection events={events} />
      </Suspense>

      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection news={news} />
      </Suspense>

      <CampusSections
        activeCampusId={campusKey}
        jobs={jobs}
        locale={locale}
        units={campusUnits}
      />

      <JoinUs items={joinItems} />
      <Partners partners={partners} />
    </div>
  );
}
