import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AboutSection } from "@/components/home/about-section";
import { EventsSection } from "@/components/home/events-section";
import { HeroSection } from "@/components/home/hero-section";
import { JoinUs } from "@/components/home/join-us";
import { NewsSection } from "@/components/home/news-section";
import { Partners } from "@/components/home/partners";
import {
  AboutSkeleton,
  EventsSkeleton,
  HeroSkeleton,
  NewsSkeleton,
} from "@/components/home/skeletons";
import { getUserPreferences } from "@/lib/auth-utils";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import {
  cachedCampuses,
  cachedHomeCounts,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedNews,
} from "@/lib/data/public-content";
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

// Member-scoped feeds: anonymous visitors (all bot/monitor traffic) share the
// "use cache" guest result; session holders read per-request so member-only
// rows (row perms `team:biso-members`) still appear in their feeds.
function homeEvents(
  hasSession: boolean,
  locale: Locale,
  campusKey: string | null,
  limit: number
) {
  if (hasSession) {
    return listEvents({
      campus: campusKey ?? "all",
      limit,
      locale,
      status: "published",
    });
  }
  return cachedPublishedEvents(locale, campusKey, limit).catch(() => []);
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
  // Campuses/partners/counts are not member-scoped and stay cached for
  // everyone. Failures fall back per-slice so a transient Appwrite error
  // renders an emptier homepage instead of a 500 — and is never cached.
  const [heroEvents, heroNews, events, news, campuses, counts, partners] =
    await Promise.all([
      homeEvents(hasSession, locale, campusKey, HERO_EVENTS_LIMIT),
      homeNews(hasSession, locale, campusKey, HERO_NEWS_LIMIT),
      homeEvents(hasSession, locale, campusKey, HOME_EVENTS_LIMIT),
      homeNews(hasSession, locale, campusKey, HOME_NEWS_LIMIT),
      cachedCampuses(campusKey, false, true).catch(() => []),
      cachedHomeCounts(campusKey).catch(() => ({
        eventCount: 0,
        jobCount: 0,
      })),
      cachedPartners().catch(() => []),
    ]);
  const departments = campuses.reduce(
    (acc, campus) => acc + campus.departments.length,
    0
  );
  return (
    <div className="min-h-screen bg-linear-to-b from-background via-section to-background">
      <Suspense fallback={<HeroSkeleton />}>
        <HeroSection events={heroEvents} news={heroNews} />
      </Suspense>

      <Suspense fallback={<AboutSkeleton />}>
        <AboutSection
          departmentsCount={departments}
          eventCount={counts.eventCount}
          jobCount={counts.jobCount}
        />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsSection events={events} />
      </Suspense>

      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection news={news} />
      </Suspense>

      <JoinUs />
      <Partners partners={partners} />
    </div>
  );
}
