import type { Metadata } from "next";
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
import {
  cachedCampuses,
  cachedHomeCounts,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedNews,
} from "@/lib/data/public-content";
import { getLocale } from "../actions/locale";

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

export default async function HomePage() {
  const [prefs, locale] = await Promise.all([
    getUserPreferences(),
    getLocale(),
  ]);
  const campusId = prefs?.campusId;
  const campusKey = campusId && campusId !== "all" ? campusId : null;

  // All cached (`"use cache"` + guest client): shared across every visitor,
  // keyed only by locale/campus. Failures fall back per-slice so a transient
  // Appwrite error renders an emptier homepage instead of a 500 — and is
  // never cached.
  const [heroEvents, heroNews, events, news, campuses, counts, partners] =
    await Promise.all([
      cachedPublishedEvents(locale, null, HERO_EVENTS_LIMIT).catch(() => []),
      cachedPublishedNews(locale, null, HERO_NEWS_LIMIT).catch(() => []),
      cachedPublishedEvents(locale, campusKey, HOME_EVENTS_LIMIT).catch(
        () => []
      ),
      cachedPublishedNews(locale, campusKey, HOME_NEWS_LIMIT).catch(() => []),
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
