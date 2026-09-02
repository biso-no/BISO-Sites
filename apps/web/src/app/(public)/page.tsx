import type { Locale } from "@repo/i18n/config";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { HomeV2 } from "@/components/home/v2/home-v2";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { SESSION_COOKIE } from "@/lib/cookie-prefs";
import {
  cachedHomeCounts,
  cachedPartners,
  cachedPublishedEvents,
  cachedPublishedNews,
} from "@/lib/data/public-content";
import { listEvents } from "../actions/events";
import { getLocale } from "../actions/locale";
import { listNews } from "../actions/news";

export const metadata: Metadata = {
  // `/?campus=bergen` is a filtered view of the front page, not a second front
  // page — same rule the other scoped feeds follow.
  alternates: { canonical: "/" },
  title: "BISO – BI Student Organisation",
  description:
    "BI Student Organisation (BISO) is the student association at BI Norwegian Business School — events, volunteer opportunities, student benefits, and campus life across Oslo, Bergen, Trondheim, and Stavanger.",
};

// Enough for the homepage grid — the full listing lives on /events.
const HOME_EVENTS_LIMIT = 12;
const HOME_NEWS_LIMIT = 3;

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

interface HomePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [sp, prefs, locale, cookieStore] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getLocale(),
    cookies(),
  ]);
  // The front page is a campus-scoped feed like the rest: URL beats cookie
  // beats "all". It read the cookie alone before, so `/?campus=bergen` — the
  // URL the switcher now produces, and the one people share — was ignored.
  // An unrecognised campus 404s rather than silently showing everything.
  const campusKey = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campusKey === undefined) {
    notFound();
  }
  const hasSession = Boolean(cookieStore.get(SESSION_COOKIE));

  // The hero is campus-scoped like every other feed: the switcher filters the
  // whole site, so a visitor on Bergen must not be shown Oslo content. National
  // rows ride along with any selected campus (see `campusScopeIds`).
  // Campuses/partners/counts are not member-scoped and stay cached for
  // everyone. Failures fall back per-slice so a transient Appwrite error
  // renders an emptier homepage instead of a 500 — and is never cached.
  // RD-030: the v1 hero carousel took its own smaller slices (`HERO_*`); the
  // v2 home reads the same feeds the grid does, so those two extra Appwrite
  // round-trips per homepage render are gone with it. `campuses` was only
  // there to count departments for a v1 stat.
  const [events, news, counts, partners] = await Promise.all([
    homeEvents(hasSession, locale, campusKey, HOME_EVENTS_LIMIT),
    homeNews(hasSession, locale, campusKey, HOME_NEWS_LIMIT),
    cachedHomeCounts(campusKey).catch(() => ({
      eventCount: 0,
      jobCount: 0,
    })),
    cachedPartners().catch(() => []),
  ]);
  return (
    <HomeV2
      eventCount={counts.eventCount}
      events={events}
      jobCount={counts.jobCount}
      locale={locale}
      news={news}
      partners={partners}
    />
  );
}
